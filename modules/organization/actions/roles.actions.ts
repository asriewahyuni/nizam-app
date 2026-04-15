'use server'

import { revalidatePath } from 'next/cache'
import { queryPostgres } from '@/lib/db/postgres'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isInternalAuthProvider } from '@/lib/auth/provider'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'

type RoleMutationInput = {
  id?: string | null
  name: string
  departmentIds?: string[]
  parentId?: string | null
}

type OrganizationRoleRecord = Record<string, unknown> & {
  department_ids?: unknown
  permissions?: unknown
}

const DEPARTMENT_VALUE_ALIASES: Record<string, string> = {
  IT: 'CONFIG',
}

function normalizeRoleName(value: string) {
  return String(value || '').trim()
}

function normalizeDepartmentValue(value: unknown): string {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()

  return DEPARTMENT_VALUE_ALIASES[normalized] || normalized
}

function normalizeStringArray(values: unknown) {
  if (Array.isArray(values)) {
    return Array.from(
      new Set(
        values
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    )
  }

  if (typeof values === 'string') {
    const trimmed = values.trim()
    if (!trimmed) return []

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return normalizeStringArray(JSON.parse(trimmed) as unknown)
      } catch {
        return trimmed
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      }
    }

    return trimmed
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeDepartmentIds(values: unknown) {
  return Array.from(
    new Set(
      normalizeStringArray(values)
        .map((value) => normalizeDepartmentValue(value))
        .filter(Boolean)
    )
  )
}

function normalizePermissions(values: unknown) {
  return Array.from(
    new Set(
      normalizeStringArray(values)
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )
}

function normalizeRoleRecord(role: OrganizationRoleRecord) {
  return {
    ...role,
    department_ids: normalizeDepartmentIds(role.department_ids),
    permissions: normalizePermissions(role.permissions),
  }
}

function isRoleNameConflictError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const code = String(error?.code || '').trim()
  const message = String(error?.message || '')
  return code === '23505' || message.includes('roles_org_id_name_key')
}

async function getRolesDepartmentIdsCastType() {
  const result = await queryPostgres<{ udt_name: string | null }>(`
    SELECT udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name = 'department_ids'
    LIMIT 1
  `)

  const udtName = String(result.rows[0]?.udt_name || '').trim().toLowerCase()
  return udtName === '_nizam_department'
    ? 'public.nizam_department[]'
    : 'text[]'
}

async function saveOrganizationRoleViaSql(args: {
  id?: string | null
  orgId: string
  name: string
  departmentIds: string[]
  parentId: string | null
}) {
  const departmentIdsCastType = await getRolesDepartmentIdsCastType()

  if (args.id) {
    await queryPostgres(
      `
        UPDATE public.roles
        SET
          name = $3,
          department_ids = $4::${departmentIdsCastType},
          parent_id = $5::uuid
        WHERE id = $1::uuid
          AND org_id = $2::uuid
      `,
      [args.id, args.orgId, args.name, args.departmentIds, args.parentId]
    )
    return
  }

  const countResult = await queryPostgres<{ total: number }>(
    `
      SELECT COUNT(*)::int AS total
      FROM public.roles
      WHERE org_id = $1::uuid
    `,
    [args.orgId]
  )

  await queryPostgres(
    `
      INSERT INTO public.roles (
        org_id,
        name,
        department_ids,
        parent_id,
        permissions,
        is_system,
        priority
      )
      VALUES (
        $1::uuid,
        $2,
        $3::${departmentIdsCastType},
        $4::uuid,
        $5::text[],
        $6,
        $7
      )
    `,
    [
      args.orgId,
      args.name,
      args.departmentIds,
      args.parentId,
      [],
      false,
      Number(countResult.rows[0]?.total || 0),
    ]
  )
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
      const shouldRetryWithSql = error.message.includes('could not convert type text[] to nizam_department[]')
        || error.message.includes('COALESCE could not convert type text[] to nizam_department[]')

      if (shouldRetryWithSql) {
        try {
          await saveOrganizationRoleViaSql({
            id: String(input.id),
            orgId: context.orgId,
            name: payload.name,
            departmentIds: payload.department_ids,
            parentId: payload.parent_id,
          })
        } catch (sqlError: any) {
          return {
            error: isRoleNameConflictError(sqlError)
              ? 'Nama jabatan ini sudah ada di organisasi Anda.'
              : String(sqlError?.message || error.message || 'Gagal menyimpan jabatan.'),
          }
        }

        revalidateRolePages()
        return { success: true as const }
      }

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
    const shouldRetryWithSql = error.message.includes('could not convert type text[] to nizam_department[]')
      || error.message.includes('COALESCE could not convert type text[] to nizam_department[]')

    if (shouldRetryWithSql) {
      try {
        await saveOrganizationRoleViaSql({
          orgId: context.orgId,
          name: payload.name,
          departmentIds: payload.department_ids,
          parentId: payload.parent_id,
        })
      } catch (sqlError: any) {
        return {
          error: isRoleNameConflictError(sqlError)
            ? 'Nama jabatan ini sudah ada di organisasi Anda.'
            : String(sqlError?.message || error.message || 'Gagal menyimpan jabatan.'),
        }
      }

      revalidateRolePages()
      return { success: true as const }
    }

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
