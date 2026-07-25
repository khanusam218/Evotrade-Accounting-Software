const express = require('express');
const router = express.Router();
const pool = require('../db');

async function saveComponents(client, bomId, components) {
  await client.query('DELETE FROM bom_components WHERE bom_id=$1', [bomId]);
  for (const c of components) {
    await client.query(
      'INSERT INTO bom_components (bom_id,component_product_id,quantity,notes) VALUES ($1,$2,$3,$4)',
      [bomId, c.component_product_id, c.quantity || 1, c.notes || null]
    );
  }
}

router.get('/', async (req, res) => {
  try {
    const { search, is_active } = req.query;
    let q = `SELECT b.*, p.name AS product_name FROM bill_of_materials b LEFT JOIN products p ON p.id=b.product_id WHERE 1=1`;
    const params = [];
    if (is_active !== undefined) { params.push(is_active === 'true'); q += ` AND b.is_active=$${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (b.name ILIKE $${params.length} OR p.name ILIKE $${params.length})`; }
    q += ' ORDER BY b.name';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT b.*, p.name AS product_name FROM bill_of_materials b LEFT JOIN products p ON p.id=b.product_id WHERE b.id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const bom = rows[0];
    const { rows: comps } = await pool.query(
      `SELECT c.*, p.name AS component_name FROM bom_components c LEFT JOIN products p ON p.id=c.component_product_id WHERE c.bom_id=$1 ORDER BY c.id`, [bom.id]
    );
    bom.components = comps;
    res.json(bom);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { product_id, name, output_qty = 1, notes, components = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO bill_of_materials (product_id,name,output_qty,notes) VALUES ($1,$2,$3,$4) RETURNING *',
      [product_id, name, output_qty, notes || null]
    );
    await saveComponents(client, rows[0].id, components);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { product_id, name, output_qty, notes, is_active, components = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE bill_of_materials SET product_id=$1,name=$2,output_qty=$3,notes=$4,is_active=$5 WHERE id=$6 RETURNING *',
      [product_id, name, output_qty || 1, notes || null, is_active ?? true, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    await saveComponents(client, rows[0].id, components);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bill_of_materials WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
