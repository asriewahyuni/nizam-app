const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query('SELECT wb.*, w.name, w.code, w.branch_id FROM warehouse_bins wb JOIN warehouses w ON w.id = wb.warehouse_id LIMIT 5');
  console.log('BINS:', rows);
  process.exit(0);
}
run().catch(console.error);
