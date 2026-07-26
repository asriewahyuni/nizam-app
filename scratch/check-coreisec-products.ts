import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { queryPostgres } from '../lib/db/postgres'

async function check() {
  const res = await queryPostgres(
    `SELECT sp.id, sp.public_slug, sp.public_name, sp.price_override, p.selling_price
     FROM store_products sp
     JOIN products p ON p.id = sp.product_id
     JOIN organizations org ON org.id = sp.org_id
     WHERE org.slug = 'core-islamic-economics'
     ORDER BY sp.public_name ASC`
  )
  console.log('Store Products:', res.rows)

  const plans = await queryPostgres(
    `SELECT plan.id, plan.name, plan.billing_interval, plan.billing_interval_count, plan.price, sp.public_name AS product_name
     FROM commerce_subscription_plans plan
     JOIN store_products sp ON sp.id = plan.store_product_id
     JOIN organizations org ON org.id = plan.org_id
     WHERE org.slug = 'core-islamic-economics'`
  )
  console.log('Subscription Plans:', plans.rows)
}

check().catch(console.error)
