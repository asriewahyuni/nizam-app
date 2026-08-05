const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL });
pool.query("SELECT id, org_id, nama, kode_anggota, user_id FROM kojasmat_anggota LIMIT 5").then(res => {
  console.log(res.rows);
  pool.end();
}).catch(console.error);
