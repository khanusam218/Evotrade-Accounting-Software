const express = require('express');
const router  = express.Router();
const pool    = require('../db');

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, is_active FROM brands WHERE is_active = true ORDER BY name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `INSERT INTO brands (name) VALUES ($1) RETURNING *`, [name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `UPDATE brands SET name = $1 WHERE id = $2 RETURNING *`,
      [name.trim(), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Brand not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM brands WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Brand not found' });
    res.json({ message: 'Brand deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
