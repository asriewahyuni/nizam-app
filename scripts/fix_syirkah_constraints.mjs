/**
 * scripts/fix_syirkah_constraints.mjs
 *
 * Menjalankan migrasi 1232 ke Railway:
 * - Update constraint status syirkah_contracts: tambahkan 'SIGNING'
 * - Update constraint role syirkah_members: tambahkan 'PEMODAL_PENGELOLA'
 *
 * Jalankan: node scripts/fix_syirkah_constraints.mjs
 */

import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Load .env.local
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
} catch {
  // .env.local mungkin tidak ada, lanjutkan
}

const connectionString =
  process.env.DATABASE_URL ||
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL

if (!connectionString) {
  console.error('❌ Tidak ditemukan DATABASE_URL / RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL')
  process.exit(1)
}

const { Pool } = require('pg')
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('railway.internal')
    ? false
    : { rejectUnauthorized: false }
})

const sql = `
-- 1. Drop & recreate constraint status syirkah_contracts
DO $do$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'syirkah_contracts_status_check'
      AND conrelid = 'public.syirkah_contracts'::regclass
  ) THEN
    ALTER TABLE public.syirkah_contracts DROP CONSTRAINT syirkah_contracts_status_check;
  END IF;
END $do$;

ALTER TABLE public.syirkah_contracts
  ADD CONSTRAINT syirkah_contracts_status_check
  CHECK (status IN ('DRAFT', 'SIGNING', 'ACTIVE', 'COMPLETED'));

-- 2. Drop & recreate constraint role syirkah_members
DO $do$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'syirkah_members_role_check'
      AND conrelid = 'public.syirkah_members'::regclass
  ) THEN
    ALTER TABLE public.syirkah_members DROP CONSTRAINT syirkah_members_role_check;
  END IF;
END $do$;

ALTER TABLE public.syirkah_members
  ADD CONSTRAINT syirkah_members_role_check
  CHECK (role IN ('PEMODAL', 'PENGELOLA', 'PEMODAL_PENGELOLA'));
`

try {
  await pool.query(sql)
  console.log('✅ Constraints berhasil diperbarui:')
  console.log('   syirkah_contracts.status  → DRAFT, SIGNING, ACTIVE, COMPLETED')
  console.log('   syirkah_members.role       → PEMODAL, PENGELOLA, PEMODAL_PENGELOLA')
} catch (err) {
  console.error('❌ Gagal:', err.message)
  process.exit(1)
} finally {
  await pool.end()
}
