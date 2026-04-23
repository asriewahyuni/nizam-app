/**
 * app/api/db/route.ts
 *
 * Server-side database proxy untuk browser client.
 * Mendukung:
 * - Query sederhana: select, insert, update, upsert, delete
 * - Nested joins via PostgresNativeClient._resolveNestedRelations
 *
 * Dilindungi oleh session cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createPostgresNativeClient } from '@/lib/db/postgres-client'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { buildSentryActorContext } from '@/lib/monitoring/sentry'

// Tabel yang boleh diakses via browser client
const ALLOWED_TABLES = new Set([
  'organizations', 'branches', 'roles', 'org_members', 'org_member_units', 'org_invitations',
  'saas_packages', 'saas_invoices', 'saas_config', 'saas_vouchers',
  'ai_token_wallets', 'ai_token_topup_packages', 'ai_token_topup_orders', 'ai_token_usage_logs',
  'employees', 'employee_components', 'payroll_components', 'payroll_runs', 'payslips', 'payslip_lines',
  'contacts', 'warehouses', 'warehouse_bins',
  'accounts', 'bank_accounts', 'bank_transactions', 'bank_mutations',
  'products', 'inventory_stocks', 'stock_movements',
  'inventory_adjustments', 'inventory_adjustment_items',
  'inventory_transfers', 'inventory_transfer_items',
  'sales', 'sales_items', 'sales_payments', 'sales_returns', 'sales_return_items',
  'purchases', 'purchase_items', 'purchase_payments', 'purchase_requests',
  'purchase_returns', 'purchase_return_items',
  'journal_entries', 'journal_lines',
  'fixed_assets', 'asset_depreciation_logs',
  'production_boms', 'production_bom_items', 'production_work_orders', 'production_wo_costs',
  'fleet_assets', 'fleet_routes', 'fleet_terminals', 'fleet_schedules', 'fleet_bookings', 'fleet_tickets',
  'bsc_cycles', 'bsc_perspective_weights', 'bsc_kpis', 'bsc_kpi_measurements',
  'zakat_haul', 'zakat_haul_events', 'zakat_asset_timeline',
  'intercompany_accounts', 'intercompany_transactions',
  'service_orders',
  'support_tickets', 'support_ticket_updates',
  'approval_requests', 'coa_account_requests',
  'sales_pages', 'sales_page_leads', 'sales_page_ai_profiles', 'sales_resellers',
  'fiscal_periods', 'budgets',
  'leave_requests', 'expense_claims', 'reimbursements', 'reimbursement_items',
  'attendance',
])

export async function POST(request: NextRequest) {
  let requestBody: Record<string, unknown> | null = null

  try {
    // Verifikasi session
    const session = await getInternalAuthSession()
    if (!session?.user) {
      return NextResponse.json(
        { data: null, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    requestBody = (body && typeof body === 'object') ? body as Record<string, unknown> : null
    const { table, method, columns, filters, orders, limit, payload, upsertPayload, onConflict } = body

    if (!table || typeof table !== 'string') {
      return NextResponse.json({ data: null, error: { message: 'Invalid table' } }, { status: 400 })
    }
    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ data: null, error: { message: `Table '${table}' not allowed` } }, { status: 403 })
    }

    const db = createPostgresNativeClient()
    let query: any

    switch (method) {
      case 'select':
        query = db.from(table).select(columns || '*')
        break
      case 'insert':
        query = db.from(table).insert(payload)
        break
      case 'update':
        query = db.from(table).update(payload)
        break
      case 'upsert': {
        const opts = onConflict ? { onConflict } : undefined
        query = db.from(table).upsert(upsertPayload, opts)
        break
      }
      case 'delete':
        query = db.from(table).delete()
        break
      default:
        return NextResponse.json({ data: null, error: { message: 'Invalid method' } }, { status: 400 })
    }

    // Apply filters
    for (const f of (filters || [])) {
      if (f.type === 'eq') query = query.eq(f.column, f.value)
      else if (f.type === 'neq') query = query.neq(f.column, f.value)
      else if (f.type === 'in') query = query.in(f.column, f.value)
      else if (f.type === 'is') query = query.is(f.column, f.value)
      else if (f.type === 'gt') query = query.gt(f.column, f.value)
      else if (f.type === 'gte') query = query.gte(f.column, f.value)
      else if (f.type === 'lt') query = query.lt(f.column, f.value)
      else if (f.type === 'lte') query = query.lte(f.column, f.value)
      else if (f.type === 'like') query = query.like(f.column, f.value)
      else if (f.type === 'ilike') query = query.ilike(f.column, f.value)
      else if (f.type === 'or') query = query.or(f.value)
      else if (f.type === 'not') query = query.not(f.column, f.value?.op || 'eq', f.value?.value)
    }

    // Apply orders
    for (const o of (orders || [])) {
      query = query.order(o.column, { ascending: o.ascending })
    }

    // Apply limit
    if (limit !== null && limit !== undefined) {
      query = query.limit(limit)
    }

    const result = await query
    return NextResponse.json(result ?? { data: null, error: null })
  } catch (e: any) {
    console.error('[api/db] Error:', e.message)

    const session = await getInternalAuthSession().catch(() => null)
    const actor = buildSentryActorContext({
      userId: session?.user?.id || null,
      email: session?.user?.email || null,
      fullName: String(session?.user?.user_metadata?.full_name || session?.user?.email || ''),
      route: '/api/db',
      feature: 'database_proxy',
    })

    Sentry.withScope((scope) => {
      if (actor.user) scope.setUser(actor.user)
      Object.entries(actor.tags).forEach(([key, value]) => {
        if (value) scope.setTag(key, value)
      })
      scope.setContext('organization', actor.context.organization)
      scope.setContext('branch', actor.context.branch)
      scope.setContext('db_proxy_request', {
        table: String(requestBody?.table || ''),
        method: String(requestBody?.method || ''),
        columns: String(requestBody?.columns || ''),
        filters_count: Array.isArray(requestBody?.filters) ? requestBody.filters.length : 0,
        has_payload: Boolean(requestBody?.payload || requestBody?.upsertPayload),
      })
      Sentry.captureException(e)
    })

    return NextResponse.json(
      { data: null, error: { message: e.message } },
      { status: 500 }
    )
  }
}
