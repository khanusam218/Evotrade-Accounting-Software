const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const JWT_EXPIRY = '7d';

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { id, password, confirmPassword } = req.body;

    // Validation
    if (!id?.trim()) return res.status(400).json({ error: 'ID is required' });
    if (id.trim().length < 3) return res.status(400).json({ error: 'ID must be at least 3 characters' });
    if (!password) return res.status(400).json({ error: 'Password is required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });

    const userId = id.trim();

    // Check if user already exists
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (existing.length) return res.status(400).json({ error: 'User ID already exists' });

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create user
    const { rows } = await pool.query(
      'INSERT INTO users (user_id, password) VALUES ($1, $2) RETURNING id',
      [userId, hashedPassword]
    );

    // Generate JWT
    const token = jwt.sign({ userId, iat: Date.now() }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });

    res.status(201).json({ token, userId });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { id, password } = req.body;

    // Validation
    if (!id?.trim()) return res.status(400).json({ error: 'ID is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const userId = id.trim();

    // Look up user
    const { rows } = await pool.query('SELECT id, password FROM users WHERE user_id = $1', [userId]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid ID or password' });

    const user = rows[0];

    // Compare password
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid ID or password' });

    // Generate JWT
    const token = jwt.sign({ userId, iat: Date.now() }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });

    res.json({ token, userId });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password  (requires valid JWT)
router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
    if (!newPassword)     return res.status(400).json({ error: 'New password is required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const { rows } = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const valid = bcrypt.compareSync(currentPassword, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE user_id = $2', [hashed, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
