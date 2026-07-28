const express = require('express');
const router = express.Router();
const pool = require('../db');
const { round2, getOrCreateSeries } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function nextNumber(client) {
  const { prefix, next_number, padding } = await getOrCreateSeries(client, 'Sales Invoices', 'SI-', 6);
  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)),0) AS max_num
     FROM sales_invoices WHERE number ~ '^SI-[0-9]+$'`
  );
  const useNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
  await client.query(`UPDATE number_series SET next_number=$1 WHERE name='Sales Invoices'`, [useNum + 1]);
  return `${prefix}${String(useNum).padStart(Number(padding), '0')}`;
}

async function saveLines(client, invoiceId, lines) {
  await client.query('DELETE FROM sales_invoice_lines WHERE invoice_id = $1', [invoiceId]);
  for (const l of lines) {
    const qty = Number(l.quantity || 1);
    const price = Number(l.unit_price || 0);
    const disc = Number(l.discount_pct || 0);
    const amount = round2(qty * price * (1 - disc / 100));
    const taxAmt = round2(Number(l.tax_amount || 0));
    await client.query(
      `INSERT INTO sales_invoice_lines (invoice_id, product_id, description, quantity, unit_price, discount_pct, amount, tax_id, tax_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [invoiceId, l.product_id || null, l.description, qty, price, disc, amount, l.tax_id || null, taxAmt]
    );
  }
}

function calcTotals(lines, discPct = 0, shippingCharges = 0, roundOff = 0) {
  const gross = round2(lines.reduce((s, l) => {
    const qty = Number(l.quantity || 1);
    const price = Number(l.unit_price || 0);
    const disc = Number(l.discount_pct || 0);
    return s + qty * price * (1 - disc / 100);
  }, 0));
  const taxAmount = round2(lines.reduce((s, l) => s + Number(l.tax_amount || 0), 0));
  const discAmount = round2(gross * Number(discPct || 0) / 100);
  const shipping = round2(Number(shippingCharges || 0));
  const roundOffAmt = round2(Number(roundOff || 0));
  return {
    gross_amount: gross,
    tax_amount: taxAmount,
    discount_pct: Number(discPct || 0),
    discount: discAmount,
    shipping_charges: shipping,
    round_off: roundOffAmt,
    net_amount: round2(gross - discAmount + taxAmount + shipping + roundOffAmt),
  };
}

// GET /next-number (preview)
router.get('/next-number', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number, padding FROM number_series WHERE name='Sales Invoices'`
    );
    if (!rows.length) return res.json({ number: 'SI-000001' });
    const { prefix, next_number, padding } = rows[0];
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number,'[^0-9]','','g') AS INTEGER)),0) AS max_num
       FROM sales_invoices WHERE number ~ '^SI-[0-9]+$'`
    );
    const preview = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
    res.json({ number: `${prefix}${String(preview).padStart(Number(padding), '0')}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /
router.get('/', async (req, res) => {
  try {
    const { status, search, date_from, date_to, customer_id } = req.query;
    const conds = [], vals = [];
    if (status)      { vals.push(status);        conds.push(`si.status=$${vals.length}`); }
    if (search)      { vals.push(`%${search}%`); conds.push(`(si.number ILIKE $${vals.length} OR c.print_name ILIKE $${vals.length} OR si.reference ILIKE $${vals.length})`); }
    if (date_from)   { vals.push(date_from);     conds.push(`si.date>=$${vals.length}`); }
    if (date_to)     { vals.push(date_to);       conds.push(`si.date<=$${vals.length}`); }
    if (customer_id) { vals.push(customer_id);   conds.push(`si.customer_id=$${vals.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT si.*, c.print_name AS customer_name,
         (si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE AND si.status IN ('approved','partially_paid')) AS is_overdue
       FROM sales_invoices si
       JOIN customers c ON c.id=si.customer_id
       ${where} ORDER BY si.date DESC, si.id DESC`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT si.*, c.print_name AS customer_name,
         c.address_line_1 AS customer_address_line_1,
         c.address_line_2 AS customer_address_line_2,
         c.city AS customer_city,
         c.state_province AS customer_state_province,
         c.country AS customer_country,
         c.zip_code AS customer_zip_code,
         (si.due_date IS NOT NULL AND si.due_date < CURRENT_DATE AND si.status IN ('approved','partially_paid')) AS is_overdue
       FROM sales_invoices si
       JOIN customers c ON c.id=si.customer_id WHERE si.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name, t.name AS tax_name, t.rate AS tax_rate
       FROM sales_invoice_lines l
       LEFT JOIN products p ON p.id=l.product_id
       LEFT JOIN taxes t ON t.id=l.tax_id
       WHERE l.invoice_id=$1 ORDER BY l.id`, [req.params.id]
    );
    res.json({ ...rows[0], lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, date, due_date, order_id, quotation_id, reference, subject, notes, discount_pct, shipping_charges, round_off, shipping_address, lines = [] } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const totals = calcTotals(lines, discount_pct, shipping_charges, round_off);
    const number = await nextNumber(client);
    const { rows } = await client.query(
      `INSERT INTO sales_invoices
         (number, date, due_date, customer_id, order_id, reference, subject, notes, shipping_address,
          gross_amount, tax_amount, discount_pct, discount, shipping_charges, round_off, net_amount,
          paid_amount, balance_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,0,$16,'draft') RETURNING *`,
      [number, date, due_date || null, customer_id, order_id || null, reference || null,
       subject || null, notes || null, shipping_address || null,
       totals.gross_amount, totals.tax_amount, totals.discount_pct, totals.discount,
       totals.shipping_charges, totals.round_off, totals.net_amount]
    );
    if (quotation_id && !order_id) {
      await client.query(`UPDATE sales_quotations SET status='converted' WHERE id=$1`, [quotation_id]);
    }
    await saveLines(client, rows[0].id, lines);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
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
    const { rows: existing } = await client.query('SELECT * FROM sales_invoices WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (existing[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be edited' });
    const { customer_id, date, due_date, order_id, reference, subject, notes, discount_pct, shipping_charges, round_off, shipping_address, lines = [] } = req.body;
    if (!lines.length) return res.status(400).json({ error: 'At least one line is required' });
    const totals = calcTotals(lines, discount_pct, shipping_charges, round_off);
    const { rows } = await client.query(
      `UPDATE sales_invoices SET
         customer_id=$1, date=$2, due_date=$3, order_id=$4, reference=$5, subject=$6, notes=$7,
         shipping_address=$8,
         gross_amount=$9, tax_amount=$10, discount_pct=$11, discount=$12,
         shipping_charges=$13, round_off=$14, net_amount=$15, balance_amount=$15
       WHERE id=$16 RETURNING *`,
      [customer_id, date, due_date || null, order_id || null, reference || null,
       subject || null, notes || null, shipping_address || null,
       totals.gross_amount, totals.tax_amount, totals.discount_pct, totals.discount,
       totals.shipping_charges, totals.round_off, totals.net_amount, req.params.id]
    );
    await saveLines(client, req.params.id, lines);
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
    const { rows } = await client.query('SELECT * FROM sales_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be approved' });
    const inv = rows[0];
    const net = Number(inv.net_amount);

    const { rows: arRows } = await client.query(
      `SELECT coa.* FROM chart_of_accounts coa WHERE coa.system_name = 'AccountsReceivable' LIMIT 1`
    );
    if (!arRows.length) return res.status(400).json({ error: 'Accounts Receivable account not found' });
    const arCoa = arRows[0];

    const { rows: revRows } = await client.query(
      `SELECT * FROM chart_of_accounts WHERE system_name = 'DefaultSales' LIMIT 1`
    );
    if (!revRows.length) return res.status(400).json({ error: 'No revenue account found' });
    const revCoa = revRows[0];

    const arChange  = arCoa.normal_balance  === 'debit'  ?  net : -net;
    const revChange = revCoa.normal_balance === 'credit' ?  net : -net;

    await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [arChange,  arCoa.id]);
    await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [revChange, revCoa.id]);

    await postJournalEntry(client, {
      date: inv.date, memo: `Sales Invoice ${inv.number}`, reference: inv.number,
      source_type: 'SalesInvoice', source_id: inv.id,
      lines: [
        changeToLine(arCoa,  arChange,  `Sales Invoice ${inv.number}`),
        changeToLine(revCoa, revChange, `Sales Invoice ${inv.number}`),
      ],
    });

    const { rows: updated } = await client.query(
      `UPDATE sales_invoices SET status='approved' WHERE id=$1 RETURNING *`, [req.params.id]
    );
    if (inv.order_id) {
      await client.query(`UPDATE sales_orders SET status='invoiced' WHERE id=$1`, [inv.order_id]);
    }
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
    const { rows } = await client.query('SELECT * FROM sales_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const inv = rows[0];
    if (!['draft', 'approved'].includes(inv.status)) return res.status(400).json({ error: 'Cannot cancel in current status' });

    if (inv.status === 'approved') {
      const net = Number(inv.net_amount);
      const { rows: arRows } = await client.query(
        `SELECT * FROM chart_of_accounts WHERE system_name = 'AccountsReceivable' LIMIT 1`
      );
      const { rows: revRows } = await client.query(
        `SELECT * FROM chart_of_accounts WHERE system_name = 'DefaultSales' LIMIT 1`
      );
      if (arRows.length && revRows.length) {
        const arChange  = arRows[0].normal_balance  === 'debit'  ? -net :  net;
        const revChange = revRows[0].normal_balance === 'credit' ? -net :  net;
        await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [arChange,  arRows[0].id]);
        await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [revChange, revRows[0].id]);
      }
      await reverseJournalEntriesForSource(client, {
        source_type: 'SalesInvoice', source_id: inv.id,
        date: new Date().toISOString().slice(0, 10), memo: `Cancel Sales Invoice ${inv.number}`,
      });
      if (inv.order_id) {
        await client.query(`UPDATE sales_orders SET status='delivered' WHERE id=$1 AND status='invoiced'`, [inv.order_id]);
      }
    }
    const { rows: updated } = await client.query(
      `UPDATE sales_invoices SET status='cancelled' WHERE id=$1 RETURNING *`, [req.params.id]
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
    const { rows } = await pool.query('SELECT status FROM sales_invoices WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be deleted' });
    await pool.query('DELETE FROM sales_invoices WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
