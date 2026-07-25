const express = require('express');
const router  = express.Router();
const pool    = require('../db');

async function nextNumber(client) {
  const r = await client.query(
    `UPDATE number_series SET next_number = next_number + 1
     WHERE name = 'Purchase Refunds'
     RETURNING prefix || LPAD((next_number - 1)::text, padding, '0') AS num`
  );
  return r.rows[0].num;
}

async function saveInstruments(client, refundId, instruments) {
  await client.query('DELETE FROM purchase_refund_instruments WHERE refund_id=$1', [refundId]);
  let total = 0;
  for (const inst of instruments) {
    const amt = Number(inst.amount || 0);
    if (amt <= 0) continue;
    await client.query(
      `INSERT INTO purchase_refund_instruments (refund_id, mode, bank_ref, bank_name, instrument_no, date, account_id, amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [refundId, inst.mode || 'cash', inst.bank_ref || null, inst.bank_name || null, inst.instrument_no || null, inst.date || new Date().toISOString().slice(0,10), inst.account_id || null, amt]
    );
    total += amt;
  }
  return total;
}

// GET /next-number
router.get('/next-number', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix || LPAD(GREATEST(
         next_number,
         COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)) + 1
                   FROM purchase_refunds WHERE number ~ '^[A-Z]+-[0-9]+$'), 0)
       )::text, padding, '0') AS number FROM number_series WHERE name='Purchase Refunds'`
    );
    res.json(rows[0] || { number: 'VR-000001' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to, vendor_id } = req.query;
    const conds = [], vals = [];
    if (status)    { vals.push(status);        conds.push(`rf.status = $${vals.length}`); }
    if (vendor_id) { vals.push(vendor_id);     conds.push(`rf.vendor_id = $${vals.length}`); }
    if (search)    { vals.push(`%${search}%`); conds.push(`(rf.number ILIKE $${vals.length} OR v.print_name ILIKE $${vals.length} OR rf.reference ILIKE $${vals.length})`); }
    if (date_from) { vals.push(date_from);     conds.push(`rf.date >= $${vals.length}`); }
    if (date_to)   { vals.push(date_to);       conds.push(`rf.date <= $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT rf.*, v.print_name AS vendor_name, pr.number AS return_number
       FROM purchase_refunds rf JOIN vendors v ON v.id = rf.vendor_id
       LEFT JOIN purchase_returns pr ON pr.id = rf.return_id
       ${where} ORDER BY rf.date DESC, rf.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT rf.*, v.print_name AS vendor_name, pr.number AS return_number
       FROM purchase_refunds rf JOIN vendors v ON v.id = rf.vendor_id
       LEFT JOIN purchase_returns pr ON pr.id = rf.return_id
       WHERE rf.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: instruments } = await pool.query(
      `SELECT i.id, i.mode, i.bank_ref, i.bank_name, i.instrument_no, i.date, i.account_id, i.amount, coa.name AS account_name
       FROM purchase_refund_instruments i
       LEFT JOIN chart_of_accounts coa ON coa.id = i.account_id
       WHERE i.refund_id=$1 ORDER BY i.id`, [req.params.id]
    );
    res.json({ ...rows[0], instruments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { vendor_id, return_id, date, reference, notes, instruments = [] } = req.body;
    if (!vendor_id) return res.status(400).json({ error: 'vendor_id is required' });
    if (!instruments.length) return res.status(400).json({ error: 'At least one instrument is required' });
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO purchase_refunds (number, date, vendor_id, return_id, reference, notes, total_amount, unadjusted_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,0,0,'draft') RETURNING *`,
      [number, date, vendor_id, return_id || null, reference || null, notes || null]
    );
    const total = await saveInstruments(client, rows[0].id, instruments);
    const { rows: u } = await client.query(
      'UPDATE purchase_refunds SET total_amount=$1, unadjusted_amount=$1 WHERE id=$2 RETURNING *', [total, rows[0].id]
    );
    await client.query('COMMIT');
    res.status(201).json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: ex } = await client.query('SELECT * FROM purchase_refunds WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (ex[0].status !== 'draft') return res.status(400).json({ error: 'Only draft refunds can be edited' });
    const { vendor_id, return_id, date, reference, notes, instruments = [] } = req.body;
    if (!instruments.length) return res.status(400).json({ error: 'At least one instrument is required' });
    const total = await saveInstruments(client, req.params.id, instruments);
    const { rows } = await client.query(
      `UPDATE purchase_refunds SET vendor_id=$1, return_id=$2, date=$3, reference=$4, notes=$5, total_amount=$6, unadjusted_amount=$6 WHERE id=$7 RETURNING *`,
      [vendor_id, return_id || null, date, reference || null, notes || null, total, req.params.id]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT rf.*, pr.unadjusted_amount AS return_unadj FROM purchase_refunds rf
       LEFT JOIN purchase_returns pr ON pr.id = rf.return_id WHERE rf.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft refunds can be approved' });
    const rf = rows[0];
    const total = Number(rf.total_amount);

    // Vendor gives us money: DR each instrument (we receive cash), CR A/P (clearing vendor credit)
    const { rows: apRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='accounts_payable' LIMIT 1`);
    if (!apRows.length) return res.status(400).json({ error: 'Accounts Payable account not found' });
    const apChange = apRows[0].normal_balance === 'credit' ? -total : total;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange, apRows[0].id]);

    const { rows: instruments } = await client.query('SELECT * FROM purchase_refund_instruments WHERE refund_id=$1', [rf.id]);
    for (const inst of instruments) {
      if (!inst.account_id) continue;
      const { rows: coa } = await client.query('SELECT normal_balance FROM chart_of_accounts WHERE id=$1', [inst.account_id]);
      if (!coa.length) continue;
      const bankChange = coa[0].normal_balance === 'debit' ? Number(inst.amount) : -Number(inst.amount);
      await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [bankChange, inst.account_id]);
    }

    if (rf.return_id) {
      const newUnadj = Math.max(0, Number(rf.return_unadj || 0) - total);
      const retStatus = newUnadj === 0 ? 'fully_adjusted' : 'partially_adjusted';
      await client.query(`UPDATE purchase_returns SET unadjusted_amount=$1, status=$2 WHERE id=$3`, [newUnadj, retStatus, rf.return_id]);
    }

    const { rows: u } = await client.query(`UPDATE purchase_refunds SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]);
    await client.query('COMMIT');
    res.json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM purchase_refunds WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const rf = rows[0];
    if (!['draft', 'approved'].includes(rf.status)) return res.status(400).json({ error: 'Cannot cancel in current status' });

    if (rf.status === 'approved') {
      const total = Number(rf.total_amount);
      const { rows: apRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='accounts_payable' LIMIT 1`);
      if (apRows.length) {
        const apChange = apRows[0].normal_balance === 'credit' ? total : -total;
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange, apRows[0].id]);
      }
      const { rows: instruments } = await client.query('SELECT * FROM purchase_refund_instruments WHERE refund_id=$1', [rf.id]);
      for (const inst of instruments) {
        if (!inst.account_id) continue;
        const { rows: coa } = await client.query('SELECT normal_balance FROM chart_of_accounts WHERE id=$1', [inst.account_id]);
        if (!coa.length) continue;
        const bankChange = coa[0].normal_balance === 'debit' ? -Number(inst.amount) : Number(inst.amount);
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [bankChange, inst.account_id]);
      }
      if (rf.return_id) {
        const { rows: retRows } = await client.query('SELECT * FROM purchase_returns WHERE id=$1', [rf.return_id]);
        if (retRows.length) {
          const newUnadj = Math.min(Number(retRows[0].net_amount), Number(retRows[0].unadjusted_amount) + total);
          const retStatus = newUnadj >= Number(retRows[0].net_amount) ? 'approved' : 'partially_adjusted';
          await client.query('UPDATE purchase_returns SET unadjusted_amount=$1, status=$2 WHERE id=$3', [newUnadj, retStatus, rf.return_id]);
        }
      }
    }

    const { rows: u } = await client.query(`UPDATE purchase_refunds SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
    await client.query('COMMIT');
    res.json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM purchase_refunds WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft refunds can be deleted' });
    await pool.query('DELETE FROM purchase_refunds WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
