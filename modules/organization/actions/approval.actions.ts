'use server'

import { auth } from '@/auth'
import {
  getMembership,
  type MembershipContext,
} from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type ApprovalRow = {
  id: string
  org_id: string
  requester_id: string
  approver_id: string | null
  source_type: string
  source_id: string
  status: string
  reason: string | null
  notes: string | null
  requested_at: Date
  decided_at: Date | null
  updated_at: Date
  branch_id: string | null
}

type ApprovalAccess =
  | {
      userId: string
      orgId: string
      branchId: string | null
      membership: MembershipContext
    }
  | {
      error: string
      userId?: undefined
      orgId?: undefined
      branchId?: undefined
      membership?: undefined
    }

type ApprovalActor = {
  id: string
  email: string | null
  name: string | null
}

type PurchaseDetailRecord = {
  id: string
  org_id: string
  purchase_number: string
  purchase_date: Date
  vendor_id: string
  total_amount: unknown
  tax_amount: unknown
  discount_amount: unknown
  grand_total: unknown
  status: string
  payment_status: string
  due_date: Date | null
  notes: string | null
  created_by: string | null
  created_at: Date
  updated_at: Date
  shipping_amount: unknown
  shariah_mode: string | null
  branch_id: string | null
  purchase_items: Array<{
    id: string
    org_id: string
    purchase_id: string
    product_id: string | null
    description: string
    quantity: unknown
    unit_price: unknown
    discount_amount: unknown
    tax_amount: unknown
    total_amount: unknown
    created_at: Date | null
    updated_at: Date | null
    products: {
      name: string
      unit: string
    } | null
  }>
}

type SalesDetailRecord = {
  id: string
  org_id: string
  sale_number: string
  sale_date: Date
  customer_id: string | null
  total_amount: unknown
  tax_amount: unknown
  discount_amount: unknown
  grand_total: unknown
  status: string
  payment_status: string
  due_date: Date | null
  notes: string | null
  created_by: string | null
  created_at: Date
  updated_at: Date
  shariah_mode: string | null
  payment_term: string | null
  branch_id: string | null
  contacts: {
    name: string
    phone: string | null
    email: string | null
  } | null
  sales_items: Array<{
    id: string
    org_id: string
    sale_id: string
    product_id: string | null
    description: string
    quantity: unknown
    unit_price: unknown
    discount_amount: unknown
    tax_amount: unknown
    total_amount: unknown
    created_at: Date | null
    updated_at: Date | null
    branch_id: string | null
    products: {
      name: string
      sku: string | null
      unit: string
    } | null
  }>
}

type ReimbursementDetailRecord = {
  id: string
  org_id: string
  claim_number: string
  user_id: string
  description: string
  total_amount: unknown
  status: string
  notes: string | null
  journal_id: string | null
  created_at: Date
  updated_at: Date
  branch_id: string | null
  reimbursement_items: Array<{
    id: string
    reimbursement_id: string
    expense_date: Date
    category_account_id: string
    description: string
    amount: unknown
    receipt_url: string | null
    created_at: Date
    accounts: {
      code: string
      name: string
    } | null
  }>
}

type LeaveDetailRecord = {
  id: string
  org_id: string
  employee_id: string
  leave_type: string
  start_date: Date
  end_date: Date
  days_taken: unknown
  reason: string
  status: string
  approved_by: string | null
  approved_at: Date | null
  created_at: Date
  updated_at: Date
  branch_id: string
  branches: {
    id: string
    name: string
    code: string
  } | null
  employees: {
    id: string
    first_name: string
    last_name: string | null
    nik: string
    job_title: string
    branch_id: string | null
  } | null
}

function withBranchScope<const T extends Record<string, unknown>>(
  where: T,
  branchId: string | null
) {
  if (!branchId) return where
  return {
    ...where,
    branch_id: branchId,
  }
}

function normalizeDateTime(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function normalizeDateOnly(value: Date | null | undefined) {
  if (!value) return null

  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)

  if (
    value
    && typeof value === 'object'
    && 'toNumber' in value
    && typeof value.toNumber === 'function'
  ) {
    return value.toNumber()
  }

  const normalized = Number(value ?? 0)
  return Number.isFinite(normalized) ? normalized : 0
}

function canManageApprovals(membership: MembershipContext) {
  if (membership.isOwnerOrAdmin) return true
  if (membership.role === 'manager') return true

  const normalizedPermissions = membership.permissions
    .filter((permission): permission is string => typeof permission === 'string')
    .map((permission) => permission.toLowerCase())

  return normalizedPermissions.some((permission) => permission.includes('approval'))
}

async function resolveApprovalAccess(
  orgId: string,
  branchId?: string | null
): Promise<ApprovalAccess> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { error: 'Unauthorized' }
  }

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) {
    return { error: 'Organisasi tidak valid.' }
  }

  const membership = await getMembership(userId, trimmedOrgId)
  if (!membership) {
    return { error: 'Akses organisasi ditolak.' }
  }

  const branchSelection = await resolveAccessibleBranchSelection(trimmedOrgId, branchId)
  if ('error' in branchSelection && branchSelection.error) {
    return { error: branchSelection.error }
  }

  return {
    userId,
    orgId: trimmedOrgId,
    branchId: branchSelection.branchId ?? null,
    membership,
  }
}

async function resolveApprovalManagerAccess(
  orgId: string,
  branchId?: string | null
) {
  const access = await resolveApprovalAccess(orgId, branchId)
  if ('error' in access) return access
  if (!canManageApprovals(access.membership)) {
    return { error: 'Akses approval ditolak.' as const }
  }
  return access
}

async function loadApprovalActors(rows: ApprovalRow[]) {
  const actorIds = Array.from(
    new Set(
      rows.flatMap((row) => [
        String(row.requester_id || '').trim(),
        String(row.approver_id || '').trim(),
      ])
      .filter(Boolean)
    )
  )

  if (actorIds.length === 0) {
    return new Map<string, ApprovalActor>()
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: actorIds,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })

  return new Map(
    users.map((user) => [
      user.id,
      {
        id: user.id,
        email: user.email ?? null,
        name: user.name ?? null,
      },
    ])
  )
}

function serializeApprovalRows(
  rows: ApprovalRow[],
  actorsById: Map<string, ApprovalActor>
) {
  return rows.map((row) => ({
    id: row.id,
    org_id: row.org_id,
    requester_id: row.requester_id,
    approver_id: row.approver_id,
    source_type: row.source_type,
    source_id: row.source_id,
    status: row.status,
    reason: row.reason,
    notes: row.notes,
    requested_at: row.requested_at.toISOString(),
    decided_at: normalizeDateTime(row.decided_at),
    updated_at: row.updated_at.toISOString(),
    branch_id: row.branch_id,
    requester: actorsById.get(row.requester_id) ?? null,
    approver: row.approver_id ? (actorsById.get(row.approver_id) ?? null) : null,
  }))
}

function serializePurchaseDetail(data: PurchaseDetailRecord | null) {
  if (!data) return null

  return {
    id: data.id,
    org_id: data.org_id,
    purchase_number: data.purchase_number,
    purchase_date: normalizeDateOnly(data.purchase_date),
    vendor_id: data.vendor_id,
    total_amount: toNumber(data.total_amount),
    tax_amount: toNumber(data.tax_amount),
    discount_amount: toNumber(data.discount_amount),
    grand_total: toNumber(data.grand_total),
    status: data.status,
    payment_status: data.payment_status,
    due_date: normalizeDateOnly(data.due_date),
    notes: data.notes,
    created_by: data.created_by,
    created_at: normalizeDateTime(data.created_at),
    updated_at: normalizeDateTime(data.updated_at),
    shipping_amount: toNumber(data.shipping_amount),
    insurance_amount: 0,
    shariah_mode: data.shariah_mode,
    branch_id: data.branch_id,
    purchase_items: data.purchase_items.map((item) => ({
      id: item.id,
      org_id: item.org_id,
      purchase_id: item.purchase_id,
      product_id: item.product_id,
      description: item.description,
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
      discount_amount: toNumber(item.discount_amount),
      tax_amount: toNumber(item.tax_amount),
      total_amount: toNumber(item.total_amount),
      created_at: normalizeDateTime(item.created_at ?? null),
      updated_at: normalizeDateTime(item.updated_at ?? null),
      unit: item.products?.unit ?? null,
      products: item.products
        ? {
            name: item.products.name,
            unit: item.products.unit,
          }
        : null,
    })),
  }
}

function serializeSalesDetail(data: SalesDetailRecord | null) {
  if (!data) return null

  return {
    id: data.id,
    org_id: data.org_id,
    sale_number: data.sale_number,
    sale_date: normalizeDateOnly(data.sale_date),
    customer_id: data.customer_id,
    total_amount: toNumber(data.total_amount),
    tax_amount: toNumber(data.tax_amount),
    discount_amount: toNumber(data.discount_amount),
    grand_total: toNumber(data.grand_total),
    status: data.status,
    payment_status: data.payment_status,
    due_date: normalizeDateOnly(data.due_date),
    notes: data.notes,
    created_by: data.created_by,
    created_at: normalizeDateTime(data.created_at),
    updated_at: normalizeDateTime(data.updated_at),
    shariah_mode: data.shariah_mode,
    payment_term: data.payment_term,
    branch_id: data.branch_id,
    contacts: data.contacts
      ? {
          name: data.contacts.name,
          phone: data.contacts.phone,
          email: data.contacts.email,
        }
      : null,
    sales_items: data.sales_items.map((item) => ({
      id: item.id,
      org_id: item.org_id,
      sale_id: item.sale_id,
      product_id: item.product_id,
      description: item.description,
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
      discount_amount: toNumber(item.discount_amount),
      tax_amount: toNumber(item.tax_amount),
      total_amount: toNumber(item.total_amount),
      created_at: normalizeDateTime(item.created_at ?? null),
      updated_at: normalizeDateTime(item.updated_at ?? null),
      branch_id: item.branch_id,
      products: item.products
        ? {
            name: item.products.name,
            sku: item.products.sku,
            unit: item.products.unit,
          }
        : null,
    })),
  }
}

function serializeReimbursementDetail(data: ReimbursementDetailRecord | null) {
  if (!data) return null

  const items = data.reimbursement_items.map((item) => ({
    id: item.id,
    reimbursement_id: item.reimbursement_id,
    expense_date: normalizeDateOnly(item.expense_date),
    category_account_id: item.category_account_id,
    description: item.description,
    amount: toNumber(item.amount),
    receipt_url: item.receipt_url,
    created_at: normalizeDateTime(item.created_at),
    account: item.accounts
      ? {
          code: item.accounts.code,
          name: item.accounts.name,
        }
      : null,
  }))

  return {
    id: data.id,
    org_id: data.org_id,
    claim_number: data.claim_number,
    user_id: data.user_id,
    description: data.description,
    total_amount: toNumber(data.total_amount),
    status: data.status,
    notes: data.notes,
    journal_id: data.journal_id,
    created_at: normalizeDateTime(data.created_at),
    updated_at: normalizeDateTime(data.updated_at),
    branch_id: data.branch_id,
    items,
    reimbursement_items: items,
  }
}

function serializeLeaveDetail(data: LeaveDetailRecord | null) {
  if (!data) return null

  return {
    id: data.id,
    org_id: data.org_id,
    employee_id: data.employee_id,
    leave_type: data.leave_type,
    start_date: normalizeDateOnly(data.start_date),
    end_date: normalizeDateOnly(data.end_date),
    days_taken: toNumber(data.days_taken),
    reason: data.reason,
    status: data.status,
    approved_by: data.approved_by,
    approved_at: normalizeDateTime(data.approved_at),
    created_at: normalizeDateTime(data.created_at),
    updated_at: normalizeDateTime(data.updated_at),
    branch_id: data.branch_id,
    branch: data.branches
      ? {
          id: data.branches.id,
          name: data.branches.name,
          code: data.branches.code,
        }
      : null,
    employee: data.employees
      ? {
          id: data.employees.id,
          first_name: data.employees.first_name,
          last_name: data.employees.last_name,
          nik: data.employees.nik,
          job_title: data.employees.job_title,
          branch_id: data.employees.branch_id,
        }
      : null,
  }
}

export async function getPendingApprovals(orgId: string, branchId?: string | null) {
  try {
    const access = await resolveApprovalManagerAccess(orgId, branchId)
    if ('error' in access) return []

    const rows = await prisma.approval_requests.findMany({
      where: withBranchScope(
        {
          org_id: access.orgId,
          status: 'PENDING',
        },
        access.branchId
      ),
      orderBy: {
        requested_at: 'desc',
      },
      select: {
        id: true,
        org_id: true,
        requester_id: true,
        approver_id: true,
        source_type: true,
        source_id: true,
        status: true,
        reason: true,
        notes: true,
        requested_at: true,
        decided_at: true,
        updated_at: true,
        branch_id: true,
      },
    })

    const actorsById = await loadApprovalActors(rows)
    return serializeApprovalRows(rows, actorsById)
  } catch (error) {
    console.error('Error fetching approvals:', error)
    return []
  }
}

export async function getApprovalHistory(orgId: string, branchId?: string | null) {
  try {
    const access = await resolveApprovalManagerAccess(orgId, branchId)
    if ('error' in access) return []

    const rows = await prisma.approval_requests.findMany({
      where: withBranchScope(
        {
          org_id: access.orgId,
          NOT: {
            status: 'PENDING',
          },
        },
        access.branchId
      ),
      orderBy: [
        {
          decided_at: 'desc',
        },
        {
          updated_at: 'desc',
        },
      ],
      take: 50,
      select: {
        id: true,
        org_id: true,
        requester_id: true,
        approver_id: true,
        source_type: true,
        source_id: true,
        status: true,
        reason: true,
        notes: true,
        requested_at: true,
        decided_at: true,
        updated_at: true,
        branch_id: true,
      },
    })

    const actorsById = await loadApprovalActors(rows)
    return serializeApprovalRows(rows, actorsById)
  } catch (error) {
    console.error('Error fetching approval history:', error)
    return []
  }
}

export async function getApprovalDetail(
  orgId: string,
  sourceId: string,
  sourceType: string,
  branchId?: string | null
) {
  try {
    const access = await resolveApprovalManagerAccess(orgId, branchId)
    if ('error' in access) {
      return { data: null, logs: [], error: access.error }
    }

    let data: Record<string, unknown> | null = null

    if (sourceType === 'PURCHASE_ORDER') {
      const purchase = await prisma.purchases.findFirst({
        where: withBranchScope(
          {
            id: sourceId,
            org_id: access.orgId,
          },
          access.branchId
        ),
        include: {
          purchase_items: {
            orderBy: {
              created_at: 'asc',
            },
            include: {
              products: {
                select: {
                  name: true,
                  unit: true,
                },
              },
            },
          },
        },
      })
      data = serializePurchaseDetail(purchase)
    } else if (sourceType === 'SALES_ORDER') {
      const sale = await prisma.sales.findFirst({
        where: withBranchScope(
          {
            id: sourceId,
            org_id: access.orgId,
          },
          access.branchId
        ),
        include: {
          contacts: {
            select: {
              name: true,
              phone: true,
              email: true,
            },
          },
          sales_items: {
            orderBy: {
              created_at: 'asc',
            },
            include: {
              products: {
                select: {
                  name: true,
                  sku: true,
                  unit: true,
                },
              },
            },
          },
        },
      })
      data = serializeSalesDetail(sale)
    } else if (sourceType === 'REIMBURSEMENT') {
      const reimbursement = await prisma.reimbursements.findFirst({
        where: withBranchScope(
          {
            id: sourceId,
            org_id: access.orgId,
          },
          access.branchId
        ),
        include: {
          reimbursement_items: {
            orderBy: {
              created_at: 'asc',
            },
            include: {
              accounts: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      })
      data = serializeReimbursementDetail(reimbursement)
    } else if (sourceType === 'LEAVE_REQUEST') {
      const leaveRequest = await prisma.leave_requests.findFirst({
        where: withBranchScope(
          {
            id: sourceId,
            org_id: access.orgId,
          },
          access.branchId
        ),
        include: {
          branches: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          employees: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              nik: true,
              job_title: true,
              branch_id: true,
            },
          },
        },
      })
      data = serializeLeaveDetail(leaveRequest)
    } else {
      return { data: null, logs: [], error: 'Jenis approval tidak didukung.' }
    }

    if (!data) {
      return { data: null, logs: [], error: 'Data detail tidak ditemukan.' }
    }

    const logs = await prisma.approval_requests.findMany({
      where: withBranchScope(
        {
          org_id: access.orgId,
          source_id: sourceId,
          source_type: sourceType,
        },
        access.branchId
      ),
      orderBy: {
        requested_at: 'asc',
      },
      select: {
        id: true,
        org_id: true,
        requester_id: true,
        approver_id: true,
        source_type: true,
        source_id: true,
        status: true,
        reason: true,
        notes: true,
        requested_at: true,
        decided_at: true,
        updated_at: true,
        branch_id: true,
      },
    })

    const actorsById = await loadApprovalActors(logs)

    return {
      data,
      logs: serializeApprovalRows(logs, actorsById),
      error: null,
    }
  } catch (error: any) {
    console.error('Error fetching approval detail:', error)
    return {
      data: null,
      logs: [],
      error: error?.message || 'Gagal memuat detail approval.',
    }
  }
}

export async function getPendingApprovalsCount(orgId: string, branchId?: string | null) {
  try {
    const access = await resolveApprovalManagerAccess(orgId, branchId)
    if ('error' in access) return 0

    return prisma.approval_requests.count({
      where: withBranchScope(
        {
          org_id: access.orgId,
          status: 'PENDING',
        },
        access.branchId
      ),
    })
  } catch (error) {
    console.error('Error fetching approval counts:', error)
    return 0
  }
}

export async function decideApproval(
  id: string,
  orgId: string,
  status: 'APPROVED' | 'REJECTED',
  notes?: string,
  branchId?: string | null
) {
  try {
    const access = await resolveApprovalManagerAccess(orgId, branchId)
    if ('error' in access) return { error: access.error }

    const request = await prisma.approval_requests.findFirst({
      where: withBranchScope(
        {
          id,
          org_id: access.orgId,
        },
        access.branchId
      ),
      select: {
        id: true,
        source_type: true,
        source_id: true,
        branch_id: true,
      },
    })

    if (!request) {
      return { error: 'Request tidak ditemukan' }
    }

    const decidedAt = new Date()

    await prisma.approval_requests.update({
      where: {
        id: request.id,
      },
      data: {
        status,
        notes: notes || null,
        approver_id: access.userId,
        decided_at: decidedAt,
        updated_at: decidedAt,
      },
    })

    const sourceWhere = withBranchScope(
      {
        id: request.source_id,
        org_id: access.orgId,
      },
      request.branch_id ?? null
    )

    if (request.source_type === 'PURCHASE_ORDER') {
      await prisma.purchases.updateMany({
        where: sourceWhere,
        data: {
          status: status === 'APPROVED' ? 'ORDERED' : 'VOIDED',
          updated_at: decidedAt,
        },
      })
    }

    if (request.source_type === 'SALES_ORDER') {
      await prisma.sales.updateMany({
        where: sourceWhere,
        data: {
          status: status === 'APPROVED' ? 'ORDERED' : 'VOIDED',
          updated_at: decidedAt,
        },
      })
    }

    if (request.source_type === 'REIMBURSEMENT') {
      await prisma.reimbursements.updateMany({
        where: sourceWhere,
        data: {
          status,
          updated_at: decidedAt,
        },
      })
    }

    if (request.source_type === 'LEAVE_REQUEST') {
      await prisma.leave_requests.updateMany({
        where: sourceWhere,
        data: {
          status,
          approved_by: access.userId,
          approved_at: decidedAt,
          updated_at: decidedAt,
        },
      })
    }

    revalidatePath('/', 'layout')
    revalidatePath('/accounting/approvals')
    return { success: true }
  } catch (error: any) {
    console.error('Error deciding approval:', error)
    return { error: error?.message || 'Gagal memproses approval.' }
  }
}

export async function getApprovalForSource(
  orgId: string,
  sourceId: string,
  sourceType: string,
  branchId?: string | null
) {
  try {
    const access = await resolveApprovalAccess(orgId, branchId)
    if ('error' in access) return null

    const data = await prisma.approval_requests.findFirst({
      where: withBranchScope(
        {
          source_id: sourceId,
          source_type: sourceType,
          org_id: access.orgId,
        },
        access.branchId
      ),
      orderBy: [
        {
          requested_at: 'desc',
        },
        {
          updated_at: 'desc',
        },
      ],
      select: {
        status: true,
        approver_id: true,
        decided_at: true,
      },
    })

    if (!data) return null

    return {
      status: data.status,
      approver_id: data.approver_id,
      decided_at: normalizeDateTime(data.decided_at),
    }
  } catch (error) {
    console.error('Error fetching approval source state:', error)
    return null
  }
}
