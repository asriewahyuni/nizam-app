'use server'

import { auth } from '@/auth'
import { getMembership } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export type ResetOrganizationMode = 'transactions' | 'all_data'

type ResetOrganizationOptions = {
  mode?: ResetOrganizationMode
  confirmationText?: string
}

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

function isSkippableMissingObjectError(error: unknown) {
  const message = String((error as { message?: string } | null | undefined)?.message || '').toLowerCase()

  return (
    message.includes('relation') && message.includes('does not exist')
  ) || (
    message.includes('column') && message.includes('does not exist')
  ) || (
    message.includes('could not find the table')
  ) || (
    message.includes('schema cache')
  )
}

async function clearTablesByOrg(orgId: string, tables: readonly string[]) {
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM public."${table}" WHERE org_id = $1`,
        orgId
      )
    } catch (error) {
      if (!isSkippableMissingObjectError(error)) {
        const message = error instanceof Error ? error.message : 'Unknown reset error'
        return { success: false, error: `Error di tabel ${table}: ${message}` }
      }
    }
  }

  return { success: true as const }
}

function buildAuditDescription(action: string, tableName: string) {
  switch (String(action || '').toUpperCase()) {
    case 'CREATE':
      return `Menambahkan data baru di ${tableName}`
    case 'UPDATE':
      return `Mengubah data di ${tableName}`
    case 'DELETE':
      return `Menghapus data dari ${tableName}`
    case 'VOID':
      return `Membatalkan (VOID) transaksi di ${tableName}`
    default:
      return `${action} pada ${tableName}`
  }
}

export async function getAuditLogs(orgId: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return []

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return []

  const membership = await getMembership(userId, trimmedOrgId)
  if (!membership?.isOwnerOrAdmin) {
    return []
  }

  const logs = await prisma.audit_logs.findMany({
    where: {
      org_id: trimmedOrgId,
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 200,
    select: {
      id: true,
      org_id: true,
      created_at: true,
      user_id: true,
      action: true,
      table_name: true,
      record_id: true,
      old_data: true,
      new_data: true,
    },
  })

  const actorIds = Array.from(
    new Set(
      logs
        .map((log) => String(log.user_id || '').trim())
        .filter(Boolean)
    )
  )

  const users = actorIds.length > 0
    ? await prisma.user.findMany({
        where: {
          id: { in: actorIds },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
    : []

  const usersById = new Map(users.map((entry) => [entry.id, entry]))

  return logs.map((log) => {
    const actor = log.user_id ? usersById.get(log.user_id) : null
    return {
      id: log.id,
      org_id: log.org_id,
      created_at: log.created_at.toISOString(),
      user_email: actor?.email || 'System / User',
      user_name: actor?.name || actor?.email || 'Logged Actor',
      action: log.action,
      table_name: log.table_name,
      record_id: log.record_id,
      old_data: log.old_data,
      new_data: log.new_data,
      description: buildAuditDescription(log.action, log.table_name),
    }
  })
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
   await prisma.audit_logs.create({
     data: {
       org_id: orgId,
       user_id: userId,
       action,
       table_name: table,
       record_id: recordId,
       old_data: oldData as any,
       new_data: newData as any,
       user_agent: 'NIZAM ERP System',
     },
   })
}

export async function resetOrganizationData(orgId: string, options: ResetOrganizationOptions = {}) {
  const mode = options.mode || 'transactions'

  try {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      return { success: false, error: 'Tidak terautentikasi.' }
    }

    const trimmedOrgId = String(orgId || '').trim()
    if (!trimmedOrgId) {
      return { success: false, error: 'Organisasi tidak valid.' }
    }

    const [membership, organization] = await Promise.all([
      getMembership(userId, trimmedOrgId),
      prisma.organizations.findUnique({
        where: { id: trimmedOrgId },
        select: { name: true },
      }),
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

    const transactionReset = await clearTablesByOrg(trimmedOrgId, TRANSACTION_RESET_TABLES)
    if (!transactionReset.success) {
      return transactionReset
    }

    if (mode === 'all_data') {
      const masterReset = await clearTablesByOrg(trimmedOrgId, FULL_RESET_MASTER_TABLES)
      if (!masterReset.success) {
        return masterReset
      }
    }

    await prisma.audit_logs.create({
      data: {
        org_id: trimmedOrgId,
        user_id: userId,
        action: 'DELETE',
        table_name: 'SYSTEM_RESET',
        record_id: trimmedOrgId,
        new_data: {
          mode,
          status: 'SUCCESS',
          preserved: ['organizations', 'org_members', 'roles', 'accounts', 'saas_*'],
        } as any,
        user_agent: 'NIZAM ERP System',
      },
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
