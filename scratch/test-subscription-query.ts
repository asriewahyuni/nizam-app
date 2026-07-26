import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { queryPostgres } from '../lib/db/postgres'

async function test() {
  const plans = await queryPostgres(
    `SELECT sp.public_name, sp.public_slug, plan.name, plan.billing_interval, plan.billing_interval_count, plan.price
     FROM commerce_subscription_plans plan
     JOIN store_products sp ON sp.id = plan.store_product_id
     WHERE sp.public_slug = 'ams-kelas-syakhshiyah-1500-paket-1-tahun'`
  )
  console.log('Seed Subscription Plan Result:', plans.rows)
}

test().catch(console.error)
