const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function nextNumber(client) {
  await getOrCreateSeries(client, 'Sales Settlements', 'CS-', 6);
  const r = await client.query(
    `UPDATE number_series SET next_number = GREATEST(
       next_number,
       COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)) + 1
                 FROM sales_settlements WHERE number ~ '^[A-Z]+-[0-9]+$'), 0)
     ) + 1
     WHERE name = 'Sales Settlements'
     RETURNING prefix || LPAD((next_number - 1)::text, padding, '0') AS num`
  );
  return r.rows[0]?.num ?? 'CS-000001';
}

async function saveLines(client, settlementId, lines) {
  await client.query('DELETE FROM sales_settlement_lines WHERE settlement_id=$1', [settlementId]);
  let total = 0;
  for (const l of lines) {
    const amt = Number(l.amount || 0);
    if (amt <= 0 || !l.invoice_id) continue;
    await client.query(
      `INSERT INTO sales_settlement_lines (settlement_id, invoice_id, amount, write_off) VALUES ($1,$2,$3,$4)`,
      [settlementId, l.invoice_id, amt, l.write_off || false]
    );
    total += amt;
  }
  return total;
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to, customer_id } = req.query;
    const conds = [], vals = [];
    if (status)      { vals.push(status);        conds.push(`ss.status = $${vals.length}`); }
    if (search)      { vals.push(`%${search}%`); conds.push(`(ss.number ILIKE $${vals.length} OR c.print_name ILIKE $${vals.length} OR ss.reference ILIKE $${vals.length})`); }
    if (date_from)   { vals.push(date_from);     conds.push(`ss.date >= $${vals.length}`); }
    if (date_to)     { vals.push(date_to);       conds.push(`ss.date <= $${vals.length}`); }
    if (customer_id) { vals.push(customer_id);   conds.push(`ss.customer_id = $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT ss.*, c.print_name AS customer_name, coa.name AS account_name
       FROM sales_settlements ss
       JOIN customers c ON c.id = ss.customer_id
       JOIN chart_of_accounts coa ON coa.id = ss.account_id
       ${where} ORDER BY ss.date DESC, ss.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /next-number
router.get('/next-number', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix || LPAD(GREATEST(
         next_number,
         COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)) + 1
                   FROM sales_settlements WHERE number ~ '^[A-Z]+-[0-9]+$'), 0)
       )::text, padding, '0') AS number FROM number_series WHERE name = 'Sales Settlements'`
    );
    res.json(rows[0] || { number: 'CS-000001' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /received-payments/:customer_id — approved payments with unadjusted balance
router.get('/received-payments/:customer_id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rp.id, rp.number, rp.date, rp.total_amount,
              (rp.total_amount - rp.unadjusted_amount) AS adjusted_amount,
              rp.unadjusted_amount AS balance_amount
       FROM receive_payments rp
       WHERE rp.customer_id = $1 AND rp.status = 'approved' AND rp.unadjusted_amount > 0
       ORDER BY rp.date ASC, rp.id`,
      [req.params.customer_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /open-invoices/:customer_id — must be before /:id
router.get('/open-invoices/:customer_id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, number, due_date, net_amount, paid_amount, balance_amount, status
       FROM sales_invoices
       WHERE customer_id=$1 AND status IN ('approved','partially_paid')
       ORDER BY due_date ASC NULLS LAST, id`,
      [req.params.customer_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ss.*, c.print_name AS customer_name, coa.name AS account_name
       FROM sales_settlements ss
       JOIN customers c ON c.id = ss.customer_id
       JOIN chart_of_accounts coa ON coa.id = ss.account_id
       WHERE ss.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await pool.query(
      `SELECT sl.*, si.number AS invoice_number, si.net_amount AS invoice_net, si.balance_amount AS invoice_balance
       FROM sales_settlement_lines sl
       JOIN sales_invoices si ON si.id = sl.invoice_id
       WHERE sl.settlement_id=$1 ORDER BY sl.id`, [req.params.id]
    );
    res.json({ ...rows[0], lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, account_id, date, reference, notes, auto_settle, lines = [] } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!account_id)  return res.status(400).json({ error: 'account_id is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO sales_settlements (number, date, customer_id, account_id, reference, notes, auto_settle, total_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,'draft') RETURNING *`,
      [number, date, customer_id, account_id, reference || null, notes || null, auto_settle || false]
    );
    const total = await saveLines(client, rows[0].id, lines);
    const { rows: updated } = await client.query('UPDATE sales_settlements SET total_amount=$1 WHERE id=$2 RETURNING *', [total, rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json(updated[0]);
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
    const { rows: existing } = await client.query('SELECT * FROM sales_settlements WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (existing[0].status !== 'draft') return res.status(400).json({ error: 'Only draft settlements can be edited' });
    const { customer_id, account_id, date, reference, notes, auto_settle, lines = [] } = req.body;
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const total = await saveLines(client, req.params.id, lines);
    const { rows } = await client.query(
      `UPDATE sales_settlements SET customer_id=$1, account_id=$2, date=$3, reference=$4, notes=$5, auto_settle=$6, total_amount=$7 WHERE id=$8 RETURNING *`,
      [customer_id, account_id, date, reference || null, notes || null, auto_settle || false, total, req.params.id]
    );
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
    const { rows } = await client.query('SELECT * FROM sales_settlements WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft settlements can be approved' });
    const ss = rows[0];
    const total = Number(ss.total_amount);

    const { rows: arRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsReceivable' LIMIT 1`);
    if (!arRows.length) return res.status(400).json({ error: 'Accounts Receivable account not found' });
    const { rows: acctRows } = await client.query('SELECT * FROM chart_of_accounts WHERE id=$1', [ss.account_id]);
    if (!acctRows.length) return res.status(400).json({ error: 'Settlement account not found' });

    // DR settlement account, CR A/R
    const acctChange = acctRows[0].normal_balance === 'debit' ? total : -total;
    const arChange   = arRows[0].normal_balance   === 'debit' ? -total : total;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [acctChange, ss.account_id]);
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [arChange,   arRows[0].id]);

    await postJournalEntry(client, {
      date: ss.date, memo: `Sales Settlement ${ss.number}`, reference: ss.number,
      source_type: 'SalesSettlement', source_id: ss.id,
      lines: [
        changeToLine(acctRows[0], acctChange, `Sales Settlement ${ss.number}`),
        changeToLine(arRows[0],   arChange,   `Sales Settlement ${ss.number}`),
      ],
    });

    // Reduce each invoice balance
    const { rows: lines } = await client.query('SELECT * FROM sales_settlement_lines WHERE settlement_id=$1', [ss.id]);
    for (const line of lines) {
      const amt = Number(line.amount);
      await client.query(
        `UPDATE sales_invoices
         SET balance_amount = GREATEST(0, balance_amount - $1),
             status = CASE WHEN GREATEST(0, balance_amount - $1) = 0 THEN 'paid' ELSE 'partially_paid' END
         WHERE id=$2 AND status IN ('approved','partially_paid')`,
        [amt, line.invoice_id]
      );
    }

    const { rows: updated } = await client.query(`UPDATE sales_settlements SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]);
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
    const { rows } = await client.query('SELECT * FROM sales_settlements WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const ss = rows[0];
    if (!['draft', 'approved'].includes(ss.status)) return res.status(400).json({ error: 'Cannot cancel in current status' });

    if (ss.status === 'approved') {
      const total = Number(ss.total_amount);
      const { rows: arRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsReceivable' LIMIT 1`);
      const { rows: acctRows } = await client.query('SELECT * FROM chart_of_accounts WHERE id=$1', [ss.account_id]);
      if (arRows.length && acctRows.length) {
        const acctChange = acctRows[0].normal_balance === 'debit' ? -total : total;
        const arChange   = arRows[0].normal_balance   === 'debit' ? total : -total;
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [acctChange, ss.account_id]);
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [arChange,   arRows[0].id]);
      }
      await reverseJournalEntriesForSource(client, {
        source_type: 'SalesSettlement', source_id: ss.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Sales Settlement ${ss.number}`,
      });
      const { rows: lines } = await client.query('SELECT * FROM sales_settlement_lines WHERE settlement_id=$1', [ss.id]);
      for (const line of lines) {
        const amt = Number(line.amount);
        await client.query(
          `UPDATE sales_invoices
           SET balance_amount = balance_amount + $1,
               status = CASE WHEN paid_amount > 0 THEN 'partially_paid' ELSE 'approved' END
           WHERE id=$2`,
          [amt, line.invoice_id]
        );
      }
    }

    const { rows: updated } = await client.query(`UPDATE sales_settlements SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
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
    const { rows } = await pool.query('SELECT status FROM sales_settlements WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft settlements can be deleted' });
    await pool.query('DELETE FROM sales_settlements WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
