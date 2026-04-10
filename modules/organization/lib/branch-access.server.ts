import { cookies } from 'next/headers'
import { cache } from 'react'
import { getServerAuthContext } from '@/lib/supabase/auth.server'
import { createAdminClient } from '@/lib/supabase/server'
import { isInternalAuthProvider } from '@/lib/auth/provider'
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

async function fetchActiveBranches(admin: any, orgId: string): Promise<BranchSummary[] | null> {
  const { data: activeBranches, error } = await admin
    .from('branches')
    .select('id, org_id, name, code, address, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error || !Array.isArray(activeBranches)) {
    return null
  }

  return normalizeBranchRows(activeBranches)
}

async function ensureUsableBranchesForPrivilegedMember(admin: any, orgId: string): Promise<BranchSummary[]> {
  const { data: earliestBranch, error: earliestBranchError } = await admin
    .from('branches')
    .select('id, org_id, name, code, address, is_active')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!earliestBranchError && earliestBranch?.id) {
    if (earliestBranch.is_active) {
      return normalizeBranchRows([earliestBranch])
    }

    const { data: activatedBranch, error: activateError } = await admin
      .from('branches')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', earliestBranch.id)
      .eq('org_id', orgId)
      .select('id, org_id, name, code, address, is_active')
      .single()

    if (!activateError && activatedBranch?.id) {
      return normalizeBranchRows([activatedBranch])
    }
  }

  const { data: insertedBranch, error: insertError } = await admin
    .from('branches')
    .insert({
      org_id: orgId,
      name: DEFAULT_BRANCH_NAME,
      code: DEFAULT_BRANCH_CODE,
      address: null,
      is_active: true,
    })
    .select('id, org_id, name, code, address, is_active')
    .single()

  if (insertError || !insertedBranch?.id) {
    return []
  }

  return normalizeBranchRows([insertedBranch])
}

const getBranchAccessScopeCached = cache(async (orgId: string): Promise<BranchAccessScope> => {
  const trimmedOrgId = orgId.trim()
  if (!trimmedOrgId) return emptyScope()

  const { supabase, user } = await getServerAuthContext()
  const adminClient = await createAdminClient()
  const admin = adminClient as any
  const db = isInternalAuthProvider() ? admin : (supabase as any)

  if (!user) return emptyScope()

  const { data: membership } = await db
    .from('org_members')
    .select('id, role, last_active_at, last_active_branch_id')
    .eq('org_id', trimmedOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.id) return emptyScope()

  const role = String(membership.role || 'staff')

  let normalizedBranches = await fetchActiveBranches(admin, trimmedOrgId)

  if ((!normalizedBranches || normalizedBranches.length === 0) && FULL_BRANCH_ACCESS_ROLES.has(role)) {
    normalizedBranches = await ensureUsableBranchesForPrivilegedMember(admin, trimmedOrgId)
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

  const { data: assignments, error: assignmentsError } = await admin
    .from('org_member_units')
    .select('branch_id')
    .eq('org_id', trimmedOrgId)
    .eq('org_member_id', membership.id)

  if (assignmentsError || !Array.isArray(assignments)) {
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

  const assignedBranchIds = new Set(
    assignments
      .map((assignment) => String(assignment.branch_id || '').trim())
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
})

export async function getBranchAccessScope(orgId: string): Promise<BranchAccessScope> {
  // Cache org/branch scope for the current request to avoid repeating the
  // same auth + membership + branch queries across multiple page loaders.
  return getBranchAccessScopeCached(orgId)
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
