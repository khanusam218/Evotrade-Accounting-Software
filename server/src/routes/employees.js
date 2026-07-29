const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix, safeNextNumber } = require('../utils');

async function nextCode(client) {
  const series = await getOrCreateSeriesByPrefix(client, 'EMP-', 5);
  return safeNextNumber(client, series, 'prefix', 'EMP-', 'employees', 'code');
}

router.get('/', async (req, res) => {
  try {
    const { search, department_id, is_active } = req.query;
    let q = `SELECT e.*, d.name AS department_name, des.name AS designation_name,
                    u.user_id AS application_user_login
             FROM employees e
             LEFT JOIN departments d ON d.id=e.department_id
             LEFT JOIN designations des ON des.id=e.designation_id
             LEFT JOIN users u ON u.id=e.application_user_id
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
      `SELECT e.*, d.name AS department_name, des.name AS designation_name,
              u.user_id AS application_user_login
       FROM employees e
       LEFT JOIN departments d ON d.id=e.department_id
       LEFT JOIN designations des ON des.id=e.designation_id
       LEFT JOIN users u ON u.id=e.application_user_id
       WHERE e.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { name, department_id, designation_id, join_date, salary, ntn, cnic, phone, email, address, bank_account, notes, is_active = true, application_user_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const code = await nextCode(client);
    const { rows } = await client.query(
      'INSERT INTO employees (code,name,department_id,designation_id,join_date,salary,ntn,cnic,phone,email,address,bank_account,notes,is_active,application_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *',
      [code, name, department_id || null, designation_id || null, join_date || null, salary || 0, ntn || null, cnic || null, phone || null, email || null, address || null, bank_account || null, notes || null, is_active, application_user_id || null]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { name, department_id, designation_id, join_date, salary, ntn, cnic, phone, email, address, bank_account, notes, is_active, application_user_id } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE employees SET name=$1,department_id=$2,designation_id=$3,join_date=$4,salary=$5,ntn=$6,cnic=$7,phone=$8,email=$9,address=$10,bank_account=$11,notes=$12,is_active=$13,application_user_id=$14 WHERE id=$15 RETURNING *',
      [name, department_id || null, designation_id || null, join_date || null, salary || 0, ntn || null, cnic || null, phone || null, email || null, address || null, bank_account || null, notes || null, is_active ?? true, application_user_id || null, req.params.id]
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
