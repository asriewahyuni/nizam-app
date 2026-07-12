// Script diagnostik: cek apakah jurnal delivery ada untuk SO-000044 dan SO-000047
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

const result = await pool.query(`
  SELECT
    s.sale_number,
    s.sale_date::text,
    s.status,
    s.payment_status,
    s.grand_total,
    s.branch_id,
    s.org_id,
    je.id            AS journal_id,
    je.entry_date::text,
    je.reference_type,
    je.status        AS journal_status,
    COALESCE(SUM(jl.credit) FILTER (WHERE a.type = 'REVENUE'), 0) AS revenue_posted
  FROM public.sales s
  LEFT JOIN public.journal_entries je
    ON je.reference_id = s.id AND je.reference_type = 'SALE'
  LEFT JOIN public.journal_lines jl ON jl.entry_id = je.id
  LEFT JOIN public.accounts a ON a.id = jl.account_id
  WHERE s.sale_number IN ('SO-2026-000047', 'SO-2026-000044')
  GROUP BY s.id, s.sale_number, s.sale_date, s.status, s.payment_status,
           s.grand_total, s.branch_id, s.org_id,
           je.id, je.entry_date, je.reference_type, je.status
  ORDER BY s.sale_number, je.entry_date
`)

console.log('\n=== CEK JURNAL DELIVERY SO-000044 & SO-000047 ===\n')

if (result.rows.length === 0) {
  console.log('❌ Sales order tidak ditemukan di database!')
} else {
  for (const row of result.rows) {
    console.log(`SO       : ${row.sale_number}`)
    console.log(`Tanggal  : ${row.sale_date}`)
    console.log(`Status   : ${row.status} | Payment: ${row.payment_status}`)
    console.log(`Total    : ${Number(row.grand_total).toLocaleString('id-ID')}`)
    console.log(`Branch   : ${row.branch_id ?? '(null)'}`)
    console.log(`Org      : ${row.org_id}`)

    if (!row.journal_id) {
      console.log('❌ JURNAL DELIVERY   : TIDAK ADA — ini penyebab data tidak muncul di insight!')
    } else {
      console.log(`✅ Jurnal ID         : ${row.journal_id}`)
      console.log(`   Entry Date        : ${row.entry_date}`)
      console.log(`   Status Jurnal     : ${row.journal_status}`)
      console.log(`   Revenue Posted    : ${Number(row.revenue_posted).toLocaleString('id-ID')}`)
    }
    console.log('---')
  }
}

await pool.end()
