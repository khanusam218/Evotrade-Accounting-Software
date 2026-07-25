const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/vendor-categories
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, is_active
         FROM vendor_categories
        WHERE is_active = true
        ORDER BY name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/vendor-categories
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO vendor_categories (name) VALUES ($1) RETURNING *`,
      [name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/vendor-categories/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const { rows } = await pool.query(
      `UPDATE vendor_categories SET name = $1 WHERE id = $2 RETURNING *`,
      [name.trim(), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/vendor-categories/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM vendor_categories WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
