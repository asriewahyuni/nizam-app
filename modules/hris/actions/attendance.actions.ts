'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

const ATTENDANCE_STATUSES = new Set(['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'SICK', 'HALFDAY'])

async function resolveAttendanceBranchSelection(orgId: string, branchId?: string | null): Promise<BranchSelectionResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function ensureAttendanceBranchAccess(orgId: string, branchId: string | null, notFoundMessage: string) {
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedBranchId) {
    return { error: notFoundMessage }
  }

  const branchSelection = await resolveAttendanceBranchSelection(orgId, trimmedBranchId)
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

function normalizeDateTime(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return null
  const parsed = new Date(trimmedValue)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export async function getAttendanceRecords(orgId: string, branchId?: string | null, startDate?: string | null) {
  const branchSelection = await resolveAttendanceBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  const normalizedStartDate = normalizeDateOnly(String(startDate || '').trim())
  const defaultStartDate = new Date()
  defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 14)
  const fallbackStartDate = defaultStartDate.toISOString().split('T')[0]

  const records = await prisma.attendance.findMany({
    where: {
      org_id: orgId,
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      record_date: {
        gte: new Date(`${(normalizedStartDate || fallbackStartDate) as string}T00:00:00.000Z`),
      },
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
    orderBy: [{ record_date: 'desc' }, { created_at: 'desc' }],
  })

  return records.map((record) => ({
    ...record,
    branch: record.branches,
    employee: record.employees,
    branches: undefined,
    employees: undefined,
  }))
}

export async function upsertAttendanceRecord(orgId: string, formData: FormData) {
  const employeeId = String(formData.get('employee_id') || '').trim()
  const recordDate = normalizeDateOnly(String(formData.get('record_date') || ''))
  const status = String(formData.get('status') || 'ABSENT').trim().toUpperCase()
  const notes = String(formData.get('notes') || '').trim()
  const checkIn = normalizeDateTime(String(formData.get('check_in') || ''))
  const checkOut = normalizeDateTime(String(formData.get('check_out') || ''))

  if (!employeeId) return { error: 'Karyawan wajib dipilih.' }
  if (!recordDate) return { error: 'Tanggal absensi tidak valid.' }
  if (!ATTENDANCE_STATUSES.has(status)) return { error: 'Status absensi tidak valid.' }
  if (checkIn && checkOut && new Date(checkOut).getTime() < new Date(checkIn).getTime()) {
    return { error: 'Jam keluar tidak boleh lebih awal dari jam masuk.' }
  }

  const employee = await prisma.employees.findFirst({
    where: { id: employeeId, org_id: orgId },
    select: { id: true, branch_id: true },
  })

  const accessibleEmployee = await ensureAttendanceBranchAccess(
    orgId,
    employee?.branch_id ?? null,
    'Data karyawan tidak ditemukan.'
  )
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  const recordDateObj = new Date(`${recordDate}T00:00:00.000Z`)
  const existingRecord = await prisma.attendance.findFirst({
    where: {
      org_id: orgId,
      branch_id: accessibleEmployee.branchId,
      employee_id: employeeId,
      record_date: recordDateObj,
    },
    select: { id: true },
  })

  if (existingRecord?.id) {
    await prisma.attendance.updateMany({
      where: { id: existingRecord.id, org_id: orgId, branch_id: accessibleEmployee.branchId },
      data: {
        org_id: orgId,
        branch_id: accessibleEmployee.branchId,
        employee_id: employeeId,
        record_date: recordDateObj,
        status: status as any,
        check_in: checkIn ? new Date(checkIn) : null,
        check_out: checkOut ? new Date(checkOut) : null,
        notes: notes || null,
        updated_at: new Date(),
      },
    })
  } else {
    await prisma.attendance.create({
      data: {
        org_id: orgId,
        branch_id: accessibleEmployee.branchId,
        employee_id: employeeId,
        record_date: recordDateObj,
        status: status as any,
        check_in: checkIn ? new Date(checkIn) : null,
        check_out: checkOut ? new Date(checkOut) : null,
        notes: notes || null,
      },
    })
  }

  revalidatePath('/hris')
  return { success: true }
}
