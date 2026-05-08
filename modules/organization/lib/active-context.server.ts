import { ACTIVE_ORG_COOKIE } from './org-context'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'

const DEMO_EMAIL = 'demo@nizam.app'
const DEFAULT_ACTIVE_MEMBERSHIP_SELECT =
  'org_id, role, role_id, joined_at, last_active_at, last_active_branch_id, organizations(*), roles(permissions)'

type ActiveContextUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, any> | null
}

type CookieStoreLike = {
  get(name: string): { value: string } | undefined
}

type PersistMembershipActiveContextInput = {
  userId: string
  orgId: string
  branchId: string | null
}

type MembershipPreferenceRow = {
  org_id: string | null
}

type OrganizationParentRow = {
  id: string | null
  parent_org_id: string | null
}

async function findMembershipByOrg(db: any, userId: string, orgId: string, select: string) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return null

  const { data } = await db
    .from('org_members')
    .select(select)
    .eq('user_id', userId)
    .eq('org_id', trimmedOrgId)
    .eq('is_active', true)
    .maybeSingle()

  return data
}

export async function resolvePlatformAdminParentOrgId(
  db: any,
  userId: string,
  preferredOrgId?: string | null
) {
  const trimmedUserId = String(userId || '').trim()
  if (!trimmedUserId) return null

  const normalizedPreferredOrgId = String(preferredOrgId || '').trim() || null
  const { data: membershipRows, error: membershipsError } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', trimmedUserId)
    .eq('is_active', true)
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .order('joined_at', { ascending: true })
    .order('org_id', { ascending: true })

  if (membershipsError) {
    console.error('resolvePlatformAdminParentOrgId memberships Error:', membershipsError)
    return null
  }

  const membershipOrgIds = Array.from(
    new Set(
      (Array.isArray(membershipRows) ? (membershipRows as MembershipPreferenceRow[]) : [])
        .map((membership) => String(membership?.org_id || '').trim())
        .filter(Boolean)
    )
  )

  if (membershipOrgIds.length === 0) {
    return null
  }

  const { data: orgRows, error: organizationsError } = await db
    .from('organizations')
    .select('id, parent_org_id')
    .in('id', membershipOrgIds)

  if (organizationsError) {
    console.error('resolvePlatformAdminParentOrgId organizations Error:', organizationsError)
    return null
  }

  const parentOrgIds = new Set(
    (Array.isArray(orgRows) ? (orgRows as OrganizationParentRow[]) : [])
      .filter((org) => !String(org?.parent_org_id || '').trim())
      .map((org) => String(org?.id || '').trim())
      .filter(Boolean)
  )

  if (parentOrgIds.size === 0) {
    return null
  }

  if (normalizedPreferredOrgId && parentOrgIds.has(normalizedPreferredOrgId)) {
    return normalizedPreferredOrgId
  }

  return membershipOrgIds.find((orgId) => parentOrgIds.has(orgId)) || null
}

export async function getStoredActiveOrgIdForUser(
  db: any,
  userId: string,
  allowedOrgIds?: string[] | null
) {
  const normalizedOrgIds = Array.isArray(allowedOrgIds)
    ? Array.from(
        new Set(
          allowedOrgIds
            .map((orgId) => String(orgId || '').trim())
            .filter(Boolean)
        )
      )
    : null

  let query = db
    .from('org_members')
    .select('org_id, last_active_at, joined_at')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (normalizedOrgIds && normalizedOrgIds.length > 0) {
    query = query.in('org_id', normalizedOrgIds)
  }

  const { data, error } = await query
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('getStoredActiveOrgIdForUser Error:', error)
    return null
  }

  return data?.org_id ? String(data.org_id) : null
}

/**
 * Resolves the active org membership with this priority:
 * 1. demo org cookie, 2. explicit active org cookie,
 * 3. parent org default for platform admin,
 * 4. persisted DB preference, 5. oldest active membership.
 */
export async function resolveActiveMembership(
  db: any,
  user: ActiveContextUser,
  cookieStore: CookieStoreLike,
  select: string = DEFAULT_ACTIVE_MEMBERSHIP_SELECT
) {
  const isDemoUser = user.email === DEMO_EMAIL || user.user_metadata?.is_demo
  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const demoOrgId = cookieStore.get('nizam_demo_org_id')?.value
  const activeOrgIdCookie = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

  let memberData = null

  if (isDemoUser && demoOrgId) {
    memberData = await findMembershipByOrg(db, user.id, demoOrgId, select)
  }

  if (!memberData && activeOrgIdCookie) {
    memberData = await findMembershipByOrg(db, user.id, activeOrgIdCookie, select)
  }

  if (!memberData && isPlatformAdmin) {
    const parentOrgId = await resolvePlatformAdminParentOrgId(db, user.id, activeOrgIdCookie)
    if (parentOrgId) {
      memberData = await findMembershipByOrg(db, user.id, parentOrgId, select)
    }
  }

  if (!memberData) {
    const storedOrgId = await getStoredActiveOrgIdForUser(db, user.id)
    if (storedOrgId) {
      memberData = await findMembershipByOrg(db, user.id, storedOrgId, select)
    }
  }

  if (!memberData) {
    const { data, error } = await db
      .from('org_members')
      .select(select)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('resolveActiveMembership Error:', error)
    }
    memberData = data
  }

  return memberData
}

/**
 * Stores the active org/unit context in the membership row so it survives
 * logout and works across devices, while cookies remain a short-term cache.
 */
export async function persistMembershipActiveContext(
  admin: any,
  input: PersistMembershipActiveContextInput
) {
  const trimmedUserId = String(input.userId || '').trim()
  const trimmedOrgId = String(input.orgId || '').trim()

  if (!trimmedUserId || !trimmedOrgId) {
    return { error: 'Identitas konteks aktif tidak valid.' }
  }

  const normalizedBranchId = input.branchId ? String(input.branchId).trim() || null : null
  const { error } = await admin
    .from('org_members')
    .update({
      last_active_at: new Date().toISOString(),
      last_active_branch_id: normalizedBranchId,
    })
    .eq('user_id', trimmedUserId)
    .eq('org_id', trimmedOrgId)
    .eq('is_active', true)

  if (error) {
    console.error('persistMembershipActiveContext Error:', error)
    return { error: 'Gagal menyimpan konteks aktif.' }
  }

  return { success: true as const }
}
