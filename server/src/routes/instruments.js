const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ── GET /api/instruments ──────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { payment_mode, status, search, date_from, date_to } = req.query;
    const conditions = [], params = [];

    if (payment_mode) { params.push(payment_mode); conditions.push(`pi.payment_mode = $${params.length}`); }
    if (status)       { params.push(status);        conditions.push(`pi.status = $${params.length}`); }
    if (search)       {
      params.push(`%${search}%`);
      const n = params.length;
      conditions.push(`(pi.bank_name ILIKE $${n} OR pi.instrument_no ILIKE $${n})`);
    }
    if (date_from)    { params.push(date_from); conditions.push(`pi.instrument_date >= $${params.length}`); }
    if (date_to)      { params.push(date_to);   conditions.push(`pi.instrument_date <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT pi.* FROM payment_instruments pi ${where} ORDER BY pi.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── PUT /api/instruments/:id/status ───────────────────────────────────────────
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'cleared', 'bounced', 'void'];
    if (!allowed.includes(status))
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });

    const { rows: [pi] } = await pool.query(
      `UPDATE payment_instruments SET status=$1 WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    if (!pi) return res.status(404).json({ error: 'Instrument not found' });
    res.json(pi);
  } catch (err) { next(err); }
});

module.exports = router;
