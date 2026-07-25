const express = require('express');
const router  = express.Router();
const pool    = require('../db');

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT pc.*, parent.name AS parent_name
         FROM product_categories pc
         LEFT JOIN product_categories parent ON parent.id = pc.parent_id
        WHERE pc.is_active = true
        ORDER BY pc.name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, parent_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `INSERT INTO product_categories (name, parent_id) VALUES ($1, $2) RETURNING *`,
      [name.trim(), parent_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, parent_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `UPDATE product_categories SET name = $1, parent_id = $2 WHERE id = $3 RETURNING *`,
      [name.trim(), parent_id || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM product_categories WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
