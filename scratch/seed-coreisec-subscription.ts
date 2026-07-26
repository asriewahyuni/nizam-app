import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { queryPostgres } from '../lib/db/postgres'

async function seedSubscription() {
  // 1. Get org and store
  const orgRes = await queryPostgres(
    `SELECT id FROM organizations WHERE slug = 'core-islamic-economics' LIMIT 1`
  )
  if (orgRes.rows.length === 0) {
    throw new Error('Org core-islamic-economics not found')
  }
  const orgId = orgRes.rows[0].id

  const storeRes = await queryPostgres(
    `SELECT id FROM stores WHERE org_id = $1 AND slug = 'store-fyrigc' LIMIT 1`,
    [orgId]
  )
  if (storeRes.rows.length === 0) {
    throw new Error('Store store-fyrigc not found')
  }
  const storeId = storeRes.rows[0].id

  // 2. Check if product already exists
  let productId: string
  const existingProd = await queryPostgres(
    `SELECT id FROM products WHERE org_id = $1 AND name = 'AMS Kelas Syakhshiyah 1500 - Paket 1 Tahun' LIMIT 1`,
    [orgId]
  )

  if (existingProd.rows.length > 0) {
    productId = existingProd.rows[0].id
    console.log('Existing product found:', productId)
  } else {
    const newProd = await queryPostgres(
      `INSERT INTO products (
         org_id, name, description, type, selling_price, is_active
       ) VALUES (
         $1,
         'AMS Kelas Syakhshiyah 1500 - Paket 1 Tahun',
         'Program bimbingan intensif AMS Kelas Syakhshiyah 1500 Paket 1 Tahun dengan akses materi komprehensif CLASS CORe ISEC.',
         'NON_INVENTORY',
         450000,
         TRUE
       ) RETURNING id`,
      [orgId]
    )
    productId = newProd.rows[0].id
    console.log('Created product:', productId)
  }

  // 3. Check if store_product already exists
  let storeProductId: string
  const existingSp = await queryPostgres(
    `SELECT id FROM store_products WHERE store_id = $1 AND product_id = $2 LIMIT 1`,
    [storeId, productId]
  )

  if (existingSp.rows.length > 0) {
    storeProductId = existingSp.rows[0].id
    await queryPostgres(
      `UPDATE store_products
       SET is_featured = TRUE,
           is_published = TRUE,
           price_override = 450000,
           compare_price = 750000,
           badge_text = 'Paket 1 Tahun',
           public_slug = 'ams-kelas-syakhshiyah-1500-paket-1-tahun'
       WHERE id = $1`,
      [storeProductId]
    )
    console.log('Updated existing store product:', storeProductId)
  } else {
    const newSp = await queryPostgres(
      `INSERT INTO store_products (
         org_id, store_id, product_id, public_name, public_slug,
         price_override, compare_price, badge_text, is_featured, is_published, sort_order
       ) VALUES (
         $1, $2, $3,
         'AMS Kelas Syakhshiyah 1500 - Paket 1 Tahun',
         'ams-kelas-syakhshiyah-1500-paket-1-tahun',
         450000, 750000, 'Paket 1 Tahun', TRUE, TRUE, 0
       ) RETURNING id`,
      [orgId, storeId, productId]
    )
    storeProductId = newSp.rows[0].id
    console.log('Created store product:', storeProductId)
  }

  // 4. Check if subscription plan exists
  const existingPlan = await queryPostgres(
    `SELECT id FROM commerce_subscription_plans WHERE store_product_id = $1 LIMIT 1`,
    [storeProductId]
  )

  if (existingPlan.rows.length > 0) {
    await queryPostgres(
      `UPDATE commerce_subscription_plans
       SET name = 'AMS Kelas Syakhshiyah 1500 - Paket 1 Tahun',
           billing_interval = 'YEAR',
           billing_interval_count = 1,
           price = 450000,
           trial_days = 0,
           signup_fee = 0,
           is_active = TRUE
       WHERE id = $1`,
      [existingPlan.rows[0].id]
    )
    console.log('Updated existing subscription plan:', existingPlan.rows[0].id)
  } else {
    const newPlan = await queryPostgres(
      `INSERT INTO commerce_subscription_plans (
         org_id, store_product_id, name, billing_interval, billing_interval_count,
         price, trial_days, signup_fee, grace_period_days, is_active
       ) VALUES (
         $1, $2, 'AMS Kelas Syakhshiyah 1500 - Paket 1 Tahun', 'YEAR', 1,
         450000, 0, 0, 7, TRUE
       ) RETURNING id`,
      [orgId, storeProductId]
    )
    console.log('Created subscription plan:', newPlan.rows[0].id)
  }

  console.log('Done seeding Core ISEC subscription product!')
}

seedSubscription().catch(console.error)
