import { ACTIVE_ORG_COOKIE } from './org-context'
import { prisma } from '@/lib/prisma'

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

async function findMembershipByOrg(userId: string, orgId: string, selectFields: any = null) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return null

  // Assuming selectFields is optional since Prisma returns all fields by default
  // Add include for related tables if standard DEFAULT_ACTIVE_MEMBERSHIP_SELECT is needed 
  const data = await prisma.org_members.findFirst({
    where: { user_id: userId, org_id: trimmedOrgId, is_active: true },
    include: {
      organizations: true,
      roles: {
        select: { permissions: true }
      }
    }
  })

  return data
}

export async function getStoredActiveOrgIdForUser(
  userId: string,
  allowedOrgIds?: string[] | null
) {
  const normalizedOrgIds = Array.isArray(allowedOrgIds)
    ? Array.from(new Set(allowedOrgIds.map((orgId) => String(orgId || '').trim()).filter(Boolean)))
    : null

  const whereClause: any = { user_id: userId, is_active: true }
  if (normalizedOrgIds && normalizedOrgIds.length > 0) {
    whereClause.org_id = { in: normalizedOrgIds }
  }

  try {
    const data = await prisma.org_members.findFirst({
      where: whereClause,
      orderBy: [
        { last_active_at: 'desc' },
        { joined_at: 'asc' }
      ],
      select: { org_id: true }
    })
    return data?.org_id ? String(data.org_id) : null
  } catch (error) {
    console.error('getStoredActiveOrgIdForUser Error:', error)
    return null
  }
}

/**
 * Resolves the active org membership with this priority:
 * 1. demo org cookie, 2. active org cookie, 3. persisted DB preference,
 * 4. oldest active membership as a legacy fallback.
 */
export async function resolveActiveMembership(
  user: ActiveContextUser,
  cookieStore: CookieStoreLike,
  selectFields: any = null
) {
  const isDemoUser = user.email === DEMO_EMAIL || user.user_metadata?.is_demo
  const demoOrgId = cookieStore.get('nizam_demo_org_id')?.value
  const activeOrgIdCookie = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

  let memberData = null

  if (isDemoUser && demoOrgId) {
    memberData = await findMembershipByOrg(user.id, demoOrgId, selectFields)
  }

  if (!memberData && activeOrgIdCookie) {
    memberData = await findMembershipByOrg(user.id, activeOrgIdCookie, selectFields)
  }

  if (!memberData) {
    const storedOrgId = await getStoredActiveOrgIdForUser(user.id)
    if (storedOrgId) {
      memberData = await findMembershipByOrg(user.id, storedOrgId, selectFields)
    }
  }

  if (!memberData) {
    try {
      memberData = await prisma.org_members.findFirst({
        where: { user_id: user.id, is_active: true },
        orderBy: { joined_at: 'asc' },
        include: {
          organizations: true,
          roles: { select: { permissions: true } }
        }
      })
    } catch (error) {
      console.error('resolveActiveMembership Error:', error)
    }
  }

  return memberData
}

/**
 * Stores the active org/unit context in the membership row so it survives
 * logout and works across devices, while cookies remain a short-term cache.
 */
export async function persistMembershipActiveContext(
  input: PersistMembershipActiveContextInput
) {
  const trimmedUserId = String(input.userId || '').trim()
  const trimmedOrgId = String(input.orgId || '').trim()

  if (!trimmedUserId || !trimmedOrgId) {
    return { error: 'Identitas konteks aktif tidak valid.' }
  }

  const normalizedBranchId = input.branchId ? String(input.branchId).trim() || null : null

  try {
    await prisma.org_members.updateMany({
      where: { user_id: trimmedUserId, org_id: trimmedOrgId, is_active: true },
      data: {
        last_active_at: new Date(),
        last_active_branch_id: normalizedBranchId
      }
    })
    return { success: true as const }
  } catch (error) {
    console.error('persistMembershipActiveContext Error:', error)
    return { error: 'Gagal menyimpan konteks aktif.' }
  }
}
