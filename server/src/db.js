const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

const companyAls = new AsyncLocalStorage();

const rawPool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'evotrade',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || (() => { throw new Error('DB_PASSWORD environment variable is required'); })(),
});

rawPool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

function getCompanyId() {
  return companyAls.getStore()?.companyId || 'evotrade';
}

async function setupClient(client) {
  const companyId = getCompanyId();
  // Switch to non-superuser role so RLS policies apply
  await client.query('SET LOCAL ROLE evotrade_app');
  await client.query(`SELECT set_config('app.company_id', $1, false)`, [companyId]);
}

const pool = {
  query: async (text, params) => {
    const client = await rawPool.connect();
    try {
      await client.query('BEGIN');
      await setupClient(client);
      const result = await client.query(text, params);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
  connect: async () => {
    const client = await rawPool.connect();
    await setupClient(client);
    return client;
  },
  end: () => rawPool.end(),
};

pool.companyAls = companyAls;
module.exports = pool;
