const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function nextNumber(client) {
  await getOrCreateSeries(client, 'Purchase Returns', 'PR-', 6);
  const r = await client.query(
    `UPDATE number_series SET next_number = next_number + 1
     WHERE name = 'Purchase Returns'
     RETURNING prefix || LPAD((next_number - 1)::text, padding, '0') AS num`
  );
  return r.rows[0].num;
}

async function saveLines(client, returnId, lines) {
  await client.query('DELETE FROM purchase_return_lines WHERE return_id=$1', [returnId]);
  for (const l of lines) {
    const qty = Number(l.quantity || 1), price = Number(l.unit_price || 0), disc = Number(l.discount_pct || 0);
    await client.query(
      `INSERT INTO purchase_return_lines (return_id, product_id, description, quantity, unit_price, discount_pct, amount, tax_id, tax_amount, disposition)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [returnId, l.product_id || null, l.description, qty, price, disc, qty * price * (1 - disc / 100), l.tax_id || null, Number(l.tax_amount || 0), l.disposition || 'return']
    );
  }
}

function calcTotals(lines, discount = 0, shipping = 0) {
  const gross = lines.reduce((s, l) => s + Number(l.quantity || 1) * Number(l.unit_price || 0) * (1 - Number(l.discount_pct || 0) / 100), 0);
  const tax   = lines.reduce((s, l) => s + Number(l.tax_amount || 0), 0);
  const disc  = Number(discount || 0);
  const ship  = Number(shipping || 0);
  return { gross_amount: gross, tax_amount: tax, discount: disc, shipping_charges: ship, net_amount: gross - disc + tax + ship };
}

// GET /next-number
router.get('/next-number', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix || LPAD(GREATEST(
         next_number,
         COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)) + 1
                   FROM purchase_returns WHERE number ~ '^PR-[0-9]+$'), 0)
       )::text, padding, '0') AS number FROM number_series WHERE name='Purchase Returns'`
    );
    res.json(rows[0] || { number: 'PR-000001' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to, vendor_id } = req.query;
    const conds = [], vals = [];
    if (status)    { vals.push(status);        conds.push(`pr.status = $${vals.length}`); }
    if (vendor_id) { vals.push(vendor_id);     conds.push(`pr.vendor_id = $${vals.length}`); }
    if (search)    { vals.push(`%${search}%`); conds.push(`(pr.number ILIKE $${vals.length} OR v.print_name ILIKE $${vals.length} OR pr.reference ILIKE $${vals.length})`); }
    if (date_from) { vals.push(date_from);     conds.push(`pr.date >= $${vals.length}`); }
    if (date_to)   { vals.push(date_to);       conds.push(`pr.date <= $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT pr.*, v.print_name AS vendor_name, pi.number AS invoice_number
       FROM purchase_returns pr JOIN vendors v ON v.id = pr.vendor_id
       LEFT JOIN purchase_invoices pi ON pi.id = pr.invoice_id
       ${where} ORDER BY pr.date DESC, pr.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, v.print_name AS vendor_name, pi.number AS invoice_number
       FROM purchase_returns pr JOIN vendors v ON v.id = pr.vendor_id
       LEFT JOIN purchase_invoices pi ON pi.id = pr.invoice_id
       WHERE pr.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name, t.name AS tax_name, t.rate AS tax_rate
       FROM purchase_return_lines l
       LEFT JOIN products p ON p.id = l.product_id LEFT JOIN taxes t ON t.id = l.tax_id
       WHERE l.return_id=$1 ORDER BY l.id`, [req.params.id]
    );
    res.json({ ...rows[0], lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { vendor_id, invoice_id, date, reference, notes, subject, discount, shipping_charges, lines = [] } = req.body;
    if (!vendor_id) return res.status(400).json({ error: 'vendor_id is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const t = calcTotals(lines, discount, shipping_charges);
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO purchase_returns (number, date, vendor_id, invoice_id, reference, notes, subject, gross_amount, tax_amount, discount, shipping_charges, net_amount, unadjusted_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,'draft') RETURNING *`,
      [number, date, vendor_id, invoice_id || null, reference || null, notes || null, subject || null, t.gross_amount, t.tax_amount, t.discount, t.shipping_charges, t.net_amount]
    );
    await saveLines(client, rows[0].id, lines);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: ex } = await client.query('SELECT * FROM purchase_returns WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (ex[0].status !== 'draft') return res.status(400).json({ error: 'Only draft returns can be edited' });
    const { vendor_id, invoice_id, date, reference, notes, subject, discount, shipping_charges, lines = [] } = req.body;
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const t = calcTotals(lines, discount, shipping_charges);
    const { rows } = await client.query(
      `UPDATE purchase_returns SET vendor_id=$1, invoice_id=$2, date=$3, reference=$4, notes=$5, subject=$6,
       gross_amount=$7, tax_amount=$8, discount=$9, shipping_charges=$10, net_amount=$11, unadjusted_amount=$11 WHERE id=$12 RETURNING *`,
      [vendor_id, invoice_id || null, date, reference || null, notes || null, subject || null, t.gross_amount, t.tax_amount, t.discount, t.shipping_charges, t.net_amount, req.params.id]
    );
    await saveLines(client, req.params.id, lines);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM purchase_returns WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft returns can be approved' });
    const ret = rows[0];
    const net = Number(ret.net_amount);

    // DR A/P (reduce what we owe), CR expense (reverse the cost)
    const { rows: apRows }  = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsPayable' LIMIT 1`);
    if (!apRows.length) return res.status(400).json({ error: 'Accounts Payable account not found' });
    const { rows: expRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='DefaultCostOfGoodsSold' LIMIT 1`);
    if (!expRows.length) return res.status(400).json({ error: 'No expense account found' });

    const apChange  = apRows[0].normal_balance  === 'credit' ? -net :  net;
    const expChange = expRows[0].normal_balance === 'debit'  ? -net :  net;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange,  apRows[0].id]);
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [expChange, expRows[0].id]);

    await postJournalEntry(client, {
      date: ret.date, memo: `Purchase Return ${ret.number}`, reference: ret.number,
      source_type: 'PurchaseReturn', source_id: ret.id,
      lines: [
        changeToLine(apRows[0],  apChange,  `Purchase Return ${ret.number}`),
        changeToLine(expRows[0], expChange, `Purchase Return ${ret.number}`),
      ],
    });

    // Reduce linked invoice balance
    if (ret.invoice_id) {
      await client.query(
        `UPDATE purchase_invoices
         SET balance_amount = GREATEST(0, balance_amount - $1),
             status = CASE WHEN GREATEST(0, balance_amount - $1) = 0 THEN 'paid' ELSE 'partially_paid' END
         WHERE id=$2 AND status IN ('approved','partially_paid')`,
        [net, ret.invoice_id]
      );
    }

    const { rows: u } = await client.query(`UPDATE purchase_returns SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]);
    await client.query('COMMIT');
    res.json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM purchase_returns WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const ret = rows[0];
    if (!['draft', 'approved'].includes(ret.status)) return res.status(400).json({ error: 'Cannot cancel in current status' });

    if (ret.status === 'approved') {
      const net = Number(ret.net_amount);
      const { rows: apRows }  = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsPayable' LIMIT 1`);
      const { rows: expRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='DefaultCostOfGoodsSold' LIMIT 1`);
      if (apRows.length && expRows.length) {
        const apChange  = apRows[0].normal_balance  === 'credit' ?  net : -net;
        const expChange = expRows[0].normal_balance === 'debit'  ?  net : -net;
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange,  apRows[0].id]);
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [expChange, expRows[0].id]);
      }
      await reverseJournalEntriesForSource(client, {
        source_type: 'PurchaseReturn', source_id: ret.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Purchase Return ${ret.number}`,
      });
      if (ret.invoice_id) {
        await client.query(
          `UPDATE purchase_invoices SET balance_amount=balance_amount+$1,
           status=CASE WHEN paid_amount>0 THEN 'partially_paid' ELSE 'approved' END WHERE id=$2`,
          [net, ret.invoice_id]
        );
      }
    }

    const { rows: u } = await client.query(`UPDATE purchase_returns SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
    await client.query('COMMIT');
    res.json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM purchase_returns WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft returns can be deleted' });
    await pool.query('DELETE FROM purchase_returns WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
