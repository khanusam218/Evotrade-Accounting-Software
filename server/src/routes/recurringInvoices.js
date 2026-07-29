const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries, safeNextNumber } = require('../utils');

async function nextRINumber(client) {
  const series = await getOrCreateSeries(client, 'Recurring Invoices', 'RI-', 6);
  return safeNextNumber(client, series, 'name', 'Recurring Invoices', 'recurring_invoices', 'number');
}

async function nextSINumber(client) {
  const series = await getOrCreateSeries(client, 'Sales Invoices', 'SI-', 6);
  return safeNextNumber(client, series, 'name', 'Sales Invoices', 'sales_invoices', 'number');
}

async function saveLines(client, riId, lines) {
  await client.query('DELETE FROM recurring_invoice_lines WHERE recurring_invoice_id=$1', [riId]);
  for (const l of lines) {
    const qty  = Number(l.quantity || 1);
    const price = Number(l.unit_price || 0);
    const disc  = Number(l.discount_pct || 0);
    const amount = qty * price * (1 - disc / 100);
    const taxAmt = Number(l.tax_amount || 0);
    await client.query(
      `INSERT INTO recurring_invoice_lines (recurring_invoice_id, product_id, description, quantity, unit_price, discount_pct, amount, tax_id, tax_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [riId, l.product_id || null, l.description, qty, price, disc, amount, l.tax_id || null, taxAmt]
    );
  }
}

function calcTotals(lines, discPct = 0, shippingCharges = 0, roundOff = 0) {
  const gross    = lines.reduce((s, l) => s + Number(l.quantity || 1) * Number(l.unit_price || 0) * (1 - Number(l.discount_pct || 0) / 100), 0);
  const taxAmount = lines.reduce((s, l) => s + Number(l.tax_amount || 0), 0);
  const discAmount = gross * Number(discPct || 0) / 100;
  const shipping   = Number(shippingCharges || 0);
  const roundOffAmt = Number(roundOff || 0);
  return {
    gross_amount: gross,
    tax_amount: taxAmount,
    discount_pct: Number(discPct || 0),
    discount: discAmount,
    shipping_charges: shipping,
    round_off: roundOffAmt,
    net_amount: gross - discAmount + taxAmount + shipping + roundOffAmt,
  };
}

function calcNextExecDate(currentDate, frequency, intervalNum) {
  const d = new Date(currentDate);
  const n = Number(intervalNum) || 1;
  switch (frequency) {
    case 'daily':     d.setDate(d.getDate() + n); break;
    case 'weekly':    d.setDate(d.getDate() + 7 * n); break;
    case 'monthly':   d.setMonth(d.getMonth() + n); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3 * n); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + n); break;
    default:          d.setMonth(d.getMonth() + n);
  }
  return d.toISOString().slice(0, 10);
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    const conds = [], vals = [];
    if (status) { vals.push(status);       conds.push(`ri.status = $${vals.length}`); }
    if (search) { vals.push(`%${search}%`); conds.push(`(ri.number ILIKE $${vals.length} OR c.print_name ILIKE $${vals.length} OR ri.reference ILIKE $${vals.length})`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT ri.*, c.print_name AS customer_name FROM recurring_invoices ri
       JOIN customers c ON c.id = ri.customer_id
       ${where} ORDER BY ri.next_exec_date ASC, ri.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ri.*, c.print_name AS customer_name FROM recurring_invoices ri
       JOIN customers c ON c.id = ri.customer_id WHERE ri.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name, t.name AS tax_name, t.rate AS tax_rate
       FROM recurring_invoice_lines l
       LEFT JOIN products p ON p.id = l.product_id
       LEFT JOIN taxes t ON t.id = l.tax_id
       WHERE l.recurring_invoice_id=$1 ORDER BY l.id`, [req.params.id]
    );
    res.json({ ...rows[0], lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, reference, notes, frequency, interval_num, start_date, end_date, due_days, discount_pct, shipping_charges, round_off, lines = [] } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!start_date)  return res.status(400).json({ error: 'start_date is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const totals = calcTotals(lines, discount_pct, shipping_charges, round_off);
    const number = await nextRINumber(client);
    const { rows } = await client.query(
      `INSERT INTO recurring_invoices (number, customer_id, reference, notes, frequency, interval_num, start_date, end_date, next_exec_date, due_days, gross_amount, tax_amount, discount_pct, discount, shipping_charges, round_off, net_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$7,$9,$10,$11,$12,$13,$14,$15,$16,'active') RETURNING *`,
      [number, customer_id, reference || null, notes || null, frequency || 'monthly', Number(interval_num) || 1,
       start_date, end_date || null, Number(due_days) || 30, totals.gross_amount, totals.tax_amount, totals.discount_pct,
       totals.discount, totals.shipping_charges, totals.round_off, totals.net_amount]
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
    const { rows: existing } = await client.query('SELECT * FROM recurring_invoices WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (existing[0].status === 'cancelled') return res.status(400).json({ error: 'Cannot edit cancelled recurring invoice' });
    const { customer_id, reference, notes, frequency, interval_num, start_date, end_date, due_days, discount_pct, shipping_charges, round_off, lines = [] } = req.body;
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const totals = calcTotals(lines, discount_pct, shipping_charges, round_off);
    const { rows } = await client.query(
      `UPDATE recurring_invoices SET customer_id=$1, reference=$2, notes=$3, frequency=$4, interval_num=$5,
         start_date=$6, end_date=$7, due_days=$8, gross_amount=$9, tax_amount=$10, discount_pct=$11, discount=$12,
         shipping_charges=$13, round_off=$14, net_amount=$15
       WHERE id=$16 RETURNING *`,
      [customer_id, reference || null, notes || null, frequency || 'monthly', Number(interval_num) || 1,
       start_date, end_date || null, Number(due_days) || 30, totals.gross_amount, totals.tax_amount, totals.discount_pct,
       totals.discount, totals.shipping_charges, totals.round_off, totals.net_amount, req.params.id]
    );
    await saveLines(client, req.params.id, lines);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// POST /:id/pause
router.post('/:id/pause', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM recurring_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'active') return res.status(400).json({ error: 'Only active profiles can be paused' });
    const { rows: updated } = await pool.query(`UPDATE recurring_invoices SET status='paused' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(updated[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/resume
router.post('/:id/resume', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM recurring_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'paused') return res.status(400).json({ error: 'Only paused profiles can be resumed' });
    const { rows: updated } = await pool.query(`UPDATE recurring_invoices SET status='active' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(updated[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/cancel
router.post('/:id/cancel', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM recurring_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });
    const { rows: updated } = await pool.query(`UPDATE recurring_invoices SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(updated[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/execute — manually trigger invoice generation
router.post('/:id/execute', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT ri.*, c.print_name AS customer_name FROM recurring_invoices ri
       JOIN customers c ON c.id = ri.customer_id WHERE ri.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const ri = rows[0];
    if (ri.status !== 'active') return res.status(400).json({ error: 'Only active profiles can be executed' });

    const { rows: riLines } = await client.query('SELECT * FROM recurring_invoice_lines WHERE recurring_invoice_id=$1 ORDER BY id', [ri.id]);
    const siNumber = await nextSINumber(client);
    const invDate  = new Date().toISOString().slice(0, 10);
    const dueDate  = new Date(Date.now() + Number(ri.due_days) * 86400000).toISOString().slice(0, 10);

    const { rows: [inv] } = await client.query(
      `INSERT INTO sales_invoices (number, date, due_date, customer_id, reference, notes, gross_amount, tax_amount, discount_pct, discount, shipping_charges, round_off, net_amount, paid_amount, balance_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$13,'draft') RETURNING *`,
      [siNumber, invDate, dueDate, ri.customer_id, ri.reference, ri.notes, ri.gross_amount, ri.tax_amount,
       ri.discount_pct, ri.discount, ri.shipping_charges, ri.round_off, ri.net_amount]
    );
    for (const l of riLines) {
      await client.query(
        `INSERT INTO sales_invoice_lines (invoice_id, product_id, description, quantity, unit_price, discount_pct, amount, tax_id, tax_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [inv.id, l.product_id, l.description, l.quantity, l.unit_price, l.discount_pct, l.amount, l.tax_id, l.tax_amount]
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const nextExec = calcNextExecDate(today, ri.frequency, ri.interval_num);
    const endReached = ri.end_date && nextExec > ri.end_date;
    const newStatus = endReached ? 'completed' : 'active';

    await client.query(
      `UPDATE recurring_invoices SET last_exec_date=$1, next_exec_date=$2, status=$3 WHERE id=$4`,
      [today, endReached ? ri.next_exec_date : nextExec, newStatus, ri.id]
    );

    await client.query('COMMIT');
    res.json({ invoice: inv, next_exec_date: nextExec, status: newStatus });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status, last_exec_date FROM recurring_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].last_exec_date) return res.status(400).json({ error: 'Cannot delete a profile that has generated invoices' });
    await pool.query('DELETE FROM recurring_invoices WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Background job: auto-execute due recurring invoices
async function runDueRecurringInvoices() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id FROM recurring_invoices WHERE status='active' AND next_exec_date <= CURRENT_DATE`
    );
    for (const r of rows) {
      try {
        await pool.query('SELECT 1'); // keep-alive
        const res = { json: () => {}, status: () => ({ json: () => {} }) };
        const req = { params: { id: r.id } };
        // Re-use execute logic
        const executeClient = await pool.connect();
        try {
          await executeClient.query('BEGIN');
          const { rows: riRows } = await executeClient.query(
            `SELECT ri.* FROM recurring_invoices ri WHERE ri.id=$1`, [r.id]
          );
          if (!riRows.length || riRows[0].status !== 'active') { await executeClient.query('ROLLBACK'); executeClient.release(); continue; }
          const ri = riRows[0];
          const { rows: riLines } = await executeClient.query('SELECT * FROM recurring_invoice_lines WHERE recurring_invoice_id=$1', [ri.id]);
          const siNumResult = await executeClient.query(
            `UPDATE number_series SET next_number = next_number + 1 WHERE name = 'Sales Invoices' RETURNING prefix || LPAD((next_number - 1)::text, padding, '0') AS num`
          );
          const siNumber = siNumResult.rows[0].num;
          const invDate  = new Date().toISOString().slice(0, 10);
          const dueDate  = new Date(Date.now() + Number(ri.due_days) * 86400000).toISOString().slice(0, 10);
          const { rows: [inv] } = await executeClient.query(
            `INSERT INTO sales_invoices (number, date, due_date, customer_id, reference, notes, gross_amount, tax_amount, discount_pct, discount, shipping_charges, round_off, net_amount, paid_amount, balance_amount, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$13,'draft') RETURNING id`,
            [siNumber, invDate, dueDate, ri.customer_id, ri.reference, ri.notes, ri.gross_amount, ri.tax_amount,
             ri.discount_pct, ri.discount, ri.shipping_charges, ri.round_off, ri.net_amount]
          );
          for (const l of riLines) {
            await executeClient.query(
              `INSERT INTO sales_invoice_lines (invoice_id, product_id, description, quantity, unit_price, discount_pct, amount, tax_id, tax_amount)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [inv.id, l.product_id, l.description, l.quantity, l.unit_price, l.discount_pct, l.amount, l.tax_id, l.tax_amount]
            );
          }
          const today = new Date().toISOString().slice(0, 10);
          const nextExec = calcNextExecDate(today, ri.frequency, ri.interval_num);
          const endReached = ri.end_date && nextExec > ri.end_date;
          await executeClient.query(
            `UPDATE recurring_invoices SET last_exec_date=$1, next_exec_date=$2, status=$3 WHERE id=$4`,
            [today, endReached ? ri.next_exec_date : nextExec, endReached ? 'completed' : 'active', ri.id]
          );
          await executeClient.query('COMMIT');
          console.log(`[recurring] Generated invoice ${siNumber} from RI ${ri.number}`);
        } catch (err) {
          await executeClient.query('ROLLBACK');
          console.error(`[recurring] Failed for RI ${r.id}:`, err.message);
        } finally { executeClient.release(); }
      } catch (err) {
        console.error(`[recurring] Error processing RI ${r.id}:`, err.message);
      }
    }
  } finally { client.release(); }
}

// Run every hour
setInterval(() => runDueRecurringInvoices().catch(err => console.error('[recurring] scheduler error:', err.message)), 3600000);
// Also run after a short delay on startup
setTimeout(() => runDueRecurringInvoices().catch(err => console.error('[recurring] startup check error:', err.message)), 5000);

module.exports = router;
