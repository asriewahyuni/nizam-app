import fs from 'fs'
import { Client } from 'pg'

async function run() {
  const client = new Client({
    connectionString: process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('Connected to Railway DB')

    const sql1 = fs.readFileSync('supabase/migrations/1199_syirkah_tables.sql', 'utf8')
    await client.query(sql1)
    console.log('Migrated 1199_syirkah_tables.sql')

    const sql2 = fs.readFileSync('supabase/migrations/1202_syirkah_current_debt.sql', 'utf8')
    await client.query(sql2)
    console.log('Migrated 1202_syirkah_current_debt.sql')

  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await client.end()
  }
}

run()
