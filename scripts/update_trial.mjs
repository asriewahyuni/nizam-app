import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const allModules = [
    "Purchasing",
    "Manufacturing",
    "Sales",
    "POS",
    "Sales Page",
    "HRIS",
    "Warehouse",
    "Audit",
    "Syirkah",
    "Accounting",
    "Finance",
    "Inventory",
    "CRM",
    "Reports",
    "LMS",
    "Fleet & Rental",
    "Project & Construction",
    "Job Order (Jasa)"
  ];
  const res = await pool.query(
    "UPDATE saas_packages SET modules = $1::jsonb WHERE name = 'Trial' RETURNING *",
    [JSON.stringify(allModules)]
  );
  console.log(JSON.stringify(res.rows, null, 2));
  pool.end();
}
run();
