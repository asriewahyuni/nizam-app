'use server'

import { createAdminClient } from '@/lib/supabase/server'
import bcrypt from 'bcrypt'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

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
  const branchSelection = await resolveEmployeeBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  const employees = await prisma.employees.findMany({
    where: {
      org_id: orgId,
      ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
    },
    include: {
      branches: { select: { id: true, name: true, code: true } },
    },
    orderBy: { first_name: 'asc' },
  })

  return employees.map((employee) => ({
    ...employee,
    branch: employee.branches,
    branches: undefined,
  }))
}

export async function createEmployee(orgId: string, formData: FormData) {
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

  await prisma.employees.create({
    data: {
      org_id: orgId,
      branch_id: activeBranch.branchId,
      nik,
      first_name: firstName,
      last_name: lastName || null,
      job_title: jobTitle,
      employment_status: status as any,
      basic_salary: basicSalary,
      join_date: new Date(`${joinDate}T00:00:00.000Z`),
      department: (formData.get('department') as string) || null,
      department_id: (formData.get('department_id') as any) || null,
      email: (formData.get('email') as string) || null,
      gender: (formData.get('gender') as string) || null,
      whatsapp: (formData.get('whatsapp') as string) || null,
      avatar_url: (formData.get('avatar_url') as string) || null,
      bank_name: (formData.get('bank_name') as string) || null,
      bank_account_number: (formData.get('bank_account_number') as string) || null,
      tax_status: (formData.get('tax_status') as string) || null,
    },
  })

  revalidatePath('/hris')
  return { success: true }
}

export async function updateEmployee(id: string, orgId: string, formData: FormData) {
  const existingEmployee = await prisma.employees.findFirst({
    where: { id, org_id: orgId },
    select: { id: true, branch_id: true },
  })

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

  const updated = await prisma.employees.updateMany({
    where: { id, org_id: orgId, branch_id: accessibleEmployee.branchId },
    data: {
      nik,
      first_name: firstName,
      last_name: lastName || null,
      job_title: jobTitle,
      employment_status: status as any,
      basic_salary: basicSalary,
      join_date: new Date(`${joinDate}T00:00:00.000Z`),
      department: (formData.get('department') as string) || null,
      department_id: (formData.get('department_id') as any) || null,
      email: (formData.get('email') as string) || null,
      gender: (formData.get('gender') as string) || null,
      whatsapp: (formData.get('whatsapp') as string) || null,
      avatar_url: (formData.get('avatar_url') as string) || null,
      bank_name: (formData.get('bank_name') as string) || null,
      bank_account_number: (formData.get('bank_account_number') as string) || null,
      tax_status: (formData.get('tax_status') as string) || null,
      updated_at: new Date(),
    },
  })

  if (updated.count === 0) return { error: 'Data karyawan tidak ditemukan.' }
  revalidatePath('/hris')
  return { success: true }
}

export async function uploadEmployeeAvatar(file: File, empId: string) {
  const supabase = await createAdminClient()
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
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const employee = await prisma.employees.findFirst({
    where: { id: empId, user_id: userId },
    select: { user_id: true },
  })

  if (!employee?.user_id) return { error: 'User auth tidak ditemukan.' }

  const passwordHash = bcrypt.hashSync(newPassword, 10)
  await prisma.user.update({
    where: { id: employee.user_id },
    data: { password: passwordHash },
  })
  return { success: true }
}

export async function updateEmployeeProfile(empId: string, payload: { avatar_url?: string; whatsapp?: string }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const updated = await prisma.employees.updateMany({
    where: { id: empId, user_id: userId },
    data: { ...payload, updated_at: new Date() },
  })
  if (updated.count === 0) return { error: 'Data karyawan tidak ditemukan.' }
  revalidatePath('/profil-saya')
  return { success: true }
}
