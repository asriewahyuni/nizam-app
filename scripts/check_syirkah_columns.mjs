/**
 * scripts/check_syirkah_columns.mjs
 * Cek kolom yang benar-benar ada di tabel syirkah_contracts di Railway.
 *
 * Jalankan: /usr/local/bin/node scripts/check_syirkah_columns.mjs
 */

import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

try {
  const envPath = resolve(__dirname, '../.env.local')
  const envText = readFileSync(envPath, 'utf-8')
  for (const line of envText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* skip */ }

const connectionString =
  process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_PUBLIC_URL

const { Pool } = require('pg')
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })

const result = await pool.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'syirkah_contracts'
  ORDER BY ordinal_position
`)

console.log('\nKolom yang ada di syirkah_contracts di Railway:\n')
for (const row of result.rows) {
  console.log(`  ${String(row.column_name).padEnd(30)} ${String(row.data_type).padEnd(20)} nullable=${row.is_nullable}`)
}

await pool.end()
