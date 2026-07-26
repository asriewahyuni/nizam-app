import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { queryPostgres } from '../lib/db/postgres'

async function updateCoreisecCustom() {
  const storeId = '0546c51e-57bc-4162-b86c-849fc62d1ca0'
  const logoUrl = 'https://coreisec.id/wp-content/uploads/2022/07/CI-Class-h.png'

  // 1. Update logo_url on stores table
  const updateStore = await queryPostgres(
    `UPDATE stores SET logo_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, slug, logo_url`,
    [logoUrl, storeId]
  )
  console.log('Updated store logo:', updateStore.rows[0])

  // 2. Fetch existing theme versions
  const themes = await queryPostgres(
    `SELECT id, status, tokens FROM store_theme_versions WHERE store_id = $1`,
    [storeId]
  )

  for (const theme of themes.rows) {
    const updatedTokens = {
      ...theme.tokens,
      accent: '#16A34A',         // Core ISEC Emerald Green
      accentStrong: '#15803D',   // Core ISEC Deep Green
      accentSoft: '#DCFCE7',     // Soft green accent background
      border: '#BBF7D0',         // Clean emerald border
      surface: '#FFFFFF',
      surfaceAlt: '#F0FDF4',     // Very light green tint
      muted: '#4B5563',
      text: '#0F172A',
    }

    await queryPostgres(
      `UPDATE store_theme_versions SET tokens = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedTokens), theme.id]
    )
    console.log(`Updated theme version ${theme.id} (${theme.status}) with Core ISEC tone`)
  }
}

updateCoreisecCustom().catch(console.error)
