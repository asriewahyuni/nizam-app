'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

function isMissingDepartmentIdColumnError(error: any) {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('department_id') && (msg.includes('schema cache') || msg.includes('column'))
}

async function resolveEmployeeBranchSelection(orgId: string, branchId?: string | null): Promise<BranchSelectionResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function requireEmployeeCreateBranchId(orgId: string): Promise<{ branchId: string } | { error: string }> {
  const branchSelection = await resolveEmployeeBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk menambahkan karyawan.' }
  }

  return { branchId: branchSelection.branchId as string }
}

async function ensureEmployeeBranchAccess(orgId: string, branchId: string | null, notFoundMessage: string) {
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedBranchId) {
    return { error: notFoundMessage }
  }

  const branchSelection = await resolveEmployeeBranchSelection(orgId, trimmedBranchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error }
  }

  return { branchId: trimmedBranchId }
}

export async function getEmployees(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const db = supabase as any
  const branchSelection = await resolveEmployeeBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = db
    .from('employees')
    .select('*, branch:branches(id, name, code)')
    .eq('org_id', orgId)
    .order('first_name')

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query

  if (error) return []
  return data
}

export async function createEmployee(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const activeBranch = await requireEmployeeCreateBranchId(orgId)
  if ('error' in activeBranch) return { error: activeBranch.error }

  // Extract basics
  const nik = formData.get('nik') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const jobTitle = formData.get('job_title') as string
  const status = formData.get('employment_status') as string || 'FULL_TIME'
  const basicSalary = Number(formData.get('basic_salary') || 0)
  const joinDate = formData.get('join_date') as string || new Date().toISOString().split('T')[0]

  const payload = {
    org_id: orgId,
    branch_id: activeBranch.branchId,
    nik,
    first_name: firstName,
    last_name: lastName,
    job_title: jobTitle,
    employment_status: status,
    basic_salary: basicSalary,
    join_date: joinDate,
    department: formData.get('department') || null,
    department_id: formData.get('department_id') || null,
    email: formData.get('email') || null,
    gender: formData.get('gender') || null,
    whatsapp: formData.get('whatsapp') || null,
    avatar_url: formData.get('avatar_url') || null,
    bank_name: formData.get('bank_name') || null,
    bank_account_number: formData.get('bank_account_number') || null,
    tax_status: formData.get('tax_status') || null
  }

  let { error } = await db.from('employees').insert(payload)
  if (error && isMissingDepartmentIdColumnError(error)) {
    const { department_id: _ignoredDepartmentId, ...legacyPayload } = payload
    const retry = await db.from('employees').insert(legacyPayload)
    error = retry.error
  }

  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}

export async function updateEmployee(id: string, orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any

  const { data: existingEmployee, error: existingEmployeeError } = await db
    .from('employees')
    .select('id, branch_id')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (existingEmployeeError) return { error: existingEmployeeError.message }

  const accessibleEmployee = await ensureEmployeeBranchAccess(
    orgId,
    existingEmployee?.branch_id ?? null,
    'Data karyawan tidak ditemukan.'
  )
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  const nik = formData.get('nik') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const jobTitle = formData.get('job_title') as string
  const status = formData.get('employment_status') as string || 'FULL_TIME'
  const basicSalary = Number(formData.get('basic_salary') || 0)
  const joinDate = formData.get('join_date') as string

  const updatePayload = {
    nik,
    first_name: firstName,
    last_name: lastName,
    job_title: jobTitle,
    employment_status: status,
    basic_salary: basicSalary,
    join_date: joinDate,
    department: formData.get('department') || null,
    department_id: formData.get('department_id') || null,
    email: formData.get('email') || null,
    gender: formData.get('gender') || null,
    whatsapp: formData.get('whatsapp') || null,
    avatar_url: formData.get('avatar_url') || null,
    bank_name: formData.get('bank_name') || null,
    bank_account_number: formData.get('bank_account_number') || null,
    tax_status: formData.get('tax_status') || null,
    updated_at: new Date().toISOString()
  }

  let { error } = await db
    .from('employees')
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('branch_id', accessibleEmployee.branchId)

  if (error && isMissingDepartmentIdColumnError(error)) {
    const { department_id: _ignoredDepartmentId, ...legacyPayload } = updatePayload
    const retry = await db
      .from('employees')
      .update(legacyPayload)
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('branch_id', accessibleEmployee.branchId)
    error = retry.error
  }

  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}

export async function deleteEmployee(id: string, orgId: string) {
  const supabase = await createClient()
  const db = supabase as any

  const { data: existingEmployee, error: existingEmployeeError } = await db
    .from('employees')
    .select('id, branch_id')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (existingEmployeeError) return { error: existingEmployeeError.message }

  const accessibleEmployee = await ensureEmployeeBranchAccess(
    orgId,
    existingEmployee?.branch_id ?? null,
    'Data karyawan tidak ditemukan.'
  )
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  const { error } = await db
    .from('employees')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('branch_id', accessibleEmployee.branchId)

  if (error) {
    if (error.code === '23503') {
      return { error: 'Karyawan tidak bisa dihapus karena masih dipakai di data transaksi (absensi/payroll/cuti/dokumen terkait).' }
    }
    return { error: error.message }
  }

  revalidatePath('/hris')
  return { success: true }
}

export async function uploadEmployeeAvatar(file: File, empId: string) {
  const supabase = await createClient()
  const ext = file.name.split('.').pop()
  const path = `emp-${empId}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) return { error: upErr.message }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return { url: data.publicUrl }
}

export async function updateEmployeePasswordSelf(empId: string, newPassword: string) {
  const admin = await createAdminClient()
  const supabase = await createClient()
  const { data: emp } = await (supabase as any)
    .from('employees')
    .select('user_id')
    .eq('id', empId)
    .single()
  if (!emp?.user_id) return { error: 'User auth tidak ditemukan.' }
  const { error } = await admin.auth.admin.updateUserById(emp.user_id, { password: newPassword })
  if (error) return { error: error.message }
  return { success: true }
}

export async function updateEmployeeProfile(empId: string, payload: { avatar_url?: string; whatsapp?: string }) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('employees')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', empId)
  if (error) return { error: error.message }
  revalidatePath('/profil-saya')
  return { success: true }
}
