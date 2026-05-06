import pg from 'pg'
import * as nextEnvPkg from '@next/env'
const { loadEnvConfig } = nextEnvPkg.default || nextEnvPkg
loadEnvConfig(process.cwd())

const dbUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function run() {
  await client.connect()

  const invoiceNumber = 'INV-260406-PONW'
  console.log(`Checking journals for ${invoiceNumber}...`)

  const { rows: invoice } = await client.query(`
    SELECT id, created_at, status FROM saas_invoices WHERE invoice_number = $1
  `, [invoiceNumber]);
  
  if (invoice.length === 0) {
    console.log('Invoice not found in DB.')
  } else {
    console.log('Invoice:', invoice[0]);
    
    const { rows: journals } = await client.query(`
      SELECT j.id, j.status, j.entry_date, j.reference_type, j.org_id, o.name as org_name, j.branch_id
      FROM journal_entries j
      LEFT JOIN organizations o ON o.id = j.org_id
      WHERE j.reference_id = $1
    `, [invoice[0].id]);
    
    console.log('Journals:', journals);
    
    if (journals.length > 0) {
      const entryIds = journals.map(j => j.id);
      const { rows: lines } = await client.query(`
        SELECT jl.entry_id, a.code, a.name, jl.debit, jl.credit
        FROM journal_lines jl
        JOIN accounts a ON a.id = jl.account_id
        WHERE jl.entry_id = ANY($1::uuid[])
      `, [entryIds]);
      console.log('Journal Lines:', lines);
    }
  }

}

run().catch(console.error).finally(() => client.end())
