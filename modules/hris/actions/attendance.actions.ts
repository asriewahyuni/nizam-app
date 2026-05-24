'use server'

import { createClient } from '@/lib/supabase/server'
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

// ── Ringkasan presensi hari ini (untuk dashboard ERP admin/owner) ────────────
export async function getTodayAttendanceSummary(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const db = supabase as any
  const todayJkt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  // Semua karyawan aktif di org ini (filter branch jika dipilih)
  let empQuery = db
    .from('employees')
    .select('id, first_name, last_name, job_title, branch_id')
    .eq('org_id', orgId)
    .eq('is_active', true)
  if (branchId) empQuery = empQuery.eq('branch_id', branchId)
  const { data: employees } = await empQuery

  // Record presensi hari ini
  let attQuery = db
    .from('attendance')
    .select('employee_id, check_in, check_out, status')
    .eq('org_id', orgId)
    .eq('record_date', todayJkt)
  if (branchId) attQuery = attQuery.eq('branch_id', branchId)
  const { data: records } = await attQuery

  const attMap = new Map<string, { check_in: string | null; check_out: string | null; status: string }>(
    (records ?? []).map((r: any) => [r.employee_id, r])
  )

  const totalEmployees = (employees ?? []).length
  const presentCount = (records ?? []).filter((r: any) => r.check_in).length
  const lateCount = (records ?? []).filter((r: any) => r.status === 'LATE').length

  const list = (employees ?? []).map((emp: any) => {
    const att = attMap.get(emp.id)
    return {
      employeeId: emp.id as string,
      employeeName: [emp.first_name, emp.last_name].filter(Boolean).join(' '),
      jobTitle: (emp.job_title as string) || '',
      checkIn: (att?.check_in ?? null) as string | null,
      checkOut: (att?.check_out ?? null) as string | null,
      status: (att?.status ?? 'ABSENT') as string,
    }
  }).sort((a, b) => {
    // Hadir duluan, lalu belum hadir
    if (a.checkIn && !b.checkIn) return -1
    if (!a.checkIn && b.checkIn) return 1
    return a.employeeName.localeCompare(b.employeeName)
  })

  return {
    date: todayJkt,
    totalEmployees,
    presentCount,
    lateCount,
    absentCount: totalEmployees - presentCount,
    list,
  }
}

export async function getAttendanceRecords(orgId: string, branchId?: string | null, startDate?: string | null) {
  const supabase = await createClient()
  const db = supabase as any
  const branchSelection = await resolveAttendanceBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  const normalizedStartDate = normalizeDateOnly(String(startDate || '').trim())
  const defaultStartDate = new Date()
  defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 14)
  const fallbackStartDate = defaultStartDate.toISOString().split('T')[0]

  let query = db
    .from('attendance')
    .select(`
      *,
      branch:branches(id, name, code),
      employee:employee_id(id, first_name, last_name, nik, job_title, branch_id)
    `)
    .eq('org_id', orgId)
    .gte('record_date', normalizedStartDate || fallbackStartDate)
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query

  if (error) return []
  return data
}

export async function upsertAttendanceRecord(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any

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

  const { data: employee, error: employeeError } = await db
    .from('employees')
    .select('id, branch_id')
    .eq('id', employeeId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (employeeError) return { error: employeeError.message }

  const accessibleEmployee = await ensureAttendanceBranchAccess(
    orgId,
    employee?.branch_id ?? null,
    'Data karyawan tidak ditemukan.'
  )
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  const attendancePayload = {
    org_id: orgId,
    branch_id: accessibleEmployee.branchId,
    employee_id: employeeId,
    record_date: recordDate,
    status,
    check_in: checkIn,
    check_out: checkOut,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  }

  const { data: existingRecord, error: existingRecordError } = await db
    .from('attendance')
    .select('id')
    .eq('org_id', orgId)
    .eq('branch_id', accessibleEmployee.branchId)
    .eq('employee_id', employeeId)
    .eq('record_date', recordDate)
    .maybeSingle()

  if (existingRecordError) return { error: existingRecordError.message }

  if (existingRecord?.id) {
    const { error } = await db
      .from('attendance')
      .update(attendancePayload)
      .eq('id', existingRecord.id)
      .eq('org_id', orgId)
      .eq('branch_id', accessibleEmployee.branchId)

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('attendance')
      .insert({
        ...attendancePayload,
        created_at: new Date().toISOString(),
      })

    if (error) return { error: error.message }
  }

  revalidatePath('/hris')
  return { success: true }
}
