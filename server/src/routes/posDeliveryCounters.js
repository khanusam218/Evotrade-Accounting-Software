const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT dc.*, w.name AS warehouse_name,
              COALESCE(
                json_agg(json_build_object('id', dcc.category_id, 'name', pc.name))
                FILTER (WHERE dcc.category_id IS NOT NULL), '[]'
              ) AS categories
       FROM pos_delivery_counters dc
       LEFT JOIN warehouses w ON w.id = dc.warehouse_id
       LEFT JOIN pos_delivery_counter_categories dcc ON dcc.counter_id = dc.id
       LEFT JOIN product_categories pc ON pc.id = dcc.category_id
       GROUP BY dc.id, w.name
       ORDER BY dc.id`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, warehouse_id, notes, category_ids } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO pos_delivery_counters (name, warehouse_id, notes)
       VALUES ($1,$2,$3) RETURNING *`,
      [name, warehouse_id || null, notes || null]
    );
    const counter = rows[0];
    if (Array.isArray(category_ids) && category_ids.length) {
      for (const cid of category_ids) {
        await client.query(
          'INSERT INTO pos_delivery_counter_categories (counter_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [counter.id, cid]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json(counter);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const { name, warehouse_id, notes, is_active, category_ids } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE pos_delivery_counters
       SET name=$1, warehouse_id=$2, notes=$3, is_active=$4
       WHERE id=$5 RETURNING *`,
      [name, warehouse_id || null, notes || null, is_active ?? true, req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    await client.query('DELETE FROM pos_delivery_counter_categories WHERE counter_id=$1', [req.params.id]);
    if (Array.isArray(category_ids) && category_ids.length) {
      for (const cid of category_ids) {
        await client.query(
          'INSERT INTO pos_delivery_counter_categories (counter_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [req.params.id, cid]
        );
      }
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM pos_delivery_counters WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
