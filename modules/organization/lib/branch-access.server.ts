import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ACTIVE_BRANCH_COOKIE, type BranchSummary } from './org-context'

const FULL_BRANCH_ACCESS_ROLES = new Set(['owner', 'admin'])
const DEFAULT_BRANCH_NAME = 'Unit Utama'
const DEFAULT_BRANCH_CODE = 'MAIN'

export type BranchAccessScope = {
  membershipId: string | null
  role: string | null
  accessibleBranches: BranchSummary[]
  accessibleBranchIds: string[]
  canAccessAllBranches: boolean
  hasPersistedSelection: boolean
  storedBranchId: string | null
}

export type ResolvedBranchSelection =
  | {
      scope: BranchAccessScope
      branchId: string | null
      error?: undefined
    }
  | {
      scope: BranchAccessScope
      branchId?: undefined
      error: string
    }

function emptyScope(): BranchAccessScope {
  return {
    membershipId: null,
    role: null,
    accessibleBranches: [],
    accessibleBranchIds: [],
    canAccessAllBranches: false,
    hasPersistedSelection: false,
    storedBranchId: null,
  }
}

function normalizeBranchRows(rows: any[]): BranchSummary[] {
  return rows.map((branch) => ({
    id: String(branch.id),
    org_id: String(branch.org_id),
    name: String(branch.name),
    code: String(branch.code),
    address: branch.address ? String(branch.address) : null,
    is_active: Boolean(branch.is_active),
  }))
}

function pickDefaultBranch(scope: BranchAccessScope): BranchSummary | null {
  if (scope.accessibleBranches.length === 1) {
    return scope.accessibleBranches[0] ?? null
  }

  if (!scope.canAccessAllBranches) {
    return scope.accessibleBranches[0] ?? null
  }

  return null
}

function pickBranchFromCookie(scope: BranchAccessScope, branchIdFromCookie?: string | null) {
  const trimmedBranchId = String(branchIdFromCookie || '').trim()
  if (!trimmedBranchId) return null
  if (!scope.accessibleBranchIds.includes(trimmedBranchId)) return null
  return scope.accessibleBranches.find((branch) => branch.id === trimmedBranchId) ?? null
}

function pickPersistedBranch(scope: BranchAccessScope): BranchSummary | null | undefined {
  if (!scope.hasPersistedSelection) return undefined

  if (scope.storedBranchId) {
    return pickBranchFromCookie(scope, scope.storedBranchId) ?? undefined
  }

  if (scope.canAccessAllBranches && scope.accessibleBranches.length > 1) {
    return null
  }

  return undefined
}

async function fetchActiveBranches(orgId: string): Promise<BranchSummary[] | null> {
  try {
    const activeBranches = await prisma.branches.findMany({
      where: { org_id: orgId, is_active: true },
      select: { id: true, org_id: true, name: true, code: true, address: true, is_active: true },
      orderBy: { name: 'asc' },
    })
    return normalizeBranchRows(activeBranches)
  } catch {
    return null
  }
}

async function ensureUsableBranchesForPrivilegedMember(orgId: string): Promise<BranchSummary[]> {
  // Try to find the earliest branch (active or not)
  const earliestBranch = await prisma.branches.findFirst({
    where: { org_id: orgId },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
  })

  if (earliestBranch?.id) {
    if (earliestBranch.is_active) {
      return normalizeBranchRows([earliestBranch])
    }

    // Reactivate the earliest branch
    try {
      const activated = await prisma.branches.update({
        where: { id: earliestBranch.id },
        data: { is_active: true },
      })
      return normalizeBranchRows([activated])
    } catch {
      // fall through to create new
    }
  }

  // No branches exist — create the default unit
  try {
    const inserted = await prisma.branches.create({
      data: {
        org_id: orgId,
        name: DEFAULT_BRANCH_NAME,
        code: DEFAULT_BRANCH_CODE,
        address: null,
        is_active: true,
      },
    })
    return normalizeBranchRows([inserted])
  } catch {
    return []
  }
}

export async function getBranchAccessScope(orgId: string): Promise<BranchAccessScope> {
  const trimmedOrgId = orgId.trim()
  if (!trimmedOrgId) return emptyScope()

  const session = await auth()
  if (!session?.user?.id) return emptyScope()

  const userId = session.user.id

  const membership = await prisma.org_members.findFirst({
    where: { org_id: trimmedOrgId, user_id: userId, is_active: true },
    select: { id: true, role: true, last_active_at: true, last_active_branch_id: true },
  })

  if (!membership?.id) return emptyScope()

  const role = String(membership.role || 'staff')

  let normalizedBranches = await fetchActiveBranches(trimmedOrgId)

  if ((!normalizedBranches || normalizedBranches.length === 0) && FULL_BRANCH_ACCESS_ROLES.has(role)) {
    normalizedBranches = await ensureUsableBranchesForPrivilegedMember(trimmedOrgId)
  }

  if (!normalizedBranches || normalizedBranches.length === 0) {
    return {
      membershipId: String(membership.id),
      role,
      accessibleBranches: [],
      accessibleBranchIds: [],
      canAccessAllBranches: false,
      hasPersistedSelection: Boolean(membership.last_active_at),
      storedBranchId: membership.last_active_branch_id ? String(membership.last_active_branch_id) : null,
    }
  }

  if (FULL_BRANCH_ACCESS_ROLES.has(role)) {
    return {
      membershipId: String(membership.id),
      role,
      accessibleBranches: normalizedBranches,
      accessibleBranchIds: normalizedBranches.map((branch) => branch.id),
      canAccessAllBranches: true,
      hasPersistedSelection: Boolean(membership.last_active_at),
      storedBranchId: membership.last_active_branch_id ? String(membership.last_active_branch_id) : null,
    }
  }

  // Staff: fetch only explicitly assigned branches
  const assignments = await prisma.org_member_units.findMany({
    where: { org_id: trimmedOrgId, org_member_id: membership.id },
    select: { branch_id: true },
  })

  const assignedBranchIds = new Set(
    assignments
      .map((a) => String(a.branch_id || '').trim())
      .filter(Boolean)
  )
  const accessibleBranches = normalizedBranches.filter((branch) => assignedBranchIds.has(branch.id))

  return {
    membershipId: String(membership.id),
    role,
    accessibleBranches,
    accessibleBranchIds: accessibleBranches.map((branch) => branch.id),
    canAccessAllBranches:
      accessibleBranches.length > 0 && accessibleBranches.length === normalizedBranches.length,
    hasPersistedSelection: Boolean(membership.last_active_at),
    storedBranchId: membership.last_active_branch_id ? String(membership.last_active_branch_id) : null,
  }
}

export async function getCurrentAccessibleBranch(orgId: string): Promise<BranchSummary | null> {
  const scope = await getBranchAccessScope(orgId)
  if (scope.accessibleBranches.length === 0) return null

  const cookieStore = await cookies()
  const activeBranch = pickBranchFromCookie(scope, cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value)
  if (activeBranch) return activeBranch

  const persistedBranch = pickPersistedBranch(scope)
  if (persistedBranch !== undefined) return persistedBranch

  return pickDefaultBranch(scope)
}

export async function canAccessAllBranchesForOrg(orgId: string): Promise<boolean> {
  const scope = await getBranchAccessScope(orgId)
  return scope.canAccessAllBranches
}

export async function isAccessibleBranch(orgId: string, branchId: string): Promise<boolean> {
  const trimmedBranchId = branchId.trim()
  if (!trimmedBranchId) return false

  const scope = await getBranchAccessScope(orgId)
  return scope.accessibleBranchIds.includes(trimmedBranchId)
}

export async function resolveAccessibleBranchSelection(
  orgId: string,
  branchId?: string | null
): Promise<ResolvedBranchSelection> {
  const scope = await getBranchAccessScope(orgId)

  if (!scope.role) {
    return { scope, error: 'Akses organisasi tidak ditemukan.' }
  }

  if (scope.accessibleBranches.length === 0) {
    return { scope, error: 'Anda belum memiliki akses ke unit mana pun pada organisasi ini.' }
  }

  if (branchId !== undefined) {
    if (branchId === null) {
      if (!scope.canAccessAllBranches) {
        return { scope, error: 'Anda tidak memiliki akses ke semua unit pada organisasi ini.' }
      }
      return { scope, branchId: null }
    }

    const trimmedBranchId = branchId.trim()
    if (!trimmedBranchId) {
      return { scope, error: 'Unit tidak valid.' }
    }

    if (!scope.accessibleBranchIds.includes(trimmedBranchId)) {
      return { scope, error: 'Anda tidak memiliki akses ke unit tersebut.' }
    }

    return { scope, branchId: trimmedBranchId }
  }

  const cookieStore = await cookies()
  const activeBranch = pickBranchFromCookie(scope, cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value)
  if (activeBranch) {
    return { scope, branchId: activeBranch.id }
  }

  const persistedBranch = pickPersistedBranch(scope)
  if (persistedBranch === null) {
    return { scope, branchId: null }
  }
  if (persistedBranch) {
    return { scope, branchId: persistedBranch.id }
  }

  const defaultBranch = pickDefaultBranch(scope)
  if (defaultBranch) {
    return { scope, branchId: defaultBranch.id }
  }

  if (scope.canAccessAllBranches) {
    return { scope, branchId: null }
  }

  return { scope, branchId: scope.accessibleBranches[0]?.id ?? null }
}
