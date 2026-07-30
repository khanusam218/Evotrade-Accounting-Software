const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix, safeNextNumber } = require('../utils');
const { postJournalEntry, reverseJournalEntriesForSource, changeToLine } = require('../journalPosting');

async function nextSessionNumber(client) {
  const series = await getOrCreateSeriesByPrefix(client, 'PSS-', 4);
  return safeNextNumber(client, series, 'prefix', 'PSS-', 'pos_sessions', 'number');
}

// Picks the account a sale's payment amount lands in: the counter's own cash
// drawer for cash, Undeposited Funds for card/bank (pending a real Bank
// Deposit later, matching how Receive Payments already treats non-cash
// instruments), or Accounts Receivable for a credit sale not yet collected.
async function getSaleDebitAccount(client, paymentMode, cashAccountId) {
  if (paymentMode === 'credit') {
    const { rows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='AccountsReceivable' LIMIT 1`);
    return rows[0] || null;
  }
  if (paymentMode === 'cash') {
    if (cashAccountId) {
      const { rows } = await client.query(`SELECT * FROM chart_of_accounts WHERE id=$1`, [cashAccountId]);
      if (rows.length) return rows[0];
    }
    const { rows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='Cash' LIMIT 1`);
    return rows[0] || null;
  }
  const { rows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='UndepositedFunds' LIMIT 1`);
  return rows[0] || null;
}

// Resolves the two accounts a POS sale affects and the signed balance change
// for each (sign=1 for the original sale, sign=-1 to undo it on void).
async function resolvePOSSaleChange(client, tx, cashAccountId, sign) {
  const debitCoa = await getSaleDebitAccount(client, tx.payment_mode, cashAccountId);
  if (!debitCoa) {
    const label = tx.payment_mode === 'credit' ? 'Accounts Receivable' : tx.payment_mode === 'cash' ? 'Cash' : 'Undeposited Funds';
    throw new Error(`${label} account not configured for this company`);
  }
  const { rows: revRows } = await client.query(`SELECT * FROM chart_of_accounts WHERE system_name='DefaultSales' LIMIT 1`);
  if (!revRows.length) throw new Error('No revenue account found');
  const revCoa = revRows[0];

  const total = Number(tx.total) * sign;
  return {
    debitCoa, revCoa,
    debitChange: debitCoa.normal_balance === 'debit'  ? total : -total,
    revChange:   revCoa.normal_balance   === 'credit' ? total : -total,
  };
}

// Posts a brand-new JE for a POS sale or return (sign=1 sale, sign=-1
// return): debit the payment-mode account, credit Sales Revenue — the same
// two-line model Sales Invoice approval already uses (net_amount rolled into
// one revenue line, no separate tax-payable split), kept consistent here.
async function postPOSSaleEntry(client, tx, cashAccountId, sign, memoPrefix) {
  const { debitCoa, revCoa, debitChange, revChange } = await resolvePOSSaleChange(client, tx, cashAccountId, sign);
  await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id=$2`, [debitChange, debitCoa.id]);
  await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id=$2`, [revChange, revCoa.id]);
  await postJournalEntry(client, {
    date: tx.date, memo: `${memoPrefix} ${tx.number}`, reference: tx.number,
    source_type: 'POSTransaction', source_id: tx.id,
    lines: [
      changeToLine(debitCoa, debitChange, `${memoPrefix} ${tx.number}`),
      changeToLine(revCoa, revChange, `${memoPrefix} ${tx.number}`),
    ],
  });
}

// Undoes an already-posted sale's balance impact (sign=-1) and posts the
// audit-trail reversal JE against the *original* posting — used by void,
// where a brand-new JE (postPOSSaleEntry) would create a second, unrelated
// entry instead of reversing the one the sale itself already posted.
async function voidPOSSaleEntry(client, tx, cashAccountId) {
  const { debitCoa, revCoa, debitChange, revChange } = await resolvePOSSaleChange(client, tx, cashAccountId, -1);
  await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id=$2`, [debitChange, debitCoa.id]);
  await client.query(`UPDATE chart_of_accounts SET current_balance = current_balance + $1 WHERE id=$2`, [revChange, revCoa.id]);
  await reverseJournalEntriesForSource(client, {
    source_type: 'POSTransaction', source_id: tx.id,
    date: new Date().toISOString().slice(0, 10), memo: `Void POS Sale ${tx.number}`,
  });
}

async function nextTxNumber(client) {
  const series = await getOrCreateSeriesByPrefix(client, 'POS-', 6);
  return safeNextNumber(client, series, 'prefix', 'POS-', 'pos_transactions', 'number');
}

async function nextReturnNumber(client) {
  const series = await getOrCreateSeriesByPrefix(client, 'PSR-', 6);
  return safeNextNumber(client, series, 'prefix', 'PSR-', 'pos_transactions', 'number');
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
    // How much of each product has already been returned against this sale,
    // so the Sale Return UI can cap further returns at what's actually left.
    const { rows: returned } = await pool.query(
      `SELECT rl.product_id, COALESCE(SUM(rl.quantity),0) AS returned_qty
         FROM pos_transaction_lines rl
         JOIN pos_transactions rt ON rt.id = rl.transaction_id
        WHERE rt.original_transaction_id = $1 AND rt.status = 'return'
        GROUP BY rl.product_id`,
      [tx.id]
    );
    const returnedByProduct = Object.fromEntries(returned.map(r => [r.product_id, Number(r.returned_qty)]));
    tx.lines = lines.map(l => ({ ...l, returned_qty: returnedByProduct[l.product_id] || 0 }));
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
      `SELECT s.id, s.warehouse_id, c.cash_account_id
         FROM pos_sessions s LEFT JOIN pos_counters c ON c.id = s.counter_id
        WHERE s.id=$1 AND s.status='open'`, [session_id]
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

    if (Number(rows[0].total) > 0) {
      await postPOSSaleEntry(client, rows[0], session.cash_account_id, 1, 'POS Sale');
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
      `SELECT s.warehouse_id, c.cash_account_id
         FROM pos_sessions s LEFT JOIN pos_counters c ON c.id = s.counter_id
        WHERE s.id=$1`, [tx.session_id]
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

    if (Number(tx.total) > 0) {
      try {
        await voidPOSSaleEntry(client, tx, sess[0]?.cash_account_id);
      } catch { /* accounts may not be configured — voiding the sale itself still succeeds */ }
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

// Process a Sale Return against an original completed transaction. Creates a
// new pos_transaction (status='return', linked via original_transaction_id)
// for just the lines/quantities being returned, and adds the returned stock
// back — the reverse of what the original sale did.
router.post('/transactions/:id/return', async (req, res) => {
  const { session_id, payment_mode = 'cash', notes, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: origRows } = await client.query(
      "SELECT * FROM pos_transactions WHERE id=$1 AND status='completed' FOR UPDATE", [req.params.id]
    );
    if (!origRows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Original sale not found or not completed' });
    }
    const orig = origRows[0];

    const { rows: sess } = await client.query(
      `SELECT s.id, s.warehouse_id, c.cash_account_id
         FROM pos_sessions s LEFT JOIN pos_counters c ON c.id = s.counter_id
        WHERE s.id=$1 AND s.status='open'`, [session_id]
    );
    if (!sess.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No open session found' });
    }
    const session = sess[0];

    const validLines = lines.filter(l => Number(l.quantity) > 0);
    if (!validLines.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Select at least one line and quantity to return' });
    }

    // Cap each product at what's actually left to return (original qty minus
    // whatever's already been returned against this same sale) — enforced
    // server-side so it can't be bypassed even by calling this API directly.
    const { rows: origLineRows } = await client.query(
      'SELECT product_id, quantity FROM pos_transaction_lines WHERE transaction_id=$1', [orig.id]
    );
    const origQtyByProduct = {};
    for (const l of origLineRows) origQtyByProduct[l.product_id] = (origQtyByProduct[l.product_id] || 0) + Number(l.quantity);

    const { rows: alreadyReturnedRows } = await client.query(
      `SELECT rl.product_id, COALESCE(SUM(rl.quantity),0) AS qty
         FROM pos_transaction_lines rl
         JOIN pos_transactions rt ON rt.id = rl.transaction_id
        WHERE rt.original_transaction_id=$1 AND rt.status='return'
        GROUP BY rl.product_id`,
      [orig.id]
    );
    const alreadyReturnedByProduct = Object.fromEntries(alreadyReturnedRows.map(r => [r.product_id, Number(r.qty)]));

    for (const l of validLines) {
      const already  = alreadyReturnedByProduct[l.product_id] || 0;
      const original = origQtyByProduct[l.product_id] || 0;
      const remaining = original - already;
      if (Number(l.quantity) > remaining) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Cannot return ${l.quantity} of "${l.description}" — only ${remaining} remaining to return on this sale.`,
        });
      }
    }

    const subtotal = validLines.reduce((s, l) => s + Number(l.unit_price) * Number(l.quantity) * (1 - Number(l.discount_pct || 0) / 100), 0);
    const taxTotal  = validLines.reduce((s, l) => s + Number(l.tax_amount || 0), 0);
    const total     = subtotal + taxTotal;

    const number = await nextReturnNumber(client);
    const { rows } = await client.query(
      `INSERT INTO pos_transactions
         (number,session_id,customer_id,subtotal,tax_total,discount,total,paid_amount,change_amount,payment_mode,notes,status,original_transaction_id)
       VALUES ($1,$2,$3,$4,$5,0,$6,$6,0,$7,$8,'return',$9) RETURNING *`,
      [number, session_id, orig.customer_id, subtotal, taxTotal, total, payment_mode, notes || null, orig.id]
    );
    const txId = rows[0].id;

    for (const l of validLines) {
      const net = Number(l.unit_price) * Number(l.quantity) * (1 - Number(l.discount_pct || 0) / 100);
      await client.query(
        `INSERT INTO pos_transaction_lines
           (transaction_id,product_id,description,quantity,unit_price,discount_pct,tax_id,tax_amount,amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [txId, l.product_id || null, l.description || '', l.quantity, l.unit_price || 0, l.discount_pct || 0, l.tax_id || null, l.tax_amount || 0, net]
      );

      if (session.warehouse_id && l.product_id) {
        await client.query(
          `INSERT INTO product_stock (product_id,warehouse_id,qty_on_hand) VALUES ($1,$2,$3)
           ON CONFLICT (product_id,warehouse_id) DO UPDATE SET qty_on_hand=product_stock.qty_on_hand + $3`,
          [l.product_id, session.warehouse_id, l.quantity]
        );
      }
    }

    if (Number(rows[0].total) > 0) {
      await postPOSSaleEntry(client, rows[0], session.cash_account_id, -1, 'POS Sale Return');
    }

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

// ─── Cash movements (Cash In / Cash Out via Funds Transfer) ─────────────────

router.get('/cash-movements', async (req, res) => {
  try {
    const { session_id } = req.query;
    let q = `SELECT cm.*, fa.name AS from_account_name, ta.name AS to_account_name
             FROM pos_cash_movements cm
             LEFT JOIN chart_of_accounts fa ON fa.id=cm.from_account_id
             LEFT JOIN chart_of_accounts ta ON ta.id=cm.to_account_id WHERE 1=1`;
    const p = [];
    if (session_id) { p.push(session_id); q += ` AND cm.session_id=$${p.length}`; }
    q += ' ORDER BY cm.created_at DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cash-movements', async (req, res) => {
  const { session_id, movement_type, from_account_id, to_account_id, amount, comments } = req.body;
  try {
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });
    if (!['cash_in', 'cash_out'].includes(movement_type)) return res.status(400).json({ error: 'movement_type must be cash_in or cash_out' });
    if (!from_account_id || !to_account_id) return res.status(400).json({ error: 'from_account_id and to_account_id are required' });
    if (!(Number(amount) > 0)) return res.status(400).json({ error: 'amount must be greater than 0' });

    const { rows: sess } = await pool.query("SELECT id FROM pos_sessions WHERE id=$1 AND status='open'", [session_id]);
    if (!sess.length) return res.status(400).json({ error: 'No open session found' });

    const { rows } = await pool.query(
      `INSERT INTO pos_cash_movements (session_id, movement_type, from_account_id, to_account_id, amount, comments)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [session_id, movement_type, from_account_id, to_account_id, Number(amount), comments || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
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
         COALESCE(SUM(t.total) FILTER (WHERE t.status='return'), 0) AS total_returns
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
         COALESCE(SUM(t.total) FILTER (WHERE t.status='return'), 0) AS total_returns
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
        COALESCE((SELECT SUM(amount) FROM pos_cash_movements cm WHERE cm.session_id=s.id AND cm.movement_type='cash_in'),  0) AS cash_in,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='completed'), 0)                              AS sales,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='cash'),   0)  AS cash,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='card'),   0)  AS card,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='bank'),   0)  AS bank_transfer,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='completed' AND t.payment_mode='credit'), 0)  AS credit,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='credit_note' OR t.status='sale_return'),  0) AS adjusted_cn_sr,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='refund'),  0)                                AS refunds,
        COALESCE(SUM(t.total) FILTER (WHERE t.status='return'),  0)                                AS returns,
        COALESCE((SELECT SUM(amount) FROM pos_cash_movements cm WHERE cm.session_id=s.id AND cm.movement_type='cash_out'), 0) AS cash_out,
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
