const express = require('express');
const router  = express.Router();
const pool    = require('../db');

const SELECT = `
  SELECT ba.id, ba.coa_id, ba.bank_name, ba.branch_name, ba.account_number,
         ba.account_holder, ba.account_group, ba.is_credit_card, ba.is_active, ba.created_at,
         coa.code, coa.name, coa.account_type, coa.normal_balance, coa.current_balance,
         coa.parent_id, coa.description,
         p.code AS parent_code, p.name AS parent_name
    FROM bank_accounts ba
    JOIN chart_of_accounts coa ON coa.id = ba.coa_id
    LEFT JOIN chart_of_accounts p ON p.id = coa.parent_id
`;

// ── GET /api/bank-accounts ────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { search, account_group, is_active } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      conditions.push(
        `(coa.code ILIKE $${n} OR coa.name ILIKE $${n} OR ba.bank_name ILIKE $${n} OR ba.account_number ILIKE $${n})`
      );
    }
    if (account_group) {
      params.push(account_group);
      conditions.push(`ba.account_group = $${params.length}`);
    }
    if (is_active !== undefined && is_active !== '') {
      params.push(is_active === 'true');
      conditions.push(`ba.is_active = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`${SELECT} ${where} ORDER BY coa.code`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/bank-accounts/lookup  (before /:id) ─────────────────────────────
router.get('/lookup', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ba.id, ba.coa_id, coa.code, coa.name, coa.current_balance,
              ba.account_group, ba.is_credit_card
         FROM bank_accounts ba
         JOIN chart_of_accounts coa ON coa.id = ba.coa_id
        WHERE ba.is_active = true
        ORDER BY coa.code`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/bank-accounts/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [ba] } = await pool.query(`${SELECT} WHERE ba.id = $1`, [req.params.id]);
    if (!ba) return res.status(404).json({ error: 'Bank account not found' });
    res.json(ba);
  } catch (err) { next(err); }
});

// ── POST /api/bank-accounts ───────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      code, name, parent_id = null, description,
      bank_name, branch_name, account_number, account_holder,
      account_group = 'transactional', is_credit_card = false,
      is_active = true,
    } = req.body;

    if (!code?.trim())      return res.status(400).json({ error: 'code is required' });
    if (!name?.trim())      return res.status(400).json({ error: 'name is required' });
    if (!bank_name?.trim()) return res.status(400).json({ error: 'bank_name is required' });
    if (!['transactional', 'control'].includes(account_group))
      return res.status(400).json({ error: 'account_group must be transactional or control' });

    const account_type   = is_credit_card ? 'liability' : 'asset';
    const normal_balance = is_credit_card ? 'credit'    : 'debit';

    const { rows: [coa] } = await client.query(
      `INSERT INTO chart_of_accounts
         (code, name, description, account_type, parent_id, normal_balance, opening_balance, current_balance, is_active, is_system)
       VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,false) RETURNING *`,
      [code.trim(), name.trim(), description || null, account_type, parent_id || null, normal_balance, is_active]
    );

    const { rows: [ba] } = await client.query(
      `INSERT INTO bank_accounts
         (coa_id, bank_name, branch_name, account_number, account_holder, account_group, is_credit_card, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [coa.id, bank_name.trim(), branch_name || null, account_number || null,
       account_holder || null, account_group, is_credit_card, is_active]
    );

    await client.query('COMMIT');

    const { rows: [full] } = await pool.query(`${SELECT} WHERE ba.id = $1`, [ba.id]);
    res.status(201).json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505')
      return res.status(400).json({ error: `Account code "${req.body.code}" already exists` });
    next(err);
  } finally { client.release(); }
});

// ── PUT /api/bank-accounts/:id ────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [existing] } = await client.query(
      'SELECT ba.coa_id FROM bank_accounts ba WHERE ba.id = $1', [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Bank account not found' });

    const { name, parent_id = null, description, bank_name, branch_name, account_number, account_holder, is_active = true } = req.body;
    if (!name?.trim())      return res.status(400).json({ error: 'name is required' });
    if (!bank_name?.trim()) return res.status(400).json({ error: 'bank_name is required' });

    await client.query(
      'UPDATE chart_of_accounts SET name=$1, parent_id=$2, description=$3, is_active=$4 WHERE id=$5',
      [name.trim(), parent_id || null, description || null, is_active, existing.coa_id]
    );

    await client.query(
      `UPDATE bank_accounts
          SET bank_name=$1, branch_name=$2, account_number=$3, account_holder=$4, is_active=$5
        WHERE id=$6`,
      [bank_name.trim(), branch_name || null, account_number || null, account_holder || null, is_active, req.params.id]
    );

    await client.query('COMMIT');

    const { rows: [full] } = await pool.query(`${SELECT} WHERE ba.id = $1`, [req.params.id]);
    res.json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── DELETE /api/bank-accounts/:id ─────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [ba] } = await client.query(
      'SELECT coa_id FROM bank_accounts WHERE id = $1', [req.params.id]
    );
    if (!ba) return res.status(404).json({ error: 'Bank account not found' });

    const { rows: refs } = await client.query(
      'SELECT id FROM journal_entry_lines WHERE account_id = $1 LIMIT 1', [ba.coa_id]
    );
    if (refs.length)
      return res.status(400).json({ error: 'Cannot delete: account has posted journal entries' });

    await client.query('DELETE FROM bank_accounts WHERE id = $1', [req.params.id]);
    await client.query('DELETE FROM chart_of_accounts WHERE id = $1', [ba.coa_id]);

    await client.query('COMMIT');
    res.json({ message: 'Bank account deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

module.exports = router;
