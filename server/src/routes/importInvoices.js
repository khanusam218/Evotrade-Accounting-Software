const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix } = require('../utils');

async function nextNumber(client) {
  await getOrCreateSeriesByPrefix(client, 'II-', 6);
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='II-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'II-' + rows[0].lpad;
}

function calcTotals(lines, expenses, discount_pct, shipping_charges, round_off) {
  const gross         = lines.reduce((s, l) => s + (Number(l.quantity||0) * Number(l.unit_price||0) * (1 - Number(l.discount_pct||0)/100)), 0);
  const disc_pct      = Number(discount_pct || 0);
  const disc_amt      = gross * disc_pct / 100;
  const net_amount    = gross - disc_amt + Number(shipping_charges || 0) + Number(round_off || 0);
  const expense_total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const total_landed_cost = net_amount + expense_total;
  const linesWithAlloc = lines.map(l => {
    const amt = Number(l.quantity||0) * Number(l.unit_price||0) * (1 - Number(l.discount_pct||0)/100);
    const pct = gross > 0 ? (amt / gross) * 100 : 0;
    return { ...l, amount: amt, allocation_pct: pct };
  });
  return { net_amount, expense_total, total_landed_cost, linesWithAlloc };
}

async function saveLines(client, id, lines, expenses) {
  await client.query('DELETE FROM import_invoice_lines WHERE import_invoice_id=$1', [id]);
  await client.query('DELETE FROM import_invoice_expenses WHERE import_invoice_id=$1', [id]);
  for (const l of lines) {
    await client.query(
      'INSERT INTO import_invoice_lines (import_invoice_id,product_id,description,quantity,unit_price,discount_pct,amount,allocation_pct) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, l.product_id || null, l.description || '', l.quantity || 0, l.unit_price || 0, l.discount_pct || 0, l.amount || 0, l.allocation_pct || 0]
    );
  }
  for (const e of expenses) {
    await client.query(
      'INSERT INTO import_invoice_expenses (import_invoice_id,expense_type,description,amount,distribution_method,account_id,contact_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, e.expense_type || 'other', e.description || null, e.amount || 0, e.distribution_method || 'value', e.account_id || null, e.contact_id || null]
    );
  }
}

// GET /next-number
router.get('/next-number', async (req, res) => {
  try {
    await getOrCreateSeriesByPrefix(pool, 'II-', 6);
    const { rows } = await pool.query(
      "SELECT 'II-' || LPAD(GREATEST(next_number, COALESCE((SELECT MAX(CAST(SUBSTRING(number FROM 4) AS INTEGER))+1 FROM import_invoices WHERE number ~ '^II-[0-9]+$'),0))::text, padding::int, '0') AS number FROM number_series WHERE prefix='II-'"
    );
    res.json(rows[0] || { number: 'II-000001' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { vendor_id, status, search, reference } = req.query;
    let q = `SELECT ii.*, v.print_name AS vendor_name FROM import_invoices ii LEFT JOIN vendors v ON v.id=ii.vendor_id WHERE 1=1`;
    const p = [];
    if (vendor_id) { p.push(vendor_id);           q += ` AND ii.vendor_id=$${p.length}`; }
    if (status)    { p.push(status);               q += ` AND ii.status=$${p.length}`; }
    if (search)    { p.push(`%${search}%`);        q += ` AND (ii.number ILIKE $${p.length} OR v.print_name ILIKE $${p.length})`; }
    if (reference) { p.push(`%${reference}%`);     q += ` AND ii.reference ILIKE $${p.length}`; }
    q += ' ORDER BY ii.date DESC, ii.id DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT ii.*, v.print_name AS vendor_name FROM import_invoices ii LEFT JOIN vendors v ON v.id=ii.vendor_id WHERE ii.id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const inv = rows[0];
    const [{ rows: lines }, { rows: exps }] = await Promise.all([
      pool.query('SELECT l.*, p.name AS product_name FROM import_invoice_lines l LEFT JOIN products p ON p.id=l.product_id WHERE l.import_invoice_id=$1 ORDER BY l.id', [inv.id]),
      pool.query('SELECT e.*, c.name AS account_name, v.print_name AS contact_name FROM import_invoice_expenses e LEFT JOIN chart_of_accounts c ON c.id=e.account_id LEFT JOIN vendors v ON v.id=e.contact_id WHERE e.import_invoice_id=$1 ORDER BY e.id', [inv.id])
    ]);
    inv.lines = lines; inv.expenses = exps;
    res.json(inv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { vendor_id, order_id, date, due_date, reference, notes, subject, lines = [], expenses = [], discount_pct = 0, shipping_charges = 0, round_off = 0 } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await nextNumber(client);
    const { net_amount, expense_total, total_landed_cost, linesWithAlloc } = calcTotals(lines, expenses, discount_pct, shipping_charges, round_off);
    const { rows } = await client.query(
      'INSERT INTO import_invoices (number,date,vendor_id,order_id,due_date,reference,notes,subject,discount_pct,shipping_charges,round_off,net_amount,expense_total,total_landed_cost,balance_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *',
      [number, date, vendor_id, order_id || null, due_date || null, reference || null, notes || null, subject || null, Number(discount_pct)||0, Number(shipping_charges)||0, Number(round_off)||0, net_amount, expense_total, total_landed_cost, total_landed_cost]
    );
    await saveLines(client, rows[0].id, linesWithAlloc, expenses);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { vendor_id, order_id, date, due_date, reference, notes, subject, lines = [], expenses = [], discount_pct = 0, shipping_charges = 0, round_off = 0 } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { net_amount, expense_total, total_landed_cost, linesWithAlloc } = calcTotals(lines, expenses, discount_pct, shipping_charges, round_off);
    const { rows } = await client.query(
      "UPDATE import_invoices SET vendor_id=$1,order_id=$2,date=$3,due_date=$4,reference=$5,notes=$6,subject=$7,discount_pct=$8,shipping_charges=$9,round_off=$10,net_amount=$11,expense_total=$12,total_landed_cost=$13,balance_amount=$13 WHERE id=$14 AND status='draft' RETURNING *",
      [vendor_id, order_id || null, date, due_date || null, reference || null, notes || null, subject || null, Number(discount_pct)||0, Number(shipping_charges)||0, Number(round_off)||0, net_amount, expense_total, total_landed_cost, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    await saveLines(client, rows[0].id, linesWithAlloc, expenses);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE import_invoices SET status='approved' WHERE id=$1 AND status='draft' RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE import_invoices SET status='cancelled' WHERE id=$1 AND status IN ('draft','approved') RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or already cancelled' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM import_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be deleted' });
    await pool.query('DELETE FROM import_invoices WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
