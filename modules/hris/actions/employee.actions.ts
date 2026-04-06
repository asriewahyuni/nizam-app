'use server'

import bcrypt from 'bcrypt'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { sanitizeUploadSegment, uploadPublicFile } from '@/lib/storage/public-upload'

const EMPLOYEE_CHILD_TRANSFER_AUDIT_TABLE = 'EMPLOYEE_CHILD_TRANSFER'

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

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

function isMissingDepartmentIdColumnError(error: any) {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('department_id') && (msg.includes('schema cache') || msg.includes('column'))
}

function isMissingManagerEmployeeIdColumnError(error: any) {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('manager_employee_id') && (msg.includes('schema cache') || msg.includes('column'))
}

function parseManagedIdList(rawValue: FormDataEntryValue | null, label: string) {
  const raw = String(rawValue || '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return Array.from(new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean)))
  } catch (error) {
    console.error(`Failed to parse ${label}`, error)
    return []
  }
}

async function syncEmployeeManagedChildOrgs(
  db: any,
  orgId: string,
  employeeId: string,
  managedChildOrgIds: string[]
) {
  const trimmedOrgId = String(orgId || '').trim()
  const trimmedEmployeeId = String(employeeId || '').trim()
  if (!trimmedOrgId || !trimmedEmployeeId) return { warning: null as string | null }

  // PIC anak perusahaan dikelola dari organisasi holding (main org) saja.
  const { data: activeOrg, error: activeOrgError } = await db
    .from('organizations')
    .select('id, parent_org_id')
    .eq('id', trimmedOrgId)
    .maybeSingle()

  if (activeOrgError || !activeOrg?.id) {
    return { warning: 'Sinkronisasi PIC anak perusahaan gagal: organisasi aktif tidak ditemukan.' }
  }
  if (activeOrg.parent_org_id) {
    return { warning: null as string | null }
  }

  const { data: childOrgs, error: childOrgsError } = await db
    .from('organizations')
    .select('id')
    .eq('parent_org_id', trimmedOrgId)

  if (childOrgsError) {
    return { warning: 'Sinkronisasi PIC anak perusahaan gagal membaca daftar entitas anak.' }
  }

  const allowedChildOrgIds = new Set(
    (Array.isArray(childOrgs) ? childOrgs : [])
      .map((row: any) => String(row?.id || '').trim())
      .filter(Boolean)
  )
  const scopedChildOrgIds = managedChildOrgIds.filter((id) => allowedChildOrgIds.has(id))
  const nowIso = new Date().toISOString()

  if (scopedChildOrgIds.length === 0) {
    const { error: clearError } = await db
      .from('organizations')
      .update({ manager_employee_id: null, updated_at: nowIso })
      .eq('parent_org_id', trimmedOrgId)
      .eq('manager_employee_id', trimmedEmployeeId)

    if (clearError && !isMissingManagerEmployeeIdColumnError(clearError)) {
      return { warning: 'Penugasan PIC anak perusahaan belum sepenuhnya terlepas otomatis.' }
    }

    return { warning: null as string | null }
  }

  const idListStr = `(${scopedChildOrgIds.join(',')})`
  const { error: clearError } = await db
    .from('organizations')
    .update({ manager_employee_id: null, updated_at: nowIso })
    .eq('parent_org_id', trimmedOrgId)
    .eq('manager_employee_id', trimmedEmployeeId)
    .not('id', 'in', idListStr)

  if (clearError && !isMissingManagerEmployeeIdColumnError(clearError)) {
    return { warning: 'Penugasan PIC anak perusahaan belum sepenuhnya terlepas otomatis.' }
  }

  const { error: setError } = await db
    .from('organizations')
    .update({ manager_employee_id: trimmedEmployeeId, updated_at: nowIso })
    .eq('parent_org_id', trimmedOrgId)
    .in('id', scopedChildOrgIds)

  if (setError && !isMissingManagerEmployeeIdColumnError(setError)) {
    return { warning: 'Gagal menyimpan sebagian penugasan PIC anak perusahaan.' }
  }

  return { warning: null as string | null }
}

async function clearManagedChildOrgAssignmentsForEmployee(db: any, employeeId: string) {
  const trimmedEmployeeId = String(employeeId || '').trim()
  if (!trimmedEmployeeId) return { warning: null as string | null }

  const { error } = await db
    .from('organizations')
    .update({ manager_employee_id: null, updated_at: new Date().toISOString() })
    .eq('manager_employee_id', trimmedEmployeeId)

  if (error && !isMissingManagerEmployeeIdColumnError(error)) {
    return { warning: 'Penugasan PIC anak perusahaan belum sepenuhnya terlepas otomatis.' }
  }

  return { warning: null as string | null }
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
  const branchSelection = await resolveEmployeeBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    throw new Error('Branch Selection Error: ' + branchSelection.error)
  }

  let query = db
    .from('employees')
    .select('*, branch:branches!employees_branch_id_fkey(id, name, code), managed_branches:branches!branches_pic_employee_id_fkey(id)')
    .eq('org_id', orgId)
    .order('first_name')

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query

  return employees.map((employee) => ({
    ...employee,
    branch: employee.branches,
    branches: undefined,
  }))
}

/**
 * Mengambil riwayat mutasi antar entitas (parent/child) dalam satu holding.
 */
export async function getEmployeeTransferHistory(orgId: string) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return []

  const supabase = await createClient()
  const db = supabase as any

  const { data, error } = await db
    .from('audit_logs')
    .select('id, created_at, action, new_data')
    .eq('org_id', trimmedOrgId)
    .eq('table_name', EMPLOYEE_CHILD_TRANSFER_AUDIT_TABLE)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !Array.isArray(data)) return []

  return data.map((row: any) => {
    const payload = row?.new_data || {}
    return {
      id: String(row?.id || crypto.randomUUID()),
      created_at: String(row?.created_at || new Date().toISOString()),
      action: String(row?.action || 'UPDATE'),
      employee_name: String(payload?.employee_name || '-'),
      employee_nik: String(payload?.employee_nik || '-'),
      from_org_name: String(payload?.from_org_name || '-'),
      from_branch_name: String(payload?.from_branch_name || '-'),
      to_org_name: String(payload?.to_org_name || '-'),
      to_branch_name: String(payload?.to_branch_name || '-'),
      actor_email: String(payload?.actor_email || '-'),
      note: payload?.note ? String(payload.note) : null,
      target_assigned_as_pic: Boolean(payload?.target_assigned_as_pic),
    }
  })
}

/**
 * Mutasi karyawan antar entitas (parent/child) dalam satu holding:
 * - buat data karyawan baru di entitas tujuan
 * - pindahkan profil asal (hapus jika memungkinkan, fallback RESIGNED jika terikat histori transaksi)
 * - lepas assignment PIC cabang lama
 * - opsional assign sebagai PIC di cabang tujuan
 * - simpan audit trail mutasi
 */
export async function transferEmployeeToChildOrg(orgId: string, payload: EmployeeChildTransferPayload) {
  const sourceOrgId = String(orgId || '').trim()
  const employeeId = String(payload?.employeeId || '').trim()
  const targetOrgId = String(payload?.targetOrgId || '').trim()
  const targetBranchId = String(payload?.targetBranchId || '').trim()
  const assignPicToTargetBranch = Boolean(payload?.assignPicToTargetBranch)
  const transferNote = String(payload?.note || '').trim() || null

  if (!sourceOrgId) return { error: 'Organisasi asal tidak valid.' }
  if (!employeeId) return { error: 'Karyawan yang akan dimutasi tidak valid.' }
  if (!targetOrgId) return { error: 'Entitas tujuan belum dipilih.' }
  if (!targetBranchId) return { error: 'Cabang tujuan belum dipilih.' }
  if (targetOrgId === sourceOrgId) return { error: 'Mutasi harus menuju entitas yang berbeda.' }

  const supabase = await createClient()
  const admin = await createAdminClient()
  const db = admin as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const [sourceMembershipResult, sourceOrgResult, targetOrgResult, sourceEmployeeResult] = await Promise.all([
    db
      .from('org_members')
      .select('role')
      .eq('org_id', sourceOrgId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
    db
      .from('organizations')
      .select('id, name, parent_org_id')
      .eq('id', sourceOrgId)
      .maybeSingle(),
    db
      .from('organizations')
      .select('id, name, parent_org_id, is_active')
      .eq('id', targetOrgId)
      .maybeSingle(),
    db
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .eq('org_id', sourceOrgId)
      .maybeSingle(),
  ])

  const sourceMembership = sourceMembershipResult?.data
  const sourceRole = String(sourceMembership?.role || '')
  if (!['owner', 'admin'].includes(sourceRole)) {
    return { error: 'Hanya owner/admin organisasi asal yang dapat memindahkan karyawan.' }
  }

  const sourceOrg = sourceOrgResult?.data
  if (!sourceOrg?.id) return { error: 'Organisasi asal tidak ditemukan.' }

  const targetOrg = targetOrgResult?.data
  if (!targetOrg?.id) return { error: 'Organisasi tujuan tidak ditemukan.' }
  if (!targetOrg.is_active) return { error: 'Organisasi tujuan sedang nonaktif.' }

  const sourceHoldingOrgId = String(sourceOrg.parent_org_id || sourceOrg.id || '')
  const targetHoldingOrgId = String(targetOrg.parent_org_id || targetOrg.id || '')
  if (!sourceHoldingOrgId || !targetHoldingOrgId || sourceHoldingOrgId !== targetHoldingOrgId) {
    return { error: 'Mutasi hanya bisa dilakukan antar entitas dalam holding yang sama.' }
  }

  const holdingMembershipResult = await db
    .from('org_members')
    .select('role')
    .eq('org_id', sourceHoldingOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const holdingRole = String(holdingMembershipResult?.data?.role || '')
  if (!['owner', 'admin'].includes(holdingRole)) {
    return { error: 'Mutasi parent/child memerlukan akses owner/admin pada organisasi holding.' }
  }

  const sourceEmployee = sourceEmployeeResult?.data
  if (!sourceEmployee?.id) return { error: 'Data karyawan asal tidak ditemukan.' }

  const [targetBranchResult, duplicateNikResult, sourceBranchResult] = await Promise.all([
    db
      .from('branches')
      .select('id, name, code, org_id, is_active')
      .eq('id', targetBranchId)
      .eq('org_id', targetOrgId)
      .maybeSingle(),
    db
      .from('employees')
      .select('id, employment_status, user_id')
      .eq('org_id', targetOrgId)
      .eq('nik', sourceEmployee.nik)
      .maybeSingle(),
    sourceEmployee.branch_id
      ? db.from('branches').select('id, name, code').eq('id', sourceEmployee.branch_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const targetBranch = targetBranchResult?.data
  if (!targetBranch?.id || !targetBranch?.is_active) {
    return { error: 'Cabang tujuan tidak valid atau tidak aktif.' }
  }

  const baseEmployeeData = { ...sourceEmployee }
  delete baseEmployeeData.id
  delete baseEmployeeData.org_id
  delete baseEmployeeData.branch_id
  delete baseEmployeeData.created_at
  delete baseEmployeeData.updated_at

  const transferJoinDate = String(sourceEmployee.join_date || new Date().toISOString().split('T')[0])
  const transferEmploymentStatus = ['TERMINATED', 'RESIGNED'].includes(String(sourceEmployee.employment_status || '').toUpperCase())
    ? 'FULL_TIME'
    : sourceEmployee.employment_status

  const insertPayload = {
    ...baseEmployeeData,
    org_id: targetOrgId,
    branch_id: targetBranchId,
    employment_status: transferEmploymentStatus,
    join_date: transferJoinDate,
    end_date: null,
    updated_at: new Date().toISOString(),
  }

  const warnings: string[] = []
  const existingTargetEmployee = duplicateNikResult?.data || null
  let targetEmployee: {
    id: string
    first_name: string
    last_name: string | null
    nik: string
    user_id: string | null
    job_title: string | null
  } | null = null
  let targetEmployeeWasReactivated = false

  if (existingTargetEmployee?.id) {
    const existingStatus = String(existingTargetEmployee.employment_status || '').toUpperCase()
    const canReactivate = ['RESIGNED', 'TERMINATED'].includes(existingStatus)
    if (!canReactivate) {
      return { error: `NIK ${sourceEmployee.nik} sudah digunakan pada organisasi tujuan.` }
    }

    if (
      existingTargetEmployee.user_id &&
      sourceEmployee.user_id &&
      existingTargetEmployee.user_id !== sourceEmployee.user_id
    ) {
      return { error: 'NIK tujuan terkait akun user lain. Hubungi admin untuk konsolidasi akun sebelum mutasi.' }
    }

    const resolvedTargetUserId = existingTargetEmployee.user_id || sourceEmployee.user_id || null
    const updatePayload = {
      ...baseEmployeeData,
      branch_id: targetBranchId,
      employment_status: transferEmploymentStatus,
      join_date: transferJoinDate,
      end_date: null,
      updated_at: new Date().toISOString(),
      user_id: resolvedTargetUserId,
      registration_status: resolvedTargetUserId ? 'REGISTERED' : baseEmployeeData.registration_status || null,
    }

    const { data: reactivatedEmployee, error: reactivateError } = await db
      .from('employees')
      .update(updatePayload)
      .eq('id', existingTargetEmployee.id)
      .eq('org_id', targetOrgId)
      .select('id, first_name, last_name, nik, user_id, job_title')
      .single()

    if (reactivateError || !reactivatedEmployee?.id) {
      return { error: reactivateError?.message || 'Gagal mengaktifkan ulang profil karyawan pada organisasi tujuan.' }
    }

    targetEmployee = reactivatedEmployee
    targetEmployeeWasReactivated = true
    warnings.push('Profil lama di organisasi tujuan diaktifkan ulang menggunakan NIK yang sama.')
  } else {
    const { data: createdEmployee, error: createError } = await db
      .from('employees')
      .insert(insertPayload)
      .select('id, first_name, last_name, nik, user_id, job_title')
      .single()

    if (createError || !createdEmployee?.id) {
      if (String(createError?.code || '') === '23505') {
        return { error: `Gagal mutasi: NIK ${sourceEmployee.nik} sudah terdaftar di organisasi tujuan.` }
      }
      return { error: createError?.message || 'Gagal membuat data karyawan pada organisasi tujuan.' }
    }

    targetEmployee = createdEmployee
  }

  if (!targetEmployee?.id) {
    return { error: 'Mutasi gagal karena profil tujuan tidak berhasil dipersiapkan.' }
  }

  // Pastikan user terdaftar di entitas tujuan bila karyawan ini sudah punya akun.
  const targetLoginUserId = targetEmployee.user_id || sourceEmployee.user_id || null
  if (targetLoginUserId) {
    const { data: targetRoleMatch } = await db
      .from('roles')
      .select('id, name')
      .eq('org_id', targetOrgId)
      .ilike('name', String(sourceEmployee.job_title || '').trim())
      .maybeSingle()

    const { error: memberUpsertError } = await db
      .from('org_members')
      .upsert({
        org_id: targetOrgId,
        user_id: targetLoginUserId,
        role: 'staff',
        role_id: targetRoleMatch?.id || null,
        is_active: true,
      }, { onConflict: 'org_id,user_id' })

    if (memberUpsertError) {
      warnings.push('Keanggotaan user di organisasi tujuan belum otomatis tersinkron. Cek Settings > Users.')
    }
  }

  const { error: clearSourcePicError } = await db
    .from('branches')
    .update({ pic_employee_id: null, updated_at: new Date().toISOString() })
    .eq('org_id', sourceOrgId)
    .eq('pic_employee_id', employeeId)

  if (clearSourcePicError) {
    warnings.push('PIC cabang lama belum sepenuhnya terlepas otomatis. Mohon cek menu Cabang.')
  }

  const clearSourceManagerAssignmentResult = await clearManagedChildOrgAssignmentsForEmployee(db, employeeId)
  if (clearSourceManagerAssignmentResult.warning) {
    warnings.push(clearSourceManagerAssignmentResult.warning)
  }

  let sourceCleanupMode: 'DELETED' | 'RESIGNED' = 'DELETED'
  const { error: sourceDeleteError } = await db
    .from('employees')
    .delete()
    .eq('id', employeeId)
    .eq('org_id', sourceOrgId)

  if (sourceDeleteError) {
    if (String(sourceDeleteError.code || '') === '23503') {
      const { error: sourceResignError } = await db
        .from('employees')
        .update({
          employment_status: 'RESIGNED',
          end_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', employeeId)
        .eq('org_id', sourceOrgId)

      if (sourceResignError) {
        if (!targetEmployeeWasReactivated) {
          await db.from('employees').delete().eq('id', targetEmployee.id).eq('org_id', targetOrgId)
        }
        return {
          error: sourceResignError.message ||
            (targetEmployeeWasReactivated
              ? 'Mutasi dibatalkan karena gagal memindahkan profil asal. Profil tujuan yang aktif ulang perlu ditinjau manual.'
              : 'Mutasi dibatalkan karena gagal memindahkan profil asal.'),
        }
      }

      sourceCleanupMode = 'RESIGNED'
      warnings.push('Profil asal tidak dapat dihapus karena memiliki histori transaksi; status otomatis diubah menjadi RESIGNED.')
    } else {
      if (!targetEmployeeWasReactivated) {
        await db.from('employees').delete().eq('id', targetEmployee.id).eq('org_id', targetOrgId)
      }
      return {
        error: sourceDeleteError.message ||
          (targetEmployeeWasReactivated
            ? 'Mutasi dibatalkan karena gagal membersihkan profil asal. Profil tujuan yang aktif ulang perlu ditinjau manual.'
            : 'Mutasi dibatalkan karena gagal membersihkan profil asal.'),
      }
    }
  }

  if (assignPicToTargetBranch) {
    const { error: setTargetPicError } = await db
      .from('branches')
      .update({ pic_employee_id: targetEmployee.id, updated_at: new Date().toISOString() })
      .eq('id', targetBranchId)
      .eq('org_id', targetOrgId)

    if (setTargetPicError) {
      warnings.push('Gagal menetapkan karyawan sebagai PIC di cabang tujuan.')
    }
  }

  if (targetLoginUserId) {
    const { data: sourceMembership } = await db
      .from('org_members')
      .select('role, is_active')
      .eq('org_id', sourceOrgId)
      .eq('user_id', targetLoginUserId)
      .eq('is_active', true)
      .maybeSingle()

    const sourceRoleForTransferredUser = String(sourceMembership?.role || '').toLowerCase()
    if (sourceRoleForTransferredUser === 'staff') {
      const { data: sourceEmployeeRows, error: sourceEmployeeRowsError } = await db
        .from('employees')
        .select('id, employment_status')
        .eq('org_id', sourceOrgId)
        .eq('user_id', targetLoginUserId)

      if (sourceEmployeeRowsError) {
        warnings.push('Gagal memverifikasi sisa data karyawan di organisasi asal untuk sinkronisasi akses user.')
      } else {
        const hasActiveEmployeeInSource = Array.isArray(sourceEmployeeRows)
          ? sourceEmployeeRows.some((row: { employment_status?: unknown }) => isEmployeeStatusActive(row?.employment_status))
          : false

        if (!hasActiveEmployeeInSource) {
          const { error: deactivateSourceMembershipError } = await db
            .from('org_members')
            .update({ is_active: false })
            .eq('org_id', sourceOrgId)
            .eq('user_id', targetLoginUserId)
            .eq('role', 'staff')
            .eq('is_active', true)

          if (deactivateSourceMembershipError) {
            warnings.push('Mutasi berhasil, tetapi akses user ke organisasi asal belum otomatis dinonaktifkan.')
          }
        }
      }
    }
  }

  const sourceBranch = sourceBranchResult?.data
  const transferLogPayload = {
    transfer_type: 'HOLDING_ENTITY_MUTATION',
    employee_name: `${sourceEmployee.first_name || ''} ${sourceEmployee.last_name || ''}`.trim(),
    employee_nik: sourceEmployee.nik || null,
    source_employee_id: employeeId,
    target_employee_id: targetEmployee.id,
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

  const sourceAuditPayload = {
    org_id: sourceOrgId,
    user_id: user.id,
    action: 'UPDATE',
    table_name: EMPLOYEE_CHILD_TRANSFER_AUDIT_TABLE,
    record_id: employeeId,
    old_data: {
      employee_id: employeeId,
      employee_status: sourceEmployee.employment_status,
      branch_id: sourceEmployee.branch_id || null,
    },
    new_data: transferLogPayload,
    user_agent: 'NIZAM ERP System',
  }

  const targetAuditPayload = {
    org_id: targetOrgId,
    user_id: user.id,
    action: 'CREATE',
    table_name: EMPLOYEE_CHILD_TRANSFER_AUDIT_TABLE,
    record_id: targetEmployee.id,
    old_data: null,
    new_data: transferLogPayload,
    user_agent: 'NIZAM ERP System',
  }

  const { error: sourceAuditError } = await db.from('audit_logs').insert(sourceAuditPayload)
  if (sourceAuditError) warnings.push('Audit trail pada entitas asal gagal disimpan.')

  const { error: targetAuditError } = await db.from('audit_logs').insert(targetAuditPayload)
  if (targetAuditError) warnings.push('Audit trail pada entitas tujuan gagal disimpan.')

  revalidatePath('/hris')
  revalidatePath('/settings/sub-orgs')
  revalidatePath('/settings/users')
  revalidatePath('/', 'layout')

  return {
    success: true,
    transferredEmployeeId: targetEmployee.id,
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
    warning: warnings.length > 0 ? warnings.join(' ') : null,
  }
}

/**
 * Tandai karyawan sebagai RESIGNED dan tulis rekam jejak ke audit log.
 * Jika memungkinkan, PIC cabang yang menunjuk karyawan ini juga dilepas otomatis.
 */
export async function resignEmployee(id: string, orgId: string, payload?: EmployeeResignPayload) {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const db = supabase as any
  const adminDb = admin as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedEmpId = String(id || '').trim()
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedEmpId || !trimmedOrgId) return { error: 'Data karyawan tidak valid.' }

  const { data: existingEmployee, error: existingEmployeeError } = await db
    .from('employees')
    .select('id, org_id, branch_id, nik, first_name, last_name, employment_status, end_date')
    .eq('id', trimmedEmpId)
    .eq('org_id', trimmedOrgId)
    .maybeSingle()

  if (existingEmployeeError) return { error: existingEmployeeError.message }
  if (!existingEmployee?.id) return { error: 'Data karyawan tidak ditemukan.' }

  const accessibleEmployee = await ensureEmployeeBranchAccess(
    trimmedOrgId,
    existingEmployee.branch_id ?? null,
    'Data karyawan tidak ditemukan.'
  )
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  const currentStatus = String(existingEmployee.employment_status || '').toUpperCase()
  const trimmedReason = String(payload?.reason || '').trim()
  const trimmedEffectiveDate = String(payload?.effectiveDate || '').trim()
  const effectiveDate = trimmedEffectiveDate || new Date().toISOString().split('T')[0]
  const note = trimmedReason || 'Resign diproses dari HRIS'

  if (currentStatus === 'RESIGNED') {
    return { success: true, alreadyResigned: true, effectiveDate }
  }

  const { error: updateError } = await db
    .from('employees')
    .update({
      employment_status: 'RESIGNED',
      end_date: effectiveDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trimmedEmpId)
    .eq('org_id', trimmedOrgId)
    .eq('branch_id', accessibleEmployee.branchId)

  if (updateError) return { error: updateError.message || 'Gagal menyimpan status resign.' }

  const warnings: string[] = []
  const { error: clearSourcePicError } = await db
    .from('branches')
    .update({ pic_employee_id: null, updated_at: new Date().toISOString() })
    .eq('org_id', trimmedOrgId)
    .eq('pic_employee_id', trimmedEmpId)

  if (clearSourcePicError) {
    warnings.push('Penugasan PIC cabang belum sepenuhnya terlepas otomatis.')
  }

  const clearManagedChildOrgResult = await clearManagedChildOrgAssignmentsForEmployee(db, trimmedEmpId)
  if (clearManagedChildOrgResult.warning) {
    warnings.push(clearManagedChildOrgResult.warning)
  }

  const { error: auditError } = await adminDb
    .from('audit_logs')
    .insert({
      org_id: trimmedOrgId,
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'EMPLOYEE_STATUS_HISTORY',
      record_id: trimmedEmpId,
      old_data: {
        employment_status: existingEmployee.employment_status,
        end_date: existingEmployee.end_date || null,
      },
      new_data: {
        employment_status: 'RESIGNED',
        effective_date: effectiveDate,
        reason: note,
        employee_name: `${existingEmployee.first_name || ''} ${existingEmployee.last_name || ''}`.trim(),
        employee_nik: existingEmployee.nik || null,
      },
      user_agent: 'NIZAM ERP System',
    })

  if (auditError) {
    warnings.push('Rekam jejak resign gagal ditulis ke audit log.')
  }

  revalidatePath('/hris')
  revalidatePath('/settings/branches')
  return {
    success: true,
    effectiveDate,
    warning: warnings.length > 0 ? warnings.join(' ') : null,
  }
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

  let { data: newEmp, error } = await db.from('employees').insert(payload).select('id').single()
  if (error && isMissingDepartmentIdColumnError(error)) {
    const { department_id: _ignoredDepartmentId, ...legacyPayload } = payload
    const retry = await db.from('employees').insert(legacyPayload).select('id').single()
    error = retry.error
    newEmp = retry.data
  }

  if (error) return { error: error.message }

  if (newEmp) {
    const managedBranchIds = parseManagedIdList(formData.get('managed_branches'), 'managed_branches')
    if (managedBranchIds.length > 0) {
      await db.from('branches').update({ pic_employee_id: newEmp.id }).eq('org_id', orgId).in('id', managedBranchIds)
    }

    const managedChildOrgStr = String(formData.get('managed_child_orgs') || '').trim()
    if (managedChildOrgStr) {
      const managedChildOrgIds = parseManagedIdList(formData.get('managed_child_orgs'), 'managed_child_orgs')
      await syncEmployeeManagedChildOrgs(db, orgId, newEmp.id, managedChildOrgIds)
      revalidatePath('/settings/sub-orgs')
    }
  }

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

  const managedBranchesStr = String(formData.get('managed_branches') || '').trim()
  if (managedBranchesStr) {
    const managedBranchIds = parseManagedIdList(formData.get('managed_branches'), 'managed_branches')
    if (managedBranchIds.length === 0) {
      await db.from('branches').update({ pic_employee_id: null }).eq('pic_employee_id', id).eq('org_id', orgId)
    } else {
      const idListStr = `(${managedBranchIds.join(',')})`
      await db.from('branches').update({ pic_employee_id: null }).eq('pic_employee_id', id).eq('org_id', orgId).not('id', 'in', idListStr)
      await db.from('branches').update({ pic_employee_id: id }).eq('org_id', orgId).in('id', managedBranchIds)
    }
  }

  const managedChildOrgStr = String(formData.get('managed_child_orgs') || '').trim()
  if (managedChildOrgStr) {
    const managedChildOrgIds = parseManagedIdList(formData.get('managed_child_orgs'), 'managed_child_orgs')
    await syncEmployeeManagedChildOrgs(db, orgId, id, managedChildOrgIds)
    revalidatePath('/settings/sub-orgs')
  }

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
