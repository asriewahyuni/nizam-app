import { Client } from 'pg'

const client = new Client({ connectionString: process.env.DATABASE_URL })

async function run() {
  await client.connect()
  const { rows } = await client.query('SELECT id, name FROM organizations ORDER BY created_at DESC LIMIT 1')
  console.log('Test Org:', rows[0])
  const orgId = rows[0].id

  try {
    const res = await client.query(`SELECT 1 FROM pg_proc WHERE proname = 'seed_default_coa'`)
    console.log('RPC exists:', res.rowCount > 0)
    
    // We won't actually call it to avoid side effects if we just want to debug the schema.
    // Wait, let's just run it to see the error.
    const callRes = await client.query('SELECT seed_default_coa($1)', [orgId])
    console.log('RPC call:', callRes.rows)
  } catch (err: any) {
    console.error('RPC Error:', err.message)
  }
  await client.end()
}
run()
