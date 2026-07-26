import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { queryPostgres } from '../lib/db/postgres'

async function check() {
  const res = await queryPostgres(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'commerce_subscription_plans'
     ORDER BY ordinal_position`
  )
  console.log('Columns:', res.rows)

  const plans = await queryPostgres(
    `SELECT * FROM commerce_subscription_plans LIMIT 5`
  )
  console.log('Plans:', plans.rows)
}

check().catch(console.error)
