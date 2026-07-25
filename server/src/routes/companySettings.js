const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM company_settings ORDER BY key');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(req.body)) {
      await client.query(
        `INSERT INTO company_settings (key, value, company_id)
         VALUES ($1, $2, current_company_id())
         ON CONFLICT (key, company_id) DO UPDATE SET value = $2`,
        [key, value ?? '']
      );
    }
    await client.query('COMMIT');
    const { rows } = await client.query('SELECT key, value FROM company_settings ORDER BY key');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.get('/number-series', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM number_series ORDER BY prefix');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/number-series/:prefix', async (req, res) => {
  const { next_number, padding } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE number_series SET next_number=$1,padding=$2 WHERE prefix=$3 RETURNING *',
      [next_number, padding, req.params.prefix]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
