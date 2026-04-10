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
  signInWithInternalAuth,
  signOutInternalAuth,
} from '@/lib/auth/internal-auth.server'
import { INTERNAL_AUTH_SESSION_COOKIE, INTERNAL_AUTH_SESSION_MAX_AGE } from '@/lib/auth/internal-auth.shared'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ACTIVE_BRANCH_COOKIE, ACTIVE_ORG_COOKIE } from '@/modules/organization/lib/org-context'
import {
  getStoredActiveOrgIdForUser,
  persistMembershipActiveContext,
} from '@/modules/organization/lib/active-context.server'

const ADMIN_IMPERSONATION_COOKIE = 'nizam_admin_impersonation'
const ADMIN_IMPERSONATION_MAX_AGE = 60 * 60 * 4
const ACTIVE_CONTEXT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const DEMO_ACCOUNT_EMAIL = 'demo@nizam.app'

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
    const matchedUser = users.find((user) => normalizeEmail(user?.email) === normalizedTargetEmail)
    if (matchedUser) {
      return { user: matchedUser, error: null }
    }

    if (users.length < perPage) break
    page += 1
  }

  return { user: null as { id?: string; email?: string | null } | null, error: null }
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

// ─────────────────────────────────────────────────────────────
// signUp — Create a new Business Owner account
// ─────────────────────────────────────────────────────────────
export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const planParam = String(formData.get('plan') || '').trim().toLowerCase()
  const isDemoSignup = planParam === 'demo'

  if (isInternalAuthProvider()) {
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
     // Identifikasi error jika email sudah terdaftar. (Terkadang Supabase mengeluarkan "Database error saving new user" karena trigger atau batas duplikasi).
     if (error.message.includes("Database error saving new user") || error.message.includes("already registered")) {
        return { error: 'Gagal: Email ini sudah pernah didaftarkan. Silakan Login atau gunakan email lain.' }
     }
     
     // Error lainnya
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

    if (result.resolvedOrgId) {
      setActiveOrganizationCookie(cookieStore, result.resolvedOrgId)
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
  if (isInternalAuthProvider()) {
    return { error: 'Aktivasi akun karyawan belum didukung di mode auth internal.' }
  }

  const adminClient = await createAdminClient()
  const publicClient = await createClient()
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
    return redirect(redirectTo || '/dashboard')
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
        return redirect(redirectTo || '/dashboard')
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
  redirect('/')
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

export async function deleteInactiveTenantByPlatformAdmin(orgId: string) {
  if (isInternalAuthProvider()) {
    return { error: 'Mode auth internal belum mendukung fitur ini. Gunakan AUTH_PROVIDER=supabase sementara.' }
  }

  const supabase = await createClient()
  const adminClient = await createAdminClient()
  const trimmedOrgId = String(orgId || '').trim()

  if (!trimmedOrgId) {
    return { error: 'Tenant tidak valid.' }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user
  const adminEmail = String(user?.email || '').trim().toLowerCase()

  if (userError || !user) {
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
  if (isInternalAuthProvider()) {
    return { error: 'Reset password karyawan belum didukung di mode auth internal.' }
  }

  const adminClient = await createAdminClient()
  
  const { data: emp, error: empErr } = await (adminClient as any)
    .from('employees')
    .select('user_id, nik')
    .eq('id', employeeId)
    .single()

  if (empErr || !emp.user_id) return { error: 'User tidak ditemukan.' }

  const { error: authErr } = await adminClient.auth.admin.updateUserById(emp.user_id, {
    password: newPassword
  })

  if (authErr) return { error: 'Gagal mereset: ' + authErr.message }

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

export async function sendPasswordResetEmail(formData: FormData) {
  if (isInternalAuthProvider()) {
    return { error: 'Reset password via email belum didukung di mode auth internal.' }
  }

  const supabase = await createClient()
  const email = formData.get('email') as string
  
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 
                 (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/update-password`,
  })

  if (error) {
    return { error: `Gagal: ${error.message}` }
  }

  return { success: true }
}
