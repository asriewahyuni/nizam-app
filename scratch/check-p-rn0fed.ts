import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { queryPostgres } from '../lib/db/postgres'

async function check() {
  const res = await queryPostgres(
    `SELECT sp.product_id, sp.public_slug, sp.public_name, p.type
     FROM store_products sp
     JOIN products p ON p.id = sp.product_id
     WHERE sp.public_slug = 'p-rn0fed'`
  )
  console.log('SP:', res.rows)
}

check().catch(console.error)
