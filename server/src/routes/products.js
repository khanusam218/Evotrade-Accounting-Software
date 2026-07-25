const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function generateProductCode(client) {
  const { rows: nsRows } = await client.query(
    `SELECT prefix, next_number, padding FROM number_series WHERE name = 'Products' FOR UPDATE`
  );
  if (!nsRows.length) throw new Error('Product number series not configured');
  const { prefix, next_number, padding } = nsRows[0];

  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
     FROM products WHERE code ~ '^[A-Za-z]+-[0-9]+$'`
  );
  const useNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);

  await client.query(
    `UPDATE number_series SET next_number = $1 WHERE name = 'Products'`,
    [useNum + 1]
  );
  return `${prefix}${String(useNum).padStart(padding, '0')}`;
}

function buildWhere(query) {
  const { code, name, type, category_id, brand_id, is_active } = query;
  const conditions = [];
  const params = [];

  if (code) {
    params.push(`%${code}%`);
    conditions.push(`p.code ILIKE $${params.length}`);
  }
  if (name) {
    params.push(`%${name}%`);
    conditions.push(`p.name ILIKE $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`p.type = $${params.length}`);
  }
  if (category_id) {
    params.push(Number(category_id));
    conditions.push(`p.category_id = $${params.length}`);
  }
  if (brand_id) {
    params.push(Number(brand_id));
    conditions.push(`p.brand_id = $${params.length}`);
  }
  if (is_active !== undefined && is_active !== '') {
    params.push(is_active === 'true');
    conditions.push(`p.is_active = $${params.length}`);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/products/next-code
router.get('/next-code', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT prefix, next_number, padding FROM number_series WHERE name = 'Products'`
    );
    if (!rows.length) return res.status(404).json({ error: 'Number series not found' });
    const { prefix, next_number, padding } = rows[0];

    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
       FROM products WHERE code ~ '^[A-Za-z]+-[0-9]+$'`
    );
    const previewNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
    res.json({ code: `${prefix}${String(previewNum).padStart(padding, '0')}` });
  } catch (err) { next(err); }
});

// GET /api/products
router.get('/', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20')));
    const offset = (page - 1) * limit;

    const { where, params } = buildWhere(req.query);

    const countQ = await pool.query(
      `SELECT COUNT(*) FROM products p ${where}`, params
    );

    const dataQ = await pool.query(
      `SELECT p.*,
              pc.name  AS category_name,
              b.name   AS brand_name,
              t.name   AS purchase_tax_name
         FROM products p
         LEFT JOIN product_categories pc ON pc.id = p.category_id
         LEFT JOIN brands b              ON b.id  = p.brand_id
         LEFT JOIN taxes t               ON t.id  = p.purchase_tax_id
         ${where}
         ORDER BY p.created_at DESC
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

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              pc.name AS category_name,
              b.name  AS brand_name
         FROM products p
         LEFT JOIN product_categories pc ON pc.id = p.category_id
         LEFT JOIN brands b              ON b.id  = p.brand_id
        WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/products
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const code = await generateProductCode(client);

    const {
      name, type = 'product',
      category_id = null, brand_id = null,
      unit_of_measurement = 'PCS',
      fractional_units = false,
      track_inventory = false, manage_batch = false,
      manage_serial = false, has_packaging = false, is_assembled = false,
      is_purchased = false, purchase_price = null, purchase_tax_id = null,
      manage_purchase_tax = false,
      is_sold = false, sale_price = null, mrp = null,
      mrp_exclusive_of_tax = false, dont_allow_public = false,
      is_active = true,
      description = null, short_description = null,
    } = req.body;

    if (!name || !name.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'name is required' });
    }

    const { rows } = await client.query(
      `INSERT INTO products
         (code, name, type,
          category_id, brand_id, unit_of_measurement, fractional_units,
          track_inventory, manage_batch, manage_serial, has_packaging, is_assembled,
          is_purchased, purchase_price, purchase_tax_id, manage_purchase_tax,
          is_sold, sale_price, mrp, mrp_exclusive_of_tax, dont_allow_public,
          is_active, description, short_description)
       VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [
        code, name.trim(), type,
        category_id || null, brand_id || null,
        unit_of_measurement, fractional_units,
        track_inventory, manage_batch, manage_serial, has_packaging, is_assembled,
        is_purchased, purchase_price || null, purchase_tax_id || null, manage_purchase_tax,
        is_sold, sale_price || null, mrp || null,
        mrp_exclusive_of_tax, dont_allow_public, is_active,
        description || null, short_description || null,
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

// PUT /api/products/:id
router.put('/:id', async (req, res, next) => {
  try {
    const {
      name, type = 'product',
      category_id = null, brand_id = null,
      unit_of_measurement = 'PCS',
      fractional_units = false,
      is_purchased = false, purchase_price = null,
      purchase_tax_id = null, manage_purchase_tax = false,
      is_sold = false, sale_price = null, mrp = null,
      mrp_exclusive_of_tax = false, dont_allow_public = false,
      is_active = true,
      description = null, short_description = null,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Inventory toggles are intentionally excluded from UPDATE (immutable after first save)
    const { rows } = await pool.query(
      `UPDATE products SET
          name                 = $1,
          type                 = $2,
          category_id          = $3,
          brand_id             = $4,
          unit_of_measurement  = $5,
          fractional_units     = $6,
          is_purchased         = $7,
          purchase_price       = $8,
          purchase_tax_id      = $9,
          manage_purchase_tax  = $10,
          is_sold              = $11,
          sale_price           = $12,
          mrp                  = $13,
          mrp_exclusive_of_tax = $14,
          dont_allow_public    = $15,
          is_active            = $16,
          description          = $17,
          short_description    = $18
        WHERE id = $19
        RETURNING *`,
      [
        name.trim(), type,
        category_id || null, brand_id || null,
        unit_of_measurement, fractional_units,
        is_purchased, purchase_price || null,
        purchase_tax_id || null, manage_purchase_tax,
        is_sold, sale_price || null, mrp || null,
        mrp_exclusive_of_tax, dont_allow_public, is_active,
        description || null, short_description || null,
        req.params.id,
      ]
    );

    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/products/:id/stock-levels
router.get('/:id/stock-levels', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ps.id, ps.warehouse_id, w.name AS warehouse_name,
              ps.qty_on_hand, ps.min_stock_level
         FROM product_stock ps
         JOIN warehouses w ON w.id = ps.warehouse_id
        WHERE ps.product_id = $1
        ORDER BY w.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// PUT /api/products/:id/stock-levels/:warehouseId
router.put('/:id/stock-levels/:warehouseId', async (req, res, next) => {
  try {
    const { min_stock_level = 0 } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO product_stock (product_id, warehouse_id, min_stock_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, warehouse_id)
       DO UPDATE SET min_stock_level = EXCLUDED.min_stock_level
       RETURNING id, warehouse_id, qty_on_hand, min_stock_level`,
      [req.params.id, req.params.warehouseId, min_stock_level]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/products/:id/stock-levels/:warehouseId
router.delete('/:id/stock-levels/:warehouseId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT qty_on_hand FROM product_stock WHERE product_id = $1 AND warehouse_id = $2`,
      [req.params.id, req.params.warehouseId]
    );
    if (rows.length && Number(rows[0].qty_on_hand) === 0) {
      await pool.query(
        `DELETE FROM product_stock WHERE product_id = $1 AND warehouse_id = $2`,
        [req.params.id, req.params.warehouseId]
      );
    } else {
      await pool.query(
        `UPDATE product_stock SET min_stock_level = 0 WHERE product_id = $1 AND warehouse_id = $2`,
        [req.params.id, req.params.warehouseId]
      );
    }
    res.json({ message: 'Stock level removed' });
  } catch (err) { next(err); }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
