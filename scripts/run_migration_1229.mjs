/**
 * scripts/run_migration_1229.mjs
 *
 * Menjalankan migrasi 1229_syirkah_core_capital_posting ke Railway:
 * - Tambah kolom core_cash_account_id, core_equity_account_id, core_journal_entry_id
 *   ke tabel syirkah_contracts
 * - Tambah enum value SYIRKAH_CAPITAL ke journal_reference_type
 *
 * Jalankan: /usr/local/bin/node scripts/run_migration_1229.mjs
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
} catch { /* skip */ }

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

// Jalankan setiap statement secara terpisah untuk menghindari masalah multi-statement
const statements = [
  // 1. Tambah enum value (aman jika sudah ada)
  `DO $$
  BEGIN
    ALTER TYPE public.journal_reference_type ADD VALUE IF NOT EXISTS 'SYIRKAH_CAPITAL';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,

  // 2. Tambah kolom ke syirkah_contracts
  `ALTER TABLE public.syirkah_contracts
    ADD COLUMN IF NOT EXISTS core_cash_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS core_equity_account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS core_journal_entry_id UUID NULL REFERENCES public.journal_entries(id) ON DELETE SET NULL`,

  // 3. Index
  `CREATE INDEX IF NOT EXISTS idx_syirkah_contracts_core_cash_account_id
    ON public.syirkah_contracts(core_cash_account_id)
    WHERE core_cash_account_id IS NOT NULL`,

  `CREATE INDEX IF NOT EXISTS idx_syirkah_contracts_core_equity_account_id
    ON public.syirkah_contracts(core_equity_account_id)
    WHERE core_equity_account_id IS NOT NULL`,

  `CREATE INDEX IF NOT EXISTS idx_syirkah_contracts_core_journal_entry_id
    ON public.syirkah_contracts(core_journal_entry_id)
    WHERE core_journal_entry_id IS NOT NULL`,
]

try {
  for (const sql of statements) {
    await pool.query(sql)
    console.log('  ✓', sql.trim().split('\n')[0].slice(0, 70))
  }
  console.log('\n✅ Migrasi 1229 berhasil dijalankan:')
  console.log('   + core_cash_account_id    (UUID, nullable)')
  console.log('   + core_equity_account_id  (UUID, nullable)')
  console.log('   + core_journal_entry_id   (UUID, nullable)')
  console.log('   + journal_reference_type: SYIRKAH_CAPITAL')
} catch (err) {
  console.error('\n❌ Gagal:', err.message)
  process.exit(1)
} finally {
  await pool.end()
}
