import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { queryPostgres } from '../lib/db/postgres'

async function checkProduct() {
  const res = await queryPostgres(
    `SELECT p.id, p.public_slug, p.public_name, p.product_type, p.inventory_product_id
     FROM products p
     WHERE p.public_slug = 'p-rn0fed' OR p.id = 'p-rn0fed'`
  )
  console.log('PRODUCT:', res.rows)

  if (res.rows.length > 0) {
    const p = res.rows[0]
    const varRes = await queryPostgres(
      `SELECT id, product_id, sku, name, is_published FROM product_variants WHERE product_id = $1`,
      [p.id]
    )
    console.log('VARIANTS:', varRes.rows)

    if (p.inventory_product_id) {
      const invRes = await queryPostgres(
        `SELECT * FROM inventory_balances WHERE product_id = $1`,
        [p.inventory_product_id]
      )
      console.log('INVENTORY:', invRes.rows)
    }
  }
}

checkProduct().catch(console.error)
