import pg from 'pg'
import nextEnv from '@next/env'
const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  await client.connect()
  const { rows } = await client.query(`SELECT code, name, is_active FROM accounts WHERE org_id = 'f4455b6f-c7fc-4164-9732-a906bcce5e65' ORDER BY code`)
  console.log('Semua Akun:')
  rows.forEach(r => console.log(`${r.code} - ${r.name} (${r.is_active ? 'Aktif' : 'Nonaktif'})`))
}

run().catch(console.error).finally(() => client.end())
