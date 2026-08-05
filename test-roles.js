const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL });
pool.query("SELECT * FROM org_members LIMIT 1").then(res => {
  console.log(res.rows);
  pool.end();
}).catch(console.error);
