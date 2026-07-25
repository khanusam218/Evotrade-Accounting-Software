const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT at.*, coa.name AS account_name
       FROM adjustment_types at
       LEFT JOIN chart_of_accounts coa ON coa.id = at.account_id
       ORDER BY at.id`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, direction, account_id, description } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO adjustment_types (name, direction, account_id, description)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, direction || 'add', account_id || null, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, direction, account_id, description, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE adjustment_types
       SET name=$1, direction=$2, account_id=$3, description=$4, is_active=$5
       WHERE id=$6 RETURNING *`,
      [name, direction, account_id || null, description || null, is_active ?? true, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const used = await pool.query(
      'SELECT 1 FROM stock_adjustments WHERE adjustment_type_id=$1 LIMIT 1',
      [req.params.id]
    );
    if (used.rows.length) return res.status(400).json({ error: 'Type is in use by adjustments' });
    await pool.query('DELETE FROM adjustment_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
