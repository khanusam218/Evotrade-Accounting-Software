const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeries } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function nextNumber(client) {
  await getOrCreateSeries(client, 'Receive Payments', 'RM-', 6);
  const r = await client.query(
    `UPDATE number_series SET next_number = GREATEST(
       next_number,
       COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)) + 1
                 FROM receive_payments WHERE number ~ '^[A-Z]+-[0-9]+$'), 0)
     ) + 1
     WHERE name = 'Receive Payments'
     RETURNING prefix || LPAD((next_number - 1)::text, padding, '0') AS num`
  );
  return r.rows[0]?.num ?? 'RM-000001';
}

async function saveInstruments(client, paymentId, instruments) {
  await client.query('DELETE FROM rp_instruments WHERE payment_id = $1', [paymentId]);
  for (const inst of instruments) {
    await client.query(
      `INSERT INTO rp_instruments (payment_id, payment_mode, account_id, reference, bank_name, instrument_no, instrument_date, amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [paymentId, inst.payment_mode || 'cash', inst.account_id || null, inst.reference || null,
       inst.bank_name || null, inst.instrument_no || null, inst.instrument_date || null, inst.amount]
    );
  }
}

async function saveAdjustments(client, paymentId, adjustments) {
  await client.query('DELETE FROM rp_adjustments WHERE payment_id = $1', [paymentId]);
  for (const adj of adjustments) {
    await client.query(
      `INSERT INTO rp_adjustments (payment_id, account_id, description, amount)
       VALUES ($1,$2,$3,$4)`,
      [paymentId, adj.account_id, adj.description || null, adj.amount]
    );
  }
}

async function saveAllocations(client, paymentId, allocations) {
  await client.query('DELETE FROM rp_allocations WHERE payment_id = $1', [paymentId]);
  for (const alloc of allocations) {
    await client.query(
      `INSERT INTO rp_allocations (payment_id, invoice_id, amount)
       VALUES ($1,$2,$3)`,
      [paymentId, alloc.invoice_id, alloc.amount]
    );
  }
}

function calcTotal(instruments = []) {
  return instruments.reduce((s, i) => s + Number(i.amount || 0), 0);
}

function calcAllocated(allocations = [], adjustments = []) {
  const alloc = allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
  const adj   = adjustments.reduce((s, a) => s + Number(a.amount || 0), 0);
  return alloc + adj;
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to, customer_id } = req.query;
    const conds = [], vals = [];
    if (status)      { vals.push(status);        conds.push(`rp.status = $${vals.length}`); }
    if (search)      { vals.push(`%${search}%`); conds.push(`(rp.number ILIKE $${vals.length} OR c.print_name ILIKE $${vals.length} OR rp.reference ILIKE $${vals.length})`); }
    if (date_from)   { vals.push(date_from);     conds.push(`rp.date >= $${vals.length}`); }
    if (date_to)     { vals.push(date_to);       conds.push(`rp.date <= $${vals.length}`); }
    if (customer_id) { vals.push(customer_id);   conds.push(`rp.customer_id = $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT rp.*, c.print_name AS customer_name, ba.bank_name AS bank_account_name
       FROM receive_payments rp
       JOIN customers c ON c.id = rp.customer_id
       LEFT JOIN bank_accounts ba ON ba.id = rp.bank_account_id
       ${where} ORDER BY rp.date DESC, rp.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /next-number — preview next number without consuming it
router.get('/next-number', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix || LPAD(GREATEST(
         next_number,
         COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)) + 1
                   FROM receive_payments WHERE number ~ '^[A-Z]+-[0-9]+$'), 0)
       )::text, padding, '0') AS number FROM number_series WHERE name = 'Receive Payments'`
    );
    res.json(rows[0] || { number: 'RM-000001' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /open-invoices/:customer_id  — approved invoices with outstanding balance
router.get('/open-invoices/:customer_id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, number, date, due_date, net_amount, paid_amount, balance_amount
       FROM sales_invoices
       WHERE customer_id = $1 AND status IN ('approved','partially_paid')
       ORDER BY date ASC`, [req.params.customer_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rp.*, c.print_name AS customer_name, ba.bank_name AS bank_account_name
       FROM receive_payments rp
       JOIN customers c ON c.id = rp.customer_id
       LEFT JOIN bank_accounts ba ON ba.id = rp.bank_account_id
       WHERE rp.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: instruments } = await pool.query(
      'SELECT * FROM rp_instruments WHERE payment_id = $1 ORDER BY id', [req.params.id]
    );
    const { rows: adjustments } = await pool.query(
      `SELECT a.*, coa.name AS account_name, coa.code AS account_code
       FROM rp_adjustments a JOIN chart_of_accounts coa ON coa.id = a.account_id
       WHERE a.payment_id = $1 ORDER BY a.id`, [req.params.id]
    );
    const { rows: allocations } = await pool.query(
      `SELECT al.*, si.number AS invoice_number, si.net_amount, si.balance_amount
       FROM rp_allocations al JOIN sales_invoices si ON si.id = al.invoice_id
       WHERE al.payment_id = $1 ORDER BY al.id`, [req.params.id]
    );
    res.json({ ...rows[0], instruments, adjustments, allocations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /bulk
router.post('/bulk', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, comments, make_settlements, rows = [] } = req.body;
    const created = [];
    for (const row of rows) {
      if (!row.customer_id || !Number(row.amount)) continue;
      const amount = Number(row.amount);
      const number = await nextNumber(client);
      const { rows: pmtRows } = await client.query(
        `INSERT INTO receive_payments
           (number, date, customer_id, bank_account_id, reference, notes, auto_settle, total_amount, unadjusted_amount, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') RETURNING *`,
        [number, date, row.customer_id, null, row.reference || null, comments || null, false, amount, amount]
      );
      const pmt = pmtRows[0];
      await client.query(
        `INSERT INTO rp_instruments (payment_id, payment_mode, account_id, reference, bank_name, instrument_no, instrument_date, amount)
         VALUES ($1,'Cash',$2,$3,$4,$5,$6,$7)`,
        [pmt.id, row.account_id || null, row.reference || null, row.bank_name || null, row.instrument_no || null, row.instrument_date || null, amount]
      );
      if (make_settlements) {
        const { rows: invRows } = await client.query(
          `SELECT id, balance_amount FROM sales_invoices
           WHERE customer_id = $1 AND status IN ('approved','partially_paid') ORDER BY date ASC`,
          [row.customer_id]
        );
        let remaining = amount;
        for (const inv of invRows) {
          if (remaining <= 0) break;
          const allocAmt = Math.min(remaining, Number(inv.balance_amount));
          await client.query(
            `INSERT INTO rp_allocations (payment_id, invoice_id, amount) VALUES ($1,$2,$3)`,
            [pmt.id, inv.id, allocAmt]
          );
          remaining -= allocAmt;
        }
      }
      created.push(pmt);
    }
    await client.query('COMMIT');
    res.status(201).json(created);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// POST /
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, date, bank_account_id, reference, notes, auto_settle,
            instruments = [], adjustments = [], allocations = [] } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    const total = calcTotal(instruments);
    const allocated = calcAllocated(allocations, adjustments);
    const unadjusted = total - allocated;
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO receive_payments
         (number, date, customer_id, bank_account_id, reference, notes, auto_settle, total_amount, unadjusted_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') RETURNING *`,
      [number, date, customer_id, bank_account_id || null, reference || null, notes || null, auto_settle || false, total, unadjusted]
    );
    const payment = rows[0];
    await saveInstruments(client, payment.id, instruments);
    await saveAdjustments(client, payment.id, adjustments);
    await saveAllocations(client, payment.id, allocations);
    await client.query('COMMIT');
    res.status(201).json(payment);
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
    const { rows: existing } = await client.query('SELECT * FROM receive_payments WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (existing[0].status !== 'draft') return res.status(400).json({ error: 'Only draft payments can be edited' });
    const { customer_id, date, bank_account_id, reference, notes, auto_settle,
            instruments = [], adjustments = [], allocations = [] } = req.body;
    const total = calcTotal(instruments);
    const allocated = calcAllocated(allocations, adjustments);
    const unadjusted = total - allocated;
    const { rows } = await client.query(
      `UPDATE receive_payments SET customer_id=$1, date=$2, bank_account_id=$3, reference=$4,
         notes=$5, auto_settle=$6, total_amount=$7, unadjusted_amount=$8 WHERE id=$9 RETURNING *`,
      [customer_id, date, bank_account_id || null, reference || null, notes || null, auto_settle || false, total, unadjusted, req.params.id]
    );
    await saveInstruments(client, req.params.id, instruments);
    await saveAdjustments(client, req.params.id, adjustments);
    await saveAllocations(client, req.params.id, allocations);
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
    const { rows } = await client.query(
      `SELECT rp.*, ba.coa_id AS bank_coa_id FROM receive_payments rp
       LEFT JOIN bank_accounts ba ON ba.id = rp.bank_account_id WHERE rp.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const pmt = rows[0];
    if (pmt.status !== 'draft') return res.status(400).json({ error: 'Only draft payments can be approved' });
    const total = Number(pmt.total_amount);

    // Debit bank account (or Undeposited Funds), Credit A/R
    const { rows: arRows } = await client.query(
      `SELECT * FROM chart_of_accounts WHERE system_name = 'AccountsReceivable' LIMIT 1`
    );
    if (!arRows.length) return res.status(400).json({ error: 'Accounts Receivable account not configured' });
    const arCoa = arRows[0];

    let bankCoaId = pmt.bank_coa_id;
    if (!bankCoaId) {
      const { rows: ufRows } = await client.query(
        `SELECT id FROM chart_of_accounts WHERE system_name = 'UndepositedFunds' LIMIT 1`
      );
      if (ufRows.length) bankCoaId = ufRows[0].id;
    }

    let bankCoa = null;
    if (bankCoaId) {
      const { rows: bankRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE id = $1`, [bankCoaId]);
      if (bankRows.length) {
        bankCoa = bankRows[0];
        const bankChange = bankCoa.normal_balance === 'debit' ?  total : -total;
        await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [bankChange, bankCoaId]);
      }
    }

    const arChange = arCoa.normal_balance === 'debit' ? -total : total;
    await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [arChange, arCoa.id]);

    if (bankCoa) {
      const bankChange = bankCoa.normal_balance === 'debit' ? total : -total;
      await postJournalEntry(client, {
        date: pmt.date, memo: `Receive Payment ${pmt.number}`, reference: pmt.number,
        source_type: 'ReceivePayment', source_id: pmt.id,
        lines: [
          changeToLine(bankCoa, bankChange, `Receive Payment ${pmt.number}`),
          changeToLine(arCoa,   arChange,   `Receive Payment ${pmt.number}`),
        ],
      });
    }

    // Apply allocations — update invoice paid_amount and balance_amount
    const { rows: allocations } = await client.query(
      'SELECT * FROM rp_allocations WHERE payment_id = $1', [req.params.id]
    );
    for (const alloc of allocations) {
      await client.query(
        `UPDATE sales_invoices
         SET paid_amount = paid_amount + $1,
             balance_amount = balance_amount - $1,
             status = CASE
               WHEN (balance_amount - $1) <= 0 THEN 'paid'
               ELSE 'partially_paid'
             END
         WHERE id = $2`,
        [alloc.amount, alloc.invoice_id]
      );
    }

    const { rows: updated } = await client.query(
      `UPDATE receive_payments SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]
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
    const { rows } = await client.query(
      `SELECT rp.*, ba.coa_id AS bank_coa_id FROM receive_payments rp
       LEFT JOIN bank_accounts ba ON ba.id = rp.bank_account_id WHERE rp.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const pmt = rows[0];
    if (pmt.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    if (pmt.status === 'approved') {
      const total = Number(pmt.total_amount);
      const { rows: arRows } = await client.query(
        `SELECT * FROM chart_of_accounts WHERE system_name = 'AccountsReceivable' LIMIT 1`
      );
      if (arRows.length) {
        const arChange = arRows[0].normal_balance === 'debit' ? total : -total;
        await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [arChange, arRows[0].id]);
      }
      let bankCoaId = pmt.bank_coa_id;
      if (!bankCoaId) {
        const { rows: ufRows } = await client.query(
          `SELECT id FROM chart_of_accounts WHERE system_name = 'UndepositedFunds' LIMIT 1`
        );
        if (ufRows.length) bankCoaId = ufRows[0].id;
      }
      if (bankCoaId) {
        const { rows: bankRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE id = $1`, [bankCoaId]);
        if (bankRows.length) {
          const bankChange = bankRows[0].normal_balance === 'debit' ? -total : total;
          await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [bankChange, bankCoaId]);
        }
      }
      await reverseJournalEntriesForSource(client, {
        source_type: 'ReceivePayment', source_id: pmt.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Receive Payment ${pmt.number}`,
      });
      // Reverse invoice allocations
      const { rows: allocations } = await client.query(
        'SELECT * FROM rp_allocations WHERE payment_id = $1', [req.params.id]
      );
      for (const alloc of allocations) {
        await client.query(
          `UPDATE sales_invoices
           SET paid_amount = paid_amount - $1,
               balance_amount = balance_amount + $1,
               status = CASE WHEN (paid_amount - $1) <= 0 THEN 'approved' ELSE 'partially_paid' END
           WHERE id = $2`,
          [alloc.amount, alloc.invoice_id]
        );
      }
    }

    const { rows: updated } = await client.query(
      `UPDATE receive_payments SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]
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
    const { rows } = await pool.query('SELECT status FROM receive_payments WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft payments can be deleted' });
    await pool.query('DELETE FROM receive_payments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
