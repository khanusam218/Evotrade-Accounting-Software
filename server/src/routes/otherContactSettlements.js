const express = require('express');
const router = express.Router();
const pool = require('../db');

async function nextNumber(client) {
  const r = await client.query(
    `UPDATE number_series SET next_number = next_number + 1
     WHERE name = 'Other Contact Settlements'
     RETURNING prefix || LPAD((next_number - 1)::text, padding, '0') AS num`
  );
  return r.rows[0].num;
}

async function saveReceivableLines(client, settlementId, lines) {
  await client.query('DELETE FROM ocs_receivable_lines WHERE settlement_id = $1', [settlementId]);
  for (const l of lines) {
    await client.query(
      `INSERT INTO ocs_receivable_lines (settlement_id, reference_no, description, amount, settled_amount)
       VALUES ($1,$2,$3,$4,$5)`,
      [settlementId, l.reference_no || null, l.description || null, l.amount, l.settled_amount || 0]
    );
  }
}

async function saveReceivedLines(client, settlementId, lines) {
  await client.query('DELETE FROM ocs_received_lines WHERE settlement_id = $1', [settlementId]);
  for (const l of lines) {
    await client.query(
      `INSERT INTO ocs_received_lines (settlement_id, reference_no, description, amount, payment_mode)
       VALUES ($1,$2,$3,$4,$5)`,
      [settlementId, l.reference_no || null, l.description || null, l.amount, l.payment_mode || 'cash']
    );
  }
}

// GET /next-number
router.get('/next-number', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number AS num, padding FROM number_series WHERE name = 'Other Contact Settlements'`
    );
    if (!rows.length) return res.status(404).json({ error: 'Number series "Other Contact Settlements" not found' });
    const { prefix, num, padding } = rows[0];
    res.json({ number: `${prefix}${String(num).padStart(padding, '0')}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /
router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conds = [], vals = [];
    if (status) { vals.push(status); conds.push(`status = $${vals.length}`); }
    if (search) { vals.push(`%${search}%`); conds.push(`(number ILIKE $${vals.length} OR contact_name ILIKE $${vals.length} OR reference ILIKE $${vals.length})`); }
    if (date_from) { vals.push(date_from); conds.push(`date >= $${vals.length}`); }
    if (date_to)   { vals.push(date_to);   conds.push(`date <= $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT * FROM other_contact_settlements ${where} ORDER BY date DESC, id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM other_contact_settlements WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const settlement = rows[0];
    const { rows: receivable } = await pool.query(
      'SELECT * FROM ocs_receivable_lines WHERE settlement_id = $1 ORDER BY id', [req.params.id]
    );
    const { rows: received } = await pool.query(
      'SELECT * FROM ocs_received_lines WHERE settlement_id = $1 ORDER BY id', [req.params.id]
    );
    res.json({ ...settlement, receivable_lines: receivable, received_lines: received });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { contact_name, date, reference, comments, auto_settle, receivable_lines = [], received_lines = [] } = req.body;
    if (!contact_name) return res.status(400).json({ error: 'contact_name is required' });
    const totalReceivable = receivable_lines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const totalReceived   = received_lines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO other_contact_settlements
         (number, date, contact_name, reference, comments, auto_settle, total_receivable, total_received, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft') RETURNING *`,
      [number, date, contact_name, reference || null, comments || null, auto_settle || false, totalReceivable, totalReceived]
    );
    const settlement = rows[0];
    await saveReceivableLines(client, settlement.id, receivable_lines);
    await saveReceivedLines(client, settlement.id, received_lines);
    await client.query('COMMIT');
    res.status(201).json(settlement);
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
    const { rows: existing } = await client.query('SELECT * FROM other_contact_settlements WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (existing[0].status !== 'draft') return res.status(400).json({ error: 'Only draft settlements can be edited' });
    const { contact_name, date, reference, comments, auto_settle, receivable_lines = [], received_lines = [] } = req.body;
    const totalReceivable = receivable_lines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const totalReceived   = received_lines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const { rows } = await client.query(
      `UPDATE other_contact_settlements SET
         contact_name=$1, date=$2, reference=$3, comments=$4, auto_settle=$5,
         total_receivable=$6, total_received=$7
       WHERE id=$8 RETURNING *`,
      [contact_name, date, reference || null, comments || null, auto_settle || false, totalReceivable, totalReceived, req.params.id]
    );
    await saveReceivableLines(client, req.params.id, receivable_lines);
    await saveReceivedLines(client, req.params.id, received_lines);
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
    const { rows } = await client.query('SELECT * FROM other_contact_settlements WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const s = rows[0];
    if (s.status !== 'draft') return res.status(400).json({ error: 'Only draft settlements can be approved' });
    // Determine status: completed if received >= receivable, else approved
    const newStatus = Number(s.total_received) >= Number(s.total_receivable) ? 'completed' : 'approved';
    const { rows: updated } = await client.query(
      `UPDATE other_contact_settlements SET status=$1 WHERE id=$2 RETURNING *`,
      [newStatus, req.params.id]
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
    const { rows } = await client.query('SELECT * FROM other_contact_settlements WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });
    const { rows: updated } = await client.query(
      `UPDATE other_contact_settlements SET status='cancelled' WHERE id=$1 RETURNING *`,
      [req.params.id]
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
    const { rows } = await pool.query('SELECT status FROM other_contact_settlements WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft settlements can be deleted' });
    await pool.query('DELETE FROM other_contact_settlements WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
