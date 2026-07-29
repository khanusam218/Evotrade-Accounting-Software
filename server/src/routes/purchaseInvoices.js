const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { round2, getOrCreateSeries, safeNextNumber } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function nextNumber(client) {
  const series = await getOrCreateSeries(client, 'Purchase Invoices', 'PI-', 6);
  return safeNextNumber(client, series, 'name', 'Purchase Invoices', 'purchase_invoices', 'number');
}

async function saveLines(client, invoiceId, lines) {
  await client.query('DELETE FROM purchase_invoice_lines WHERE invoice_id=$1', [invoiceId]);
  for (const l of lines) {
    const qty = Number(l.quantity || 1), price = Number(l.unit_price || 0), disc = Number(l.discount_pct || 0);
    const amount = round2(qty * price * (1 - disc / 100));
    const taxAmt = round2(Number(l.tax_amount || 0));
    await client.query(
      `INSERT INTO purchase_invoice_lines (invoice_id, product_id, description, quantity, unit_price, discount_pct, amount, tax_id, tax_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [invoiceId, l.product_id || null, l.description, qty, price, disc, amount, l.tax_id || null, taxAmt]
    );
  }
}

function calcTotals(lines, discount = 0, shipping = 0, roundOff = 0) {
  const gross = round2(lines.reduce((s, l) => s + Number(l.quantity || 1) * Number(l.unit_price || 0) * (1 - Number(l.discount_pct || 0) / 100), 0));
  const tax   = round2(lines.reduce((s, l) => s + Number(l.tax_amount || 0), 0));
  const disc  = round2(Number(discount || 0));
  const ship  = round2(Number(shipping || 0));
  const ro    = round2(Number(roundOff || 0));
  return { gross_amount: gross, tax_amount: tax, discount: disc, shipping_charges: ship, round_off: ro, net_amount: round2(gross - disc + tax + ship + ro) };
}

// GET /next-number
router.get('/next-number', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix || LPAD(GREATEST(
         next_number,
         COALESCE((SELECT MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)) + 1
                   FROM purchase_invoices WHERE number ~ '^PI-[0-9]+$'), 0)
       )::text, padding, '0') AS number FROM number_series WHERE name='Purchase Invoices'`
    );
    res.json(rows[0] || { number: 'PI-000001' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to, vendor_id } = req.query;
    const conds = [], vals = [];
    if (status)    { vals.push(status);        conds.push(`pi.status = $${vals.length}`); }
    if (vendor_id) { vals.push(vendor_id);     conds.push(`pi.vendor_id = $${vals.length}`); }
    if (search)    { vals.push(`%${search}%`); conds.push(`(pi.number ILIKE $${vals.length} OR v.print_name ILIKE $${vals.length} OR pi.reference ILIKE $${vals.length})`); }
    if (date_from) { vals.push(date_from);     conds.push(`pi.date >= $${vals.length}`); }
    if (date_to)   { vals.push(date_to);       conds.push(`pi.date <= $${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT pi.*, v.print_name AS vendor_name,
              (pi.due_date IS NOT NULL AND pi.due_date < CURRENT_DATE AND pi.status IN ('approved','partially_paid')) AS is_overdue
       FROM purchase_invoices pi JOIN vendors v ON v.id = pi.vendor_id
       ${where} ORDER BY pi.date DESC, pi.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pi.*, v.print_name AS vendor_name FROM purchase_invoices pi
       JOIN vendors v ON v.id = pi.vendor_id WHERE pi.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name, t.name AS tax_name, t.rate AS tax_rate
       FROM purchase_invoice_lines l
       LEFT JOIN products p ON p.id = l.product_id LEFT JOIN taxes t ON t.id = l.tax_id
       WHERE l.invoice_id=$1 ORDER BY l.id`, [req.params.id]
    );
    res.json({ ...rows[0], lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { vendor_id, order_id, date, due_date, reference, notes, subject, discount, shipping_charges, round_off, lines = [] } = req.body;
    if (!vendor_id) return res.status(400).json({ error: 'vendor_id is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const t = calcTotals(lines, discount, shipping_charges, round_off);
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO purchase_invoices (number, date, vendor_id, order_id, due_date, reference, notes, subject, gross_amount, tax_amount, discount, shipping_charges, round_off, net_amount, paid_amount, balance_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,0,'draft') RETURNING *`,
      [number, date, vendor_id, order_id || null, due_date || null, reference || null, notes || null, subject || null, t.gross_amount, t.tax_amount, t.discount, t.shipping_charges, t.round_off, t.net_amount]
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
    const { rows: ex } = await client.query('SELECT * FROM purchase_invoices WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Not found' });
    if (ex[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be edited' });
    const { vendor_id, order_id, date, due_date, reference, notes, subject, discount, shipping_charges, round_off, lines = [] } = req.body;
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const t = calcTotals(lines, discount, shipping_charges, round_off);
    const { rows } = await client.query(
      `UPDATE purchase_invoices SET vendor_id=$1, order_id=$2, date=$3, due_date=$4, reference=$5, notes=$6, subject=$7,
       gross_amount=$8, tax_amount=$9, discount=$10, shipping_charges=$11, round_off=$12, net_amount=$13 WHERE id=$14 RETURNING *`,
      [vendor_id, order_id || null, date, due_date || null, reference || null, notes || null, subject || null, t.gross_amount, t.tax_amount, t.discount, t.shipping_charges, t.round_off, t.net_amount, req.params.id]
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
    const { rows } = await client.query('SELECT * FROM purchase_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be approved' });
    const inv = rows[0];
    const net = Number(inv.net_amount);

    const { rows: apRows }  = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsPayable' LIMIT 1`);
    if (!apRows.length) return res.status(400).json({ error: 'Accounts Payable account not found' });
    const { rows: expRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='DefaultCostOfGoodsSold' LIMIT 1`);
    if (!expRows.length) return res.status(400).json({ error: 'No expense account found' });

    // DR expense, CR A/P
    const apChange  = apRows[0].normal_balance  === 'credit' ?  net : -net;
    const expChange = expRows[0].normal_balance === 'debit'  ?  net : -net;
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange,  apRows[0].id]);
    await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [expChange, expRows[0].id]);

    await postJournalEntry(client, {
      date: inv.date, memo: `Purchase Invoice ${inv.number}`, reference: inv.number,
      source_type: 'PurchaseInvoice', source_id: inv.id,
      lines: [
        changeToLine(expRows[0], expChange, `Purchase Invoice ${inv.number}`),
        changeToLine(apRows[0],  apChange,  `Purchase Invoice ${inv.number}`),
      ],
    });

    if (inv.order_id) {
      await client.query(`UPDATE purchase_orders SET status='invoiced' WHERE id=$1 AND status IN ('confirmed','received')`, [inv.order_id]);
    }

    const { rows: u } = await client.query(
      `UPDATE purchase_invoices SET status='approved', balance_amount=$1 WHERE id=$2 RETURNING *`, [net, req.params.id]
    );
    await client.query('COMMIT');
    res.json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM purchase_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const inv = rows[0];
    if (!['draft', 'approved'].includes(inv.status)) return res.status(400).json({ error: 'Cannot cancel in current status' });

    if (inv.status === 'approved') {
      const net = Number(inv.net_amount);
      const { rows: apRows }  = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsPayable' LIMIT 1`);
      const { rows: expRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='DefaultCostOfGoodsSold' LIMIT 1`);
      if (apRows.length && expRows.length) {
        const apChange  = apRows[0].normal_balance  === 'credit' ? -net :  net;
        const expChange = expRows[0].normal_balance === 'debit'  ? -net :  net;
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [apChange,  apRows[0].id]);
        await client.query('UPDATE chart_of_accounts SET current_balance=current_balance+$1 WHERE id=$2', [expChange, expRows[0].id]);
      }
      await reverseJournalEntriesForSource(client, {
        source_type: 'PurchaseInvoice', source_id: inv.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Purchase Invoice ${inv.number}`,
      });
    }

    const { rows: u } = await client.query(`UPDATE purchase_invoices SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]);
    await client.query('COMMIT');
    res.json(u[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM purchase_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be deleted' });
    await pool.query('DELETE FROM purchase_invoices WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
