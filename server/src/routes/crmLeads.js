const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getOrCreateSeries, getOrCreateSeriesByPrefix } = require('../utils');

async function generateCustomerCode(client) {
  const { prefix, next_number, padding } = await getOrCreateSeries(client, 'Customers', 'C-', 6);
  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
     FROM customers WHERE code ~ '^[A-Za-z]+-[0-9]+$'`
  );
  const useNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
  await client.query(`UPDATE number_series SET next_number = $1 WHERE name = 'Customers'`, [useNum + 1]);
  return `${prefix}${String(useNum).padStart(padding, '0')}`;
}

async function generateLeadNumber(client) {
  await getOrCreateSeriesByPrefix(client, 'L-', 5);
  const { rows: nsRows } = await client.query(
    `SELECT prefix, next_number, padding FROM number_series WHERE prefix = 'L-' FOR UPDATE`
  );
  if (!nsRows.length) throw new Error('Lead number series not configured');
  const { prefix, next_number, padding } = nsRows[0];

  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
     FROM crm_leads WHERE number ~ '^L-[0-9]+$'`
  );
  const useNum = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);

  await client.query(`UPDATE number_series SET next_number = $1 WHERE prefix = 'L-'`, [useNum + 1]);
  return `${prefix}${String(useNum).padStart(padding, '0')}`;
}

router.get('/next-number', async (_req, res) => {
  try {
    await getOrCreateSeriesByPrefix(pool, 'L-', 5);
    const { rows } = await pool.query(`SELECT prefix, next_number, padding FROM number_series WHERE prefix = 'L-'`);
    if (!rows.length) return res.json({ number: 'L-00001' });
    const { prefix, next_number, padding } = rows[0];
    const { rows: maxRows } = await pool.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num FROM crm_leads WHERE number ~ '^L-[0-9]+$'`
    );
    const preview = Math.max(Number(next_number), Number(maxRows[0].max_num) + 1);
    res.json({ number: `${prefix}${String(preview).padStart(padding, '0')}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { stage, search } = req.query;
    let q = 'SELECT * FROM crm_leads WHERE 1=1';
    const p = [];
    if (stage)  { p.push(stage);        q += ` AND stage=$${p.length}`; }
    if (search) { p.push(`%${search}%`); q += ` AND (name ILIKE $${p.length} OR company ILIKE $${p.length} OR email ILIKE $${p.length})`; }
    q += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM crm_leads WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const lead = rows[0];
    const { rows: acts } = await pool.query('SELECT * FROM crm_activities WHERE lead_id=$1 ORDER BY date DESC, id DESC', [lead.id]);
    lead.activities = acts;
    res.json(lead);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const number = await generateLeadNumber(client);
    const {
      name, company, email, phone, source, stage = 'new',
      probability = 0, expected_revenue = 0, assigned_to, notes,
      lead_status, industry, website, lead_date, annual_revenue,
      num_employees, contact_name, tag,
    } = req.body;
    const { rows } = await client.query(
      `INSERT INTO crm_leads
         (number, name, company, email, phone, source, stage, probability, expected_revenue,
          assigned_to, notes, lead_status, industry, website, lead_date,
          annual_revenue, num_employees, contact_name, tag)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [number, name, company||null, email||null, phone||null, source||null, stage,
       probability, expected_revenue, assigned_to||null, notes||null,
       lead_status||null, industry||null, website||null,
       lead_date || new Date().toISOString().slice(0,10),
       annual_revenue||0, num_employees||0, contact_name||null, tag||null]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const {
    name, company, email, phone, source, stage, probability, expected_revenue,
    assigned_to, notes, lead_status, industry, website, lead_date,
    annual_revenue, num_employees, contact_name, tag,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE crm_leads SET
         name=$1, company=$2, email=$3, phone=$4, source=$5, stage=$6,
         probability=$7, expected_revenue=$8, assigned_to=$9, notes=$10,
         lead_status=$11, industry=$12, website=$13, lead_date=$14,
         annual_revenue=$15, num_employees=$16, contact_name=$17, tag=$18
       WHERE id=$19 RETURNING *`,
      [name, company||null, email||null, phone||null, source||null, stage||'new',
       probability||0, expected_revenue||0, assigned_to||null, notes||null,
       lead_status||null, industry||null, website||null,
       lead_date || new Date().toISOString().slice(0,10),
       annual_revenue||0, num_employees||0, contact_name||null, tag||null,
       req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM crm_leads WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/convert', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: leadRows } = await client.query('SELECT * FROM crm_leads WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!leadRows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    const lead = leadRows[0];
    if (lead.converted_to_customer_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Lead already converted' });
    }

    const code = await generateCustomerCode(client);
    const printName = lead.company || lead.contact_name || lead.name;
    const { rows: custRows } = await client.query(
      `INSERT INTO customers (code, print_name, email_1, phone_1, contact_person, address_line_1, city, country)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [code, printName, lead.email, lead.phone, lead.contact_name, null, null, null]
    );
    const customer = custRows[0];

    const { rows: updatedLeadRows } = await client.query(
      `UPDATE crm_leads SET stage='won', converted_to_customer_id=$1 WHERE id=$2 RETURNING *`,
      [customer.id, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ lead: updatedLeadRows[0], customer });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

router.post('/:id/activities', async (req, res) => {
  const { type, date, subject, description } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO crm_activities (lead_id,type,date,subject,description) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, type || 'note', date, subject || null, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id/activities/:actId', async (req, res) => {
  try {
    await pool.query('DELETE FROM crm_activities WHERE id=$1 AND lead_id=$2', [req.params.actId, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
