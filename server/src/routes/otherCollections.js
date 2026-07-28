const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function generateOCNumber(client) {
  await getOrCreateSeries(client, 'Other Collections', 'OC-', 6);
  const { rows } = await client.query(
    `UPDATE number_series SET next_number = next_number + 1
      WHERE name = 'Other Collections'
      RETURNING prefix, next_number - 1 AS num, padding`
  );
  if (!rows.length) throw new Error('Number series "Other Collections" not found');
  const { prefix, num, padding } = rows[0];
  return `${prefix}${String(num).padStart(padding, '0')}`;
}

const OC_SELECT = `
  SELECT oc.*,
         ba_coa.name AS bank_account_name, ba_coa.code AS bank_account_code, ba.bank_name
    FROM other_collections oc
    JOIN bank_accounts ba     ON ba.id     = oc.bank_account_id
    JOIN chart_of_accounts ba_coa ON ba_coa.id = ba.coa_id
`;

// ── GET /api/other-collections/next-number ────────────────────────────────────
router.get('/next-number', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number AS num, padding FROM number_series WHERE name = 'Other Collections'`
    );
    if (!rows.length) return res.status(404).json({ error: 'Number series "Other Collections" not found' });
    const { prefix, num, padding } = rows[0];
    res.json({ number: `${prefix}${String(num).padStart(padding, '0')}` });
  } catch (err) { next(err); }
});

// ── GET /api/other-collections ────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conditions = [], params = [];
    if (status)    { params.push(status);          conditions.push(`oc.status = $${params.length}`); }
    if (search)    { params.push(`%${search}%`);   const n = params.length; conditions.push(`(oc.number ILIKE $${n} OR oc.contact_name ILIKE $${n} OR oc.reference ILIKE $${n})`); }
    if (date_from) { params.push(date_from);        conditions.push(`oc.date >= $${params.length}`); }
    if (date_to)   { params.push(date_to);          conditions.push(`oc.date <= $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`${OC_SELECT} ${where} ORDER BY oc.date DESC, oc.id DESC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/other-collections/:id (with instruments + adjustments) ───────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [oc] } = await pool.query(`${OC_SELECT} WHERE oc.id = $1`, [req.params.id]);
    if (!oc) return res.status(404).json({ error: 'Other collection not found' });
    const { rows: instruments } = await pool.query(
      `SELECT * FROM payment_instruments WHERE source_type='other_collection' AND source_id=$1 ORDER BY id`,
      [req.params.id]
    );
    const { rows: adjustments } = await pool.query(
      `SELECT adj.*, coa.code AS account_code, coa.name AS account_name
         FROM other_collection_adjustments adj
         JOIN chart_of_accounts coa ON coa.id = adj.account_id
        WHERE adj.collection_id=$1 ORDER BY adj.id`,
      [req.params.id]
    );
    res.json({ ...oc, instruments, adjustments });
  } catch (err) { next(err); }
});

async function saveInstruments(client, sourceId, instruments) {
  await client.query(`DELETE FROM payment_instruments WHERE source_type='other_collection' AND source_id=$1`, [sourceId]);
  for (const ins of instruments) {
    if (!ins.payment_mode || !ins.amount) continue;
    await client.query(
      `INSERT INTO payment_instruments (source_type, source_id, payment_mode, bank_name, instrument_no, instrument_date, amount)
       VALUES ('other_collection',$1,$2,$3,$4,$5,$6)`,
      [sourceId, ins.payment_mode, ins.bank_name || null, ins.instrument_no || null,
       ins.instrument_date || null, parseFloat(ins.amount)]
    );
  }
}

async function saveAdjustments(client, collectionId, adjustments) {
  await client.query(`DELETE FROM other_collection_adjustments WHERE collection_id=$1`, [collectionId]);
  for (const adj of adjustments) {
    if (!adj.account_id || !adj.amount) continue;
    await client.query(
      `INSERT INTO other_collection_adjustments (collection_id, account_id, description, amount) VALUES ($1,$2,$3,$4)`,
      [collectionId, adj.account_id, adj.description || null, parseFloat(adj.amount)]
    );
  }
}

// ── POST /api/other-collections ───────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, contact_name, reference, bank_account_id, comments, instruments = [], adjustments = [] } = req.body;
    if (!date)            return res.status(400).json({ error: 'date is required' });
    if (!contact_name?.trim()) return res.status(400).json({ error: 'contact_name is required' });
    if (!bank_account_id) return res.status(400).json({ error: 'bank_account_id is required' });

    const number = await generateOCNumber(client);
    const total  = adjustments.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

    const { rows: [oc] } = await client.query(
      `INSERT INTO other_collections (number,date,contact_name,reference,bank_account_id,comments,total_amount,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING *`,
      [number, date, contact_name.trim(), reference || null, bank_account_id, comments || null, total]
    );
    await saveInstruments(client, oc.id, instruments);
    await saveAdjustments(client, oc.id, adjustments);
    await client.query('COMMIT');
    res.status(201).json(oc);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── PUT /api/other-collections/:id ────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ex] } = await client.query('SELECT status FROM other_collections WHERE id=$1', [req.params.id]);
    if (!ex) return res.status(404).json({ error: 'Not found' });
    if (ex.status !== 'draft') return res.status(400).json({ error: 'Only draft records can be edited' });

    const { date, contact_name, reference, bank_account_id, comments, instruments = [], adjustments = [] } = req.body;
    if (!date)            return res.status(400).json({ error: 'date is required' });
    if (!contact_name?.trim()) return res.status(400).json({ error: 'contact_name is required' });
    if (!bank_account_id) return res.status(400).json({ error: 'bank_account_id is required' });

    const total = adjustments.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    const { rows: [oc] } = await client.query(
      `UPDATE other_collections SET date=$1,contact_name=$2,reference=$3,bank_account_id=$4,comments=$5,total_amount=$6
        WHERE id=$7 RETURNING *`,
      [date, contact_name.trim(), reference || null, bank_account_id, comments || null, total, req.params.id]
    );
    await saveInstruments(client, oc.id, instruments);
    await saveAdjustments(client, oc.id, adjustments);
    await client.query('COMMIT');
    res.json(oc);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/other-collections/:id/approve ───────────────────────────────────
router.post('/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [oc] } = await client.query('SELECT * FROM other_collections WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!oc) return res.status(404).json({ error: 'Not found' });
    if (oc.status !== 'draft') return res.status(400).json({ error: 'Only draft records can be approved' });

    const { rows: adjs } = await client.query(
      `SELECT adj.amount, coa.normal_balance, adj.account_id
         FROM other_collection_adjustments adj JOIN chart_of_accounts coa ON coa.id=adj.account_id
        WHERE adj.collection_id=$1`, [oc.id]
    );
    if (!adjs.length) return res.status(400).json({ error: 'No account adjustments found' });

    // Credit each adjustment account (money comes in, crediting income/liability)
    const jeLines = [];
    for (const adj of adjs) {
      const change = adj.normal_balance === 'credit' ? adj.amount : -adj.amount;
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [change, adj.account_id]);
      jeLines.push(changeToLine({ id: adj.account_id, normal_balance: adj.normal_balance }, change, `Other Collection ${oc.number}`));
    }

    // Debit the bank account (asset increases)
    const { rows: [bankCoa] } = await client.query(
      `SELECT coa.id, coa.normal_balance FROM bank_accounts ba JOIN chart_of_accounts coa ON coa.id=ba.coa_id WHERE ba.id=$1`,
      [oc.bank_account_id]
    );
    const bankChange = bankCoa.normal_balance === 'debit' ? parseFloat(oc.total_amount) : -parseFloat(oc.total_amount);
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [bankChange, bankCoa.id]);
    jeLines.push(changeToLine(bankCoa, bankChange, `Other Collection ${oc.number}`));

    await postJournalEntry(client, {
      date: oc.date, memo: `Other Collection ${oc.number}`, reference: oc.number,
      source_type: 'OtherCollection', source_id: oc.id, lines: jeLines,
    });

    await client.query(`UPDATE other_collections SET status='approved' WHERE id=$1`, [oc.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${OC_SELECT} WHERE oc.id=$1`, [oc.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── POST /api/other-collections/:id/cancel ────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [oc] } = await client.query('SELECT * FROM other_collections WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!oc) return res.status(404).json({ error: 'Not found' });
    if (oc.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    if (oc.status === 'approved') {
      const { rows: adjs } = await client.query(
        `SELECT adj.amount, coa.normal_balance, adj.account_id
           FROM other_collection_adjustments adj JOIN chart_of_accounts coa ON coa.id=adj.account_id
          WHERE adj.collection_id=$1`, [oc.id]
      );
      for (const adj of adjs) {
        const change = adj.normal_balance === 'credit' ? adj.amount : -adj.amount;
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance-$1 WHERE id=$2', [change, adj.account_id]);
      }
      const { rows: [bankCoa] } = await client.query(
        `SELECT coa.id, coa.normal_balance FROM bank_accounts ba JOIN chart_of_accounts coa ON coa.id=ba.coa_id WHERE ba.id=$1`,
        [oc.bank_account_id]
      );
      const bankChange = bankCoa.normal_balance === 'debit' ? parseFloat(oc.total_amount) : -parseFloat(oc.total_amount);
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance-$1 WHERE id=$2', [bankChange, bankCoa.id]);

      await reverseJournalEntriesForSource(client, {
        source_type: 'OtherCollection', source_id: oc.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Other Collection ${oc.number}`,
      });
    }

    await client.query(`UPDATE other_collections SET status='cancelled' WHERE id=$1`, [oc.id]);
    await client.query('COMMIT');
    const { rows: [full] } = await pool.query(`${OC_SELECT} WHERE oc.id=$1`, [oc.id]);
    res.json(full);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// ── DELETE /api/other-collections/:id ─────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [oc] } = await pool.query('SELECT status FROM other_collections WHERE id=$1', [req.params.id]);
    if (!oc) return res.status(404).json({ error: 'Not found' });
    if (oc.status !== 'draft') return res.status(400).json({ error: 'Only draft records can be deleted' });
    await pool.query('DELETE FROM other_collections WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
