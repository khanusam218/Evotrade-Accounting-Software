const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries } = require('../utils');

async function generateJENumber(client) {
  await getOrCreateSeries(client, 'Journal Entries', 'JE-', 6);
  const { rows } = await client.query(
    `UPDATE number_series
        SET next_number = next_number + 1
      WHERE name = 'Journal Entries'
      RETURNING prefix, next_number - 1 AS num, padding`
  );
  if (!rows.length) throw new Error('Number series "Journal Entries" not found');
  const { prefix, num, padding } = rows[0];
  return `${prefix}${String(num).padStart(padding, '0')}`;
}

// ── GET /api/journal-entries ──────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, search, date_from, date_to, number, reference, memo,
            amount_from, amount_to, account_id, show_void } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status); conditions.push(`je.status = $${params.length}`);
    }
    if (!show_void || show_void === 'false') {
      conditions.push(`je.status != 'cancelled'`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(je.number ILIKE $${params.length} OR je.memo ILIKE $${params.length} OR je.reference ILIKE $${params.length})`);
    }
    if (number) {
      params.push(`%${number}%`); conditions.push(`je.number ILIKE $${params.length}`);
    }
    if (reference) {
      params.push(`%${reference}%`); conditions.push(`je.reference ILIKE $${params.length}`);
    }
    if (memo) {
      params.push(`%${memo}%`); conditions.push(`je.memo ILIKE $${params.length}`);
    }
    if (date_from) {
      params.push(date_from); conditions.push(`je.date >= $${params.length}`);
    }
    if (date_to) {
      params.push(date_to); conditions.push(`je.date <= $${params.length}`);
    }
    if (amount_from) {
      params.push(amount_from); conditions.push(`je.total_debit >= $${params.length}`);
    }
    if (amount_to) {
      params.push(amount_to); conditions.push(`je.total_debit <= $${params.length}`);
    }
    if (account_id) {
      params.push(account_id);
      conditions.push(`EXISTS (SELECT 1 FROM journal_entry_lines jel WHERE jel.journal_entry_id=je.id AND jel.account_id=$${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM journal_entries je ${where} ORDER BY je.date DESC, je.id DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/journal-entries/next-number (peek without consuming) ─────────────
router.get('/next-number', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number AS num, padding FROM number_series WHERE name='Journal Entries'`
    );
    if (!rows.length) return res.json({ number: 'JE-000001' });
    const { prefix, num, padding } = rows[0];
    res.json({ number: `${prefix}${String(num).padStart(padding, '0')}` });
  } catch (err) { next(err); }
});

// ── GET /api/journal-entries/:id (with lines) ─────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [je] } = await pool.query(
      'SELECT * FROM journal_entries WHERE id = $1', [req.params.id]
    );
    if (!je) return res.status(404).json({ error: 'Journal entry not found' });

    const { rows: lines } = await pool.query(
      `SELECT jel.*, coa.code AS account_code, coa.name AS account_name
         FROM journal_entry_lines jel
         JOIN chart_of_accounts coa ON coa.id = jel.account_id
        WHERE jel.journal_entry_id = $1
        ORDER BY jel.id`,
      [req.params.id]
    );
    res.json({ ...je, lines });
  } catch (err) { next(err); }
});

// ── POST /api/journal-entries (create draft) ──────────────────────────────────
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, memo, reference, lines = [] } = req.body;

    if (!date)        return res.status(400).json({ error: 'date is required' });
    if (!memo?.trim()) return res.status(400).json({ error: 'memo is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });

    const number      = await generateJENumber(client);
    const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);

    const { rows: [je] } = await client.query(
      `INSERT INTO journal_entries (number, date, memo, reference, status, total_debit, total_credit)
       VALUES ($1,$2,$3,$4,'draft',$5,$6) RETURNING *`,
      [number, date, memo.trim(), reference || null, totalDebit, totalCredit]
    );

    for (const line of lines) {
      if (!line.account_id) continue;
      await client.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
         VALUES ($1,$2,$3,$4,$5)`,
        [je.id, line.account_id, line.description || null,
         parseFloat(line.debit) || 0, parseFloat(line.credit) || 0]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(je);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── PUT /api/journal-entries/:id (update draft) ───────────────────────────────
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [existing] } = await client.query(
      'SELECT status FROM journal_entries WHERE id = $1', [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Journal entry not found' });
    if (existing.status !== 'draft')
      return res.status(400).json({ error: 'Only draft journal entries can be edited' });

    const { date, memo, reference, lines = [] } = req.body;
    if (!date)        return res.status(400).json({ error: 'date is required' });
    if (!memo?.trim()) return res.status(400).json({ error: 'memo is required' });

    const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);

    const { rows: [je] } = await client.query(
      `UPDATE journal_entries
          SET date=$1, memo=$2, reference=$3, total_debit=$4, total_credit=$5
        WHERE id=$6 RETURNING *`,
      [date, memo.trim(), reference || null, totalDebit, totalCredit, req.params.id]
    );

    await client.query('DELETE FROM journal_entry_lines WHERE journal_entry_id=$1', [req.params.id]);

    for (const line of lines) {
      if (!line.account_id) continue;
      await client.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, line.account_id, line.description || null,
         parseFloat(line.debit) || 0, parseFloat(line.credit) || 0]
      );
    }

    await client.query('COMMIT');
    res.json(je);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── POST /api/journal-entries/:id/post ───────────────────────────────────────
router.post('/:id/post', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [je] } = await client.query(
      'SELECT * FROM journal_entries WHERE id = $1 FOR UPDATE', [req.params.id]
    );
    if (!je) return res.status(404).json({ error: 'Journal entry not found' });
    if (je.status !== 'draft')
      return res.status(400).json({ error: 'Only draft entries can be posted' });

    const diff = Math.abs(parseFloat(je.total_debit) - parseFloat(je.total_credit));
    if (diff > 0.005) {
      return res.status(400).json({
        error: `Debits (${parseFloat(je.total_debit).toFixed(2)}) must equal Credits (${parseFloat(je.total_credit).toFixed(2)})`
      });
    }

    // Update account balances
    const { rows: lines } = await client.query(
      `SELECT jel.debit, jel.credit, coa.normal_balance, jel.account_id
         FROM journal_entry_lines jel
         JOIN chart_of_accounts coa ON coa.id = jel.account_id
        WHERE jel.journal_entry_id = $1`,
      [req.params.id]
    );

    for (const line of lines) {
      const change = line.normal_balance === 'debit'
        ? parseFloat(line.debit) - parseFloat(line.credit)
        : parseFloat(line.credit) - parseFloat(line.debit);
      await client.query(
        'UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2',
        [change, line.account_id]
      );
    }

    const { rows: [updated] } = await client.query(
      `UPDATE journal_entries SET status='posted' WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── POST /api/journal-entries/:id/cancel ─────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [je] } = await client.query(
      'SELECT * FROM journal_entries WHERE id = $1 FOR UPDATE', [req.params.id]
    );
    if (!je) return res.status(404).json({ error: 'Journal entry not found' });
    if (je.status === 'cancelled')
      return res.status(400).json({ error: 'Already cancelled' });

    if (je.status === 'posted') {
      const { rows: lines } = await client.query(
        `SELECT jel.debit, jel.credit, coa.normal_balance, jel.account_id
           FROM journal_entry_lines jel
           JOIN chart_of_accounts coa ON coa.id = jel.account_id
          WHERE jel.journal_entry_id = $1`,
        [req.params.id]
      );
      for (const line of lines) {
        const change = line.normal_balance === 'debit'
          ? parseFloat(line.debit) - parseFloat(line.credit)
          : parseFloat(line.credit) - parseFloat(line.debit);
        await client.query(
          'UPDATE chart_of_accounts SET current_balance = current_balance - $1 WHERE id = $2',
          [change, line.account_id]
        );
      }
    }

    const { rows: [updated] } = await client.query(
      `UPDATE journal_entries SET status='cancelled' WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── DELETE /api/journal-entries/:id ──────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [je] } = await pool.query(
      'SELECT status FROM journal_entries WHERE id = $1', [req.params.id]
    );
    if (!je) return res.status(404).json({ error: 'Journal entry not found' });
    if (je.status !== 'draft')
      return res.status(400).json({ error: 'Only draft journal entries can be deleted' });

    await pool.query('DELETE FROM journal_entries WHERE id = $1', [req.params.id]);
    res.json({ message: 'Journal entry deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
