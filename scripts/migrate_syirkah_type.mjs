import { Client } from 'pg'

async function run() {
  const client = new Client({
    connectionString: process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('Connected to Railway DB')

    const sql = `
      ALTER TABLE public.syirkah_contracts 
      ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50) DEFAULT 'Syirkah Mudharabah';
    `
    await client.query(sql)
    console.log('Added contract_type column')

  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await client.end()
  }
}

run()
