const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeries } = require('../utils');

async function nextNumber(client) {
  const { prefix, next_number, padding } = await getOrCreateSeries(client, 'Sales Quotations', 'SQ-', 6);
  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)),0) AS max_num
     FROM sales_quotations WHERE number ~ '^SQ-[0-9]+$'`
  );
  const useNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
  await client.query(`UPDATE number_series SET next_number=$1 WHERE name='Sales Quotations'`, [useNum + 1]);
  return `${prefix}${String(useNum).padStart(Number(padding), '0')}`;
}

async function saveLines(client, quotationId, lines) {
  await client.query('DELETE FROM sales_quotation_lines WHERE quotation_id = $1', [quotationId]);
  for (const l of lines) {
    const qty = Number(l.quantity || 1);
    const price = Number(l.unit_price || 0);
    const disc = Number(l.discount_pct || 0);
    const amount = qty * price * (1 - disc / 100);
    const taxAmt = Number(l.tax_amount || 0);
    await client.query(
      `INSERT INTO sales_quotation_lines (quotation_id,product_id,description,quantity,unit_price,discount_pct,amount,tax_id,tax_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [quotationId, l.product_id || null, l.description, qty, price, disc, amount, l.tax_id || null, taxAmt]
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
      `SELECT prefix, next_number, padding FROM number_series WHERE name='Sales Quotations'`
    );
    if (!rows.length) return res.json({ number: 'SQ-000001' });
    const { prefix, next_number, padding } = rows[0];
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)),0) AS max_num
       FROM sales_quotations WHERE number ~ '^SQ-[0-9]+$'`
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
    if (status)      { vals.push(status);        conds.push(`sq.status=$${vals.length}`); }
    if (search)      { vals.push(`%${search}%`); conds.push(`(sq.number ILIKE $${vals.length} OR c.print_name ILIKE $${vals.length} OR sq.reference ILIKE $${vals.length})`); }
    if (date_from)   { vals.push(date_from);     conds.push(`sq.date>=$${vals.length}`); }
    if (date_to)     { vals.push(date_to);       conds.push(`sq.date<=$${vals.length}`); }
    if (customer_id) { vals.push(customer_id);   conds.push(`sq.customer_id=$${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT sq.*, c.print_name AS customer_name FROM sales_quotations sq
       JOIN customers c ON c.id=sq.customer_id ${where} ORDER BY sq.date DESC, sq.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sq.*, c.print_name AS customer_name FROM sales_quotations sq
       JOIN customers c ON c.id=sq.customer_id WHERE sq.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name, t.name AS tax_name, t.rate AS tax_rate
       FROM sales_quotation_lines l
       LEFT JOIN products p ON p.id=l.product_id
       LEFT JOIN taxes t ON t.id=l.tax_id
       WHERE l.quotation_id=$1 ORDER BY l.id`, [req.params.id]
    );
    res.json({ ...rows[0], lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, date, expiry_date, reference, subject, notes, discount_pct, shipping_charges, lines = [] } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const totals = calcTotals(lines, discount_pct, shipping_charges);
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO sales_quotations
         (number,date,customer_id,expiry_date,reference,subject,notes,
          gross_amount,tax_amount,discount_pct,discount,shipping_charges,net_amount,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft') RETURNING *`,
      [number, date, customer_id, expiry_date || null, reference || null, subject || null, notes || null,
       totals.gross_amount, totals.tax_amount, totals.discount_pct, totals.discount,
       totals.shipping_charges, totals.net_amount]
    );
    await saveLines(client, rows[0].id, lines);
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
    const { rows: existing } = await client.query('SELECT * FROM sales_quotations WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (!['draft', 'sent'].includes(existing[0].status)) return res.status(400).json({ error: 'Cannot edit in current status' });
    const { customer_id, date, expiry_date, reference, subject, notes, discount_pct, shipping_charges, lines = [] } = req.body;
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const totals = calcTotals(lines, discount_pct, shipping_charges);
    const { rows } = await client.query(
      `UPDATE sales_quotations SET
         customer_id=$1, date=$2, expiry_date=$3, reference=$4, subject=$5, notes=$6,
         gross_amount=$7, tax_amount=$8, discount_pct=$9, discount=$10,
         shipping_charges=$11, net_amount=$12
       WHERE id=$13 RETURNING *`,
      [customer_id, date, expiry_date || null, reference || null, subject || null, notes || null,
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

// POST /:id/send
router.post('/:id/send', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sales_quotations WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft quotations can be sent' });
    const { rows: upd } = await pool.query(`UPDATE sales_quotations SET status='sent' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(upd[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sales_quotations WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (!['draft', 'sent'].includes(rows[0].status)) return res.status(400).json({ error: 'Cannot approve in current status' });
    const { rows: upd } = await pool.query(`UPDATE sales_quotations SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(upd[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/cancel
router.post('/:id/cancel', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sales_quotations WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status === 'converted') return res.status(400).json({ error: 'Converted quotations cannot be cancelled' });
    const { rows: upd } = await pool.query(`UPDATE sales_quotations SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(upd[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM sales_quotations WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft quotations can be deleted' });
    await pool.query('DELETE FROM sales_quotations WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
