const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ host:'localhost', port:5432, database:'evotrade', user:'postgres', password:'postgres123' });
const file = process.argv[2];
const sql = fs.readFileSync(file,'utf8');
pool.query(sql).then(()=>{ console.log('Migration OK: ' + file); pool.end(); }).catch(e=>{ console.error('FAILED:', e.message); pool.end(); process.exit(1); });
