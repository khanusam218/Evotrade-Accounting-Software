const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeriesByPrefix, safeNextNumber } = require('../utils');

async function nextNumber(client) {
  const series = await getOrCreateSeriesByPrefix(client, 'WO-', 6);
  return safeNextNumber(client, series, 'prefix', 'WO-', 'work_orders', 'number');
}

async function saveComponents(client, workOrderId, components) {
  await client.query('DELETE FROM work_order_components WHERE work_order_id=$1', [workOrderId]);
  for (const c of components) {
    if (!c.product_id || !(Number(c.quantity) > 0)) continue;
    await client.query(
      'INSERT INTO work_order_components (work_order_id, component_product_id, quantity) VALUES ($1,$2,$3)',
      [workOrderId, c.product_id, Number(c.quantity)]
    );
  }
}

router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    let q = `SELECT wo.*, b.name AS bom_name, p.name AS product_name, w.name AS warehouse_name
             FROM work_orders wo
             LEFT JOIN bill_of_materials b ON b.id=wo.bom_id
             LEFT JOIN products p ON p.id=b.product_id
             LEFT JOIN warehouses w ON w.id=wo.warehouse_id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND wo.status=$${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (wo.number ILIKE $${params.length} OR b.name ILIKE $${params.length})`; }
    q += ' ORDER BY wo.date DESC, wo.id DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT wo.*, b.name AS bom_name, p.name AS product_name, w.name AS warehouse_name
       FROM work_orders wo
       LEFT JOIN bill_of_materials b ON b.id=wo.bom_id
       LEFT JOIN products p ON p.id=b.product_id
       LEFT JOIN warehouses w ON w.id=wo.warehouse_id WHERE wo.id=$1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const wo = rows[0];
    const { rows: overrides } = await pool.query(
      `SELECT woc.id, woc.component_product_id, woc.quantity, p.name AS component_name,
              COALESCE(ps.qty_on_hand, 0) AS qty_on_hand
       FROM work_order_components woc
       LEFT JOIN products p ON p.id=woc.component_product_id
       LEFT JOIN product_stock ps ON ps.product_id=woc.component_product_id AND ps.warehouse_id=$2
       WHERE woc.work_order_id=$1`, [wo.id, wo.warehouse_id]
    );
    if (overrides.length) {
      wo.components = overrides;
      wo.components_source = 'work_order';
    } else {
      const { rows: comps } = await pool.query(
        `SELECT bc.*, p.name AS component_name,
                COALESCE(ps.qty_on_hand, 0) AS qty_on_hand
         FROM bom_components bc
         LEFT JOIN products p ON p.id=bc.component_product_id
         LEFT JOIN product_stock ps ON ps.product_id=bc.component_product_id AND ps.warehouse_id=$2
         WHERE bc.bom_id=$1`, [wo.bom_id, wo.warehouse_id]
      );
      wo.components = comps;
      wo.components_source = 'bom';
    }
    res.json(wo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { bom_id, warehouse_id, date, planned_qty = 1, notes, components = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await nextNumber(client);
    const { rows } = await client.query(
      'INSERT INTO work_orders (number,date,bom_id,warehouse_id,planned_qty,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [number, date, bom_id, warehouse_id || null, planned_qty, notes || null]
    );
    await saveComponents(client, rows[0].id, components);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const { bom_id, warehouse_id, date, planned_qty, produced_qty, notes, components = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE work_orders SET bom_id=$1,warehouse_id=$2,date=$3,planned_qty=$4,produced_qty=$5,notes=$6 WHERE id=$7 AND status IN ('draft','in_progress') RETURNING *",
      [bom_id, warehouse_id || null, date, planned_qty || 1, produced_qty || 0, notes || null, req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Not found or cannot edit' }); }
    await saveComponents(client, req.params.id, components);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/start', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE work_orders SET status='in_progress' WHERE id=$1 AND status='draft' RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or not draft' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/complete', async (req, res) => {
  const { produced_qty } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "UPDATE work_orders SET status='completed',produced_qty=$1 WHERE id=$2 AND status IN ('draft','in_progress') RETURNING *",
      [produced_qty, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or cannot complete' });
    const wo = rows[0];
    const { rows: bom } = await client.query('SELECT * FROM bill_of_materials WHERE id=$1', [wo.bom_id]);
    const factor = produced_qty / bom[0].output_qty;
    if (wo.warehouse_id) {
      const { rows: overrides } = await client.query('SELECT * FROM work_order_components WHERE work_order_id=$1', [wo.id]);
      if (overrides.length) {
        // Overrides were entered against the original planned_qty, so scale
        // them the same way the BOM fallback scales against bom.output_qty —
        // proportionally to how much was actually produced.
        const woFactor = Number(wo.planned_qty) > 0 ? produced_qty / Number(wo.planned_qty) : 1;
        for (const c of overrides) {
          if (!c.component_product_id) continue;
          await client.query(
            `UPDATE product_stock SET qty_on_hand=qty_on_hand - $1 WHERE product_id=$2 AND warehouse_id=$3`,
            [c.quantity * woFactor, c.component_product_id, wo.warehouse_id]
          );
        }
      } else {
        const { rows: comps } = await client.query('SELECT * FROM bom_components WHERE bom_id=$1', [wo.bom_id]);
        for (const c of comps) {
          await client.query(
            `UPDATE product_stock SET qty_on_hand=qty_on_hand - $1 WHERE product_id=$2 AND warehouse_id=$3`,
            [c.quantity * factor, c.component_product_id, wo.warehouse_id]
          );
        }
      }
      await client.query(
        `INSERT INTO product_stock (product_id,warehouse_id,qty_on_hand) VALUES ($1,$2,$3)
         ON CONFLICT (product_id,warehouse_id) DO UPDATE SET qty_on_hand=product_stock.qty_on_hand + $3`,
        [bom[0].product_id, wo.warehouse_id, produced_qty]
      );
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE work_orders SET status='cancelled' WHERE id=$1 AND status IN ('draft','in_progress') RETURNING *", [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Not found or cannot cancel' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM work_orders WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft work orders can be deleted' });
    await pool.query('DELETE FROM work_orders WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
