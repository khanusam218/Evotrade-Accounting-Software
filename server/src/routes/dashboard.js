const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [
      salesSummary, purchaseSummary, arAging, apAging,
      stockValue, openOrders, openTickets, recentTransactions
    ] = await Promise.all([
      // Sales this month / YTD
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE) THEN net_amount END), 0) AS sales_this_month,
          COALESCE(SUM(CASE WHEN date >= date_trunc('year', CURRENT_DATE)  THEN net_amount END), 0) AS sales_ytd,
          COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE) AND status NOT IN ('draft','cancelled') THEN net_amount END), 0) AS invoiced_this_month
        FROM sales_invoices WHERE status NOT IN ('cancelled','draft')
      `),
      // Purchases this month
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE) THEN net_amount END), 0) AS purchases_this_month,
          COALESCE(SUM(CASE WHEN date >= date_trunc('year', CURRENT_DATE)  THEN net_amount END), 0) AS purchases_ytd
        FROM purchase_invoices WHERE status NOT IN ('cancelled')
      `),
      // A/R aging buckets
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - due_date) <= 0   THEN balance_amount END), 0) AS current_amt,
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - due_date) BETWEEN 1  AND 30 THEN balance_amount END), 0) AS days_1_30,
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - due_date) BETWEEN 31 AND 60 THEN balance_amount END), 0) AS days_31_60,
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - due_date) BETWEEN 61 AND 90 THEN balance_amount END), 0) AS days_61_90,
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - due_date)  > 90              THEN balance_amount END), 0) AS over_90,
          COALESCE(SUM(balance_amount), 0) AS total_ar
        FROM sales_invoices WHERE status IN ('approved','partially_paid') AND balance_amount > 0
      `),
      // A/P aging buckets
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - due_date) <= 0   THEN balance_amount END), 0) AS current_amt,
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - due_date) BETWEEN 1  AND 30 THEN balance_amount END), 0) AS days_1_30,
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - due_date) BETWEEN 31 AND 60 THEN balance_amount END), 0) AS days_31_60,
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - due_date) BETWEEN 61 AND 90 THEN balance_amount END), 0) AS days_61_90,
          COALESCE(SUM(CASE WHEN (CURRENT_DATE - due_date)  > 90              THEN balance_amount END), 0) AS over_90,
          COALESCE(SUM(balance_amount), 0) AS total_ap
        FROM purchase_invoices WHERE status IN ('approved','partially_paid') AND balance_amount > 0
      `),
      // Stock value
      pool.query(`
        SELECT COALESCE(SUM(ps.qty_on_hand * p.purchase_price), 0) AS total_stock_value,
               COUNT(DISTINCT p.id) AS total_products
        FROM product_stock ps JOIN products p ON p.id=ps.product_id
        WHERE ps.qty_on_hand > 0
      `),
      // Open orders (anything not yet cancelled or fully closed out)
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM sales_orders    WHERE status NOT IN ('invoiced','cancelled')) AS open_sales_orders,
          (SELECT COUNT(*) FROM purchase_orders WHERE status NOT IN ('invoiced','cancelled')) AS open_purchase_orders,
          (SELECT COUNT(*) FROM work_orders     WHERE status NOT IN ('completed','cancelled')) AS open_work_orders
      `),
      // Open tickets
      pool.query(`SELECT COUNT(*) AS open_tickets FROM crm_tickets WHERE status IN ('open','in_progress')`),
      // Recent sales invoices
      pool.query(`
        SELECT si.number, si.date, si.net_amount, si.balance_amount, si.status, c.print_name AS customer_name
        FROM sales_invoices si LEFT JOIN customers c ON c.id=si.customer_id
        ORDER BY si.created_at DESC LIMIT 5
      `)
    ]);

    res.json({
      sales: salesSummary.rows[0],
      purchases: purchaseSummary.rows[0],
      ar_aging: arAging.rows[0],
      ap_aging: apAging.rows[0],
      stock: stockValue.rows[0],
      open_orders: openOrders.rows[0],
      open_tickets: openTickets.rows[0].open_tickets,
      recent_invoices: recentTransactions.rows
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Monthly sales chart data (last 12 months)
router.get('/sales-chart', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(date_trunc('month', date), 'YYYY-MM') AS month,
             COALESCE(SUM(net_amount), 0) AS amount
      FROM sales_invoices
      WHERE date >= CURRENT_DATE - INTERVAL '12 months'
        AND status NOT IN ('cancelled','draft')
      GROUP BY 1 ORDER BY 1
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Top customers by revenue
router.get('/top-customers', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.print_name AS customer_name,
             COALESCE(SUM(si.net_amount), 0) AS total_revenue
      FROM sales_invoices si JOIN customers c ON c.id=si.customer_id
      WHERE si.status NOT IN ('cancelled','draft')
        AND si.date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY c.id, c.print_name
      ORDER BY total_revenue DESC LIMIT 10
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
