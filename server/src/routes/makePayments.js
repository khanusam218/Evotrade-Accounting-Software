const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries, safeNextNumber } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function nextNumber(client) {
  const series = await getOrCreateSeries(client, 'Make Payments', 'MP-', 6);
  return safeNextNumber(client, series, 'name', 'Make Payments', 'make_payments', 'number');
}

async function saveInstruments(client, paymentId, instruments) {
  await client.query('DELETE FROM make_payment_instruments WHERE payment_id=$1', [paymentId]);
  let total = 0;
  for (const inst of instruments) {
    const amt = Number(inst.amount || 0);
    if (amt <= 0) continue;
    await client.query(
      `INSERT INTO make_payment_instruments (payment_id, mode, bank_ref, date, account_id, amount)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [paymentId, inst.mode || 'bank', inst.bank_ref || null, inst.date, inst.account_id || null, amt]
    );
    total += amt;
  }
  return total;
}

async function saveAllocations(client, paymentId, allocations) {
  await client.query('DELETE FROM mp_allocations WHERE payment_id = $1', [paymentId]);
  for (const alloc of allocations) {
    if (!alloc.invoice_id || !(Number(alloc.amount) > 0)) continue;
    await client.query(
      `INSERT INTO mp_allocations (payment_id, invoice_id, amount) VALUES ($1,$2,$3)`,
      [paymentId, alloc.invoice_id, Number(alloc.amount)]
    );
  }
}

// GET /next-number — must be before /:id
router.get('/next-number', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix || LPAD(GREATEST(
         next_number,
         COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)) + 1
                   FROM make_payments WHERE number ~ '^[A-Z]+-[0-9]+$'), 0)
       )::text, padding, '0') AS number FROM number_series WHERE name='Make Payments'`
    );
    res.json(rows[0] || { number: 'PY-000001' });
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

router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to, vendor_id } = req.query;
    const conds = [], vals = [];
    if (status)    { vals.push(status);        conds.push(`mp.status = $${vals.length}`); }
    if (vendor_id) { vals.push(vendor_id);     conds.push(`mp.vendor_id = $${vals.length}`); }
    if (search)    { vals.push(`%${search}%`); conds.push(`(mp.number ILIKE $${vals.length} OR v.print_name ILIKE $${vals.length} OR mp.reference ILIKE $${vals.length})`); }
    if (date_from) { vals.push(date_from);     conds.push(`mp.date >= $${vals.length}`); }
    if (date_to)   { vals.push(date_to);       conds.push(`mp.date <= $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT mp.*, v.print_name AS vendor_name FROM make_payments mp
       JOIN vendors v ON v.id = mp.vendor_id ${where} ORDER BY mp.date DESC, mp.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT mp.*, v.print_name AS vendor_name FROM make_payments mp
       JOIN vendors v ON v.id = mp.vendor_id WHERE mp.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: instruments } = await pool.query(
      `SELECT i.*, coa.name AS account_name FROM make_payment_instruments i
       LEFT JOIN chart_of_accounts coa ON coa.id = i.account_id
       WHERE i.payment_id=$1 ORDER BY i.id`, [req.params.id]
    );
    const { rows: allocations } = await pool.query(
      `SELECT al.*, pi.number AS invoice_number, pi.net_amount, pi.balance_amount
       FROM mp_allocations al JOIN purchase_invoices pi ON pi.id = al.invoice_id
       WHERE al.payment_id = $1 ORDER BY al.id`, [req.params.id]
    );
    res.json({ ...rows[0], instruments, allocations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { vendor_id, date, reference, notes, instruments = [], allocations = [] } = req.body;
    if (!vendor_id) return res.status(400).json({ error: 'vendor_id is required' });
    if (!instruments.length) return res.status(400).json({ error: 'At least one instrument is required' });
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO make_payments (number, date, vendor_id, reference, notes, total_amount, unadjusted_amount, status)
       VALUES ($1,$2,$3,$4,$5,0,0,'draft') RETURNING *`,
      [number, date, vendor_id, reference || null, notes || null]
    );
    const total = await saveInstruments(client, rows[0].id, instruments);
    await saveAllocations(client, rows[0].id, allocations);
    const allocTotal = allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const { rows: u } = await client.query('UPDATE make_payments SET total_amount=$1, unadjusted_amount=$2 WHERE id=$3 RETURNING *', [total, total - allocTotal, rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: ex } = await client.query('SELECT * FROM make_payments WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (ex[0].status !== 'draft') return res.status(400).json({ error: 'Only draft payments can be edited' });
    const { vendor_id, date, reference, notes, instruments = [], allocations = [] } = req.body;
    if (!instruments.length) return res.status(400).json({ error: 'At least one instrument is required' });
    const total = await saveInstruments(client, req.params.id, instruments);
    await saveAllocations(client, req.params.id, allocations);
    const allocTotal = allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const { rows } = await client.query(
      `UPDATE make_payments SET vendor_id=$1, date=$2, reference=$3, notes=$4, total_amount=$5, unadjusted_amount=$6 WHERE id=$7 RETURNING *`,
      [vendor_id, date, reference || null, notes || null, total, total - allocTotal, req.params.id]
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
    const { rows } = await client.query('SELECT * FROM make_payments WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft payments can be approved' });
    const mp = rows[0];
    const total = Number(mp.total_amount);

    // DR A/P, CR each instrument account
    const { rows: apRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsPayable' LIMIT 1`);
    if (!apRows.length) return res.status(400).json({ error: 'Accounts Payable account not found' });
    const apChange = apRows[0].normal_balance === 'credit' ? -total : total;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange, apRows[0].id]);

    const jeLines = [changeToLine(apRows[0], apChange, `Make Payment ${mp.number}`)];
    const { rows: instruments } = await client.query('SELECT * FROM make_payment_instruments WHERE payment_id=$1', [mp.id]);
    for (const inst of instruments) {
      if (!inst.account_id) continue;
      const { rows: coa } = await client.query('SELECT * FROM chart_of_accounts WHERE id=$1', [inst.account_id]);
      if (!coa.length) continue;
      const bankChange = coa[0].normal_balance === 'debit' ? -Number(inst.amount) : Number(inst.amount);
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [bankChange, inst.account_id]);
      jeLines.push(changeToLine(coa[0], bankChange, `Make Payment ${mp.number}`));
    }

    await postJournalEntry(client, {
      date: mp.date, memo: `Make Payment ${mp.number}`, reference: mp.number,
      source_type: 'MakePayment', source_id: mp.id, lines: jeLines,
    });

    // Apply allocations — reduce each specific invoice's balance
    const { rows: allocations } = await client.query(
      'SELECT * FROM mp_allocations WHERE payment_id = $1', [mp.id]
    );
    for (const alloc of allocations) {
      await client.query(
        `UPDATE purchase_invoices
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

    const { rows: u } = await client.query(`UPDATE make_payments SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]);
    await client.query('COMMIT');
    res.json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM make_payments WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const mp = rows[0];
    if (!['draft', 'approved'].includes(mp.status)) return res.status(400).json({ error: 'Cannot cancel in current status' });

    if (mp.status === 'approved') {
      const total = Number(mp.total_amount);
      const { rows: apRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsPayable' LIMIT 1`);
      if (apRows.length) {
        const apChange = apRows[0].normal_balance === 'credit' ? total : -total;
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange, apRows[0].id]);
      }
      const { rows: instruments } = await client.query('SELECT * FROM make_payment_instruments WHERE payment_id=$1', [mp.id]);
      for (const inst of instruments) {
        if (!inst.account_id) continue;
        const { rows: coa } = await client.query('SELECT normal_balance FROM chart_of_accounts WHERE id=$1', [inst.account_id]);
        if (!coa.length) continue;
        const bankChange = coa[0].normal_balance === 'debit' ? Number(inst.amount) : -Number(inst.amount);
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [bankChange, inst.account_id]);
      }
      await reverseJournalEntriesForSource(client, {
        source_type: 'MakePayment', source_id: mp.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Make Payment ${mp.number}`,
      });

      // Reverse invoice allocations
      const { rows: allocations } = await client.query(
        'SELECT * FROM mp_allocations WHERE payment_id = $1', [mp.id]
      );
      for (const alloc of allocations) {
        await client.query(
          `UPDATE purchase_invoices
           SET paid_amount = paid_amount - $1,
               balance_amount = balance_amount + $1,
               status = CASE WHEN (paid_amount - $1) <= 0 THEN 'approved' ELSE 'partially_paid' END
           WHERE id = $2`,
          [alloc.amount, alloc.invoice_id]
        );
      }
    }

    const { rows: u } = await client.query(`UPDATE make_payments SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
    await client.query('COMMIT');
    res.json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM make_payments WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft payments can be deleted' });
    await pool.query('DELETE FROM make_payments WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
