import { config } from 'dotenv';
config({ path: '.env.local' });
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.RAILWAY_DATABASE_URL });

async function run() {
  const { rows } = await pool.query('SELECT org_id FROM sales LIMIT 1');
  const orgId = rows[0]?.org_id;
  if (!orgId) { console.log("No sales found"); process.exit(0); }
  
  // Try querying sales through REST if we had it, but we can just query the DB directly to see if sales exist!
  const sales = await pool.query(`SELECT id FROM sales WHERE org_id = $1 AND status NOT IN ('DRAFT', 'VOIDED') AND payment_status != 'PAID'`, [orgId]);
  console.log("Found sales (outstanding):", sales.rowCount);
  
  const balances = await pool.query(`SELECT * FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id WHERE a.code = '1201'`);
  console.log("Journal lines for AR (1201):", balances.rowCount);
  
  process.exit(0);
}
run();
