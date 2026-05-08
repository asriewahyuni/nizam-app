import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  await client.connect()

  // Cek struktur sales_resellers
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_resellers'
    ORDER BY ordinal_position
  `)
  console.log('sales_resellers columns:')
  cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`))

  // Cek data reseller yang ada
  const resellers = await client.query(`
    SELECT id, name, reseller_type, company_name, contact_person, email, is_active
    FROM sales_resellers
    LIMIT 20
  `)
  console.log('\nSample resellers:', JSON.stringify(resellers.rows, null, 2))

  // Cek apakah ada reseller "ABS"
  const absRes = await client.query(`
    SELECT * FROM sales_resellers
    WHERE name ILIKE '%abs%' OR company_name ILIKE '%abs%'
    LIMIT 5
  `)
  console.log('\nABS reseller:', JSON.stringify(absRes.rows, null, 2))
}

run()
  .catch(err => { console.error('Error:', err.message); process.exitCode = 1 })
  .finally(() => client.end())
