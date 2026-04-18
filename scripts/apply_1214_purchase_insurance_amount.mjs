import fs from 'fs'
import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

if (!dbUrl) {
  console.error('❌ Tidak ada DATABASE_URL ditemukan di environment lokal')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log('✅ Terhubung ke Railway PostgreSQL...')

  const sql = fs.readFileSync('supabase/migrations/1214_add_purchase_insurance_amount.sql', 'utf8')
  await client.query(sql)

  const verification = await client.query(`
    SELECT
      column_name,
      data_type,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchases'
      AND column_name = 'insurance_amount'
  `)

  if (verification.rowCount !== 1) {
    throw new Error('Kolom insurance_amount belum ditemukan setelah migration dijalankan.')
  }

  console.log('✅ Migration 1214_add_purchase_insurance_amount.sql berhasil dijalankan!')
  console.log('✅ Verifikasi kolom purchases.insurance_amount berhasil.')
  console.table(verification.rows)

  await client.end()
}

run().catch(async (error) => {
  console.error('❌ Migration gagal:', error?.message || error)
  try {
    await client.end()
  } catch {}
  process.exit(1)
})
