const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function generateVendorCode(client) {
  const { rows: nsRows } = await client.query(
    `SELECT prefix, next_number, padding FROM number_series WHERE name = 'Vendors' FOR UPDATE`
  );
  if (!nsRows.length) throw new Error('Vendor number series not configured');
  const { prefix, next_number, padding } = nsRows[0];

  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
     FROM vendors WHERE code ~ '^[A-Za-z]+-[0-9]+$'`
  );
  const useNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);

  await client.query(
    `UPDATE number_series SET next_number = $1 WHERE name = 'Vendors'`,
    [useNum + 1]
  );
  return `${prefix}${String(useNum).padStart(padding, '0')}`;
}

function buildWhere(query) {
  const { code, name, category_id, is_active } = query;
  const conditions = [];
  const params = [];

  if (code) {
    params.push(`%${code}%`);
    conditions.push(`v.code ILIKE $${params.length}`);
  }
  if (name) {
    params.push(`%${name}%`);
    conditions.push(`v.print_name ILIKE $${params.length}`);
  }
  if (category_id) {
    params.push(Number(category_id));
    conditions.push(`v.category_id = $${params.length}`);
  }
  if (is_active !== undefined && is_active !== '') {
    params.push(is_active === 'true');
    conditions.push(`v.is_active = $${params.length}`);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/vendors/next-code  — MUST be before /:id
router.get('/next-code', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number, padding FROM number_series WHERE name = 'Vendors'`
    );
    if (!rows.length) return res.status(404).json({ error: 'Number series not found' });
    const { prefix, next_number, padding } = rows[0];

    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
       FROM vendors WHERE code ~ '^[A-Za-z]+-[0-9]+$'`
    );
    const previewNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
    res.json({ code: `${prefix}${String(previewNum).padStart(padding, '0')}` });
  } catch (err) { next(err); }
});

// GET /api/vendors
router.get('/', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20')));
    const offset = (page - 1) * limit;

    const { where, params } = buildWhere(req.query);

    const countQ = await pool.query(
      `SELECT COUNT(*) FROM vendors v ${where}`, params
    );

    const dataQ = await pool.query(
      `SELECT v.*, vc.name AS category_name
         FROM vendors v
         LEFT JOIN vendor_categories vc ON vc.id = v.category_id
         ${where}
         ORDER BY v.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      data:  dataQ.rows,
      total: parseInt(countQ.rows[0].count),
      page,
      limit,
    });
  } catch (err) { next(err); }
});

// GET /api/vendors/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT v.*, vc.name AS category_name
         FROM vendors v
         LEFT JOIN vendor_categories vc ON vc.id = v.category_id
        WHERE v.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vendor not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/vendors
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const code = await generateVendorCode(client);

    const {
      print_name,
      email         = null,
      phone_1       = null,
      phone_2       = null,
      category_id   = null,
      opening_balance   = 0,
      credit_limit_days = 0,
      is_principal  = false,
      contact_person = null,
      address       = null,
      is_active     = true,
    } = req.body;

    if (!print_name || !print_name.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'print_name is required' });
    }

    const { rows } = await client.query(
      `INSERT INTO vendors
         (code, print_name, email, phone_1, phone_2,
          category_id, opening_balance, credit_limit_days,
          is_principal, contact_person, address, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        code, print_name.trim(), email, phone_1, phone_2,
        category_id || null, opening_balance, credit_limit_days,
        is_principal, contact_person, address, is_active,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT /api/vendors/:id
router.put('/:id', async (req, res, next) => {
  try {
    const {
      print_name,
      email         = null,
      phone_1       = null,
      phone_2       = null,
      category_id   = null,
      opening_balance   = 0,
      credit_limit_days = 0,
      is_principal  = false,
      contact_person = null,
      address       = null,
      is_active     = true,
    } = req.body;

    if (!print_name || !print_name.trim()) {
      return res.status(400).json({ error: 'print_name is required' });
    }

    const { rows } = await pool.query(
      `UPDATE vendors SET
          print_name        = $1,
          email             = $2,
          phone_1           = $3,
          phone_2           = $4,
          category_id       = $5,
          opening_balance   = $6,
          credit_limit_days = $7,
          is_principal      = $8,
          contact_person    = $9,
          address           = $10,
          is_active         = $11
        WHERE id = $12
        RETURNING *`,
      [
        print_name.trim(), email, phone_1, phone_2,
        category_id || null, opening_balance, credit_limit_days,
        is_principal, contact_person, address, is_active,
        req.params.id,
      ]
    );

    if (!rows.length) return res.status(404).json({ error: 'Vendor not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/vendors/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM vendors WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
