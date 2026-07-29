const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries, safeNextNumber } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function nextNumber(client) {
  const series = await getOrCreateSeries(client, 'Sales Refunds', 'CR-', 6);
  return safeNextNumber(client, series, 'name', 'Sales Refunds', 'sales_refunds', 'number');
}

async function saveInstruments(client, refundId, instruments) {
  await client.query('DELETE FROM sales_refund_instruments WHERE refund_id = $1', [refundId]);
  let total = 0;
  for (const inst of instruments) {
    const amt = Number(inst.amount || 0);
    if (amt <= 0) continue;
    await client.query(
      `INSERT INTO sales_refund_instruments (refund_id, mode, bank_ref, date, account_id, amount)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [refundId, inst.mode || 'cash', inst.bank_ref || null, inst.date, inst.account_id || null, amt]
    );
    total += amt;
  }
  return total;
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const conds = [], vals = [];
    if (status)    { vals.push(status);       conds.push(`rf.status = $${vals.length}`); }
    if (search)    { vals.push(`%${search}%`); conds.push(`(rf.number ILIKE $${vals.length} OR c.print_name ILIKE $${vals.length} OR rf.reference ILIKE $${vals.length})`); }
    if (date_from) { vals.push(date_from);    conds.push(`rf.date >= $${vals.length}`); }
    if (date_to)   { vals.push(date_to);      conds.push(`rf.date <= $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT rf.*, c.print_name AS customer_name, sr.number AS return_number,
         (SELECT string_agg(coa.name, ', ') FROM sales_refund_instruments i
            JOIN chart_of_accounts coa ON coa.id = i.account_id
            WHERE i.refund_id = rf.id) AS bank_account_name
       FROM sales_refunds rf
       JOIN customers c ON c.id = rf.customer_id
       LEFT JOIN sales_returns sr ON sr.id = rf.return_id
       ${where} ORDER BY rf.date DESC, rf.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rf.*, c.print_name AS customer_name, sr.number AS return_number
       FROM sales_refunds rf
       JOIN customers c ON c.id = rf.customer_id
       LEFT JOIN sales_returns sr ON sr.id = rf.return_id
       WHERE rf.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: instruments } = await pool.query(
      `SELECT i.*, coa.name AS account_name FROM sales_refund_instruments i
       LEFT JOIN chart_of_accounts coa ON coa.id = i.account_id
       WHERE i.refund_id = $1 ORDER BY i.id`, [req.params.id]
    );
    res.json({ ...rows[0], instruments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, return_id, date, reference, notes, instruments = [] } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!instruments.length) return res.status(400).json({ error: 'At least one instrument is required' });
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO sales_refunds (number, date, customer_id, return_id, reference, notes, total_amount, unadjusted_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,0,0,'draft') RETURNING *`,
      [number, date, customer_id, return_id || null, reference || null, notes || null]
    );
    const total = await saveInstruments(client, rows[0].id, instruments);
    const { rows: updated } = await client.query(
      'UPDATE sales_refunds SET total_amount=$1, unadjusted_amount=$1 WHERE id=$2 RETURNING *',
      [total, rows[0].id]
    );
    await client.query('COMMIT');
    res.status(201).json(updated[0]);
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
    const { rows: existing } = await client.query('SELECT * FROM sales_refunds WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (existing[0].status !== 'draft') return res.status(400).json({ error: 'Only draft refunds can be edited' });
    const { customer_id, return_id, date, reference, notes, instruments = [] } = req.body;
    if (!instruments.length) return res.status(400).json({ error: 'At least one instrument is required' });
    const total = await saveInstruments(client, req.params.id, instruments);
    const { rows } = await client.query(
      `UPDATE sales_refunds SET customer_id=$1, return_id=$2, date=$3, reference=$4, notes=$5,
         total_amount=$6, unadjusted_amount=$6 WHERE id=$7 RETURNING *`,
      [customer_id, return_id || null, date, reference || null, notes || null, total, req.params.id]
    );
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
    const { rows } = await client.query(`
      SELECT rf.*, sr.unadjusted_amount AS return_unadj
      FROM sales_refunds rf
      LEFT JOIN sales_returns sr ON sr.id = rf.return_id
      WHERE rf.id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft refunds can be approved' });
    const rf = rows[0];
    const total = Number(rf.total_amount);

    // DR A/R (clearing customer credit), CR bank/cash per instrument
    const { rows: arRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsReceivable' LIMIT 1`);
    if (!arRows.length) return res.status(400).json({ error: 'Accounts Receivable account not found' });
    const arChange = arRows[0].normal_balance === 'debit' ? total : -total;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [arChange, arRows[0].id]);

    const jeLines = [changeToLine(arRows[0], arChange, `Sales Refund ${rf.number}`)];
    const { rows: instruments } = await client.query('SELECT * FROM sales_refund_instruments WHERE refund_id=$1', [rf.id]);
    for (const inst of instruments) {
      if (!inst.account_id) continue;
      const { rows: coa } = await client.query('SELECT * FROM chart_of_accounts WHERE id=$1', [inst.account_id]);
      if (!coa.length) continue;
      const bankChange = coa[0].normal_balance === 'debit' ? -Number(inst.amount) : Number(inst.amount);
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [bankChange, inst.account_id]);
      jeLines.push(changeToLine(coa[0], bankChange, `Sales Refund ${rf.number}`));
    }

    await postJournalEntry(client, {
      date: rf.date, memo: `Sales Refund ${rf.number}`, reference: rf.number,
      source_type: 'SalesRefund', source_id: rf.id, lines: jeLines,
    });

    // Reduce linked return's unadjusted_amount
    if (rf.return_id) {
      const newUnadj = Math.max(0, Number(rf.return_unadj || 0) - total);
      let retStatus = 'approved';
      if (newUnadj === 0) retStatus = 'fully_adjusted';
      else if (newUnadj < Number(rf.return_unadj || 0)) retStatus = 'partially_adjusted';
      await client.query(
        `UPDATE sales_returns SET unadjusted_amount=$1, status=$2 WHERE id=$3`,
        [newUnadj, retStatus, rf.return_id]
      );
    }

    const { rows: updated } = await client.query(
      `UPDATE sales_refunds SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]
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
    const { rows } = await client.query('SELECT * FROM sales_refunds WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const rf = rows[0];
    if (!['draft', 'approved'].includes(rf.status)) return res.status(400).json({ error: 'Cannot cancel in current status' });

    if (rf.status === 'approved') {
      const total = Number(rf.total_amount);
      const { rows: arRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsReceivable' LIMIT 1`);
      if (arRows.length) {
        const arChange = arRows[0].normal_balance === 'debit' ? -total : total;
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [arChange, arRows[0].id]);
      }
      const { rows: instruments } = await client.query('SELECT * FROM sales_refund_instruments WHERE refund_id=$1', [rf.id]);
      for (const inst of instruments) {
        if (!inst.account_id) continue;
        const { rows: coa } = await client.query('SELECT normal_balance FROM chart_of_accounts WHERE id=$1', [inst.account_id]);
        if (!coa.length) continue;
        const bankChange = coa[0].normal_balance === 'debit' ? Number(inst.amount) : -Number(inst.amount);
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [bankChange, inst.account_id]);
      }
      await reverseJournalEntriesForSource(client, {
        source_type: 'SalesRefund', source_id: rf.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Sales Refund ${rf.number}`,
      });
      if (rf.return_id) {
        const { rows: retRows } = await client.query('SELECT * FROM sales_returns WHERE id=$1', [rf.return_id]);
        if (retRows.length) {
          const newUnadj = Math.min(Number(retRows[0].net_amount), Number(retRows[0].unadjusted_amount) + total);
          const retStatus = newUnadj >= Number(retRows[0].net_amount) ? 'approved' : 'partially_adjusted';
          await client.query('UPDATE sales_returns SET unadjusted_amount=$1, status=$2 WHERE id=$3', [newUnadj, retStatus, rf.return_id]);
        }
      }
    }

    const { rows: updated } = await client.query(`UPDATE sales_refunds SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
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
    const { rows } = await pool.query('SELECT status FROM sales_refunds WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft refunds can be deleted' });
    await pool.query('DELETE FROM sales_refunds WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
