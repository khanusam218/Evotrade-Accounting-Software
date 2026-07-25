const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search, status, customer_id } = req.query;
    let q = `SELECT p.*, c.print_name AS customer_name FROM projects p LEFT JOIN customers c ON c.id=p.customer_id WHERE 1=1`;
    const pr = [];
    if (status)      { pr.push(status);        q += ` AND p.status=$${pr.length}`; }
    if (customer_id) { pr.push(customer_id);   q += ` AND p.customer_id=$${pr.length}`; }
    if (search)      { pr.push(`%${search}%`); q += ` AND (p.name ILIKE $${pr.length} OR p.reference ILIKE $${pr.length})`; }
    q += ' ORDER BY p.name';
    const { rows } = await pool.query(q, pr);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT p.*, c.print_name AS customer_name FROM projects p LEFT JOIN customers c ON c.id=p.customer_id WHERE p.id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { name, customer_id, reference, start_date, end_date, budget, status = 'active', notes } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO projects (name,customer_id,reference,start_date,end_date,budget,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, customer_id || null, reference || null, start_date || null, end_date || null, budget || 0, status, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { name, customer_id, reference, start_date, end_date, budget, status, notes } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE projects SET name=$1,customer_id=$2,reference=$3,start_date=$4,end_date=$5,budget=$6,status=$7,notes=$8 WHERE id=$9 RETURNING *',
      [name, customer_id || null, reference || null, start_date || null, end_date || null, budget || 0, status, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM projects WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
