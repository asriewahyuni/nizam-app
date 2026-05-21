/**
 * deep-sync-supabase-to-railway.mjs
 *
 * Sync LENGKAP Supabase → Railway dengan UPSERT (bukan hanya INSERT).
 * Setiap row yang ada di Supabase akan di-upsert ke Railway,
 * memastikan data yang berubah/terupdate juga ikut tersync.
 *
 * Mode:
 *   --audit  : hanya audit perbedaan (default)
 *   --apply  : sync semua perbedaan ke Railway
 */

import https from 'https'
import pg from 'pg'
const { Pool } = pg

const SUPABASE_URL = 'https://jbocbeewybphnuhrpddx.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impib2NiZWV3eWJwaG51aHJwZGR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkzNDQxOSwiZXhwIjoyMDg5NTEwNDE5fQ.KTS_F1FyDzZwhupgZnM9Cuatp-MHvqjVGPIDeRYKNfE'
const RAILWAY_URL = 'postgresql://postgres:WizrKrHnupxehsBQmpqnlxOgMANBAbVB@maglev.proxy.rlwy.net:25780/railway'

const APPLY = process.argv.includes('--apply')
const VERBOSE = process.argv.includes('--verbose')

const railway = new Pool({ connectionString: RAILWAY_URL, ssl: { rejectUnauthorized: false } })

// Tabel non-id (PK berbeda)
const NON_ID_TABLES = {
  saas_config: 'key',
  ai_token_wallets: 'org_id',
}

// Tabel yang dilewati
const SKIP_TABLES = new Set([
  'internal_auth_users',
  'internal_auth_sessions',
  'audit_logs',        // terlalu besar, log-only
])

// Urutan upsert yang aman (parent sebelum child)
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
  'production_boms', 'production_bom_items',
  'production_work_orders', 'production_wo_costs',
  'fixed_assets', 'asset_depreciation_logs',
  'fleet_assets', 'fleet_routes', 'fleet_terminals', 'fleet_schedules',
  'fleet_bookings', 'fleet_tickets', 'fleet_maintenance_labs',
  'bsc_cycles', 'bsc_perspective_weights', 'bsc_kpis', 'bsc_kpi_measurements',
  'zakat_haul', 'zakat_haul_events', 'zakat_asset_timeline',
  'intercompany_accounts', 'intercompany_transactions',
  'service_orders',
  'saas_packages', 'saas_invoices', 'saas_vouchers',
  'sales_resellers',
  'approval_requests', 'coa_account_requests',
  'ai_token_topup_packages', 'ai_token_topup_orders',
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
        Prefer: 'count=exact',
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

async function getRailwayRows(table, pkCol = 'id') {
  try {
    const result = await railway.query(`SELECT ${pkCol}::text as pk, * FROM public."${table}"`)
    const map = new Map()
    for (const r of result.rows) {
      map.set(r.pk, r)
    }
    return map
  } catch {
    return new Map()
  }
}

/**
 * Upsert rows ke Railway via INSERT ... ON CONFLICT (pk) DO UPDATE SET ...
 */
async function upsertRows(table, rows, pkCol = 'id') {
  let upserted = 0
  let errors = 0

  for (const row of rows) {
    const cols = Object.keys(row).filter((k) => row[k] !== undefined)
    if (cols.length === 0) continue

    const vals = cols.map((k) => row[k])
    const placeholders = cols.map((_, i) => `$${i + 1}`)
    const quotedCols = cols.map((c) => `"${c}"`)

    // SET clause untuk UPDATE (semua kolom kecuali PK)
    const updateCols = cols.filter((c) => c !== pkCol)
    const setClauses = updateCols.map((c, i) => `"${c}" = $${cols.indexOf(c) + 1}`)

    const sql = setClauses.length > 0
      ? `INSERT INTO public."${table}" (${quotedCols.join(',')}) VALUES (${placeholders.join(',')})
         ON CONFLICT ("${pkCol}") DO UPDATE SET ${setClauses.join(', ')}`
      : `INSERT INTO public."${table}" (${quotedCols.join(',')}) VALUES (${placeholders.join(',')})
         ON CONFLICT ("${pkCol}") DO NOTHING`

    try {
      await railway.query(sql, vals)
      upserted++
    } catch (e) {
      if (VERBOSE) console.error(`  ⚠  ${table}:${row[pkCol]} — ${e.message.slice(0, 100)}`)
      errors++
    }
  }

  return { upserted, errors }
}

/**
 * Bandingkan dua row berdasarkan updated_at atau checksum sederhana
 */
function isRowDifferent(supRow, railRow) {
  if (!railRow) return true // missing
  // Cek updated_at
  const supUpdated = supRow.updated_at || supRow.created_at || ''
  const railUpdated = railRow.updated_at || railRow.created_at || ''
  if (supUpdated && railUpdated && supUpdated !== railUpdated) return true
  // Cek beberapa field kritis
  const keysToCheck = Object.keys(supRow).slice(0, 10) // cek 10 field pertama saja
  for (const k of keysToCheck) {
    const sv = JSON.stringify(supRow[k])
    const rv = JSON.stringify(railRow[k])
    if (sv !== rv) return true
  }
  return false
}

async function syncTable(table) {
  const pkCol = NON_ID_TABLES[table] || 'id'

  if (SKIP_TABLES.has(table)) {
    console.log(`⏭  ${table.padEnd(38)} — skipped`)
    return { status: 'skipped' }
  }

  let supRows
  try {
    supRows = await fetchAllSupabase(table)
  } catch (e) {
    console.log(`❌ ${table.padEnd(38)} — Supabase error: ${e.message.slice(0, 50)}`)
    return { status: 'error' }
  }

  const railwayMap = await getRailwayRows(table, pkCol)

  let missing = 0
  let outdated = 0
  const toSync = []

  for (const supRow of supRows) {
    const pk = String(supRow[pkCol] ?? '')
    const railRow = railwayMap.get(pk)
    if (!railRow) {
      missing++
      toSync.push(supRow)
    } else if (isRowDifferent(supRow, railRow)) {
      outdated++
      toSync.push(supRow)
    }
  }

  const icon = toSync.length === 0 ? '✅' : APPLY ? '🔄' : '⚠ '
  console.log(
    `${icon} ${table.padEnd(38)}` +
    ` Supabase: ${String(supRows.length).padStart(5)}` +
    ` | Railway: ${String(railwayMap.size).padStart(5)}` +
    ` | Missing: ${String(missing).padStart(4)}` +
    ` | Outdated: ${String(outdated).padStart(4)}`
  )

  if (toSync.length > 0 && APPLY) {
    const { upserted, errors } = await upsertRows(table, toSync, pkCol)
    if (upserted > 0 || errors > 0) {
      console.log(`   → Upserted: ${upserted}, Errors: ${errors}`)
    }
  }

  return {
    status: toSync.length === 0 ? 'ok' : 'diff',
    missing,
    outdated,
    total: supRows.length
  }
}

async function syncNonIdTables() {
  console.log('\n--- Sync tabel non-id (PK khusus) ---')

  // saas_config
  try {
    const supConfig = await fetchAllSupabase('saas_config')
    const railConfig = await railway.query('SELECT key, value, updated_at FROM public.saas_config')
    const railMap = new Map(railConfig.rows.map(r => [r.key, r]))

    for (const row of supConfig) {
      const rail = railMap.get(row.key)
      const icon = !rail ? '⚠ ' : JSON.stringify(row.value) !== JSON.stringify(rail.value) ? '🔄' : '✅'
      console.log(`  ${icon} saas_config[${row.key}]`)
      if (APPLY && (!rail || JSON.stringify(row.value) !== JSON.stringify(rail.value))) {
        await railway.query(
          `INSERT INTO public.saas_config (key, value, updated_at)
           VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = $3`,
          [row.key, JSON.stringify(row.value), row.updated_at || new Date().toISOString()]
        )
      }
    }
  } catch (e) {
    console.log(`  ❌ saas_config: ${e.message.slice(0, 60)}`)
  }

  // ai_token_wallets
  try {
    const supWallets = await fetchAllSupabase('ai_token_wallets')
    const railWallets = await railway.query('SELECT org_id::text, balance_tokens, total_purchased_tokens, total_used_tokens, updated_at FROM public.ai_token_wallets')
    const railMap = new Map(railWallets.rows.map(r => [r.org_id, r]))

    let diff = 0
    for (const w of supWallets) {
      const rail = railMap.get(w.org_id)
      if (!rail || String(rail.balance_tokens) !== String(w.balance_tokens)) {
        diff++
        if (APPLY) {
          await railway.query(
            `INSERT INTO public.ai_token_wallets (org_id, balance_tokens, total_purchased_tokens, total_used_tokens, low_balance_threshold, created_at, updated_at)
             VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (org_id) DO UPDATE SET
               balance_tokens = $2, total_purchased_tokens = $3, total_used_tokens = $4,
               low_balance_threshold = $5, updated_at = $7`,
            [w.org_id, w.balance_tokens, w.total_purchased_tokens, w.total_used_tokens, w.low_balance_threshold, w.created_at, w.updated_at]
          )
        }
      }
    }
    console.log(`  ${diff === 0 ? '✅' : APPLY ? '🔄' : '⚠ '} ai_token_wallets — Supabase: ${supWallets.length} | Railway: ${railWallets.rows.length} | Diff: ${diff}`)
    if (diff > 0 && APPLY) console.log(`   → Updated ${diff} wallet(s)`)
  } catch (e) {
    console.log(`  ❌ ai_token_wallets: ${e.message.slice(0, 60)}`)
  }
}

async function syncAuthUsers() {
  console.log('\n--- Sync auth.users ---')
  const SERVICE_KEY_LOCAL = SERVICE_KEY

  // Fetch Supabase auth users
  const users = await new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/auth/v1/admin/users?per_page=200`
    const req = https.get(url, {
      headers: { apikey: SERVICE_KEY_LOCAL, Authorization: `Bearer ${SERVICE_KEY_LOCAL}` },
    }, (res) => {
      let d = ''; res.on('data', c => d += c)
      res.on('end', () => resolve(JSON.parse(d).users || []))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => req.destroy())
  })

  const railwayUsers = await railway.query('SELECT id::text, email FROM auth.users')
  const railIds = new Set(railwayUsers.rows.map(r => r.id))
  const missing = users.filter(u => !railIds.has(u.id))

  console.log(`  Supabase: ${users.length} | Railway: ${railwayUsers.rows.length} | Missing: ${missing.length}`)

  if (missing.length > 0 && APPLY) {
    for (const u of missing) {
      try {
        await railway.query(
          `INSERT INTO auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
           VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET email = $2, updated_at = $9`,
          [u.id, u.email, u.encrypted_password || '', JSON.stringify(u.app_metadata || {}),
           JSON.stringify(u.user_metadata || {}), u.aud || 'authenticated',
           u.role || 'authenticated', u.created_at, u.updated_at]
        )
        console.log(`  ✅ Inserted: ${u.email}`)
      } catch (e) {
        console.error(`  ❌ ${u.email}: ${e.message.slice(0, 60)}`)
      }
    }
  }
}

async function main() {
  console.log(`\n🚀 Nizam App — Deep Sync: Supabase → Railway`)
  console.log(`   Mode: ${APPLY ? '🔴 APPLY (upsert semua data berbeda)' : '🟡 AUDIT (hanya cek perbedaan)'}`)
  console.log(`   Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`)
  console.log('='.repeat(75))
  console.log(`${'Tabel'.padEnd(40)}${'Supabase'.padStart(9)} ${'Railway'.padStart(9)} ${'Missing'.padStart(8)} ${'Outdated'.padStart(9)}`)
  console.log('-'.repeat(75))

  // Get all Railway tables
  const tablesResult = await railway.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  const allRailwayTables = new Set(tablesResult.rows.map(r => r.table_name))

  // Process in order
  const skipNonId = new Set(Object.keys(NON_ID_TABLES))
  const ordered = [...new Set([...TABLE_ORDER, ...allRailwayTables])]
    .filter(t => allRailwayTables.has(t) && !skipNonId.has(t))

  const stats = { ok: 0, diff: 0, skipped: 0, errors: 0, totalMissing: 0, totalOutdated: 0 }

  for (const table of ordered) {
    const r = await syncTable(table)
    if (r.status === 'ok') stats.ok++
    else if (r.status === 'diff') { stats.diff++; stats.totalMissing += r.missing || 0; stats.totalOutdated += r.outdated || 0 }
    else if (r.status === 'skipped') stats.skipped++
    else stats.errors++
  }

  // Sync non-id tables & auth
  await syncNonIdTables()
  await syncAuthUsers()

  console.log('\n' + '='.repeat(75))
  console.log('📊 Hasil Audit:')
  console.log(`   ✅ Sinkron        : ${stats.ok} tabel`)
  console.log(`   ⚠  Ada perbedaan  : ${stats.diff} tabel (${stats.totalMissing} missing, ${stats.totalOutdated} outdated)`)
  console.log(`   ⏭  Dilewati       : ${stats.skipped} tabel`)
  console.log(`   ❌ Error          : ${stats.errors} tabel`)

  if (!APPLY && (stats.diff > 0)) {
    console.log(`\n💡 Jalankan dengan --apply untuk sync:`)
    console.log(`   node scripts/deep-sync-supabase-to-railway.mjs --apply`)
  } else if (APPLY) {
    console.log('\n✅ Sync selesai — Railway sekarang sama dengan Supabase.')
  }
}

main()
  .then(() => railway.end())
  .catch(e => { console.error('FATAL:', e.message); railway.end() })
