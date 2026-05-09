import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const minimalCoreModules = [
    "Accounting",
    "Finance",
    "Inventory",
    "Purchasing",
    "Sales",
    "POS",
    "CRM",
    "Reports",
    "Config"
  ];
  const addons = [
    "HRIS",
    "Manufacturing",
    "Audit",
    "Fleet & Rental",
    "Job Order (Jasa)",
    "Syirkah",
    "Warehouse",
    "Sales Page",
    "Integrasi API",
    "Multi-Entity (PT/CV)",
    "Quick Bill",
    "Fleet Maintenance Pack",
    "Package Tracking",
    "Sales AR Cockpit",
    "Sales AR Seat Pack",
    "LMS",
    "Project & Construction"
  ];

  const res = await pool.query(
    "UPDATE saas_packages SET modules = $1::jsonb, addons = $2::jsonb WHERE name = 'Trial' RETURNING *",
    [JSON.stringify(minimalCoreModules), JSON.stringify(addons)]
  );
  console.log(JSON.stringify(res.rows, null, 2));
  pool.end();
}
run();
