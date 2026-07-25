const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const seedCompanyAccounts = require('../seedCompanyAccounts');

// ── GET /api/chart-of-accounts  (flat list, ordered by code) ─────────────────
router.get('/', async (req, res, next) => {
  try {
    // First time a company is accessed it has no accounts — seed the standard
    // chart of accounts for it so every business starts with its own books.
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM chart_of_accounts');
    if (n === 0) {
      await seedCompanyAccounts(pool);
    }

    const { account_type, account_group, is_active, search } = req.query;
    const conditions = [];
    const params = [];

    if (account_type) {
      params.push(account_type);
      conditions.push(`coa.account_type = $${params.length}`);
    }
    if (account_group) {
      params.push(account_group);
      conditions.push(`coa.account_group = $${params.length}`);
    }
    if (is_active !== undefined && is_active !== '') {
      params.push(is_active === 'true');
      conditions.push(`coa.is_active = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(coa.code ILIKE $${params.length} OR coa.name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT coa.*,
              p.name AS parent_name,
              p.code AS parent_code
         FROM chart_of_accounts coa
         LEFT JOIN chart_of_accounts p ON p.id = coa.parent_id
         ${where}
         ORDER BY coa.code`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/chart-of-accounts/lookup  (minimal list for dropdowns) ──────────
router.get('/lookup', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (name) id, code, name, account_type, account_group, normal_balance, parent_id
         FROM chart_of_accounts
        WHERE is_active = true AND is_parent = false
        ORDER BY name, code`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/chart-of-accounts/:id ───────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT coa.*, p.name AS parent_name, p.code AS parent_code
         FROM chart_of_accounts coa
         LEFT JOIN chart_of_accounts p ON p.id = coa.parent_id
        WHERE coa.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── POST /api/chart-of-accounts ───────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      code, name, description,
      parent_id = null,
      account_group = 'transactional',
      opening_balance = 0,
    } = req.body;

    if (!code?.trim())  return res.status(400).json({ error: 'code is required' });
    if (!name?.trim())  return res.status(400).json({ error: 'name is required' });
    if (!parent_id)     return res.status(400).json({ error: 'parent account is required' });

    // Derive account_type from parent
    const { rows: [parent] } = await pool.query(
      'SELECT account_type FROM chart_of_accounts WHERE id = $1', [parent_id]
    );
    if (!parent) return res.status(400).json({ error: 'Parent account not found' });
    const account_type = parent.account_type;

    const normal_balance = ['asset', 'expense', 'contra_revenue'].includes(account_type)
      ? 'debit' : 'credit';

    const { rows } = await pool.query(
      `INSERT INTO chart_of_accounts
         (code, name, description, account_type, account_group, parent_id,
          normal_balance, opening_balance, current_balance, is_system)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,false)
       RETURNING *`,
      [
        code.trim(), name.trim(), description || null,
        account_type, account_group, parent_id || null,
        normal_balance, opening_balance,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: `Account code "${req.body.code}" already exists` });
    }
    next(err);
  }
});

// ── PUT /api/chart-of-accounts/:id ───────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await pool.query(
      'SELECT is_system, account_type FROM chart_of_accounts WHERE id = $1', [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Account not found' });

    const {
      name, description, parent_id = null,
      opening_balance = 0, is_active = true,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    // Derive account_type from parent (or keep existing if no parent)
    let account_type = existing.rows[0].account_type;
    let normal_balance = ['asset', 'expense', 'contra_revenue'].includes(account_type)
      ? 'debit' : 'credit';

    if (parent_id) {
      const { rows: [parent] } = await pool.query(
        'SELECT account_type FROM chart_of_accounts WHERE id = $1', [parent_id]
      );
      if (parent) {
        account_type = parent.account_type;
        normal_balance = ['asset', 'expense', 'contra_revenue'].includes(account_type)
          ? 'debit' : 'credit';
      }
    }

    const { rows } = await pool.query(
      `UPDATE chart_of_accounts SET
          name             = $1,
          description      = $2,
          parent_id        = $3,
          account_type     = $4,
          normal_balance   = $5,
          opening_balance  = $6,
          is_active        = $7
        WHERE id = $8
        RETURNING *`,
      [name.trim(), description || null, parent_id || null,
       account_type, normal_balance, opening_balance, is_active, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── DELETE /api/chart-of-accounts/:id ────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const check = await pool.query(
      'SELECT is_system, name FROM chart_of_accounts WHERE id = $1', [req.params.id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Account not found' });
    if (check.rows[0].is_system) {
      return res.status(400).json({ error: `"${check.rows[0].name}" is a system account and cannot be deleted` });
    }

    const children = await pool.query(
      'SELECT id FROM chart_of_accounts WHERE parent_id = $1 LIMIT 1', [req.params.id]
    );
    if (children.rows.length) {
      return res.status(400).json({ error: 'Cannot delete an account that has child accounts' });
    }

    await pool.query('DELETE FROM chart_of_accounts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
