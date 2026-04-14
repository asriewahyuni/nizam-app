const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows: entries } = await pool.query('SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT 5');
  const { rows: lines } = await pool.query('SELECT jl.*, a.code FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id ORDER BY jl.created_at DESC LIMIT 10');
  console.log('ENTRIES:\n', entries);
  console.log('LINES:\n', lines);
  process.exit(0);
}
run().catch(console.error);
