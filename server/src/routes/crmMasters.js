const express = require('express');
const router = express.Router();
const pool = require('../db');

// Generic CRUD factory
function makeCrud(table, orderBy = 'id') {
  return {
    getAll: async (req, res) => {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
        res.json(rows);
      } catch (err) { res.status(500).json({ error: err.message }); }
    },
    create: async (req, res) => {
      const fields = Object.keys(req.body);
      const values = Object.values(req.body);
      const cols = fields.join(',');
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(',');
      try {
        const { rows } = await pool.query(
          `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`, values
        );
        res.status(201).json(rows[0]);
      } catch (err) { res.status(500).json({ error: err.message }); }
    },
    update: async (req, res) => {
      const fields = Object.keys(req.body);
      const values = Object.values(req.body);
      const sets = fields.map((f, i) => `${f}=$${i + 1}`).join(',');
      try {
        const { rows } = await pool.query(
          `UPDATE ${table} SET ${sets} WHERE id=$${fields.length + 1} RETURNING *`,
          [...values, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
      } catch (err) { res.status(500).json({ error: err.message }); }
    },
    del: async (req, res) => {
      try {
        await pool.query(`DELETE FROM ${table} WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  };
}

// Ticket Tags
const tags = makeCrud('ticket_tags', 'name');
router.get('/ticket-tags', tags.getAll);
router.post('/ticket-tags', tags.create);
router.put('/ticket-tags/:id', tags.update);
router.delete('/ticket-tags/:id', tags.del);

// Lead Sources
const sources = makeCrud('lead_sources', 'name');
router.get('/lead-sources', sources.getAll);
router.post('/lead-sources', sources.create);
router.put('/lead-sources/:id', sources.update);
router.delete('/lead-sources/:id', sources.del);

// Lead Statuses
const statuses = makeCrud('lead_statuses', 'sort_order');
router.get('/lead-statuses', statuses.getAll);
router.post('/lead-statuses', statuses.create);
router.put('/lead-statuses/:id', statuses.update);
router.delete('/lead-statuses/:id', statuses.del);

// Event Types
const eventTypes = makeCrud('crm_event_types', 'name');
router.get('/event-types', eventTypes.getAll);
router.post('/event-types', eventTypes.create);
router.put('/event-types/:id', eventTypes.update);
router.delete('/event-types/:id', eventTypes.del);

// Industries
const industries = makeCrud('crm_industries', 'name');
router.get('/industries', industries.getAll);
router.post('/industries', industries.create);
router.put('/industries/:id', industries.update);
router.delete('/industries/:id', industries.del);

module.exports = router;
