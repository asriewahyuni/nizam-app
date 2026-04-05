'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

type SelfEmployee = {
  id: string
  branch_id: string | null
  first_name: string
  last_name: string | null
  job_title: string | null
  nik: string
}

const LEAVE_APPROVAL_SOURCE = 'LEAVE_REQUEST'

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

async function getAuthenticatedEmployee(orgId: string): Promise<{ employee: SelfEmployee } | { error: string }> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const employee = await prisma.employees.findFirst({
    where: { org_id: orgId, user_id: userId },
    select: {
      id: true,
      branch_id: true,
      first_name: true,
      last_name: true,
      job_title: true,
      nik: true,
    },
  })

  if (!employee?.id) return { error: 'Data karyawan Anda tidak ditemukan.' }
  if (!employee.branch_id) return { error: 'Anda belum terhubung ke unit aktif.' }

  return { employee: employee as any }
}

export async function getMyAttendanceRecords(orgId: string, startDate?: string | null) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return []

  const normalizedStartDate = normalizeDateOnly(String(startDate || '').trim())
  const defaultStartDate = new Date()
  defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 14)
  const fallbackStartDate = defaultStartDate.toISOString().split('T')[0]

  const records = await prisma.attendance.findMany({
    where: {
      org_id: orgId,
      employee_id: selfEmployee.employee.id,
      record_date: {
        gte: new Date(`${(normalizedStartDate || fallbackStartDate) as string}T00:00:00.000Z`),
      },
    },
    include: { branches: { select: { id: true, name: true, code: true } } },
    orderBy: [{ record_date: 'desc' }, { created_at: 'desc' }],
  })

  return records.map((record) => ({
    ...record,
    branch: record.branches,
    branches: undefined,
  }))
}

export async function getMyLeaveRequests(orgId: string) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return []

  const requests = await prisma.leave_requests.findMany({
    where: { org_id: orgId, employee_id: selfEmployee.employee.id },
    include: { branches: { select: { id: true, name: true, code: true } } },
    orderBy: { created_at: 'desc' },
    take: 10,
  })

  return requests.map((request) => ({
    ...request,
    branch: request.branches,
    branches: undefined,
  }))
}

export async function getMyExpenseClaims(orgId: string) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return []

  const claims = await prisma.expense_claims.findMany({
    where: { org_id: orgId, employee_id: selfEmployee.employee.id },
    include: { branches: { select: { id: true, name: true, code: true } } },
    orderBy: { claim_date: 'desc' },
    take: 10,
  })

  return claims.map((claim) => ({
    ...claim,
    branch: claim.branches,
    branches: undefined,
  }))
}

export async function clockMyAttendance(orgId: string, payload: { type: 'IN' | 'OUT'; notes?: string }) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return { error: selfEmployee.error }

  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()
  const notes = String(payload.notes || '').trim()

  const existingRecord = await prisma.attendance.findFirst({
    where: {
      org_id: orgId,
      employee_id: selfEmployee.employee.id,
      record_date: new Date(`${today}T00:00:00.000Z`),
    },
    select: { id: true, status: true, check_out: true, notes: true },
  })

  if (payload.type === 'IN') {
    if (existingRecord?.id) {
      return { error: 'Anda sudah clock-in hari ini.' }
    }

    await prisma.attendance.create({
      data: {
        org_id: orgId,
        branch_id: selfEmployee.employee.branch_id,
        employee_id: selfEmployee.employee.id,
        record_date: new Date(`${today}T00:00:00.000Z`),
        check_in: new Date(now),
        status: 'PRESENT',
        notes: notes || null,
      },
    })
  } else {
    if (!existingRecord?.id) {
      return { error: 'Anda belum clock-in hari ini.' }
    }

    if (existingRecord.check_out) {
      return { error: 'Anda sudah clock-out hari ini.' }
    }

    const mergedNotes = notes
      ? (existingRecord.notes ? `${existingRecord.notes} | ${notes}` : notes)
      : existingRecord.notes

    await prisma.attendance.updateMany({
      where: { id: existingRecord.id, org_id: orgId, employee_id: selfEmployee.employee.id },
      data: {
        check_out: new Date(now),
        notes: mergedNotes || null,
        updated_at: new Date(now),
      },
    })
  }

  revalidatePath('/profil-saya')
  revalidatePath('/hris')
  return { success: true }
}

export async function submitMyLeaveRequest(orgId: string, formData: FormData) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return { error: selfEmployee.error }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const leaveType = String(formData.get('leave_type') || '').trim()
  const startDate = normalizeDateOnly(String(formData.get('start_date') || ''))
  const endDate = normalizeDateOnly(String(formData.get('end_date') || ''))
  const reason = String(formData.get('reason') || '').trim()

  if (!leaveType) return { error: 'Jenis cuti wajib diisi.' }
  if (!startDate || !endDate) return { error: 'Periode cuti tidak valid.' }
  if (new Date(`${endDate}T00:00:00.000Z`).getTime() < new Date(`${startDate}T00:00:00.000Z`).getTime()) {
    return { error: 'Tanggal selesai cuti tidak boleh lebih awal dari tanggal mulai.' }
  }
  if (!reason) return { error: 'Alasan cuti wajib diisi.' }

  try {
    await prisma.$transaction(async (tx) => {
      const leaveRequest = await tx.leave_requests.create({
        data: {
          org_id: orgId,
          branch_id: selfEmployee.employee.branch_id as string,
          employee_id: selfEmployee.employee.id,
          leave_type: leaveType,
          start_date: new Date(`${startDate}T00:00:00.000Z`),
          end_date: new Date(`${endDate}T00:00:00.000Z`),
          days_taken: calculateDaysTaken(startDate, endDate),
          reason,
          status: 'PENDING',
        },
        select: { id: true },
      })

      await tx.approval_requests.create({
        data: {
          org_id: orgId,
          branch_id: selfEmployee.employee.branch_id as string,
          requester_id: userId,
          source_type: LEAVE_APPROVAL_SOURCE,
          source_id: leaveRequest.id,
          status: 'PENDING',
          reason: `Leave Request: ${leaveType} (${startDate} s/d ${endDate})`,
          requested_at: new Date(),
        },
      })
    })
  } catch (error) {
    console.error('submitMyLeaveRequest Error:', error)
    return { error: 'Gagal membuat pengajuan cuti.' }
  }

  revalidatePath('/profil-saya')
  revalidatePath('/hris')
  revalidatePath('/accounting/approvals')
  return { success: true }
}

export async function submitMyExpenseClaim(orgId: string, formData: FormData) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return { error: selfEmployee.error }

  const claimDate = normalizeDateOnly(String(formData.get('claim_date') || ''))
  const category = String(formData.get('category') || '').trim()
  const amount = Number(formData.get('amount') || 0)
  const description = String(formData.get('description') || '').trim()
  const receiptUrlRaw = String(formData.get('receipt_url') || '').trim()
  const receiptUrl = receiptUrlRaw || null

  if (!claimDate) return { error: 'Tanggal klaim tidak valid.' }
  if (!category) return { error: 'Kategori klaim wajib diisi.' }
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Nominal klaim wajib lebih besar dari nol.' }
  if (!description) return { error: 'Deskripsi klaim wajib diisi.' }

  await prisma.expense_claims.create({
    data: {
      org_id: orgId,
      branch_id: selfEmployee.employee.branch_id as string,
      employee_id: selfEmployee.employee.id,
      claim_date: new Date(`${claimDate}T00:00:00.000Z`),
      category,
      amount,
      description,
      receipt_url: receiptUrl,
      status: 'PENDING',
    },
  })

  revalidatePath('/profil-saya')
  revalidatePath('/hris')
  return { success: true }
}

export async function cancelMyLeaveRequest(orgId: string, leaveId: string) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return { error: selfEmployee.error }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const leaveRequest = await prisma.leave_requests.findFirst({
    where: { id: leaveId, org_id: orgId, employee_id: selfEmployee.employee.id },
    select: { id: true, status: true },
  })

  if (!leaveRequest?.id) return { error: 'Pengajuan cuti tidak ditemukan.' }
  if (String(leaveRequest.status || '').toUpperCase() !== 'PENDING') {
    return { error: 'Hanya pengajuan cuti berstatus pending yang bisa dibatalkan.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.leave_requests.updateMany({
        where: { id: leaveId, org_id: orgId, employee_id: selfEmployee.employee.id },
        data: {
          status: 'CANCELLED',
          approved_by: userId,
          approved_at: new Date(),
          updated_at: new Date(),
        },
      })

      await tx.approval_requests.updateMany({
        where: {
          org_id: orgId,
          branch_id: selfEmployee.employee.branch_id as string,
          source_type: LEAVE_APPROVAL_SOURCE,
          source_id: leaveId,
        },
        data: {
          status: 'CANCELLED',
          approver_id: userId,
          notes: 'Pengajuan cuti dibatalkan oleh pemohon.',
          decided_at: new Date(),
          updated_at: new Date(),
        },
      })
    })
  } catch (error) {
    console.error('cancelMyLeaveRequest Error:', error)
    return { error: 'Gagal membatalkan pengajuan cuti.' }
  }

  revalidatePath('/profil-saya')
  revalidatePath('/hris')
  revalidatePath('/accounting/approvals')
  return { success: true }
}

export async function deleteMyExpenseClaim(orgId: string, claimId: string) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return { error: selfEmployee.error }

  const claim = await prisma.expense_claims.findFirst({
    where: { id: claimId, org_id: orgId, employee_id: selfEmployee.employee.id },
    select: { id: true, status: true },
  })

  if (!claim?.id) return { error: 'Klaim biaya tidak ditemukan.' }

  const normalizedStatus = String(claim.status || '').toUpperCase()
  if (!['PENDING', 'REJECTED'].includes(normalizedStatus)) {
    return { error: 'Hanya klaim berstatus pending atau rejected yang bisa dihapus.' }
  }

  await prisma.expense_claims.deleteMany({
    where: { id: claimId, org_id: orgId, employee_id: selfEmployee.employee.id },
  })

  revalidatePath('/profil-saya')
  revalidatePath('/hris')
  return { success: true }
}
