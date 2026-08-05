const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL });
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%org%'").then(res => {
  console.log(res.rows);
  pool.end();
});
