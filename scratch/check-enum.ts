import { connectPostgresClient } from '../lib/db/postgres'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function run() {
  const c = await connectPostgresClient()
  const res = await c.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'product_type'")
  console.log(res.rows)
  process.exit(0)
}
run()
