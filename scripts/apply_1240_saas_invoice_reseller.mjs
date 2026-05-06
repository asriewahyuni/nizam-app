import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

const ABS_RESELLER_ID = '5a855577-aa41-4b31-925c-6c2691f8ac8d'
const INV_QKMR_ID     = '5c40e6fd-4f96-49d6-8801-ff323b585a9c'

async function run() {
  await client.connect()
  console.log('✅ Terhubung ke Railway PostgreSQL\n')

  // 1. Jalankan migrasi
  console.log('📦 Menambahkan kolom reseller_id ke saas_invoices...')
  const sql = await import('fs').then(fs => fs.default.readFileSync(
    'supabase/migrations/1240_saas_invoice_reseller.sql', 'utf8'
  ))
  await client.query(sql)
  console.log('✅ Kolom reseller_id berhasil ditambahkan\n')

  // 2. Verifikasi kolom ada
  const colCheck = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'saas_invoices' AND column_name = 'reseller_id'
  `)
  if (!colCheck.rows.length) throw new Error('Kolom reseller_id belum terbentuk!')
  console.log('✅ Verifikasi kolom: OK\n')

  // 3. Backfill INV-260505-QKMR dengan reseller ABS
  console.log('🔗 Menghubungkan INV-260505-QKMR dengan reseller ABS...')
  const updateRes = await client.query(`
    UPDATE saas_invoices
    SET reseller_id = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING invoice_number, reseller_id
  `, [ABS_RESELLER_ID, INV_QKMR_ID])

  if (!updateRes.rows.length) {
    throw new Error('Invoice INV-260505-QKMR tidak ditemukan!')
  }
  console.log(`✅ Backfill reseller: ${JSON.stringify(updateRes.rows[0])}\n`)

  // 4. Konfirmasi akhir
  const confirm = await client.query(`
    SELECT si.invoice_number, si.status, si.amount, sr.name AS reseller_name, sr.commission_type, sr.commission_value
    FROM saas_invoices si
    JOIN sales_resellers sr ON sr.id = si.reseller_id
    WHERE si.id = $1
  `, [INV_QKMR_ID])
  console.log('📋 Data final INV-260505-QKMR:')
  console.log(JSON.stringify(confirm.rows[0], null, 2))

  console.log('\n🎉 Migration 1240 + backfill selesai!')
}

run()
  .catch(err => { console.error('❌ Gagal:', err.message); process.exitCode = 1 })
  .finally(() => client.end())
