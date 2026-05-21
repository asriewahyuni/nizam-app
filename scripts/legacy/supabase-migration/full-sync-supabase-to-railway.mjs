/**
 * full-sync-supabase-to-railway.mjs
 * Audit dan sync data Supabase → Railway.
 * Jalankan tanpa flag untuk dry-run (audit saja).
 * Jalankan dengan --apply untuk benar-benar insert data yang hilang.
 */

import https from 'https'
import pg from 'pg'
const { Pool } = pg

const SUPABASE_URL = 'https://jbocbeewybphnuhrpddx.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impib2NiZWV3eWJwaG51aHJwZGR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkzNDQxOSwiZXhwIjoyMDg5NTEwNDE5fQ.KTS_F1FyDzZwhupgZnM9Cuatp-MHvqjVGPIDeRYKNfE'
const RAILWAY_URL = 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway'

const APPLY = process.argv.includes('--apply')

const railway = new Pool({ connectionString: RAILWAY_URL, ssl: { rejectUnauthorized: false } })

// Tabel yang dilewati (auth system / sangat besar / tidak relevan)
const SKIP_TABLES = new Set([
  'internal_auth_users',
  'internal_auth_sessions',
  'audit_logs',
])

// Order insert yang aman (parent sebelum child FK)
const TABLE_ORDER = [
  'organizations', 'branches', 'roles', 'org_members', 'org_member_units', 'org_invitations',
  'employees', 'employee_components', 'payroll_components',
  'contacts', 'warehouses', 'warehouse_bins',
  'accounts', 'bank_accounts', 'bank_transactions', 'bank_mutations',
  'fiscal_periods', 'budgets',
  'products', 'inventory_stocks', 'inventory_adjustments', 'inventory_adjustment_items',
  'inventory_transfers', 'inventory_transfer_items', 'stock_movements',
  'sales', 'sales_items', 'sales_payments', 'sales_returns', 'sales_return_items',
  'purchases', 'purchase_items', 'purchase_payments', 'purchase_requests',
  'purchase_returns', 'purchase_return_items',
  'journal_entries', 'journal_lines',
  'payroll_runs', 'payslips', 'payslip_lines',
  'leave_requests', 'expense_claims', 'reimbursements', 'reimbursement_items',
  'attendance',
  'production_boms', 'production_bom_items', 'production_bom_routings',
  'production_work_orders', 'production_wo_costs', 'production_operations',
  'fixed_assets', 'asset_depreciation_logs',
  'fleet_assets', 'fleet_routes', 'fleet_terminals', 'fleet_schedules',
  'fleet_bookings', 'fleet_tickets', 'fleet_maintenance_labs',
  'bsc_cycles', 'bsc_perspective_weights', 'bsc_kpis', 'bsc_kpi_measurements',
  'zakat_haul', 'zakat_haul_events', 'zakat_asset_timeline',
  'intercompany_accounts', 'intercompany_transactions',
  'service_orders',
  'saas_config', 'saas_packages', 'saas_invoices', 'saas_vouchers',
  'sales_resellers',
  'approval_requests', 'coa_account_requests',
  'ai_token_wallets', 'ai_token_topup_packages', 'ai_token_topup_orders',
  'sales_pages', 'sales_page_leads', 'sales_page_ai_profiles',
  'support_tickets', 'support_ticket_updates',
]

function fetchSupabase(table, page = 0) {
  return new Promise((resolve, reject) => {
    const limit = 1000
    const from = page * limit
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc&limit=${limit}&offset=${from}`

    const req = https.get(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed?.message && !Array.isArray(parsed)) {
            reject(new Error(parsed.message))
          } else {
            resolve(Array.isArray(parsed) ? parsed : [])
          }
        } catch {
          reject(new Error(`Parse error for ${table}: ${data.slice(0, 100)}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

async function fetchAllSupabase(table) {
  const rows = []
  let page = 0
  while (true) {
    const batch = await fetchSupabase(table, page)
    rows.push(...batch)
    if (batch.length < 1000) break
    page++
  }
  return rows
}

async function getRailwayIds(table) {
  try {
    const result = await railway.query(`SELECT id::text as id FROM public."${table}"`)
    return new Set(result.rows.map((r) => r.id))
  } catch {
    return new Set()
  }
}

async function insertRows(table, rows) {
  let inserted = 0
  let errors = 0

  for (const row of rows) {
    const cols = Object.keys(row).filter((k) => row[k] !== undefined && row[k] !== null || true)
    const vals = cols.map((k) => row[k])
    const placeholders = cols.map((_, i) => `$${i + 1}`)
    const quotedCols = cols.map((c) => `"${c}"`)

    try {
      await railway.query(
        `INSERT INTO public."${table}" (${quotedCols.join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT (id) DO NOTHING`,
        vals
      )
      inserted++
    } catch (e) {
      // Try without null columns if FK constraint fails
      console.error(`  ⚠  ${table}:${row.id} — ${e.message.slice(0, 100)}`)
      errors++
    }
  }

  return { inserted, errors }
}

async function syncTable(table) {
  if (SKIP_TABLES.has(table)) {
    console.log(`⏭  ${table.padEnd(35)} — skipped`)
    return { status: 'skipped' }
  }

  let supRows
  try {
    supRows = await fetchAllSupabase(table)
  } catch (e) {
    console.log(`❌ ${table.padEnd(35)} — Supabase error: ${e.message.slice(0, 50)}`)
    return { status: 'error' }
  }

  const railwayIds = await getRailwayIds(table)
  const missing = supRows.filter((r) => r.id && !railwayIds.has(String(r.id)))

  const icon = missing.length === 0 ? '✅' : APPLY ? '🔄' : '⚠ '
  console.log(
    `${icon} ${table.padEnd(35)}` +
    ` Supabase: ${String(supRows.length).padStart(5)}` +
    ` | Railway: ${String(railwayIds.size).padStart(5)}` +
    ` | Missing: ${String(missing.length).padStart(4)}`
  )

  if (missing.length > 0 && APPLY) {
    const { inserted, errors } = await insertRows(table, missing)
    console.log(`   → Inserted: ${inserted}, Errors: ${errors}`)
  }

  return { status: missing.length === 0 ? 'ok' : 'missing', missing: missing.length }
}

async function main() {
  console.log(`\n🚀 Nizam App — Supabase → Railway Full Data Sync`)
  console.log(`   Mode: ${APPLY ? '🔴 APPLY (data akan diinsert ke Railway)' : '🟡 DRY RUN (hanya audit)'}`)
  console.log(`   Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n`)
  console.log('='.repeat(72))

  // Get all tables from Railway
  const tablesResult = await railway.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  const allRailwayTables = new Set(tablesResult.rows.map((r) => r.table_name))

  // Process in safe order
  const ordered = [...new Set([...TABLE_ORDER, ...allRailwayTables])].filter((t) => allRailwayTables.has(t))

  const results = { ok: 0, missing: 0, skipped: 0, errors: 0 }

  for (const table of ordered) {
    const r = await syncTable(table)
    if (r.status === 'ok') results.ok++
    else if (r.status === 'missing') results.missing++
    else if (r.status === 'skipped') results.skipped++
    else results.errors++
  }

  console.log('\n' + '='.repeat(72))
  console.log(`✅ Sync selesai:`)
  console.log(`   Sinkron   : ${results.ok} tabel`)
  console.log(`   Kurang    : ${results.missing} tabel ${APPLY ? '(sudah di-insert)' : '(belum di-insert, jalankan --apply)'}`)
  console.log(`   Dilewati  : ${results.skipped} tabel`)
  console.log(`   Error     : ${results.errors} tabel`)

  if (!APPLY && results.missing > 0) {
    console.log(`\n💡 Jalankan dengan --apply untuk insert data yang hilang:`)
    console.log(`   node scripts/full-sync-supabase-to-railway.mjs --apply`)
  }
}

main()
  .then(() => railway.end())
  .catch((e) => {
    console.error('FATAL:', e.message)
    railway.end()
  })
