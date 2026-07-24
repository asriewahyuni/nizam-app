import { connectPostgresClient } from '../lib/db/postgres'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function run() {
  const c = await connectPostgresClient()
  const org = await c.query("SELECT id FROM organizations LIMIT 1")
  const orgId = org.rows[0].id

  try {
    const sku = 'LMS-' + Math.random().toString(36).substring(2, 8).toUpperCase()
    await c.query("INSERT INTO products (org_id, name, sku, type, selling_price, is_active) VALUES ($1, $2, $3, $4, 0, true)", [
      orgId,
      'Test LMS',
      sku,
      'NON_INVENTORY' // <--- TESTING ENUM
    ])
    console.log('Insert successful!')
    await c.query("DELETE FROM products WHERE sku = $1", [sku])
  } catch (err: any) {
    console.error('Insert failed:', err.message)
  }
  process.exit(0)
}
run()
