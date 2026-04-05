'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type BranchResult =
  | { branchId: string | null }
  | { error: string }

const serviceOrderSelect = {
  id: true,
  org_id: true,
  contact_id: true,
  job_number: true,
  description: true,
  status: true,
  start_date: true,
  end_date: true,
  assigned_to: true,
  estimated_cost: true,
  actual_cost: true,
  notes: true,
  created_at: true,
  updated_at: true,
  branch_id: true,
  branches: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  contacts: {
    select: {
      id: true,
      name: true,
    },
  },
} as const

function normalizeDateOnly(value: Date | null) {
  return value ? value.toISOString().split('T')[0] : null
}

function normalizeServiceOrder(order: {
  id: string
  org_id: string
  contact_id: string
  job_number: string
  description: string
  status: string
  start_date: Date | null
  end_date: Date | null
  assigned_to: string | null
  estimated_cost: unknown
  actual_cost: unknown
  notes: string | null
  created_at: Date
  updated_at: Date
  branch_id: string
  branches: { id: string; name: string; code: string } | null
  contacts: { id: string; name: string } | null
}) {
  return {
    id: order.id,
    org_id: order.org_id,
    contact_id: order.contact_id,
    job_number: order.job_number,
    description: order.description,
    status: order.status,
    start_date: normalizeDateOnly(order.start_date),
    end_date: normalizeDateOnly(order.end_date),
    assigned_to: order.assigned_to,
    estimated_cost: Number(order.estimated_cost || 0),
    actual_cost: Number(order.actual_cost || 0),
    notes: order.notes,
    created_at: order.created_at.toISOString(),
    updated_at: order.updated_at.toISOString(),
    branch_id: order.branch_id,
    branch: order.branches,
    contact: order.contacts,
  }
}

async function resolveServiceBranchSelection(orgId: string, branchId?: string | null): Promise<BranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function requireCreateBranchId(orgId: string): Promise<{ branchId: string } | { error: string }> {
  const branchSelection = await resolveServiceBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk membuat job order.' }
  }

  return { branchId: branchSelection.branchId as string }
}

export async function getServiceOrders(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveServiceBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  const data = await prisma.service_orders.findMany({
    where: {
      org_id: orgId,
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    select: serviceOrderSelect,
    orderBy: {
      created_at: 'desc',
    },
  })

  return data.map(normalizeServiceOrder)
}

export async function createServiceOrder(orgId: string, formData: FormData) {
  const activeBranch = await requireCreateBranchId(orgId)
  if ('error' in activeBranch) return { error: activeBranch.error }

  const contactId = String(formData.get('contact_id') || '').trim()
  const jobNumber = String(formData.get('job_number') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const startDateRaw = String(formData.get('start_date') || '').trim()
  const notes = String(formData.get('notes') || '').trim()
  const estimatedCost = Number(formData.get('estimated_cost') || 0)

  if (!contactId || !jobNumber || !description || !startDateRaw) {
    return { error: 'Data job order belum lengkap.' }
  }

  try {
    await prisma.service_orders.create({
      data: {
        org_id: orgId,
        branch_id: activeBranch.branchId,
        contact_id: contactId,
        job_number: jobNumber,
        description,
        status: 'PENDING',
        start_date: new Date(`${startDateRaw}T00:00:00.000Z`),
        notes: notes || null,
        estimated_cost: Number.isFinite(estimatedCost) ? estimatedCost : 0,
      },
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat job order.' }
  }

  revalidatePath('/services')
  return { success: true }
}

export async function updateServiceStatus(orgId: string, orderId: string, status: string) {
  const normalizedStatus = String(status || '').trim().toUpperCase()

  if (!['PENDING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].includes(normalizedStatus)) {
    return { error: 'Status job order tidak valid.' }
  }

  const order = await prisma.service_orders.findFirst({
    where: {
      id: orderId,
      org_id: orgId,
    },
    select: {
      id: true,
      branch_id: true,
    },
  })

  if (!order?.branch_id) return { error: 'Job order tidak ditemukan.' }

  const branchSelection = await resolveServiceBranchSelection(orgId, order.branch_id)
  if ('error' in branchSelection) return { error: branchSelection.error }

  await prisma.service_orders.update({
    where: { id: orderId },
    data: { status: normalizedStatus as any },
  })

  revalidatePath('/services')
  return { success: true }
}
