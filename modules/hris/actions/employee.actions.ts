'use server'

import bcrypt from 'bcrypt'
import { Prisma, employment_status, nizam_department } from '@prisma/client'
import { getAuthUser, getMembership } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { sanitizeUploadSegment, uploadPublicFile } from '@/lib/storage/public-upload'

const EMPLOYEE_CHILD_TRANSFER_AUDIT_TABLE = 'EMPLOYEE_CHILD_TRANSFER'

type BranchSelectionResult = { branchId: string | null } | { error: string }

type EmployeeChildTransferPayload = {
  employeeId: string
  targetOrgId: string
  targetBranchId: string
  assignPicToTargetBranch?: boolean
  note?: string
}

type EmployeeResignPayload = {
  reason?: string | null
  effectiveDate?: string | null
}

function isEmployeeStatusActive(status: unknown) {
  const normalizedStatus = String(status || '').trim().toUpperCase()
  return normalizedStatus !== 'RESIGNED' && normalizedStatus !== 'TERMINATED'
}

function normalizeEmploymentStatus(value: unknown): employment_status {
  const normalized = String(value || 'FULL_TIME').trim().toUpperCase()
  return normalized === 'RESIGNED' || normalized === 'TERMINATED' || normalized === 'CONTRACT' || normalized === 'INTERN' || normalized === 'PROBATION'
    ? (normalized as employment_status)
    : employment_status.FULL_TIME
}

function normalizeDepartment(value: unknown): nizam_department | null {
  const normalized = String(value || '').trim().toUpperCase()
  if (!normalized) return null
  const allowed = new Set<string>(['DASHBOARD_AUDIT', 'INSIGHT', 'CONFIG', 'FINANCE', 'OPERASIONAL', 'MARKETING_SALES', 'HRIS'])
  return allowed.has(normalized) ? (normalized as nizam_department) : null
}

function parseManagedIdList(rawValue: FormDataEntryValue | null, label: string) {
  const raw = String(rawValue || '').trim()
  if (!raw) return [] as string[]
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return Array.from(new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean)))
  } catch (error) {
    console.error(`Failed to parse ${label}`, error)
    return []
  }
}

async function resolveEmployeeBranchSelection(orgId: string, branchId?: string | null): Promise<BranchSelectionResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return { error: branchSelection.error || 'Akses unit tidak valid.' }
  return { branchId: branchSelection.branchId }
}

async function requireEmployeeCreateBranchId(orgId: string): Promise<{ branchId: string } | { error: string }> {
  const branchSelection = await resolveEmployeeBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) return { error: 'Pilih unit aktif terlebih dahulu untuk menambahkan karyawan.' }
  return { branchId: branchSelection.branchId }
}

async function ensureEmployeeBranchAccess(orgId: string, branchId: string | null, notFoundMessage: string) {
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedBranchId) return { error: notFoundMessage }
  const branchSelection = await resolveEmployeeBranchSelection(orgId, trimmedBranchId)
  if ('error' in branchSelection) return { error: branchSelection.error }
  return { branchId: trimmedBranchId }
}

async function updateBranchPicAssignments(orgId: string, employeeId: string, managedBranchIds: string[]) {
  await prisma.$executeRaw`
    UPDATE public.branches
    SET pic_employee_id = NULL,
        updated_at = NOW()
    WHERE org_id = ${orgId}::uuid
      AND pic_employee_id = ${employeeId}::uuid
  `

  if (managedBranchIds.length > 0) {
    await prisma.$executeRaw`
      UPDATE public.branches
      SET pic_employee_id = ${employeeId}::uuid,
          updated_at = NOW()
      WHERE org_id = ${orgId}::uuid
        AND id = ANY(${managedBranchIds}::uuid[])
    `
  }
}

async function syncEmployeeManagedChildOrgs(orgId: string, employeeId: string, managedChildOrgIds: string[]) {
  const childOrgs = await prisma.organizations.findMany({
    where: { parent_org_id: orgId },
    select: { id: true },
  })
  const allowedIds = new Set(childOrgs.map((org) => org.id))
  const scopedIds = managedChildOrgIds.filter((id) => allowedIds.has(id))

  await prisma.$executeRaw`
    UPDATE public.organizations
    SET manager_employee_id = NULL,
        updated_at = NOW()
    WHERE parent_org_id = ${orgId}::uuid
      AND manager_employee_id = ${employeeId}::uuid
  `

  if (scopedIds.length > 0) {
    await prisma.$executeRaw`
      UPDATE public.organizations
      SET manager_employee_id = ${employeeId}::uuid,
          updated_at = NOW()
      WHERE parent_org_id = ${orgId}::uuid
        AND id = ANY(${scopedIds}::uuid[])
    `
  }
}

async function clearManagedChildOrgAssignmentsForEmployee(employeeId: string) {
  await prisma.$executeRaw`
    UPDATE public.organizations
    SET manager_employee_id = NULL,
        updated_at = NOW()
    WHERE manager_employee_id = ${employeeId}::uuid
  `
}

async function getAuthenticatedUser() {
  const user = await getAuthUser()
  if (!user?.userId) return null

  return {
    id: user.userId,
    email: user.email,
    name: user.name,
  }
}

export async function getEmployees(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveEmployeeBranchSelection(orgId, branchId)
  if ('error' in branchSelection) throw new Error('Branch Selection Error: ' + branchSelection.error)

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

  const employeeIds = employees.map((employee) => employee.id)
  const managedBranches = employeeIds.length > 0
    ? await prisma.$queryRaw<Array<{ id: string; pic_employee_id: string | null }>>`
        SELECT id::text AS id, pic_employee_id::text AS pic_employee_id
        FROM public.branches
        WHERE org_id = ${orgId}::uuid
          AND pic_employee_id = ANY(${employeeIds}::uuid[])
      `
    : []

  const childOrgs = await prisma.$queryRaw<Array<{ id: string; name: string; manager_employee_id: string | null }>>`
    SELECT id::text AS id, name, manager_employee_id::text AS manager_employee_id
    FROM public.organizations
    WHERE parent_org_id = ${orgId}::uuid
  `

  return employees.map((employee) => ({
    ...employee,
    branch: employee.branches,
    managed_branches: managedBranches.filter((branch) => branch.pic_employee_id === employee.id).map((branch) => ({ id: branch.id })),
    managed_child_orgs: childOrgs.filter((org) => org.manager_employee_id === employee.id).map((org) => ({ id: org.id, name: org.name })),
  }))
}

export async function getEmployeeTransferHistory(orgId: string) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return []

  const data = await prisma.audit_logs.findMany({
    where: { org_id: trimmedOrgId, table_name: EMPLOYEE_CHILD_TRANSFER_AUDIT_TABLE },
    select: { id: true, created_at: true, action: true, new_data: true },
    orderBy: { created_at: 'desc' },
    take: 20,
  })

  return data.map((row) => {
    const payload = (row.new_data && typeof row.new_data === 'object' ? row.new_data : {}) as Record<string, unknown>
    return {
      id: row.id,
      created_at: row.created_at.toISOString(),
      action: row.action,
      employee_name: String(payload.employee_name || '-'),
      employee_nik: String(payload.employee_nik || '-'),
      from_org_name: String(payload.from_org_name || '-'),
      from_branch_name: String(payload.from_branch_name || '-'),
      to_org_name: String(payload.to_org_name || '-'),
      to_branch_name: String(payload.to_branch_name || '-'),
      actor_email: String(payload.actor_email || '-'),
      note: payload.note ? String(payload.note) : null,
      target_assigned_as_pic: Boolean(payload.target_assigned_as_pic),
    }
  })
}

export async function transferEmployeeToChildOrg(orgId: string, payload: EmployeeChildTransferPayload) {
  const user = await getAuthenticatedUser()
  if (!user?.id) return { error: 'Tidak terautentikasi.' }

  const sourceOrgId = String(orgId || '').trim()
  const employeeId = String(payload.employeeId || '').trim()
  const targetOrgId = String(payload.targetOrgId || '').trim()
  const targetBranchId = String(payload.targetBranchId || '').trim()
  const assignPicToTargetBranch = Boolean(payload.assignPicToTargetBranch)
  const transferNote = String(payload.note || '').trim() || null

  if (!sourceOrgId || !employeeId || !targetOrgId || !targetBranchId) return { error: 'Data mutasi belum lengkap.' }
  if (sourceOrgId === targetOrgId) return { error: 'Mutasi harus menuju entitas yang berbeda.' }

  const [sourceMembership, sourceOrg, targetOrg, sourceEmployee, targetBranch] = await Promise.all([
    getMembership(user.id, sourceOrgId),
    prisma.organizations.findUnique({ where: { id: sourceOrgId }, select: { id: true, name: true, parent_org_id: true } }),
    prisma.organizations.findUnique({ where: { id: targetOrgId }, select: { id: true, name: true, parent_org_id: true, is_active: true } }),
    prisma.employees.findFirst({ where: { id: employeeId, org_id: sourceOrgId } }),
    prisma.branches.findFirst({ where: { id: targetBranchId, org_id: targetOrgId, is_active: true }, select: { id: true, name: true, code: true } }),
  ])

  if (!sourceMembership?.isOwnerOrAdmin) return { error: 'Hanya owner/admin organisasi asal yang dapat memindahkan karyawan.' }
  if (!sourceOrg?.id) return { error: 'Organisasi asal tidak ditemukan.' }
  if (!targetOrg?.id || !targetOrg.is_active) return { error: 'Organisasi tujuan tidak ditemukan atau sedang nonaktif.' }
  if (!sourceEmployee?.id) return { error: 'Data karyawan asal tidak ditemukan.' }
  if (!targetBranch?.id) return { error: 'Cabang tujuan tidak valid atau tidak aktif.' }

  const sourceHoldingOrgId = String(sourceOrg.parent_org_id || sourceOrg.id)
  const targetHoldingOrgId = String(targetOrg.parent_org_id || targetOrg.id)
  if (sourceHoldingOrgId !== targetHoldingOrgId) return { error: 'Mutasi hanya bisa dilakukan antar entitas dalam holding yang sama.' }

  const holdingMembership = await getMembership(user.id, sourceHoldingOrgId)
  if (!holdingMembership?.isOwnerOrAdmin) {
    return { error: 'Mutasi parent/child memerlukan akses owner/admin pada organisasi holding.' }
  }

  const existingTargetEmployee = await prisma.employees.findFirst({
    where: { org_id: targetOrgId, nik: sourceEmployee.nik },
    select: { id: true, employment_status: true, user_id: true },
  })

  const baseEmployeeData = {
    nik: sourceEmployee.nik,
    first_name: sourceEmployee.first_name,
    last_name: sourceEmployee.last_name,
    job_title: sourceEmployee.job_title,
    employment_status: normalizeEmploymentStatus(sourceEmployee.employment_status),
    basic_salary: sourceEmployee.basic_salary,
    join_date: sourceEmployee.join_date,
    department_id: sourceEmployee.department_id,
    email: sourceEmployee.email,
    gender: sourceEmployee.gender,
    whatsapp: sourceEmployee.whatsapp,
    avatar_url: sourceEmployee.avatar_url,
    bank_name: sourceEmployee.bank_name,
    bank_account_number: sourceEmployee.bank_account_number,
    tax_status: sourceEmployee.tax_status,
    user_id: sourceEmployee.user_id,
    registration_status: sourceEmployee.registration_status,
  }

  let targetEmployeeId = ''
  if (existingTargetEmployee?.id && ['RESIGNED', 'TERMINATED'].includes(String(existingTargetEmployee.employment_status || '').toUpperCase())) {
    const updated = await prisma.employees.update({
      where: { id: existingTargetEmployee.id },
      data: { ...baseEmployeeData, org_id: targetOrgId, branch_id: targetBranchId, end_date: null, updated_at: new Date() },
      select: { id: true },
    })
    targetEmployeeId = updated.id
  } else if (existingTargetEmployee?.id) {
    return { error: `NIK ${sourceEmployee.nik} sudah digunakan pada organisasi tujuan.` }
  } else {
    const created = await prisma.employees.create({
      data: { ...baseEmployeeData, org_id: targetOrgId, branch_id: targetBranchId, end_date: null },
      select: { id: true },
    })
    targetEmployeeId = created.id
  }

  if (sourceEmployee.user_id) {
    const targetRole = await prisma.roles.findFirst({
      where: { org_id: targetOrgId, name: { equals: String(sourceEmployee.job_title || '').trim(), mode: 'insensitive' } },
      select: { id: true },
    })
    await prisma.org_members.upsert({
      where: { org_id_user_id: { org_id: targetOrgId, user_id: sourceEmployee.user_id } },
      update: { role: 'staff', role_id: targetRole?.id || null, is_active: true },
      create: { org_id: targetOrgId, user_id: sourceEmployee.user_id, role: 'staff', role_id: targetRole?.id || null, is_active: true },
    })
  }

  await prisma.$executeRaw`UPDATE public.branches SET pic_employee_id = NULL, updated_at = NOW() WHERE org_id = ${sourceOrgId}::uuid AND pic_employee_id = ${employeeId}::uuid`
  await clearManagedChildOrgAssignmentsForEmployee(employeeId)

  let sourceCleanupMode: 'DELETED' | 'RESIGNED' = 'DELETED'
  try {
    await prisma.employees.delete({ where: { id: employeeId } })
  } catch {
    await prisma.employees.update({
      where: { id: employeeId },
      data: { employment_status: 'RESIGNED', end_date: new Date().toISOString().split('T')[0], updated_at: new Date() },
    })
    sourceCleanupMode = 'RESIGNED'
  }

  if (assignPicToTargetBranch) {
    await prisma.$executeRaw`UPDATE public.branches SET pic_employee_id = ${targetEmployeeId}::uuid, updated_at = NOW() WHERE id = ${targetBranchId}::uuid AND org_id = ${targetOrgId}::uuid`
  }

  if (sourceEmployee.user_id) {
    const remainingSourceEmployees = await prisma.employees.findMany({ where: { org_id: sourceOrgId, user_id: sourceEmployee.user_id }, select: { employment_status: true } })
    if (!remainingSourceEmployees.some((employee) => isEmployeeStatusActive(employee.employment_status))) {
      await prisma.org_members.updateMany({ where: { org_id: sourceOrgId, user_id: sourceEmployee.user_id, role: 'staff', is_active: true }, data: { is_active: false } })
    }
  }

  const sourceBranch = sourceEmployee.branch_id
    ? await prisma.branches.findUnique({ where: { id: sourceEmployee.branch_id }, select: { name: true } })
    : null

  const transferLogPayload = {
    transfer_type: 'HOLDING_ENTITY_MUTATION',
    employee_name: `${sourceEmployee.first_name || ''} ${sourceEmployee.last_name || ''}`.trim(),
    employee_nik: sourceEmployee.nik || null,
    source_employee_id: employeeId,
    target_employee_id: targetEmployeeId,
    from_org_id: sourceOrgId,
    from_org_name: sourceOrg.name || null,
    from_branch_id: sourceEmployee.branch_id || null,
    from_branch_name: sourceBranch?.name || null,
    to_org_id: targetOrgId,
    to_org_name: targetOrg.name || null,
    to_branch_id: targetBranchId,
    to_branch_name: targetBranch.name || null,
    actor_user_id: user.id,
    actor_email: user.email || null,
    note: transferNote,
    target_assigned_as_pic: assignPicToTargetBranch,
    source_cleanup_mode: sourceCleanupMode,
  }

  await prisma.audit_logs.createMany({
    data: [
      { org_id: sourceOrgId, user_id: user.id, action: 'UPDATE', table_name: EMPLOYEE_CHILD_TRANSFER_AUDIT_TABLE, record_id: employeeId, old_data: { employee_id: employeeId }, new_data: transferLogPayload, user_agent: 'NIZAM ERP System' },
      { org_id: targetOrgId, user_id: user.id, action: 'CREATE', table_name: EMPLOYEE_CHILD_TRANSFER_AUDIT_TABLE, record_id: targetEmployeeId, old_data: Prisma.JsonNull, new_data: transferLogPayload, user_agent: 'NIZAM ERP System' },
    ],
  })

  revalidatePath('/hris')
  revalidatePath('/settings/sub-orgs')
  revalidatePath('/settings/users')
  revalidatePath('/', 'layout')

  return {
    success: true,
    transferredEmployeeId: targetEmployeeId,
    transferLog: {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      action: 'UPDATE',
      employee_name: transferLogPayload.employee_name,
      employee_nik: transferLogPayload.employee_nik,
      from_org_name: transferLogPayload.from_org_name || '-',
      from_branch_name: transferLogPayload.from_branch_name || '-',
      to_org_name: transferLogPayload.to_org_name || '-',
      to_branch_name: transferLogPayload.to_branch_name || '-',
      actor_email: transferLogPayload.actor_email || '-',
      note: transferLogPayload.note,
      target_assigned_as_pic: transferLogPayload.target_assigned_as_pic,
    },
    warning: sourceCleanupMode === 'RESIGNED' ? 'Profil asal tidak dapat dihapus karena memiliki histori transaksi; status otomatis diubah menjadi RESIGNED.' : null,
  }
}

export async function resignEmployee(id: string, orgId: string, payload?: EmployeeResignPayload) {
  const user = await getAuthenticatedUser()
  if (!user?.id) return { error: 'Tidak terautentikasi.' }

  const existingEmployee = await prisma.employees.findFirst({
    where: { id, org_id: orgId },
    select: { id: true, org_id: true, branch_id: true, nik: true, first_name: true, last_name: true, employment_status: true, end_date: true },
  })
  if (!existingEmployee?.id) return { error: 'Data karyawan tidak ditemukan.' }

  const accessibleEmployee = await ensureEmployeeBranchAccess(orgId, existingEmployee.branch_id ?? null, 'Data karyawan tidak ditemukan.')
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  const effectiveDate = String(payload?.effectiveDate || '').trim() || new Date().toISOString().split('T')[0]
  if (String(existingEmployee.employment_status || '').toUpperCase() !== 'RESIGNED') {
    await prisma.employees.update({
      where: { id },
      data: { employment_status: 'RESIGNED', end_date: effectiveDate, updated_at: new Date() },
    })
  }

  await prisma.$executeRaw`UPDATE public.branches SET pic_employee_id = NULL, updated_at = NOW() WHERE org_id = ${orgId}::uuid AND pic_employee_id = ${id}::uuid`
  await clearManagedChildOrgAssignmentsForEmployee(id)
  await prisma.audit_logs.create({
    data: {
      org_id: orgId,
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'EMPLOYEE_STATUS_HISTORY',
      record_id: id,
      old_data: { employment_status: existingEmployee.employment_status, end_date: existingEmployee.end_date || null },
      new_data: { employment_status: 'RESIGNED', effective_date: effectiveDate, reason: String(payload?.reason || '').trim() || 'Resign diproses dari HRIS' },
      user_agent: 'NIZAM ERP System',
    },
  })

  revalidatePath('/hris')
  revalidatePath('/settings/branches')
  return { success: true, effectiveDate }
}

export async function createEmployee(orgId: string, formData: FormData) {
  const activeBranch = await requireEmployeeCreateBranchId(orgId)
  if ('error' in activeBranch) return { error: activeBranch.error }

  const employee = await prisma.employees.create({
    data: {
      org_id: orgId,
      branch_id: activeBranch.branchId,
      nik: String(formData.get('nik') || ''),
      first_name: String(formData.get('first_name') || ''),
      last_name: String(formData.get('last_name') || ''),
      job_title: String(formData.get('job_title') || ''),
      employment_status: normalizeEmploymentStatus(formData.get('employment_status')) as employment_status,
      basic_salary: Number(formData.get('basic_salary') || 0),
      join_date: String(formData.get('join_date') || '') || new Date().toISOString().split('T')[0],
      department_id: normalizeDepartment(formData.get('department_id')),
      email: String(formData.get('email') || '') || null,
      gender: String(formData.get('gender') || '') || null,
      whatsapp: String(formData.get('whatsapp') || '') || null,
      avatar_url: String(formData.get('avatar_url') || '') || null,
      bank_name: String(formData.get('bank_name') || '') || null,
      bank_account_number: String(formData.get('bank_account_number') || '') || null,
      tax_status: String(formData.get('tax_status') || '') || null,
    },
    select: { id: true },
  })

  await updateBranchPicAssignments(orgId, employee.id, parseManagedIdList(formData.get('managed_branches'), 'managed_branches'))
  await syncEmployeeManagedChildOrgs(orgId, employee.id, parseManagedIdList(formData.get('managed_child_orgs'), 'managed_child_orgs'))

  revalidatePath('/hris')
  revalidatePath('/settings/sub-orgs')
  return { success: true }
}

export async function updateEmployee(id: string, orgId: string, formData: FormData) {
  const existingEmployee = await prisma.employees.findFirst({ where: { id, org_id: orgId }, select: { branch_id: true } })
  const accessibleEmployee = await ensureEmployeeBranchAccess(orgId, existingEmployee?.branch_id ?? null, 'Data karyawan tidak ditemukan.')
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  await prisma.employees.update({
    where: { id },
    data: {
      nik: String(formData.get('nik') || ''),
      first_name: String(formData.get('first_name') || ''),
      last_name: String(formData.get('last_name') || ''),
      job_title: String(formData.get('job_title') || ''),
      employment_status: normalizeEmploymentStatus(formData.get('employment_status')) as employment_status,
      basic_salary: Number(formData.get('basic_salary') || 0),
      join_date: String(formData.get('join_date') || '') || new Date().toISOString().split('T')[0],
      department_id: normalizeDepartment(formData.get('department_id')),
      email: String(formData.get('email') || '') || null,
      gender: String(formData.get('gender') || '') || null,
      whatsapp: String(formData.get('whatsapp') || '') || null,
      avatar_url: String(formData.get('avatar_url') || '') || null,
      bank_name: String(formData.get('bank_name') || '') || null,
      bank_account_number: String(formData.get('bank_account_number') || '') || null,
      tax_status: String(formData.get('tax_status') || '') || null,
      updated_at: new Date(),
    },
  })

  await updateBranchPicAssignments(orgId, id, parseManagedIdList(formData.get('managed_branches'), 'managed_branches'))
  await syncEmployeeManagedChildOrgs(orgId, id, parseManagedIdList(formData.get('managed_child_orgs'), 'managed_child_orgs'))

  revalidatePath('/hris')
  revalidatePath('/settings/sub-orgs')
  return { success: true }
}

export async function deleteEmployee(id: string, orgId: string) {
  const existingEmployee = await prisma.employees.findFirst({ where: { id, org_id: orgId }, select: { branch_id: true } })
  const accessibleEmployee = await ensureEmployeeBranchAccess(orgId, existingEmployee?.branch_id ?? null, 'Data karyawan tidak ditemukan.')
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  try {
    await prisma.employees.delete({ where: { id } })
  } catch {
    return { error: 'Karyawan tidak bisa dihapus karena masih dipakai di data transaksi (absensi/payroll/cuti/dokumen terkait).' }
  }

  revalidatePath('/hris')
  return { success: true }
}

export async function uploadEmployeeAvatar(file: File, empId: string): Promise<{ url?: string; error?: string }> {
  try {
    return await uploadPublicFile({
      folder: 'avatars',
      file,
      fileName: `emp-${sanitizeUploadSegment(empId) || Date.now().toString()}`,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal mengunggah avatar.' }
  }
}

export async function updateEmployeePasswordSelf(empId: string, newPassword: string) {
  const user = await getAuthUser()
  const userId = user?.userId
  if (!userId) return { error: 'Unauthorized' }

  const employee = await prisma.employees.findFirst({ where: { id: empId, user_id: userId }, select: { user_id: true } })
  if (!employee?.user_id) return { error: 'User auth tidak ditemukan.' }

  await prisma.user.update({ where: { id: employee.user_id }, data: { password: bcrypt.hashSync(newPassword, 10) } })
  return { success: true }
}

export async function updateEmployeeProfile(empId: string, payload: { avatar_url?: string; whatsapp?: string }) {
  const user = await getAuthUser()
  const userId = user?.userId
  if (!userId) return { error: 'Unauthorized' }

  const updated = await prisma.employees.updateMany({ where: { id: empId, user_id: userId }, data: { ...payload, updated_at: new Date() } })
  if (updated.count === 0) return { error: 'Data karyawan tidak ditemukan.' }
  revalidatePath('/profil-saya')
  return { success: true }
}
