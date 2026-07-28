const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix } = require('../utils');

async function nextCode(client) {
  await getOrCreateSeriesByPrefix(client, 'OC-', 6);
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='OC-' RETURNING lpad(next_number::text,padding::int,'0')"
  );
  return 'OC-' + rows[0].lpad;
}

router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    let q = `SELECT * FROM other_contacts WHERE 1=1`;
    const p = [];
    if (category) { p.push(category);       q += ` AND category=$${p.length}`; }
    if (search)   { p.push(`%${search}%`);  q += ` AND (code ILIKE $${p.length} OR print_name ILIKE $${p.length} OR contact_person ILIKE $${p.length})`; }
    q += ' ORDER BY print_name';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM other_contacts WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { print_name, category, contact_person, phone, email, address, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const code = await nextCode(client);
    const { rows } = await client.query(
      'INSERT INTO other_contacts (code,print_name,category,contact_person,phone,email,address,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [code, print_name, category || null, contact_person || null, phone || null, email || null, address || null, notes || null]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { print_name, category, contact_person, phone, email, address, notes } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE other_contacts SET print_name=$1,category=$2,contact_person=$3,phone=$4,email=$5,address=$6,notes=$7 WHERE id=$8 RETURNING *',
      [print_name, category || null, contact_person || null, phone || null, email || null, address || null, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM other_contacts WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
