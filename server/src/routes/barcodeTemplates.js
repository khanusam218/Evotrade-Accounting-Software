const express = require('express');
const router  = express.Router();
const pool    = require('../db');

const FIELDS = `
  name, barcode_type, unit_of_measurement, template_types,
  page_width, page_height, cols, gap_h, rows, gap_v, quantity, print_on_laser,
  barcode_width, barcode_height, barcode_top_spacing,
  margin_top, margin_bottom, margin_left, margin_right,
  company_name_show, company_name_font_size, company_name_left,
  show_name, product_name_font_size, product_name_left,
  show_code, barcode_label_font_size, barcode_label_margin,
  show_price, product_price_font_size, product_price_margin, print_mrp,
  batch_number_barcode_show, batch_number_show, expiry_date_show,
  batch_number_font_size, expiry_date_font_size,
  is_default
`;

function extract(b) {
  return [
    b.name, b.barcode_type || 'CODE128',
    b.unit_of_measurement || 'in', b.template_types || [],
    b.page_width ?? 2, b.page_height ?? 0.9,
    b.cols ?? 1, b.gap_h ?? 0,
    b.rows ?? 1, b.gap_v ?? 0,
    b.quantity ?? 10, b.print_on_laser ?? false,
    b.barcode_width ?? 1.5, b.barcode_height ?? 28, b.barcode_top_spacing ?? 0,
    b.margin_top ?? 0, b.margin_bottom ?? 0, b.margin_left ?? 0, b.margin_right ?? 0,
    b.company_name_show ?? true, b.company_name_font_size ?? 10, b.company_name_left ?? 0,
    b.show_name ?? true, b.product_name_font_size ?? 10, b.product_name_left ?? 0,
    b.show_code ?? true, b.barcode_label_font_size ?? 11, b.barcode_label_margin ?? 2,
    b.show_price ?? true, b.product_price_font_size ?? 11, b.product_price_margin ?? 0, b.print_mrp ?? false,
    b.batch_number_barcode_show ?? false, b.batch_number_show ?? false, b.expiry_date_show ?? false,
    b.batch_number_font_size ?? 8, b.expiry_date_font_size ?? 8,
    b.is_default ?? false,
  ];
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM barcode_templates ORDER BY id');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM barcode_templates WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (req.body.is_default) await client.query('UPDATE barcode_templates SET is_default=false');
    const vals = extract(req.body);
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await client.query(
      `INSERT INTO barcode_templates (${FIELDS}) VALUES (${placeholders}) RETURNING *`, vals
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (req.body.is_default) {
      await client.query('UPDATE barcode_templates SET is_default=false WHERE id!=$1', [req.params.id]);
    }
    const vals = extract(req.body);
    const setClause = FIELDS.trim().split(/,\s*/).map((f, i) => `${f.trim()}=$${i + 1}`).join(', ');
    vals.push(req.params.id);
    const { rows } = await client.query(
      `UPDATE barcode_templates SET ${setClause} WHERE id=$${vals.length} RETURNING *`, vals
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM barcode_templates WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
