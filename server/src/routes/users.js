const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/users — safe (no password hash) list of login accounts, for
// linking a record (e.g. a Sales Person) to an application user.
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, user_id FROM users ORDER BY user_id');
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
