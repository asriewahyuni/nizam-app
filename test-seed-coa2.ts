import { seedInitialCoA } from './modules/accounting/actions/coa.actions'
import { Client } from 'pg'

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const { rows } = await client.query(`SELECT id, name FROM organizations ORDER BY created_at DESC LIMIT 1`)
  const orgId = rows[0].id
  await client.end()

  const result = await seedInitialCoA(orgId)
  console.log('Result:', result)
}
run()
