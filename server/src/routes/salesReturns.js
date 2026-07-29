const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries, safeNextNumber } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function nextNumber(client) {
  const series = await getOrCreateSeries(client, 'Sales Returns', 'SR-', 6);
  return safeNextNumber(client, series, 'name', 'Sales Returns', 'sales_returns', 'number');
}

async function saveLines(client, returnId, lines) {
  await client.query('DELETE FROM sales_return_lines WHERE return_id = $1', [returnId]);
  for (const l of lines) {
    const qty  = Number(l.quantity || 1);
    const price = Number(l.unit_price || 0);
    const disc  = Number(l.discount_pct || 0);
    const amount = qty * price * (1 - disc / 100);
    const taxAmt = Number(l.tax_amount || 0);
    await client.query(
      `INSERT INTO sales_return_lines (return_id, product_id, description, quantity, unit_price, discount_pct, amount, tax_id, tax_amount, disposition)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [returnId, l.product_id || null, l.description, qty, price, disc, amount, l.tax_id || null, taxAmt, l.disposition || 'restock']
    );
  }
}

function calcTotals(lines, discount = 0) {
  const gross    = lines.reduce((s, l) => s + Number(l.quantity || 1) * Number(l.unit_price || 0) * (1 - Number(l.discount_pct || 0) / 100), 0);
  const taxAmount = lines.reduce((s, l) => s + Number(l.tax_amount || 0), 0);
  const disc     = Number(discount || 0);
  return { gross_amount: gross, tax_amount: taxAmount, discount: disc, net_amount: gross - disc + taxAmount };
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conds = [], vals = [];
    if (status)    { vals.push(status);       conds.push(`sr.status = $${vals.length}`); }
    if (search)    { vals.push(`%${search}%`); conds.push(`(sr.number ILIKE $${vals.length} OR c.print_name ILIKE $${vals.length} OR sr.reference ILIKE $${vals.length})`); }
    if (date_from) { vals.push(date_from);    conds.push(`sr.date >= $${vals.length}`); }
    if (date_to)   { vals.push(date_to);      conds.push(`sr.date <= $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT sr.*, c.print_name AS customer_name, si.number AS invoice_number
       FROM sales_returns sr
       JOIN customers c ON c.id = sr.customer_id
       LEFT JOIN sales_invoices si ON si.id = sr.invoice_id
       ${where} ORDER BY sr.date DESC, sr.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sr.*, c.print_name AS customer_name, si.number AS invoice_number
       FROM sales_returns sr
       JOIN customers c ON c.id = sr.customer_id
       LEFT JOIN sales_invoices si ON si.id = sr.invoice_id
       WHERE sr.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name, t.name AS tax_name, t.rate AS tax_rate
       FROM sales_return_lines l
       LEFT JOIN products p ON p.id = l.product_id
       LEFT JOIN taxes t ON t.id = l.tax_id
       WHERE l.return_id = $1 ORDER BY l.id`, [req.params.id]
    );
    res.json({ ...rows[0], lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, invoice_id, date, reference, notes, discount, lines = [] } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const totals = calcTotals(lines, discount);
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO sales_returns (number, date, customer_id, invoice_id, reference, notes, gross_amount, tax_amount, discount, net_amount, unadjusted_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,'draft') RETURNING *`,
      [number, date, customer_id, invoice_id || null, reference || null, notes || null, totals.gross_amount, totals.tax_amount, totals.discount, totals.net_amount]
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
    const { rows: existing } = await client.query('SELECT * FROM sales_returns WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (existing[0].status !== 'draft') return res.status(400).json({ error: 'Only draft returns can be edited' });
    const { customer_id, invoice_id, date, reference, notes, discount, lines = [] } = req.body;
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const totals = calcTotals(lines, discount);
    const { rows } = await client.query(
      `UPDATE sales_returns SET customer_id=$1, invoice_id=$2, date=$3, reference=$4, notes=$5,
         gross_amount=$6, tax_amount=$7, discount=$8, net_amount=$9, unadjusted_amount=$9 WHERE id=$10 RETURNING *`,
      [customer_id, invoice_id || null, date, reference || null, notes || null, totals.gross_amount, totals.tax_amount, totals.discount, totals.net_amount, req.params.id]
    );
    await saveLines(client, req.params.id, lines);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// POST /:id/approve
router.post('/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM sales_returns WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft returns can be approved' });
    const ret = rows[0];
    const net = Number(ret.net_amount);

    // DR Revenue (reverse), CR A/R
    const { rows: arRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsReceivable' LIMIT 1`);
    if (!arRows.length) return res.status(400).json({ error: 'Accounts Receivable account not found' });
    const { rows: revRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='DefaultSales' LIMIT 1`);
    if (!revRows.length) return res.status(400).json({ error: 'No revenue account found' });

    const arChange  = arRows[0].normal_balance  === 'debit' ? -net : net;
    const revChange = revRows[0].normal_balance === 'credit' ? -net : net;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [arChange,  arRows[0].id]);
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [revChange, revRows[0].id]);

    await postJournalEntry(client, {
      date: ret.date, memo: `Sales Return ${ret.number}`, reference: ret.number,
      source_type: 'SalesReturn', source_id: ret.id,
      lines: [
        changeToLine(revRows[0], revChange, `Sales Return ${ret.number}`),
        changeToLine(arRows[0],  arChange,  `Sales Return ${ret.number}`),
      ],
    });

    // Reduce linked invoice balance
    if (ret.invoice_id) {
      await client.query(
        `UPDATE sales_invoices
         SET balance_amount = GREATEST(0, balance_amount - $1),
             status = CASE WHEN GREATEST(0, balance_amount - $1) = 0 THEN 'paid' ELSE 'partially_paid' END
         WHERE id = $2 AND status IN ('approved','partially_paid')`,
        [net, ret.invoice_id]
      );
    }

    const { rows: updated } = await client.query(
      `UPDATE sales_returns SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]
    );
    await client.query('COMMIT');
    res.json(updated[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// POST /:id/cancel
router.post('/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM sales_returns WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const ret = rows[0];
    if (!['draft', 'approved'].includes(ret.status)) return res.status(400).json({ error: 'Cannot cancel in current status' });

    if (ret.status === 'approved') {
      const net = Number(ret.net_amount);
      const { rows: arRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsReceivable' LIMIT 1`);
      const { rows: revRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='DefaultSales' LIMIT 1`);
      if (arRows.length && revRows.length) {
        const arChange  = arRows[0].normal_balance  === 'debit' ? net : -net;
        const revChange = revRows[0].normal_balance === 'credit' ? net : -net;
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [arChange,  arRows[0].id]);
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [revChange, revRows[0].id]);
      }
      await reverseJournalEntriesForSource(client, {
        source_type: 'SalesReturn', source_id: ret.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Sales Return ${ret.number}`,
      });
      if (ret.invoice_id) {
        await client.query(
          `UPDATE sales_invoices
           SET balance_amount = balance_amount + $1,
               status = CASE WHEN paid_amount > 0 THEN 'partially_paid' ELSE 'approved' END
           WHERE id = $2`,
          [net, ret.invoice_id]
        );
      }
    }

    const { rows: updated } = await client.query(
      `UPDATE sales_returns SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]
    );
    await client.query('COMMIT');
    res.json(updated[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM sales_returns WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft returns can be deleted' });
    await pool.query('DELETE FROM sales_returns WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
