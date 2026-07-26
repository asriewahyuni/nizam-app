import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { queryPostgres } from '../lib/db/postgres'

async function check() {
  const res = await queryPostgres(
    `SELECT id, name, slug, logo_url FROM stores WHERE slug = 'store-fyrigc' LIMIT 1`
  )
  console.log(res.rows)
}

check().catch(console.error)
