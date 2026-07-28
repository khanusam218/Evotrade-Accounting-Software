const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeries } = require('../utils');

async function nextNumber(client) {
  const { prefix, next_number, padding } = await getOrCreateSeries(client, 'Sales Orders', 'SO-', 6);
  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)),0) AS max_num
     FROM sales_orders WHERE number ~ '^SO-[0-9]+$'`
  );
  const useNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
  await client.query(`UPDATE number_series SET next_number=$1 WHERE name='Sales Orders'`, [useNum + 1]);
  return `${prefix}${String(useNum).padStart(Number(padding), '0')}`;
}

async function saveLines(client, orderId, lines) {
  await client.query('DELETE FROM sales_order_lines WHERE order_id = $1', [orderId]);
  for (const l of lines) {
    const qty = Number(l.quantity || 1);
    const price = Number(l.unit_price || 0);
    const disc = Number(l.discount_pct || 0);
    const amount = qty * price * (1 - disc / 100);
    const taxAmt = Number(l.tax_amount || 0);
    await client.query(
      `INSERT INTO sales_order_lines (order_id, product_id, description, quantity, unit_price, discount_pct, amount, invoiced_qty, tax_id, tax_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [orderId, l.product_id || null, l.description, qty, price, disc, amount, l.invoiced_qty || 0, l.tax_id || null, taxAmt]
    );
  }
}

function calcTotals(lines, discPct = 0, shippingCharges = 0) {
  const gross = lines.reduce((s, l) => {
    const qty = Number(l.quantity || 1);
    const price = Number(l.unit_price || 0);
    const disc = Number(l.discount_pct || 0);
    return s + qty * price * (1 - disc / 100);
  }, 0);
  const taxAmount = lines.reduce((s, l) => s + Number(l.tax_amount || 0), 0);
  const discAmount = gross * Number(discPct || 0) / 100;
  const shipping = Number(shippingCharges || 0);
  return {
    gross_amount: gross,
    tax_amount: taxAmount,
    discount_pct: Number(discPct || 0),
    discount: discAmount,
    shipping_charges: shipping,
    net_amount: gross - discAmount + taxAmount + shipping,
  };
}

// GET /next-number (preview)
router.get('/next-number', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number, padding FROM number_series WHERE name='Sales Orders'`
    );
    if (!rows.length) return res.json({ number: 'SO-000001' });
    const { prefix, next_number, padding } = rows[0];
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)),0) AS max_num
       FROM sales_orders WHERE number ~ '^SO-[0-9]+$'`
    );
    const preview = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
    res.json({ number: `${prefix}${String(preview).padStart(Number(padding), '0')}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /
router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to, customer_id } = req.query;
    const conds = [], vals = [];
    if (status)      { vals.push(status);        conds.push(`so.status=$${vals.length}`); }
    if (search)      { vals.push(`%${search}%`); conds.push(`(so.number ILIKE $${vals.length} OR c.print_name ILIKE $${vals.length} OR so.reference ILIKE $${vals.length})`); }
    if (date_from)   { vals.push(date_from);     conds.push(`so.date>=$${vals.length}`); }
    if (date_to)     { vals.push(date_to);       conds.push(`so.date<=$${vals.length}`); }
    if (customer_id) { vals.push(customer_id);   conds.push(`so.customer_id=$${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT so.*, c.print_name AS customer_name FROM sales_orders so
       JOIN customers c ON c.id=so.customer_id ${where} ORDER BY so.date DESC, so.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT so.*, c.print_name AS customer_name FROM sales_orders so
       JOIN customers c ON c.id=so.customer_id WHERE so.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name, t.name AS tax_name, t.rate AS tax_rate
       FROM sales_order_lines l
       LEFT JOIN products p ON p.id=l.product_id
       LEFT JOIN taxes t ON t.id=l.tax_id
       WHERE l.order_id=$1 ORDER BY l.id`, [req.params.id]
    );
    res.json({ ...rows[0], lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, date, delivery_date, quotation_id, reference, subject, notes, comments, discount_pct, shipping_charges, lines = [] } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!delivery_date) return res.status(400).json({ error: 'delivery_date is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const totals = calcTotals(lines, discount_pct, shipping_charges);
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO sales_orders
         (number, date, delivery_date, customer_id, quotation_id, reference, subject, notes, comments,
          gross_amount, tax_amount, discount_pct, discount, shipping_charges, net_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'draft') RETURNING *`,
      [number, date, delivery_date, customer_id, quotation_id || null, reference || null,
       subject || null, notes || null, comments || null,
       totals.gross_amount, totals.tax_amount, totals.discount_pct, totals.discount,
       totals.shipping_charges, totals.net_amount]
    );
    await saveLines(client, rows[0].id, lines);
    if (quotation_id) {
      await client.query(`UPDATE sales_quotations SET status='converted' WHERE id=$1`, [quotation_id]);
    }
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// PUT /:id
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT * FROM sales_orders WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (!['draft', 'confirmed'].includes(existing[0].status)) return res.status(400).json({ error: 'Cannot edit in current status' });
    const { customer_id, date, delivery_date, quotation_id, reference, subject, notes, comments, discount_pct, shipping_charges, lines = [] } = req.body;
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const totals = calcTotals(lines, discount_pct, shipping_charges);
    const { rows } = await client.query(
      `UPDATE sales_orders SET
         customer_id=$1, date=$2, delivery_date=$3, quotation_id=$4, reference=$5, subject=$6,
         notes=$7, comments=$8, gross_amount=$9, tax_amount=$10, discount_pct=$11,
         discount=$12, shipping_charges=$13, net_amount=$14
       WHERE id=$15 RETURNING *`,
      [customer_id, date, delivery_date, quotation_id || null, reference || null, subject || null,
       notes || null, comments || null,
       totals.gross_amount, totals.tax_amount, totals.discount_pct, totals.discount,
       totals.shipping_charges, totals.net_amount, req.params.id]
    );
    await saveLines(client, req.params.id, lines);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// POST /:id/confirm
router.post('/:id/confirm', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sales_orders WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft orders can be confirmed' });
    const { rows: updated } = await pool.query(`UPDATE sales_orders SET status='confirmed' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(updated[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/ship
router.post('/:id/ship', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sales_orders WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'confirmed') return res.status(400).json({ error: 'Only confirmed orders can be shipped' });
    const { rows: updated } = await pool.query(`UPDATE sales_orders SET status='shipped' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(updated[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/deliver
router.post('/:id/deliver', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sales_orders WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (!['confirmed', 'shipped'].includes(rows[0].status)) return res.status(400).json({ error: 'Only confirmed or shipped orders can be delivered' });
    const { rows: updated } = await pool.query(`UPDATE sales_orders SET status='delivered' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(updated[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/cancel
router.post('/:id/cancel', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sales_orders WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status === 'invoiced') return res.status(400).json({ error: 'Invoiced orders cannot be cancelled' });
    const { rows: updated } = await pool.query(`UPDATE sales_orders SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(updated[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM sales_orders WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft orders can be deleted' });
    await pool.query('DELETE FROM sales_orders WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
