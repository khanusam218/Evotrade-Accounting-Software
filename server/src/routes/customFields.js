const express = require('express');
const router  = express.Router();
const pool    = require('../db');

const VALID_ENTITY_TYPES = ['customer', 'vendor', 'product'];

function checkEntityType(entity_type, res) {
  if (!VALID_ENTITY_TYPES.includes(entity_type)) {
    res.status(400).json({ error: `entity_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}` });
    return false;
  }
  return true;
}

// GET /api/custom-fields/definitions?entity_type=vendor
router.get('/definitions', async (req, res, next) => {
  const { entity_type } = req.query;
  if (!checkEntityType(entity_type, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, entity_type, name FROM custom_field_definitions
        WHERE entity_type = $1 AND is_active = true
        ORDER BY name`,
      [entity_type]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/custom-fields/definitions  { entity_type, name }
router.post('/definitions', async (req, res, next) => {
  const { entity_type, name } = req.body;
  if (!checkEntityType(entity_type, res)) return;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO custom_field_definitions (entity_type, name) VALUES ($1, $2) RETURNING id, entity_type, name`,
      [entity_type, name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'A field with this name already exists.' });
    next(err);
  }
});

// DELETE /api/custom-fields/definitions/:id
router.delete('/definitions/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE custom_field_definitions SET is_active = false WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Field not found' });
    res.json({ message: 'Field removed' });
  } catch (err) { next(err); }
});

// GET /api/custom-fields/values?entity_type=vendor&entity_id=5
router.get('/values', async (req, res, next) => {
  const { entity_type, entity_id } = req.query;
  if (!checkEntityType(entity_type, res)) return;
  if (!entity_id) return res.status(400).json({ error: 'entity_id is required' });
  try {
    const { rows } = await pool.query(
      `SELECT v.id, v.definition_id, d.name AS field_name, v.value
         FROM custom_field_values v
         JOIN custom_field_definitions d ON d.id = v.definition_id
        WHERE v.entity_type = $1 AND v.entity_id = $2 AND d.is_active = true
        ORDER BY d.name`,
      [entity_type, entity_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// PUT /api/custom-fields/values  { entity_type, entity_id, values: [{ definition_id, value }] }
// Upserts every row given; this is the full set for the record (the caller
// resends the whole list each save, same pattern as other line-item tabs).
router.put('/values', async (req, res, next) => {
  const { entity_type, entity_id, values } = req.body;
  if (!checkEntityType(entity_type, res)) return;
  if (!entity_id) return res.status(400).json({ error: 'entity_id is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM custom_field_values WHERE entity_type = $1 AND entity_id = $2`, [entity_type, entity_id]);
    for (const v of values || []) {
      if (!v.definition_id) continue;
      await client.query(
        `INSERT INTO custom_field_values (entity_type, entity_id, definition_id, value) VALUES ($1,$2,$3,$4)`,
        [entity_type, entity_id, v.definition_id, v.value ?? null]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Saved' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
