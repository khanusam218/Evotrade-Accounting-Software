const express = require('express');
const router = express.Router();
const pool = require('../db');

function autoCode(name) {
  return (name || '').replace(/\s+/g, '').slice(0, 6).toUpperCase() || 'WH';
}

async function uniqueCode(base, excludeId = null) {
  let code = base;
  let i = 1;
  while (true) {
    const q = excludeId
      ? await pool.query('SELECT id FROM warehouses WHERE code=$1 AND id<>$2', [code, excludeId])
      : await pool.query('SELECT id FROM warehouses WHERE code=$1', [code]);
    if (!q.rows.length) return code;
    code = base + i++;
  }
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM warehouses ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM warehouses WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const {
    name, code, address, is_active = true,
    address_line1, address_line2, city, state, zip, country,
    contact_person, email, phone, fax,
  } = req.body;
  try {
    const finalCode = code || await uniqueCode(autoCode(name));
    const { rows } = await pool.query(
      `INSERT INTO warehouses
         (name, code, address, is_active,
          address_line1, address_line2, city, state, zip, country,
          contact_person, email, phone, fax)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [name, finalCode, address || null, is_active,
       address_line1 || null, address_line2 || null, city || null, state || null,
       zip || null, country || null, contact_person || null, email || null,
       phone || null, fax || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const {
    name, code, address, is_active,
    address_line1, address_line2, city, state, zip, country,
    contact_person, email, phone, fax,
  } = req.body;
  try {
    const finalCode = code || await uniqueCode(autoCode(name), req.params.id);
    const { rows } = await pool.query(
      `UPDATE warehouses SET
         name=$1, code=$2, address=$3, is_active=$4,
         address_line1=$5, address_line2=$6, city=$7, state=$8, zip=$9, country=$10,
         contact_person=$11, email=$12, phone=$13, fax=$14
       WHERE id=$15 RETURNING *`,
      [name, finalCode, address || null, is_active ?? true,
       address_line1 || null, address_line2 || null, city || null, state || null,
       zip || null, country || null, contact_person || null, email || null,
       phone || null, fax || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM warehouses WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
