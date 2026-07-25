const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM departments ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { name, notes } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO departments (name,notes) VALUES ($1,$2) RETURNING *', [name, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { name, notes } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE departments SET name=$1,notes=$2 WHERE id=$3 RETURNING *', [name, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM departments WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
