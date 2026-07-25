const express = require('express');
const router = express.Router();
const pool = require('../db');

async function nextSessionNumber(client) {
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='PSS-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'PSS-' + rows[0].lpad;
}

async function nextTxNumber(client) {
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='POS-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'POS-' + rows[0].lpad;
}

const SESSION_SELECT = `
  SELECT s.*,
    w.name  AS warehouse_name,
    cnt.name AS counter_name,
    cnt.cash_account_id
  FROM pos_sessions s
  LEFT JOIN warehouses w ON w.id = s.warehouse_id
  LEFT JOIN pos_counters cnt ON cnt.id = s.counter_id
`;

// ─── Sessions ────────────────────────────────────────────────────────────────

router.get('/sessions', async (req, res) => {
  try {
    const { rows } = await pool.query(SESSION_SELECT + ' ORDER BY s.opening_date DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// IMPORTANT: /sessions/open must be declared before /sessions/:id
router.get('/sessions/open', async (req, res) => {
  try {
    const { rows } = await pool.query(
      SESSION_SELECT + " WHERE s.status='open' ORDER BY s.opening_date DESC LIMIT 1"
    );
    res.json(rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(SESSION_SELECT + ' WHERE s.id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sessions', async (req, res) => {
  const { opening_balance = 0, counter_id, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve warehouse from counter if counter_id provided
    let warehouse_id = req.body.warehouse_id || null;
    let counter_name = null;
    if (counter_id) {
      const { rows: cnt } = await client.query(
        'SELECT name, warehouse_id FROM pos_counters WHERE id=$1 AND is_active=true', [counter_id]
      );
      if (!cnt.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Counter not found or inactive' });
      }
      counter_name = cnt[0].name;
      if (!warehouse_id) warehouse_id = cnt[0].warehouse_id;
    }

    const number = await nextSessionNumber(client);
    const { rows } = await client.query(
      `INSERT INTO pos_sessions
         (number, opening_balance, warehouse_id, counter_id, counter_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [number, opening_balance, warehouse_id || null, counter_id || null, counter_name, notes || null]
    );
    await client.query('COMMIT');

    // Return with joined names
    const { rows: full } = await pool.query(SESSION_SELECT + ' WHERE s.id=$1', [rows[0].id]);
    res.status(201).json(full[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/sessions/:id/close', async (req, res) => {
  const { closing_balance, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE pos_sessions SET status='closed',closing_date=NOW(),closing_balance=$1,
       notes=COALESCE($2,notes) WHERE id=$3 AND status='open' RETURNING *`,
      [closing_balance, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not open' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

router.get('/transactions', async (req, res) => {
  try {
    const { session_id, date_from, date_to, search, counter_id } = req.query;
    let q = `SELECT t.*, c.print_name AS customer_name
             FROM pos_transactions t
             LEFT JOIN customers c ON c.id=t.customer_id
             LEFT JOIN pos_sessions s ON s.id=t.session_id
             WHERE 1=1`;
    const p = [];
    if (session_id) { p.push(session_id); q += ` AND t.session_id=$${p.length}`; }
    if (counter_id) { p.push(counter_id); q += ` AND s.counter_id=$${p.length}`; }
    if (date_from)  { p.push(date_from);  q += ` AND t.date::date>=$${p.length}`; }
    if (date_to)    { p.push(date_to);    q += ` AND t.date::date<=$${p.length}`; }
    if (search)     { p.push(`%${search}%`); q += ` AND (t.number ILIKE $${p.length} OR c.print_name ILIKE $${p.length})`; }
    q += ' ORDER BY t.date DESC, t.id DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/transactions/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT t.*, c.print_name AS customer_name FROM pos_transactions t LEFT JOIN customers c ON c.id=t.customer_id WHERE t.id=$1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const tx = rows[0];
    const { rows: lines } = await pool.query(
      'SELECT l.*, p.name AS product_name FROM pos_transaction_lines l LEFT JOIN products p ON p.id=l.product_id WHERE l.transaction_id=$1 ORDER BY l.id',
      [tx.id]
    );
    tx.lines = lines;
    res.json(tx);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/transactions', async (req, res) => {
  const {
    session_id, customer_id, subtotal, tax_total, discount, total,
    paid_amount, change_amount, payment_mode = 'cash', notes, lines = []
  } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: sess } = await client.query(
      "SELECT id, warehouse_id FROM pos_sessions WHERE id=$1 AND status='open'", [session_id]
    );
    if (!sess.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No open session found' });
    }
    const session = sess[0];

    const number = await nextTxNumber(client);
    const { rows } = await client.query(
      `INSERT INTO pos_transactions
         (number,session_id,customer_id,subtotal,tax_total,discount,total,paid_amount,change_amount,payment_mode,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [number, session_id, customer_id || null, subtotal || 0, tax_total || 0, discount || 0,
       total || 0, paid_amount || 0, change_amount || 0, payment_mode, notes || null]
    );
    const txId = rows[0].id;

    for (const l of lines) {
      await client.query(
        `INSERT INTO pos_transaction_lines
           (transaction_id,product_id,description,quantity,unit_price,discount_pct,tax_id,tax_amount,amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [txId, l.product_id || null, l.description || '', l.quantity || 1,
         l.unit_price || 0, l.discount_pct || 0, l.tax_id || null, l.tax_amount || 0, l.amount || 0]
      );

      if (session.warehouse_id && l.product_id) {
        await client.query(
          `UPDATE product_stock SET qty_on_hand = qty_on_hand - $1
           WHERE product_id=$2 AND warehouse_id=$3`,
          [l.quantity || 1, l.product_id, session.warehouse_id]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/transactions/:id/void', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE pos_transactions SET status='voided' WHERE id=$1 AND status='completed' RETURNING *",
      [req.params.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not found or not completed' });
    }
    const tx = rows[0];

    const { rows: sess } = await client.query(
      'SELECT warehouse_id FROM pos_sessions WHERE id=$1', [tx.session_id]
    );
    if (sess.length && sess[0].warehouse_id) {
      const { rows: lines } = await client.query(
        'SELECT * FROM pos_transaction_lines WHERE transaction_id=$1', [tx.id]
      );
      for (const l of lines) {
        if (l.product_id) {
          await client.query(
            `INSERT INTO product_stock (product_id,warehouse_id,qty_on_hand) VALUES ($1,$2,$3)
             ON CONFLICT (product_id,warehouse_id) DO UPDATE SET qty_on_hand=product_stock.qty_on_hand + $3`,
            [l.product_id, sess[0].warehouse_id, l.quantity]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

// ─── Session summary ────────────────────────────────────────────────────────

router.get('/sessions/:id/summary', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='completed') AS total_transactions,
         COALESCE(SUM(total) FILTER (WHERE status='completed'), 0) AS total_sales,
         COALESCE(SUM(total) FILTER (WHERE status='completed' AND payment_mode='cash'), 0) AS cash_sales,
         COALESCE(SUM(total) FILTER (WHERE status='completed' AND payment_mode='card'), 0) AS card_sales,
         COALESCE(SUM(total) FILTER (WHERE status='completed' AND payment_mode='bank'), 0) AS bank_sales,
         COALESCE(SUM(total) FILTER (WHERE status='completed' AND payment_mode='cheque'), 0) AS cheque_sales,
         COUNT(*) FILTER (WHERE status='voided') AS voided_count
       FROM pos_transactions WHERE session_id=$1`, [req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Overall daily summary (X/Z report) ─────────────────────────────────────

router.get('/daily-summary', async (req, res) => {
  const { date_from, date_to, counter_id } = req.query;
  try {
    const from = date_from || new Date().toISOString().slice(0, 10);
    const to   = date_to   || from;

    const params = [from, to];
    let counterFilter = '';
    if (counter_id) { params.push(counter_id); counterFilter = `AND s.counter_id=$${params.length}`; }

    // Per-day totals
    const { rows: days } = await pool.query(
      `SELECT
         t.date::date AS date,
         COUNT(*)            FILTER (WHERE t.status='completed') AS total_transactions,
         COALESCE(SUM(t.total) FILTER (WHERE t.status='completed'), 0) AS total_sales,
         COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='cash'), 0) AS total_cash,
         COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode IN ('card','bank')), 0) AS total_bank,
         COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='cheque'), 0) AS total_cheque,
         0 AS total_returns
       FROM pos_transactions t
       JOIN pos_sessions s ON s.id = t.session_id
       WHERE t.date::date BETWEEN $1 AND $2 ${counterFilter}
       GROUP BY t.date::date
       ORDER BY t.date::date DESC`,
      params
    );

    // Add sessions per day
    for (const day of days) {
      const sessParams = [day.date, day.date];
      let sf = '';
      if (counter_id) { sessParams.push(counter_id); sf = `AND s.counter_id=$${sessParams.length}`; }
      const { rows: sessions } = await pool.query(
        `SELECT s.id, s.opening_date AS opened_at, s.closing_date AS closed_at,
                s.opening_balance AS opening_cash, s.closing_balance AS closing_cash,
                COUNT(t.id) FILTER (WHERE t.status='completed') AS sales_count,
                COALESCE(SUM(t.total) FILTER (WHERE t.status='completed'), 0) AS sales_total
         FROM pos_sessions s
         LEFT JOIN pos_transactions t ON t.session_id = s.id
         WHERE s.opening_date::date BETWEEN $1 AND $2 ${sf}
         GROUP BY s.id ORDER BY s.opening_date`, sessParams
      );
      day.sessions = sessions;
      day.net_sales = parseFloat(day.total_sales) - parseFloat(day.total_returns);
    }

    // Overall totals
    const { rows: ov } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE t.status='completed') AS total_transactions,
         COALESCE(SUM(t.total) FILTER (WHERE t.status='completed'), 0) AS total_sales,
         COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='cash'), 0) AS total_cash,
         COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode IN ('card','bank')), 0) AS total_bank,
         COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='cheque'), 0) AS total_cheque,
         0 AS total_returns
       FROM pos_transactions t
       JOIN pos_sessions s ON s.id = t.session_id
       WHERE t.date::date BETWEEN $1 AND $2 ${counterFilter}`,
      params
    );
    const overall = ov[0];
    overall.net_sales = parseFloat(overall.total_sales) - parseFloat(overall.total_returns);

    res.json({ days, overall });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Flat sessions summary (for Daily Summary table) ─────────────────────────

router.get('/sessions-summary', async (req, res) => {
  const { date_from, date_to, counter_id } = req.query;
  try {
    const params = [];
    const wheres = [];
    if (date_from) { params.push(date_from); wheres.push(`s.opening_date::date >= $${params.length}`); }
    if (date_to)   { params.push(date_to);   wheres.push(`s.opening_date::date <= $${params.length}`); }
    if (counter_id){ params.push(counter_id); wheres.push(`s.counter_id = $${params.length}`); }
    const where = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';

    const { rows } = await pool.query(`
      SELECT
        s.id,
        s.opening_date::date                                                                        AS date,
        COALESCE(cnt.name, s.counter_name, '')                                                      AS counter_name,
        s.opening_date                                                                              AS start_time,
        s.closing_date                                                                              AS end_time,
        s.opening_balance                                                                           AS opening_cash,
        0                                                                                           AS cash_in,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='completed'), 0)                              AS sales,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='cash'),   0)  AS cash,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='card'),   0)  AS card,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='bank'),   0)  AS bank_transfer,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='credit'), 0)  AS credit,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='credit_note' OR t.status='sale_return'),  0) AS adjusted_cn_sr,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='refund'),  0)                                AS refunds,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='return'),  0)                                AS returns,
        0                                                                                           AS cash_out,
        CASE WHEN s.closing_balance IS NOT NULL
          THEN s.closing_balance - (
            s.opening_balance +
            COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='cash'), 0)
          )
          ELSE 0
        END                                                                                         AS cash_short_or_excess,
        COALESCE(
          SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode IN ('cash','card','bank')),
          0
        )                                                                                           AS closing
      FROM pos_sessions s
      LEFT JOIN pos_counters cnt ON cnt.id = s.counter_id
      LEFT JOIN pos_transactions t ON t.session_id = s.id
      ${where}
      GROUP BY s.id, cnt.name
      ORDER BY s.opening_date DESC
    `, params);

    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Counter daily summary ──────────────────────────────────────────────────

router.get('/counters/:id/daily-summary', async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().slice(0, 10);
  try {
    const { rows: sessions } = await pool.query(
      `SELECT s.id, s.number, s.opening_balance, s.closing_balance, s.status, s.opening_date, s.closing_date
       FROM pos_sessions s
       WHERE s.counter_id=$1 AND s.opening_date::date=$2
       ORDER BY s.opening_date`, [req.params.id, targetDate]
    );
    const sessionIds = sessions.map(s => s.id);
    let summary = {
      date: targetDate, sessions,
      total_transactions: 0, total_sales: 0,
      cash_sales: 0, card_sales: 0, bank_sales: 0, cheque_sales: 0, voided_count: 0
    };
    if (sessionIds.length) {
      const { rows } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status='completed') AS total_transactions,
           COALESCE(SUM(total) FILTER (WHERE status='completed'), 0) AS total_sales,
           COALESCE(SUM(total) FILTER (WHERE status='completed' AND payment_mode='cash'), 0) AS cash_sales,
           COALESCE(SUM(total) FILTER (WHERE status='completed' AND payment_mode='card'), 0) AS card_sales,
           COALESCE(SUM(total) FILTER (WHERE status='completed' AND payment_mode='bank'), 0) AS bank_sales,
           COALESCE(SUM(total) FILTER (WHERE status='completed' AND payment_mode='cheque'), 0) AS cheque_sales,
           COUNT(*) FILTER (WHERE status='voided') AS voided_count
         FROM pos_transactions WHERE session_id = ANY($1)`, [sessionIds]
      );
      Object.assign(summary, rows[0]);
    }
    res.json(summary);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
