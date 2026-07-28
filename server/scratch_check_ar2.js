const pool = require('./src/db');
(async () => {
  const companyId = '4385c232-6705-43fd-b1fb-0d4cfc0e34d5';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.company_id', $1, true)", [companyId]);
    const { rows: kids } = await client.query("SELECT id, code, name, current_balance FROM chart_of_accounts WHERE parent_id=2975");
    console.log('AR sub-accounts:', JSON.stringify(kids, null, 2));
    const { rows: je } = await client.query(`SELECT jl.*, coa.name FROM journal_entry_lines jl JOIN chart_of_accounts coa ON coa.id=jl.account_id WHERE jl.account_id IN (2975,12918)`);
    console.log('journal lines touching AR:', JSON.stringify(je, null, 2));
    await client.query('COMMIT');
  } finally { client.release(); process.exit(0); }
})().catch(e => { console.error('ERR',e.message); process.exit(1); });
