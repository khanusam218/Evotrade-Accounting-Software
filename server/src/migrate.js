const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Use a raw pool with superuser privileges for DDL migrations (bypasses RLS wrapper)
const rawPool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'evotrade',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function runMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await rawPool.query(sql);
      console.log(`[migrate] ${file} OK`);
    } catch (err) {
      console.error(`[migrate] ${file} FAILED:`, err.message);
    }
  }

  await rawPool.end();
}

module.exports = runMigrations;
