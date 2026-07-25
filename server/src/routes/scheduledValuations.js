const express = require('express');
const router  = express.Router();
const pool    = require('../db');

router.get('/', async (req, res) => {
  try {
    const { status, date_from, date_to, search } = req.query;
    let q = 'SELECT * FROM scheduled_valuations WHERE 1=1';
    const p = [];
    if (status)    { p.push(status);       q += ` AND status=$${p.length}`; }
    if (date_from) { p.push(date_from);    q += ` AND date>=$${p.length}`; }
    if (date_to)   { p.push(date_to);      q += ` AND date<=$${p.length}`; }
    if (search)    { p.push(`%${search}%`); q += ` AND narration ILIKE $${p.length}`; }
    q += ' ORDER BY date DESC, id DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { date, narration, status = 'pending' } = req.body;
  if (!date) return res.status(400).json({ error: 'Date is required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO scheduled_valuations (date, narration, status) VALUES ($1,$2,$3) RETURNING *',
      [date, narration || null, status]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { date, narration, status } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE scheduled_valuations SET date=$1, narration=$2, status=$3 WHERE id=$4 RETURNING *',
      [date, narration || null, status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM scheduled_valuations WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
