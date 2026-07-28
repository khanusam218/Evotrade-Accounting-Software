const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix } = require('../utils');

async function nextCode(client) {
  await getOrCreateSeriesByPrefix(client, 'PROS-', 6);
  const { rows: nsRows } = await client.query(
    "SELECT prefix, next_number, padding FROM number_series WHERE prefix='PROS-' FOR UPDATE"
  );
  if (!nsRows.length) throw new Error('Prospect number series not configured');
  const { prefix, next_number, padding } = nsRows[0];
  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
     FROM prospects WHERE code ~ '^PROS-[0-9]+$'`
  );
  const useNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
  await client.query("UPDATE number_series SET next_number=$1 WHERE prefix='PROS-'", [useNum + 1]);
  return `${prefix}${String(useNum).padStart(padding, '0')}`;
}

const FIELDS = [
  'print_name','display_name','contact_person',
  'phone','phone_2','phone_3','email',
  'address_line_1','address_line_2','city','state','zip','country',
  'ntn','cnic','industry','source','notes','status','photo_url',
];

router.get('/next-code', async (_req, res) => {
  try {
    await getOrCreateSeriesByPrefix(pool, 'PROS-', 6);
    const { rows } = await pool.query("SELECT prefix, next_number, padding FROM number_series WHERE prefix='PROS-'");
    if (!rows.length) return res.json({ code: 'PROS-000001' });
    const { prefix, next_number, padding } = rows[0];
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(code,'[^0-9]','','g') AS INTEGER)),0) AS max_num FROM prospects WHERE code ~ '^PROS-[0-9]+$'`
    );
    const preview = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
    res.json({ code: `${prefix}${String(preview).padStart(padding, '0')}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    let q = `SELECT p.*, c.print_name AS converted_customer_name FROM prospects p LEFT JOIN customers c ON c.id=p.converted_to_customer_id WHERE 1=1`;
    const p = [];
    if (status) { p.push(status);       q += ` AND p.status=$${p.length}`; }
    if (search) { p.push(`%${search}%`); q += ` AND (p.code ILIKE $${p.length} OR p.print_name ILIKE $${p.length} OR p.contact_person ILIKE $${p.length})`; }
    q += ' ORDER BY p.print_name';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT p.*, c.print_name AS converted_customer_name FROM prospects p LEFT JOIN customers c ON c.id=p.converted_to_customer_id WHERE p.id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const code = await nextCode(client);
    const activeFields = FIELDS.filter(f => req.body[f] !== undefined);
    const vals = activeFields.map(f => req.body[f] ?? null);
    const cols = activeFields.join(',');
    const placeholders = activeFields.map((_, i) => `$${i + 2}`).join(',');
    const { rows } = await client.query(
      `INSERT INTO prospects (code${cols ? ',' + cols : ''}) VALUES ($1${placeholders ? ',' + placeholders : ''}) RETURNING *`,
      [code, ...vals]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  try {
    const vals = FIELDS.map(f => req.body[f] ?? null);
    const setClauses = FIELDS.map((f, i) => `${f}=$${i + 1}`).join(',');
    const { rows } = await pool.query(
      `UPDATE prospects SET ${setClauses} WHERE id=$${FIELDS.length + 1} RETURNING *`,
      [...vals, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/convert', async (req, res) => {
  const { customer_id } = req.body;
  try {
    const { rows } = await pool.query(
      "UPDATE prospects SET status='converted', converted_to_customer_id=$1 WHERE id=$2 AND status='active' RETURNING *",
      [customer_id, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or already converted' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM prospects WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
