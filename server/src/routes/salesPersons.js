const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix, safeNextNumber } = require('../utils');

router.get('/', async (req, res) => {
  try {
    const { search, type } = req.query;
    let q = `SELECT sp.*, u.user_id AS application_user_login
               FROM sales_persons sp
               LEFT JOIN users u ON u.id = sp.application_user_id
              WHERE 1=1`;
    const p = [];
    if (type)   { p.push(type);          q += ` AND sp.type=$${p.length}`; }
    if (search) { p.push(`%${search}%`); q += ` AND (sp.code ILIKE $${p.length} OR sp.print_name ILIKE $${p.length})`; }
    q += ' ORDER BY sp.print_name';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sp.*, u.user_id AS application_user_login
         FROM sales_persons sp
         LEFT JOIN users u ON u.id = sp.application_user_id
        WHERE sp.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const {
    print_name, type = 'salesman', phone, email, can_change_price = false, can_add_discount = false, is_manager = false, notes,
    cash_account_id = null, sale_order_series_id = null, receive_payment_series_id = null,
    manager_id = null, application_user_id = null, branch_name = null,
  } = req.body;
  try {
    const series = await getOrCreateSeriesByPrefix(pool, 'SP-', 6);
    const code = await safeNextNumber(pool, series, 'prefix', 'SP-', 'sales_persons', 'code');
    const { rows } = await pool.query(
      `INSERT INTO sales_persons
         (code,name,print_name,type,phone,email,can_change_price,can_add_discount,is_manager,notes,
          cash_account_id,sale_order_series_id,receive_payment_series_id,manager_id,application_user_id,branch_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [code, print_name, print_name, type, phone || null, email || null, can_change_price, can_add_discount, is_manager, notes || null,
       cash_account_id || null, sale_order_series_id || null, receive_payment_series_id || null,
       manager_id || null, application_user_id || null, branch_name || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const {
    print_name, type, phone, email, can_change_price, can_add_discount, is_manager, notes,
    cash_account_id = null, sale_order_series_id = null, receive_payment_series_id = null,
    manager_id = null, application_user_id = null, branch_name = null,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE sales_persons SET
         print_name=$1,type=$2,phone=$3,email=$4,can_change_price=$5,can_add_discount=$6,is_manager=$7,notes=$8,
         cash_account_id=$9,sale_order_series_id=$10,receive_payment_series_id=$11,manager_id=$12,application_user_id=$13,
         branch_name=$14
       WHERE id=$15 RETURNING *`,
      [print_name, type, phone || null, email || null, can_change_price ?? false, can_add_discount ?? false, is_manager ?? false, notes || null,
       cash_account_id || null, sale_order_series_id || null, receive_payment_series_id || null,
       manager_id || null, application_user_id || null, branch_name || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM sales_persons WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
