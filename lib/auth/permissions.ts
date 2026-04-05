'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

/**
 * Application-level authorization layer.
 * Replaces Supabase RLS policies with explicit permission checks.
 * 
 * This module provides:
 * 1. Session-based user identification (via NextAuth)
 * 2. Organization membership verification
 * 3. Role-based permission checking
 * 4. Branch-scoped access control
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type AuthContext = {
  userId: string
  email: string | null
  name: string | null
}

export type MembershipContext = {
  memberId: string
  userId: string
  orgId: string
  role: string
  roleId: string | null
  permissions: string[]
  isOwner: boolean
  isAdmin: boolean
  isOwnerOrAdmin: boolean
}

// ─────────────────────────────────────────────────────────────
// Core: Get authenticated user
// ─────────────────────────────────────────────────────────────

export async function getAuthUser(): Promise<AuthContext | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  }
}

// ─────────────────────────────────────────────────────────────
// Core: Get membership for a user in an organization
// ─────────────────────────────────────────────────────────────

export async function getMembership(
  userId: string,
  orgId: string
): Promise<MembershipContext | null> {
  const membership = await prisma.org_members.findFirst({
    where: {
      user_id: userId,
      org_id: orgId,
      is_active: true,
    },
    include: {
      roles: {
        select: {
          permissions: true,
        },
      },
    },
  })

  if (!membership) return null

  const role = membership.role || 'staff'
  const permissions = Array.isArray((membership.roles as any)?.permissions)
    ? (membership.roles as any).permissions
    : []

  return {
    memberId: membership.id,
    userId: membership.user_id,
    orgId: membership.org_id,
    role,
    roleId: membership.role_id,
    permissions,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isOwnerOrAdmin: role === 'owner' || role === 'admin',
  }
}

// ─────────────────────────────────────────────────────────────
// Permission Check: Does user have specific permission?
// ─────────────────────────────────────────────────────────────

export async function checkPermission(
  userId: string,
  orgId: string,
  requiredPermissionKeys: string[]
): Promise<boolean> {
  const membership = await getMembership(userId, orgId)
  if (!membership) return false

  // Owner and Admin always have full access
  if (membership.isOwnerOrAdmin) return true

  // Check if any of the user's permissions match any of the required keys
  const normalizedUserPermissions = membership.permissions
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.toLowerCase())

  return normalizedUserPermissions.some((userPerm) =>
    requiredPermissionKeys.some((requiredKey) =>
      userPerm.includes(requiredKey.toLowerCase())
    )
  )
}

// ─────────────────────────────────────────────────────────────
// Guard: Require authenticated user (throws redirect)
// ─────────────────────────────────────────────────────────────

export async function requireAuth(): Promise<AuthContext> {
  const user = await getAuthUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

// ─────────────────────────────────────────────────────────────
// Guard: Require org membership (throws redirect)
// ─────────────────────────────────────────────────────────────

export async function requireMembership(
  userId: string,
  orgId: string
): Promise<MembershipContext> {
  const membership = await getMembership(userId, orgId)
  if (!membership) {
    throw new Error('NO_ORG_ACCESS')
  }
  return membership
}

// ─────────────────────────────────────────────────────────────
// Guard: Require specific permission
// ─────────────────────────────────────────────────────────────

export async function requirePermission(
  userId: string,
  orgId: string,
  requiredPermissionKeys: string[]
): Promise<MembershipContext> {
  const membership = await requireMembership(userId, orgId)

  if (!membership.isOwnerOrAdmin) {
    const normalizedUserPermissions = membership.permissions
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.toLowerCase())

    const hasPermission = normalizedUserPermissions.some((userPerm) =>
      requiredPermissionKeys.some((requiredKey) =>
        userPerm.includes(requiredKey.toLowerCase())
      )
    )

    if (!hasPermission) {
      throw new Error('INSUFFICIENT_PERMISSION')
    }
  }

  return membership
}

// ─────────────────────────────────────────────────────────────
// Branch Scope: Check if user can access a specific branch
// ─────────────────────────────────────────────────────────────

export async function canAccessBranch(
  userId: string,
  orgId: string,
  branchId: string
): Promise<boolean> {
  const membership = await getMembership(userId, orgId)
  if (!membership) return false

  // Owner/Admin can access all branches
  if (membership.isOwnerOrAdmin) return true

  // Check unit assignments
  const unitAssignment = await prisma.org_member_units.findFirst({
    where: {
      org_member_id: membership.memberId,
      org_id: orgId,
      branch_id: branchId,
    },
  })

  return !!unitAssignment
}
