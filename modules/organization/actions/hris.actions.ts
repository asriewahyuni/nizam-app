'use server'

import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  getMembership,
  type MembershipContext,
} from '@/lib/auth/permissions'

type OrgRoleRecord = {
  id: string
  org_id: string
  name: string
  permissions: string[]
  is_system: boolean
  priority: number | null
  parent_id: string | null
  department_id: string | null
  department_ids: string[]
}

type OrgRoleListResult =
  | { roles: OrgRoleRecord[] }
  | { roles: []; error: string }

type RoleMutationResult =
  | { success: true; role: OrgRoleRecord }
  | { error: string }

type RoleReorderResult =
  | { success: true; roles: OrgRoleRecord[] }
  | { error: string }

type RoleDeleteResult =
  | { success: true }
  | { error: string }

type AuthenticatedMembershipResult =
  | {
      orgId: string
      membership: MembershipContext
    }
  | { error: string }

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  )
}

function membershipHasPermission(
  membership: MembershipContext,
  requiredPermissionKeys: string[]
) {
  if (membership.isOwnerOrAdmin) return true

  const normalizedPermissions = membership.permissions
    .filter((permission): permission is string => typeof permission === 'string')
    .map((permission) => permission.toLowerCase())

  return normalizedPermissions.some((permission) =>
    requiredPermissionKeys.some((requiredKey) =>
      permission.includes(requiredKey.toLowerCase())
    )
  )
}

function canManageRoleCatalog(membership: MembershipContext) {
  return membershipHasPermission(membership, [
    'business',
    'employee',
    'employees',
    'hris',
  ])
}

function canManageRolePermissions(membership: MembershipContext) {
  return membershipHasPermission(membership, ['business'])
}

function normalizeRole(role: {
  id: string
  org_id: string
  name: string
  permissions: string[]
  is_system: boolean
  priority: number | null
  parent_id: string | null
  department_id: unknown
  department_ids: string[]
}): OrgRoleRecord {
  return {
    id: role.id,
    org_id: role.org_id,
    name: role.name,
    permissions: normalizeStringArray(role.permissions),
    is_system: Boolean(role.is_system),
    priority: role.priority ?? null,
    parent_id: role.parent_id ?? null,
    department_id: role.department_id ? String(role.department_id) : null,
    department_ids: normalizeStringArray(role.department_ids),
  }
}

function sortRoles(roles: OrgRoleRecord[]) {
  return [...roles].sort((left, right) => {
    const leftPriority = Number.isFinite(left.priority) ? Number(left.priority) : Number.MAX_SAFE_INTEGER
    const rightPriority = Number.isFinite(right.priority) ? Number(right.priority) : Number.MAX_SAFE_INTEGER

    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return left.name.localeCompare(right.name, 'id-ID')
  })
}

function revalidateRolePaths() {
  revalidatePath('/hris')
  revalidatePath('/settings/roles')
  revalidatePath('/settings/users')
}

function isUniqueRoleNameError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

async function getAuthenticatedMembership(orgId: string): Promise<AuthenticatedMembershipResult> {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) {
    return { error: 'Organisasi tidak valid.' }
  }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { error: 'Unauthorized' }
  }

  const membership = await getMembership(userId, trimmedOrgId)
  if (!membership) {
    return { error: 'Akses organisasi ditolak.' }
  }

  return {
    orgId: trimmedOrgId,
    membership,
  }
}

async function loadOrgRoles(orgId: string): Promise<OrgRoleRecord[]> {
  const roles = await prisma.roles.findMany({
    where: { org_id: orgId },
    select: {
      id: true,
      org_id: true,
      name: true,
      permissions: true,
      is_system: true,
      priority: true,
      parent_id: true,
      department_id: true,
      department_ids: true,
    },
  })

  return sortRoles(roles.map((role) => normalizeRole(role)))
}

async function validateParentRole(
  orgId: string,
  parentId?: string | null
) {
  const trimmedParentId = String(parentId || '').trim()
  if (!trimmedParentId) return null

  const parentRole = await prisma.roles.findFirst({
    where: {
      id: trimmedParentId,
      org_id: orgId,
    },
    select: { id: true },
  })

  return parentRole?.id ?? null
}

export async function getResetRequestsCount(orgId: string) {
  const access = await getAuthenticatedMembership(orgId)
  if ('error' in access) return 0

  return prisma.employees.count({
    where: {
      org_id: access.orgId,
      reset_requested: true,
    },
  })
}

export async function getOrgRoles(orgId: string): Promise<OrgRoleListResult> {
  const access = await getAuthenticatedMembership(orgId)
  if ('error' in access) {
    return {
      roles: [],
      error: access.error,
    }
  }

  return {
    roles: await loadOrgRoles(access.orgId),
  }
}

export async function createOrgRole(
  orgId: string,
  payload: {
    name: string
    parentId?: string | null
    departmentIds?: string[]
  }
): Promise<RoleMutationResult> {
  const access = await getAuthenticatedMembership(orgId)
  if ('error' in access) return { error: access.error }
  if (!canManageRoleCatalog(access.membership)) {
    return { error: 'Anda tidak memiliki izin untuk membuat jabatan.' }
  }

  const name = String(payload.name || '').trim()
  if (!name) {
    return { error: 'Nama jabatan wajib diisi.' }
  }

  const validatedParentId = await validateParentRole(access.orgId, payload.parentId)
  if (payload.parentId && !validatedParentId) {
    return { error: 'Jabatan atasan tidak ditemukan.' }
  }

  const departmentIds = normalizeStringArray(payload.departmentIds)
  const priorityAggregate = await prisma.roles.aggregate({
    where: { org_id: access.orgId },
    _max: { priority: true },
  })

  try {
    const role = await prisma.roles.create({
      data: {
        org_id: access.orgId,
        name,
        permissions: [],
        is_system: false,
        priority: (priorityAggregate._max.priority ?? -1) + 1,
        parent_id: validatedParentId,
        department_id: (departmentIds[0] as any) || null,
        department_ids: departmentIds,
      },
      select: {
        id: true,
        org_id: true,
        name: true,
        permissions: true,
        is_system: true,
        priority: true,
        parent_id: true,
        department_id: true,
        department_ids: true,
      },
    })

    revalidateRolePaths()
    return {
      success: true,
      role: normalizeRole(role),
    }
  } catch (error) {
    if (isUniqueRoleNameError(error)) {
      return { error: 'Nama jabatan ini sudah ada di organisasi Anda.' }
    }

    console.error('createOrgRole Error:', error)
    return { error: 'Gagal membuat jabatan.' }
  }
}

export async function updateOrgRole(
  orgId: string,
  roleId: string,
  payload: {
    name: string
    parentId?: string | null
    departmentIds?: string[]
  }
): Promise<RoleMutationResult> {
  const access = await getAuthenticatedMembership(orgId)
  if ('error' in access) return { error: access.error }
  if (!canManageRoleCatalog(access.membership)) {
    return { error: 'Anda tidak memiliki izin untuk mengubah jabatan.' }
  }

  const trimmedRoleId = String(roleId || '').trim()
  const name = String(payload.name || '').trim()
  if (!trimmedRoleId) return { error: 'Jabatan tidak valid.' }
  if (!name) return { error: 'Nama jabatan wajib diisi.' }

  const existingRole = await prisma.roles.findFirst({
    where: {
      id: trimmedRoleId,
      org_id: access.orgId,
    },
    select: {
      id: true,
    },
  })

  if (!existingRole) {
    return { error: 'Jabatan tidak ditemukan.' }
  }

  if (payload.parentId && String(payload.parentId).trim() === trimmedRoleId) {
    return { error: 'Jabatan tidak bisa menjadi atasan bagi dirinya sendiri.' }
  }

  const validatedParentId = await validateParentRole(access.orgId, payload.parentId)
  if (payload.parentId && !validatedParentId) {
    return { error: 'Jabatan atasan tidak ditemukan.' }
  }

  const departmentIds = normalizeStringArray(payload.departmentIds)

  try {
    const role = await prisma.roles.update({
      where: { id: trimmedRoleId },
      data: {
        name,
        parent_id: validatedParentId,
        department_id: (departmentIds[0] as any) || null,
        department_ids: departmentIds,
      },
      select: {
        id: true,
        org_id: true,
        name: true,
        permissions: true,
        is_system: true,
        priority: true,
        parent_id: true,
        department_id: true,
        department_ids: true,
      },
    })

    revalidateRolePaths()
    return {
      success: true,
      role: normalizeRole(role),
    }
  } catch (error) {
    if (isUniqueRoleNameError(error)) {
      return { error: 'Nama jabatan ini sudah ada di organisasi Anda.' }
    }

    console.error('updateOrgRole Error:', error)
    return { error: 'Gagal menyimpan jabatan.' }
  }
}

export async function updateOrgRolePermissions(
  orgId: string,
  roleId: string,
  permissions: string[]
): Promise<RoleMutationResult> {
  const access = await getAuthenticatedMembership(orgId)
  if ('error' in access) return { error: access.error }
  if (!canManageRolePermissions(access.membership)) {
    return { error: 'Anda tidak memiliki izin untuk mengubah hak akses jabatan.' }
  }

  const trimmedRoleId = String(roleId || '').trim()
  if (!trimmedRoleId) return { error: 'Jabatan tidak valid.' }

  const existingRole = await prisma.roles.findFirst({
    where: {
      id: trimmedRoleId,
      org_id: access.orgId,
    },
    select: { id: true },
  })

  if (!existingRole) {
    return { error: 'Jabatan tidak ditemukan.' }
  }

  try {
    const role = await prisma.roles.update({
      where: { id: trimmedRoleId },
      data: {
        permissions: normalizeStringArray(permissions),
      },
      select: {
        id: true,
        org_id: true,
        name: true,
        permissions: true,
        is_system: true,
        priority: true,
        parent_id: true,
        department_id: true,
        department_ids: true,
      },
    })

    revalidateRolePaths()
    return {
      success: true,
      role: normalizeRole(role),
    }
  } catch (error) {
    console.error('updateOrgRolePermissions Error:', error)
    return { error: 'Gagal memperbarui hak akses jabatan.' }
  }
}

export async function reorderOrgRoles(
  orgId: string,
  orderedRoleIds: string[]
): Promise<RoleReorderResult> {
  const access = await getAuthenticatedMembership(orgId)
  if ('error' in access) return { error: access.error }
  if (!canManageRolePermissions(access.membership)) {
    return { error: 'Anda tidak memiliki izin untuk mengubah urutan jabatan.' }
  }

  const uniqueRoleIds = Array.from(
    new Set(
      orderedRoleIds
        .map((roleId) => String(roleId || '').trim())
        .filter(Boolean)
    )
  )

  if (uniqueRoleIds.length === 0) {
    return { error: 'Urutan jabatan tidak valid.' }
  }

  const existingRoles = await prisma.roles.findMany({
    where: {
      org_id: access.orgId,
      id: { in: uniqueRoleIds },
    },
    select: { id: true },
  })

  if (existingRoles.length !== uniqueRoleIds.length) {
    return { error: 'Sebagian jabatan tidak ditemukan.' }
  }

  try {
    await prisma.$transaction(
      uniqueRoleIds.map((roleId, index) =>
        prisma.roles.update({
          where: { id: roleId },
          data: { priority: index },
        })
      )
    )

    revalidateRolePaths()
    return {
      success: true,
      roles: await loadOrgRoles(access.orgId),
    }
  } catch (error) {
    console.error('reorderOrgRoles Error:', error)
    return { error: 'Gagal menyimpan urutan jabatan.' }
  }
}

export async function deleteOrgRole(
  orgId: string,
  roleId: string
): Promise<RoleDeleteResult> {
  const access = await getAuthenticatedMembership(orgId)
  if ('error' in access) return { error: access.error }
  if (!canManageRoleCatalog(access.membership)) {
    return { error: 'Anda tidak memiliki izin untuk menghapus jabatan.' }
  }

  const trimmedRoleId = String(roleId || '').trim()
  if (!trimmedRoleId) return { error: 'Jabatan tidak valid.' }

  const role = await prisma.roles.findFirst({
    where: {
      id: trimmedRoleId,
      org_id: access.orgId,
    },
    select: {
      id: true,
      is_system: true,
    },
  })

  if (!role) {
    return { error: 'Jabatan tidak ditemukan.' }
  }

  if (role.is_system) {
    return { error: 'Role sistem ini tidak dapat dihapus.' }
  }

  const [memberCount, invitationCount] = await Promise.all([
    prisma.org_members.count({
      where: {
        org_id: access.orgId,
        role_id: trimmedRoleId,
      },
    }),
    prisma.org_invitations.count({
      where: {
        org_id: access.orgId,
        role_id: trimmedRoleId,
        is_active: true,
      },
    }),
  ])

  if (memberCount > 0 || invitationCount > 0) {
    return {
      error: 'Jabatan ini masih dipakai oleh anggota atau undangan aktif.',
    }
  }

  try {
    await prisma.roles.delete({
      where: { id: trimmedRoleId },
    })

    revalidateRolePaths()
    return { success: true }
  } catch (error) {
    console.error('deleteOrgRole Error:', error)
    return { error: 'Gagal menghapus jabatan.' }
  }
}
