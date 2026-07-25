const express = require('express');
const router  = express.Router();
const pool    = require('../db');

async function generateCNNumber(client) {
  const { rows } = await client.query(
    `UPDATE number_series SET next_number = next_number + 1
      WHERE name = 'Credit Notes'
      RETURNING prefix, next_number - 1 AS num, padding`
  );
  if (!rows.length) throw new Error('Number series "Credit Notes" not found');
  const { prefix, num, padding } = rows[0];
  return `${prefix}${String(num).padStart(padding, '0')}`;
}

const CN_SELECT = `
  SELECT cn.*,
         coa.code AS account_code, coa.name AS account_name
    FROM credit_notes cn
    JOIN chart_of_accounts coa ON coa.id = cn.account_id
`;

async function saveAllocations(client, creditNoteId, allocations) {
  await client.query('DELETE FROM credit_note_allocations WHERE credit_note_id=$1', [creditNoteId]);
  let total = 0;
  for (const al of allocations) {
    const amt = parseFloat(al.amount);
    if (!amt || amt <= 0) continue;
    await client.query(
      `INSERT INTO credit_note_allocations (credit_note_id, invoice_ref, description, amount, sales_invoice_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [creditNoteId, al.invoice_ref || null, al.description || null, amt, al.sales_invoice_id || null]
    );
    total += amt;
  }
  return total;
}

// ── GET /api/credit-notes/next-number ────────────────────────────────────────
router.get('/next-number', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number AS num, padding FROM number_series WHERE name = 'Credit Notes'`
    );
    if (!rows.length) return res.status(404).json({ error: 'Number series "Credit Notes" not found' });
    const { prefix, num, padding } = rows[0];
    res.json({ number: `${prefix}${String(num).padStart(padding, '0')}` });
  } catch (err) { next(err); }
});

// ── GET /api/credit-notes ─────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conditions = [], params = [];
    if (status)    { params.push(status);        conditions.push(`cn.status = $${params.length}`); }
    if (search)    { params.push(`%${search}%`); const n = params.length; conditions.push(`(cn.number ILIKE $${n} OR cn.contact_name ILIKE $${n} OR cn.reference ILIKE $${n})`); }
    if (date_from) { params.push(date_from);      conditions.push(`cn.date >= $${params.length}`); }
    if (date_to)   { params.push(date_to);        conditions.push(`cn.date <= $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`${CN_SELECT} ${where} ORDER BY cn.date DESC, cn.id DESC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/credit-notes/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [cn] } = await pool.query(`${CN_SELECT} WHERE cn.id=$1`, [req.params.id]);
    if (!cn) return res.status(404).json({ error: 'Credit note not found' });
    const { rows: allocations } = await pool.query(
      'SELECT * FROM credit_note_allocations WHERE credit_note_id=$1 ORDER BY id',
      [req.params.id]
    );
    res.json({ ...cn, allocations });
  } catch (err) { next(err); }
});

// ── POST /api/credit-notes ────────────────────────────────────────────────────
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
    if (allocTotal > amt) return res.status(400).json({ error: 'Allocations cannot exceed credit note amount' });

    const number = await generateCNNumber(client);
    const { rows: [cn] } = await client.query(
      `INSERT INTO credit_notes (number,date,contact_name,reference,account_id,amount,unadjusted_amount,comments,auto_settle,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') RETURNING *`,
      [number, date, contact_name.trim(), reference || null, account_id, amt, amt, comments || null, auto_settle]
    );
    const alloc = await saveAllocations(client, cn.id, allocations);
    await client.query('UPDATE credit_notes SET unadjusted_amount=$1 WHERE id=$2', [amt - alloc, cn.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${CN_SELECT} WHERE cn.id=$1`, [cn.id]);
    res.status(201).json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── PUT /api/credit-notes/:id ─────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ex] } = await client.query('SELECT status FROM credit_notes WHERE id=$1', [req.params.id]);
    if (!ex) return res.status(404).json({ error: 'Not found' });
    if (ex.status !== 'draft') return res.status(400).json({ error: 'Only draft credit notes can be edited' });

    const { date, contact_name, reference, account_id, amount, comments, auto_settle = false, allocations = [] } = req.body;
    if (!date)                 return res.status(400).json({ error: 'date is required' });
    if (!contact_name?.trim()) return res.status(400).json({ error: 'contact_name is required' });
    if (!account_id)           return res.status(400).json({ error: 'account_id is required' });
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)      return res.status(400).json({ error: 'amount must be greater than 0' });

    const allocTotal = allocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    if (allocTotal > amt) return res.status(400).json({ error: 'Allocations cannot exceed credit note amount' });

    await client.query(
      `UPDATE credit_notes SET date=$1,contact_name=$2,reference=$3,account_id=$4,amount=$5,
         comments=$6,auto_settle=$7 WHERE id=$8`,
      [date, contact_name.trim(), reference || null, account_id, amt, comments || null, auto_settle, req.params.id]
    );
    const alloc = await saveAllocations(client, req.params.id, allocations);
    await client.query('UPDATE credit_notes SET unadjusted_amount=$1 WHERE id=$2', [amt - alloc, req.params.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${CN_SELECT} WHERE cn.id=$1`, [req.params.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/credit-notes/:id/approve ───────────────────────────────────────
router.post('/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [cn] } = await client.query(`${CN_SELECT} WHERE cn.id=$1 FOR UPDATE`, [req.params.id]);
    if (!cn) return res.status(404).json({ error: 'Not found' });
    if (cn.status !== 'draft') return res.status(400).json({ error: 'Only draft credit notes can be approved' });

    const amt = parseFloat(cn.amount);

    // Debit selected account
    const { rows: [debitCoa] } = await client.query(
      'SELECT id, normal_balance FROM chart_of_accounts WHERE id=$1', [cn.account_id]
    );
    const debitChange = debitCoa.normal_balance === 'debit' ? amt : -amt;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [debitChange, debitCoa.id]);

    // Credit Accounts Receivable
    const { rows: [arCoa] } = await client.query(
      `SELECT id, normal_balance FROM chart_of_accounts WHERE system_name='accounts_receivable'`
    );
    if (!arCoa) throw new Error('Accounts Receivable account not found');
    const arChange = arCoa.normal_balance === 'debit' ? -amt : amt;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [arChange, arCoa.id]);

    await client.query(`UPDATE credit_notes SET status='approved' WHERE id=$1`, [cn.id]);

    // Reduce balance on linked sales invoices
    const { rows: allocs } = await client.query(
      'SELECT * FROM credit_note_allocations WHERE credit_note_id=$1 AND sales_invoice_id IS NOT NULL',
      [cn.id]
    );
    for (const al of allocs) {
      const alAmt = parseFloat(al.amount);
      await client.query(
        `UPDATE sales_invoices
         SET paid_amount    = paid_amount + $1,
             balance_amount = GREATEST(0, balance_amount - $1),
             status         = CASE WHEN GREATEST(0, balance_amount - $1) = 0 THEN 'paid' ELSE 'partially_paid' END
         WHERE id = $2 AND status IN ('approved', 'partially_paid')`,
        [alAmt, al.sales_invoice_id]
      );
    }

    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${CN_SELECT} WHERE cn.id=$1`, [cn.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/credit-notes/:id/cancel ────────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [cn] } = await client.query(`${CN_SELECT} WHERE cn.id=$1 FOR UPDATE`, [req.params.id]);
    if (!cn) return res.status(404).json({ error: 'Not found' });
    if (cn.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    if (cn.status === 'approved') {
      const amt = parseFloat(cn.amount);

      const { rows: [debitCoa] } = await client.query(
        'SELECT id, normal_balance FROM chart_of_accounts WHERE id=$1', [cn.account_id]
      );
      const debitChange = debitCoa.normal_balance === 'debit' ? amt : -amt;
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance-$1 WHERE id=$2', [debitChange, debitCoa.id]);

      const { rows: [arCoa] } = await client.query(
        `SELECT id, normal_balance FROM chart_of_accounts WHERE system_name='accounts_receivable'`
      );
      const arChange = arCoa.normal_balance === 'debit' ? -amt : amt;
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance-$1 WHERE id=$2', [arChange, arCoa.id]);

      // Restore balance on linked sales invoices
      const { rows: allocs } = await client.query(
        'SELECT * FROM credit_note_allocations WHERE credit_note_id=$1 AND sales_invoice_id IS NOT NULL',
        [cn.id]
      );
      for (const al of allocs) {
        const alAmt = parseFloat(al.amount);
        await client.query(
          `UPDATE sales_invoices
           SET paid_amount    = GREATEST(0, paid_amount - $1),
               balance_amount = net_amount - GREATEST(0, paid_amount - $1),
               status         = CASE WHEN GREATEST(0, paid_amount - $1) = 0 THEN 'approved' ELSE 'partially_paid' END
           WHERE id = $2 AND status IN ('paid', 'partially_paid')`,
          [alAmt, al.sales_invoice_id]
        );
      }
    }

    await client.query(`UPDATE credit_notes SET status='cancelled' WHERE id=$1`, [cn.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${CN_SELECT} WHERE cn.id=$1`, [cn.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── DELETE /api/credit-notes/:id ──────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [cn] } = await pool.query('SELECT status FROM credit_notes WHERE id=$1', [req.params.id]);
    if (!cn) return res.status(404).json({ error: 'Not found' });
    if (cn.status !== 'draft') return res.status(400).json({ error: 'Only draft credit notes can be deleted' });
    await pool.query('DELETE FROM credit_notes WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
