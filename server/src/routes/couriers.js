const express = require('express');
const router = express.Router();
const pool = require('../db');

async function peekNextCode(client) {
  const { rows } = await client.query(
    "SELECT 'COU-' || lpad((next_number)::text, padding::int, '0') AS code FROM number_series WHERE prefix='COU-'"
  );
  return rows[0]?.code || 'COU-000001';
}

async function consumeNextCode(client) {
  const { rows } = await client.query(
    "UPDATE number_series SET next_number=next_number+1 WHERE prefix='COU-' RETURNING 'COU-' || lpad(next_number::text,padding::int,'0') AS code"
  );
  return rows[0]?.code || 'COU-000001';
}

// GET next code (peek without consuming)
router.get('/next-code', async (req, res) => {
  const client = await pool.connect();
  try {
    const code = await peekNextCode(client);
    res.json({ code });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.get('/', async (req, res) => {
  try {
    const { search, code, contact_person, email, phone } = req.query;
    let q = `SELECT * FROM couriers WHERE 1=1`;
    const p = [];
    if (search)         { p.push(`%${search}%`);         q += ` AND (code ILIKE $${p.length} OR print_name ILIKE $${p.length})`; }
    if (code)           { p.push(`%${code}%`);           q += ` AND code ILIKE $${p.length}`; }
    if (contact_person) { p.push(`%${contact_person}%`); q += ` AND contact_person ILIKE $${p.length}`; }
    if (email)          { p.push(`%${email}%`);          q += ` AND email ILIKE $${p.length}`; }
    if (phone)          { p.push(`%${phone}%`);          q += ` AND (phone ILIKE $${p.length} OR phone2 ILIKE $${p.length} OR phone3 ILIKE $${p.length})`; }
    q += ' ORDER BY print_name';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM couriers WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const {
    print_name, courier_name, display_name, contact_person,
    phone, phone2, phone3, email,
    address, address2, city, state, zip, country,
    ntn, cnic, tracking_url, notes, is_active = true
  } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const code = await consumeNextCode(client);
    const { rows } = await client.query(
      `INSERT INTO couriers
        (code,print_name,courier_name,display_name,contact_person,phone,phone2,phone3,email,
         address,address2,city,state,zip,country,ntn,cnic,tracking_url,notes,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [code, print_name, courier_name||null, display_name||null, contact_person||null,
       phone||null, phone2||null, phone3||null, email||null,
       address||null, address2||null, city||null, state||null, zip||null, country||null,
       ntn||null, cnic||null, tracking_url||null, notes||null, is_active]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const {
    print_name, courier_name, display_name, contact_person,
    phone, phone2, phone3, email,
    address, address2, city, state, zip, country,
    ntn, cnic, tracking_url, notes, is_active
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE couriers SET
        print_name=$1, courier_name=$2, display_name=$3, contact_person=$4,
        phone=$5, phone2=$6, phone3=$7, email=$8,
        address=$9, address2=$10, city=$11, state=$12, zip=$13, country=$14,
        ntn=$15, cnic=$16, tracking_url=$17, notes=$18, is_active=$19
       WHERE id=$20 RETURNING *`,
      [print_name, courier_name||null, display_name||null, contact_person||null,
       phone||null, phone2||null, phone3||null, email||null,
       address||null, address2||null, city||null, state||null, zip||null, country||null,
       ntn||null, cnic||null, tracking_url||null, notes||null, is_active??true, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM couriers WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
