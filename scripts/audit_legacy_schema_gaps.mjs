/**
 * Audit objek schema Railway yang sering jadi sumber error saat migrasi tertinggal.
 * Fokusnya ke hotspot runtime yang memang punya compatibility fallback di codebase.
 */

import pg from 'pg'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

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

const columnChecks = [
  ['purchases.insurance_amount', 'purchases', 'insurance_amount'],
  ['purchases.warehouse_id', 'purchases', 'warehouse_id'],
  ['sales.reseller_id', 'sales', 'reseller_id'],
  ['sales.commission_type', 'sales', 'commission_type'],
  ['sales.commission_value', 'sales', 'commission_value'],
  ['sales.pos_session_id', 'sales', 'pos_session_id'],
  ['sales.pos_payment_method', 'sales', 'pos_payment_method'],
  ['sales.pos_amount_tendered', 'sales', 'pos_amount_tendered'],
  ['sales.pos_change_amount', 'sales', 'pos_change_amount'],
  ['employees.department_id', 'employees', 'department_id'],
  ['employees.role_id', 'employees', 'role_id'],
  ['org_members.role_id', 'org_members', 'role_id'],
  ['organizations.manager_employee_id', 'organizations', 'manager_employee_id'],
  ['roles.department_ids', 'roles', 'department_ids'],
  ['saas_invoices.item_name', 'saas_invoices', 'item_name'],
  ['saas_invoices.item_description', 'saas_invoices', 'item_description'],
  ['saas_invoices.discount_percent', 'saas_invoices', 'discount_percent'],
  ['saas_invoices.discount_amount', 'saas_invoices', 'discount_amount'],
  ['saas_invoices.tax_percent', 'saas_invoices', 'tax_percent'],
  ['saas_invoices.tax_amount', 'saas_invoices', 'tax_amount'],
  ['warehouses.branch_id', 'warehouses', 'branch_id'],
]

const tableChecks = [
  'pos_shift_sessions',
  'pos_shift_settlements',
  'internal_auth_users',
  'internal_auth_sessions',
  'internal_auth_password_resets',
]

const functionChecks = [
  {
    label: 'adjust_inventory_stock(uuid,uuid,uuid,numeric, text, uuid)',
    key: 'adjust_inventory_stock(p_org_id uuid, p_product_id uuid, p_warehouse_id uuid, p_diff numeric, p_batch_number text, p_bin_id uuid)',
  },
  {
    label: 'adjust_inventory_stock(uuid,uuid,uuid,numeric)',
    key: 'adjust_inventory_stock(p_org_id uuid, p_product_id uuid, p_warehouse_id uuid, p_diff numeric)',
  },
  {
    label: 'void_sale_atomic(uuid,uuid,uuid,text)',
    key: 'void_sale_atomic(p_org_id uuid, p_sale_id uuid, p_user_id uuid, p_reason text)',
  },
  {
    label: 'void_sale_atomic(uuid,text,uuid,uuid) [legacy alias]',
    key: 'void_sale_atomic(p_org_id uuid, p_reason text, p_sale_id uuid, p_user_id uuid)',
    optional: true,
  },
  {
    label: 'void_purchase_atomic(uuid,uuid,uuid,text)',
    key: 'void_purchase_atomic(p_org_id uuid, p_purchase_id uuid, p_user_id uuid, p_reason text)',
  },
  {
    label: 'resolve_single_active_warehouse(uuid,uuid)',
    key: 'resolve_single_active_warehouse(p_org_id uuid, p_branch_id uuid)',
  },
  {
    label: 'recalculate_average_cost()',
    key: 'recalculate_average_cost()',
  },
]

const triggerChecks = [
  ['trg_recalculate_average_cost', 'stock_movements'],
  ['trg_guard_sales_non_salam_stock_after_delivery', 'sales'],
]

function formatStatus(ok) {
  return ok ? 'OK' : 'MISSING'
}

async function queryColumnMetadata() {
  const { rows } = await client.query(`
    SELECT
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'purchases' AND column_name IN ('insurance_amount', 'warehouse_id'))
        OR (table_name = 'sales' AND column_name IN ('reseller_id', 'commission_type', 'commission_value', 'pos_session_id', 'pos_payment_method', 'pos_amount_tendered', 'pos_change_amount'))
        OR (table_name = 'employees' AND column_name IN ('department_id', 'role_id'))
        OR (table_name = 'org_members' AND column_name IN ('role_id'))
        OR (table_name = 'organizations' AND column_name IN ('manager_employee_id'))
        OR (table_name = 'roles' AND column_name IN ('department_ids'))
        OR (table_name = 'saas_invoices' AND column_name IN ('item_name', 'item_description', 'discount_percent', 'discount_amount', 'tax_percent', 'tax_amount'))
        OR (table_name = 'warehouses' AND column_name IN ('branch_id'))
      )
  `)

  return new Map(rows.map((row) => [`${row.table_name}.${row.column_name}`, row]))
}

async function queryExistingTables() {
  const { rows } = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [tableChecks]
  )

  return new Set(rows.map((row) => row.table_name))
}

async function queryExistingFunctions() {
  const { rows } = await client.query(`
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'adjust_inventory_stock',
        'void_sale_atomic',
        'void_purchase_atomic',
        'resolve_single_active_warehouse',
        'recalculate_average_cost'
      )
  `)

  return new Set(rows.map((row) => `${row.proname}(${row.args})`))
}

async function queryExistingTriggers() {
  const triggerNames = triggerChecks.map(([name]) => name)
  const { rows } = await client.query(
    `
      SELECT tgname AS trigger_name, c.relname AS table_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND NOT t.tgisinternal
        AND t.tgname = ANY($1::text[])
    `,
    [triggerNames]
  )

  return new Set(rows.map((row) => `${row.trigger_name}@${row.table_name}`))
}

function resolveColumnState(row) {
  if (!row) return { status: 'MISSING', detail: '-' }

  const udt = String(row.udt_name || '').trim().toLowerCase()
  const dataType = String(row.data_type || '').trim().toLowerCase()
  const detailParts = [
    dataType || 'unknown',
    udt && udt !== dataType ? `udt=${udt}` : '',
    row.is_nullable ? `nullable=${row.is_nullable}` : '',
    row.column_default ? `default=${String(row.column_default).replace(/\s+/g, ' ')}` : '',
  ].filter(Boolean)

  if (row.table_name === 'roles' && row.column_name === 'department_ids') {
    if (udt === '_nizam_department') {
      return { status: 'LEGACY', detail: detailParts.join(', ') }
    }
    if (udt !== '_text' && dataType !== 'array') {
      return { status: 'ODD', detail: detailParts.join(', ') }
    }
  }

  return { status: 'OK', detail: detailParts.join(', ') }
}

async function run() {
  await client.connect()
  console.log('✅ Terhubung ke Railway PostgreSQL...')

  const columnMap = await queryColumnMetadata()
  const existingTables = await queryExistingTables()
  const existingFunctions = await queryExistingFunctions()
  const existingTriggers = await queryExistingTriggers()

  console.log('\n=== Columns ===')
  for (const [label, tableName, columnName] of columnChecks) {
    const row = columnMap.get(`${tableName}.${columnName}`)
    const state = resolveColumnState(row)
    console.log(`${state.status.padEnd(7)} ${label} ${state.detail ? `| ${state.detail}` : ''}`)
  }

  console.log('\n=== Tables ===')
  for (const tableName of tableChecks) {
    console.log(`${formatStatus(existingTables.has(tableName)).padEnd(7)} public.${tableName}`)
  }

  console.log('\n=== Functions ===')
  for (const fn of functionChecks) {
    const exists = existingFunctions.has(fn.key)
    const status = exists ? 'OK' : (fn.optional ? 'OPTIONAL' : 'MISSING')
    console.log(`${status.padEnd(8)} ${fn.label}`)
  }

  console.log('\n=== Triggers ===')
  for (const [triggerName, tableName] of triggerChecks) {
    console.log(`${formatStatus(existingTriggers.has(`${triggerName}@${tableName}`)).padEnd(7)} ${triggerName} ON public.${tableName}`)
  }

  const missingColumns = columnChecks
    .filter(([, tableName, columnName]) => !columnMap.has(`${tableName}.${columnName}`))
    .map(([label]) => label)
  const legacyColumns = columnChecks
    .map(([label, tableName, columnName]) => [label, resolveColumnState(columnMap.get(`${tableName}.${columnName}`))])
    .filter(([, state]) => state.status === 'LEGACY' || state.status === 'ODD')
    .map(([label, state]) => `${label} (${state.status})`)
  const missingTables = tableChecks.filter((tableName) => !existingTables.has(tableName)).map((tableName) => `public.${tableName}`)
  const missingFunctions = functionChecks
    .filter((fn) => !fn.optional && !existingFunctions.has(fn.key))
    .map((fn) => fn.label)
  const optionalMissingFunctions = functionChecks
    .filter((fn) => fn.optional && !existingFunctions.has(fn.key))
    .map((fn) => fn.label)
  const missingTriggers = triggerChecks
    .filter(([triggerName, tableName]) => !existingTriggers.has(`${triggerName}@${tableName}`))
    .map(([triggerName, tableName]) => `${triggerName} ON public.${tableName}`)

  console.log('\n=== Summary ===')
  console.log(JSON.stringify({
    missingColumns,
    legacyColumns,
    missingTables,
    missingFunctions,
    optionalMissingFunctions,
    missingTriggers,
  }, null, 2))

  await client.end()
}

run().catch(async (error) => {
  console.error('❌ Audit gagal:', error?.message || error)
  try {
    await client.end()
  } catch {}
  process.exit(1)
})
