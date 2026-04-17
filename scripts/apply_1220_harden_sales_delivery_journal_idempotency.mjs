import fs from 'fs'
import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const MIGRATION_FILE = 'supabase/migrations/1220_harden_sales_delivery_journal_idempotency.sql'

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

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8')
  await client.query(sql)

  const verification = await client.query(`
    SELECT pg_get_functiondef('public.process_sales_delivery_atomic(uuid, uuid, uuid)'::regprocedure) AS definition
  `)

  const definition = String(verification.rows[0]?.definition || '')
  if (!definition.includes('v_existing_entry_id')) {
    throw new Error('Verifikasi gagal: guard idempotensi jurnal delivery belum terpasang pada process_sales_delivery_atomic.')
  }

  console.log(`✅ Migration ${MIGRATION_FILE} berhasil dijalankan!`)
  console.log('✅ Verifikasi function process_sales_delivery_atomic(UUID, UUID, UUID) berhasil.')
}

run().catch(async (error) => {
  console.error('❌ Migration gagal:', error?.message || error)
  process.exitCode = 1
}).finally(async () => {
  try {
    await client.end()
  } catch {}
})
