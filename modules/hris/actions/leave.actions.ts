'use server'

import { createClient } from '@/lib/supabase/server'
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
  const { error } = await db
    .from('approval_requests')
    .insert({
      org_id: input.orgId,
      branch_id: input.branchId,
      requester_id: input.requesterId,
      source_type: LEAVE_APPROVAL_SOURCE,
      source_id: input.leaveId,
      status: 'PENDING',
      reason: input.reason,
      requested_at: new Date().toISOString(),
    })

  return error
}

async function syncLeaveApprovalStatus(db: any, input: {
  orgId: string
  branchId: string
  leaveId: string
  status: 'APPROVED' | 'REJECTED' | 'CANCELLED'
  approverId: string
  notes?: string | null
}) {
  const updatePayload: Record<string, string | null> = {
    status: input.status,
    approver_id: input.approverId,
    decided_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (input.notes !== undefined) {
    updatePayload.notes = input.notes
  }

  return db
    .from('approval_requests')
    .update(updatePayload)
    .eq('org_id', input.orgId)
    .eq('source_type', LEAVE_APPROVAL_SOURCE)
    .eq('source_id', input.leaveId)
    .eq('branch_id', input.branchId)
}

export async function getLeaveRequests(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const db = supabase as any
  const branchSelection = await resolveLeaveBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = db
    .from('leave_requests')
    .select(`
      *,
      branch:branches(id, name, code),
      employee:employee_id(id, first_name, last_name, nik, job_title, branch_id)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query

  if (error) return []
  return data
}

export async function createLeaveRequest(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

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

  const { data: employee, error: employeeError } = await db
    .from('employees')
    .select('id, branch_id')
    .eq('id', employeeId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (employeeError) return { error: employeeError.message }

  const accessibleEmployee = await ensureLeaveBranchAccess(
    orgId,
    employee?.branch_id ?? null,
    'Data karyawan tidak ditemukan.'
  )
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  const { data: leaveRequest, error } = await db
    .from('leave_requests')
    .insert({
      org_id: orgId,
      branch_id: accessibleEmployee.branchId,
      employee_id: employeeId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      days_taken: calculateDaysTaken(startDate, endDate),
      reason,
      status: 'PENDING',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const approvalError = await createLeaveApprovalRequest(db, {
    orgId,
    branchId: accessibleEmployee.branchId,
    leaveId: leaveRequest.id,
    requesterId: user.id,
    reason: `Leave Request: ${leaveType} (${startDate} s/d ${endDate})`,
  })

  if (approvalError) {
    await db
      .from('leave_requests')
      .delete()
      .eq('id', leaveRequest.id)
      .eq('org_id', orgId)
      .eq('branch_id', accessibleEmployee.branchId)

    return { error: approvalError.message }
  }

  revalidatePath('/hris')
  revalidatePath('/accounting/approvals')
  return { success: true }
}

async function updateLeaveStatus(leaveId: string, nextStatus: 'APPROVED' | 'REJECTED' | 'CANCELLED') {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { data: leaveRequest, error: leaveRequestError } = await db
    .from('leave_requests')
    .select('id, org_id, branch_id, status')
    .eq('id', leaveId)
    .maybeSingle()

  if (leaveRequestError) return { error: leaveRequestError.message }
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

  const { error } = await db
    .from('leave_requests')
    .update({
      status: nextStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', leaveId)
    .eq('org_id', leaveRequest.org_id)
    .eq('branch_id', accessibleLeave.branchId)

  if (error) return { error: error.message }

  const { error: approvalError } = await syncLeaveApprovalStatus(db, {
    orgId: leaveRequest.org_id,
    branchId: accessibleLeave.branchId,
    leaveId,
    status: nextStatus,
    approverId: user.id,
  })

  if (approvalError) return { error: approvalError.message }

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
