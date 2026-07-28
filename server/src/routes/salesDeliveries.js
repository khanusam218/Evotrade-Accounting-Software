const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix } = require('../utils');

async function nextNumber(client) {
  await getOrCreateSeriesByPrefix(client, 'SD-', 6);
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='SD-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'SD-' + rows[0].lpad;
}

async function saveLines(client, id, lines) {
  await client.query('DELETE FROM sales_delivery_lines WHERE delivery_id=$1', [id]);
  for (const l of lines) {
    await client.query(
      'INSERT INTO sales_delivery_lines (delivery_id,product_id,description,ordered_qty,delivered_qty) VALUES ($1,$2,$3,$4,$5)',
      [id, l.product_id || null, l.description || '', l.ordered_qty || 0, l.delivered_qty || 0]
    );
  }
}

// GET /next-number
router.get('/next-number', async (req, res) => {
  try {
    await getOrCreateSeriesByPrefix(pool, 'SD-', 6);
    const { rows } = await pool.query(
      `SELECT 'SD-' || LPAD(GREATEST(
         next_number,
         COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)) + 1
                   FROM sales_deliveries WHERE number ~ '^SD-[0-9]+$'), 0)
       )::text, padding::int, '0') AS number FROM number_series WHERE prefix='SD-'`
    );
    res.json(rows[0] || { number: 'SD-000001' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { customer_id, warehouse_id, status, search, date_from, date_to, order_id, invoice_id } = req.query;
    let q = `SELECT sd.*, c.print_name AS customer_name, w.name AS warehouse_name, so.number AS order_number
             FROM sales_deliveries sd
             LEFT JOIN customers c ON c.id=sd.customer_id
             LEFT JOIN warehouses w ON w.id=sd.warehouse_id
             LEFT JOIN sales_orders so ON so.id=sd.order_id WHERE 1=1`;
    const p = [];
    if (customer_id)  { p.push(customer_id);  q += ` AND sd.customer_id=$${p.length}`; }
    if (warehouse_id) { p.push(warehouse_id); q += ` AND sd.warehouse_id=$${p.length}`; }
    if (status)       { p.push(status);       q += ` AND sd.status=$${p.length}`; }
    if (date_from)    { p.push(date_from);    q += ` AND sd.date>=$${p.length}`; }
    if (date_to)      { p.push(date_to);      q += ` AND sd.date<=$${p.length}`; }
    if (order_id)     { p.push(order_id);     q += ` AND sd.order_id=$${p.length}`; }
    if (invoice_id)   { p.push(invoice_id);   q += ` AND sd.invoice_id=$${p.length}`; }
    if (search)       { p.push(`%${search}%`); q += ` AND (sd.number ILIKE $${p.length} OR c.print_name ILIKE $${p.length})`; }
    q += ' ORDER BY sd.date DESC, sd.id DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sd.*, c.print_name AS customer_name, w.name AS warehouse_name
       FROM sales_deliveries sd
       LEFT JOIN customers c ON c.id=sd.customer_id
       LEFT JOIN warehouses w ON w.id=sd.warehouse_id WHERE sd.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const del = rows[0];
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name FROM sales_delivery_lines l
       LEFT JOIN products p ON p.id=l.product_id WHERE l.delivery_id=$1 ORDER BY l.id`, [del.id]
    );
    del.lines = lines;
    res.json(del);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { order_id, customer_id, warehouse_id, date, reference, notes, subject, shipping_address, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await nextNumber(client);
    const { rows } = await client.query(
      'INSERT INTO sales_deliveries (number,date,order_id,customer_id,warehouse_id,reference,notes,subject,shipping_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [number, date, order_id || null, customer_id, warehouse_id, reference || null, notes || null, subject || null, shipping_address || null]
    );
    await saveLines(client, rows[0].id, lines);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { order_id, customer_id, warehouse_id, date, reference, notes, subject, shipping_address, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE sales_deliveries SET order_id=$1,customer_id=$2,warehouse_id=$3,date=$4,reference=$5,notes=$6,subject=$7,shipping_address=$8 WHERE id=$9 AND status='draft' RETURNING *",
      [order_id || null, customer_id, warehouse_id, date, reference || null, notes || null, subject || null, shipping_address || null, req.params.id]
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
      "UPDATE sales_deliveries SET status='confirmed' WHERE id=$1 AND status='draft' RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    const del = rows[0];
    const { rows: lines } = await client.query(
      'SELECT * FROM sales_delivery_lines WHERE delivery_id=$1 AND product_id IS NOT NULL', [del.id]
    );
    for (const l of lines) {
      await client.query(
        `INSERT INTO product_stock (product_id,warehouse_id,qty_on_hand) VALUES ($1,$2,$3)
         ON CONFLICT (product_id,warehouse_id) DO UPDATE SET qty_on_hand=product_stock.qty_on_hand - $3`,
        [l.product_id, del.warehouse_id, l.delivered_qty]
      );
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
    const { rows } = await pool.query('SELECT * FROM sales_deliveries WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const del = rows[0];
    if (del.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });
    if (del.status === 'confirmed') {
      const { rows: lines } = await client.query(
        'SELECT * FROM sales_delivery_lines WHERE delivery_id=$1 AND product_id IS NOT NULL', [del.id]
      );
      for (const l of lines) {
        await client.query(
          `UPDATE product_stock SET qty_on_hand=qty_on_hand + $1 WHERE product_id=$2 AND warehouse_id=$3`,
          [l.delivered_qty, l.product_id, del.warehouse_id]
        );
      }
    }
    const { rows: updated } = await client.query(
      "UPDATE sales_deliveries SET status='cancelled' WHERE id=$1 RETURNING *", [del.id]
    );
    await client.query('COMMIT');
    res.json(updated[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM sales_deliveries WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft deliveries can be deleted' });
    await pool.query('DELETE FROM sales_deliveries WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
