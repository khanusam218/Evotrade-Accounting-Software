const express = require('express');
const router  = express.Router();
const pool    = require('../db');

async function nextNumber(client) {
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='SAU-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  if (!rows.length) return 'SAU-000001';
  return 'SAU-' + rows[0].lpad;
}

router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    let q = `SELECT sa.*, w.name AS warehouse_name,
               (SELECT COUNT(*) FROM stock_audit_lines sal WHERE sal.audit_id=sa.id) AS no_of_products
             FROM stock_audits sa
             LEFT JOIN warehouses w ON w.id=sa.warehouse_id WHERE 1=1`;
    const p = [];
    if (status) { p.push(status); q += ` AND sa.status=$${p.length}`; }
    if (search) { p.push(`%${search}%`); q += ` AND sa.number ILIKE $${p.length}`; }
    q += ' ORDER BY sa.date DESC, sa.id DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sa.*, w.name AS warehouse_name FROM stock_audits sa
       LEFT JOIN warehouses w ON w.id=sa.warehouse_id WHERE sa.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const audit = rows[0];
    const { rows: lines } = await pool.query(
      `SELECT l.*, p.name AS product_name, w.name AS line_warehouse_name
       FROM stock_audit_lines l
       LEFT JOIN products p ON p.id=l.product_id
       LEFT JOIN warehouses w ON w.id=l.warehouse_id
       WHERE l.audit_id=$1 ORDER BY l.id`, [audit.id]
    );
    audit.lines = lines;
    res.json(audit);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { warehouse_id, date, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await nextNumber(client);
    const { rows } = await client.query(
      'INSERT INTO stock_audits (number,warehouse_id,date) VALUES ($1,$2,$3) RETURNING *',
      [number, warehouse_id || null, date || new Date().toISOString().split('T')[0]]
    );
    const audit = rows[0];
    for (const l of lines) {
      if (!l.product_id) continue;
      await client.query(
        'INSERT INTO stock_audit_lines (audit_id,product_id,description,warehouse_id,quantity) VALUES ($1,$2,$3,$4,$5)',
        [audit.id, l.product_id, l.description || null, l.warehouse_id || null, l.quantity || 0]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(audit);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { warehouse_id, date, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE stock_audits SET warehouse_id=$1,date=$2 WHERE id=$3 AND status='draft' RETURNING *`,
      [warehouse_id || null, date, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    await client.query('DELETE FROM stock_audit_lines WHERE audit_id=$1', [req.params.id]);
    for (const l of lines) {
      if (!l.product_id) continue;
      await client.query(
        'INSERT INTO stock_audit_lines (audit_id,product_id,description,warehouse_id,quantity) VALUES ($1,$2,$3,$4,$5)',
        [rows[0].id, l.product_id, l.description || null, l.warehouse_id || null, l.quantity || 0]
      );
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE stock_audits SET status='completed' WHERE id=$1 AND status='draft' RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM stock_audits WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
