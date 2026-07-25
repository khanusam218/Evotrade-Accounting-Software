const express = require('express');
const router = express.Router();
const pool = require('../db');

async function nextNumber(client) {
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='DS-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'DS-' + rows[0].lpad;
}

async function saveLines(client, id, lines) {
  await client.query('DELETE FROM disassembly_output_lines WHERE disassembly_id=$1', [id]);
  for (const l of lines) {
    if (!l.product_id || !l.quantity) continue;
    await client.query(
      'INSERT INTO disassembly_output_lines (disassembly_id,product_id,quantity,notes) VALUES ($1,$2,$3,$4)',
      [id, l.product_id, l.quantity, l.notes || null]
    );
  }
}

router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    let q = `SELECT d.*, p.name AS product_name, w.name AS warehouse_name
             FROM disassembly_orders d
             LEFT JOIN products p ON p.id=d.product_id
             LEFT JOIN warehouses w ON w.id=d.warehouse_id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status);        q += ` AND d.status=$${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (d.number ILIKE $${params.length} OR p.name ILIKE $${params.length})`; }
    q += ' ORDER BY d.date DESC, d.id DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, p.name AS product_name, w.name AS warehouse_name
       FROM disassembly_orders d
       LEFT JOIN products p ON p.id=d.product_id
       LEFT JOIN warehouses w ON w.id=d.warehouse_id WHERE d.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const order = rows[0];
    const { rows: lines } = await pool.query(
      'SELECT l.*, p.name AS product_name FROM disassembly_output_lines l LEFT JOIN products p ON p.id=l.product_id WHERE l.disassembly_id=$1 ORDER BY l.id',
      [order.id]
    );
    order.lines = lines;
    res.json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { product_id, warehouse_id, date, quantity = 1, notes, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await nextNumber(client);
    const { rows } = await client.query(
      'INSERT INTO disassembly_orders (number,date,product_id,warehouse_id,quantity,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [number, date, product_id, warehouse_id || null, quantity, notes || null]
    );
    await saveLines(client, rows[0].id, lines);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { product_id, warehouse_id, date, quantity, notes, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE disassembly_orders SET product_id=$1,warehouse_id=$2,date=$3,quantity=$4,notes=$5 WHERE id=$6 AND status='draft' RETURNING *",
      [product_id, warehouse_id || null, date, quantity, notes || null, req.params.id]
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
      "UPDATE disassembly_orders SET status='completed' WHERE id=$1 AND status='draft' RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    const order = rows[0];
    // Deduct the assembled product stock
    await client.query(
      `UPDATE product_stock SET qty_on_hand=qty_on_hand - $1 WHERE product_id=$2 AND warehouse_id=$3`,
      [order.quantity, order.product_id, order.warehouse_id]
    );
    // Add output parts to stock
    const { rows: lines } = await client.query('SELECT * FROM disassembly_output_lines WHERE disassembly_id=$1', [order.id]);
    for (const l of lines) {
      await client.query(
        `INSERT INTO product_stock (product_id,warehouse_id,qty_on_hand) VALUES ($1,$2,$3)
         ON CONFLICT (product_id,warehouse_id) DO UPDATE SET qty_on_hand=product_stock.qty_on_hand + $3`,
        [l.product_id, order.warehouse_id, l.quantity]
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
      "UPDATE disassembly_orders SET status='cancelled' WHERE id=$1 AND status='draft' RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM disassembly_orders WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft orders can be deleted' });
    await pool.query('DELETE FROM disassembly_orders WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
