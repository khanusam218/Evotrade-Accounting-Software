-- ============================================================
-- Migration 068: Create users table for JWT authentication.
-- This table is global (no RLS) to allow cross-company login.
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default admin user with bcrypt hash of 'admin'
INSERT INTO users (user_id, password)
  VALUES ('admin', '$2b$10$jBudJgOZjMVU5qcE5XnR6.0xv/ehYNyCjxm8EoxjTGRixH67/FoVa')
  ON CONFLICT (user_id) DO NOTHING;
