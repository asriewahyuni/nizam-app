const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query('SELECT * FROM purchases ORDER BY updated_at DESC LIMIT 3');
  console.log(rows);
  process.exit(0);
}
run().catch(console.error);
