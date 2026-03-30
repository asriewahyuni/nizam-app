'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ResetOrganizationMode = 'transactions' | 'all_data'

type ResetOrganizationOptions = {
  mode?: ResetOrganizationMode
  confirmationText?: string
}

type AdminDbClient = Awaited<ReturnType<typeof createAdminClient>>

const TRANSACTION_RESET_TABLES = [
  'approval_requests',
  'intercompany_transactions',
  'bank_mutations',
  'bank_transactions',
  'inventory_transfers',
  'inventory_adjustments',
  'payroll_runs',
  'expense_claims',
  'reimbursements',
  'attendance',
  'leave_requests',
  'fleet_tickets',
  'fleet_schedules',
  'fleet_bookings',
  'fleet_maintenance_labs',
  'service_orders',
  'purchase_requests',
  'production_work_orders',
  'zakat_asset_timeline',
  'zakat_haul_events',
  'zakat_haul',
  'budgets',
  'fiscal_periods',
  'fixed_assets',
  'sales_returns',
  'purchase_returns',
  'sales_payments',
  'purchase_payments',
  'journal_entries',
  'sales',
  'purchases',
  'stock_movements',
  'inventory_stocks',
  'audit_logs',
] as const

const FULL_RESET_MASTER_TABLES = [
  'org_invitations',
  'bank_accounts',
  'payroll_components',
  'employees',
  'fleet_routes',
  'fleet_assets',
  'fleet_terminals',
  'production_boms',
  'production_operations',
  'intercompany_accounts',
  'warehouse_bins',
  'warehouses',
  'branches',
  'products',
  'contacts',
] as const

function getExpectedConfirmationText(orgName: string, mode: ResetOrganizationMode) {
  if (mode === 'all_data') {
    return orgName.trim()
  }

  return 'RESET TRANSAKSI'
}

async function clearTablesByOrg(db: AdminDbClient, orgId: string, tables: readonly string[]) {
  const isSkippableMissingObjectError = (error: { code?: string; message?: string } | null | undefined) => {
    if (!error) return false

    const code = String(error.code || '').toUpperCase()
    const message = String(error.message || '').toLowerCase()

    // postgres
    if (code === '42P01' || code === '42703') return true

    // postgrest schema-cache misses
    if (code === 'PGRST205' || code === 'PGRST204') return true

    // fallback by message (in case code differs across env)
    if (
      message.includes('could not find the table') ||
      message.includes('schema cache') ||
      message.includes('does not exist') ||
      message.includes('could not find the') && message.includes('column')
    ) {
      return true
    }

    return false
  }

  for (const table of tables) {
    const { error } = await db
      .from(table)
      .delete()
      .eq('org_id', orgId)

    if (error && !isSkippableMissingObjectError(error)) {
      return { success: false, error: `Error di tabel ${table}: ${error.message}` }
    }
  }

  return { success: true as const }
}

export async function getAuditLogs(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .rpc('get_audit_logs_with_users', { p_org_id: orgId })

  if (error) {
    console.error('Error fetching audit logs with users:', error)
    return []
  }
  
  return data
}

// Catatan: Fungsi createAuditLog bisa ditambahkan untuk trigger di sisi server actions lain
export async function createAuditLog(
   orgId: string, 
   userId: string | null, 
   action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VOID' | 'POST',
   table: string,
   recordId: string,
   oldData?: unknown,
   newData?: unknown
) {
   const supabase = await createClient()
   await (supabase as any).from('audit_logs').insert({
      org_id: orgId,
      user_id: userId,
      action,
      table_name: table,
      record_id: recordId,
      old_data: oldData,
      new_data: newData,
      user_agent: 'NIZAM ERP System'
   })
}

export async function resetOrganizationData(orgId: string, options: ResetOrganizationOptions = {}) {
  const supabase = await createClient()
  const adminClient = await createAdminClient()
  const mode = options.mode || 'transactions'

  try {
    const { data: authData } = await (supabase as any).auth.getUser()
    const user = authData.user

    if (!user) {
      return { success: false, error: 'Tidak terautentikasi.' }
    }

    const [{ data: membership }, { data: organization }] = await Promise.all([
      (adminClient as any)
        .from('org_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
      (adminClient as any)
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .maybeSingle(),
    ])

    if (!organization?.name) {
      return { success: false, error: 'Organisasi tidak ditemukan.' }
    }

    if (membership?.role !== 'owner') {
      return { success: false, error: 'Hanya owner yang boleh melakukan reset data.' }
    }

    const expectedConfirmation = getExpectedConfirmationText(organization.name, mode)
    if ((options.confirmationText || '').trim() !== expectedConfirmation) {
      return { success: false, error: `Konfirmasi tidak cocok. Ketik "${expectedConfirmation}" untuk melanjutkan.` }
    }

    const transactionReset = await clearTablesByOrg(adminClient, orgId, TRANSACTION_RESET_TABLES)
    if (!transactionReset.success) {
      return transactionReset
    }

    if (mode === 'all_data') {
      const masterReset = await clearTablesByOrg(adminClient, orgId, FULL_RESET_MASTER_TABLES)
      if (!masterReset.success) {
        return masterReset
      }
    }

    await (adminClient as any).from('audit_logs').insert({
      org_id: orgId,
      user_id: user.id,
      action: 'DELETE',
      table_name: 'SYSTEM_RESET',
      record_id: orgId,
      new_data: {
        mode,
        status: 'SUCCESS',
        preserved: ['organizations', 'org_members', 'roles', 'accounts', 'saas_*'],
      },
      user_agent: 'NIZAM ERP System',
    })

    const pathsToRefresh = [
      '/',
      '/dashboard',
      '/settings/business',
      '/settings/audit',
      '/settings/users',
      '/inventory',
      '/purchasing',
      '/sales',
      '/hris',
      '/fleet',
      '/factory',
      '/cash',
      '/reports',
    ]

    for (const path of pathsToRefresh) {
      revalidatePath(path)
    }
    revalidatePath('/', 'layout')

    return {
      success: true,
      mode,
      message: mode === 'all_data'
        ? 'Seluruh data operasional berhasil direset. Profil bisnis, owner, role, akun, dan billing tetap dipertahankan.'
        : 'Seluruh transaksi berhasil direset. Data master utama tetap dipertahankan.',
    }
  } catch (error) {
    console.error('💣 Critical Reset Failure:', error)
    const message = error instanceof Error ? error.message : 'Unknown reset error'
    return { success: false, error: 'Internal Error: ' + message }
  }
}
