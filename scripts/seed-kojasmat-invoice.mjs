/**
 * Script: seed-kojasmat-invoice.mjs
 * Membuat invoice SaaS untuk KOJASMAT (Ref: NZM/PNW/2026/06/003)
 * dan mencatat jurnal piutang di buku besar operator.
 *
 * Jalankan: node scripts/seed-kojasmat-invoice.mjs
 */
import pg from 'pg'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// ─── Konfigurasi Invoice ───────────────────────────────────────
const AMOUNT         = 12_281_400
const INVOICE_DATE   = '2026-06-26'
const DUE_DATE       = '2026-08-25'   // 60 hari dari tanggal invoice
const ITEM_NAME      = 'Invoice SaaS: Platform Enterprise + Modul Koperasi Syariah + Portal Anggota'
const ITEM_DESC      = 'Implementasi sistem ERP Koperasi Syariah + langganan bulan pertama. Ref: NZM/PNW/2026/06/003'
const OPERATOR_EMAIL = 'bob@executive.id'
const CLIENT_NAME    = 'KOJASMAT'
// ───────────────────────────────────────────────────────────────

function buildInvoiceNumber() {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `INV-${datePart}-${rand}`
}

async function run() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Cari org operator (NIZAM APP — org utama/pertama yang didaftarkan)
    const operatorRes = await client.query(
      `SELECT id, name FROM organizations
       WHERE LOWER(owner_email) = LOWER($1)
       ORDER BY created_at ASC
       LIMIT 1`,
      [OPERATOR_EMAIL]
    )
    if (operatorRes.rows.length === 0) {
      throw new Error(`Org operator tidak ditemukan untuk email: ${OPERATOR_EMAIL}`)
    }
    const operatorOrgId = operatorRes.rows[0].id
    console.log(`✓ Operator org: ${operatorRes.rows[0].name} (${operatorOrgId})`)

    // 2. Cari atau buat KOJASMAT sebagai kontak di org operator
    let contactId
    const contactRes = await client.query(
      `SELECT id FROM contacts WHERE org_id = $1 AND LOWER(name) LIKE $2 LIMIT 1`,
      [operatorOrgId, `%${CLIENT_NAME.toLowerCase()}%`]
    )
    if (contactRes.rows.length > 0) {
      contactId = contactRes.rows[0].id
      console.log(`✓ Kontak ${CLIENT_NAME} sudah ada (${contactId})`)
    } else {
      const newContactRes = await client.query(
        `INSERT INTO contacts (org_id, name, type, created_at, updated_at)
         VALUES ($1, $2, 'CUSTOMER', NOW(), NOW())
         RETURNING id`,
        [operatorOrgId, CLIENT_NAME]
      )
      contactId = newContactRes.rows[0].id
      console.log(`✓ Kontak ${CLIENT_NAME} dibuat baru (${contactId})`)
    }

    // 3. Cek org KOJASMAT (jika sudah punya akun di sistem)
    const kojasmatOrgRes = await client.query(
      `SELECT id, name FROM organizations WHERE LOWER(name) LIKE $1 LIMIT 1`,
      [`%${CLIENT_NAME.toLowerCase()}%`]
    )
    const kojasmatOrgId = kojasmatOrgRes.rows[0]?.id ?? null
    if (kojasmatOrgId) {
      console.log(`✓ Org KOJASMAT ditemukan: ${kojasmatOrgRes.rows[0].name} (${kojasmatOrgId})`)
    } else {
      console.log(`  KOJASMAT belum terdaftar sebagai org — invoice dibuat tanpa org_id tenant`)
    }

    // 4. Buat saas_invoice
    const invoiceNumber = buildInvoiceNumber()
    const invoiceRes = await client.query(
      `INSERT INTO saas_invoices
         (org_id, invoice_number, amount, status, due_date,
          item_name, item_description, created_at, updated_at)
       VALUES ($1, $2, $3, 'UNPAID', $4, $5, $6, $7, $7)
       RETURNING id`,
      [
        kojasmatOrgId,
        invoiceNumber,
        AMOUNT,
        DUE_DATE,
        ITEM_NAME,
        ITEM_DESC,
        INVOICE_DATE,
      ]
    )
    const invoiceId = invoiceRes.rows[0].id
    console.log(`✓ Invoice dibuat: ${invoiceNumber} (${invoiceId})`)

    // 5. Cari akun 1201 (Piutang Usaha) dan 4001/4000 (Pendapatan Usaha) di org operator
    const accountRes = await client.query(
      `SELECT id, code, name FROM accounts
       WHERE org_id = $1 AND is_active = TRUE AND code IN ('1201', '4001', '4000')
       ORDER BY code ASC`,
      [operatorOrgId]
    )
    const accounts = accountRes.rows
    const arAccount  = accounts.find(a => a.code === '1201')
    const revAccount = accounts.find(a => a.code === '4001') ?? accounts.find(a => a.code === '4000')

    if (!arAccount) throw new Error('Akun 1201 (Piutang Usaha) tidak ditemukan di org operator.')
    if (!revAccount) throw new Error('Akun Pendapatan Usaha (4001/4000) tidak ditemukan di org operator.')
    console.log(`✓ Akun AR  : ${arAccount.code} — ${arAccount.name}`)
    console.log(`✓ Akun Rev : ${revAccount.code} — ${revAccount.name}`)

    // 6. Buat journal entry (POSTED) di org operator
    //    Debit 1201 (Piutang KOJASMAT), Credit 4001 (Pendapatan SaaS)
    const journalRes = await client.query(
      `INSERT INTO journal_entries
         (org_id, entry_date, description, reference_type, reference_id,
          contact_id, status, is_auto, created_at, updated_at)
       VALUES ($1, $2, $3, 'SAAS_SALE', $4, $5, 'POSTED', TRUE, $6, $6)
       RETURNING id, entry_number`,
      [
        operatorOrgId,
        INVOICE_DATE,
        `Penjualan SaaS ${invoiceNumber} — ${CLIENT_NAME}`,
        invoiceId,
        contactId,
        INVOICE_DATE,
      ]
    )
    const journalId     = journalRes.rows[0].id
    const journalNumber = journalRes.rows[0].entry_number
    console.log(`✓ Jurnal dibuat: ${journalNumber ?? journalId}`)

    // 7. Buat journal lines
    await client.query(
      `INSERT INTO journal_lines (entry_id, account_id, debit, credit, memo)
       VALUES
         ($1, $2, $3, 0,   'Piutang SaaS ${CLIENT_NAME} — ' || $4),
         ($1, $5, 0,   $3, 'Pendapatan SaaS ${CLIENT_NAME} — ' || $4)`,
      [journalId, arAccount.id, AMOUNT, invoiceNumber, revAccount.id]
    )
    console.log(`✓ Journal lines:`)
    console.log(`    Debit  ${arAccount.code}  Rp ${AMOUNT.toLocaleString('id-ID')}`)
    console.log(`    Credit ${revAccount.code}  Rp ${AMOUNT.toLocaleString('id-ID')}`)

    await client.query('COMMIT')

    console.log('')
    console.log('══════════════════════════════════════════════════════')
    console.log(`  Invoice ${invoiceNumber} berhasil dibuat`)
    console.log(`  Nominal  : Rp ${AMOUNT.toLocaleString('id-ID')}`)
    console.log(`  Jatuh Tempo : ${DUE_DATE}`)
    console.log(`  Piutang tercatat di AR atas nama: ${CLIENT_NAME}`)
    console.log('══════════════════════════════════════════════════════')

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('✗ Gagal:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
