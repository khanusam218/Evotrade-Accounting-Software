const express = require('express');
const router  = express.Router();
const pool    = require('../db');

async function generateBDNumber(client) {
  const { rows } = await client.query(
    `UPDATE number_series SET next_number = next_number + 1
      WHERE name = 'Bank Deposits'
      RETURNING prefix, next_number - 1 AS num, padding`
  );
  if (!rows.length) throw new Error('Number series "Bank Deposits" not found');
  const { prefix, num, padding } = rows[0];
  return `${prefix}${String(num).padStart(padding, '0')}`;
}

const BD_SELECT = `
  SELECT bd.*,
         ba_coa.name AS bank_account_name, ba_coa.code AS bank_account_code, ba.bank_name
    FROM bank_deposits bd
    JOIN bank_accounts ba         ON ba.id     = bd.bank_account_id
    JOIN chart_of_accounts ba_coa ON ba_coa.id = ba.coa_id
`;

async function saveLines(client, depositId, lines) {
  await client.query('DELETE FROM bank_deposit_lines WHERE deposit_id=$1', [depositId]);
  for (const ln of lines) {
    const amt = parseFloat(ln.amount);
    if (!amt || amt <= 0) continue;
    await client.query(
      `INSERT INTO bank_deposit_lines
         (deposit_id, description, amount, source_type, source_id,
          line_date, received_from, payment_mode, bank_name, branch_code, branch_name, instrument_no, account_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [depositId, ln.description || null, amt,
       ln.source_type || 'manual', ln.source_id || null,
       ln.line_date || null, ln.received_from || null, ln.payment_mode || null,
       ln.bank_name || null, ln.branch_code || null, ln.branch_name || null,
       ln.instrument_no || null, ln.account_id || null]
    );
  }
}

// ── GET /api/bank-deposits/next-number ───────────────────────────────────────
router.get('/next-number', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number, padding FROM number_series WHERE name = 'Bank Deposits'`
    );
    if (!rows.length) return res.status(404).json({ error: 'Number series not found' });
    const { prefix, next_number, padding } = rows[0];
    res.json({ number: `${prefix}${String(next_number).padStart(padding, '0')}` });
  } catch (err) { next(err); }
});

// ── GET /api/bank-deposits ────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conditions = [], params = [];
    if (status)    { params.push(status);        conditions.push(`bd.status = $${params.length}`); }
    if (search)    { params.push(`%${search}%`); const n = params.length; conditions.push(`(bd.number ILIKE $${n} OR bd.deposit_no ILIKE $${n} OR ba_coa.name ILIKE $${n})`); }
    if (date_from) { params.push(date_from);      conditions.push(`bd.date >= $${params.length}`); }
    if (date_to)   { params.push(date_to);        conditions.push(`bd.date <= $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`${BD_SELECT} ${where} ORDER BY bd.date DESC, bd.id DESC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/bank-deposits/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [bd] } = await pool.query(`${BD_SELECT} WHERE bd.id=$1`, [req.params.id]);
    if (!bd) return res.status(404).json({ error: 'Bank deposit not found' });
    const { rows: lines } = await pool.query(
      'SELECT * FROM bank_deposit_lines WHERE deposit_id=$1 ORDER BY id',
      [req.params.id]
    );
    res.json({ ...bd, lines });
  } catch (err) { next(err); }
});

// ── POST /api/bank-deposits ───────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, bank_account_id, deposit_no, comments, lines = [] } = req.body;
    if (!date)            return res.status(400).json({ error: 'date is required' });
    if (!bank_account_id) return res.status(400).json({ error: 'bank_account_id is required' });

    const validLines = lines.filter((l) => parseFloat(l.amount) > 0);
    if (!validLines.length) return res.status(400).json({ error: 'At least one deposit line with amount is required' });

    const number = await generateBDNumber(client);
    const total  = validLines.reduce((s, l) => s + parseFloat(l.amount), 0);

    const { rows: [bd] } = await client.query(
      `INSERT INTO bank_deposits (number,date,bank_account_id,deposit_no,comments,total_amount,status)
       VALUES ($1,$2,$3,$4,$5,$6,'draft') RETURNING *`,
      [number, date, bank_account_id, deposit_no || null, comments || null, total]
    );
    await saveLines(client, bd.id, lines);
    await client.query('COMMIT');
    res.status(201).json(bd);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── PUT /api/bank-deposits/:id ────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ex] } = await client.query('SELECT status FROM bank_deposits WHERE id=$1', [req.params.id]);
    if (!ex) return res.status(404).json({ error: 'Not found' });
    if (ex.status !== 'draft') return res.status(400).json({ error: 'Only draft deposits can be edited' });

    const { date, bank_account_id, deposit_no, comments, lines = [] } = req.body;
    if (!date)            return res.status(400).json({ error: 'date is required' });
    if (!bank_account_id) return res.status(400).json({ error: 'bank_account_id is required' });

    const validLines = lines.filter((l) => parseFloat(l.amount) > 0);
    if (!validLines.length) return res.status(400).json({ error: 'At least one deposit line with amount is required' });

    const total = validLines.reduce((s, l) => s + parseFloat(l.amount), 0);
    const { rows: [bd] } = await client.query(
      `UPDATE bank_deposits SET date=$1,bank_account_id=$2,deposit_no=$3,comments=$4,total_amount=$5
        WHERE id=$6 RETURNING *`,
      [date, bank_account_id, deposit_no || null, comments || null, total, req.params.id]
    );
    await saveLines(client, bd.id, lines);
    await client.query('COMMIT');
    res.json(bd);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/bank-deposits/:id/deposit ──────────────────────────────────────
router.post('/:id/deposit', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [bd] } = await client.query('SELECT * FROM bank_deposits WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!bd) return res.status(404).json({ error: 'Not found' });
    if (bd.status !== 'draft') return res.status(400).json({ error: 'Only draft deposits can be deposited' });

    const total = parseFloat(bd.total_amount);
    if (!total) return res.status(400).json({ error: 'Total amount must be greater than 0' });

    // Debit bank account (increase)
    const { rows: [bankCoa] } = await client.query(
      `SELECT coa.id, coa.normal_balance FROM bank_accounts ba
         JOIN chart_of_accounts coa ON coa.id=ba.coa_id WHERE ba.id=$1`,
      [bd.bank_account_id]
    );
    const bankChange = bankCoa.normal_balance === 'debit' ? total : -total;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [bankChange, bankCoa.id]);

    // Credit Undeposited Funds (decrease)
    const { rows: [ufCoa] } = await client.query(
      `SELECT id, normal_balance FROM chart_of_accounts WHERE system_name='undeposited_funds'`
    );
    if (!ufCoa) throw new Error('Undeposited Funds account not found');
    const ufChange = ufCoa.normal_balance === 'debit' ? -total : total;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [ufChange, ufCoa.id]);

    await client.query(`UPDATE bank_deposits SET status='deposited' WHERE id=$1`, [bd.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${BD_SELECT} WHERE bd.id=$1`, [bd.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/bank-deposits/:id/clear ────────────────────────────────────────
router.post('/:id/clear', async (req, res, next) => {
  try {
    const { rows: [bd] } = await pool.query('SELECT status FROM bank_deposits WHERE id=$1', [req.params.id]);
    if (!bd) return res.status(404).json({ error: 'Not found' });
    if (bd.status !== 'deposited') return res.status(400).json({ error: 'Only deposited records can be cleared' });
    await pool.query(`UPDATE bank_deposits SET status='cleared' WHERE id=$1`, [req.params.id]);
    const { rows: [full] } = await pool.query(`${BD_SELECT} WHERE bd.id=$1`, [req.params.id]);
    res.json(full);
  } catch (err) { next(err); }
});

// ── POST /api/bank-deposits/:id/cancel ───────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [bd] } = await client.query('SELECT * FROM bank_deposits WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!bd) return res.status(404).json({ error: 'Not found' });
    if (bd.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });
    if (bd.status === 'cleared')   return res.status(400).json({ error: 'Cleared deposits cannot be cancelled' });

    if (bd.status === 'deposited') {
      const total = parseFloat(bd.total_amount);
      const { rows: [bankCoa] } = await client.query(
        `SELECT coa.id, coa.normal_balance FROM bank_accounts ba
           JOIN chart_of_accounts coa ON coa.id=ba.coa_id WHERE ba.id=$1`,
        [bd.bank_account_id]
      );
      const bankChange = bankCoa.normal_balance === 'debit' ? total : -total;
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance-$1 WHERE id=$2', [bankChange, bankCoa.id]);

      const { rows: [ufCoa] } = await client.query(
        `SELECT id, normal_balance FROM chart_of_accounts WHERE system_name='undeposited_funds'`
      );
      const ufChange = ufCoa.normal_balance === 'debit' ? -total : total;
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance-$1 WHERE id=$2', [ufChange, ufCoa.id]);
    }

    await client.query(`UPDATE bank_deposits SET status='cancelled' WHERE id=$1`, [bd.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${BD_SELECT} WHERE bd.id=$1`, [bd.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── DELETE /api/bank-deposits/:id ─────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [bd] } = await pool.query('SELECT status FROM bank_deposits WHERE id=$1', [req.params.id]);
    if (!bd) return res.status(404).json({ error: 'Not found' });
    if (bd.status !== 'draft') return res.status(400).json({ error: 'Only draft deposits can be deleted' });
    await pool.query('DELETE FROM bank_deposits WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
