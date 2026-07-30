const express = require('express');
const router = express.Router();
const pool = require('../db');

// Trial Balance
router.get('/trial-balance', async (req, res) => {
  try {
    const { date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT coa.code, coa.name, coa.account_type,
             COALESCE(SUM(jel.debit), 0)  AS total_debit,
             COALESCE(SUM(jel.credit), 0) AS total_credit,
             COALESCE(SUM(jel.debit - jel.credit), 0) AS balance
      FROM chart_of_accounts coa
      LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
        AND je.status = 'posted' AND je.date <= $1
      WHERE coa.is_parent = false
      GROUP BY coa.id, coa.code, coa.name, coa.account_type
      HAVING COALESCE(SUM(jel.debit), 0) <> 0 OR COALESCE(SUM(jel.credit), 0) <> 0
      ORDER BY coa.code
    `, [date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Profit & Loss
router.get('/profit-loss', async (req, res) => {
  try {
    const {
      date_from = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      date_to = new Date().toISOString().split('T')[0]
    } = req.query;
    // No seeded account ever carries account_type='cost_of_goods_sold' — every
    // COGS account is really account_type='expense', distinguished only by
    // system_name='DefaultCostOfGoodsSold' (the same account every purchase
    // posting already debits). Bucket on that instead of the nonexistent type.
    const { rows } = await pool.query(`
      SELECT
        CASE WHEN coa.system_name = 'DefaultCostOfGoodsSold' THEN 'cost_of_goods_sold' ELSE coa.account_type END AS bucket,
        COALESCE(SUM(jel.credit - jel.debit), 0) AS amount
      FROM chart_of_accounts coa
      JOIN journal_entry_lines jel ON jel.account_id = coa.id
      JOIN journal_entries je ON je.id = jel.journal_entry_id
        AND je.status = 'posted' AND je.date BETWEEN $1 AND $2
      WHERE coa.account_type IN ('revenue','expense')
      GROUP BY bucket
    `, [date_from, date_to]);

    const byType = {};
    rows.forEach(r => { byType[r.bucket] = Number(r.amount); });
    const revenue = byType['revenue'] || 0;
    const cogs = -(byType['cost_of_goods_sold'] || 0);
    const expenses = -(byType['expense'] || 0);
    const gross_profit = revenue - cogs;
    const net_profit = gross_profit - expenses;

    const { rows: detail } = await pool.query(`
      SELECT
        CASE WHEN coa.system_name = 'DefaultCostOfGoodsSold' THEN 'cost_of_goods_sold' ELSE coa.account_type END AS account_type,
        coa.code, coa.name,
        COALESCE(SUM(jel.credit - jel.debit), 0) AS amount
      FROM chart_of_accounts coa
      JOIN journal_entry_lines jel ON jel.account_id = coa.id
      JOIN journal_entries je ON je.id = jel.journal_entry_id
        AND je.status = 'posted' AND je.date BETWEEN $1 AND $2
      WHERE coa.account_type IN ('revenue','expense')
        AND coa.is_parent = false
      GROUP BY coa.id, account_type, coa.code, coa.name
      HAVING COALESCE(SUM(jel.credit - jel.debit), 0) <> 0
      ORDER BY account_type, coa.code
    `, [date_from, date_to]);

    res.json({ summary: { revenue, cogs, gross_profit, expenses, net_profit }, detail });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// A/R Aging Detail
router.get('/ar-aging', async (req, res) => {
  try {
    const { as_of = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT si.number, si.date, si.due_date, si.net_amount, si.balance_amount,
             c.print_name AS customer_name,
             ($1::date - si.due_date) AS days_overdue
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status IN ('approved','partially_paid') AND si.balance_amount > 0
        AND si.date <= $1
      ORDER BY days_overdue DESC, c.print_name
    `, [as_of]);

    // A customer's Opening Balance predates any invoice history, so it has no
    // due date to age against — it's carried as a synthetic "current" row.
    const { rows: openingRows } = await pool.query(`
      SELECT print_name AS customer_name, opening_balance FROM customers WHERE COALESCE(opening_balance,0) <> 0
    `);
    for (const o of openingRows) {
      rows.push({
        number: 'Opening Balance', date: null, due_date: null,
        net_amount: o.opening_balance, balance_amount: o.opening_balance,
        customer_name: o.customer_name, days_overdue: 0,
      });
    }

    const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, over_90: 0, total: 0 };
    rows.forEach(r => {
      const d = Number(r.days_overdue);
      const b = Number(r.balance_amount);
      buckets.total += b;
      if (d <= 0) buckets.current += b;
      else if (d <= 30) buckets.days_1_30 += b;
      else if (d <= 60) buckets.days_31_60 += b;
      else if (d <= 90) buckets.days_61_90 += b;
      else buckets.over_90 += b;
    });

    res.json({ invoices: rows, buckets });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// A/P Aging Detail
router.get('/ap-aging', async (req, res) => {
  try {
    const { as_of = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT pi.number, pi.date, pi.due_date, pi.net_amount, pi.balance_amount,
             v.print_name AS vendor_name,
             ($1::date - pi.due_date) AS days_overdue
      FROM purchase_invoices pi
      JOIN vendors v ON v.id = pi.vendor_id
      WHERE pi.status IN ('approved','partially_paid') AND pi.balance_amount > 0
        AND pi.date <= $1
      ORDER BY days_overdue DESC, v.print_name
    `, [as_of]);

    // A vendor's Opening Balance predates any invoice history, so it has no
    // due date to age against — it's carried as a synthetic "current" row.
    const { rows: openingRows } = await pool.query(`
      SELECT print_name AS vendor_name, opening_balance FROM vendors WHERE COALESCE(opening_balance,0) <> 0
    `);
    for (const o of openingRows) {
      rows.push({
        number: 'Opening Balance', date: null, due_date: null,
        net_amount: o.opening_balance, balance_amount: o.opening_balance,
        vendor_name: o.vendor_name, days_overdue: 0,
      });
    }

    const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, over_90: 0, total: 0 };
    rows.forEach(r => {
      const d = Number(r.days_overdue);
      const b = Number(r.balance_amount);
      buckets.total += b;
      if (d <= 0) buckets.current += b;
      else if (d <= 30) buckets.days_1_30 += b;
      else if (d <= 60) buckets.days_31_60 += b;
      else if (d <= 90) buckets.days_61_90 += b;
      else buckets.over_90 += b;
    });

    res.json({ invoices: rows, buckets });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sales Summary by customer / product
router.get('/sales-summary', async (req, res) => {
  try {
    const {
      date_from = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      date_to = new Date().toISOString().split('T')[0],
      group_by = 'customer'
    } = req.query;

    if (group_by === 'product') {
      const { rows } = await pool.query(`
        SELECT p.name AS product_name, p.code AS product_code,
               SUM(sil.quantity) AS total_qty,
               SUM(sil.amount) AS total_amount
        FROM sales_invoice_lines sil
        JOIN products p ON p.id = sil.product_id
        JOIN sales_invoices si ON si.id = sil.invoice_id
        WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
        GROUP BY p.id, p.name, p.code
        ORDER BY total_amount DESC
      `, [date_from, date_to]);
      return res.json(rows);
    }

    const { rows } = await pool.query(`
      SELECT c.print_name AS customer_name, c.code AS customer_code,
             COUNT(si.id) AS invoice_count,
             SUM(si.net_amount) AS total_amount,
             SUM(si.net_amount - si.balance_amount) AS collected
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      GROUP BY c.id, c.print_name, c.code
      ORDER BY total_amount DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Purchase Summary
router.get('/purchase-summary', async (req, res) => {
  try {
    const {
      date_from = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      date_to = new Date().toISOString().split('T')[0]
    } = req.query;

    const { rows } = await pool.query(`
      SELECT v.print_name AS vendor_name, v.code AS vendor_code,
             COUNT(pi.id) AS invoice_count,
             SUM(pi.net_amount) AS total_amount,
             SUM(pi.net_amount - pi.balance_amount) AS paid
      FROM purchase_invoices pi
      JOIN vendors v ON v.id = pi.vendor_id
      WHERE pi.status NOT IN ('cancelled','draft') AND pi.date BETWEEN $1 AND $2
      GROUP BY v.id, v.print_name, v.code
      ORDER BY total_amount DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Stock report
router.get('/stock', async (req, res) => {
  try {
    const { warehouse_id, search } = req.query;
    let q = `
      SELECT p.code, p.name AS product_name, p.unit_of_measurement AS unit, w.name AS warehouse_name,
             ps.qty_on_hand, p.purchase_price AS unit_cost,
             ps.qty_on_hand * p.purchase_price AS stock_value
      FROM product_stock ps
      JOIN products p ON p.id = ps.product_id
      JOIN warehouses w ON w.id = ps.warehouse_id
      WHERE 1=1
    `;
    const params = [];
    if (warehouse_id) { params.push(warehouse_id); q += ` AND ps.warehouse_id=$${params.length}`; }
    if (search)       { params.push(`%${search}%`); q += ` AND (p.name ILIKE $${params.length} OR p.code ILIKE $${params.length})`; }
    q += ' ORDER BY p.name, w.name';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer Ledger
router.get('/customer-ledger', async (req, res) => {
  try {
    const { customer_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT si.number AS doc_number, si.date, si.net_amount AS amount, 'Sales Invoice' AS doc_type,
             c.print_name AS contact_name
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (customer_id) { params.push(customer_id); q += ` AND si.customer_id=$${params.length}`; }
    q += ' ORDER BY si.date DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer Balance Report
router.get('/customer-balance', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.code, c.print_name AS customer_name,
             COALESCE(c.opening_balance, 0) + COALESCE(SUM(si.balance_amount), 0) AS balance
      FROM customers c
      LEFT JOIN sales_invoices si ON si.customer_id = c.id AND si.status IN ('approved','partially_paid')
      GROUP BY c.id, c.code, c.print_name, c.opening_balance
      ORDER BY c.print_name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Vendor Balance Report
router.get('/vendor-balance', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.id, v.code, v.print_name AS vendor_name,
             COALESCE(v.opening_balance, 0) + COALESCE(SUM(pi.balance_amount), 0) AS balance
      FROM vendors v
      LEFT JOIN purchase_invoices pi ON pi.vendor_id = v.id AND pi.status IN ('approved','partially_paid')
      GROUP BY v.id, v.code, v.print_name, v.opening_balance
      ORDER BY v.print_name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sale Invoice Report
router.get('/sale-invoice', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT si.number, si.date, si.net_amount, si.status, c.print_name AS customer_name
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.date BETWEEN $1 AND $2
      ORDER BY si.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Purchase Invoice Report
router.get('/purchase-invoice', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT pi.number, pi.date, pi.net_amount, pi.status, v.print_name AS vendor_name
      FROM purchase_invoices pi
      JOIN vendors v ON v.id = pi.vendor_id
      WHERE pi.date BETWEEN $1 AND $2
      ORDER BY pi.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Expense Report
router.get('/expense-report', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT e.date, e.comments, e.gross_amount, ba.name AS bank_name
      FROM expenses e
      JOIN bank_accounts ba ON ba.id = e.bank_account_id
      WHERE e.date BETWEEN $1 AND $2
      ORDER BY e.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Account Ledger
router.get('/account-ledger', async (req, res) => {
  try {
    const { account_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT je.date, je.memo, jel.debit, jel.credit, coa.name AS account_name
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
      JOIN chart_of_accounts coa ON coa.id = jel.account_id
      WHERE je.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (account_id) { params.push(account_id); q += ` AND jel.account_id=$${params.length}`; }
    q += ' ORDER BY je.date, je.id';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Credit Note Report
router.get('/credit-note-report', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT cn.number, cn.date, cn.amount, cn.contact_name, cn.status
      FROM credit_notes cn
      WHERE cn.date BETWEEN $1 AND $2
      ORDER BY cn.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Debit Note Report
router.get('/debit-note-report', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT dn.number, dn.date, dn.amount, dn.contact_name, dn.status
      FROM debit_notes dn
      WHERE dn.date BETWEEN $1 AND $2
      ORDER BY dn.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Due Invoice Report
router.get('/due-invoice', async (req, res) => {
  try {
    const { as_of = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT si.number, si.date, si.due_date, si.net_amount, si.balance_amount,
             c.print_name AS customer_name, ($1::date - si.due_date) AS days_overdue
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status IN ('approved','partially_paid') AND si.balance_amount > 0
        AND si.due_date < $1
      ORDER BY days_overdue DESC
    `, [as_of]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Stock Adjustment Report
router.get('/stock-adjustment-report', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sa.date, sa.number, at.name AS adjustment_type, sal.new_qty - sal.current_qty AS quantity,
             sal.notes, p.name AS product_name, w.name AS warehouse_name
      FROM stock_adjustments sa
      JOIN stock_adjustment_lines sal ON sal.adjustment_id = sa.id
      JOIN products p ON p.id = sal.product_id
      JOIN warehouses w ON w.id = sa.warehouse_id
      LEFT JOIN adjustment_types at ON at.id = sa.adjustment_type_id
      WHERE sa.date BETWEEN $1 AND $2
      ORDER BY sa.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Stock Movement Report
router.get('/stock-movement-report', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sm.number, sm.date, sm.reference, sm.status,
             fw.name AS from_warehouse, tw.name AS to_warehouse
      FROM stock_movements sm
      LEFT JOIN warehouses fw ON fw.id = sm.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = sm.to_warehouse_id
      WHERE sm.date BETWEEN $1 AND $2
      ORDER BY sm.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sales by Month
router.get('/sales-by-month', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT TO_CHAR(date_trunc('month', si.date), 'YYYY-MM') AS month,
             COUNT(si.id) AS invoice_count,
             SUM(si.net_amount) AS total_amount
      FROM sales_invoices si
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      GROUP BY date_trunc('month', si.date)
      ORDER BY month
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Product Sales History Report
router.get('/product-sales-history', async (req, res) => {
  try {
    const { product_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT p.name AS product_name, sil.quantity, sil.amount, si.date, si.number AS invoice_number
      FROM sales_invoice_lines sil
      JOIN products p ON p.id = sil.product_id
      JOIN sales_invoices si ON si.id = sil.invoice_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (product_id) { params.push(product_id); q += ` AND sil.product_id=$${params.length}`; }
    q += ' ORDER BY si.date DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Employee Report
router.get('/employee-report', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.code, e.name, e.email, e.phone, e.salary, e.join_date,
             d.name AS department, des.name AS designation
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      WHERE e.is_active = true
      ORDER BY e.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Customer Loyalty Program Ledger ──────────────────────────────────────────
router.get('/cust-loyalty', async (req, res) => {
  try {
    const { customer_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT si.number, si.date, si.net_amount, si.balance_amount, c.print_name AS customer_name
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (customer_id) { params.push(customer_id); q += ` AND si.customer_id=$${params.length}`; }
    q += ' ORDER BY si.date DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Customer Balance Detail Report ───────────────────────────────────────────
router.get('/cust-bal-detail', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.code, c.print_name AS customer_name,
             COALESCE(SUM(si.net_amount), 0) AS total_invoiced,
             COALESCE(SUM(si.paid_amount), 0) AS total_paid,
             COALESCE(SUM(si.balance_amount), 0) AS outstanding
      FROM customers c
      LEFT JOIN sales_invoices si ON si.customer_id = c.id AND si.status IN ('approved','partially_paid')
      GROUP BY c.id, c.code, c.print_name
      ORDER BY c.print_name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sale Order Un-delivered Detail Report ────────────────────────────────────
router.get('/so-undelivered', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT so.number, so.date, so.delivery_date, c.print_name AS customer_name,
             so.net_amount, so.status
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      WHERE so.status NOT IN ('cancelled','delivered') AND so.status IN ('confirmed')
      ORDER BY so.date DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Customer Sales Analysis Report ───────────────────────────────────────────
router.get('/cust-sales-analysis', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT c.print_name AS customer_name, c.code AS customer_code,
             COUNT(si.id) AS invoice_count,
             SUM(si.net_amount) AS total_sales,
             AVG(si.net_amount) AS avg_invoice_amount,
             SUM(si.net_amount - si.balance_amount) AS total_collected
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      GROUP BY c.id, c.print_name, c.code
      ORDER BY total_sales DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sales Target and Commissions ─────────────────────────────────────────────
router.get('/sales-target', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sp.name AS sales_person_name,
             COUNT(si.id) AS invoice_count,
             SUM(si.net_amount) AS total_sales,
             SUM(si.net_amount) * 0.05 AS estimated_commission
      FROM sales_invoices si
      JOIN sales_persons sp ON 1=1
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      GROUP BY sp.id, sp.name
      ORDER BY total_sales DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Customer Refund Report ───────────────────────────────────────────────────
router.get('/cust-refund', async (req, res) => {
  try {
    const { customer_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT sr.number, sr.date, sr.total_amount, sr.status, c.print_name AS customer_name
      FROM sales_refunds sr
      JOIN customers c ON c.id = sr.customer_id
      WHERE sr.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (customer_id) { params.push(customer_id); q += ` AND sr.customer_id=$${params.length}`; }
    q += ' ORDER BY sr.date DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Product Sales Category Report ────────────────────────────────────────────
router.get('/prod-sales-cat', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT pc.name AS category_name, p.name AS product_name,
             SUM(sil.quantity) AS total_qty,
             SUM(sil.amount) AS total_amount,
             AVG(sil.amount / NULLIF(sil.quantity, 0)) AS avg_unit_price
      FROM sales_invoice_lines sil
      JOIN products p ON p.id = sil.product_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      JOIN sales_invoices si ON si.id = sil.invoice_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      GROUP BY pc.id, pc.name, p.id, p.name
      ORDER BY pc.name, total_amount DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sale Delivery Report ─────────────────────────────────────────────────────
router.get('/sale-delivery', async (req, res) => {
  try {
    const { customer_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT sd.number, sd.date, c.print_name AS customer_name, sd.status, sd.reference
      FROM sales_deliveries sd
      JOIN customers c ON c.id = sd.customer_id
      WHERE sd.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (customer_id) { params.push(customer_id); q += ` AND sd.customer_id=$${params.length}`; }
    q += ' ORDER BY sd.date DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sale Return Report ───────────────────────────────────────────────────────
router.get('/sale-return', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sr.number, sr.date, sr.net_amount, sr.status, c.print_name AS customer_name
      FROM sales_returns sr
      JOIN customers c ON c.id = sr.customer_id
      WHERE sr.date BETWEEN $1 AND $2
      ORDER BY sr.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sale Return Detail Report ────────────────────────────────────────────────
router.get('/sale-return-detail', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sr.number AS return_number, sr.date, c.print_name AS customer_name,
             srl.product_id, p.name AS product_name, srl.quantity, srl.unit_price, srl.amount, srl.disposition
      FROM sales_return_lines srl
      JOIN sales_returns sr ON sr.id = srl.return_id
      JOIN customers c ON c.id = sr.customer_id
      JOIN products p ON p.id = srl.product_id
      WHERE sr.date BETWEEN $1 AND $2
      ORDER BY sr.date DESC, sr.number
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sale Invoice Detail Report ───────────────────────────────────────────────
router.get('/sale-invoice-detail', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT si.number AS invoice_number, si.date, c.print_name AS customer_name,
             sil.product_id, p.name AS product_name, sil.quantity, sil.unit_price, sil.amount, sil.discount_pct
      FROM sales_invoice_lines sil
      JOIN sales_invoices si ON si.id = sil.invoice_id
      JOIN customers c ON c.id = si.customer_id
      JOIN products p ON p.id = sil.product_id
      WHERE si.date BETWEEN $1 AND $2
      ORDER BY si.date DESC, si.number
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Product Sale Customer-Wise Report ────────────────────────────────────────
router.get('/prod-sale-cust', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT p.name AS product_name, p.code AS product_code,
             c.print_name AS customer_name,
             SUM(sil.quantity) AS total_qty,
             SUM(sil.amount) AS total_amount
      FROM sales_invoice_lines sil
      JOIN products p ON p.id = sil.product_id
      JOIN sales_invoices si ON si.id = sil.invoice_id
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      GROUP BY p.id, p.name, p.code, c.id, c.print_name
      ORDER BY p.name, total_amount DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sale Order Detail Report ─────────────────────────────────────────────────
router.get('/so-detail', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT so.number AS order_number, so.date, c.print_name AS customer_name,
             sol.product_id, p.name AS product_name, sol.quantity, sol.unit_price, sol.amount
      FROM sales_order_lines sol
      JOIN sales_orders so ON so.id = sol.order_id
      JOIN customers c ON c.id = so.customer_id
      JOIN products p ON p.id = sol.product_id
      WHERE so.date BETWEEN $1 AND $2
      ORDER BY so.date DESC, so.number
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sale Order Report ────────────────────────────────────────────────────────
router.get('/sale-order', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT so.number, so.date, so.net_amount, so.status, c.print_name AS customer_name
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      WHERE so.date BETWEEN $1 AND $2
      ORDER BY so.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Product Profit Report ────────────────────────────────────────────────────
router.get('/prod-profit', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT p.name AS product_name, p.code AS product_code,
             SUM(sil.quantity) AS total_qty,
             SUM(sil.amount) AS sale_amount,
             SUM(sil.quantity * p.purchase_price) AS cost_amount,
             SUM(sil.amount - (sil.quantity * p.purchase_price)) AS profit_amount
      FROM sales_invoice_lines sil
      JOIN products p ON p.id = sil.product_id
      JOIN sales_invoices si ON si.id = sil.invoice_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      GROUP BY p.id, p.name, p.code
      ORDER BY profit_amount DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Lead Fees Report ─────────────────────────────────────────────────────────
router.get('/lead-fees', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT so.number AS order_number, so.date, c.print_name AS customer_name,
             so.net_amount, so.status
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      WHERE so.date BETWEEN $1 AND $2
      ORDER BY so.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Product Rate Report ──────────────────────────────────────────────────────
router.get('/prod-rate', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.code, p.name AS product_name, p.sale_price, p.purchase_price, p.mrp,
             pc.name AS category_name, b.name AS brand_name
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.is_active = true
      ORDER BY p.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sale Invoice Return Person Report ────────────────────────────────────────
router.get('/invoice-return-sp', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sr.number, sr.date, sr.net_amount, c.print_name AS customer_name, sr.status
      FROM sales_returns sr
      JOIN customers c ON c.id = sr.customer_id
      WHERE sr.date BETWEEN $1 AND $2
      ORDER BY sr.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sales Performance by Sales Person Report ─────────────────────────────────
router.get('/sales-perf-sp', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sp.name AS sales_person_name,
             COUNT(si.id) AS invoice_count,
             SUM(si.net_amount) AS total_sales,
             AVG(si.net_amount) AS avg_invoice_amount
      FROM sales_invoices si
      JOIN sales_persons sp ON 1=1
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      GROUP BY sp.id, sp.name
      ORDER BY total_sales DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Customer Ledger (Bulk) Report ────────────────────────────────────────────
router.get('/cust-ledger-bulk', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT c.print_name AS customer_name, si.number AS doc_number, si.date,
             si.net_amount AS amount, 'Sales Invoice' AS doc_type, si.status
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      ORDER BY c.print_name, si.date
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Discount Summary Report ──────────────────────────────────────────────────
router.get('/discount-summary', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT si.number, si.date, si.discount, si.discount_pct, si.net_amount,
             c.print_name AS customer_name
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
        AND si.discount > 0
      ORDER BY si.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sale Invoice Detail Report (Ungrouped) ───────────────────────────────────
router.get('/si-detail-ug', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT si.number AS invoice_number, si.date, c.print_name AS customer_name,
             p.name AS product_name, sil.quantity, sil.unit_price, sil.amount,
             sil.discount_pct, sil.tax_amount
      FROM sales_invoice_lines sil
      JOIN sales_invoices si ON si.id = sil.invoice_id
      JOIN customers c ON c.id = si.customer_id
      JOIN products p ON p.id = sil.product_id
      WHERE si.date BETWEEN $1 AND $2
      ORDER BY si.date DESC, si.number, p.name
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sale Return Detail Report (Ungrouped) ────────────────────────────────────
router.get('/sr-detail-ug', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sr.number AS return_number, sr.date, c.print_name AS customer_name,
             p.name AS product_name, srl.quantity, srl.unit_price, srl.amount, srl.disposition
      FROM sales_return_lines srl
      JOIN sales_returns sr ON sr.id = srl.return_id
      JOIN customers c ON c.id = sr.customer_id
      JOIN products p ON p.id = srl.product_id
      WHERE sr.date BETWEEN $1 AND $2
      ORDER BY sr.date DESC, sr.number, p.name
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Invoice Wise Profit Report ───────────────────────────────────────────────
router.get('/invoice-profit', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT si.number AS invoice_number, si.date, c.print_name AS customer_name,
             si.net_amount AS invoice_total,
             SUM(sil.quantity * p.purchase_price) AS total_cost,
             si.net_amount - SUM(sil.quantity * p.purchase_price) AS profit,
             CASE WHEN si.net_amount > 0
               THEN ROUND(((si.net_amount - SUM(sil.quantity * p.purchase_price)) / si.net_amount * 100)::numeric, 2)
               ELSE 0
             END AS profit_pct
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      JOIN sales_invoice_lines sil ON sil.invoice_id = si.id
      JOIN products p ON p.id = sil.product_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      GROUP BY si.id, si.number, si.date, c.print_name, si.net_amount
      ORDER BY si.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Negative Payment Report ──────────────────────────────────────────────────
router.get('/neg-payment', async (req, res) => {
  try {
    const { customer_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT rp.number, rp.date, rp.total_amount, rp.unadjusted_amount, rp.status,
             c.print_name AS customer_name
      FROM receive_payments rp
      JOIN customers c ON c.id = rp.customer_id
      WHERE rp.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (customer_id) { params.push(customer_id); q += ` AND rp.customer_id=$${params.length}`; }
    q += ' ORDER BY rp.date DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Negative Payment Detail Report ───────────────────────────────────────────
router.get('/neg-payment-detail', async (req, res) => {
  try {
    const { customer_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT rp.number, rp.date, rp.total_amount, rp.unadjusted_amount, rp.status,
             c.print_name AS customer_name,
             rpi.payment_mode, rpi.amount AS instrument_amount
      FROM receive_payments rp
      JOIN customers c ON c.id = rp.customer_id
      LEFT JOIN rp_instruments rpi ON rpi.payment_id = rp.id
      WHERE rp.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (customer_id) { params.push(customer_id); q += ` AND rp.customer_id=$${params.length}`; }
    q += ' ORDER BY rp.date DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Negative Payment Detail Report (Ungrouped) ───────────────────────────────
router.get('/neg-payment-ug', async (req, res) => {
  try {
    const { customer_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT rp.number, rp.date, rp.total_amount, c.print_name AS customer_name,
             rpi.payment_mode, rpi.amount AS instrument_amount,
             rpa.invoice_id, rpa.amount AS allocated_amount
      FROM receive_payments rp
      JOIN customers c ON c.id = rp.customer_id
      LEFT JOIN rp_instruments rpi ON rpi.payment_id = rp.id
      LEFT JOIN rp_allocations rpa ON rpa.payment_id = rp.id
      WHERE rp.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (customer_id) { params.push(customer_id); q += ` AND rp.customer_id=$${params.length}`; }
    q += ' ORDER BY rp.date DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Distributor Margin Detail Report ─────────────────────────────────────────
router.get('/dist-margin', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT p.name AS product_name, p.code AS product_code,
             SUM(sil.quantity) AS total_qty,
             SUM(sil.amount) AS sale_amount,
             SUM(sil.quantity * p.purchase_price) AS cost_amount,
             SUM(sil.amount - (sil.quantity * p.purchase_price)) AS margin_amount,
             CASE WHEN SUM(sil.amount) > 0
               THEN ROUND(((SUM(sil.amount) - SUM(sil.quantity * p.purchase_price)) / SUM(sil.amount) * 100)::numeric, 2)
               ELSE 0
             END AS margin_pct
      FROM sales_invoice_lines sil
      JOIN products p ON p.id = sil.product_id
      JOIN sales_invoices si ON si.id = sil.invoice_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      GROUP BY p.id, p.name, p.code
      ORDER BY margin_amount DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Vendor Payment Report ────────────────────────────────────────────────────
router.get('/vendor-payment', async (req, res) => {
  try {
    const { vendor_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT mp.number, mp.date, mp.total_amount, mp.unadjusted_amount, mp.status,
             v.print_name AS vendor_name
      FROM make_payments mp
      JOIN vendors v ON v.id = mp.vendor_id
      WHERE mp.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (vendor_id) { params.push(vendor_id); q += ` AND mp.vendor_id=$${params.length}`; }
    q += ' ORDER BY mp.date DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Vendor Refund Report ─────────────────────────────────────────────────────
router.get('/vendor-refund', async (req, res) => {
  try {
    const { vendor_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT prf.number, prf.date, prf.total_amount, prf.status, v.print_name AS vendor_name
      FROM purchase_refunds prf
      JOIN vendors v ON v.id = prf.vendor_id
      WHERE prf.date BETWEEN $1 AND $2
    `;
    const params = [date_from, date_to];
    if (vendor_id) { params.push(vendor_id); q += ` AND prf.vendor_id=$${params.length}`; }
    q += ' ORDER BY prf.date DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Vendor Wise Product Purchases Report ─────────────────────────────────────
router.get('/vendor-wise-prod', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT v.print_name AS vendor_name, p.name AS product_name, p.code AS product_code,
             SUM(pil.quantity) AS total_qty,
             SUM(pil.amount) AS total_amount
      FROM purchase_invoice_lines pil
      JOIN products p ON p.id = pil.product_id
      JOIN purchase_invoices pi ON pi.id = pil.invoice_id
      JOIN vendors v ON v.id = pi.vendor_id
      WHERE pi.status NOT IN ('cancelled','draft') AND pi.date BETWEEN $1 AND $2
      GROUP BY v.id, v.print_name, p.id, p.name, p.code
      ORDER BY v.print_name, total_amount DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Good Receiving Report ────────────────────────────────────────────────────
router.get('/good-receiving', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT pr.number, pr.date, v.print_name AS vendor_name, wh.name AS warehouse_name,
             pr.status, pr.reference
      FROM purchase_receipts pr
      JOIN vendors v ON v.id = pr.vendor_id
      JOIN warehouses wh ON wh.id = pr.warehouse_id
      WHERE pr.date BETWEEN $1 AND $2
      ORDER BY pr.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Purchase Return Report ───────────────────────────────────────────────────
router.get('/purchase-return', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT prt.number, prt.date, prt.net_amount, prt.status, v.print_name AS vendor_name
      FROM purchase_returns prt
      JOIN vendors v ON v.id = prt.vendor_id
      WHERE prt.date BETWEEN $1 AND $2
      ORDER BY prt.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Purchase Invoice Detail Report ───────────────────────────────────────────
router.get('/pi-detail', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT pi.number AS invoice_number, pi.date, v.print_name AS vendor_name,
             pil.product_id, p.name AS product_name, pil.quantity, pil.unit_price, pil.amount
      FROM purchase_invoice_lines pil
      JOIN purchase_invoices pi ON pi.id = pil.invoice_id
      JOIN vendors v ON v.id = pi.vendor_id
      JOIN products p ON p.id = pil.product_id
      WHERE pi.date BETWEEN $1 AND $2
      ORDER BY pi.date DESC, pi.number
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Purchase Order Detail Report (Ungrouped) ─────────────────────────────────
router.get('/po-detail-ug', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT po.number AS order_number, po.date, v.print_name AS vendor_name,
             p.name AS product_name, pol.quantity, pol.unit_price, pol.amount, pol.received_qty
      FROM purchase_order_lines pol
      JOIN purchase_orders po ON po.id = pol.order_id
      JOIN vendors v ON v.id = po.vendor_id
      JOIN products p ON p.id = pol.product_id
      WHERE po.date BETWEEN $1 AND $2
      ORDER BY po.date DESC, po.number
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Purchase Invoice Detail Report (2) ───────────────────────────────────────
router.get('/pi-detail-2', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT pi.number AS invoice_number, pi.date, v.print_name AS vendor_name,
             pi.net_amount, pi.status, pi.due_date, pi.balance_amount
      FROM purchase_invoices pi
      JOIN vendors v ON v.id = pi.vendor_id
      WHERE pi.date BETWEEN $1 AND $2
      ORDER BY pi.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Purchase Order Report (Pending Orders) ───────────────────────────────────
router.get('/po-pending', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT po.number, po.date, po.net_amount, po.status, v.print_name AS vendor_name,
             po.expected_date
      FROM purchase_orders po
      JOIN vendors v ON v.id = po.vendor_id
      WHERE po.status NOT IN ('cancelled','received','invoiced') AND po.date BETWEEN $1 AND $2
      ORDER BY po.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════

// ── Warehouse Location Wise Stock Report ─────────────────────────────────────
router.get('/wh-location-stock', async (req, res) => {
  try {
    const { warehouse_id } = req.query;
    let q = `
      SELECT w.name AS warehouse_name, p.code, p.name AS product_name,
             ps.qty_on_hand, p.purchase_price AS unit_cost
      FROM product_stock ps
      JOIN products p ON p.id = ps.product_id
      JOIN warehouses w ON w.id = ps.warehouse_id
      WHERE 1=1
    `;
    const params = [];
    if (warehouse_id) { params.push(warehouse_id); q += ` AND ps.warehouse_id=$${params.length}`; }
    q += ' ORDER BY w.name, p.name';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Low Inventory Report ─────────────────────────────────────────────────────
router.get('/low-inventory', async (req, res) => {
  try {
    const { warehouse_id, category_id, brand_id, product_id, is_active } = req.query;
    const conditions = [
      'ps.min_stock_level > 0',
      'ps.qty_on_hand <= ps.min_stock_level',
    ];
    const params = [];

    if (warehouse_id) { params.push(warehouse_id); conditions.push(`ps.warehouse_id = $${params.length}`); }
    if (category_id)  { params.push(category_id);  conditions.push(`p.category_id = $${params.length}`); }
    if (brand_id)      { params.push(brand_id);      conditions.push(`p.brand_id = $${params.length}`); }
    if (product_id)    { params.push(product_id);    conditions.push(`p.id = $${params.length}`); }
    if (is_active !== undefined && is_active !== '') {
      params.push(is_active === 'true');
      conditions.push(`p.is_active = $${params.length}`);
    }

    const { rows } = await pool.query(`
      SELECT p.code AS product_code, p.name AS product_name,
             w.name AS warehouse_name,
             ps.qty_on_hand AS quantity_in_stock,
             ps.min_stock_level AS low_threshold
      FROM product_stock ps
      JOIN products p   ON p.id = ps.product_id
      JOIN warehouses w ON w.id = ps.warehouse_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.name, w.name
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Product Category Report ──────────────────────────────────────────────────
router.get('/prod-category', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pc.name AS category_name,
             COUNT(p.id) AS product_count,
             SUM(COALESCE(ps.qty_on_hand, 0)) AS total_qty,
             SUM(COALESCE(ps.qty_on_hand, 0) * p.purchase_price) AS total_value
      FROM product_categories pc
      LEFT JOIN products p ON p.category_id = pc.id AND p.is_active = true
      LEFT JOIN product_stock ps ON ps.product_id = p.id
      GROUP BY pc.id, pc.name
      ORDER BY pc.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stock On Hand Report (With Value) ────────────────────────────────────────
router.get('/stock-on-hand-val', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.code, p.name AS product_name, p.unit_of_measurement AS unit,
             w.name AS warehouse_name,
             COALESCE(ps.qty_on_hand, 0) AS qty_on_hand,
             p.purchase_price AS unit_cost,
             COALESCE(ps.qty_on_hand, 0) * p.purchase_price AS stock_value,
             p.sale_price AS sale_price,
             COALESCE(ps.qty_on_hand, 0) * p.sale_price AS sale_value
      FROM product_stock ps
      JOIN products p ON p.id = ps.product_id
      JOIN warehouses w ON w.id = ps.warehouse_id
      ORDER BY p.name, w.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Short Expiry Stock Report ────────────────────────────────────────────────
router.get('/short-expiry', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.code, p.name AS product_name,
             COALESCE(ps.qty_on_hand, 0) AS qty_on_hand,
             p.purchase_price AS unit_cost
      FROM products p
      LEFT JOIN product_stock ps ON ps.product_id = p.id
      WHERE p.is_active = true AND p.manage_batch = true
      ORDER BY p.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stock Tracking Report ────────────────────────────────────────────────────
router.get('/stock-tracking', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT p.code, p.name AS product_name,
             COALESCE(ps.qty_on_hand, 0) AS current_qty,
             p.purchase_price AS unit_cost
      FROM products p
      LEFT JOIN product_stock ps ON ps.product_id = p.id
      WHERE p.is_active = true AND p.track_inventory = true
      ORDER BY p.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Negative Stock Report ────────────────────────────────────────────────────
router.get('/negative-stock', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.code, p.name AS product_name, w.name AS warehouse_name,
             ps.qty_on_hand
      FROM product_stock ps
      JOIN products p ON p.id = ps.product_id
      JOIN warehouses w ON w.id = ps.warehouse_id
      WHERE ps.qty_on_hand < 0
      ORDER BY ps.qty_on_hand ASC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stock Valuation Report ───────────────────────────────────────────────────
router.get('/stock-valuation', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.code, p.name AS product_name,
             SUM(COALESCE(ps.qty_on_hand, 0)) AS total_qty,
             p.purchase_price AS avg_cost,
             SUM(COALESCE(ps.qty_on_hand, 0) * p.purchase_price) AS total_value
      FROM products p
      LEFT JOIN product_stock ps ON ps.product_id = p.id
      WHERE p.is_active = true AND p.track_inventory = true
      GROUP BY p.id, p.code, p.name, p.purchase_price
      ORDER BY p.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stock Discrepancy Report ─────────────────────────────────────────────────
router.get('/stock-discrepancy', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sa.number, sa.date, sal.new_qty - sal.current_qty AS quantity, sal.notes,
             p.name AS product_name, w.name AS warehouse_name
      FROM stock_adjustments sa
      JOIN stock_adjustment_lines sal ON sal.adjustment_id = sa.id
      JOIN products p ON p.id = sal.product_id
      JOIN warehouses w ON w.id = sa.warehouse_id
      WHERE sa.status = 'confirmed' AND sal.new_qty <> sal.current_qty
      ORDER BY sa.date DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Batch Wise Stock Report ──────────────────────────────────────────────────
router.get('/batch-wise-stock', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.code, p.name AS product_name, w.name AS warehouse_name,
             COALESCE(ps.qty_on_hand, 0) AS qty_on_hand
      FROM product_stock ps
      JOIN products p ON p.id = ps.product_id AND p.manage_batch = true
      JOIN warehouses w ON w.id = ps.warehouse_id
      ORDER BY p.name, w.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Transfer Discrepancy Report ──────────────────────────────────────────────
router.get('/transfer-disc', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sm.number, sm.date, sm.status, sm.reference,
             fw.name AS from_warehouse, tw.name AS to_warehouse
      FROM stock_movements sm
      LEFT JOIN warehouses fw ON fw.id = sm.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = sm.to_warehouse_id
      WHERE sm.status != 'completed' AND sm.date BETWEEN $1 AND $2
      ORDER BY sm.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Transfer Out Report ──────────────────────────────────────────────────────
router.get('/transfer-out', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sm.number, sm.date, sm.status, fw.name AS from_warehouse,
             tw.name AS to_warehouse, sm.reference
      FROM stock_movements sm
      LEFT JOIN warehouses fw ON fw.id = sm.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = sm.to_warehouse_id
      WHERE sm.date BETWEEN $1 AND $2
      ORDER BY sm.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Transfer In Report ───────────────────────────────────────────────────────
router.get('/transfer-in', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT sm.number, sm.date, sm.status, tw.name AS to_warehouse,
             fw.name AS from_warehouse, sm.reference
      FROM stock_movements sm
      LEFT JOIN warehouses fw ON fw.id = sm.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = sm.to_warehouse_id
      WHERE sm.date BETWEEN $1 AND $2
      ORDER BY sm.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── In Transit Detail Report ─────────────────────────────────────────────────
router.get('/in-transit', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sm.number, sm.date, fw.name AS from_warehouse, tw.name AS to_warehouse,
             sm.status, sm.reference
      FROM stock_movements sm
      LEFT JOIN warehouses fw ON fw.id = sm.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = sm.to_warehouse_id
      WHERE sm.status NOT IN ('completed','cancelled')
      ORDER BY sm.date DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stock On Hand History Report ─────────────────────────────────────────────
router.get('/stock-on-hand-hist', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.code, p.name AS product_name, w.name AS warehouse_name,
             COALESCE(ps.qty_on_hand, 0) AS qty_on_hand,
             p.purchase_price AS unit_cost,
             COALESCE(ps.qty_on_hand, 0) * p.purchase_price AS stock_value
      FROM product_stock ps
      JOIN products p ON p.id = ps.product_id
      JOIN warehouses w ON w.id = ps.warehouse_id
      ORDER BY p.name, w.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Courier Ledger Report ────────────────────────────────────────────────────
router.get('/courier-ledger', async (req, res) => {
  try {
    const { courier_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT c.print_name AS courier_name, c.code AS courier_code,
             c.email, c.phone, c.city
      FROM couriers c
      WHERE c.is_active = true
    `;
    const params = [];
    if (courier_id) { params.push(courier_id); q += ` AND c.id=$${params.length}`; }
    q += ' ORDER BY c.print_name';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Other Contact Ledger ─────────────────────────────────────────────────────
router.get('/other-contact-ledger', async (req, res) => {
  try {
    const { contact_id, date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    let q = `
      SELECT oc.print_name AS contact_name, oc.code, oc.category, oc.email, oc.phone, oc.address
      FROM other_contacts oc
      WHERE oc.is_active = true
    `;
    const params = [];
    if (contact_id) { params.push(contact_id); q += ` AND oc.id=$${params.length}`; }
    q += ' ORDER BY oc.print_name';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Transactions for selected other contacts ─────────────────────────────────
router.get('/oc-transactions', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT oc.print_name AS contact_name, oc.code,
             cn.number AS doc_number, cn.date, cn.amount, 'Credit Note' AS doc_type
      FROM credit_notes cn
      JOIN other_contacts oc ON oc.print_name = cn.contact_name
      WHERE cn.date BETWEEN $1 AND $2
      UNION ALL
      SELECT oc.print_name, oc.code,
             dn.number, dn.date, dn.amount, 'Debit Note'
      FROM debit_notes dn
      JOIN other_contacts oc ON oc.print_name = dn.contact_name
      WHERE dn.date BETWEEN $1 AND $2
      ORDER BY contact_name, date
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Consolidated Ledger (Customer & Vendor) ──────────────────────────────────
router.get('/consolidated-ledger', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT c.print_name AS contact_name, 'Customer' AS contact_type,
             si.number AS doc_number, si.date, si.net_amount AS amount, 'Sales Invoice' AS doc_type
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
      UNION ALL
      SELECT v.print_name, 'Vendor',
             pi.number, pi.date, pi.net_amount, 'Purchase Invoice'
      FROM purchase_invoices pi
      JOIN vendors v ON v.id = pi.vendor_id
      WHERE pi.status NOT IN ('cancelled','draft') AND pi.date BETWEEN $1 AND $2
      ORDER BY contact_name, date
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Transaction List Report ──────────────────────────────────────────────────
router.get('/txn-list', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT je.number, je.date, je.memo, je.reference, je.status,
             je.total_debit, je.total_credit
      FROM journal_entries je
      WHERE je.date BETWEEN $1 AND $2
      ORDER BY je.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tax Collected on Sales Report ────────────────────────────────────────────
router.get('/tax-collected', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT si.number, si.date, si.tax_amount, si.net_amount,
             c.print_name AS customer_name
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.status NOT IN ('cancelled','draft') AND si.date BETWEEN $1 AND $2
        AND si.tax_amount > 0
      ORDER BY si.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tax Paid on Purchases Report ─────────────────────────────────────────────
router.get('/tax-paid', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT pi.number, pi.date, pi.tax_amount, pi.net_amount,
             v.print_name AS vendor_name
      FROM purchase_invoices pi
      JOIN vendors v ON v.id = pi.vendor_id
      WHERE pi.status NOT IN ('cancelled','draft') AND pi.date BETWEEN $1 AND $2
        AND pi.tax_amount > 0
      ORDER BY pi.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Trial Balance Report (Six Column) ────────────────────────────────────────
router.get('/trial-six-col', async (req, res) => {
  try {
    const {
      date_from = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      date_to = new Date().toISOString().split('T')[0]
    } = req.query;
    const { rows } = await pool.query(`
      SELECT coa.code, coa.name, coa.account_type,
             COALESCE(SUM(jel.debit), 0) AS debit,
             COALESCE(SUM(jel.credit), 0) AS credit,
             COALESCE(SUM(jel.debit - jel.credit), 0) AS balance
      FROM chart_of_accounts coa
      LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
        AND je.status = 'posted' AND je.date BETWEEN $1 AND $2
      WHERE coa.is_parent = false
      GROUP BY coa.id, coa.code, coa.name, coa.account_type
      HAVING COALESCE(SUM(jel.debit), 0) <> 0 OR COALESCE(SUM(jel.credit), 0) <> 0
      ORDER BY coa.code
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Other Collection Report ──────────────────────────────────────────────────
router.get('/other-collection', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT oc.number, oc.date, oc.contact_name, oc.reference, oc.total_amount, oc.status
      FROM other_collections oc
      WHERE oc.date BETWEEN $1 AND $2
      ORDER BY oc.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Other Payment Report ─────────────────────────────────────────────────────
router.get('/other-payment-rpt', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT op.number, op.date, op.contact_name, op.reference, op.total_amount, op.status
      FROM other_payments op
      WHERE op.date BETWEEN $1 AND $2
      ORDER BY op.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

// ── Balance Sheet ────────────────────────────────────────────────────────────
router.get('/balance-sheet', async (req, res) => {
  try {
    const { as_of = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT coa.account_type, coa.code, coa.name,
             COALESCE(SUM(jel.debit - jel.credit), 0) AS balance
      FROM chart_of_accounts coa
      LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
        AND je.status = 'posted' AND je.date <= $1
      WHERE coa.is_parent = false
        AND coa.account_type IN ('asset','liability','equity')
      GROUP BY coa.id, coa.account_type, coa.code, coa.name
      HAVING COALESCE(SUM(jel.debit - jel.credit), 0) <> 0
      ORDER BY coa.account_type, coa.code
    `, [as_of]);

    const byType = { asset: 0, liability: 0, equity: 0 };
    rows.forEach(r => { byType[r.account_type] += Number(r.balance); });
    const total_assets = byType['asset'] || 0;
    const total_liabilities = byType['liability'] || 0;
    const total_equity = byType['equity'] || 0;

    res.json({ accounts: rows, total_assets, total_liabilities, total_equity });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Business Summary ─────────────────────────────────────────────────────────
router.get('/business-summary', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    const { rows: sales } = await pool.query(`
      SELECT COUNT(id) AS count, COALESCE(SUM(net_amount), 0) AS total
      FROM sales_invoices WHERE status NOT IN ('cancelled','draft') AND date = $1
    `, [date]);
    const { rows: purchases } = await pool.query(`
      SELECT COUNT(id) AS count, COALESCE(SUM(net_amount), 0) AS total
      FROM purchase_invoices WHERE status NOT IN ('cancelled','draft') AND date = $1
    `, [date]);
    const { rows: expenses } = await pool.query(`
      SELECT COUNT(id) AS count, COALESCE(SUM(gross_amount), 0) AS total
      FROM expenses WHERE date = $1
    `, [date]);
    res.json({
      date,
      sales: sales[0],
      purchases: purchases[0],
      expenses: expenses[0]
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Audit Log ────────────────────────────────────────────────────────────────
router.get('/audit-log', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT je.number, je.date, je.memo, je.reference, je.status,
             je.total_debit, je.total_credit
      FROM journal_entries je
      WHERE je.date BETWEEN $1 AND $2
      ORDER BY je.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRM
// ═══════════════════════════════════════════════════════════════════════════════

// ── Call Engagement Insights ─────────────────────────────────────────────────
router.get('/call-engagement', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT cc.number, cc.call_date, cc.subject, cc.contact_name,
             cc.call_type, cc.call_purpose, cc.duration_minutes,
             cc.status, cc.assigned_to
      FROM crm_calls cc
      WHERE cc.call_date BETWEEN $1 AND $2
      ORDER BY cc.call_date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Leads CRM ────────────────────────────────────────────────────────────────
router.get('/leads-crm', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cl.number, cl.name, cl.company, cl.email, cl.phone,
             cl.source, cl.stage, cl.probability, cl.expected_revenue,
             cl.lead_status, cl.assigned_to, cl.lead_date
      FROM crm_leads cl
      ORDER BY cl.lead_date DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Leads Detail Report ──────────────────────────────────────────────────────
router.get('/leads-detail', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cl.number, cl.name, cl.company, cl.email, cl.phone,
             cl.source, cl.stage, cl.probability, cl.expected_revenue,
             cl.lead_status, cl.industry, cl.website, cl.assigned_to,
             cl.lead_date, cl.annual_revenue, cl.num_employees
      FROM crm_leads cl
      ORDER BY cl.lead_date DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Lead Status Summary Report ───────────────────────────────────────────────
router.get('/lead-status', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cl.lead_status, ls.name AS status_name,
             COUNT(cl.id) AS lead_count,
             SUM(cl.expected_revenue) AS total_expected_revenue
      FROM crm_leads cl
      LEFT JOIN lead_statuses ls ON ls.name = cl.lead_status
      GROUP BY cl.lead_status, ls.name
      ORDER BY lead_count DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MANUFACTURING
// ═══════════════════════════════════════════════════════════════════════════════

// ── Material Issuance Report ─────────────────────────────────────────────────
router.get('/material-issuance', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT wo.number, wo.date, wo.status, wo.planned_qty, wo.produced_qty,
             p.name AS product_name, w.name AS warehouse_name
      FROM work_orders wo
      JOIN bill_of_materials b ON b.id = wo.bom_id
      JOIN products p ON p.id = b.product_id
      JOIN warehouses w ON w.id = wo.warehouse_id
      WHERE wo.date BETWEEN $1 AND $2
      ORDER BY wo.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Job Order Expense Report ─────────────────────────────────────────────────
router.get('/jo-expense', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT wo.number, wo.date, wo.status, wo.planned_qty, wo.produced_qty,
             p.name AS product_name
      FROM work_orders wo
      JOIN bill_of_materials b ON b.id = wo.bom_id
      JOIN products p ON p.id = b.product_id
      WHERE wo.date BETWEEN $1 AND $2
      ORDER BY wo.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Job Order Production Report ──────────────────────────────────────────────
router.get('/jo-production', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT wo.number, wo.date, wo.status, wo.planned_qty, wo.produced_qty,
             p.name AS product_name
      FROM work_orders wo
      JOIN bill_of_materials b ON b.id = wo.bom_id
      JOIN products p ON p.id = b.product_id
      WHERE wo.date BETWEEN $1 AND $2 AND wo.produced_qty > 0
      ORDER BY wo.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Job Order Validation Report ──────────────────────────────────────────────
router.get('/jo-validation', async (req, res) => {
  try {
    const { date_from = '2000-01-01', date_to = new Date().toISOString().split('T')[0] } = req.query;
    const { rows } = await pool.query(`
      SELECT wo.number, wo.date, wo.status, wo.planned_qty, wo.produced_qty,
             p.name AS product_name
      FROM work_orders wo
      JOIN bill_of_materials b ON b.id = wo.bom_id
      JOIN products p ON p.id = b.product_id
      WHERE wo.date BETWEEN $1 AND $2 AND wo.planned_qty != wo.produced_qty
      ORDER BY wo.date DESC
    `, [date_from, date_to]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
