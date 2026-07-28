const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { round2, getOrCreateSeries } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function generateExpenseNumber(client) {
  await getOrCreateSeries(client, 'Expenses', 'E-', 6);
  const { rows } = await client.query(
    `UPDATE number_series
        SET next_number = next_number + 1
      WHERE name = 'Expenses'
      RETURNING prefix, next_number - 1 AS num, padding`
  );
  if (!rows.length) throw new Error('Number series "Expenses" not found');
  const { prefix, num, padding } = rows[0];
  return `${prefix}${String(num).padStart(padding, '0')}`;
}

const EXPENSE_SELECT = `
  SELECT e.*,
         v.print_name  AS vendor_name,
         v.code        AS vendor_code,
         ba_coa.name   AS bank_account_name,
         ba_coa.code   AS bank_account_code,
         ba.bank_name
    FROM expenses e
    LEFT JOIN vendors            v      ON v.id = e.vendor_id
    JOIN  bank_accounts          ba     ON ba.id = e.bank_account_id
    JOIN  chart_of_accounts      ba_coa ON ba_coa.id = ba.coa_id
`;

// ── GET /api/expenses ─────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`e.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      conditions.push(
        `(e.number ILIKE $${n} OR e.reference ILIKE $${n} OR v.print_name ILIKE $${n} OR e.comments ILIKE $${n})`
      );
    }
    if (date_from) { params.push(date_from); conditions.push(`e.date >= $${params.length}`); }
    if (date_to)   { params.push(date_to);   conditions.push(`e.date <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `${EXPENSE_SELECT} ${where} ORDER BY e.date DESC, e.id DESC`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/expenses/next-number (peek without consuming) ───────────────────
router.get('/next-number', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number AS num, padding FROM number_series WHERE name='Expenses'`
    );
    if (!rows.length) return res.json({ number: 'E-000001' });
    const { prefix, num, padding } = rows[0];
    res.json({ number: `${prefix}${String(num).padStart(padding, '0')}` });
  } catch (err) { next(err); }
});

// ── GET /api/expenses/:id (with lines) ───────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [expense] } = await pool.query(
      `${EXPENSE_SELECT} WHERE e.id = $1`, [req.params.id]
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const { rows: lines } = await pool.query(
      `SELECT el.*, coa.code AS account_code, coa.name AS account_name
         FROM expense_lines el
         JOIN chart_of_accounts coa ON coa.id = el.account_id
        WHERE el.expense_id = $1 ORDER BY el.id`,
      [req.params.id]
    );
    res.json({ ...expense, lines });
  } catch (err) { next(err); }
});

// ── POST /api/expenses (create draft) ────────────────────────────────────────
router.post('/', async (req, res, next) => {
  const { date, reference, vendor_id, bank_account_id, comments, lines = [] } = req.body;
  if (!date)            return res.status(400).json({ error: 'date is required' });
  if (!bank_account_id) return res.status(400).json({ error: 'bank_account_id is required' });
  if (!lines.length)    return res.status(400).json({ error: 'At least one expense line is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number      = await generateExpenseNumber(client);
    const gross       = round2(lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0));

    const { rows: [expense] } = await client.query(
      `INSERT INTO expenses (number, date, reference, vendor_id, bank_account_id, comments, gross_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING *`,
      [number, date, reference || null, vendor_id || null, bank_account_id, comments || null, gross]
    );

    for (const line of lines) {
      if (!line.account_id) continue;
      await client.query(
        `INSERT INTO expense_lines (expense_id, account_id, description, amount) VALUES ($1,$2,$3,$4)`,
        [expense.id, line.account_id, line.description || null, round2(parseFloat(line.amount) || 0)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(expense);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── PUT /api/expenses/:id (update draft) ─────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [existing] } = await client.query(
      'SELECT status FROM expenses WHERE id = $1', [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Expense not found' });
    if (existing.status !== 'draft')
      return res.status(400).json({ error: 'Only draft expenses can be edited' });

    const { date, reference, vendor_id, bank_account_id, comments, lines = [] } = req.body;
    if (!date)            return res.status(400).json({ error: 'date is required' });
    if (!bank_account_id) return res.status(400).json({ error: 'bank_account_id is required' });

    const gross = round2(lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0));

    const { rows: [expense] } = await client.query(
      `UPDATE expenses SET date=$1,reference=$2,vendor_id=$3,bank_account_id=$4,comments=$5,gross_amount=$6
        WHERE id=$7 RETURNING *`,
      [date, reference || null, vendor_id || null, bank_account_id, comments || null, gross, req.params.id]
    );

    await client.query('DELETE FROM expense_lines WHERE expense_id=$1', [req.params.id]);
    for (const line of lines) {
      if (!line.account_id) continue;
      await client.query(
        `INSERT INTO expense_lines (expense_id, account_id, description, amount) VALUES ($1,$2,$3,$4)`,
        [req.params.id, line.account_id, line.description || null, round2(parseFloat(line.amount) || 0)]
      );
    }

    await client.query('COMMIT');
    res.json(expense);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/expenses/:id/approve ───────────────────────────────────────────
router.post('/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [expense] } = await client.query(
      'SELECT * FROM expenses WHERE id = $1 FOR UPDATE', [req.params.id]
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.status !== 'draft')
      return res.status(400).json({ error: 'Only draft expenses can be approved' });

    const { rows: lines } = await client.query(
      `SELECT el.amount, coa.normal_balance, el.account_id
         FROM expense_lines el
         JOIN chart_of_accounts coa ON coa.id = el.account_id
        WHERE el.expense_id = $1`,
      [expense.id]
    );
    if (!lines.length) return res.status(400).json({ error: 'No expense lines to post' });

    // Debit each expense account (increases balance for debit-normal accounts)
    const jeLines = [];
    for (const line of lines) {
      const change = line.normal_balance === 'debit' ? line.amount : -line.amount;
      await client.query(
        'UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2',
        [change, line.account_id]
      );
      jeLines.push(changeToLine({ id: line.account_id, normal_balance: line.normal_balance }, change, `Expense ${expense.number}`));
    }

    // Credit the bank / cash account (decreases balance for debit-normal asset)
    const { rows: [bankCoa] } = await client.query(
      `SELECT coa.id, coa.normal_balance
         FROM bank_accounts ba JOIN chart_of_accounts coa ON coa.id = ba.coa_id
        WHERE ba.id = $1`,
      [expense.bank_account_id]
    );
    const bankChange = bankCoa.normal_balance === 'debit'
      ? -parseFloat(expense.gross_amount)
      :  parseFloat(expense.gross_amount);
    await client.query(
      'UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2',
      [bankChange, bankCoa.id]
    );
    jeLines.push(changeToLine(bankCoa, bankChange, `Expense ${expense.number}`));

    await postJournalEntry(client, {
      date: expense.date, memo: `Expense ${expense.number}`, reference: expense.number,
      source_type: 'Expense', source_id: expense.id, lines: jeLines,
    });

    await client.query(`UPDATE expenses SET status='approved' WHERE id=$1`, [expense.id]);
    await client.query('COMMIT');

    const { rows: [updated] } = await pool.query(`${EXPENSE_SELECT} WHERE e.id = $1`, [expense.id]);
    res.json(updated);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/expenses/:id/cancel ────────────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [expense] } = await client.query(
      'SELECT * FROM expenses WHERE id = $1 FOR UPDATE', [req.params.id]
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    if (expense.status === 'approved') {
      const { rows: lines } = await client.query(
        `SELECT el.amount, coa.normal_balance, el.account_id
           FROM expense_lines el
           JOIN chart_of_accounts coa ON coa.id = el.account_id
          WHERE el.expense_id = $1`,
        [expense.id]
      );
      for (const line of lines) {
        const change = line.normal_balance === 'debit' ? line.amount : -line.amount;
        await client.query(
          'UPDATE chart_of_accounts SET current_balance = current_balance - $1 WHERE id = $2',
          [change, line.account_id]
        );
      }
      const { rows: [bankCoa] } = await client.query(
        `SELECT coa.id, coa.normal_balance
           FROM bank_accounts ba JOIN chart_of_accounts coa ON coa.id = ba.coa_id
          WHERE ba.id = $1`,
        [expense.bank_account_id]
      );
      const bankChange = bankCoa.normal_balance === 'debit'
        ? -parseFloat(expense.gross_amount)
        :  parseFloat(expense.gross_amount);
      await client.query(
        'UPDATE chart_of_accounts SET current_balance = current_balance - $1 WHERE id = $2',
        [bankChange, bankCoa.id]
      );
      await reverseJournalEntriesForSource(client, {
        source_type: 'Expense', source_id: expense.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Expense ${expense.number}`,
      });
    }

    await client.query(`UPDATE expenses SET status='cancelled' WHERE id=$1`, [expense.id]);
    await client.query('COMMIT');

    const { rows: [updated] } = await pool.query(`${EXPENSE_SELECT} WHERE e.id = $1`, [expense.id]);
    res.json(updated);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── DELETE /api/expenses/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [expense] } = await pool.query(
      'SELECT status FROM expenses WHERE id = $1', [req.params.id]
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.status !== 'draft')
      return res.status(400).json({ error: 'Only draft expenses can be deleted' });
    await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Expense deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
