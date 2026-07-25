const express = require('express');
const router = express.Router();
const pool = require('../db');

async function nextNumber(client) {
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='CL-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'CL-' + rows[0].lpad;
}

router.get('/', async (req, res) => {
  try {
    const { status, search, assigned_to, date_from, date_to } = req.query;
    let q = `SELECT cl.*, c.print_name AS customer_name FROM crm_calls cl LEFT JOIN customers c ON c.id=cl.customer_id WHERE 1=1`;
    const p = [];
    if (status)      { p.push(status);           q += ` AND cl.status=$${p.length}`; }
    if (assigned_to) { p.push(`%${assigned_to}%`); q += ` AND cl.assigned_to ILIKE $${p.length}`; }
    if (date_from)   { p.push(date_from);         q += ` AND cl.call_date::date>=$${p.length}`; }
    if (date_to)     { p.push(date_to);           q += ` AND cl.call_date::date<=$${p.length}`; }
    if (search)      { p.push(`%${search}%`);     q += ` AND (cl.number ILIKE $${p.length} OR cl.subject ILIKE $${p.length})`; }
    q += ' ORDER BY cl.call_date DESC, cl.id DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT cl.*, c.print_name AS customer_name FROM crm_calls cl LEFT JOIN customers c ON c.id=cl.customer_id WHERE cl.id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { subject, customer_id, lead_id, contact_name, phone, call_type, call_purpose, call_date, duration_minutes, assigned_to, status = 'planned', follow_up_required = false, follow_up_date, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await nextNumber(client);
    const { rows } = await client.query(
      'INSERT INTO crm_calls (number,subject,customer_id,lead_id,contact_name,phone,call_type,call_purpose,call_date,duration_minutes,assigned_to,status,follow_up_required,follow_up_date,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *',
      [number, subject, customer_id || null, lead_id || null, contact_name || null, phone || null, call_type || null, call_purpose || null, call_date || null, duration_minutes || null, assigned_to || null, status, follow_up_required, follow_up_date || null, notes || null]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { subject, customer_id, lead_id, contact_name, phone, call_type, call_purpose, call_date, duration_minutes, assigned_to, status, follow_up_required, follow_up_date, notes } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE crm_calls SET subject=$1,customer_id=$2,lead_id=$3,contact_name=$4,phone=$5,call_type=$6,call_purpose=$7,call_date=$8,duration_minutes=$9,assigned_to=$10,status=$11,follow_up_required=$12,follow_up_date=$13,notes=$14 WHERE id=$15 RETURNING *',
      [subject, customer_id || null, lead_id || null, contact_name || null, phone || null, call_type || null, call_purpose || null, call_date || null, duration_minutes || null, assigned_to || null, status, follow_up_required || false, follow_up_date || null, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM crm_calls WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
