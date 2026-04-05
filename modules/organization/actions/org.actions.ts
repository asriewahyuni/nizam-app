'use server'

import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { normalizeSaasEntitlementName } from '@/lib/saas/module-catalog'
import { generateSlug } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import {
  getMembership,
  type MembershipContext,
} from '@/lib/auth/permissions'
import {
  seedDemoOrganization,
  type DemoBusinessType,
} from '@/modules/demo/actions/demo.actions'
import {
  ACTIVE_BRANCH_COOKIE,
  ACTIVE_ORG_COOKIE,
  type AccessibleOrganization,
} from '@/modules/organization/lib/org-context'
import {
  persistMembershipActiveContext,
  resolveActiveMembership,
} from '@/modules/organization/lib/active-context.server'
import {
  canAccessAllBranchesForOrg,
  getBranchAccessScope,
  getCurrentAccessibleBranch,
} from '@/modules/organization/lib/branch-access.server'
import { uploadOrganizationLogoAsset } from '@/modules/organization/lib/logo-storage.server'
import { applyVoucher } from './billing.actions'

const ACTIVE_CONTEXT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const DEFAULT_BRANCH_NAME = 'Unit Utama'
const DEFAULT_BRANCH_CODE = 'MAIN'

type AuthenticatedUser = {
  id: string
  email?: string
  name?: string
}

type ActiveOrganization = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  settings: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
  enabled_modules: string[]
  is_demo: boolean | null
  subscription_end: string | null
  parent_org_id: string | null
  active_addons: unknown[]
  owner_email: string | null
}

type CreateBranchSuccess = {
  success: true
  branch: {
    id: string
    org_id: string
    name: string
    code: string
    address: string | null
    is_active: boolean
  }
  branchId: string
}

type ActionError = {
  error: string
}

function getActiveContextCookieOptions() {
  return {
    maxAge: ACTIVE_CONTEXT_COOKIE_MAX_AGE,
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

function resolvePersistedBranchIdForOrgSwitch(
  branchAccessScope: Awaited<ReturnType<typeof getBranchAccessScope>>
) {
  if (branchAccessScope.accessibleBranches.length === 1) {
    return branchAccessScope.accessibleBranches[0]?.id ?? null
  }

  if (!branchAccessScope.canAccessAllBranches) {
    return branchAccessScope.accessibleBranches[0]?.id ?? null
  }

  return null
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    try {
      return normalizeStringArray(JSON.parse(value))
    } catch {
      const normalized = value.trim()
      return normalized ? [normalized] : []
    }
  }

  return []
}

function normalizeActiveAddonModules(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((entry) => {
      if (typeof entry === 'string') {
        return normalizeSaasEntitlementName(entry)
      }

      if (entry && typeof entry === 'object' && 'name' in entry) {
        return normalizeSaasEntitlementName(String(entry.name || ''))
      }

      return []
    })
    .map((item) => String(item || '').trim())
    .filter(Boolean)
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

function isUniqueConstraintError(
  error: unknown,
  targetFields?: string[]
): error is Prisma.PrismaClientKnownRequestError {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false
  }

  if (error.code !== 'P2002') return false
  if (!targetFields || targetFields.length === 0) return true

  const target = Array.isArray(error.meta?.target) ? error.meta?.target : []
  return targetFields.some((field) => target.includes(field))
}

function normalizeOrganization(org: {
  id: string
  name: string
  slug: string
  logo_url: string | null
  settings: unknown
  is_active: boolean
  created_at: Date
  updated_at: Date
  enabled_modules: string[]
  is_demo: boolean | null
  subscription_end: Date | null
  parent_org_id: string | null
  active_addons: unknown
  owner_email: string | null
}): ActiveOrganization {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo_url: org.logo_url ?? null,
    settings:
      org.settings &&
      typeof org.settings === 'object' &&
      !Array.isArray(org.settings)
        ? (org.settings as Record<string, any>)
        : {},
    is_active: Boolean(org.is_active),
    created_at: org.created_at.toISOString(),
    updated_at: org.updated_at.toISOString(),
    enabled_modules: Array.isArray(org.enabled_modules)
      ? org.enabled_modules.map((item) => String(item))
      : [],
    is_demo: org.is_demo ?? null,
    subscription_end: org.subscription_end
      ? org.subscription_end.toISOString()
      : null,
    parent_org_id: org.parent_org_id ?? null,
    active_addons: Array.isArray(org.active_addons) ? org.active_addons : [],
    owner_email: org.owner_email ?? null,
  }
}

async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await auth()
  const user = session?.user

  if (!user?.id) return null
  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  }
}

async function getOrgMembership(userId: string, orgId: string) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return null
  return getMembership(userId, trimmedOrgId)
}

type CreateOrganizationSuccess = {
  success: true
  orgId: string
  branchId: string
}

type CreateOrganizationFailure = {
  error: string
}

type CreateOrganizationActionResult =
  | CreateOrganizationSuccess
  | CreateOrganizationFailure

async function createOrganizationRecord(
  formData: FormData
): Promise<CreateOrganizationActionResult> {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const cookieStore = await cookies()
  const name = String(formData.get('name') || '').trim()
  if (!name) return { error: 'Nama organisasi wajib diisi' }

  const slug = generateSlug(name)
  const orgId = crypto.randomUUID()
  const defaultBranchId = crypto.randomUUID()
  const ownerEmail = user.email?.trim().toLowerCase() || null
  const planParam = String(formData.get('plan') || '').trim().toLowerCase()
  const businessType = (formData.get('type') || 'BLANK') as DemoBusinessType
  const isDemo = planParam === 'demo'
  const isAbs = planParam === 'abs'

  try {
    await prisma.$transaction(async (tx) => {
      await tx.organizations.create({
        data: {
          id: orgId,
          name,
          slug,
          owner_email: ownerEmail,
          is_demo: isDemo,
          settings: {
            currency: 'IDR',
            timezone: 'Asia/Jakarta',
            fiscal_year_start_month: 1,
            plan: isDemo ? 'Demo' : 'Trial',
            is_demo: isDemo,
            business_type: businessType,
          },
        },
      })

      await tx.org_members.create({
        data: {
          org_id: orgId,
          user_id: user.id,
          role: 'owner',
          is_active: true,
        },
      })

      await tx.branches.create({
        data: {
          id: defaultBranchId,
          org_id: orgId,
          name: DEFAULT_BRANCH_NAME,
          code: DEFAULT_BRANCH_CODE,
          address: null,
          is_active: true,
        },
      })
    })
  } catch (error) {
    if (isUniqueConstraintError(error, ['slug'])) {
      return { error: 'Nama organisasi ini sudah digunakan.' }
    }

    console.error('createOrganizationRecord Error:', error)
    return { error: 'Gagal membuat organisasi.' }
  }

  await persistMembershipActiveContext({
    userId: user.id,
    orgId,
    branchId: defaultBranchId,
  })

  if (isDemo) {
    try {
      await seedDemoOrganization(orgId, businessType)
    } catch (seedError) {
      console.error('Seed Data Error:', seedError)
    }
  }

  if (isAbs) {
    try {
      await applyVoucher(orgId, 'ABS2024')
    } catch (absError) {
      console.error('ABS Activation Error:', absError)
    }
  }

  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, getActiveContextCookieOptions())
  cookieStore.set(
    ACTIVE_BRANCH_COOKIE,
    defaultBranchId,
    getActiveContextCookieOptions()
  )

  return {
    success: true,
    orgId,
    branchId: defaultBranchId,
  }
}

export async function createOrganization(formData: FormData) {
  const result = await createOrganizationRecord(formData)
  if ('error' in result) return result

  revalidatePath('/dashboard')
  return redirect('/dashboard')
}

export async function createOrganizationQuick(formData: FormData) {
  const result = await createOrganizationRecord(formData)
  if ('error' in result) return result

  revalidatePath('/', 'layout')
  revalidatePath('/dashboard')
  return result
}

export async function getActiveOrg() {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const cookieStore = await cookies()
  const memberData = await resolveActiveMembership(
    {
      id: user.id,
      email: user.email ?? null,
      user_metadata: {
        full_name: user.name ?? null,
      },
    },
    cookieStore
  )

  if (!memberData) return null

  const activeOrgId = memberData.org_id
  const organization = memberData.organizations
  const org = organization ? normalizeOrganization(organization) : null
  if (!org || typeof org !== 'object') {
    console.error('GetActiveOrg: membership found without organization payload', {
      userId: user.id,
      orgId: activeOrgId,
    })
    return null
  }

  const settings =
    org.settings && typeof org.settings === 'object'
      ? (org.settings as Record<string, unknown>)
      : {}
  const planName =
    typeof settings.plan === 'string' ? settings.plan.trim() : ''

  let enabledModules: string[] = []

  if (planName) {
    const pkgData = await prisma.saas_packages.findFirst({
      where: {
        name: planName,
        is_active: true,
      },
      select: {
        modules: true,
      },
    })

    enabledModules = normalizeStringArray(pkgData?.modules)
  }

  enabledModules = Array.from(
    new Set([
      ...enabledModules,
      ...normalizeActiveAddonModules(org.active_addons),
    ])
  )

  const employee = await prisma.employees.findFirst({
    where: {
      org_id: activeOrgId,
      user_id: user.id,
    },
    select: {
      job_title: true,
    },
  })

  return {
    org,
    role: memberData.role as string,
    roleId: memberData.role_id,
    jobTitle: employee?.job_title || memberData.role,
    permissions: Array.isArray(memberData.roles?.permissions)
      ? memberData.roles.permissions
      : [],
    enabledModules,
    user: {
      id: user.id,
      email: user.email,
      user_metadata: {
        full_name: user.name,
      },
    },
  }
}

export async function getMyOrganizations(): Promise<AccessibleOrganization[]> {
  const user = await getAuthenticatedUser()
  if (!user) return []

  try {
    const memberships = await prisma.org_members.findMany({
      where: {
        user_id: user.id,
        is_active: true,
      },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo_url: true,
            settings: true,
            is_active: true,
          },
        },
      },
      orderBy: {
        joined_at: 'asc',
      },
    })

    const results: AccessibleOrganization[] = []

    for (const membership of memberships) {
      const org = membership.organizations
      if (!org) continue

      results.push({
        orgId: membership.org_id,
        role: String(membership.role || 'staff'),
        roleId: membership.role_id || null,
        joinedAt: membership.joined_at.toISOString(),
        org: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo_url: org.logo_url ?? null,
          settings:
            org.settings &&
            typeof org.settings === 'object' &&
            !Array.isArray(org.settings)
              ? (org.settings as Record<string, any>)
              : {},
          is_active: Boolean(org.is_active),
        },
      })
    }

    return results
  } catch (error) {
    console.error('getMyOrganizations Error:', error)
    return []
  }
}

export async function setActiveOrg(orgId: string) {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const cookieStore = await cookies()
  const trimmedOrgId = String(orgId || '').trim()

  if (!trimmedOrgId) {
    return { error: 'Organisasi tidak valid.' }
  }

  const membership = await prisma.org_members.findFirst({
    where: {
      user_id: user.id,
      org_id: trimmedOrgId,
      is_active: true,
    },
    select: {
      org_id: true,
    },
  })

  if (!membership) {
    return { error: 'Anda tidak memiliki akses ke organisasi tersebut.' }
  }

  cookieStore.delete('nizam_demo_org_id')
  cookieStore.set(ACTIVE_ORG_COOKIE, trimmedOrgId, getActiveContextCookieOptions())

  const branchAccessScope = await getBranchAccessScope(trimmedOrgId)
  const persistedBranchId =
    resolvePersistedBranchIdForOrgSwitch(branchAccessScope)

  if (persistedBranchId) {
    cookieStore.set(
      ACTIVE_BRANCH_COOKIE,
      persistedBranchId,
      getActiveContextCookieOptions()
    )
  } else {
    cookieStore.delete(ACTIVE_BRANCH_COOKIE)
  }

  await persistMembershipActiveContext({
    userId: user.id,
    orgId: trimmedOrgId,
    branchId: persistedBranchId,
  })

  revalidatePath('/', 'layout')
  return { success: true, orgId: trimmedOrgId, branchId: persistedBranchId }
}

export async function updateOrgSettings(orgId: string, updates: any) {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }

  const membership = await getOrgMembership(user.id, trimmedOrgId)
  if (!membership) {
    return { error: 'Anda tidak memiliki akses ke organisasi ini.' }
  }

  if (!membershipHasPermission(membership, ['business', 'company'])) {
    return { error: 'Anda tidak memiliki izin untuk mengubah profil bisnis.' }
  }

  try {
    await prisma.organizations.update({
      where: { id: trimmedOrgId },
      data: updates,
    })
  } catch (error) {
    if (isUniqueConstraintError(error, ['slug'])) {
      return { error: 'Slug bisnis ini sudah digunakan.' }
    }

    console.error('updateOrgSettings Error:', error)
    return { error: 'Gagal menyimpan.' }
  }

  revalidatePath('/settings/business')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function checkSlugAvailability(orgId: string, slug: string) {
  const user = await getAuthenticatedUser()
  if (!user) return { available: false }

  const trimmedOrgId = String(orgId || '').trim()
  const normalizedSlug = String(slug || '').trim().toLowerCase()
  if (!trimmedOrgId || !normalizedSlug) return { available: false }

  const membership = await getOrgMembership(user.id, trimmedOrgId)
  if (!membership) return { available: false }

  const existingOrg = await prisma.organizations.findFirst({
    where: {
      slug: normalizedSlug,
      id: { not: trimmedOrgId },
    },
    select: { id: true },
  })

  return { available: !existingOrg }
}

export async function uploadLogo(orgId: string, formData: FormData) {
  const user = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Auth failed' }

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) {
    return { success: false, error: 'Organisasi tidak valid.' }
  }

  const membership = await getOrgMembership(user.id, trimmedOrgId)
  if (!membership) {
    return { success: false, error: 'Anda tidak memiliki akses ke organisasi ini.' }
  }

  if (!membershipHasPermission(membership, ['business', 'company'])) {
    return {
      success: false,
      error: 'Anda tidak memiliki izin untuk mengubah logo perusahaan.',
    }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { success: false, error: 'File logo tidak valid.' }
  }

  const uploadResult = await uploadOrganizationLogoAsset(trimmedOrgId, file)
  if (!uploadResult.url) {
    return {
      success: false,
      error: uploadResult.error || 'Gagal mengunggah logo.',
    }
  }

  try {
    await prisma.organizations.update({
      where: { id: trimmedOrgId },
      data: { logo_url: uploadResult.url },
    })
  } catch (error) {
    console.error('uploadLogo Error:', error)
    return { success: false, error: 'Gagal menyimpan logo organisasi.' }
  }

  revalidatePath('/settings/business')
  revalidatePath('/', 'layout')
  return { success: true, url: uploadResult.url }
}

export async function getOrgMembers(orgId: string) {
  const user = await getAuthenticatedUser()
  if (!user) return []

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return []

  const actorMembership = await getOrgMembership(user.id, trimmedOrgId)
  if (!actorMembership || !actorMembership.isOwnerOrAdmin) {
    return []
  }

  const memberships = await prisma.org_members.findMany({
    where: {
      org_id: trimmedOrgId,
      is_active: true,
    },
    include: {
      organizations: {
        select: {
          name: true,
        },
      },
      roles: {
        select: {
          id: true,
          name: true,
          permissions: true,
        },
      },
      org_member_units: {
        include: {
          branches: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
    orderBy: {
      joined_at: 'asc',
    },
  })

  const userIds = Array.from(
    new Set(
      memberships
        .map((membership) => membership.user_id)
        .filter(Boolean)
    )
  )

  const [users, employees] = await Promise.all([
    userIds.length > 0
      ? prisma.user.findMany({
          where: {
            id: { in: userIds },
          },
          select: {
            id: true,
            email: true,
            name: true,
          },
        })
      : [],
    userIds.length > 0
      ? prisma.employees.findMany({
          where: {
            org_id: trimmedOrgId,
            user_id: { in: userIds },
          },
          select: {
            id: true,
            user_id: true,
            job_title: true,
            department: true,
            branch_id: true,
          },
        })
      : [],
  ])

  const usersById = new Map(users.map((item) => [item.id, item]))
  const employeesByUserId = new Map(
    employees
      .filter((employee) => employee.user_id)
      .map((employee) => [String(employee.user_id), employee])
  )

  return memberships.map((membership) => ({
    id: membership.id,
    org_id: membership.org_id,
    user_id: membership.user_id,
    role: membership.role,
    is_active: membership.is_active,
    invited_by: membership.invited_by,
    joined_at: membership.joined_at,
    role_id: membership.role_id,
    last_active_at: membership.last_active_at,
    last_active_branch_id: membership.last_active_branch_id,
    organizations: membership.organizations,
    roles: membership.roles,
    user: usersById.get(membership.user_id)
      ? {
          email: usersById.get(membership.user_id)?.email ?? null,
          name: usersById.get(membership.user_id)?.name ?? null,
        }
      : null,
    employee: employeesByUserId.get(membership.user_id) ?? null,
    unit_assignments: membership.org_member_units.map((assignment) => ({
      branch_id: assignment.branch_id,
      branch: assignment.branches
        ? {
            id: assignment.branches.id,
            name: assignment.branches.name,
            code: assignment.branches.code,
          }
        : null,
    })),
  }))
}

export async function destroyOrganization(orgId: string) {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Unauthorized' }

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }

  const membership = await getOrgMembership(user.id, trimmedOrgId)
  if (!membership) return { error: 'Anda tidak memiliki akses ke organisasi ini.' }
  if (!membership.isOwner) return { error: 'Hanya OWNER yang bisa menghapus.' }

  try {
    await prisma.organizations.delete({
      where: { id: trimmedOrgId },
    })
  } catch (error) {
    console.error('destroyOrganization Error:', error)
    return { error: 'Gagal menghapus organisasi.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getBranches(orgId: string) {
  const scope = await getBranchAccessScope(orgId)
  return scope.accessibleBranches
}

export async function getActiveBranch(orgId: string) {
  return getCurrentAccessibleBranch(orgId)
}

export async function setActiveBranch(orgId: string, branchId: string | null) {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const cookieStore = await cookies()
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }

  const branchAccessScope = await getBranchAccessScope(trimmedOrgId)

  if (!branchAccessScope.role) {
    return { error: 'Anda tidak memiliki akses ke organisasi ini.' }
  }

  if (!branchId) {
    if (!branchAccessScope.canAccessAllBranches) {
      return {
        error: 'Anda harus memilih unit yang termasuk dalam akses Anda.',
      }
    }

    cookieStore.delete(ACTIVE_BRANCH_COOKIE)
    await persistMembershipActiveContext({
      userId: user.id,
      orgId: trimmedOrgId,
      branchId: null,
    })
    revalidatePath('/', 'layout')
    return { success: true, branchId: null }
  }

  const trimmedBranchId = branchId.trim()
  if (!branchAccessScope.accessibleBranchIds.includes(trimmedBranchId)) {
    return { error: 'Anda tidak memiliki akses ke unit tersebut.' }
  }

  cookieStore.set(
    ACTIVE_BRANCH_COOKIE,
    trimmedBranchId,
    getActiveContextCookieOptions()
  )
  await persistMembershipActiveContext({
    userId: user.id,
    orgId: trimmedOrgId,
    branchId: trimmedBranchId,
  })
  revalidatePath('/', 'layout')
  return { success: true, branchId: trimmedBranchId }
}

export async function canSelectAllBranches(orgId: string) {
  return canAccessAllBranchesForOrg(orgId)
}

export async function createBranch(
  orgId: string,
  formData: FormData
): Promise<CreateBranchSuccess | ActionError> {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const cookieStore = await cookies()
  const trimmedOrgId = String(orgId || '').trim()
  const name = String(formData.get('name') || '').trim()
  const code = String(formData.get('code') || '').trim().toUpperCase()
  const addressRaw = String(formData.get('address') || '').trim()
  const address = addressRaw || null

  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }
  if (!name) return { error: 'Nama unit wajib diisi.' }
  if (!code) return { error: 'Kode unit wajib diisi.' }

  const membership = await getOrgMembership(user.id, trimmedOrgId)
  if (!membership) {
    return { error: 'Anda tidak memiliki akses ke organisasi ini.' }
  }

  if (!membership.isOwnerOrAdmin) {
    return { error: 'Hanya owner atau admin yang dapat menambahkan unit.' }
  }

  const [duplicateNameBranch, duplicateCodeBranch] = await Promise.all([
    prisma.branches.findFirst({
      where: {
        org_id: trimmedOrgId,
        name,
      },
      select: { id: true },
    }),
    prisma.branches.findFirst({
      where: {
        org_id: trimmedOrgId,
        code,
      },
      select: { id: true },
    }),
  ])

  if (duplicateNameBranch?.id) {
    return { error: 'Nama unit sudah digunakan pada organisasi ini.' }
  }

  if (duplicateCodeBranch?.id) {
    return { error: 'Kode unit sudah digunakan pada organisasi ini.' }
  }

  let insertedBranch:
    | {
        id: string
        org_id: string
        name: string
        code: string
        address: string | null
        is_active: boolean
      }
    | null = null

  try {
    insertedBranch = await prisma.branches.create({
      data: {
        org_id: trimmedOrgId,
        name,
        code,
        address,
        is_active: true,
      },
      select: {
        id: true,
        org_id: true,
        name: true,
        code: true,
        address: true,
        is_active: true,
      },
    })
  } catch (error) {
    if (isUniqueConstraintError(error, ['org_id', 'name'])) {
      return { error: 'Nama unit sudah digunakan pada organisasi ini.' }
    }

    if (isUniqueConstraintError(error, ['org_id', 'code'])) {
      return { error: 'Kode unit sudah digunakan pada organisasi ini.' }
    }

    console.error('createBranch Error:', error)
    return { error: 'Gagal menambahkan unit baru.' }
  }

  cookieStore.set(
    ACTIVE_BRANCH_COOKIE,
    insertedBranch.id,
    getActiveContextCookieOptions()
  )
  await persistMembershipActiveContext({
    userId: user.id,
    orgId: trimmedOrgId,
    branchId: insertedBranch.id,
  })

  revalidatePath('/', 'layout')
  revalidatePath('/settings/branches')
  revalidatePath('/settings/users')

  return {
    success: true,
    branch: insertedBranch,
    branchId: insertedBranch.id,
  }
}

export async function updateMemberUnitAccess(
  orgId: string,
  memberId: string,
  branchIds: string[]
) {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = String(orgId || '').trim()
  const trimmedMemberId = String(memberId || '').trim()
  if (!trimmedOrgId || !trimmedMemberId) {
    return { error: 'Data anggota tidak valid.' }
  }

  const actorMembership = await getOrgMembership(user.id, trimmedOrgId)
  if (!actorMembership) {
    return { error: 'Anda tidak memiliki akses ke organisasi ini.' }
  }

  if (!actorMembership.isOwnerOrAdmin) {
    return { error: 'Hanya owner atau admin yang dapat mengatur akses unit.' }
  }

  const targetMembership = await prisma.org_members.findFirst({
    where: {
      id: trimmedMemberId,
      org_id: trimmedOrgId,
      is_active: true,
    },
    select: {
      id: true,
      role: true,
    },
  })

  if (!targetMembership) {
    return { error: 'Anggota organisasi tidak ditemukan.' }
  }

  if (['owner', 'admin'].includes(String(targetMembership.role || ''))) {
    return { error: 'Owner dan admin selalu memiliki akses ke semua unit.' }
  }

  const normalizedBranchIds = Array.from(
    new Set(
      branchIds
        .map((branchId) => String(branchId || '').trim())
        .filter(Boolean)
    )
  )

  if (normalizedBranchIds.length === 0) {
    return {
      error: 'Minimal satu unit harus dipilih untuk anggota non-owner/admin.',
    }
  }

  const validBranches = await prisma.branches.findMany({
    where: {
      org_id: trimmedOrgId,
      is_active: true,
      id: { in: normalizedBranchIds },
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  })

  if (validBranches.length !== normalizedBranchIds.length) {
    return { error: 'Satu atau lebih unit yang dipilih tidak valid.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.org_member_units.deleteMany({
        where: {
          org_id: trimmedOrgId,
          org_member_id: trimmedMemberId,
        },
      })

      await tx.org_member_units.createMany({
        data: normalizedBranchIds.map((branchId) => ({
          org_member_id: trimmedMemberId,
          org_id: trimmedOrgId,
          branch_id: branchId,
          assigned_by: user.id,
        })),
      })
    })
  } catch (error) {
    console.error('updateMemberUnitAccess Error:', error)
    return { error: 'Gagal menyimpan akses unit anggota.' }
  }

  revalidatePath('/settings/users')
  revalidatePath('/', 'layout')
  return {
    success: true,
    branchIds: normalizedBranchIds,
    branches: validBranches,
  }
}

export async function getInvitations(orgId: string) {
  const user = await getAuthenticatedUser()
  if (!user) return []

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return []

  const membership = await getOrgMembership(user.id, trimmedOrgId)
  if (!membership || !membership.isOwnerOrAdmin) {
    return []
  }

  return prisma.org_invitations.findMany({
    where: {
      org_id: trimmedOrgId,
    },
    include: {
      roles: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  })
}

function generateInvitationCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

export async function createInvitationToken(orgId: string, formData: FormData) {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Unauthorized' }

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }

  const membership = await getOrgMembership(user.id, trimmedOrgId)
  if (!membership) {
    return { error: 'Anda tidak memiliki akses ke organisasi ini.' }
  }

  if (!membership.isOwnerOrAdmin) {
    return { error: 'Hanya owner atau admin yang dapat membuat link aktivasi.' }
  }

  const roleIdRaw = formData.get('role_id')
  const roleId = roleIdRaw ? String(roleIdRaw).trim() || null : null
  const label = String(formData.get('label') || 'General Link').trim() || 'General Link'
  const durationDays = Number.parseInt(String(formData.get('duration') || '0'), 10)

  if (roleId) {
    const role = await prisma.roles.findFirst({
      where: {
        id: roleId,
        org_id: trimmedOrgId,
      },
      select: {
        id: true,
      },
    })

    if (!role) {
      return { error: 'Role undangan tidak valid.' }
    }
  }

  let expiresAt: string | null = null
  if (Number.isFinite(durationDays) && durationDays > 0) {
    const date = new Date()
    date.setDate(date.getDate() + durationDays)
    expiresAt = date.toISOString()
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const invitation = await prisma.org_invitations.create({
        data: {
          org_id: trimmedOrgId,
          role_id: roleId,
          label,
          invitation_code: generateInvitationCode(),
          created_by: user.id,
          expires_at: expiresAt,
          is_active: true,
        },
        include: {
          roles: {
            select: {
              name: true,
            },
          },
        },
      })

      revalidatePath('/settings/business')
      revalidatePath('/settings/users')
      revalidatePath('/hris')

      return {
        success: true,
        code: invitation.invitation_code,
        invitation,
      }
    } catch (error) {
      if (isUniqueConstraintError(error, ['invitation_code']) && attempt < 2) {
        continue
      }

      console.error('createInvitationToken Error:', error)
      return { error: 'Gagal membuat link aktivasi.' }
    }
  }

  return { error: 'Gagal membuat link aktivasi.' }
}

export async function deleteInvitation(id: string) {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Unauthorized' }

  const trimmedInvitationId = String(id || '').trim()
  if (!trimmedInvitationId) return { error: 'Link aktivasi tidak valid.' }

  const invitation = await prisma.org_invitations.findUnique({
    where: { id: trimmedInvitationId },
    select: {
      id: true,
      org_id: true,
    },
  })

  if (!invitation?.org_id) {
    return { error: 'Link aktivasi tidak ditemukan.' }
  }

  const membership = await getOrgMembership(user.id, invitation.org_id)
  if (!membership || !membership.isOwnerOrAdmin) {
    return { error: 'Akses ditolak.' }
  }

  await prisma.org_invitations.delete({
    where: { id: trimmedInvitationId },
  })

  revalidatePath('/settings/business')
  revalidatePath('/settings/users')
  revalidatePath('/hris')
  return { success: true }
}

export async function getInvitationByCode(code: string) {
  const normalizedCode = String(code || '').trim().toUpperCase()
  if (!normalizedCode) {
    return { error: 'Link tidak valid atau telah non-aktif.' }
  }

  const invitation = await prisma.org_invitations.findFirst({
    where: {
      invitation_code: normalizedCode,
      is_active: true,
    },
    include: {
      organizations: true,
      roles: true,
    },
  })

  if (!invitation) {
    return { error: 'Link tidak valid atau telah non-aktif.' }
  }

  return { success: true, invitation }
}
