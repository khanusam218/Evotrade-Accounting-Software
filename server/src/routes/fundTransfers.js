const express = require('express');
const router  = express.Router();
const pool    = require('../db');

async function generateFTNumber(client) {
  const { rows } = await client.query(
    `UPDATE number_series
        SET next_number = next_number + 1
      WHERE name = 'Fund Transfers'
      RETURNING prefix, next_number - 1 AS num, padding`
  );
  if (!rows.length) throw new Error('Number series "Fund Transfers" not found');
  const { prefix, num, padding } = rows[0];
  return `${prefix}${String(num).padStart(padding, '0')}`;
}

const FT_SELECT = `
  SELECT ft.*,
         from_coa.code AS from_account_code, from_coa.name AS from_account_name, from_ba.bank_name AS from_bank_name,
         to_coa.code   AS to_account_code,   to_coa.name   AS to_account_name,   to_ba.bank_name   AS to_bank_name
    FROM fund_transfers ft
    JOIN bank_accounts       from_ba  ON from_ba.id  = ft.from_bank_account_id
    JOIN chart_of_accounts   from_coa ON from_coa.id = from_ba.coa_id
    JOIN bank_accounts       to_ba    ON to_ba.id    = ft.to_bank_account_id
    JOIN chart_of_accounts   to_coa   ON to_coa.id   = to_ba.coa_id
`;

// ── GET /api/fund-transfers/next-number ──────────────────────────────────────
router.get('/next-number', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number, padding FROM number_series WHERE name = 'Fund Transfers'`
    );
    if (!rows.length) return res.status(404).json({ error: 'Number series not found' });
    const { prefix, next_number, padding } = rows[0];
    res.json({ number: `${prefix}${String(next_number).padStart(padding, '0')}` });
  } catch (err) { next(err); }
});

// ── GET /api/fund-transfers ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conditions = [];
    const params = [];

    if (status) { params.push(status); conditions.push(`ft.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      conditions.push(`(ft.number ILIKE $${n} OR ft.reference ILIKE $${n} OR from_coa.name ILIKE $${n} OR to_coa.name ILIKE $${n})`);
    }
    if (date_from) { params.push(date_from); conditions.push(`ft.date >= $${params.length}`); }
    if (date_to)   { params.push(date_to);   conditions.push(`ft.date <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`${FT_SELECT} ${where} ORDER BY ft.date DESC, ft.id DESC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/fund-transfers/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [ft] } = await pool.query(`${FT_SELECT} WHERE ft.id = $1`, [req.params.id]);
    if (!ft) return res.status(404).json({ error: 'Fund transfer not found' });
    res.json(ft);
  } catch (err) { next(err); }
});

// ── POST /api/fund-transfers (create draft) ───────────────────────────────────
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, reference, from_bank_account_id, to_bank_account_id, amount, comments } = req.body;

    if (!date)                 return res.status(400).json({ error: 'date is required' });
    if (!from_bank_account_id) return res.status(400).json({ error: 'from_bank_account_id is required' });
    if (!to_bank_account_id)   return res.status(400).json({ error: 'to_bank_account_id is required' });
    if (String(from_bank_account_id) === String(to_bank_account_id))
      return res.status(400).json({ error: 'From and To accounts must be different' });
    if (!amount || parseFloat(amount) <= 0)
      return res.status(400).json({ error: 'Amount must be greater than zero' });

    const number = await generateFTNumber(client);
    const { rows: [ft] } = await client.query(
      `INSERT INTO fund_transfers (number, date, reference, from_bank_account_id, to_bank_account_id, amount, comments, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING *`,
      [number, date, reference || null, from_bank_account_id, to_bank_account_id, parseFloat(amount), comments || null]
    );

    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${FT_SELECT} WHERE ft.id = $1`, [ft.id]);
    res.status(201).json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23514') return res.status(400).json({ error: 'From and To accounts must be different' });
    next(err);
  } finally { client.release(); }
});

// ── PUT /api/fund-transfers/:id (update draft) ────────────────────────────────
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [existing] } = await client.query(
      'SELECT status FROM fund_transfers WHERE id = $1', [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Fund transfer not found' });
    if (existing.status !== 'draft')
      return res.status(400).json({ error: 'Only draft fund transfers can be edited' });

    const { date, reference, from_bank_account_id, to_bank_account_id, amount, comments } = req.body;
    if (!date)                 return res.status(400).json({ error: 'date is required' });
    if (!from_bank_account_id) return res.status(400).json({ error: 'from_bank_account_id is required' });
    if (!to_bank_account_id)   return res.status(400).json({ error: 'to_bank_account_id is required' });
    if (String(from_bank_account_id) === String(to_bank_account_id))
      return res.status(400).json({ error: 'From and To accounts must be different' });
    if (!amount || parseFloat(amount) <= 0)
      return res.status(400).json({ error: 'Amount must be greater than zero' });

    await client.query(
      `UPDATE fund_transfers
          SET date=$1, reference=$2, from_bank_account_id=$3, to_bank_account_id=$4, amount=$5, comments=$6
        WHERE id=$7`,
      [date, reference || null, from_bank_account_id, to_bank_account_id, parseFloat(amount), comments || null, req.params.id]
    );

    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${FT_SELECT} WHERE ft.id = $1`, [req.params.id]);
    res.json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23514') return res.status(400).json({ error: 'From and To accounts must be different' });
    next(err);
  } finally { client.release(); }
});

// ── POST /api/fund-transfers/:id/post ─────────────────────────────────────────
router.post('/:id/post', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ft] } = await client.query(
      'SELECT * FROM fund_transfers WHERE id = $1 FOR UPDATE', [req.params.id]
    );
    if (!ft) return res.status(404).json({ error: 'Fund transfer not found' });
    if (ft.status !== 'draft') return res.status(400).json({ error: 'Only draft transfers can be posted' });

    // Get COA entries and normal_balance for both accounts
    const { rows: [fromCoa] } = await client.query(
      `SELECT coa.id, coa.normal_balance FROM bank_accounts ba JOIN chart_of_accounts coa ON coa.id = ba.coa_id WHERE ba.id = $1`,
      [ft.from_bank_account_id]
    );
    const { rows: [toCoa] } = await client.query(
      `SELECT coa.id, coa.normal_balance FROM bank_accounts ba JOIN chart_of_accounts coa ON coa.id = ba.coa_id WHERE ba.id = $1`,
      [ft.to_bank_account_id]
    );

    const amt = parseFloat(ft.amount);

    // Credit From account (reduces asset, increases liability)
    const fromChange = fromCoa.normal_balance === 'debit' ? -amt : amt;
    await client.query(
      'UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2',
      [fromChange, fromCoa.id]
    );

    // Debit To account (increases asset, reduces liability)
    const toChange = toCoa.normal_balance === 'debit' ? amt : -amt;
    await client.query(
      'UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2',
      [toChange, toCoa.id]
    );

    await client.query(`UPDATE fund_transfers SET status='posted' WHERE id=$1`, [ft.id]);
    await client.query('COMMIT');

    const { rows: [full] } = await pool.query(`${FT_SELECT} WHERE ft.id = $1`, [ft.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/fund-transfers/:id/cancel ───────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ft] } = await client.query(
      'SELECT * FROM fund_transfers WHERE id = $1 FOR UPDATE', [req.params.id]
    );
    if (!ft) return res.status(404).json({ error: 'Fund transfer not found' });
    if (ft.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    if (ft.status === 'posted') {
      const { rows: [fromCoa] } = await client.query(
        `SELECT coa.id, coa.normal_balance FROM bank_accounts ba JOIN chart_of_accounts coa ON coa.id = ba.coa_id WHERE ba.id = $1`,
        [ft.from_bank_account_id]
      );
      const { rows: [toCoa] } = await client.query(
        `SELECT coa.id, coa.normal_balance FROM bank_accounts ba JOIN chart_of_accounts coa ON coa.id = ba.coa_id WHERE ba.id = $1`,
        [ft.to_bank_account_id]
      );

      const amt = parseFloat(ft.amount);
      const fromChange = fromCoa.normal_balance === 'debit' ? -amt : amt;
      const toChange   = toCoa.normal_balance   === 'debit' ?  amt : -amt;

      // Reverse: add back what was taken from From, remove what was added to To
      await client.query(
        'UPDATE chart_of_accounts SET current_balance = current_balance - $1 WHERE id = $2',
        [fromChange, fromCoa.id]
      );
      await client.query(
        'UPDATE chart_of_accounts SET current_balance = current_balance - $1 WHERE id = $2',
        [toChange, toCoa.id]
      );
    }

    await client.query(`UPDATE fund_transfers SET status='cancelled' WHERE id=$1`, [ft.id]);
    await client.query('COMMIT');

    const { rows: [full] } = await pool.query(`${FT_SELECT} WHERE ft.id = $1`, [ft.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── DELETE /api/fund-transfers/:id ────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [ft] } = await pool.query(
      'SELECT status FROM fund_transfers WHERE id = $1', [req.params.id]
    );
    if (!ft) return res.status(404).json({ error: 'Fund transfer not found' });
    if (ft.status !== 'draft')
      return res.status(400).json({ error: 'Only draft fund transfers can be deleted' });
    await pool.query('DELETE FROM fund_transfers WHERE id = $1', [req.params.id]);
    res.json({ message: 'Fund transfer deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
