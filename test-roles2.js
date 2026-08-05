const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL });
pool.query("SELECT user_id, role, org_id FROM org_members WHERE org_id = '873146a9-7772-471e-ba58-c154cae80efb'").then(res => {
  console.log(res.rows);
  pool.end();
}).catch(console.error);
