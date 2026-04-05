'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

const LEAVE_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
const LEAVE_APPROVAL_SOURCE = 'LEAVE_REQUEST'

async function resolveLeaveBranchSelection(orgId: string, branchId?: string | null): Promise<BranchSelectionResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function ensureLeaveBranchAccess(orgId: string, branchId: string | null, notFoundMessage: string) {
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedBranchId) {
    return { error: notFoundMessage }
  }

  const branchSelection = await resolveLeaveBranchSelection(orgId, trimmedBranchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error }
  }

  return { branchId: trimmedBranchId }
}

function normalizeDateOnly(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return null
  const parts = trimmedValue.split('-').map((part) => Number(part))
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null

  const [year, month, day] = parts
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return trimmedValue
}

function calculateDaysTaken(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
}

async function createLeaveApprovalRequest(db: any, input: {
  orgId: string
  branchId: string
  leaveId: string
  requesterId: string
  reason: string
}) {
  await db.approval_requests.create({
    data: {
      org_id: input.orgId,
      branch_id: input.branchId,
      requester_id: input.requesterId,
      source_type: LEAVE_APPROVAL_SOURCE,
      source_id: input.leaveId,
      status: 'PENDING',
      reason: input.reason,
      requested_at: new Date(),
    },
  })
}

async function syncLeaveApprovalStatus(db: any, input: {
  orgId: string
  branchId: string
  leaveId: string
  status: 'APPROVED' | 'REJECTED' | 'CANCELLED'
  approverId: string
  notes?: string | null
}) {
  await db.approval_requests.updateMany({
    where: {
      org_id: input.orgId,
      source_type: LEAVE_APPROVAL_SOURCE,
      source_id: input.leaveId,
      branch_id: input.branchId,
    },
    data: {
      status: input.status,
      approver_id: input.approverId,
      decided_at: new Date(),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updated_at: new Date(),
    },
  })
}

export async function getLeaveRequests(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveLeaveBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  const requests = await prisma.leave_requests.findMany({
    where: {
      org_id: orgId,
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    include: {
      branches: { select: { id: true, name: true, code: true } },
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
    orderBy: { created_at: 'desc' },
  })

  return requests.map((request) => ({
    ...request,
    branch: request.branches,
    employee: request.employees,
    branches: undefined,
    employees: undefined,
  }))
}

export async function createLeaveRequest(orgId: string, formData: FormData) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const employeeId = String(formData.get('employee_id') || '').trim()
  const leaveType = String(formData.get('leave_type') || '').trim()
  const startDate = normalizeDateOnly(String(formData.get('start_date') || ''))
  const endDate = normalizeDateOnly(String(formData.get('end_date') || ''))
  const reason = String(formData.get('reason') || '').trim()

  if (!employeeId) return { error: 'Karyawan wajib dipilih.' }
  if (!leaveType) return { error: 'Jenis cuti wajib diisi.' }
  if (!startDate || !endDate) return { error: 'Periode cuti tidak valid.' }
  if (new Date(`${endDate}T00:00:00.000Z`).getTime() < new Date(`${startDate}T00:00:00.000Z`).getTime()) {
    return { error: 'Tanggal selesai cuti tidak boleh lebih awal dari tanggal mulai.' }
  }
  if (!reason) return { error: 'Alasan cuti wajib diisi.' }

  const employee = await prisma.employees.findFirst({
    where: { id: employeeId, org_id: orgId },
    select: { id: true, branch_id: true },
  })

  const accessibleEmployee = await ensureLeaveBranchAccess(
    orgId,
    employee?.branch_id ?? null,
    'Data karyawan tidak ditemukan.'
  )
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  try {
    await prisma.$transaction(async (tx) => {
      const leaveRequest = await tx.leave_requests.create({
        data: {
          org_id: orgId,
          branch_id: accessibleEmployee.branchId,
          employee_id: employeeId,
          leave_type: leaveType,
          start_date: new Date(`${startDate}T00:00:00.000Z`),
          end_date: new Date(`${endDate}T00:00:00.000Z`),
          days_taken: calculateDaysTaken(startDate, endDate),
          reason,
          status: 'PENDING',
        },
        select: { id: true },
      })

      await createLeaveApprovalRequest(tx, {
        orgId,
        branchId: accessibleEmployee.branchId,
        leaveId: leaveRequest.id,
        requesterId: userId,
        reason: `Leave Request: ${leaveType} (${startDate} s/d ${endDate})`,
      })
    })
  } catch (error) {
    console.error('createLeaveRequest Error:', error)
    return { error: 'Gagal membuat pengajuan cuti.' }
  }

  revalidatePath('/hris')
  revalidatePath('/accounting/approvals')
  return { success: true }
}

async function updateLeaveStatus(leaveId: string, nextStatus: 'APPROVED' | 'REJECTED' | 'CANCELLED') {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const leaveRequest = await prisma.leave_requests.findFirst({
    where: { id: leaveId },
    select: { id: true, org_id: true, branch_id: true, status: true },
  })

  if (!leaveRequest?.id) return { error: 'Pengajuan cuti tidak ditemukan.' }
  if (!LEAVE_STATUSES.has(String(leaveRequest.status || '').toUpperCase())) {
    return { error: 'Status cuti tidak valid.' }
  }

  const accessibleLeave = await ensureLeaveBranchAccess(
    leaveRequest.org_id,
    leaveRequest.branch_id,
    'Pengajuan cuti tidak ditemukan.'
  )
  if ('error' in accessibleLeave) return { error: accessibleLeave.error }

  if (String(leaveRequest.status).toUpperCase() !== 'PENDING' && nextStatus !== 'CANCELLED') {
    return { error: 'Pengajuan cuti ini sudah diproses.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.leave_requests.updateMany({
        where: {
          id: leaveId,
          org_id: leaveRequest.org_id,
          branch_id: accessibleLeave.branchId,
        },
        data: {
          status: nextStatus as any,
          approved_by: userId,
          approved_at: new Date(),
          updated_at: new Date(),
        },
      })

      if (updated.count === 0) {
        throw new Error('Leave request not found within branch scope.')
      }

      await syncLeaveApprovalStatus(tx, {
        orgId: leaveRequest.org_id,
        branchId: accessibleLeave.branchId,
        leaveId,
        status: nextStatus,
        approverId: userId,
      })
    })
  } catch (error) {
    console.error('updateLeaveStatus Error:', error)
    return { error: 'Gagal memperbarui status cuti.' }
  }

  revalidatePath('/hris')
  revalidatePath('/accounting/approvals')
  return { success: true }
}

export async function approveLeaveRequest(leaveId: string) {
  return updateLeaveStatus(leaveId, 'APPROVED')
}

export async function rejectLeaveRequest(leaveId: string) {
  return updateLeaveStatus(leaveId, 'REJECTED')
}
