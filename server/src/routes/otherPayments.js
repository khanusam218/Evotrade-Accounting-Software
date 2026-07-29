const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries, safeNextNumber } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function generateOPNumber(client) {
  const series = await getOrCreateSeries(client, 'Other Payments', 'OP-', 6);
  return safeNextNumber(client, series, 'name', 'Other Payments', 'other_payments', 'number');
}

const OP_SELECT = `
  SELECT op.*,
         ba_coa.name AS bank_account_name, ba_coa.code AS bank_account_code, ba.bank_name
    FROM other_payments op
    JOIN bank_accounts ba         ON ba.id     = op.bank_account_id
    JOIN chart_of_accounts ba_coa ON ba_coa.id = ba.coa_id
`;

// ── GET /api/other-payments/next-number ──────────────────────────────────────
router.get('/next-number', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number AS num, padding FROM number_series WHERE name = 'Other Payments'`
    );
    if (!rows.length) return res.status(404).json({ error: 'Number series "Other Payments" not found' });
    const { prefix, num, padding } = rows[0];
    res.json({ number: `${prefix}${String(num).padStart(padding, '0')}` });
  } catch (err) { next(err); }
});

// ── GET /api/other-payments ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conditions = [], params = [];
    if (status)    { params.push(status);         conditions.push(`op.status = $${params.length}`); }
    if (search)    { params.push(`%${search}%`);  const n = params.length; conditions.push(`(op.number ILIKE $${n} OR op.contact_name ILIKE $${n} OR op.reference ILIKE $${n})`); }
    if (date_from) { params.push(date_from);       conditions.push(`op.date >= $${params.length}`); }
    if (date_to)   { params.push(date_to);         conditions.push(`op.date <= $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`${OP_SELECT} ${where} ORDER BY op.date DESC, op.id DESC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/other-payments/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [op] } = await pool.query(`${OP_SELECT} WHERE op.id=$1`, [req.params.id]);
    if (!op) return res.status(404).json({ error: 'Other payment not found' });
    const { rows: instruments } = await pool.query(
      `SELECT * FROM payment_instruments WHERE source_type='other_payment' AND source_id=$1 ORDER BY id`,
      [req.params.id]
    );
    const { rows: adjustments } = await pool.query(
      `SELECT adj.*, coa.code AS account_code, coa.name AS account_name
         FROM other_payment_adjustments adj
         JOIN chart_of_accounts coa ON coa.id=adj.account_id
        WHERE adj.payment_id=$1 ORDER BY adj.id`,
      [req.params.id]
    );
    res.json({ ...op, instruments, adjustments });
  } catch (err) { next(err); }
});

async function saveInstruments(client, sourceId, instruments) {
  await client.query(`DELETE FROM payment_instruments WHERE source_type='other_payment' AND source_id=$1`, [sourceId]);
  for (const ins of instruments) {
    if (!ins.payment_mode || !ins.amount) continue;
    await client.query(
      `INSERT INTO payment_instruments (source_type,source_id,payment_mode,bank_name,instrument_no,instrument_date,amount)
       VALUES ('other_payment',$1,$2,$3,$4,$5,$6)`,
      [sourceId, ins.payment_mode, ins.bank_name || null, ins.instrument_no || null,
       ins.instrument_date || null, parseFloat(ins.amount)]
    );
  }
}

async function saveAdjustments(client, paymentId, adjustments) {
  await client.query(`DELETE FROM other_payment_adjustments WHERE payment_id=$1`, [paymentId]);
  for (const adj of adjustments) {
    if (!adj.account_id || !adj.amount) continue;
    await client.query(
      `INSERT INTO other_payment_adjustments (payment_id,account_id,description,amount) VALUES ($1,$2,$3,$4)`,
      [paymentId, adj.account_id, adj.description || null, parseFloat(adj.amount)]
    );
  }
}

// ── POST /api/other-payments ──────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, contact_name, reference, bank_account_id, comments, instruments = [], adjustments = [] } = req.body;
    if (!date)                 return res.status(400).json({ error: 'date is required' });
    if (!contact_name?.trim()) return res.status(400).json({ error: 'contact_name is required' });
    if (!bank_account_id)      return res.status(400).json({ error: 'bank_account_id is required' });

    const number = await generateOPNumber(client);
    const total  = adjustments.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

    const { rows: [op] } = await client.query(
      `INSERT INTO other_payments (number,date,contact_name,reference,bank_account_id,comments,total_amount,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING *`,
      [number, date, contact_name.trim(), reference || null, bank_account_id, comments || null, total]
    );
    await saveInstruments(client, op.id, instruments);
    await saveAdjustments(client, op.id, adjustments);
    await client.query('COMMIT');
    res.status(201).json(op);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── PUT /api/other-payments/:id ───────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ex] } = await client.query('SELECT status FROM other_payments WHERE id=$1', [req.params.id]);
    if (!ex) return res.status(404).json({ error: 'Not found' });
    if (ex.status !== 'draft') return res.status(400).json({ error: 'Only draft records can be edited' });

    const { date, contact_name, reference, bank_account_id, comments, instruments = [], adjustments = [] } = req.body;
    if (!date)                 return res.status(400).json({ error: 'date is required' });
    if (!contact_name?.trim()) return res.status(400).json({ error: 'contact_name is required' });
    if (!bank_account_id)      return res.status(400).json({ error: 'bank_account_id is required' });

    const total = adjustments.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    const { rows: [op] } = await client.query(
      `UPDATE other_payments SET date=$1,contact_name=$2,reference=$3,bank_account_id=$4,comments=$5,total_amount=$6
        WHERE id=$7 RETURNING *`,
      [date, contact_name.trim(), reference || null, bank_account_id, comments || null, total, req.params.id]
    );
    await saveInstruments(client, op.id, instruments);
    await saveAdjustments(client, op.id, adjustments);
    await client.query('COMMIT');
    res.json(op);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/other-payments/:id/approve ──────────────────────────────────────
router.post('/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [op] } = await client.query('SELECT * FROM other_payments WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!op) return res.status(404).json({ error: 'Not found' });
    if (op.status !== 'draft') return res.status(400).json({ error: 'Only draft records can be approved' });

    const { rows: adjs } = await client.query(
      `SELECT adj.amount, coa.normal_balance, adj.account_id
         FROM other_payment_adjustments adj JOIN chart_of_accounts coa ON coa.id=adj.account_id
        WHERE adj.payment_id=$1`, [op.id]
    );
    if (!adjs.length) return res.status(400).json({ error: 'No account adjustments found' });

    // Debit each adjustment account (money goes out)
    const jeLines = [];
    for (const adj of adjs) {
      const change = adj.normal_balance === 'debit' ? adj.amount : -adj.amount;
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [change, adj.account_id]);
      jeLines.push(changeToLine({ id: adj.account_id, normal_balance: adj.normal_balance }, change, `Other Payment ${op.number}`));
    }

    // Credit the bank account (asset decreases)
    const { rows: [bankCoa] } = await client.query(
      `SELECT coa.id, coa.normal_balance FROM bank_accounts ba JOIN chart_of_accounts coa ON coa.id=ba.coa_id WHERE ba.id=$1`,
      [op.bank_account_id]
    );
    const bankChange = bankCoa.normal_balance === 'debit' ? -parseFloat(op.total_amount) : parseFloat(op.total_amount);
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [bankChange, bankCoa.id]);
    jeLines.push(changeToLine(bankCoa, bankChange, `Other Payment ${op.number}`));

    await postJournalEntry(client, {
      date: op.date, memo: `Other Payment ${op.number}`, reference: op.number,
      source_type: 'OtherPayment', source_id: op.id, lines: jeLines,
    });

    await client.query(`UPDATE other_payments SET status='approved' WHERE id=$1`, [op.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${OP_SELECT} WHERE op.id=$1`, [op.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/other-payments/:id/cancel ───────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [op] } = await client.query('SELECT * FROM other_payments WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!op) return res.status(404).json({ error: 'Not found' });
    if (op.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    if (op.status === 'approved') {
      const { rows: adjs } = await client.query(
        `SELECT adj.amount, coa.normal_balance, adj.account_id
           FROM other_payment_adjustments adj JOIN chart_of_accounts coa ON coa.id=adj.account_id
          WHERE adj.payment_id=$1`, [op.id]
      );
      for (const adj of adjs) {
        const change = adj.normal_balance === 'debit' ? adj.amount : -adj.amount;
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance-$1 WHERE id=$2', [change, adj.account_id]);
      }
      const { rows: [bankCoa] } = await client.query(
        `SELECT coa.id, coa.normal_balance FROM bank_accounts ba JOIN chart_of_accounts coa ON coa.id=ba.coa_id WHERE ba.id=$1`,
        [op.bank_account_id]
      );
      const bankChange = bankCoa.normal_balance === 'debit' ? -parseFloat(op.total_amount) : parseFloat(op.total_amount);
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance-$1 WHERE id=$2', [bankChange, bankCoa.id]);

      await reverseJournalEntriesForSource(client, {
        source_type: 'OtherPayment', source_id: op.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Other Payment ${op.number}`,
      });
    }

    await client.query(`UPDATE other_payments SET status='cancelled' WHERE id=$1`, [op.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${OP_SELECT} WHERE op.id=$1`, [op.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── DELETE /api/other-payments/:id ────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [op] } = await pool.query('SELECT status FROM other_payments WHERE id=$1', [req.params.id]);
    if (!op) return res.status(404).json({ error: 'Not found' });
    if (op.status !== 'draft') return res.status(400).json({ error: 'Only draft records can be deleted' });
    await pool.query('DELETE FROM other_payments WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
