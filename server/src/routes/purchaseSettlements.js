const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function nextNumber(client) {
  await getOrCreateSeries(client, 'Purchase Settlements', 'PS-', 6);
  const r = await client.query(
    `UPDATE number_series SET next_number = next_number + 1
     WHERE name = 'Purchase Settlements'
     RETURNING prefix || LPAD((next_number - 1)::text, padding, '0') AS num`
  );
  return r.rows[0].num;
}

async function saveLines(client, settlementId, lines) {
  await client.query('DELETE FROM purchase_settlement_lines WHERE settlement_id=$1', [settlementId]);
  let total = 0;
  for (const l of lines) {
    const amt = Number(l.amount || 0);
    if (amt <= 0 || !l.invoice_id) continue;
    await client.query(
      `INSERT INTO purchase_settlement_lines (settlement_id, invoice_id, amount, write_off) VALUES ($1,$2,$3,$4)`,
      [settlementId, l.invoice_id, amt, l.write_off || false]
    );
    total += amt;
  }
  return total;
}

// GET /next-number — must be before /:id
router.get('/next-number', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix || LPAD(GREATEST(
         next_number,
         COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)) + 1
                   FROM purchase_settlements WHERE number ~ '^[A-Z]+-[0-9]+$'), 0)
       )::text, padding, '0') AS number FROM number_series WHERE name='Purchase Settlements'`
    );
    res.json(rows[0] || { number: 'VS-000001' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /open-invoices/:vendor_id — must be before /:id
router.get('/open-invoices/:vendor_id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, number, date, due_date, net_amount, paid_amount, balance_amount, status
       FROM purchase_invoices
       WHERE vendor_id=$1 AND status IN ('approved','partially_paid')
       ORDER BY due_date ASC NULLS LAST, id`,
      [req.params.vendor_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /open-credits/:vendor_id — payments and refunds available to allocate
router.get('/open-credits/:vendor_id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 'payment' AS type, id, number, date, NULL::date AS due_date,
              total_amount, (total_amount - COALESCE(unadjusted_amount,0)) AS adjusted_amount,
              COALESCE(unadjusted_amount,0) AS balance_amount
       FROM make_payments
       WHERE vendor_id=$1 AND status='approved' AND COALESCE(unadjusted_amount,0) > 0
       UNION ALL
       SELECT 'refund' AS type, id, number, date, NULL::date AS due_date,
              total_amount, (total_amount - COALESCE(unadjusted_amount,0)) AS adjusted_amount,
              COALESCE(unadjusted_amount,0) AS balance_amount
       FROM purchase_refunds
       WHERE vendor_id=$1 AND status='approved' AND COALESCE(unadjusted_amount,0) > 0
       ORDER BY date ASC`,
      [req.params.vendor_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to, vendor_id } = req.query;
    const conds = [], vals = [];
    if (status)    { vals.push(status);        conds.push(`ps.status = $${vals.length}`); }
    if (vendor_id) { vals.push(vendor_id);     conds.push(`ps.vendor_id = $${vals.length}`); }
    if (search)    { vals.push(`%${search}%`); conds.push(`(ps.number ILIKE $${vals.length} OR v.print_name ILIKE $${vals.length} OR ps.reference ILIKE $${vals.length})`); }
    if (date_from) { vals.push(date_from);     conds.push(`ps.date >= $${vals.length}`); }
    if (date_to)   { vals.push(date_to);       conds.push(`ps.date <= $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT ps.*, v.print_name AS vendor_name, coa.name AS account_name
       FROM purchase_settlements ps JOIN vendors v ON v.id = ps.vendor_id
       JOIN chart_of_accounts coa ON coa.id = ps.account_id
       ${where} ORDER BY ps.date DESC, ps.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ps.*, v.print_name AS vendor_name, coa.name AS account_name
       FROM purchase_settlements ps JOIN vendors v ON v.id = ps.vendor_id
       JOIN chart_of_accounts coa ON coa.id = ps.account_id WHERE ps.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await pool.query(
      `SELECT sl.*, pi.number AS invoice_number, pi.net_amount AS invoice_net, pi.balance_amount AS invoice_balance
       FROM purchase_settlement_lines sl JOIN purchase_invoices pi ON pi.id = sl.invoice_id
       WHERE sl.settlement_id=$1 ORDER BY sl.id`, [req.params.id]
    );
    res.json({ ...rows[0], lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { vendor_id, account_id, date, reference, notes, auto_settle, lines = [] } = req.body;
    if (!vendor_id)  return res.status(400).json({ error: 'vendor_id is required' });
    if (!account_id) return res.status(400).json({ error: 'account_id is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO purchase_settlements (number, date, vendor_id, account_id, reference, notes, auto_settle, total_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,'draft') RETURNING *`,
      [number, date, vendor_id, account_id, reference || null, notes || null, auto_settle || false]
    );
    const total = await saveLines(client, rows[0].id, lines);
    const { rows: u } = await client.query('UPDATE purchase_settlements SET total_amount=$1 WHERE id=$2 RETURNING *', [total, rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: ex } = await client.query('SELECT * FROM purchase_settlements WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (ex[0].status !== 'draft') return res.status(400).json({ error: 'Only draft settlements can be edited' });
    const { vendor_id, account_id, date, reference, notes, auto_settle, lines = [] } = req.body;
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const total = await saveLines(client, req.params.id, lines);
    const { rows } = await client.query(
      `UPDATE purchase_settlements SET vendor_id=$1, account_id=$2, date=$3, reference=$4, notes=$5, auto_settle=$6, total_amount=$7 WHERE id=$8 RETURNING *`,
      [vendor_id, account_id, date, reference || null, notes || null, auto_settle || false, total, req.params.id]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM purchase_settlements WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft settlements can be approved' });
    const ps = rows[0];
    const total = Number(ps.total_amount);

    const { rows: apRows }   = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsPayable' LIMIT 1`);
    if (!apRows.length) return res.status(400).json({ error: 'Accounts Payable account not found' });
    const { rows: acctRows } = await client.query('SELECT * FROM chart_of_accounts WHERE id=$1', [ps.account_id]);
    if (!acctRows.length) return res.status(400).json({ error: 'Settlement account not found' });

    // DR A/P, CR settlement account (bank)
    const apChange   = apRows[0].normal_balance   === 'credit' ? -total :  total;
    const acctChange = acctRows[0].normal_balance === 'debit'  ? -total :  total;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange,   apRows[0].id]);
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [acctChange, ps.account_id]);

    await postJournalEntry(client, {
      date: ps.date, memo: `Purchase Settlement ${ps.number}`, reference: ps.number,
      source_type: 'PurchaseSettlement', source_id: ps.id,
      lines: [
        changeToLine(apRows[0],   apChange,   `Purchase Settlement ${ps.number}`),
        changeToLine(acctRows[0], acctChange, `Purchase Settlement ${ps.number}`),
      ],
    });

    const { rows: lines } = await client.query('SELECT * FROM purchase_settlement_lines WHERE settlement_id=$1', [ps.id]);
    for (const line of lines) {
      const amt = Number(line.amount);
      await client.query(
        `UPDATE purchase_invoices
         SET balance_amount = GREATEST(0, balance_amount - $1),
             paid_amount    = paid_amount + $1,
             status = CASE WHEN GREATEST(0, balance_amount - $1) = 0 THEN 'paid' ELSE 'partially_paid' END
         WHERE id=$2 AND status IN ('approved','partially_paid')`,
        [amt, line.invoice_id]
      );
    }

    const { rows: u } = await client.query(`UPDATE purchase_settlements SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]);
    await client.query('COMMIT');
    res.json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM purchase_settlements WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const ps = rows[0];
    if (!['draft', 'approved'].includes(ps.status)) return res.status(400).json({ error: 'Cannot cancel in current status' });

    if (ps.status === 'approved') {
      const total = Number(ps.total_amount);
      const { rows: apRows }   = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsPayable' LIMIT 1`);
      const { rows: acctRows } = await client.query('SELECT * FROM chart_of_accounts WHERE id=$1', [ps.account_id]);
      if (apRows.length && acctRows.length) {
        const apChange   = apRows[0].normal_balance   === 'credit' ?  total : -total;
        const acctChange = acctRows[0].normal_balance === 'debit'  ?  total : -total;
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange,   apRows[0].id]);
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [acctChange, ps.account_id]);
      }
      await reverseJournalEntriesForSource(client, {
        source_type: 'PurchaseSettlement', source_id: ps.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Purchase Settlement ${ps.number}`,
      });
      const { rows: lines } = await client.query('SELECT * FROM purchase_settlement_lines WHERE settlement_id=$1', [ps.id]);
      for (const line of lines) {
        const amt = Number(line.amount);
        await client.query(
          `UPDATE purchase_invoices SET balance_amount=balance_amount+$1, paid_amount=GREATEST(0,paid_amount-$1),
           status=CASE WHEN paid_amount-$1>0 THEN 'partially_paid' ELSE 'approved' END WHERE id=$2`,
          [amt, line.invoice_id]
        );
      }
    }

    const { rows: u } = await client.query(`UPDATE purchase_settlements SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
    await client.query('COMMIT');
    res.json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM purchase_settlements WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft settlements can be deleted' });
    await pool.query('DELETE FROM purchase_settlements WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
