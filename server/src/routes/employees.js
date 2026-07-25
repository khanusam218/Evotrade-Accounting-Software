const express = require('express');
const router = express.Router();
const pool = require('../db');

async function nextCode(client) {
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='EMP-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'EMP-' + rows[0].lpad;
}

router.get('/', async (req, res) => {
  try {
    const { search, department_id, is_active } = req.query;
    let q = `SELECT e.*, d.name AS department_name, des.name AS designation_name
             FROM employees e
             LEFT JOIN departments d ON d.id=e.department_id
             LEFT JOIN designations des ON des.id=e.designation_id
             WHERE 1=1`;
    const p = [];
    if (department_id) { p.push(department_id); q += ` AND e.department_id=$${p.length}`; }
    if (is_active !== undefined) { p.push(is_active === 'true'); q += ` AND e.is_active=$${p.length}`; }
    if (search)        { p.push(`%${search}%`); q += ` AND (e.code ILIKE $${p.length} OR e.name ILIKE $${p.length} OR e.cnic ILIKE $${p.length})`; }
    q += ' ORDER BY e.name';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, d.name AS department_name, des.name AS designation_name
       FROM employees e
       LEFT JOIN departments d ON d.id=e.department_id
       LEFT JOIN designations des ON des.id=e.designation_id
       WHERE e.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { name, department_id, designation_id, join_date, salary, ntn, cnic, phone, email, address, bank_account, notes, is_active = true } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const code = await nextCode(client);
    const { rows } = await client.query(
      'INSERT INTO employees (code,name,department_id,designation_id,join_date,salary,ntn,cnic,phone,email,address,bank_account,notes,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',
      [code, name, department_id || null, designation_id || null, join_date || null, salary || 0, ntn || null, cnic || null, phone || null, email || null, address || null, bank_account || null, notes || null, is_active]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { name, department_id, designation_id, join_date, salary, ntn, cnic, phone, email, address, bank_account, notes, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE employees SET name=$1,department_id=$2,designation_id=$3,join_date=$4,salary=$5,ntn=$6,cnic=$7,phone=$8,email=$9,address=$10,bank_account=$11,notes=$12,is_active=$13 WHERE id=$14 RETURNING *',
      [name, department_id || null, designation_id || null, join_date || null, salary || 0, ntn || null, cnic || null, phone || null, email || null, address || null, bank_account || null, notes || null, is_active ?? true, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM employees WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
