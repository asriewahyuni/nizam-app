'use server'

import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { getCurrentAccessibleBranch } from '@/modules/organization/lib/branch-access.server'
import { resolveActiveMembership } from '@/modules/organization/lib/active-context.server'

/**
 * Server action: returns the active org_id for the current user.
 * Mirrors getActiveOrg() logic exactly, including demo cookie handling.
 * Used by useActiveOrgId() client hook to ensure client-server consistency.
 */
export async function getActiveOrgIdAction(): Promise<string | null> {
  const session = await auth()
  const user = session?.user
  if (!user?.id) return null

  const cookieStore = await cookies()
  const membership = await resolveActiveMembership(
    {
      id: user.id,
      email: user.email ?? null,
      user_metadata: {
        full_name: user.name ?? null,
      },
    },
    cookieStore,
    'org_id'
  )
  return membership?.org_id ? String(membership.org_id) : null
}

/**
 * Server action: returns the verified active branch_id for the provided org.
 * Returns null when "Semua Unit" is selected or when the cookie no longer matches
 * an active branch in the current organization.
 */
export async function getActiveBranchIdAction(orgId: string): Promise<string | null> {
  const trimmedOrgId = orgId.trim()
  if (!trimmedOrgId) return null

  const activeBranch = await getCurrentAccessibleBranch(trimmedOrgId)
  return activeBranch?.id ?? null
}
