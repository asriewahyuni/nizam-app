'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type SelfEmployee = {
  id: string
  branch_id: string | null
  first_name: string
  last_name: string | null
  job_title: string | null
  nik: string
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

async function getAuthenticatedEmployee(orgId: string): Promise<{ employee: SelfEmployee } | { error: string }> {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const { data: employee, error } = await db
    .from('employees')
    .select('id, branch_id, first_name, last_name, job_title, nik')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!employee?.id) return { error: 'Data karyawan Anda tidak ditemukan.' }
  if (!employee.branch_id) return { error: 'Anda belum terhubung ke unit aktif.' }

  return { employee }
}

export async function getMyAttendanceRecords(orgId: string, startDate?: string | null) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return []

  const supabase = await createClient()
  const db = supabase as any
  const normalizedStartDate = normalizeDateOnly(String(startDate || '').trim())
  const defaultStartDate = new Date()
  defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - 14)
  const fallbackStartDate = defaultStartDate.toISOString().split('T')[0]

  const { data, error } = await db
    .from('attendance')
    .select('*, branch:branches(id, name, code)')
    .eq('org_id', orgId)
    .eq('employee_id', selfEmployee.employee.id)
    .gte('record_date', normalizedStartDate || fallbackStartDate)
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}

export async function getMyLeaveRequests(orgId: string) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return []

  const supabase = await createClient()
  const db = supabase as any
  const { data, error } = await db
    .from('leave_requests')
    .select('*, branch:branches(id, name, code)')
    .eq('org_id', orgId)
    .eq('employee_id', selfEmployee.employee.id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return []
  return data
}

export async function getMyExpenseClaims(orgId: string) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return []

  const supabase = await createClient()
  const db = supabase as any
  const { data, error } = await db
    .from('expense_claims')
    .select('*, branch:branches(id, name, code)')
    .eq('org_id', orgId)
    .eq('employee_id', selfEmployee.employee.id)
    .order('claim_date', { ascending: false })
    .limit(10)

  if (error) return []
  return data
}

export async function clockMyAttendance(orgId: string, payload: { type: 'IN' | 'OUT'; notes?: string }) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return { error: selfEmployee.error }

  const supabase = await createClient()
  const db = supabase as any
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()
  const notes = String(payload.notes || '').trim()

  const { data: existingRecord, error: existingRecordError } = await db
    .from('attendance')
    .select('id, status, check_out, notes')
    .eq('org_id', orgId)
    .eq('employee_id', selfEmployee.employee.id)
    .eq('record_date', today)
    .maybeSingle()

  if (existingRecordError) return { error: existingRecordError.message }

  if (payload.type === 'IN') {
    if (existingRecord?.id) {
      return { error: 'Anda sudah clock-in hari ini.' }
    }

    const { error } = await db
      .from('attendance')
      .insert({
        org_id: orgId,
        branch_id: selfEmployee.employee.branch_id,
        employee_id: selfEmployee.employee.id,
        record_date: today,
        check_in: now,
        status: 'PRESENT',
        notes: notes || null,
      })

    if (error) return { error: error.message }
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

    const { error } = await db
      .from('attendance')
      .update({
        check_out: now,
        notes: mergedNotes || null,
        updated_at: now,
      })
      .eq('id', existingRecord.id)
      .eq('org_id', orgId)
      .eq('employee_id', selfEmployee.employee.id)

    if (error) return { error: error.message }
  }

  revalidatePath('/profil-saya')
  revalidatePath('/hris')
  return { success: true }
}

export async function submitMyLeaveRequest(orgId: string, formData: FormData) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return { error: selfEmployee.error }

  const supabase = await createClient()
  const db = supabase as any

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

  const { error } = await db
    .from('leave_requests')
    .insert({
      org_id: orgId,
      branch_id: selfEmployee.employee.branch_id,
      employee_id: selfEmployee.employee.id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      days_taken: calculateDaysTaken(startDate, endDate),
      reason,
      status: 'PENDING',
    })

  if (error) return { error: error.message }

  revalidatePath('/profil-saya')
  revalidatePath('/hris')
  return { success: true }
}

export async function submitMyExpenseClaim(orgId: string, formData: FormData) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return { error: selfEmployee.error }

  const supabase = await createClient()
  const db = supabase as any
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

  const { error } = await db
    .from('expense_claims')
    .insert({
      org_id: orgId,
      branch_id: selfEmployee.employee.branch_id,
      employee_id: selfEmployee.employee.id,
      claim_date: claimDate,
      category,
      amount,
      description,
      receipt_url: receiptUrl,
      status: 'PENDING',
    })

  if (error) return { error: error.message }

  revalidatePath('/profil-saya')
  revalidatePath('/hris')
  return { success: true }
}

export async function cancelMyLeaveRequest(orgId: string, leaveId: string) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return { error: selfEmployee.error }

  const supabase = await createClient()
  const db = supabase as any
  const { data: leaveRequest, error: leaveRequestError } = await db
    .from('leave_requests')
    .select('id, status')
    .eq('id', leaveId)
    .eq('org_id', orgId)
    .eq('employee_id', selfEmployee.employee.id)
    .maybeSingle()

  if (leaveRequestError) return { error: leaveRequestError.message }
  if (!leaveRequest?.id) return { error: 'Pengajuan cuti tidak ditemukan.' }
  if (String(leaveRequest.status || '').toUpperCase() !== 'PENDING') {
    return { error: 'Hanya pengajuan cuti berstatus pending yang bisa dibatalkan.' }
  }

  const { error } = await db
    .from('leave_requests')
    .update({
      status: 'CANCELLED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leaveId)
    .eq('org_id', orgId)
    .eq('employee_id', selfEmployee.employee.id)

  if (error) return { error: error.message }

  revalidatePath('/profil-saya')
  revalidatePath('/hris')
  return { success: true }
}

export async function deleteMyExpenseClaim(orgId: string, claimId: string) {
  const selfEmployee = await getAuthenticatedEmployee(orgId)
  if ('error' in selfEmployee) return { error: selfEmployee.error }

  const supabase = await createClient()
  const db = supabase as any
  const { data: claim, error: claimError } = await db
    .from('expense_claims')
    .select('id, status')
    .eq('id', claimId)
    .eq('org_id', orgId)
    .eq('employee_id', selfEmployee.employee.id)
    .maybeSingle()

  if (claimError) return { error: claimError.message }
  if (!claim?.id) return { error: 'Klaim biaya tidak ditemukan.' }

  const normalizedStatus = String(claim.status || '').toUpperCase()
  if (!['PENDING', 'REJECTED'].includes(normalizedStatus)) {
    return { error: 'Hanya klaim berstatus pending atau rejected yang bisa dihapus.' }
  }

  const { error } = await db
    .from('expense_claims')
    .delete()
    .eq('id', claimId)
    .eq('org_id', orgId)
    .eq('employee_id', selfEmployee.employee.id)

  if (error) return { error: error.message }

  revalidatePath('/profil-saya')
  revalidatePath('/hris')
  return { success: true }
}
