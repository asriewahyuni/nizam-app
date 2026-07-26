import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { queryPostgres } from '../lib/db/postgres'

async function check() {
  const res = await queryPostgres(
    `SELECT s.id, s.name, s.slug, s.logo_url, o.slug as org_slug
     FROM stores s
     JOIN organizations o ON o.id = s.org_id
     WHERE o.slug = 'core-islamic-economics' OR s.slug = 'store-fyrigc'`
  )
  console.log('STORES:', res.rows)

  if (res.rows.length > 0) {
    const storeId = res.rows[0].id
    const themeRes = await queryPostgres(
      `SELECT * FROM store_theme_versions WHERE store_id = $1`,
      [storeId]
    )
    console.log('THEMES:', JSON.stringify(themeRes.rows, null, 2))
  }
}

check().catch(console.error)
