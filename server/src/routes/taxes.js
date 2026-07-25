const express = require('express');
const router  = express.Router();
const pool    = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const { applies_to } = req.query; // 'sales' | 'purchases'
    let query = `SELECT id, name, abbreviation, rate, tax_type,
                        applies_to_sales, applies_to_purchases
                   FROM taxes WHERE is_active = true`;
    if (applies_to === 'sales')     query += ` AND applies_to_sales = true`;
    if (applies_to === 'purchases') query += ` AND applies_to_purchases = true`;
    query += ` ORDER BY name`;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/taxes
router.post('/', async (req, res, next) => {
  try {
    const { name, abbreviation, rate, tax_type = 'regular', applies_to_sales = false, applies_to_purchases = false } = req.body;
    if (!name || !name.trim())                 return res.status(400).json({ error: 'name is required' });
    if (!abbreviation || !abbreviation.trim())  return res.status(400).json({ error: 'abbreviation is required' });
    if (rate === undefined || rate === null || rate === '') return res.status(400).json({ error: 'rate is required' });

    const { rows } = await pool.query(
      `INSERT INTO taxes (name, abbreviation, rate, tax_type, applies_to_sales, applies_to_purchases)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name.trim(), abbreviation.trim(), Number(rate), tax_type, !!applies_to_sales, !!applies_to_purchases]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/taxes/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, abbreviation, rate, tax_type = 'regular', applies_to_sales = false, applies_to_purchases = false, is_active = true } = req.body;
    if (!name || !name.trim())                 return res.status(400).json({ error: 'name is required' });
    if (!abbreviation || !abbreviation.trim())  return res.status(400).json({ error: 'abbreviation is required' });
    if (rate === undefined || rate === null || rate === '') return res.status(400).json({ error: 'rate is required' });

    const { rows } = await pool.query(
      `UPDATE taxes SET
          name = $1, abbreviation = $2, rate = $3, tax_type = $4,
          applies_to_sales = $5, applies_to_purchases = $6, is_active = $7
        WHERE id = $8
        RETURNING *`,
      [name.trim(), abbreviation.trim(), Number(rate), tax_type, !!applies_to_sales, !!applies_to_purchases, !!is_active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tax not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/taxes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM taxes WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tax not found' });
    res.json({ message: 'Tax deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
