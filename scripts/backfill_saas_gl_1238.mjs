import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl =
  process.env.RAILWAY_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

// INV yang perlu di-backfill
// INV-260406-PONW: PAID  -> buat SAAS_SALE + SAAS_CASH_IN
// INV-260505-QKMR: UNPAID-> buat SAAS_SALE (piutang) saja
const INVOICES = [
  { id: '189ca613-19a1-4a3b-9f98-83ef8531bad3', invoice_number: 'INV-260406-PONW', amount: 4492950, tax_amount: 0, status: 'PAID',   payment_method: 'MANUAL_TRANSFER', org_id: 'f3b6d288-d89c-4945-8664-68bb7b08ac05', created_at: '2026-04-06T05:07:17.077Z' },
  { id: '5c40e6fd-4f96-49d6-8801-ff323b585a9c', invoice_number: 'INV-260505-QKMR', amount: 8988000, tax_amount: 0, status: 'UNPAID', payment_method: null,              org_id: '8b1306e2-dd1b-4cb9-a0fb-9123e90f3291', created_at: '2026-05-04T03:17:32.266Z' },
]

// --------------------------------------------------------
// Helpers resolusi akun COA
// --------------------------------------------------------
function findByCodes(accounts, codes) {
  return accounts.find(a => codes.includes(String(a.code || '').trim())) || null
}
function findByKeyword(accounts, keywords) {
  return accounts.find(a => {
    const n = String(a.name || '').toLowerCase()
    return keywords.some(k => n.includes(k))
  }) || null
}
function resolveReceivable(accounts) {
  return findByCodes(accounts, ['1201']) || findByKeyword(accounts, ['piutang usaha']) || null
}
function resolveRevenue(accounts) {
  return findByCodes(accounts, ['4001', '4000']) || findByKeyword(accounts, ['pendapatan usaha', 'pendapatan']) || null
}
function resolveCash(accounts, method) {
  const m = String(method || '').toLowerCase()
  const prefersBank = ['transfer', 'bank', 'virtual', 'debit'].some(k => m.includes(k))
  if (prefersBank) return findByCodes(accounts, ['1103', '1105', '1104']) || findByKeyword(accounts, ['bank']) || findByCodes(accounts, ['1101', '1102']) || null
  return findByCodes(accounts, ['1101', '1102', '1103']) || findByKeyword(accounts, ['kas', 'bank']) || null
}

function toDateOnly(iso) {
  return new Date(iso).toISOString().slice(0, 10)
}

function uuid() {
  // simple v4-like using crypto
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${['8','9','a','b'][Math.floor(Math.random()*4)]}${h().slice(1)}-${h()}${h()}${h()}`
}

async function run() {
  await client.connect()
  console.log('✅ Terhubung ke Railway PostgreSQL\n')

  // Cari org operator (platform admin)
  const operatorRes = await client.query(`
    SELECT o.id, o.name, o.owner_email
    FROM organizations o
    WHERE o.owner_email = 'bob@executive.id'
    LIMIT 1
  `)
  if (!operatorRes.rows.length) {
    throw new Error('Org operator (bob@executive.id) tidak ditemukan!')
  }
  const operator = operatorRes.rows[0]
  console.log(`👤 Operator org: ${operator.name} (${operator.id})\n`)

  // Cari akun COA operator
  const coaRes = await client.query(`
    SELECT id, code, name, type FROM accounts
    WHERE org_id = $1 AND is_active = true
    ORDER BY code
  `, [operator.id])
  const accounts = coaRes.rows

  console.log(`📊 COA tersedia: ${accounts.length} akun`)

  const receivable = resolveReceivable(accounts)
  const revenue    = resolveRevenue(accounts)
  const cashBank   = resolveCash(accounts, 'MANUAL_TRANSFER')

  console.log(`   Piutang Usaha : ${receivable ? `${receivable.code} - ${receivable.name}` : '❌ TIDAK DITEMUKAN'}`)
  console.log(`   Pendapatan    : ${revenue    ? `${revenue.code} - ${revenue.name}`    : '❌ TIDAK DITEMUKAN'}`)
  console.log(`   Kas/Bank      : ${cashBank   ? `${cashBank.code} - ${cashBank.name}`  : '❌ TIDAK DITEMUKAN'}\n`)

  if (!receivable || !revenue || !cashBank) {
    throw new Error('Akun COA operator tidak lengkap, tidak bisa membuat jurnal.')
  }

  // Cari user_id operator untuk created_by
  const userRes = await client.query(`
    SELECT id FROM auth.users WHERE email = $1 LIMIT 1
  `, [operator.owner_email])
  const actorUserId = userRes.rows[0]?.id || null
  console.log(`👤 Actor user_id: ${actorUserId}\n`)

  for (const inv of INVOICES) {
    console.log(`─── ${inv.invoice_number} (${inv.status}) ───────────────────────`)

    // Cek apakah sudah ada jurnal
    const existingCheck = await client.query(`
      SELECT id, reference_type, status FROM journal_entries
      WHERE reference_id = $1
    `, [inv.id])
    if (existingCheck.rows.length > 0) {
      console.log(`  ⚠️  Sudah ada ${existingCheck.rows.length} jurnal, dilewati.`)
      continue
    }

    const now = new Date().toISOString()

    // ── 1. Jurnal SAAS_SALE (Piutang Dr / Pendapatan Cr) ──
    const saleEntryId = uuid()
    const saleDesc = `Penjualan SaaS ${inv.invoice_number}`
    await client.query(`
      INSERT INTO journal_entries
        (id, org_id, entry_date, description, reference_type, reference_id,
         notes, status, is_auto, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'SAAS_SALE', $5, $6, 'POSTED', true, $7, $8, $8)
    `, [
      saleEntryId, operator.id,
      toDateOnly(inv.created_at), saleDesc,
      inv.id,
      `Backfill jurnal penjualan SaaS operator. Tenant org_id: ${inv.org_id}`,
      actorUserId, now
    ])

    const revenueAmount = Math.max(0, inv.amount - inv.tax_amount)
    await client.query(`
      INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
      VALUES
        ($1, $2, $3, 0,   'Piutang ' || $5),
        ($1, $4, 0,  $3,  'Pendapatan SaaS ' || $5)
    `, [saleEntryId, receivable.id, revenueAmount, revenue.id, inv.invoice_number])

    console.log(`  ✅ SAAS_SALE dibuat: ${saleEntryId}`)

    // ── 2. Jurnal SAAS_CASH_IN — hanya jika PAID ──
    if (inv.status === 'PAID') {
      const cashEntryId = uuid()
      const cashDesc = `Penerimaan SaaS ${inv.invoice_number}`
      await client.query(`
        INSERT INTO journal_entries
          (id, org_id, entry_date, description, reference_type, reference_id,
           notes, status, is_auto, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'SAAS_CASH_IN', $5, $6, 'POSTED', true, $7, $8, $8)
      `, [
        cashEntryId, operator.id,
        toDateOnly(inv.created_at), cashDesc,
        inv.id,
        `Backfill penerimaan kas SaaS. Metode: ${inv.payment_method}. Tenant org_id: ${inv.org_id}`,
        actorUserId, now
      ])

      await client.query(`
        INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES
          ($1, $2, $3, 0,  'Penerimaan ' || $4),
          ($1, $5, 0,  $3, 'Pelunasan piutang ' || $4)
      `, [cashEntryId, cashBank.id, inv.amount, inv.invoice_number, receivable.id])

      console.log(`  ✅ SAAS_CASH_IN dibuat: ${cashEntryId}`)
    } else {
      console.log(`  ℹ️  Status UNPAID — SAAS_CASH_IN tidak dibuat`)
    }
  }

  console.log('\n🎉 Backfill selesai! Cek di /accounting/journal atau /accounting/ledgers.')
}

run()
  .catch(err => { console.error('\n❌ Gagal:', err.message); process.exitCode = 1 })
  .finally(() => client.end())
