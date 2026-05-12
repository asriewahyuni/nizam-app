'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isInternalAuthProvider } from '@/lib/auth/provider'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  normalizeDepartmentIds,
  normalizePermissions,
  normalizeRoleRecord,
} from '@/modules/organization/lib/role-normalization'

type RoleMutationInput = {
  id?: string | null
  name: string
  departmentIds?: string[]
  parentId?: string | null
}

type OrganizationRoleRecord = Record<string, unknown> & {
  department_ids?: unknown
  department_id?: unknown
  permissions?: unknown
}

function normalizeRoleName(value: string) {
  return String(value || '').trim()
}

function isRoleNameConflictError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const code = String(error?.code || '').trim()
  const message = String(error?.message || '')
  return code === '23505' || message.includes('roles_org_id_name_key')
}

function canManageRoles(activeOrg: Awaited<ReturnType<typeof getActiveOrg>>) {
  if (!activeOrg) return false
  if (['owner', 'admin'].includes(String(activeOrg.role || '').toLowerCase())) return true
  return Array.isArray(activeOrg.permissions)
    && activeOrg.permissions.some((permission) => String(permission || '').toLowerCase().includes('business'))
}

async function getRolesDbContext(orgId: string) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) {
    return { error: 'Organisasi tidak valid.' as const }
  }

  const activeOrg = await getActiveOrg()
  if (!activeOrg || String(activeOrg.org?.id || '').trim() !== trimmedOrgId) {
    return { error: 'Akses organisasi tidak ditemukan.' as const }
  }

  if (!canManageRoles(activeOrg)) {
    return { error: 'Anda tidak memiliki izin untuk mengelola jabatan.' as const }
  }

  const db = isInternalAuthProvider()
    ? ((await createAdminClient()) as any)
    : ((await createClient()) as any)

  return {
    orgId: trimmedOrgId,
    db,
  }
}

function revalidateRolePages() {
  revalidatePath('/settings/roles')
  revalidatePath('/settings/users')
  revalidatePath('/hris')
}

export async function getRolesForOrganization(orgId: string) {
  const context = await getRolesDbContext(orgId)
  if ('error' in context) {
    return { error: context.error, data: [] as any[] }
  }

  const { data, error } = await context.db
    .from('roles')
    .select('*')
    .eq('org_id', context.orgId)
    .order('name')

  if (error) {
    return { error: `Gagal memuat daftar jabatan: ${error.message}`, data: [] as any[] }
  }

  return {
    data: Array.isArray(data)
      ? data.map((role) => normalizeRoleRecord((role || {}) as OrganizationRoleRecord))
      : [],
  }
}

export async function saveOrganizationRole(orgId: string, input: RoleMutationInput) {
  const context = await getRolesDbContext(orgId)
  if ('error' in context) return { error: context.error }

  const name = normalizeRoleName(input.name)
  if (!name) return { error: 'Nama jabatan wajib diisi.' }

  const payload = {
    org_id: context.orgId,
    name,
    department_ids: normalizeDepartmentIds(input.departmentIds),
    parent_id: String(input.parentId || '').trim() || null,
  }

  if (input.id) {
    const { error } = await context.db
      .from('roles')
      .update(payload)
      .eq('id', input.id)
      .eq('org_id', context.orgId)

    if (error) {
      return { error: isRoleNameConflictError(error) ? 'Nama jabatan ini sudah ada di organisasi Anda.' : error.message }
    }

    revalidateRolePages()
    return { success: true as const }
  }

  const { count } = await context.db
    .from('roles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', context.orgId)

  const { error } = await context.db
    .from('roles')
    .insert({
      ...payload,
      permissions: [],
      is_system: false,
      priority: Number(count || 0),
    })

  if (error) {
    return { error: isRoleNameConflictError(error) ? 'Nama jabatan ini sudah ada di organisasi Anda.' : error.message }
  }

  revalidateRolePages()
  return { success: true as const }
}

export async function updateOrganizationRolePermissions(orgId: string, roleId: string, permissions: string[]) {
  const context = await getRolesDbContext(orgId)
  if ('error' in context) return { error: context.error }

  const trimmedRoleId = String(roleId || '').trim()
  if (!trimmedRoleId) return { error: 'Jabatan tidak valid.' }

  const { error } = await context.db
    .from('roles')
    .update({
      permissions: normalizePermissions(permissions),
    })
    .eq('id', trimmedRoleId)
    .eq('org_id', context.orgId)

  if (error) return { error: error.message }

  revalidateRolePages()
  return { success: true as const }
}

export async function reorderOrganizationRoles(orgId: string, roleIds: string[]) {
  const context = await getRolesDbContext(orgId)
  if ('error' in context) return { error: context.error }

  const normalizedRoleIds = roleIds
    .map((roleId) => String(roleId || '').trim())
    .filter(Boolean)

  await Promise.all(
    normalizedRoleIds.map((roleId, index) =>
      context.db
        .from('roles')
        .update({ priority: index })
        .eq('id', roleId)
        .eq('org_id', context.orgId)
    )
  )

  revalidateRolePages()
  return { success: true as const }
}

export async function deleteOrganizationRole(orgId: string, roleId: string) {
  const context = await getRolesDbContext(orgId)
  if ('error' in context) return { error: context.error }

  const trimmedRoleId = String(roleId || '').trim()
  if (!trimmedRoleId) return { error: 'Jabatan tidak valid.' }

  const { error } = await context.db
    .from('roles')
    .delete()
    .eq('id', trimmedRoleId)
    .eq('org_id', context.orgId)

  if (error) return { error: error.message }

  revalidateRolePages()
  return { success: true as const }
}

export async function getActiveOrgEnabledModules() {
  const activeOrg = await getActiveOrg()
  if (!activeOrg) return { modules: [] as string[] }

  return { modules: Array.isArray(activeOrg.enabledModules) ? activeOrg.enabledModules : [] }
}
