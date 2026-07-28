const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function generateDNNumber(client) {
  await getOrCreateSeries(client, 'Debit Notes', 'DN-', 6);
  const { rows } = await client.query(
    `UPDATE number_series SET next_number = next_number + 1
      WHERE name = 'Debit Notes'
      RETURNING prefix, next_number - 1 AS num, padding`
  );
  if (!rows.length) throw new Error('Number series "Debit Notes" not found');
  const { prefix, num, padding } = rows[0];
  return `${prefix}${String(num).padStart(padding, '0')}`;
}

const DN_SELECT = `
  SELECT dn.*,
         coa.code AS account_code, coa.name AS account_name
    FROM debit_notes dn
    JOIN chart_of_accounts coa ON coa.id = dn.account_id
`;

async function saveAllocations(client, debitNoteId, allocations) {
  await client.query('DELETE FROM debit_note_allocations WHERE debit_note_id=$1', [debitNoteId]);
  let total = 0;
  for (const al of allocations) {
    const amt = parseFloat(al.amount);
    if (!amt || amt <= 0) continue;
    await client.query(
      `INSERT INTO debit_note_allocations (debit_note_id, invoice_ref, description, amount, purchase_invoice_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [debitNoteId, al.invoice_ref || null, al.description || null, amt, al.purchase_invoice_id || null]
    );
    total += amt;
  }
  return total;
}

// ── GET /api/debit-notes/next-number ─────────────────────────────────────────
router.get('/next-number', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number AS num, padding FROM number_series WHERE name = 'Debit Notes'`
    );
    if (!rows.length) return res.status(404).json({ error: 'Number series "Debit Notes" not found' });
    const { prefix, num, padding } = rows[0];
    res.json({ number: `${prefix}${String(num).padStart(padding, '0')}` });
  } catch (err) { next(err); }
});

// ── GET /api/debit-notes ──────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conditions = [], params = [];
    if (status)    { params.push(status);        conditions.push(`dn.status = $${params.length}`); }
    if (search)    { params.push(`%${search}%`); const n = params.length; conditions.push(`(dn.number ILIKE $${n} OR dn.contact_name ILIKE $${n} OR dn.reference ILIKE $${n})`); }
    if (date_from) { params.push(date_from);      conditions.push(`dn.date >= $${params.length}`); }
    if (date_to)   { params.push(date_to);        conditions.push(`dn.date <= $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`${DN_SELECT} ${where} ORDER BY dn.date DESC, dn.id DESC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/debit-notes/:id ──────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [dn] } = await pool.query(`${DN_SELECT} WHERE dn.id=$1`, [req.params.id]);
    if (!dn) return res.status(404).json({ error: 'Debit note not found' });
    const { rows: allocations } = await pool.query(
      'SELECT * FROM debit_note_allocations WHERE debit_note_id=$1 ORDER BY id',
      [req.params.id]
    );
    res.json({ ...dn, allocations });
  } catch (err) { next(err); }
});

// ── POST /api/debit-notes ─────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, contact_name, reference, account_id, amount, comments, auto_settle = false, allocations = [] } = req.body;
    if (!date)                 return res.status(400).json({ error: 'date is required' });
    if (!contact_name?.trim()) return res.status(400).json({ error: 'contact_name is required' });
    if (!account_id)           return res.status(400).json({ error: 'account_id is required' });
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)      return res.status(400).json({ error: 'amount must be greater than 0' });

    const allocTotal = allocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    if (allocTotal > amt) return res.status(400).json({ error: 'Allocations cannot exceed debit note amount' });

    const number = await generateDNNumber(client);
    const { rows: [dn] } = await client.query(
      `INSERT INTO debit_notes (number,date,contact_name,reference,account_id,amount,unadjusted_amount,comments,auto_settle,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') RETURNING *`,
      [number, date, contact_name.trim(), reference || null, account_id, amt, amt, comments || null, auto_settle]
    );
    const alloc = await saveAllocations(client, dn.id, allocations);
    await client.query('UPDATE debit_notes SET unadjusted_amount=$1 WHERE id=$2', [amt - alloc, dn.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${DN_SELECT} WHERE dn.id=$1`, [dn.id]);
    res.status(201).json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── PUT /api/debit-notes/:id ──────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ex] } = await client.query('SELECT status FROM debit_notes WHERE id=$1', [req.params.id]);
    if (!ex) return res.status(404).json({ error: 'Not found' });
    if (ex.status !== 'draft') return res.status(400).json({ error: 'Only draft debit notes can be edited' });

    const { date, contact_name, reference, account_id, amount, comments, auto_settle = false, allocations = [] } = req.body;
    if (!date)                 return res.status(400).json({ error: 'date is required' });
    if (!contact_name?.trim()) return res.status(400).json({ error: 'contact_name is required' });
    if (!account_id)           return res.status(400).json({ error: 'account_id is required' });
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)      return res.status(400).json({ error: 'amount must be greater than 0' });

    const allocTotal = allocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    if (allocTotal > amt) return res.status(400).json({ error: 'Allocations cannot exceed debit note amount' });

    await client.query(
      `UPDATE debit_notes SET date=$1,contact_name=$2,reference=$3,account_id=$4,amount=$5,
         comments=$6,auto_settle=$7 WHERE id=$8`,
      [date, contact_name.trim(), reference || null, account_id, amt, comments || null, auto_settle, req.params.id]
    );
    const alloc = await saveAllocations(client, req.params.id, allocations);
    await client.query('UPDATE debit_notes SET unadjusted_amount=$1 WHERE id=$2', [amt - alloc, req.params.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${DN_SELECT} WHERE dn.id=$1`, [req.params.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/debit-notes/:id/approve ────────────────────────────────────────
router.post('/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [dn] } = await client.query(`${DN_SELECT} WHERE dn.id=$1 FOR UPDATE`, [req.params.id]);
    if (!dn) return res.status(404).json({ error: 'Not found' });
    if (dn.status !== 'draft') return res.status(400).json({ error: 'Only draft debit notes can be approved' });

    const amt = parseFloat(dn.amount);

    // Debit Accounts Payable (A/P decreases — debit reduces a credit-normal account)
    const { rows: [apCoa] } = await client.query(
      `SELECT id, normal_balance FROM chart_of_accounts WHERE system_name='AccountsPayable'`
    );
    if (!apCoa) throw new Error('Accounts Payable account not found');
    const apChange = apCoa.normal_balance === 'credit' ? -amt : amt;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange, apCoa.id]);

    // Credit selected account
    const { rows: [creditCoa] } = await client.query(
      'SELECT id, normal_balance FROM chart_of_accounts WHERE id=$1', [dn.account_id]
    );
    const creditChange = creditCoa.normal_balance === 'credit' ? amt : -amt;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [creditChange, creditCoa.id]);

    await postJournalEntry(client, {
      date: dn.date, memo: `Debit Note ${dn.number}`, reference: dn.number,
      source_type: 'DebitNote', source_id: dn.id,
      lines: [
        changeToLine(apCoa,     apChange,     `Debit Note ${dn.number}`),
        changeToLine(creditCoa, creditChange, `Debit Note ${dn.number}`),
      ],
    });

    // Reduce balance on linked purchase invoices
    const { rows: allocs } = await client.query(
      'SELECT * FROM debit_note_allocations WHERE debit_note_id=$1 AND purchase_invoice_id IS NOT NULL',
      [dn.id]
    );
    for (const al of allocs) {
      const alAmt = parseFloat(al.amount);
      await client.query(
        `UPDATE purchase_invoices
         SET paid_amount    = paid_amount + $1,
             balance_amount = GREATEST(0, balance_amount - $1),
             status         = CASE WHEN GREATEST(0, balance_amount - $1) = 0 THEN 'paid' ELSE 'partially_paid' END
         WHERE id = $2 AND status IN ('approved', 'partially_paid')`,
        [alAmt, al.purchase_invoice_id]
      );
    }

    await client.query(`UPDATE debit_notes SET status='approved' WHERE id=$1`, [dn.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${DN_SELECT} WHERE dn.id=$1`, [dn.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/debit-notes/:id/cancel ─────────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [dn] } = await client.query(`${DN_SELECT} WHERE dn.id=$1 FOR UPDATE`, [req.params.id]);
    if (!dn) return res.status(404).json({ error: 'Not found' });
    if (dn.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    if (dn.status === 'approved') {
      const amt = parseFloat(dn.amount);

      const { rows: [apCoa] } = await client.query(
        `SELECT id, normal_balance FROM chart_of_accounts WHERE system_name='AccountsPayable'`
      );
      const apChange = apCoa.normal_balance === 'credit' ? -amt : amt;
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance-$1 WHERE id=$2', [apChange, apCoa.id]);

      const { rows: [creditCoa] } = await client.query(
        'SELECT id, normal_balance FROM chart_of_accounts WHERE id=$1', [dn.account_id]
      );
      const creditChange = creditCoa.normal_balance === 'credit' ? amt : -amt;
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance-$1 WHERE id=$2', [creditChange, creditCoa.id]);

      await reverseJournalEntriesForSource(client, {
        source_type: 'DebitNote', source_id: dn.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Debit Note ${dn.number}`,
      });

      // Restore balance on linked purchase invoices
      const { rows: allocs } = await client.query(
        'SELECT * FROM debit_note_allocations WHERE debit_note_id=$1 AND purchase_invoice_id IS NOT NULL',
        [dn.id]
      );
      for (const al of allocs) {
        const alAmt = parseFloat(al.amount);
        await client.query(
          `UPDATE purchase_invoices
           SET paid_amount    = GREATEST(0, paid_amount - $1),
               balance_amount = net_amount - GREATEST(0, paid_amount - $1),
               status         = CASE WHEN GREATEST(0, paid_amount - $1) = 0 THEN 'approved' ELSE 'partially_paid' END
           WHERE id = $2 AND status IN ('paid', 'partially_paid')`,
          [alAmt, al.purchase_invoice_id]
        );
      }
    }

    await client.query(`UPDATE debit_notes SET status='cancelled' WHERE id=$1`, [dn.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${DN_SELECT} WHERE dn.id=$1`, [dn.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── DELETE /api/debit-notes/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [dn] } = await pool.query('SELECT status FROM debit_notes WHERE id=$1', [req.params.id]);
    if (!dn) return res.status(404).json({ error: 'Not found' });
    if (dn.status !== 'draft') return res.status(400).json({ error: 'Only draft debit notes can be deleted' });
    await pool.query('DELETE FROM debit_notes WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
