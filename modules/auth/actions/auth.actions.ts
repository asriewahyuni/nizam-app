'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getServerAuthContext } from '@/lib/supabase/auth.server'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { isInternalAuthProvider } from '@/lib/auth/provider'
import {
  createInternalAuthSessionByUserId,
  createInternalAuthUser,
  ensureInternalAuthUserRecord,
  getInternalAuthSession,
  resetInternalAuthPasswordById,
  signInWithInternalAuth,
  signOutInternalAuth,
} from '@/lib/auth/internal-auth.server'
import { INTERNAL_AUTH_SESSION_COOKIE, INTERNAL_AUTH_SESSION_MAX_AGE } from '@/lib/auth/internal-auth.shared'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ACTIVE_BRANCH_COOKIE, ACTIVE_ORG_COOKIE } from '@/modules/organization/lib/org-context'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getStoredActiveOrgIdForUser,
  persistMembershipActiveContext,
  resolvePlatformAdminParentOrgId,
} from '@/modules/organization/lib/active-context.server'

const ADMIN_IMPERSONATION_COOKIE = 'nizam_admin_impersonation'
const ADMIN_IMPERSONATION_MAX_AGE = 60 * 60 * 4
const ACTIVE_CONTEXT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const DEMO_ACCOUNT_EMAIL = 'demo@nizam.app'
const HRIS_IMPERSONATION_PERMISSION_MARKERS = ['hris', 'employee', 'employees', 'attendance', 'payroll', 'leave', 'learning']
const HRIS_IMPERSONATION_LEGACY_ROLES = new Set(['owner', 'admin', 'hr'])

type AdminImpersonationPayload =
  | {
      provider?: 'supabase'
      accessToken: string
      refreshToken: string
      email: string
      activeOrgId: string | null
    }
  | {
      provider: 'internal'
      internalSessionToken: string
      email: string
      activeOrgId: string | null
    }

export type HrisImpersonationCandidate = {
  rawUserId: string
  targetUserId: string
  displayName: string
  email: string | null
  nik: string | null
  legacyRole: string | null
  roleLabel: string
  customRoleName: string | null
  branchName: string | null
  isCurrentUser: boolean
}

type InternalImpersonationIdentity = {
  internalUserId: string
  email: string | null
  nik: string | null
  displayName: string | null
}

type InternalAuthLookupRow = {
  id: string | null
  login_email: string | null
  login_nik: string | null
  display_name: string | null
}

type HrisImpersonationMemberRow = {
  user_id: string | null
  role: string | null
  role_id: string | null
}

type HrisImpersonationRoleRow = {
  id: string | null
  name: string | null
  permissions: string[] | null
}

type HrisImpersonationEmployeeRow = {
  id: string | null
  user_id: string | null
  first_name: string | null
  last_name: string | null
  nik: string | null
  email: string | null
  branch_id: string | null
}

type HrisImpersonationBranchRow = {
  id: string | null
  name: string | null
}

function encodeAdminImpersonation(payload: AdminImpersonationPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeAdminImpersonation(raw?: string | null): AdminImpersonationPayload | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<AdminImpersonationPayload>
    const email = typeof parsed.email === 'string' ? parsed.email : null
    if (!email) return null

    const provider = parsed.provider === 'internal' ? 'internal' : 'supabase'
    const activeOrgId = typeof parsed.activeOrgId === 'string' ? parsed.activeOrgId : null

    if (provider === 'internal') {
      const internalSessionToken = (parsed as { internalSessionToken?: unknown }).internalSessionToken
      if (typeof internalSessionToken !== 'string' || !internalSessionToken.trim()) return null
      return {
        provider: 'internal',
        internalSessionToken,
        email,
        activeOrgId,
      }
    }

    const accessToken = (parsed as { accessToken?: unknown }).accessToken
    const refreshToken = (parsed as { refreshToken?: unknown }).refreshToken
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') return null

    return {
      provider: 'supabase',
      accessToken,
      refreshToken,
      email,
      activeOrgId,
    }
  } catch {
    return null
  }
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

function setActiveOrganizationCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, orgId: string) {
  cookieStore.delete('nizam_demo_org_id')
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, getActiveContextCookieOptions())
  cookieStore.delete(ACTIVE_BRANCH_COOKIE)
}

function buildInternalStaffEmail(orgId: string, nik: string) {
  const orgPrefix = orgId.replace(/-/g, '').toLowerCase().slice(0, 8)
  const nikSlug = nik.toLowerCase().replace(/[^a-z0-9]/g, '-')
  return `${nikSlug}@${orgPrefix}.staff.nizam`
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function normalizeUuid(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    return null
  }
  return normalized
}

function normalizePermissionList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((permission): permission is string => typeof permission === 'string')
        .map((permission) => permission.trim().toLowerCase())
        .filter(Boolean)
    : []
}

function hasHrisImpersonationAccess(legacyRole: unknown, permissions: unknown) {
  const normalizedLegacyRole = String(legacyRole || '').trim().toLowerCase()
  if (HRIS_IMPERSONATION_LEGACY_ROLES.has(normalizedLegacyRole)) return true

  const normalizedPermissions = normalizePermissionList(permissions)
  return normalizedPermissions.some((permission) =>
    HRIS_IMPERSONATION_PERMISSION_MARKERS.some((marker) => permission.includes(marker))
  )
}

function getLegacyRoleDisplayLabel(role: unknown) {
  const normalizedRole = String(role || '').trim().toLowerCase()
  if (normalizedRole === 'owner') return 'Owner'
  if (normalizedRole === 'admin') return 'Admin'
  if (normalizedRole === 'hr') return 'HR'
  if (normalizedRole === 'manager') return 'Manager'
  if (normalizedRole === 'staff') return 'Staff'
  if (normalizedRole === 'viewer') return 'Viewer'
  return null
}

function resolveHrisRoleLabel(role: unknown, customRoleName: unknown) {
  const normalizedCustomRoleName = String(customRoleName || '').trim()
  if (normalizedCustomRoleName) return normalizedCustomRoleName
  return getLegacyRoleDisplayLabel(role) || 'Akun HRIS'
}

function isDuplicateAuthRegistrationError(message: unknown) {
  if (typeof message !== 'string') return false
  const lowered = message.toLowerCase()
  return (
    lowered.includes('duplicate key value') ||
    lowered.includes('already registered') ||
    lowered.includes('already been registered') ||
    lowered.includes('email address has already been registered') ||
    (/already.*registered/.test(lowered))
  )
}

function isAuthUserNotFoundError(message: unknown) {
  if (typeof message !== 'string') return false
  const lowered = message.toLowerCase()
  return lowered.includes('not found') || lowered.includes('no user')
}

function isDemoAccountUser(user: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null | undefined) {
  if (!user) return false
  const normalizedEmail = String(user.email || '').trim().toLowerCase()
  if (normalizedEmail === DEMO_ACCOUNT_EMAIL) return true
  return Boolean(user.user_metadata && (user.user_metadata as Record<string, unknown>).is_demo)
}

async function deleteOwnedOrganizationsForDemoUser(
  userId: string,
  fallbackDb: any
) {
  const trimmedUserId = String(userId || '').trim()
  if (!trimmedUserId) return

  let db = fallbackDb
  try {
    db = (await createAdminClient()) as any
  } catch (adminError) {
    ;(console as any).warn('signOut cleanup: admin client unavailable, fallback to session client', adminError)
  }

  const { data: memberships, error: membershipError } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', trimmedUserId)
    .eq('role', 'owner')
    .eq('is_active', true)

  if (membershipError) {
    ;(console as any).error('signOut cleanup: failed to load demo org memberships', membershipError)
    return
  }

  const orgIds = Array.from(
    new Set(
      (Array.isArray(memberships) ? memberships : [])
        .map((row: any) => String(row?.org_id || '').trim())
        .filter(Boolean)
    )
  )

  for (const orgId of orgIds) {
    const { error: deleteError } = await db
      .from('organizations')
      .delete()
      .eq('id', orgId)

    if (deleteError) {
      ;(console as any).error('signOut cleanup: failed to delete demo org', orgId, deleteError)
    }
  }
}

async function findAuthUserByEmail(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  email: string,
) {
  const normalizedTargetEmail = normalizeEmail(email)
  if (!normalizedTargetEmail) {
    return { user: null as { id?: string; email?: string | null } | null, error: null as string | null }
  }

  const perPage = 100
  let page = 1

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      return {
        user: null as { id?: string; email?: string | null } | null,
        error: `Gagal membaca akun autentikasi: ${error.message}`,
      }
    }

    const users = Array.isArray(data?.users) ? data.users : []
    const matchedUser = users.find((user: { email?: string | null }) => normalizeEmail(user?.email) === normalizedTargetEmail)
    if (matchedUser) {
      return { user: matchedUser, error: null }
    }

    if (users.length < perPage) break
    page += 1
  }

  return { user: null as { id?: string; email?: string | null } | null, error: null }
}

async function getSupabaseAuthEmailByUserId(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string | null | undefined
) {
  const normalizedUserId = normalizeUuid(userId)
  if (!normalizedUserId) return null

  const { data, error } = await adminClient.auth.admin.getUserById(normalizedUserId)
  if (error && !isAuthUserNotFoundError(error.message)) {
    return { error: `Gagal membaca akun autentikasi user target: ${error.message}` }
  }

  return { email: normalizeEmail(data.user?.email) || null }
}

async function resolveInternalImpersonationIdentity(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    userId?: string | null
    email?: string | null
    nik?: string | null
    displayName?: string | null
    userType?: string | null
  }
) {
  const normalizedUserId = normalizeUuid(input.userId)
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedNik = String(input.nik || '').trim().toUpperCase() || null

  const findActiveInternalUser = async (input: {
    field: 'id' | 'legacy_user_id' | 'login_nik' | 'login_email'
    value: string
    mode?: 'eq' | 'ilike'
  }) => {
    let query = adminClient
      .from('internal_auth_users')
      .select('id, login_email, login_nik, display_name')
      .eq('is_active', true)
      .limit(1)

    query = input.mode === 'ilike'
      ? query.ilike(input.field, input.value)
      : query.eq(input.field, input.value)

    const { data } = await query.maybeSingle()
    const row = data as InternalAuthLookupRow | null
    if (!row?.id) return null

    return {
      internalUserId: normalizeUuid(row.id) || null,
      email: normalizeEmail(row.login_email) || null,
      nik: String(row.login_nik || '').trim().toUpperCase() || null,
      displayName: String(row.display_name || '').trim() || null,
    }
  }

  if (normalizedUserId) {
    const byId = await findActiveInternalUser({ field: 'id', value: normalizedUserId })
    if (byId?.internalUserId) return byId as InternalImpersonationIdentity

    const byLegacy = await findActiveInternalUser({ field: 'legacy_user_id', value: normalizedUserId })
    if (byLegacy?.internalUserId) return byLegacy as InternalImpersonationIdentity
  }

  if (normalizedEmail) {
    const byEmail = await findActiveInternalUser({ field: 'login_email', value: normalizedEmail, mode: 'ilike' })
    if (byEmail?.internalUserId) return byEmail as InternalImpersonationIdentity
  }

  if (normalizedNik) {
    const byNik = await findActiveInternalUser({ field: 'login_nik', value: normalizedNik })
    if (byNik?.internalUserId) return byNik as InternalImpersonationIdentity
  }

  const ensuredUser = await ensureInternalAuthUserRecord({
    userId: normalizedUserId,
    email: normalizedEmail,
    nik: normalizedNik,
    fullName: input.displayName,
    userType: input.userType || 'staff',
  })

  if ('error' in ensuredUser) {
    return { error: ensuredUser.error }
  }

  return {
    internalUserId: ensuredUser.userId,
    email: normalizedEmail,
    nik: normalizedNik,
    displayName: String(input.displayName || '').trim() || null,
  } satisfies InternalImpersonationIdentity
}

type StaffLoginCandidate = {
  userId: string
  orgIds: string[]
  preferredOrgId: string
  authEmailFallbacks: string[]
}

function isEmployeeEmploymentActive(status: unknown) {
  const normalized = String(status || '').trim().toUpperCase()
  return normalized !== 'RESIGNED' && normalized !== 'TERMINATED'
}

async function deactivateStaleStaffMemberships(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  activeOrgIds: string[],
) {
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedUserId) return

  const normalizedActiveOrgIds = Array.from(
    new Set(
      activeOrgIds
        .map((orgId) => String(orgId || '').trim())
        .filter(Boolean)
    )
  )

  try {
    const { data: activeStaffMemberships, error: membershipReadError } = await (adminClient as any)
      .from('org_members')
      .select('org_id')
      .eq('user_id', normalizedUserId)
      .eq('role', 'staff')
      .eq('is_active', true)

    if (membershipReadError || !Array.isArray(activeStaffMemberships) || activeStaffMemberships.length === 0) {
      return
    }

    const staleOrgIds = activeStaffMemberships
      .map((membership: { org_id?: string | null }) => String(membership?.org_id || '').trim())
      .filter((orgId) => orgId && !normalizedActiveOrgIds.includes(orgId))

    if (staleOrgIds.length === 0) return

    await (adminClient as any)
      .from('org_members')
      .update({ is_active: false })
      .eq('user_id', normalizedUserId)
      .eq('role', 'staff')
      .eq('is_active', true)
      .in('org_id', staleOrgIds)
  } catch {
    return
  }
}

async function resolveRoleIdForEmployee(adminClient: Awaited<ReturnType<typeof createAdminClient>>, inviteRoleId: string | null | undefined, emp: any) {
  if (inviteRoleId) return inviteRoleId
  if (emp?.role_id) return emp.role_id

  const { data: allRoles } = await (adminClient as any)
    .from('roles')
    .select('id, name')
    .eq('org_id', emp.org_id)

  const matchingRole = allRoles?.find((role: any) =>
    role.name.toLowerCase().trim() === emp.job_title?.toLowerCase().trim()
  )

  return matchingRole?.id || null
}

async function linkEmployeeToUser(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  emp: any,
  userId: string,
  roleId: string | null,
) {
  const { error: updateErr } = await (adminClient as any)
    .from('employees')
    .update({
      user_id: userId,
      employment_status: emp.employment_status || 'PROBATION',
      registration_status: 'REGISTERED',
    })
    .eq('id', emp.id)

  if (updateErr) {
    return { error: 'Gagal menautkan user ke data karyawan.' }
  }

  const { error: memberErr } = await (adminClient as any)
    .from('org_members')
    .upsert({
      org_id: emp.org_id,
      user_id: userId,
      role: 'staff',
      role_id: roleId,
      is_active: true,
    }, { onConflict: 'org_id,user_id' })

  if (memberErr) {
    return { error: 'Gagal mendaftarkan keanggotaan organisasi.' }
  }

  return { success: true as const }
}

async function trackInvitationUsage(adminClient: Awaited<ReturnType<typeof createAdminClient>>, invite: any) {
  const nextUseCount = Number(invite.use_count || 0) + 1
  const maxUses = Number(invite.max_uses || 0)
  const shouldDeactivate = maxUses > 0 && nextUseCount >= maxUses

  await (adminClient as any)
    .from('org_invitations')
    .update({
      use_count: nextUseCount,
      ...(shouldDeactivate ? { is_active: false } : {}),
    })
    .eq('id', invite.id)
}

async function getAuthEmailByUserId(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  fallbackEmail?: string | null,
) {
  const { data, error } = await adminClient.auth.admin.getUserById(userId)
  if (error) return fallbackEmail || null
  return data.user?.email?.trim().toLowerCase() || fallbackEmail || null
}

function buildStaffLoginCandidates(employees: any[], nik: string, activeOrgId: string | null) {
  const candidates = new Map<string, StaffLoginCandidate>()

  for (const employee of employees) {
    if (!employee?.user_id || !employee?.org_id) continue

    const existing = candidates.get(employee.user_id)
    if (existing) {
      if (!existing.orgIds.includes(employee.org_id)) {
        existing.orgIds.push(employee.org_id)
      }

      if (activeOrgId && existing.orgIds.includes(activeOrgId)) {
        existing.preferredOrgId = activeOrgId
      }

      const fallbackEmail = buildInternalStaffEmail(employee.org_id, nik)
      if (!existing.authEmailFallbacks.includes(fallbackEmail)) {
        existing.authEmailFallbacks.push(fallbackEmail)
      }

      continue
    }

    const fallbackEmail = buildInternalStaffEmail(employee.org_id, nik)
    candidates.set(employee.user_id, {
      userId: employee.user_id,
      orgIds: [employee.org_id],
      preferredOrgId: activeOrgId === employee.org_id ? activeOrgId : employee.org_id,
      authEmailFallbacks: [fallbackEmail],
    })
  }

  return Array.from(candidates.values()).sort((left, right) => {
    const leftPreferred = activeOrgId ? left.orgIds.includes(activeOrgId) : false
    const rightPreferred = activeOrgId ? right.orgIds.includes(activeOrgId) : false

    if (leftPreferred === rightPreferred) return 0
    return leftPreferred ? -1 : 1
  })
}

async function resolvePreferredOrgIdForStaffLogin(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  orgIds: string[],
  fallbackOrgId: string,
) {
  const storedOrgId = await getStoredActiveOrgIdForUser(adminClient as any, userId, orgIds)
  return storedOrgId || fallbackOrgId
}

async function resolveExistingStaffIdentity(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  publicClient: Awaited<ReturnType<typeof createClient>>,
  emp: any,
  nik: string,
  password: string,
) {
  const { data: { user: currentUser } } = await publicClient.auth.getUser()
  const normalizedEmail = normalizeEmail(emp.email)

  if (currentUser?.id && currentUser.user_metadata?.login_type === 'employee') {
    const currentNik = typeof currentUser.user_metadata?.nik === 'string'
      ? currentUser.user_metadata.nik.trim().toUpperCase()
      : null

    if (currentNik === nik) {
      return { userId: currentUser.id, authEmail: currentUser.email?.trim().toLowerCase() || null }
    }

    if (normalizedEmail) {
      const { data: linkedSelf } = await (adminClient as any)
        .from('employees')
        .select('id')
        .eq('user_id', currentUser.id)
        .ilike('email', normalizedEmail)
        .limit(1)
        .maybeSingle()

      if (linkedSelf) {
        return { userId: currentUser.id, authEmail: currentUser.email?.trim().toLowerCase() || null }
      }
    }
  }

  if (!normalizedEmail) return null

  const { data: existingEmployee } = await (adminClient as any)
    .from('employees')
    .select('user_id')
    .neq('id', emp.id)
    .ilike('email', normalizedEmail)
    .not('user_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!existingEmployee?.user_id) return null

  const authEmail = await getAuthEmailByUserId(adminClient, existingEmployee.user_id)
  if (!authEmail) {
    return { error: 'Akun karyawan terdeteksi di organisasi lain, tetapi email login tidak ditemukan. Hubungi admin.' }
  }

  const { error: loginError } = await publicClient.auth.signInWithPassword({
    email: authEmail,
    password,
  })

  if (loginError) {
    return { error: 'Akun Anda sudah terhubung ke organisasi lain. Login dulu memakai akun yang sudah aktif, lalu buka kembali link undangan ini.' }
  }

  return { userId: existingEmployee.user_id, authEmail }
}

type InternalStaffAccountRecord = {
  id?: string | null
  legacy_user_id?: string | null
  login_email?: string | null
  login_nik?: string | null
  is_active?: boolean | null
}

function resolveInternalStaffLinkedUserId(account: InternalStaffAccountRecord | null | undefined) {
  return normalizeUuid(account?.legacy_user_id) || normalizeUuid(account?.id)
}

async function findInternalStaffAccount(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    nik: string
    internalEmail: string
  }
) {
  const { data: nikMatch } = await (adminClient as any)
    .from('internal_auth_users')
    .select('id, legacy_user_id, login_email, login_nik, is_active')
    .eq('login_nik', input.nik)
    .limit(1)
    .maybeSingle()

  if (nikMatch) {
    return nikMatch as InternalStaffAccountRecord
  }

  const { data: emailMatch } = await (adminClient as any)
    .from('internal_auth_users')
    .select('id, legacy_user_id, login_email, login_nik, is_active')
    .ilike('login_email', input.internalEmail)
    .limit(1)
    .maybeSingle()

  return (emailMatch || null) as InternalStaffAccountRecord | null
}

async function hasEstablishedInternalStaffAccount(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  linkedUserId: string,
) {
  const [{ data: memberships }, { data: employees }] = await Promise.all([
    (adminClient as any)
      .from('org_members')
      .select('org_id')
      .eq('user_id', linkedUserId)
      .eq('is_active', true)
      .limit(1),
    (adminClient as any)
      .from('employees')
      .select('id')
      .eq('user_id', linkedUserId)
      .limit(1),
  ])

  return Boolean(
    (Array.isArray(memberships) && memberships.length > 0) ||
    (Array.isArray(employees) && employees.length > 0)
  )
}

// ─────────────────────────────────────────────────────────────
// signUp — Create a new Business Owner account
// ─────────────────────────────────────────────────────────────
export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const planParam = String(formData.get('plan') || '').trim().toLowerCase()
  const isDemoSignup = planParam === 'demo'

  // Try internal auth flow first. If DB config is missing, fall back to Supabase client.
  if (isInternalAuthProvider()) {
    try {
      const internalUser = await createInternalAuthUser({
        email,
        password,
        fullName,
        userType: isPlatformAdminEmail(email) ? 'admin' : 'owner',
      })
      if ('error' in internalUser) {
        return { error: internalUser.error }
      }
      return { success: true, email }
    } catch (e) {
      // If internal auth cannot be used (e.g., missing DB config), fall back to Supabase.
      const fallbackError = (e as Error).message || ''
      if (fallbackError.includes('Koneksi database auth')) {
        // continue to Supabase flow below
      } else {
        return { error: fallbackError }
      }
    }
  }

  const supabase = await createClient()

  // Use regular signUp for owners so they get logged in automatically
  // and are prompted for email confirmation if enabled in dashboard.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { 
        full_name: fullName,
        login_type: 'owner',
        is_demo: isDemoSignup
      },
    },
  })

  if (error) {
     // Identify duplicate registration errors.
     if (error.message.includes("Database error saving new user") || error.message.includes("already registered")) {
        return { error: 'Gagal: Email ini sudah pernah didaftarkan. Silakan Login atau gunakan email lain.' }
     }
     return { error: error.message }
  }

  return { success: true, email }
}

// ─────────────────────────────────────────────────────────────
// signIn — Regular Business Owner/Admin login via email
// ─────────────────────────────────────────────────────────────
export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string | null

  if (isInternalAuthProvider()) {
    const cookieStore = await cookies()
    const activeOrgIdPreference = normalizeUuid(cookieStore.get(ACTIVE_ORG_COOKIE)?.value)
    const result = await signInWithInternalAuth({
      email,
      password,
      preferredOrgId: activeOrgIdPreference,
    })

    if ('error' in result) {
      const msg = encodeURIComponent('Email atau password salah.')
      redirect(`/login?error=${msg}`)
    }

    let resolvedOrgId = result.resolvedOrgId
    if (isPlatformAdminEmail(email)) {
      try {
        const adminClient = await createAdminClient()
        const parentOrgId = await resolvePlatformAdminParentOrgId(
          adminClient as any,
          result.userId,
          activeOrgIdPreference || result.resolvedOrgId || null
        )
        if (parentOrgId) {
          resolvedOrgId = parentOrgId
        }
      } catch (parentResolutionError) {
        ;(console as any).warn('signIn: platform admin parent-org fallback failed', parentResolutionError)
      }
    }

    if (resolvedOrgId) {
      setActiveOrganizationCookie(cookieStore, resolvedOrgId)
    }

    revalidatePath('/', 'layout')
    redirect(redirectTo || '/dashboard')
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const msg = encodeURIComponent('Email atau password salah.')
    redirect(`/login?error=${msg}`)
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo || '/dashboard')
}

// ─────────────────────────────────────────────────────────────
// registerEmployeeAccount — Converts employee to auth user
// ─────────────────────────────────────────────────────────────
export async function registerEmployeeAccount(formData: FormData) {
  const adminClient = await createAdminClient()
  const cookieStore = await cookies()

  const nik = (formData.get('nik') as string)?.trim().toUpperCase()
  const password = (formData.get('password') as string)
  const inviteId = (formData.get('invite_id') as string)

  if (!nik || !password || password.length < 8 || !inviteId) {
    return { error: 'Data aktivasi tidak lengkap. Pastikan NIK, password, dan token valid.' }
  }

  // 1. Validate invitation first
  const { data: invite, error: inviteErr } = await (adminClient as any)
    .from('org_invitations')
    .select('id, org_id, role_id, use_count, max_uses, is_active, expires_at')
    .eq('id', inviteId)
    .maybeSingle()

  if (inviteErr) {
    return { error: `Gagal memverifikasi token aktivasi: ${inviteErr.message}` }
  }
  if (!invite) return { error: 'Link aktivasi tidak ditemukan.' }
  if (!invite.is_active) return { error: 'Link aktivasi sudah dinonaktifkan.' }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { error: 'Link aktivasi sudah kadaluarsa.' }
  }
  if (Number(invite.max_uses || 0) > 0 && Number(invite.use_count || 0) >= Number(invite.max_uses || 0)) {
    return { error: 'Link aktivasi sudah mencapai batas penggunaan.' }
  }

  // 2. Get employee scoped by invitation org
  const { data: emp, error: empErr } = await (adminClient as any)
    .from('employees')
    .select('*')
    .eq('org_id', invite.org_id)
    .eq('nik', nik)
    .maybeSingle()

  if (empErr) return { error: `Gagal verifikasi NIK: ${empErr.message}` }
  if (!emp) return { error: 'NIK tidak valid atau tidak ditemukan di organisasi ini.' }
  if (emp.user_id) return { error: 'NIK ini sudah memiliki akun aktif. Silakan Login.' }

  // 3. Map role
  const roleId = await resolveRoleIdForEmployee(adminClient, invite?.role_id, emp)

  if (isInternalAuthProvider()) {
    const staffFullName = `${String(emp.first_name || '').trim()} ${String(emp.last_name || '').trim()}`
      .replace(/\s+/g, ' ')
      .trim()
    const internalEmail = buildInternalStaffEmail(emp.org_id, nik)

    const existingInternalAccount = await findInternalStaffAccount(adminClient, {
      nik,
      internalEmail,
    })

    let linkedUserId: string | null = null

    if (existingInternalAccount) {
      linkedUserId = resolveInternalStaffLinkedUserId(existingInternalAccount)
      if (!linkedUserId) {
        return { error: 'Akun internal ditemukan, tetapi identitas user-nya tidak valid. Hubungi admin.' }
      }

      const ensuredInternalUser = await ensureInternalAuthUserRecord({
        userId: linkedUserId,
        email: existingInternalAccount.login_email || internalEmail,
        nik,
        fullName: staffFullName || nik,
        userType: 'staff',
      })

      if ('error' in ensuredInternalUser) {
        return { error: ensuredInternalUser.error }
      }

      const establishedAccount = await hasEstablishedInternalStaffAccount(adminClient, linkedUserId)
      const existingLogin = await signInWithInternalAuth({
        email: existingInternalAccount.login_email || internalEmail,
        nik,
        password,
        preferredOrgId: emp.org_id,
      })

      if ('error' in existingLogin) {
        if (establishedAccount) {
          return {
            error: 'Akun karyawan ini sudah pernah diaktivasi. Login dulu dengan password yang sudah aktif, lalu buka lagi link aktivasi ini.',
          }
        }

        const resetResult = await resetInternalAuthPasswordById(ensuredInternalUser.userId, password)
        if ('error' in resetResult) {
          return { error: resetResult.error }
        }

        const sessionResult = await createInternalAuthSessionByUserId(ensuredInternalUser.userId)
        if ('error' in sessionResult) {
          return { error: `Akun internal ditemukan, tetapi sesi login gagal dibuat: ${sessionResult.error}` }
        }
      }
    } else {
      const internalUser = await createInternalAuthUser({
        email: internalEmail,
        nik,
        password,
        fullName: staffFullName || nik,
        userType: 'staff',
      })

      if ('error' in internalUser) {
        return { error: internalUser.error }
      }

      linkedUserId = normalizeUuid(internalUser.userId)
      if (!linkedUserId) {
        return { error: 'Akun internal berhasil dibuat, tetapi user ID tidak valid.' }
      }
    }

    const linkResult = await linkEmployeeToUser(adminClient, emp, linkedUserId, roleId)
    if ('error' in linkResult) return linkResult

    await trackInvitationUsage(adminClient, invite)
    await persistMembershipActiveContext(adminClient as any, {
      userId: linkedUserId,
      orgId: emp.org_id,
      branchId: emp.branch_id ? String(emp.branch_id) : null,
    })
    setActiveOrganizationCookie(cookieStore, emp.org_id)

    revalidatePath('/', 'layout')
    return { success: true, redirectTo: '/dashboard' }
  }

  const publicClient = await createClient()

  // 4. Reuse an already-linked staff identity when possible.
  const existingIdentity = await resolveExistingStaffIdentity(adminClient, publicClient, emp, nik, password)
  if (existingIdentity && 'error' in existingIdentity) {
    return { error: existingIdentity.error }
  }

  if (existingIdentity?.userId) {
    const linkResult = await linkEmployeeToUser(adminClient, emp, existingIdentity.userId, roleId)
    if ('error' in linkResult) return linkResult

    await trackInvitationUsage(adminClient, invite)
    await persistMembershipActiveContext(adminClient as any, {
      userId: existingIdentity.userId,
      orgId: emp.org_id,
      branchId: emp.branch_id ? String(emp.branch_id) : null,
    })
    setActiveOrganizationCookie(cookieStore, emp.org_id)

    revalidatePath('/', 'layout')
    return { success: true, redirectTo: '/dashboard' }
  }

  // 5. Generate internal email and create new auth user for fresh staff registration.
  const internalEmail = buildInternalStaffEmail(emp.org_id, nik)
  const employeeMetadata = {
    full_name: `${emp.first_name} ${emp.last_name}`,
    nik,
    login_type: 'employee',
    employee_email: normalizeEmail(emp.email),
  }

  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: employeeMetadata,
  })

  if (authErr && isDuplicateAuthRegistrationError(authErr.message)) {
    const lookupResult = await findAuthUserByEmail(adminClient, internalEmail)
    if (lookupResult.error) return { error: lookupResult.error }

    const existingUserId = lookupResult.user?.id
    if (!existingUserId) {
      return { error: 'Akun login sudah terdaftar, tetapi gagal dipetakan ke data karyawan. Hubungi admin.' }
    }

    const { error: syncErr } = await adminClient.auth.admin.updateUserById(existingUserId, {
      password,
      email_confirm: true,
      user_metadata: employeeMetadata,
    })

    if (syncErr) {
      return { error: `Akun login lama ditemukan, tetapi gagal disinkronkan: ${syncErr.message}` }
    }

    const relinkResult = await linkEmployeeToUser(adminClient, emp, existingUserId, roleId)
    if ('error' in relinkResult) return relinkResult

    await trackInvitationUsage(adminClient, invite)

    const { error: reloginErr } = await publicClient.auth.signInWithPassword({
      email: internalEmail,
      password,
    })

    if (reloginErr) {
      return { error: 'Akun lama berhasil ditautkan ulang, tapi login otomatis gagal. Silakan login manual pakai NIK & password baru.' }
    }

    await persistMembershipActiveContext(adminClient as any, {
      userId: existingUserId,
      orgId: emp.org_id,
      branchId: emp.branch_id ? String(emp.branch_id) : null,
    })
    setActiveOrganizationCookie(cookieStore, emp.org_id)
    revalidatePath('/', 'layout')
    return { success: true, redirectTo: '/dashboard' }
  }

  if (authErr) {
    return { error: authErr.message || 'Gagal membuat akun autentikasi.' }
  }

  const userId = authData.user?.id
  if (!userId) return { error: 'Gagal membuat user ID.' }

  const linkResult = await linkEmployeeToUser(adminClient, emp, userId, roleId)
  if ('error' in linkResult) return linkResult

  await trackInvitationUsage(adminClient, invite)

  // 9. Now Log in the user on the client side
  const { error: loginErr } = await publicClient.auth.signInWithPassword({ 
    email: internalEmail, 
    password 
  })

  if (loginErr) {
     return { error: 'Akun berhasil dibuat, tapi login otomatis gagal. Silakan login manual pakai NIK & password baru.' }
  }

  await persistMembershipActiveContext(adminClient as any, {
    userId,
    orgId: emp.org_id,
    branchId: emp.branch_id ? String(emp.branch_id) : null,
  })
  setActiveOrganizationCookie(cookieStore, emp.org_id)
  revalidatePath('/', 'layout')
  return { success: true, redirectTo: '/dashboard' }
}

// ─────────────────────────────────────────────────────────────
// signInWithNik — Standard login for staff
// ─────────────────────────────────────────────────────────────
export async function signInWithNik(formData: FormData) {
  let nik = (formData.get('nik') as string)?.trim()
  const password = (formData.get('password') as string)
  const redirectTo = (formData.get('redirectTo') as string)
  const explicitOrgIdPreference = normalizeUuid(formData.get('orgId'))

  if (!nik || !password) {
     return redirect(`/login?error=${encodeURIComponent('NIK dan Password wajib diisi.')}&tab=karyawan`)
  }

  if (isInternalAuthProvider()) {
    const cookieStore = await cookies()
    const cookieOrgIdPreference = normalizeUuid(cookieStore.get(ACTIVE_ORG_COOKIE)?.value)
    const preferredOrgId = explicitOrgIdPreference || cookieOrgIdPreference

    const result = await signInWithInternalAuth({
      nik,
      password,
      preferredOrgId,
    })

    if ('error' in result) {
      const normalizedMessage = String(result.error || '').trim()
      const loweredMessage = normalizedMessage.toLowerCase()
      const redirectMessage = loweredMessage.includes('lebih dari satu') || loweredMessage.includes('organisasi')
        ? normalizedMessage
        : 'NIK atau password salah.'
      return redirect(`/login?error=${encodeURIComponent(redirectMessage)}&tab=karyawan`)
    }

    if (result.resolvedOrgId) {
      setActiveOrganizationCookie(cookieStore, result.resolvedOrgId)
    }

    revalidatePath('/', 'layout')
    return redirect(redirectTo || '/karyawan')
  }

  const adminClient = await createAdminClient()
  const publicClient = await createClient()
  const cookieStore = await cookies()

  nik = nik.toUpperCase()
  const activeOrgIdPreference = cookieStore.get(ACTIVE_ORG_COOKIE)?.value?.trim() || null

  const { data: employees, error: empErr } = await (adminClient as any)
    .from('employees')
    .select('id, org_id, user_id, created_at, employment_status')
    .eq('nik', nik)
    .order('created_at', { ascending: true })

  if (empErr) {
     return redirect(`/login?error=${encodeURIComponent(`Database Error: ${empErr.message}`)}&tab=karyawan`)
  }

  const matchingEmployees = Array.isArray(employees) ? employees : []
  if (matchingEmployees.length === 0) {
    return redirect(`/login?error=${encodeURIComponent('NIK tidak ditemukan.')}&tab=karyawan`)
  }

  const activeEmployeeRows = matchingEmployees.filter((employee: { employment_status?: unknown }) =>
    isEmployeeEmploymentActive(employee?.employment_status)
  )

  if (activeEmployeeRows.length === 0) {
    return redirect(`/login?error=${encodeURIComponent('Akun karyawan sudah tidak aktif. Hubungi admin HRIS.')}&tab=karyawan`)
  }

  const linkedUserIds = Array.from(
    new Set(
      activeEmployeeRows
        .map((employee: { user_id?: string | null }) => String(employee?.user_id || '').trim())
        .filter(Boolean)
    )
  )

  for (const userId of linkedUserIds) {
    const activeOrgIds = Array.from(
      new Set(
        activeEmployeeRows
          .filter((employee: { user_id?: string | null }) => String(employee?.user_id || '').trim() === userId)
          .map((employee: { org_id?: string | null }) => String(employee?.org_id || '').trim())
          .filter(Boolean)
      )
    )

    await deactivateStaleStaffMemberships(adminClient, userId, activeOrgIds)
  }

  const loginCandidates = buildStaffLoginCandidates(activeEmployeeRows, nik, activeOrgIdPreference)
  if (loginCandidates.length === 0) {
    return redirect(`/login?error=${encodeURIComponent('Akun belum diaktivasi. Silakan pendaftaran terlebih dahulu.')}&tab=karyawan`)
  }

  for (const candidate of loginCandidates) {
    const authEmailFromAdmin = await getAuthEmailByUserId(
      adminClient,
      candidate.userId,
      candidate.authEmailFallbacks[0] || null
    )

    const emailAttempts = Array.from(
      new Set(
        [authEmailFromAdmin, ...candidate.authEmailFallbacks]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim().toLowerCase())
      )
    )

    for (const email of emailAttempts) {
      const { error } = await publicClient.auth.signInWithPassword({
        email,
        password,
      })

      if (!error) {
        const preferredOrgId = activeOrgIdPreference && candidate.orgIds.includes(activeOrgIdPreference)
          ? activeOrgIdPreference
          : await resolvePreferredOrgIdForStaffLogin(
              adminClient,
              candidate.userId,
              candidate.orgIds,
              candidate.preferredOrgId
            )

        setActiveOrganizationCookie(cookieStore, preferredOrgId)
        revalidatePath('/', 'layout')
        return redirect(redirectTo || '/karyawan')
      }
    }
  }

  return redirect(`/login?error=${encodeURIComponent('NIK atau password salah.')}&tab=karyawan`)
}

// REST REMAINING (signOut, verifyEmployeeNikByToken, etc.)
export async function signOut() {
  const cookieStore = await cookies()
  const internalProvider = isInternalAuthProvider()

  if (!internalProvider) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (isDemoAccountUser(user)) {
      await deleteOwnedOrganizationsForDemoUser(String(user?.id || ''), supabase as any)
    }

    await supabase.auth.signOut()
  } else {
    await signOutInternalAuth()
  }

  cookieStore.delete('nizam_demo_org_id')
  cookieStore.delete(ACTIVE_ORG_COOKIE)
  cookieStore.delete(ACTIVE_BRANCH_COOKIE)
  cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)
  revalidatePath('/', 'layout')
  redirect('https://kliknizam.app')
}

export async function getSession() {
  if (isInternalAuthProvider()) {
    const session = await getInternalAuthSession()
    return session?.user || null
  }

  const { user, error } = await getServerAuthContext()
  if (error || !user) return null
  return user
}

export async function getAdminImpersonationState() {
  const cookieStore = await cookies()
  const payload = decodeAdminImpersonation(cookieStore.get(ADMIN_IMPERSONATION_COOKIE)?.value)

  if (!payload) return null

  return {
    email: payload.email,
    activeOrgId: payload.activeOrgId,
  }
}

async function requirePlatformAdminImpersonation() {
  const cookieStore = await cookies()
  const payload = decodeAdminImpersonation(cookieStore.get(ADMIN_IMPERSONATION_COOKIE)?.value)
  const adminEmail = normalizeEmail(payload?.email) || ''

  if (!payload || !adminEmail || !isPlatformAdminEmail(adminEmail)) {
    return {
      error: 'Akses ditolak. Fitur ini hanya aktif saat platform admin sedang impersonate tenant.' as const,
    }
  }

  return {
    cookieStore,
    payload,
    adminEmail,
  }
}

/**
 * Mengambil daftar akun tenant yang relevan untuk pengujian akses HRIS saat
 * platform admin sedang berada dalam mode impersonation.
 */
export async function getTenantHrisImpersonationCandidates(orgId: string) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) {
    return { error: 'Organisasi tidak valid.', data: [] as HrisImpersonationCandidate[] }
  }

  const impersonationState = await requirePlatformAdminImpersonation()
  if ('error' in impersonationState) {
    return { error: impersonationState.error, data: [] as HrisImpersonationCandidate[] }
  }

  const activeOrg = await getActiveOrg()
  if (!activeOrg || String(activeOrg.org?.id || '').trim() !== trimmedOrgId) {
    return { error: 'Konteks tenant aktif tidak sesuai.', data: [] as HrisImpersonationCandidate[] }
  }

  const adminClient = await createAdminClient()

  const [membersResult, rolesResult, employeesResult, branchesResult] = await Promise.all([
    adminClient
      .from('org_members')
      .select('user_id, role, role_id')
      .eq('org_id', trimmedOrgId)
      .eq('is_active', true),
    adminClient
      .from('roles')
      .select('id, name, permissions')
      .eq('org_id', trimmedOrgId),
    adminClient
      .from('employees')
      .select('id, user_id, first_name, last_name, nik, email, branch_id')
      .eq('org_id', trimmedOrgId),
    adminClient
      .from('branches')
      .select('id, name')
      .eq('org_id', trimmedOrgId)
      .eq('is_active', true),
  ])

  if (membersResult.error) {
    return { error: `Gagal memuat anggota tenant: ${membersResult.error.message}`, data: [] as HrisImpersonationCandidate[] }
  }

  const roleRows = (Array.isArray(rolesResult.data) ? rolesResult.data : []) as HrisImpersonationRoleRow[]
  const employeeRows = (Array.isArray(employeesResult.data) ? employeesResult.data : []) as HrisImpersonationEmployeeRow[]
  const branchRows = (Array.isArray(branchesResult.data) ? branchesResult.data : []) as HrisImpersonationBranchRow[]
  const rawMembers = (Array.isArray(membersResult.data) ? membersResult.data : []) as HrisImpersonationMemberRow[]

  const rolesById = new Map(
    roleRows
      .filter((role) => role?.id)
      .map((role) => [String(role.id), role])
  )
  const employeesByUserId = new Map(
    employeeRows
      .filter((employee) => employee?.user_id)
      .map((employee) => [String(employee.user_id), employee])
  )
  const branchNameById = new Map(
    branchRows
      .filter((branch) => branch?.id)
      .map((branch) => [String(branch.id), String(branch.name || '')])
  )

  const seenUserIds = new Set<string>()

  const candidateRows = rawMembers.filter((member) => {
    const rawUserId = String(member?.user_id || '').trim()
    if (!rawUserId || seenUserIds.has(rawUserId)) return false
    seenUserIds.add(rawUserId)

    const customRole = rolesById.get(String(member?.role_id || '').trim())
    return hasHrisImpersonationAccess(member?.role, customRole?.permissions)
  })

  const candidates = await Promise.all(
    candidateRows.map(async (member) => {
      const rawUserId = String(member?.user_id || '').trim()
      const customRole = rolesById.get(String(member?.role_id || '').trim())
      const employee = employeesByUserId.get(rawUserId) || null
      const employeeFullName = [
        String(employee?.first_name || '').trim(),
        String(employee?.last_name || '').trim(),
      ]
        .filter(Boolean)
        .join(' ')
      const branchName = employee?.branch_id
        ? branchNameById.get(String(employee.branch_id)) || null
        : null

      if (isInternalAuthProvider()) {
        const internalIdentity = await resolveInternalImpersonationIdentity(adminClient, {
          userId: rawUserId,
          email: employee?.email || null,
          nik: employee?.nik || null,
          displayName: employeeFullName || null,
          userType: 'staff',
        })

        if ('error' in internalIdentity) return null

        const displayName =
          internalIdentity.displayName ||
          employeeFullName ||
          (internalIdentity.email ? internalIdentity.email.split('@')[0] : null) ||
          'User Tenant'

        return {
          rawUserId,
          targetUserId: internalIdentity.internalUserId,
          displayName,
          email: internalIdentity.email || normalizeEmail(employee?.email) || null,
          nik: internalIdentity.nik || String(employee?.nik || '').trim().toUpperCase() || null,
          legacyRole: String(member?.role || '').trim().toLowerCase() || null,
          roleLabel: resolveHrisRoleLabel(member?.role, customRole?.name),
          customRoleName: String(customRole?.name || '').trim() || null,
          branchName,
          isCurrentUser: rawUserId === String(activeOrg.user?.id || '').trim(),
        } satisfies HrisImpersonationCandidate
      }

      const authUserResult = await getSupabaseAuthEmailByUserId(adminClient, rawUserId)
      if (authUserResult && 'error' in authUserResult) return null

      const resolvedEmail = authUserResult?.email || normalizeEmail(employee?.email) || null
      const displayName =
        employeeFullName ||
        (resolvedEmail ? resolvedEmail.split('@')[0] : null) ||
        'User Tenant'

      return {
        rawUserId,
        targetUserId: rawUserId,
        displayName,
        email: resolvedEmail,
        nik: String(employee?.nik || '').trim().toUpperCase() || null,
        legacyRole: String(member?.role || '').trim().toLowerCase() || null,
        roleLabel: resolveHrisRoleLabel(member?.role, customRole?.name),
        customRoleName: String(customRole?.name || '').trim() || null,
        branchName,
        isCurrentUser: rawUserId === String(activeOrg.user?.id || '').trim(),
      } satisfies HrisImpersonationCandidate
    })
  )

  const roleWeight = (candidate: HrisImpersonationCandidate) => {
    if (candidate.legacyRole === 'hr') return 0
    if (candidate.customRoleName) return 1
    if (candidate.legacyRole === 'admin') return 2
    if (candidate.legacyRole === 'owner') return 3
    return 4
  }

  return {
    data: candidates
      .filter((candidate): candidate is HrisImpersonationCandidate => Boolean(candidate))
      .sort((left, right) => {
        const weightDiff = roleWeight(left) - roleWeight(right)
        if (weightDiff !== 0) return weightDiff
        return left.displayName.localeCompare(right.displayName, 'id', { sensitivity: 'base' })
      }),
  }
}

/**
 * Mengganti sesi tenant saat ini ke akun yang punya akses HR/HRIS.
 * Fitur ini hanya aktif jika user berasal dari platform admin impersonation.
 */
export async function signInAsTenantHrisUser(orgId: string, targetUserId: string) {
  const trimmedOrgId = String(orgId || '').trim()
  const trimmedTargetUserId = String(targetUserId || '').trim()

  if (!trimmedOrgId || !trimmedTargetUserId) {
    return { error: 'Target impersonation HRIS tidak valid.' }
  }

  const impersonationState = await requirePlatformAdminImpersonation()
  if ('error' in impersonationState) {
    return { error: impersonationState.error }
  }

  const candidateResult = await getTenantHrisImpersonationCandidates(trimmedOrgId)
  if (candidateResult.error) {
    return { error: candidateResult.error }
  }

  const targetCandidate = candidateResult.data.find((candidate) => candidate.targetUserId === trimmedTargetUserId)
  if (!targetCandidate) {
    return { error: 'Akun HR/HRIS target tidak ditemukan atau tidak memiliki akses.' }
  }

  if (targetCandidate.isCurrentUser) {
    return { success: true as const }
  }

  const cookieStore = impersonationState.cookieStore

  if (isInternalAuthProvider()) {
    const switched = await createInternalAuthSessionByUserId(targetCandidate.targetUserId)
    if ('error' in switched) {
      return { error: `Gagal mengganti sesi ke akun HRIS: ${switched.error}` }
    }

    cookieStore.delete('nizam_demo_org_id')
    cookieStore.set(ACTIVE_ORG_COOKIE, trimmedOrgId, {
      maxAge: ADMIN_IMPERSONATION_MAX_AGE,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    cookieStore.delete(ACTIVE_BRANCH_COOKIE)

    revalidatePath('/', 'layout')
    redirect('/hris')
  }

  const adminClient = await createAdminClient()
  const supabase = await createClient()
  const targetEmailResult = await getSupabaseAuthEmailByUserId(adminClient, targetCandidate.targetUserId)

  if (!targetEmailResult || 'error' in targetEmailResult) {
    return { error: targetEmailResult?.error || 'Email login akun HRIS tidak ditemukan.' }
  }

  const targetEmail = normalizeEmail(targetEmailResult.email)
  if (!targetEmail) {
    return { error: 'Akun HRIS target belum memiliki email login yang bisa dipakai.' }
  }

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
  })

  if (linkError) {
    return { error: `Gagal membuat magic link HRIS: ${linkError.message}` }
  }

  const tokenHash = linkData.properties?.hashed_token
  if (!tokenHash) {
    return { error: 'Magic link HRIS tidak memiliki token yang bisa diverifikasi.' }
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })

  if (verifyError) {
    return { error: `Gagal mengganti sesi ke akun HRIS: ${verifyError.message}` }
  }

  cookieStore.delete('nizam_demo_org_id')
  cookieStore.set(ACTIVE_ORG_COOKIE, trimmedOrgId, {
    maxAge: ADMIN_IMPERSONATION_MAX_AGE,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  cookieStore.delete(ACTIVE_BRANCH_COOKIE)

  revalidatePath('/', 'layout')
  redirect('/hris')
}

export async function deleteInactiveTenantByPlatformAdmin(orgId: string) {
  const supabase = await createClient()
  const adminClient = await createAdminClient()
  const trimmedOrgId = String(orgId || '').trim()

  if (!trimmedOrgId) {
    return { error: 'Tenant tidak valid.' }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user
  const adminEmail = normalizeEmail(user?.email) || ''

  if (userError || !user?.id) {
    return { error: 'Sesi admin tidak ditemukan. Silakan login ulang.' }
  }

  if (!isPlatformAdminEmail(adminEmail)) {
    return { error: 'Akses ditolak. Hanya platform admin yang bisa menghapus tenant.' }
  }

  const { data: org, error: orgError } = await (adminClient as any)
    .from('organizations')
    .select('id, name, is_active')
    .eq('id', trimmedOrgId)
    .maybeSingle()

  if (orgError) {
    return { error: `Gagal membaca data tenant: ${orgError.message}` }
  }

  if (!org) {
    return { error: 'Tenant tidak ditemukan atau sudah terhapus.' }
  }

  if (Boolean(org.is_active)) {
    return { error: `Tenant "${org.name}" masih aktif. Nonaktifkan tenant terlebih dahulu sebelum menghapus.` }
  }

  const { data: orgAccounts, error: orgAccountsError } = await (adminClient as any)
    .from('accounts')
    .select('id')
    .eq('org_id', trimmedOrgId)

  if (orgAccountsError) {
    return { error: `Gagal membaca daftar akun tenant: ${orgAccountsError.message}` }
  }

  const orgAccountIds = (orgAccounts || [])
    .map((row: { id?: string | null }) => String(row?.id || '').trim())
    .filter(Boolean)

  if (orgAccountIds.length > 0) {
    const cleanupSteps = [
      {
        label: 'komponen payroll',
        run: () => (adminClient as any)
          .from('payroll_components')
          .update({ account_id: null })
          .eq('org_id', trimmedOrgId)
          .in('account_id', orgAccountIds),
      },
      {
        label: 'run payroll',
        run: () => (adminClient as any)
          .from('payroll_runs')
          .update({ disbursement_account_id: null })
          .eq('org_id', trimmedOrgId)
          .in('disbursement_account_id', orgAccountIds),
      },
      {
        label: 'baris slip gaji',
        run: () => (adminClient as any)
          .from('payslip_lines')
          .update({ account_id: null })
          .in('account_id', orgAccountIds),
      },
    ] as const

    for (const step of cleanupSteps) {
      const { error: cleanupError } = await step.run()
      if (cleanupError) {
        return { error: `Gagal membersihkan referensi akun di ${step.label}: ${cleanupError.message}` }
      }
    }
  }

  const { error: deleteError } = await (adminClient as any)
    .from('organizations')
    .delete()
    .eq('id', trimmedOrgId)

  if (deleteError) {
    return { error: `Gagal menghapus tenant: ${deleteError.message}` }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function signInAsTenantOwner(orgId: string) {
  const internalProvider = isInternalAuthProvider()
  const adminClient = await createAdminClient()
  const cookieStore = await cookies()
  const trimmedOrgId = orgId.trim()

  if (!trimmedOrgId) {
    return { error: 'Tenant tidak valid.' }
  }

  if (internalProvider) {
    const internalSession = await getInternalAuthSession()
    const adminUser = internalSession?.user || null
    const adminEmail = normalizeEmail(adminUser?.email) || ''
    const backupInternalSessionToken = String(cookieStore.get(INTERNAL_AUTH_SESSION_COOKIE)?.value || '').trim()

    if (!adminUser?.id || !backupInternalSessionToken) {
      return { error: 'Sesi admin internal tidak ditemukan. Silakan login ulang.' }
    }

    if (!isPlatformAdminEmail(adminEmail)) {
      return { error: 'Akses ditolak. Hanya platform admin yang bisa login sebagai tenant.' }
    }

    const { data: org, error: orgError } = await (adminClient as any)
      .from('organizations')
      .select('id, name, owner_email')
      .eq('id', trimmedOrgId)
      .maybeSingle()

    if (orgError) {
      return { error: `Gagal memuat tenant: ${orgError.message}` }
    }

    if (!org) {
      return { error: 'Tenant tidak ditemukan.' }
    }

    const { data: ownerMembership, error: ownerMembershipError } = await (adminClient as any)
      .from('org_members')
      .select('user_id')
      .eq('org_id', trimmedOrgId)
      .eq('role', 'owner')
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (ownerMembershipError) {
      return { error: `Gagal memuat owner tenant: ${ownerMembershipError.message}` }
    }

    const tenantOwnerLegacyUserId = String(ownerMembership?.user_id || '').trim() || null
    let tenantEmail = normalizeEmail(org.owner_email) || null

    if (tenantOwnerLegacyUserId) {
      const { data: ownerUserData, error: ownerUserError } = await adminClient.auth.admin.getUserById(tenantOwnerLegacyUserId)
      if (ownerUserError && !isAuthUserNotFoundError(ownerUserError.message)) {
        return { error: `Gagal membaca akun owner tenant: ${ownerUserError.message}` }
      }
      if (ownerUserData.user?.email) {
        tenantEmail = normalizeEmail(ownerUserData.user.email)
      }
    }

    let internalOwnerUserId: string | null = null

    if (tenantOwnerLegacyUserId) {
      const { data: internalById } = await (adminClient as any)
        .from('internal_auth_users')
        .select('id')
        .eq('id', tenantOwnerLegacyUserId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      internalOwnerUserId = normalizeUuid(internalById?.id) || null
    }

    if (!internalOwnerUserId && tenantOwnerLegacyUserId) {
      const { data: internalByLegacy } = await (adminClient as any)
        .from('internal_auth_users')
        .select('id')
        .eq('legacy_user_id', tenantOwnerLegacyUserId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      internalOwnerUserId = normalizeUuid(internalByLegacy?.id) || null
    }

    if (!internalOwnerUserId && tenantEmail) {
      const { data: internalByEmail } = await (adminClient as any)
        .from('internal_auth_users')
        .select('id')
        .ilike('login_email', tenantEmail)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      internalOwnerUserId = normalizeUuid(internalByEmail?.id) || null
    }

    if (!internalOwnerUserId) {
      const ownerDisplayName = String(org.name || '').trim()
      const ensuredOwner = await ensureInternalAuthUserRecord({
        userId: tenantOwnerLegacyUserId,
        email: tenantEmail || (tenantOwnerLegacyUserId ? `${tenantOwnerLegacyUserId}@owners.nizam.local` : null),
        fullName: ownerDisplayName ? `${ownerDisplayName} Owner` : 'Tenant Owner',
        userType: 'owner',
      })

      if ('error' in ensuredOwner) {
        return { error: `Tenant belum memiliki akun owner internal yang dapat dipakai untuk Login As. (${ensuredOwner.error})` }
      }

      internalOwnerUserId = ensuredOwner.userId
    }

    if (!internalOwnerUserId) {
      return { error: 'Tenant belum memiliki akun owner internal yang dapat dipakai untuk Login As.' }
    }

    cookieStore.set(
      ADMIN_IMPERSONATION_COOKIE,
      encodeAdminImpersonation({
        provider: 'internal',
        internalSessionToken: backupInternalSessionToken,
        email: adminEmail,
        activeOrgId: cookieStore.get(ACTIVE_ORG_COOKIE)?.value || null,
      }),
      {
        maxAge: ADMIN_IMPERSONATION_MAX_AGE,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      }
    )

    const switched = await createInternalAuthSessionByUserId(internalOwnerUserId)
    if ('error' in switched) {
      cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)
      return { error: `Gagal mengganti sesi internal ke owner tenant: ${switched.error}` }
    }

    cookieStore.delete('nizam_demo_org_id')
    cookieStore.set(ACTIVE_ORG_COOKIE, org.id, {
      maxAge: ADMIN_IMPERSONATION_MAX_AGE,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    cookieStore.delete(ACTIVE_BRANCH_COOKIE)

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const adminSession = sessionData.session
  const adminUser = adminSession?.user
  const adminEmail = adminUser?.email?.toLowerCase().trim() || ''

  if (sessionError || !adminSession?.access_token || !adminSession.refresh_token || !adminUser) {
    return { error: 'Sesi admin tidak ditemukan. Silakan login ulang.' }
  }

  if (!isPlatformAdminEmail(adminEmail)) {
    return { error: 'Akses ditolak. Hanya platform admin yang bisa login sebagai tenant.' }
  }

  const { data: org, error: orgError } = await (adminClient as any)
    .from('organizations')
    .select('id, name, owner_email')
    .eq('id', trimmedOrgId)
    .maybeSingle()

  if (orgError) {
    return { error: `Gagal memuat tenant: ${orgError.message}` }
  }

  if (!org) {
    return { error: 'Tenant tidak ditemukan.' }
  }

  const { data: ownerMembership, error: ownerMembershipError } = await (adminClient as any)
    .from('org_members')
    .select('user_id')
    .eq('org_id', trimmedOrgId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (ownerMembershipError) {
    return { error: `Gagal memuat owner tenant: ${ownerMembershipError.message}` }
  }

  let tenantEmail = (org.owner_email || '').trim().toLowerCase()

  if (ownerMembership?.user_id) {
    const { data: ownerUserData, error: ownerUserError } = await adminClient.auth.admin.getUserById(ownerMembership.user_id)
    if (ownerUserError) {
      return { error: `Gagal membaca akun owner tenant: ${ownerUserError.message}` }
    }
    if (ownerUserData.user?.email) {
      tenantEmail = ownerUserData.user.email.trim().toLowerCase()
    }
  }

  if (!tenantEmail) {
    return { error: 'Tenant belum memiliki akun owner yang dapat dipakai untuk Login As.' }
  }

    cookieStore.set(
      ADMIN_IMPERSONATION_COOKIE,
      encodeAdminImpersonation({
        accessToken: adminSession.access_token,
        refreshToken: adminSession.refresh_token,
        email: adminEmail,
      activeOrgId: cookieStore.get(ACTIVE_ORG_COOKIE)?.value || null,
    }),
    {
      maxAge: ADMIN_IMPERSONATION_MAX_AGE,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    }
  )

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: tenantEmail,
  })

  if (linkError) {
    cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)
    return { error: `Gagal membuat magic link tenant: ${linkError.message}` }
  }

  const tokenHash = linkData.properties?.hashed_token
  if (!tokenHash) {
    cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)
    return { error: 'Magic link tenant tidak memiliki token yang bisa diverifikasi.' }
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })

  if (verifyError) {
    cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)
    return { error: `Gagal mengganti sesi ke tenant: ${verifyError.message}` }
  }

  cookieStore.delete('nizam_demo_org_id')
  cookieStore.set(ACTIVE_ORG_COOKIE, org.id, {
    maxAge: ADMIN_IMPERSONATION_MAX_AGE,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  cookieStore.delete(ACTIVE_BRANCH_COOKIE)

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function restorePlatformAdminSession() {
  const cookieStore = await cookies()
  const payload = decodeAdminImpersonation(cookieStore.get(ADMIN_IMPERSONATION_COOKIE)?.value)

  if (!payload) {
    return { error: 'Sesi admin cadangan tidak ditemukan atau sudah kadaluarsa.' }
  }

  if (isInternalAuthProvider()) {
    if (payload.provider !== 'internal') {
      return { error: 'Sesi admin cadangan internal tidak valid.' }
    }

    cookieStore.set(INTERNAL_AUTH_SESSION_COOKIE, payload.internalSessionToken, {
      maxAge: INTERNAL_AUTH_SESSION_MAX_AGE,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })

    const restoredSession = await getInternalAuthSession()
    const restoredAdminEmail = normalizeEmail(restoredSession?.user?.email) || ''
    if (!restoredSession?.user?.id || !isPlatformAdminEmail(restoredAdminEmail)) {
      cookieStore.delete(INTERNAL_AUTH_SESSION_COOKIE)
      cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)
      return { error: 'Sesi admin internal cadangan tidak valid atau sudah berakhir.' }
    }

    cookieStore.delete('nizam_demo_org_id')
    if (payload.activeOrgId) {
      cookieStore.set(ACTIVE_ORG_COOKIE, payload.activeOrgId, {
        maxAge: ADMIN_IMPERSONATION_MAX_AGE,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    } else {
      cookieStore.delete(ACTIVE_ORG_COOKIE)
    }
    cookieStore.delete(ACTIVE_BRANCH_COOKIE)
    cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)

    revalidatePath('/', 'layout')
    redirect('/admin')
  }

  const supabase = await createClient()
  if (payload.provider !== 'supabase') {
    return { error: 'Sesi admin cadangan tidak valid untuk mode Supabase.' }
  }

  const { error } = await supabase.auth.setSession({
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
  })

  if (error) {
    return { error: `Gagal memulihkan sesi admin: ${error.message}` }
  }

  cookieStore.delete('nizam_demo_org_id')
  if (payload.activeOrgId) {
    cookieStore.set(ACTIVE_ORG_COOKIE, payload.activeOrgId, {
      maxAge: ADMIN_IMPERSONATION_MAX_AGE,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  } else {
    cookieStore.delete(ACTIVE_ORG_COOKIE)
  }
  cookieStore.delete(ACTIVE_BRANCH_COOKIE)
  cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)

  revalidatePath('/', 'layout')
  redirect('/admin')
}

export async function verifyEmployeeNikByToken(token: string, nik: string) {
  const adminClient = await createAdminClient()
  const normalizedToken = token.toUpperCase().trim()
  const normalizedNik = nik.trim().toUpperCase()

  const { data: invite, error: inviteErr } = await (adminClient as any)
    .from('org_invitations')
    .select('id, org_id, role_id, label, invitation_code, expires_at, is_active, max_uses, use_count, created_at')
    .eq('invitation_code', normalizedToken)
    .maybeSingle()

  if (inviteErr) {
    const inviteMessage = String(inviteErr.message || '')
    if (inviteMessage.toLowerCase().includes('permission')) {
      return { error: 'Link ditemukan, tetapi layanan verifikasi token belum berizin di server. Hubungi admin sistem.' }
    }
    return { error: `Gagal memverifikasi link aktivasi: ${inviteMessage}` }
  }
  if (!invite) return { error: 'Link aktivasi tidak ditemukan.' }
  if (!invite.is_active) return { error: 'Link aktivasi sudah dinonaktifkan oleh admin.' }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { error: 'Link aktivasi sudah kadaluarsa.' }
  }
  if (Number(invite.max_uses || 0) > 0 && Number(invite.use_count || 0) >= Number(invite.max_uses || 0)) {
    return { error: 'Link aktivasi sudah mencapai batas penggunaan.' }
  }

  const { data: emp, error: empErr } = await (adminClient as any)
    .from('employees')
    .select('id, first_name, last_name, user_id, org_id')
    .eq('org_id', invite.org_id)
    .eq('nik', normalizedNik)
    .maybeSingle()

  if (empErr) {
    const empMessage = String(empErr.message || '')
    if (empMessage.toLowerCase().includes('permission')) {
      return { error: 'NIK tidak bisa diverifikasi karena layanan aktivasi belum berizin di server. Hubungi admin sistem.' }
    }
    return { error: `Gagal validasi NIK: ${empMessage}` }
  }
  if (!emp) return { error: 'NIK Anda tidak terdaftar di bisnis ini.' }
  if (emp.user_id) return { error: 'NIK ini sudah memiliki akun aktif. Silakan Login.' }

  const [orgRes, roleRes] = await Promise.all([
    (adminClient as any)
      .from('organizations')
      .select('id, name, logo_url')
      .eq('id', invite.org_id)
      .maybeSingle(),
    invite.role_id
      ? (adminClient as any)
          .from('roles')
          .select('id, name')
          .eq('id', invite.role_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const invitePayload = {
    ...invite,
    roles: roleRes?.data || null,
  }

  return { success: true, employee: emp, org: orgRes?.data || null, invite: invitePayload }
}

export async function requestPasswordReset(nik: string) {
  const adminClient = await createAdminClient()
  const formattedNik = nik.trim().toUpperCase()

  const { data: employees, error } = await (adminClient as any)
    .from('employees')
    .select('id, first_name, user_id')
    .eq('nik', formattedNik)
    .order('created_at', { ascending: true })

  if (error) {
     return { error: `Database Error: ${error.message}` }
  }

  const matchingEmployees = Array.isArray(employees) ? employees : []
  if (matchingEmployees.length === 0) {
    return { error: 'Gagal mengajukan reset. Pastikan NIK terdaftar atau periksa huruf/angkanya.' }
  }

  const linkedUserIds = Array.from(
    new Set(
      matchingEmployees
        .map((employee: any) => employee.user_id)
        .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
    )
  )

  if (linkedUserIds.length > 1) {
    return { error: 'NIK ini terhubung ke lebih dari satu akun. Hubungi admin organisasi Anda untuk reset password.' }
  }

  if (linkedUserIds.length === 0 && matchingEmployees.length > 1) {
    return { error: 'NIK ini terdaftar di lebih dari satu organisasi tetapi belum terhubung ke satu akun. Hubungi admin untuk aktivasi atau reset password.' }
  }

  const targetEmployees = linkedUserIds.length === 1
    ? matchingEmployees.filter((employee: any) => employee.user_id === linkedUserIds[0])
    : matchingEmployees.slice(0, 1)

  const employeeIds = targetEmployees
    .map((employee: any) => employee.id)
    .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)

  if (employeeIds.length === 0) {
    return { error: 'Gagal mengajukan reset password. Hubungi admin organisasi Anda.' }
  }

  const { error: updateError } = await (adminClient as any)
    .from('employees')
    .update({
      reset_requested: true,
      reset_requested_at: new Date().toISOString()
    })
    .in('id', employeeIds)

  if (updateError) {
     return { error: `Database Error: ${updateError.message}` }
  }

  revalidatePath('/hris')
  return { success: true, name: targetEmployees[0]?.first_name || 'Karyawan' }
}

export async function resetEmployeePassword(employeeId: string, newPassword: string) {
  const adminClient = await createAdminClient()
  
  const { data: emp, error: empErr } = await (adminClient as any)
    .from('employees')
    .select('user_id, nik')
    .eq('id', employeeId)
    .single()

  if (empErr || !emp.user_id) return { error: 'User tidak ditemukan.' }

  if (isInternalAuthProvider()) {
    const { resetInternalAuthPasswordById } = await import('@/lib/auth/internal-auth.server')
    const { error: internalErr } = await resetInternalAuthPasswordById(emp.user_id, newPassword)
    if (internalErr) return { error: internalErr }
  } else {
    const { error: authErr } = await adminClient.auth.admin.updateUserById(emp.user_id, {
      password: newPassword
    })
    if (authErr) return { error: 'Gagal mereset: ' + authErr.message }
  }

  await (adminClient as any)
    .from('employees')
    .update({ 
      reset_requested: false,
      reset_requested_at: null
    })
    .eq('id', employeeId)

  revalidatePath('/hris')
  return { success: true }
}

export async function updateMyPassword(newPassword: string) {
  const password = String(newPassword || '')
  if (password.length < 8) {
    return { error: 'Password minimal 8 karakter.' }
  }

  const { user } = await getServerAuthContext()
  const userId = String(user?.id || '').trim()
  if (!userId) {
    return { error: 'Sesi login tidak ditemukan. Silakan login ulang.' }
  }

  if (isInternalAuthProvider()) {
    const { error } = await resetInternalAuthPasswordById(userId, password)
    if (error) return { error }
  } else {
    const adminClient = await createAdminClient()
    const { error } = await adminClient.auth.admin.updateUserById(userId, { password })
    if (error) return { error: 'Gagal memperbarui password: ' + error.message }
  }

  revalidatePath('/profil-saya')
  return { success: true }
}

export async function sendPasswordResetEmail(formData: FormData) {
  const email = formData.get('email') as string
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 
                 (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  if (isInternalAuthProvider()) {
    const { createInternalAuthResetTokenByEmail } = await import('@/lib/auth/internal-auth.server')
    const tokenResult = await createInternalAuthResetTokenByEmail(email)
    
    if (tokenResult.error || !tokenResult.token) {
      return { error: tokenResult.error || 'Terjadi kesalahan sistem.' }
    }

    const { sendPasswordResetEmailInternal } = await import('@/lib/email/sender')
    const resetLink = `${origin}/update-password?token=${tokenResult.token}`
    
    // We send asynchronously so we don't slow down the UI
    const emailResult = await sendPasswordResetEmailInternal(email, resetLink)
    if (emailResult.error) {
      return { error: 'Gagal mengirim email: ' + emailResult.error }
    }

    return { success: true }
  }

  // Supabase Legacy Fallback
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/update-password`,
  })

  if (error) {
    return { error: `Gagal: ${error.message}` }
  }

  return { success: true }
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  if (isInternalAuthProvider()) {
    const { verifyAndResetInternalAuthPassword } = await import('@/lib/auth/internal-auth.server')
    const result = await verifyAndResetInternalAuthPassword(token, newPassword)
    return result
  }
  
  // Untungnya Supabase secara otomatis mengenali session di sisi Client saat URL ?code=...
  return { error: 'Supabase menggunakan flow form client-side tanpa mengirim raw token.' }
}
