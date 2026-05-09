import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query("SELECT * FROM saas_packages WHERE name = 'Trial'");
  console.log(JSON.stringify(res.rows, null, 2));
  pool.end();
}
run();
