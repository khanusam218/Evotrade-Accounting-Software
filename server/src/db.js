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
  // SET ROLE (not SET LOCAL) — this must survive across whatever transaction(s)
  // the caller runs next. `pool.connect()` hands the client back to route code
  // that starts its own BEGIN/COMMIT afterward; SET LOCAL ROLE would have already
  // reverted by then (its scope is the single implicit statement it ran in),
  // silently leaving later queries running as the superuser login role — i.e.
  // with row-level security fully bypassed instead of enforced.
  await client.query('SET ROLE evotrade_app');
  await client.query(`SELECT set_config('app.company_id', $1, false)`, [companyId]);
}

// Restore a pooled connection to a clean state before it's reused by an
// unrelated request — SET ROLE and the app.company_id GUC both persist for
// the life of the physical connection otherwise.
async function teardownClient(client) {
  try {
    // Route handlers that `BEGIN` a transaction and then `return` early (a
    // validation failure, a 404, etc.) without an explicit ROLLBACK leave the
    // connection sitting mid-transaction when it goes back to the pool — the
    // next unrelated request to grab it then runs inside that stale, half-open
    // transaction, surfacing as a random "Internal server error" on whatever
    // request happened to reuse the connection. ROLLBACK outside of a
    // transaction is a harmless no-op in Postgres, so this unconditionally
    // closes out any leftover transaction regardless of which route forgot to.
    await client.query('ROLLBACK');
  } catch { /* ignore */ }
  try {
    await client.query('RESET ROLE');
    await client.query(`SELECT set_config('app.company_id', '', false)`);
  } catch { /* connection may already be broken; let release() handle it */ }
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
      await teardownClient(client);
      client.release();
    }
  },
  connect: async () => {
    const client = await rawPool.connect();
    await setupClient(client);
    const rawRelease = client.release.bind(client);
    client.release = async (...args) => {
      await teardownClient(client);
      return rawRelease(...args);
    };
    return client;
  },
  end: () => rawPool.end(),
};

pool.companyAls = companyAls;
module.exports = pool;
