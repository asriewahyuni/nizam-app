import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { queryPostgres } from '../lib/db/postgres'

async function test() {
  const orgRes = await queryPostgres(
    `SELECT id, slug FROM organizations WHERE slug = 'core-islamic-economics' LIMIT 1`
  )
  if (!orgRes.rows.length) {
    console.log('Org core-islamic-economics not found')
    return
  }
  const orgId = orgRes.rows[0].id

  const storeProductsRes = await queryPostgres(
    `SELECT sp.id, sp.public_name, sp.price_override, sp.compare_price, sp.badge_text, sp.is_published, sp.is_featured,
            plan.name as plan_name, plan.billing_interval, plan.billing_interval_count
     FROM store_products sp
     LEFT JOIN commerce_subscription_plans plan ON plan.store_product_id = sp.id AND plan.is_active = true
     WHERE sp.org_id = $1`,
    [orgId]
  )

  console.log('=== VERIFY LMS PENJUALAN PRODUCTS ===')
  console.log(JSON.stringify(storeProductsRes.rows, null, 2))
}

test().catch(console.error)
