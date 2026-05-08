import fs from 'fs'
import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const MIGRATION_FILE = 'supabase/migrations/1238_saas_invoice_void_support.sql'

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

  // Verifikasi: pastikan constraint baru sudah terpasang
  const verification = await client.query(`
    SELECT cc.check_clause
    FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = cc.constraint_name
    WHERE ccu.table_schema = 'public'
      AND ccu.table_name   = 'saas_invoices'
      AND ccu.column_name  = 'status'
    LIMIT 1
  `)

  const checkClause = String(verification.rows[0]?.check_clause || '')
  if (!checkClause.toUpperCase().includes('VOIDED')) {
    throw new Error(
      `Verifikasi gagal: constraint status belum mencakup VOIDED.\nClause: ${checkClause}`
    )
  }

  console.log(`✅ Migration ${MIGRATION_FILE} berhasil dijalankan!`)
  console.log(`✅ Constraint status saas_invoices kini mencakup VOIDED.`)
  console.log(`   Clause: ${checkClause}`)
}

run()
  .catch(async (error) => {
    console.error('❌ Migration gagal:', error?.message || error)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await client.end()
    } catch {}
  })
