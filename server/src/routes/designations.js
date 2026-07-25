const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { department_id } = req.query;
    let q = `SELECT d.*, dep.name AS department_name FROM designations d LEFT JOIN departments dep ON dep.id=d.department_id WHERE 1=1`;
    const p = [];
    if (department_id) { p.push(department_id); q += ` AND d.department_id=$${p.length}`; }
    q += ' ORDER BY d.name';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { name, department_id, notes } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO designations (name,department_id,notes) VALUES ($1,$2,$3) RETURNING *',
      [name, department_id || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { name, department_id, notes } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE designations SET name=$1,department_id=$2,notes=$3 WHERE id=$4 RETURNING *',
      [name, department_id || null, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM designations WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
