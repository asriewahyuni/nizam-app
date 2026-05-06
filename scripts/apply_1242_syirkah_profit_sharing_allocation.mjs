/**
 * scripts/apply_1242_syirkah_profit_sharing_allocation.mjs
 *
 * Menambahkan kolom profit_sharing_allocation ke syirkah_contracts
 * pada database aktif, lalu memverifikasi hasilnya.
 */

import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

if (!dbUrl) {
  throw new Error('DATABASE_URL / RAILWAY_DATABASE_URL / DATABASE_PUBLIC_URL tidak ditemukan')
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log('Terhubung ke database aktif.')

  await client.query(`
    ALTER TABLE public.syirkah_contracts
    ADD COLUMN IF NOT EXISTS profit_sharing_allocation NUMERIC(15, 2) DEFAULT 0
  `)

  await client.query(`
    UPDATE public.syirkah_contracts
    SET profit_sharing_allocation = 0
    WHERE profit_sharing_allocation IS NULL
  `)

  const verification = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'syirkah_contracts'
      AND column_name = 'profit_sharing_allocation'
  `)

  if (!verification.rowCount) {
    throw new Error('Kolom profit_sharing_allocation tidak ditemukan setelah migrasi dijalankan.')
  }

  const column = verification.rows[0]
  console.log(
    `Kolom terverifikasi: ${column.column_name} (${column.data_type}), nullable=${column.is_nullable}, default=${column.column_default ?? 'null'}`
  )
  console.log('Migration 1242 selesai.')
}

run()
  .catch((error) => {
    console.error(`Gagal: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(() => client.end())
