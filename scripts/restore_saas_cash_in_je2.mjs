import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

// Target: restore jurnal SAAS_CASH_IN untuk INV-260406-PONW
const INVOICE_NUMBER = 'INV-260406-PONW'
const INVOICE_ID     = '189ca613-19a1-4a3b-9f98-83ef8531bad3'

async function run() {
  await client.connect()
  console.log('✅ Terhubung ke Railway PostgreSQL\n')

  // 1. Cek kondisi jurnal saat ini
  const checkRes = await client.query(`
    SELECT je.id, je.entry_date, je.description, je.reference_type, je.status,
           je.void_reason, je.voided_at,
           jl.account_id, jl.debit, jl.credit, a.code, a.name
    FROM journal_entries je
    JOIN journal_lines jl ON jl.entry_id = je.id
    JOIN accounts a ON a.id = jl.account_id
    WHERE je.reference_id = $1
    ORDER BY je.created_at, jl.debit DESC
  `, [INVOICE_ID])

  console.log(`📋 Jurnal yang terkait ${INVOICE_NUMBER}:`)
  checkRes.rows.forEach(r => {
    console.log(`  [${r.reference_type}] ${r.status} | ${r.code} - ${r.name} | Dr: ${r.debit} Cr: ${r.credit}`)
  })
  console.log()

  // 2. Restore jurnal SAAS_CASH_IN yang ter-void (reference_id = invoice & status VOIDED)
  const restoreRes = await client.query(`
    UPDATE journal_entries
    SET
      status     = 'POSTED',
      void_reason = NULL,
      voided_by   = NULL,
      voided_at   = NULL,
      updated_at  = NOW()
    WHERE reference_id   = $1
      AND reference_type = 'SAAS_CASH_IN'
      AND status         = 'VOIDED'
    RETURNING id, description, status
  `, [INVOICE_ID])

  if (!restoreRes.rows.length) {
    console.log('⚠️  Tidak ada jurnal SAAS_CASH_IN berstatus VOIDED untuk invoice ini.')
    console.log('    Mungkin sudah di-restore sebelumnya atau tidak pernah di-void.')
    return
  }

  restoreRes.rows.forEach(r => {
    console.log(`✅ Restored: ${r.id} | "${r.description}" → status: ${r.status}`)
  })

  // 3. Verifikasi akhir
  const verifyRes = await client.query(`
    SELECT je.id, je.description, je.reference_type, je.status, je.entry_date,
           jl.debit, jl.credit, a.code, a.name
    FROM journal_entries je
    JOIN journal_lines jl ON jl.entry_id = je.id
    JOIN accounts a ON a.id = jl.account_id
    WHERE je.reference_id   = $1
      AND je.reference_type = 'SAAS_CASH_IN'
    ORDER BY jl.debit DESC
  `, [INVOICE_ID])

  console.log('\n📋 Status akhir SAAS_CASH_IN:')
  verifyRes.rows.forEach(r => {
    console.log(`  [${r.status}] ${r.code} - ${r.name} | Dr: ${r.debit} Cr: ${r.credit}`)
  })

  console.log('\n🎉 Jurnal SAAS_CASH_IN berhasil dikembalikan ke ledger!')
}

run()
  .catch(err => { console.error('❌ Gagal:', err.message); process.exitCode = 1 })
  .finally(() => client.end())
