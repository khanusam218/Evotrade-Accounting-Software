const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries } = require('../utils');

async function nextNumber(client) {
  await getOrCreateSeries(client, 'Purchase Quotations', 'RFQ-', 6);
  const r = await client.query(
    `UPDATE number_series SET next_number = next_number + 1
     WHERE name = 'Purchase Quotations'
     RETURNING prefix || LPAD((next_number - 1)::text, padding, '0') AS num`
  );
  return r.rows[0].num;
}

async function saveLines(client, quotationId, lines) {
  await client.query('DELETE FROM purchase_quotation_lines WHERE quotation_id=$1', [quotationId]);
  for (const l of lines) {
    const qty = Number(l.quantity || 1), price = Number(l.unit_price || 0), disc = Number(l.discount_pct || 0);
    await client.query(
      `INSERT INTO purchase_quotation_lines (quotation_id, product_id, description, quantity, unit_price, discount_pct, amount, tax_id, tax_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [quotationId, l.product_id || null, l.description, qty, price, disc, qty * price * (1 - disc / 100), l.tax_id || null, Number(l.tax_amount || 0)]
    );
  }
}

function calcTotals(lines, discount = 0) {
  const gross = lines.reduce((s, l) => s + Number(l.quantity || 1) * Number(l.unit_price || 0) * (1 - Number(l.discount_pct || 0) / 100), 0);
  const tax   = lines.reduce((s, l) => s + Number(l.tax_amount || 0), 0);
  const disc  = Number(discount || 0);
  return { gross_amount: gross, tax_amount: tax, discount: disc, net_amount: gross - disc + tax };
}

router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conds = [], vals = [];
    if (status)    { vals.push(status);        conds.push(`pq.status = $${vals.length}`); }
    if (search)    { vals.push(`%${search}%`); conds.push(`(pq.number ILIKE $${vals.length} OR v.print_name ILIKE $${vals.length} OR pq.reference ILIKE $${vals.length})`); }
    if (date_from) { vals.push(date_from);     conds.push(`pq.date >= $${vals.length}`); }
    if (date_to)   { vals.push(date_to);       conds.push(`pq.date <= $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT pq.*, v.print_name AS vendor_name FROM purchase_quotations pq
       JOIN vendors v ON v.id = pq.vendor_id ${where} ORDER BY pq.date DESC, pq.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pq.*, v.print_name AS vendor_name FROM purchase_quotations pq
       JOIN vendors v ON v.id = pq.vendor_id WHERE pq.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name, t.name AS tax_name, t.rate AS tax_rate
       FROM purchase_quotation_lines l
       LEFT JOIN products p ON p.id = l.product_id LEFT JOIN taxes t ON t.id = l.tax_id
       WHERE l.quotation_id=$1 ORDER BY l.id`, [req.params.id]
    );
    res.json({ ...rows[0], lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { vendor_id, date, reference, notes, discount, lines = [] } = req.body;
    if (!vendor_id) return res.status(400).json({ error: 'vendor_id is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const t = calcTotals(lines, discount);
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO purchase_quotations (number, date, vendor_id, reference, notes, gross_amount, tax_amount, discount, net_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') RETURNING *`,
      [number, date, vendor_id, reference || null, notes || null, t.gross_amount, t.tax_amount, t.discount, t.net_amount]
    );
    await saveLines(client, rows[0].id, lines);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: ex } = await client.query('SELECT * FROM purchase_quotations WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (ex[0].status !== 'draft') return res.status(400).json({ error: 'Only draft quotations can be edited' });
    const { vendor_id, date, reference, notes, discount, lines = [] } = req.body;
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const t = calcTotals(lines, discount);
    const { rows } = await client.query(
      `UPDATE purchase_quotations SET vendor_id=$1, date=$2, reference=$3, notes=$4, gross_amount=$5, tax_amount=$6, discount=$7, net_amount=$8 WHERE id=$9 RETURNING *`,
      [vendor_id, date, reference || null, notes || null, t.gross_amount, t.tax_amount, t.discount, t.net_amount, req.params.id]
    );
    await saveLines(client, req.params.id, lines);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/send', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM purchase_quotations WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft quotations can be sent' });
    const { rows: u } = await pool.query(`UPDATE purchase_quotations SET status='sent' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(u[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM purchase_quotations WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (!['draft', 'sent'].includes(rows[0].status)) return res.status(400).json({ error: 'Cannot approve in current status' });
    const { rows: u } = await pool.query(`UPDATE purchase_quotations SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(u[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM purchase_quotations WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (!['draft', 'sent', 'approved'].includes(rows[0].status)) return res.status(400).json({ error: 'Cannot cancel in current status' });
    const { rows: u } = await pool.query(`UPDATE purchase_quotations SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(u[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM purchase_quotations WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft quotations can be deleted' });
    await pool.query('DELETE FROM purchase_quotations WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
