import { connectPostgresClient } from '../lib/db/postgres'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function run() {
  const c = await connectPostgresClient()
  const res = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products'")
  console.log(res.rows)
  process.exit(0)
}
run()
