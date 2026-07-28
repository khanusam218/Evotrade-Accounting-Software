const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix } = require('../utils');

async function nextNumber(client) {
  await getOrCreateSeriesByPrefix(client, 'SA-', 6);
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='SA-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'SA-' + rows[0].lpad;
}

async function saveLines(client, id, lines) {
  await client.query('DELETE FROM stock_adjustment_lines WHERE adjustment_id=$1', [id]);
  for (const l of lines) {
    await client.query(
      'INSERT INTO stock_adjustment_lines (adjustment_id,product_id,current_qty,new_qty,unit_cost,notes) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, l.product_id, l.current_qty || 0, l.new_qty || 0, l.unit_cost || 0, l.notes || null]
    );
  }
}

router.get('/', async (req, res) => {
  try {
    const { warehouse_id, status, search } = req.query;
    let q = `SELECT sa.*, w.name AS warehouse_name, at2.name AS adjustment_type_name
             FROM stock_adjustments sa
             LEFT JOIN warehouses w ON w.id=sa.warehouse_id
             LEFT JOIN adjustment_types at2 ON at2.id=sa.adjustment_type_id WHERE 1=1`;
    const p = [];
    if (warehouse_id) { p.push(warehouse_id); q += ` AND sa.warehouse_id=$${p.length}`; }
    if (status)       { p.push(status);       q += ` AND sa.status=$${p.length}`; }
    if (search)       { p.push(`%${search}%`); q += ` AND (sa.number ILIKE $${p.length} OR sa.reference ILIKE $${p.length})`; }
    q += ' ORDER BY sa.date DESC, sa.id DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sa.*, w.name AS warehouse_name, at2.name AS adjustment_type_name
       FROM stock_adjustments sa
       LEFT JOIN warehouses w ON w.id=sa.warehouse_id
       LEFT JOIN adjustment_types at2 ON at2.id=sa.adjustment_type_id
       WHERE sa.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const adj = rows[0];
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name FROM stock_adjustment_lines l
       LEFT JOIN products p ON p.id=l.product_id WHERE l.adjustment_id=$1 ORDER BY l.id`, [adj.id]
    );
    adj.lines = lines;
    res.json(adj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { adjustment_type_id, warehouse_id, date, reference, notes, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await nextNumber(client);
    const { rows } = await client.query(
      'INSERT INTO stock_adjustments (number,date,adjustment_type_id,warehouse_id,reference,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [number, date, adjustment_type_id || null, warehouse_id || null, reference || null, notes || null]
    );
    await saveLines(client, rows[0].id, lines);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { adjustment_type_id, warehouse_id, date, reference, notes, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE stock_adjustments SET adjustment_type_id=$1,warehouse_id=$2,date=$3,reference=$4,notes=$5
       WHERE id=$6 AND status='draft' RETURNING *`,
      [adjustment_type_id || null, warehouse_id || null, date, reference || null, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    await saveLines(client, rows[0].id, lines);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/confirm', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE stock_adjustments SET status='confirmed' WHERE id=$1 AND status='draft' RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });

    // The "Quantity" entered per line is a delta ("add 5" / "remove 3"), not
    // the resulting absolute count — the adjustment type's direction decides
    // whether that delta increases or decreases what's on hand. Previously
    // this always overwrote qty_on_hand to the raw entered number, which is
    // only correct by coincidence when direction happens to be 'add' and the
    // product had zero stock beforehand.
    let direction = 'add';
    if (rows[0].adjustment_type_id) {
      const { rows: at } = await client.query('SELECT direction FROM adjustment_types WHERE id=$1', [rows[0].adjustment_type_id]);
      if (at.length) direction = at[0].direction;
    }
    const { rows: lines } = await client.query(
      'SELECT * FROM stock_adjustment_lines WHERE adjustment_id=$1', [req.params.id]
    );
    for (const l of lines) {
      const delta = direction === 'subtract' ? -Number(l.new_qty) : Number(l.new_qty);
      await client.query(
        `INSERT INTO product_stock (product_id,warehouse_id,qty_on_hand)
         VALUES ($1,$2,$3)
         ON CONFLICT (product_id,warehouse_id) DO UPDATE SET qty_on_hand=product_stock.qty_on_hand + $3`,
        [l.product_id, rows[0].warehouse_id, delta]
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
      "UPDATE stock_adjustments SET status='cancelled' WHERE id=$1 AND status='draft' RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT status FROM stock_adjustments WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft adjustments can be deleted' });
    await pool.query('DELETE FROM stock_adjustments WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
