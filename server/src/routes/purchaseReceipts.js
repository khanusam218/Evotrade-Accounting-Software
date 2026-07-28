const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix } = require('../utils');

async function nextNumber(client) {
  await getOrCreateSeriesByPrefix(client, 'GRN-', 6);
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='GRN-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'GRN-' + rows[0].lpad;
}

async function saveLines(client, id, lines) {
  await client.query('DELETE FROM purchase_receipt_lines WHERE receipt_id=$1', [id]);
  for (const l of lines) {
    await client.query(
      'INSERT INTO purchase_receipt_lines (receipt_id,product_id,description,ordered_qty,received_qty,unit_cost) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, l.product_id || null, l.description || '', l.ordered_qty || 0, l.received_qty || 0, l.unit_cost || 0]
    );
  }
}

router.get('/', async (req, res) => {
  try {
    const { vendor_id, warehouse_id, status, search, date_from, date_to } = req.query;
    let q = `SELECT pr.*, v.print_name AS vendor_name, w.name AS warehouse_name
             FROM purchase_receipts pr
             LEFT JOIN vendors v ON v.id=pr.vendor_id
             LEFT JOIN warehouses w ON w.id=pr.warehouse_id WHERE 1=1`;
    const p = [];
    if (vendor_id)    { p.push(vendor_id);    q += ` AND pr.vendor_id=$${p.length}`; }
    if (warehouse_id) { p.push(warehouse_id); q += ` AND pr.warehouse_id=$${p.length}`; }
    if (status)       { p.push(status);       q += ` AND pr.status=$${p.length}`; }
    if (date_from)    { p.push(date_from);    q += ` AND pr.date>=$${p.length}`; }
    if (date_to)      { p.push(date_to);      q += ` AND pr.date<=$${p.length}`; }
    if (search)       { p.push(`%${search}%`); q += ` AND (pr.number ILIKE $${p.length} OR v.print_name ILIKE $${p.length})`; }
    q += ' ORDER BY pr.date DESC, pr.id DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, v.print_name AS vendor_name, w.name AS warehouse_name
       FROM purchase_receipts pr
       LEFT JOIN vendors v ON v.id=pr.vendor_id
       LEFT JOIN warehouses w ON w.id=pr.warehouse_id WHERE pr.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const rec = rows[0];
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name FROM purchase_receipt_lines l
       LEFT JOIN products p ON p.id=l.product_id WHERE l.receipt_id=$1 ORDER BY l.id`, [rec.id]
    );
    rec.lines = lines;
    res.json(rec);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { order_id, vendor_id, warehouse_id, date, reference, notes, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await nextNumber(client);
    const { rows } = await client.query(
      'INSERT INTO purchase_receipts (number,date,order_id,vendor_id,warehouse_id,reference,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [number, date, order_id || null, vendor_id, warehouse_id, reference || null, notes || null]
    );
    await saveLines(client, rows[0].id, lines);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { order_id, vendor_id, warehouse_id, date, reference, notes, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE purchase_receipts SET order_id=$1,vendor_id=$2,warehouse_id=$3,date=$4,reference=$5,notes=$6 WHERE id=$7 AND status='draft' RETURNING *",
      [order_id || null, vendor_id, warehouse_id, date, reference || null, notes || null, req.params.id]
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
      "UPDATE purchase_receipts SET status='confirmed' WHERE id=$1 AND status='draft' RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    const rec = rows[0];
    const { rows: lines } = await client.query(
      'SELECT * FROM purchase_receipt_lines WHERE receipt_id=$1 AND product_id IS NOT NULL', [rec.id]
    );
    for (const l of lines) {
      await client.query(
        `INSERT INTO product_stock (product_id,warehouse_id,qty_on_hand) VALUES ($1,$2,$3)
         ON CONFLICT (product_id,warehouse_id) DO UPDATE SET qty_on_hand=product_stock.qty_on_hand + $3`,
        [l.product_id, rec.warehouse_id, l.received_qty]
      );
    }
    if (rec.order_id) {
      await client.query("UPDATE purchase_orders SET status='received' WHERE id=$1 AND status='confirmed'", [rec.order_id]);
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await pool.query('SELECT * FROM purchase_receipts WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const rec = rows[0];
    if (rec.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });
    if (rec.status === 'confirmed') {
      const { rows: lines } = await client.query(
        'SELECT * FROM purchase_receipt_lines WHERE receipt_id=$1 AND product_id IS NOT NULL', [rec.id]
      );
      for (const l of lines) {
        await client.query(
          'UPDATE product_stock SET qty_on_hand=qty_on_hand - $1 WHERE product_id=$2 AND warehouse_id=$3',
          [l.received_qty, l.product_id, rec.warehouse_id]
        );
      }
    }
    const { rows: updated } = await client.query(
      "UPDATE purchase_receipts SET status='cancelled' WHERE id=$1 RETURNING *", [rec.id]
    );
    await client.query('COMMIT');
    res.json(updated[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM purchase_receipts WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft receipts can be deleted' });
    await pool.query('DELETE FROM purchase_receipts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
