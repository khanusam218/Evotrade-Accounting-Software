const express = require('express');
const router = express.Router();
const pool = require('../db');

const SELECT = `
  SELECT c.*,
    w.name   AS warehouse_name,
    a.name   AS cash_account_name,
    ns1.name AS pos_invoice_series_name,
    ns2.name AS sale_return_series_name,
    ns3.name AS sale_order_series_name
  FROM pos_counters c
  LEFT JOIN warehouses          w   ON w.id   = c.warehouse_id
  LEFT JOIN chart_of_accounts   a   ON a.id   = c.cash_account_id
  LEFT JOIN number_series       ns1 ON ns1.id = c.pos_invoice_series_id
  LEFT JOIN number_series       ns2 ON ns2.id = c.sale_return_series_id
  LEFT JOIN number_series       ns3 ON ns3.id = c.sale_order_series_id
`;

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(SELECT + ' ORDER BY c.name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(SELECT + ' WHERE c.id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const {
    name, warehouse_id, cash_account_id, is_active = true,
    pos_invoice_series_id, sale_return_series_id, sale_order_series_id,
    pos_search_sale_order = false, pos_search_product = false,
    primary_search = 'product',
  } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO pos_counters
         (name, warehouse_id, cash_account_id, is_active,
          pos_invoice_series_id, sale_return_series_id, sale_order_series_id,
          pos_search_sale_order, pos_search_product, primary_search)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        name.trim(), warehouse_id || null, cash_account_id || null, is_active,
        pos_invoice_series_id || null, sale_return_series_id || null, sale_order_series_id || null,
        pos_search_sale_order, pos_search_product, primary_search,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const {
    name, warehouse_id, cash_account_id, is_active,
    pos_invoice_series_id, sale_return_series_id, sale_order_series_id,
    pos_search_sale_order, pos_search_product, primary_search,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE pos_counters SET
         name                  = COALESCE($1, name),
         warehouse_id          = $2,
         cash_account_id       = $3,
         is_active             = COALESCE($4, is_active),
         pos_invoice_series_id = $5,
         sale_return_series_id = $6,
         sale_order_series_id  = $7,
         pos_search_sale_order = COALESCE($8, pos_search_sale_order),
         pos_search_product    = COALESCE($9, pos_search_product),
         primary_search        = COALESCE($10, primary_search)
       WHERE id=$11 RETURNING *`,
      [
        name?.trim() || null,
        warehouse_id || null, cash_account_id || null,
        is_active ?? null,
        pos_invoice_series_id || null, sale_return_series_id || null, sale_order_series_id || null,
        pos_search_sale_order ?? null, pos_search_product ?? null,
        primary_search || null,
        req.params.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) FROM pos_sessions WHERE counter_id=$1', [req.params.id]
    );
    if (Number(rows[0].count) > 0)
      return res.status(400).json({ error: 'Counter has sessions — cannot delete' });
    await pool.query('DELETE FROM pos_counters WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
