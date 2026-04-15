'use server'

import { revalidatePath } from 'next/cache'
import { queryPostgres } from '@/lib/db/postgres'
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

type RoleDepartmentColumnKind = 'missing' | 'text_array' | 'enum_array' | 'enum' | 'text'

type RoleDepartmentSchema = {
  departmentIdsKind: RoleDepartmentColumnKind
  departmentIdKind: RoleDepartmentColumnKind
}

function normalizeRoleName(value: string) {
  return String(value || '').trim()
}

function isRoleNameConflictError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const code = String(error?.code || '').trim()
  const message = String(error?.message || '')
  return code === '23505' || message.includes('roles_org_id_name_key')
}

function shouldRetryRoleSaveViaSql(message: string) {
  return message.includes('could not convert type text[] to nizam_department[]')
    || message.includes('COALESCE could not convert type text[] to nizam_department[]')
    || message.includes('invalid input value for enum nizam_department')
    || message.includes('malformed array literal')
}

function resolveRoleDepartmentColumnKind(column: {
  data_type: string | null
  udt_name: string | null
} | undefined): RoleDepartmentColumnKind {
  const udtName = String(column?.udt_name || '').trim().toLowerCase()
  const dataType = String(column?.data_type || '').trim().toLowerCase()

  if (!udtName && !dataType) return 'missing'
  if (udtName === '_nizam_department') return 'enum_array'
  if (udtName === 'nizam_department') return 'enum'
  if (udtName.startsWith('_') || dataType === 'array') return 'text_array'
  if (udtName === 'text' || dataType === 'text' || dataType.includes('character')) return 'text'
  return 'missing'
}

async function getRolesDepartmentSchema(): Promise<RoleDepartmentSchema> {
  const result = await queryPostgres<{
    column_name: string
    data_type: string | null
    udt_name: string | null
  }>(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name IN ('department_ids', 'department_id')
  `)

  const byName = new Map(result.rows.map((row) => [row.column_name, row]))

  return {
    departmentIdsKind: resolveRoleDepartmentColumnKind(byName.get('department_ids')),
    departmentIdKind: resolveRoleDepartmentColumnKind(byName.get('department_id')),
  }
}

function getRoleDepartmentSqlValue(kind: RoleDepartmentColumnKind, paramIndex: number) {
  switch (kind) {
    case 'enum_array':
      return `$${paramIndex}::public.nizam_department[]`
    case 'text_array':
      return `$${paramIndex}::text[]`
    case 'enum':
      return `NULLIF($${paramIndex}, '')::public.nizam_department`
    case 'text':
      return `NULLIF($${paramIndex}, '')`
    default:
      return null
  }
}

function getRoleDepartmentSqlParam(kind: RoleDepartmentColumnKind, departmentIds: string[]) {
  if (kind === 'enum_array' || kind === 'text_array') {
    return departmentIds
  }

  return departmentIds[0] || ''
}

function appendDepartmentInsertColumn(args: {
  columns: string[]
  values: string[]
  params: unknown[]
  nextIndex: number
  columnName: 'department_ids' | 'department_id'
  kind: RoleDepartmentColumnKind
  departmentIds: string[]
}) {
  const sqlValue = getRoleDepartmentSqlValue(args.kind, args.nextIndex)
  if (!sqlValue) return args.nextIndex

  args.columns.push(args.columnName)
  args.values.push(sqlValue)
  args.params.push(getRoleDepartmentSqlParam(args.kind, args.departmentIds))
  return args.nextIndex + 1
}

function appendDepartmentUpdateAssignment(args: {
  assignments: string[]
  params: unknown[]
  nextIndex: number
  columnName: 'department_ids' | 'department_id'
  kind: RoleDepartmentColumnKind
  departmentIds: string[]
}) {
  const sqlValue = getRoleDepartmentSqlValue(args.kind, args.nextIndex)
  if (!sqlValue) return args.nextIndex

  args.assignments.push(`${args.columnName} = ${sqlValue}`)
  args.params.push(getRoleDepartmentSqlParam(args.kind, args.departmentIds))
  return args.nextIndex + 1
}

async function saveOrganizationRoleViaSql(args: {
  id?: string | null
  orgId: string
  name: string
  departmentIds: string[]
  parentId: string | null
}) {
  const departmentSchema = await getRolesDepartmentSchema()

  if (args.id) {
    const assignments = ['name = $3']
    const params: unknown[] = [args.id, args.orgId, args.name]
    let nextIndex = 4

    nextIndex = appendDepartmentUpdateAssignment({
      assignments,
      params,
      nextIndex,
      columnName: 'department_ids',
      kind: departmentSchema.departmentIdsKind,
      departmentIds: args.departmentIds,
    })

    nextIndex = appendDepartmentUpdateAssignment({
      assignments,
      params,
      nextIndex,
      columnName: 'department_id',
      kind: departmentSchema.departmentIdKind,
      departmentIds: args.departmentIds,
    })

    assignments.push(`parent_id = $${nextIndex}::uuid`)
    params.push(args.parentId)

    await queryPostgres(
      `
        UPDATE public.roles
        SET
          ${assignments.join(',\n          ')}
        WHERE id = $1::uuid
          AND org_id = $2::uuid
      `,
      params
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

  const columns = ['org_id', 'name']
  const values = ['$1::uuid', '$2']
  const params: unknown[] = [args.orgId, args.name]
  let nextIndex = 3

  nextIndex = appendDepartmentInsertColumn({
    columns,
    values,
    params,
    nextIndex,
    columnName: 'department_ids',
    kind: departmentSchema.departmentIdsKind,
    departmentIds: args.departmentIds,
  })

  nextIndex = appendDepartmentInsertColumn({
    columns,
    values,
    params,
    nextIndex,
    columnName: 'department_id',
    kind: departmentSchema.departmentIdKind,
    departmentIds: args.departmentIds,
  })

  columns.push('parent_id', 'permissions', 'is_system', 'priority')
  values.push(
    `$${nextIndex}::uuid`,
    `$${nextIndex + 1}::text[]`,
    `$${nextIndex + 2}`,
    `$${nextIndex + 3}`
  )
  params.push(
    args.parentId,
    [],
    false,
    Number(countResult.rows[0]?.total || 0),
  )

  await queryPostgres(
    `
      INSERT INTO public.roles (${columns.join(', ')})
      VALUES (${values.join(', ')})
    `,
    params
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
      const shouldRetryWithSql = shouldRetryRoleSaveViaSql(error.message)

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
    const shouldRetryWithSql = shouldRetryRoleSaveViaSql(error.message)

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
