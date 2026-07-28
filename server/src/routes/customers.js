const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries } = require('../utils');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function generateCustomerCode(client) {
  const { prefix, next_number, padding } = await getOrCreateSeries(client, 'Customers', 'C-', 6);

  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
     FROM customers WHERE code ~ '^[A-Za-z]+-[0-9]+$'`
  );
  const useNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);

  await client.query(
    `UPDATE number_series SET next_number = $1 WHERE name = 'Customers'`,
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
    conditions.push(`c.code ILIKE $${params.length}`);
  }
  if (name) {
    params.push(`%${name}%`);
    conditions.push(`c.print_name ILIKE $${params.length}`);
  }
  if (category_id) {
    params.push(Number(category_id));
    conditions.push(`c.category_id = $${params.length}`);
  }
  if (is_active !== undefined && is_active !== '') {
    params.push(is_active === 'true');
    conditions.push(`c.is_active = $${params.length}`);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/customers/next-code  — MUST be before /:id
router.get('/next-code', async (_req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { prefix, next_number, padding } = await getOrCreateSeries(client, 'Customers', 'C-', 6);

    const { rows: maxRows } = await client.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
       FROM customers WHERE code ~ '^[A-Za-z]+-[0-9]+$'`
    );
    const previewNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
    await client.query('COMMIT');
    res.json({ code: `${prefix}${String(previewNum).padStart(padding, '0')}` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/customers
router.get('/', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20')));
    const offset = (page - 1) * limit;

    const { where, params } = buildWhere(req.query);

    const countQ = await pool.query(
      `SELECT COUNT(*) FROM customers c ${where}`,
      params
    );

    const dataQ = await pool.query(
      `SELECT c.*,
              cc.name AS category_name
         FROM customers c
         LEFT JOIN customer_categories cc ON cc.id = c.category_id
         ${where}
         ORDER BY c.created_at DESC
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

// GET /api/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, cc.name AS category_name
         FROM customers c
         LEFT JOIN customer_categories cc ON cc.id = c.category_id
        WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/customers
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const code = await generateCustomerCode(client);

    const {
      print_name,
      email_1 = null, email_2 = null, email_3 = null,
      phone_1 = null, phone_2 = null, phone_3 = null,
      longitude = null, latitude = null,
      opening_balance = 0, credit_limit = 0,
      default_discount_percent = 0,
      discount_account_id = null,
      withholding_tax_percent = 0,
      category_id = null,
      contact_person = null,
      is_active = true,
      profile_image = null,
      address_line_1 = null, address_line_2 = null,
      city = null, state_province = null, country = null, zip_code = null,
    } = req.body;

    if (!print_name || !print_name.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'print_name is required' });
    }

    const { rows } = await client.query(
      `INSERT INTO customers
         (code, print_name,
          email_1, email_2, email_3,
          phone_1, phone_2, phone_3,
          longitude, latitude,
          opening_balance, credit_limit,
          default_discount_percent, discount_account_id,
          withholding_tax_percent, category_id,
          contact_person, is_active, profile_image,
          address_line_1, address_line_2, city, state_province, country, zip_code)
       VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       RETURNING *`,
      [
        code, print_name.trim(),
        email_1, email_2, email_3,
        phone_1, phone_2, phone_3,
        longitude || null, latitude || null,
        opening_balance, credit_limit,
        default_discount_percent, discount_account_id || null,
        withholding_tax_percent, category_id || null,
        contact_person, is_active, profile_image || null,
        address_line_1 || null, address_line_2 || null,
        city || null, state_province || null, country || null, zip_code || null,
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

// PUT /api/customers/:id
router.put('/:id', async (req, res, next) => {
  try {
    const {
      print_name,
      email_1 = null, email_2 = null, email_3 = null,
      phone_1 = null, phone_2 = null, phone_3 = null,
      longitude = null, latitude = null,
      opening_balance = 0, credit_limit = 0,
      default_discount_percent = 0,
      discount_account_id = null,
      withholding_tax_percent = 0,
      category_id = null,
      contact_person = null,
      is_active = true,
      profile_image = null,
      address_line_1 = null, address_line_2 = null,
      city = null, state_province = null, country = null, zip_code = null,
    } = req.body;

    if (!print_name || !print_name.trim()) {
      return res.status(400).json({ error: 'print_name is required' });
    }

    const { rows } = await pool.query(
      `UPDATE customers SET
          print_name               = $1,
          email_1                  = $2,
          email_2                  = $3,
          email_3                  = $4,
          phone_1                  = $5,
          phone_2                  = $6,
          phone_3                  = $7,
          longitude                = $8,
          latitude                 = $9,
          opening_balance          = $10,
          credit_limit             = $11,
          default_discount_percent = $12,
          discount_account_id      = $13,
          withholding_tax_percent  = $14,
          category_id              = $15,
          contact_person           = $16,
          is_active                = $17,
          profile_image            = $18,
          address_line_1           = $19,
          address_line_2           = $20,
          city                     = $21,
          state_province           = $22,
          country                  = $23,
          zip_code                 = $24
        WHERE id = $25
        RETURNING *`,
      [
        print_name.trim(),
        email_1, email_2, email_3,
        phone_1, phone_2, phone_3,
        longitude || null, latitude || null,
        opening_balance, credit_limit,
        default_discount_percent, discount_account_id || null,
        withholding_tax_percent, category_id || null,
        contact_person, is_active, profile_image || null,
        address_line_1 || null, address_line_2 || null,
        city || null, state_province || null, country || null, zip_code || null,
        req.params.id,
      ]
    );

    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM customers WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
