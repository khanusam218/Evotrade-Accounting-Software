const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix } = require('../utils');

async function nextNumber(client) {
  await getOrCreateSeriesByPrefix(client, 'EV-', 6);
  const { rows: nsRows } = await client.query(
    "SELECT prefix, next_number, padding FROM number_series WHERE prefix='EV-' FOR UPDATE"
  );
  if (!nsRows.length) throw new Error('Event number series not configured');
  const { prefix, next_number, padding } = nsRows[0];
  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
     FROM crm_events WHERE number ~ '^EV-[0-9]+$'`
  );
  const useNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
  await client.query("UPDATE number_series SET next_number=$1 WHERE prefix='EV-'", [useNum + 1]);
  return `${prefix}${String(useNum).padStart(Number(padding), '0')}`;
}

router.get('/next-number', async (_req, res) => {
  try {
    await getOrCreateSeriesByPrefix(pool, 'EV-', 6);
    const { rows } = await pool.query("SELECT prefix, next_number, padding FROM number_series WHERE prefix='EV-'");
    if (!rows.length) return res.json({ number: 'EV-000001' });
    const { prefix, next_number, padding } = rows[0];
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
       FROM crm_events WHERE number ~ '^EV-[0-9]+$'`
    );
    const preview = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
    res.json({ number: `${prefix}${String(preview).padStart(Number(padding), '0')}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    let q = `SELECT e.*, c.print_name AS customer_name FROM crm_events e LEFT JOIN customers c ON c.id=e.customer_id WHERE 1=1`;
    const p = [];
    if (status)    { p.push(status);        q += ` AND e.status=$${p.length}`; }
    if (date_from) { p.push(date_from);     q += ` AND e.start_date::date>=$${p.length}`; }
    if (date_to)   { p.push(date_to);       q += ` AND e.start_date::date<=$${p.length}`; }
    if (search)    { p.push(`%${search}%`); q += ` AND (e.number ILIKE $${p.length} OR e.subject ILIKE $${p.length})`; }
    q += ' ORDER BY e.start_date DESC, e.id DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT e.*, c.print_name AS customer_name FROM crm_events e LEFT JOIN customers c ON c.id=e.customer_id WHERE e.id=$1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const FIELDS = ['subject','customer_id','lead_id','contact_name','phone','phone_2','city','event_type',
                 'start_date','end_date','assigned_to','status','priority','location','source','description','notes'];

router.post('/', async (req, res) => {
  const { start_date, end_date } = req.body;
  if (end_date && start_date && new Date(end_date) < new Date(start_date))
    return res.status(400).json({ error: 'End date must be >= Start date' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await nextNumber(client);
    const vals = FIELDS.map(f => req.body[f] ?? null);
    const cols = FIELDS.join(',');
    const ph   = FIELDS.map((_, i) => `$${i + 2}`).join(',');
    const { rows } = await client.query(
      `INSERT INTO crm_events (number,${cols}) VALUES ($1,${ph}) RETURNING *`,
      [number, ...vals]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { start_date, end_date } = req.body;
  if (end_date && start_date && new Date(end_date) < new Date(start_date))
    return res.status(400).json({ error: 'End date must be >= Start date' });
  try {
    const vals = FIELDS.map(f => req.body[f] ?? null);
    const set  = FIELDS.map((f, i) => `${f}=$${i + 1}`).join(',');
    const { rows } = await pool.query(
      `UPDATE crm_events SET ${set} WHERE id=$${FIELDS.length + 1} RETURNING *`,
      [...vals, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM crm_events WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
