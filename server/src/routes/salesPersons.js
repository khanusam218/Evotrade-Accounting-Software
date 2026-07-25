const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { search, type } = req.query;
    let q = `SELECT * FROM sales_persons WHERE 1=1`;
    const p = [];
    if (type)   { p.push(type);          q += ` AND type=$${p.length}`; }
    if (search) { p.push(`%${search}%`); q += ` AND (code ILIKE $${p.length} OR print_name ILIKE $${p.length})`; }
    q += ' ORDER BY print_name';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sales_persons WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { print_name, type = 'salesman', phone, email, can_change_price = false, can_add_discount = false, is_manager = false, notes } = req.body;
  try {
    const { rows: codeRows } = await pool.query(
      "UPDATE number_series SET next_number=next_number+1 WHERE prefix='SP-' RETURNING lpad(next_number::text,padding::int,'0')"
    );
    const code = 'SP-' + codeRows[0].lpad;
    const { rows } = await pool.query(
      'INSERT INTO sales_persons (code,name,print_name,type,phone,email,can_change_price,can_add_discount,is_manager,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [code, print_name, print_name, type, phone || null, email || null, can_change_price, can_add_discount, is_manager, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { print_name, type, phone, email, can_change_price, can_add_discount, is_manager, notes } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE sales_persons SET print_name=$1,type=$2,phone=$3,email=$4,can_change_price=$5,can_add_discount=$6,is_manager=$7,notes=$8 WHERE id=$9 RETURNING *',
      [print_name, type, phone || null, email || null, can_change_price ?? false, can_add_discount ?? false, is_manager ?? false, notes || null, req.params.id]
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
