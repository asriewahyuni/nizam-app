import pg from 'pg'
import nextEnv from '@next/env'
import fs from 'fs'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  await client.connect()
  console.log('✅ Terhubung ke Railway PostgreSQL\n')

  // Jalankan migrasi enum (harus per-statement, tidak bisa dalam transaction block)
  console.log('📦 Menambahkan SAAS_SALE dan SAAS_CASH_IN ke enum journal_reference_type...')
  await client.query(`ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'SAAS_SALE'`)
  await client.query(`ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'SAAS_CASH_IN'`)
  console.log('✅ Enum berhasil diperbarui\n')

  // Verifikasi enum
  const enumRes = await client.query(`
    SELECT unnest(enum_range(NULL::journal_reference_type))::text AS val
  `)
  const enumVals = enumRes.rows.map(r => r.val)
  console.log('📋 Enum values:', enumVals.join(', '), '\n')

  if (!enumVals.includes('SAAS_SALE') || !enumVals.includes('SAAS_CASH_IN')) {
    throw new Error('Enum tidak mencakup SAAS_SALE / SAAS_CASH_IN setelah migrasi!')
  }

  console.log('✅ Migration 1239 selesai!')
}

run()
  .catch(err => { console.error('❌ Gagal:', err.message); process.exitCode = 1 })
  .finally(() => client.end())
