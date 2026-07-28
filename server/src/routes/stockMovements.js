const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix } = require('../utils');

async function nextNumber(client) {
  await getOrCreateSeriesByPrefix(client, 'SM-', 6);
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='SM-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'SM-' + rows[0].lpad;
}

async function saveLines(client, id, lines) {
  await client.query('DELETE FROM stock_movement_lines WHERE movement_id=$1', [id]);
  for (const l of lines) {
    if (!l.product_id || !l.quantity) continue;
    await client.query(
      'INSERT INTO stock_movement_lines (movement_id,product_id,quantity,notes) VALUES ($1,$2,$3,$4)',
      [id, l.product_id, l.quantity, l.notes || null]
    );
  }
}

router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    let q = `SELECT sm.*, fw.name AS from_warehouse_name, tw.name AS to_warehouse_name
             FROM stock_movements sm
             LEFT JOIN warehouses fw ON fw.id=sm.from_warehouse_id
             LEFT JOIN warehouses tw ON tw.id=sm.to_warehouse_id WHERE 1=1`;
    const p = [];
    if (status)    { p.push(status);       q += ` AND sm.status=$${p.length}`; }
    if (date_from) { p.push(date_from);    q += ` AND sm.date>=$${p.length}`; }
    if (date_to)   { p.push(date_to);      q += ` AND sm.date<=$${p.length}`; }
    if (search)    { p.push(`%${search}%`); q += ` AND (sm.number ILIKE $${p.length} OR sm.reference ILIKE $${p.length})`; }
    q += ' ORDER BY sm.date DESC, sm.id DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sm.*, fw.name AS from_warehouse_name, tw.name AS to_warehouse_name
       FROM stock_movements sm
       LEFT JOIN warehouses fw ON fw.id=sm.from_warehouse_id
       LEFT JOIN warehouses tw ON tw.id=sm.to_warehouse_id WHERE sm.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const mv = rows[0];
    const { rows: lines } = await pool.query(
      'SELECT l.*, p.name AS product_name FROM stock_movement_lines l LEFT JOIN products p ON p.id=l.product_id WHERE l.movement_id=$1 ORDER BY l.id', [mv.id]
    );
    mv.lines = lines;
    res.json(mv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { from_warehouse_id, to_warehouse_id, date, reference, notes, lines = [] } = req.body;
  if (from_warehouse_id === to_warehouse_id) return res.status(400).json({ error: 'From and To warehouses must be different' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await nextNumber(client);
    const { rows } = await client.query(
      'INSERT INTO stock_movements (number,date,from_warehouse_id,to_warehouse_id,reference,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [number, date, from_warehouse_id, to_warehouse_id, reference || null, notes || null]
    );
    await saveLines(client, rows[0].id, lines);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { from_warehouse_id, to_warehouse_id, date, reference, notes, lines = [] } = req.body;
  if (from_warehouse_id === to_warehouse_id) return res.status(400).json({ error: 'From and To warehouses must be different' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE stock_movements SET from_warehouse_id=$1,to_warehouse_id=$2,date=$3,reference=$4,notes=$5 WHERE id=$6 AND status='draft' RETURNING *",
      [from_warehouse_id, to_warehouse_id, date, reference || null, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    await saveLines(client, rows[0].id, lines);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/complete', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE stock_movements SET status='completed' WHERE id=$1 AND status='draft' RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    const mv = rows[0];
    const { rows: lines } = await client.query('SELECT * FROM stock_movement_lines WHERE movement_id=$1', [mv.id]);
    for (const l of lines) {
      await client.query(
        `UPDATE product_stock SET qty_on_hand=qty_on_hand - $1 WHERE product_id=$2 AND warehouse_id=$3`,
        [l.quantity, l.product_id, mv.from_warehouse_id]
      );
      await client.query(
        `INSERT INTO product_stock (product_id,warehouse_id,qty_on_hand) VALUES ($1,$2,$3)
         ON CONFLICT (product_id,warehouse_id) DO UPDATE SET qty_on_hand=product_stock.qty_on_hand + $3`,
        [l.product_id, mv.to_warehouse_id, l.quantity]
      );
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE stock_movements SET status='cancelled' WHERE id=$1 AND status='draft' RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM stock_movements WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft movements can be deleted' });
    await pool.query('DELETE FROM stock_movements WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
