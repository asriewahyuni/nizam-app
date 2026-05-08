import pg from 'pg'
import nextEnv from '@next/env'
const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const dbUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  await client.connect()

  const operatorOrgId = 'f4455b6f-c7fc-4164-9732-a906bcce5e65'

  // Ambil akun beban pemasaran
  const { rows: expenseAccounts } = await client.query(`SELECT id FROM accounts WHERE code = '6005' AND org_id = $1`, [operatorOrgId])
  if (expenseAccounts.length === 0) throw new Error("Akun 6005 tidak ditemukan")
  const expenseAccountId = expenseAccounts[0].id

  // Ambil akun kas operasional (1103)
  const { rows: bankAccounts } = await client.query(`SELECT id FROM accounts WHERE code = '1103' AND org_id = $1`, [operatorOrgId])
  if (bankAccounts.length === 0) throw new Error("Akun 1103 tidak ditemukan")
  const bankAccountId = bankAccounts[0].id

  // Cari invoice PAID dengan reseller
  const { rows: invoices } = await client.query(`
    SELECT si.id, si.invoice_number, si.amount, si.updated_at, sr.name, sr.commission_type, sr.commission_value
    FROM saas_invoices si
    JOIN sales_resellers sr ON sr.id = si.reseller_id
    WHERE si.status = 'PAID' AND si.reseller_id IS NOT NULL
  `)

  for (const inv of invoices) {
    const { rows: existing } = await client.query(`SELECT id FROM journal_entries WHERE reference_id = $1 AND reference_type = 'SAAS_COMMISSION'`, [inv.id])
    if (existing.length > 0) continue

    const { rows: existingJournals } = await client.query(`SELECT created_by FROM journal_entries WHERE reference_id = $1 LIMIT 1`, [inv.id])
    const actorId = existingJournals.length > 0 ? existingJournals[0].created_by : '00000000-0000-0000-0000-000000000000'

    let commAmount = 0
    const totalAmount = Number(inv.amount || 0)
    if (String(inv.commission_type).toUpperCase() === 'PERCENT') {
      commAmount = (totalAmount * Number(inv.commission_value || 0)) / 100
    } else {
      commAmount = Number(inv.commission_value || 0)
    }

    if (commAmount <= 0) continue

    const entryDate = new Date(inv.updated_at || new Date()).toISOString()
    const description = `Pembayaran Komisi SaaS ${inv.invoice_number}`
    
    await client.query('BEGIN')
    try {
      const { rows: journal } = await client.query(`
        INSERT INTO journal_entries (
          org_id, entry_date, description, reference_type, reference_id, notes, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, 'POSTED', $7) RETURNING id
      `, [operatorOrgId, entryDate, description, 'SAAS_COMMISSION', inv.id, `Pembayaran komisi reseller otomatis untuk mitra ${inv.name}.`, actorId])
      
      const journalId = journal[0].id

      await client.query(`
        INSERT INTO journal_lines (
          entry_id, account_id, debit, credit, memo
        ) VALUES 
        ($1, $2, $3, 0, $4),
        ($1, $5, 0, $6, $7)
      `, [
        journalId, 
        expenseAccountId, commAmount, `Beban Komisi ${inv.name}`,
        bankAccountId, commAmount, `Pembayaran Komisi ${inv.name}`
      ])

      await client.query('COMMIT')
      console.log(`Successfully created SAAS_COMMISSION journal for ${inv.invoice_number}`)
    } catch (e) {
      await client.query('ROLLBACK')
      console.error(`Failed to process ${inv.invoice_number}:`, e)
    }
  }
}

run().catch(console.error).finally(() => client.end())
