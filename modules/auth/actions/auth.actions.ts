'use server'

import { auth, signOut as nextAuthSignOut } from '@/auth'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ACTIVE_BRANCH_COOKIE, ACTIVE_ORG_COOKIE } from '@/modules/organization/lib/org-context'
import {
  getStoredActiveOrgIdForUser,
  persistMembershipActiveContext,
} from '@/modules/organization/lib/active-context.server'
import { signIn as nextAuthSignIn } from '@/auth'
import { AuthError } from 'next-auth'
import bcrypt from 'bcrypt'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetLinkEmail } from '@/lib/email/sender'

const ADMIN_IMPERSONATION_COOKIE = 'nizam_admin_impersonation'
const ADMIN_IMPERSONATION_MAX_AGE = 60 * 60 * 4
const ACTIVE_CONTEXT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

type AdminImpersonationPayload = {
  accessToken: string
  refreshToken: string
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

    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.email !== 'string'
    ) {
      return null
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      email: parsed.email,
      activeOrgId: typeof parsed.activeOrgId === 'string' ? parsed.activeOrgId : null,
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

async function resolveRoleIdForEmployee(inviteRoleId: string | null | undefined, emp: any) {
  if (inviteRoleId) return inviteRoleId

  const allRoles = await prisma.roles.findMany({
    where: { org_id: emp.org_id },
    select: { id: true, name: true }
  })

  const matchingRole = allRoles?.find((role: any) =>
    role.name.toLowerCase().trim() === emp.job_title?.toLowerCase().trim()
  )

  return matchingRole?.id || null
}

async function linkEmployeeToUser(
  emp: any,
  userId: string,
  roleId: string | null,
) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.employees.update({
        where: { id: emp.id },
        data: {
          user_id: userId,
          employment_status: emp.employment_status || 'PROBATION',
          registration_status: 'REGISTERED',
        }
      })

      const existingMember = await tx.org_members.findFirst({
        where: { org_id: emp.org_id, user_id: userId }
      })

      if (existingMember) {
        await tx.org_members.update({
          where: { id: existingMember.id },
          data: { role: 'staff', role_id: roleId, is_active: true }
        })
      } else {
        await tx.org_members.create({
          data: {
            org_id: emp.org_id,
            user_id: userId,
            role: 'staff',
            role_id: roleId,
            is_active: true,
          }
        })
      }
    })
    return { success: true as const }
  } catch (err) {
    return { error: 'Gagal menautkan user ke data karyawan.' }
  }
}

async function trackInvitationUsage(invite: any) {
  const nextUseCount = Number(invite.use_count || 0) + 1
  const maxUses = Number(invite.max_uses || 0)
  const shouldDeactivate = maxUses > 0 && nextUseCount >= maxUses

  await prisma.org_invitations.update({
    where: { id: invite.id },
    data: {
      use_count: nextUseCount,
      ...(shouldDeactivate ? { is_active: false } : {}),
    }
  })
}

async function getAuthEmailByUserId(
  userId: string,
  fallbackEmail?: string | null,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  })
  if (!user) return fallbackEmail || null
  return user.email?.trim().toLowerCase() || fallbackEmail || null
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
  userId: string,
  orgIds: string[],
  fallbackOrgId: string,
) {
  const storedOrgId = await getStoredActiveOrgIdForUser(userId, orgIds)
  return storedOrgId || fallbackOrgId
}

async function resolveExistingStaffIdentity(
  emp: any,
  nik: string,
  password: string,
) {
  const session = await auth()
  const currentUser = session?.user
  const normalizedEmail = normalizeEmail(emp.email)

  if (currentUser?.id) {
    if (normalizedEmail) {
      const linkedSelf = await prisma.employees.findFirst({
        where: { user_id: currentUser.id, email: { equals: normalizedEmail, mode: 'insensitive' } },
        select: { id: true }
      })

      if (linkedSelf) {
        return { userId: currentUser.id, authEmail: currentUser.email?.trim().toLowerCase() || null }
      }
    }
  }

  if (!normalizedEmail) return null

  const existingEmployee = await prisma.employees.findFirst({
    where: {
      id: { not: emp.id },
      email: { equals: normalizedEmail, mode: 'insensitive' },
      user_id: { not: null }
    },
    orderBy: { created_at: 'asc' },
    select: { user_id: true }
  })

  if (!existingEmployee?.user_id) return null

  const authEmail = await getAuthEmailByUserId(existingEmployee.user_id)
  if (!authEmail) {
    return { error: 'Akun karyawan terdeteksi di organisasi lain, tetapi email login tidak ditemukan. Hubungi admin.' }
  }

  const existingUser = await prisma.user.findUnique({ where: { email: authEmail } })
  if (!existingUser || !existingUser.password || !bcrypt.compareSync(password, existingUser.password)) {
    return { error: 'Akun Anda sudah terhubung ke organisasi lain. Password salah.' }
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

  // Use regular signUp for owners so they get logged in automatically
  // and are prompted for email confirmation if enabled in dashboard.
  const { data, error } = await supabase.auth.signUp({
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

  try {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: fullName,
      }
    })
  } catch (err: any) {
    if (err.code === 'P2002') return { error: 'Gagal: Email ini sudah pernah didaftarkan. Silakan Login atau gunakan email lain.' }
    return { error: 'Terjadi kesalahan saat menyimpan data akun.' }
  }

  return { success: true, email }
}

// ─────────────────────────────────────────────────────────────
// signIn — Regular Business Owner/Admin login via email
// ─────────────────────────────────────────────────────────────
export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirectTo') as string) || '/dashboard'

  try {
    await nextAuthSignIn('credentials', {
      email,
      password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') {
        const msg = encodeURIComponent('Email atau password salah.')
        redirect(`/login?error=${msg}`)
      }
      const msg = encodeURIComponent('Terjadi kesalahan saat login.')
      redirect(`/login?error=${msg}`)
    }
    throw error
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo)
}

// ─────────────────────────────────────────────────────────────
// registerEmployeeAccount — Converts employee to auth user
// ─────────────────────────────────────────────────────────────
export async function registerEmployeeAccount(formData: FormData) {
  const cookieStore = await cookies()

  const nik = (formData.get('nik') as string)?.trim().toUpperCase()
  const password = (formData.get('password') as string)
  const inviteId = (formData.get('invite_id') as string)

  if (!nik || !password || password.length < 8 || !inviteId) {
    return { error: 'Data aktivasi tidak lengkap. Pastikan NIK, password, dan token valid.' }
  }

  const invite = await prisma.org_invitations.findUnique({
    where: { id: inviteId },
    select: { id: true, org_id: true, role_id: true, use_count: true, max_uses: true, is_active: true, expires_at: true }
  })

  if (!invite) return { error: 'Link aktivasi tidak ditemukan.' }
  if (!invite.is_active) return { error: 'Link aktivasi sudah dinonaktifkan.' }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { error: 'Link aktivasi sudah kadaluarsa.' }
  }
  if (Number(invite.max_uses || 0) > 0 && Number(invite.use_count || 0) >= Number(invite.max_uses || 0)) {
    return { error: 'Link aktivasi sudah mencapai batas penggunaan.' }
  }

  const emp = await prisma.employees.findFirst({
    where: { org_id: invite.org_id!, nik: nik }
  })

  if (!emp) return { error: 'NIK tidak valid atau tidak ditemukan di organisasi ini.' }
  if (emp.user_id) return { error: 'NIK ini sudah memiliki akun aktif. Silakan Login.' }

  const roleId = await resolveRoleIdForEmployee(invite?.role_id, emp)

  const existingIdentity = await resolveExistingStaffIdentity(emp, nik, password)
  if (existingIdentity && 'error' in existingIdentity) {
    return { error: existingIdentity.error }
  }

  if (existingIdentity?.userId) {
    const linkResult = await linkEmployeeToUser(emp, existingIdentity.userId, roleId)
    if ('error' in linkResult) return linkResult

    await trackInvitationUsage(invite)
    await persistMembershipActiveContext({
      userId: existingIdentity.userId,
      orgId: emp.org_id,
      branchId: emp.branch_id ? String(emp.branch_id) : null,
    })
    setActiveOrganizationCookie(cookieStore, emp.org_id)

    revalidatePath('/', 'layout')
    return { success: true, redirectTo: '/dashboard' }
  }

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

  const userId = authData.id
  if (!userId) return { error: 'Gagal membuat user ID.' }

  const linkResult = await linkEmployeeToUser(emp, userId, roleId)
  if ('error' in linkResult) return linkResult

  await trackInvitationUsage(invite)

  try {
    await nextAuthSignIn('credentials', { 
      email: internalEmail, 
      password,
      redirect: false
    })
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { error: 'Akun berhasil dibuat, tapi login otomatis gagal. Silakan login manual pakai NIK & password baru.' }
    }
    throw error;
  }

  await persistMembershipActiveContext({
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
  const cookieStore = await cookies()

  let nik = (formData.get('nik') as string)?.trim()
  const password = (formData.get('password') as string)
  const redirectTo = (formData.get('redirectTo') as string)

  if (!nik || !password) {
     return redirect(`/login?error=${encodeURIComponent('NIK dan Password wajib diisi.')}&tab=karyawan`)
  }

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

  if (employees.length === 0) {
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


export async function signOut() {
  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_ORG_COOKIE)
  cookieStore.delete(ACTIVE_BRANCH_COOKIE)
  cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)
  await nextAuthSignOut({ redirectTo: '/login' })
}

export async function getSession() {
  const session = await auth()
  if (!session?.user) return null

  // Transform NextAuth user to be somewhat compatible with Supabase's user shape if needed,
  // or just return the NextAuth user directly.
  return {
    id: session.user.id,
    email: session.user.email,
    user_metadata: {
      full_name: session.user.name,
      login_type: 'owner' // fallback
    }
  }
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

export async function signInAsTenantOwner(orgId: string) {
  const session = await auth()
  const cookieStore = await cookies()
  const trimmedOrgId = orgId.trim()

  if (!trimmedOrgId) return { error: 'Tenant tidak valid.' }

  const adminEmail = session?.user?.email?.toLowerCase().trim() || ''
  if (!adminEmail) return { error: 'Sesi admin tidak ditemukan. Silakan login ulang.' }
  if (!isPlatformAdminEmail(adminEmail)) {
    return { error: 'Akses ditolak. Hanya platform admin yang bisa login sebagai tenant.' }
  }

  // Look up org
  const org = await prisma.organizations.findUnique({
    where: { id: trimmedOrgId },
    select: { id: true, name: true, owner_email: true },
  })
  if (!org) return { error: 'Tenant tidak ditemukan.' }

  // Look up owner's email directly from users table via org_members
  const ownerMembership = await prisma.org_members.findFirst({
    where: { org_id: trimmedOrgId, role: 'owner', is_active: true },
    orderBy: { joined_at: 'asc' },
    select: { user_id: true },
  })

  let tenantEmail = (org.owner_email || '').trim().toLowerCase()
  if (ownerMembership?.user_id) {
    const ownerUser = await prisma.user.findUnique({
      where: { id: ownerMembership.user_id },
      select: { email: true },
    })
    if (ownerUser?.email) tenantEmail = ownerUser.email.trim().toLowerCase()
  }

  if (!tenantEmail) {
    return { error: 'Tenant belum memiliki akun owner yang dapat dipakai untuk Login As.' }
  }

  // Store admin return context in cookie
  cookieStore.set(
    ADMIN_IMPERSONATION_COOKIE,
    encodeAdminImpersonation({
      accessToken: session?.user?.id || '',
      refreshToken: '',
      email: adminEmail,
      activeOrgId: cookieStore.get(ACTIVE_ORG_COOKIE)?.value || null,
    }),
    { maxAge: ADMIN_IMPERSONATION_MAX_AGE, path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
  )

  // Sign in as tenant owner via NextAuth credentials
  try {
    await nextAuthSignIn('credentials', { email: tenantEmail, redirect: false })
  } catch (err) {
    cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)
    return { error: 'Gagal login sebagai tenant. Pastikan akun tenant sudah terdaftar.' }
  }

  cookieStore.delete('nizam_demo_org_id')
  cookieStore.set(ACTIVE_ORG_COOKIE, org.id, {
    maxAge: ADMIN_IMPERSONATION_MAX_AGE, path: '/', httpOnly: true, sameSite: 'lax',
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

  // Restore admin's original org context from cookie payload
  cookieStore.delete('nizam_demo_org_id')
  if (payload.activeOrgId) {
    cookieStore.set(ACTIVE_ORG_COOKIE, payload.activeOrgId, {
      maxAge: ADMIN_IMPERSONATION_MAX_AGE, path: '/', httpOnly: true, sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  } else {
    cookieStore.delete(ACTIVE_ORG_COOKIE)
  }
  cookieStore.delete(ACTIVE_BRANCH_COOKIE)
  cookieStore.delete(ADMIN_IMPERSONATION_COOKIE)

  // Log admin back in using their original email from payload
  if (payload.email) {
    try {
      await nextAuthSignIn('credentials', { email: payload.email, redirect: false })
    } catch { /* session may already be valid */ }
  }

  revalidatePath('/', 'layout')
  redirect('/admin')
}

export async function verifyEmployeeNikByToken(token: string, nik: string) {
  const normalizedToken = token.toUpperCase().trim()
  const normalizedNik = nik.trim().toUpperCase()

  const invite = await prisma.org_invitations.findFirst({
    where: { invitation_code: normalizedToken },
    select: { id: true, org_id: true, role_id: true, label: true, invitation_code: true, expires_at: true, is_active: true, max_uses: true, use_count: true, created_at: true }
  })

  if (!invite) return { error: 'Link aktivasi tidak ditemukan.' }
  if (!invite.is_active) return { error: 'Link aktivasi sudah dinonaktifkan oleh admin.' }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { error: 'Link aktivasi sudah kadaluarsa.' }
  }
  if (Number(invite.max_uses || 0) > 0 && Number(invite.use_count || 0) >= Number(invite.max_uses || 0)) {
    return { error: 'Link aktivasi sudah mencapai batas penggunaan.' }
  }

  const emp = await prisma.employees.findFirst({
    where: { org_id: invite.org_id!, nik: normalizedNik },
    select: { id: true, first_name: true, last_name: true, user_id: true, org_id: true }
  })

  if (!emp) return { error: 'NIK Anda tidak terdaftar di bisnis ini.' }
  if (emp.user_id) return { error: 'NIK ini sudah memiliki akun aktif. Silakan Login.' }

  const [orgRes, roleRes] = await Promise.all([
    prisma.organizations.findUnique({
      where: { id: invite.org_id! },
      select: { id: true, name: true, logo_url: true }
    }),
    invite.role_id
      ? prisma.roles.findUnique({
          where: { id: invite.role_id! },
          select: { id: true, name: true }
        })
      : Promise.resolve(null),
  ])

  const invitePayload = {
    ...invite,
    roles: roleRes || null,
  }

  return { success: true, employee: emp, org: orgRes || null, invite: invitePayload }
}

export async function requestPasswordReset(nik: string) {
  const formattedNik = nik.trim().toUpperCase()

  let employees: any[]
  try {
    employees = await prisma.employees.findMany({
      where: { nik: formattedNik },
      select: { id: true, first_name: true, user_id: true },
      orderBy: { created_at: 'asc' },
    })
  } catch (err: any) {
    return { error: `Database Error: ${err.message}` }
  }

  if (employees.length === 0) {
    return { error: 'Gagal mengajukan reset. Pastikan NIK terdaftar atau periksa huruf/angkanya.' }
  }

  const linkedUserIds = Array.from(
    new Set(
      employees
        .map((e) => e.user_id)
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
    )
  )

  if (linkedUserIds.length > 1) {
    return { error: 'NIK ini terhubung ke lebih dari satu akun. Hubungi admin organisasi Anda untuk reset password.' }
  }

  if (linkedUserIds.length === 0 && employees.length > 1) {
    return { error: 'NIK ini terdaftar di lebih dari satu organisasi tetapi belum terhubung ke satu akun. Hubungi admin untuk aktivasi atau reset password.' }
  }

  const targetEmployees = linkedUserIds.length === 1
    ? employees.filter((e) => e.user_id === linkedUserIds[0])
    : employees.slice(0, 1)

  const employeeIds = targetEmployees
    .map((e) => e.id)
    .filter((v): v is string => typeof v === 'string' && v.length > 0)

  if (employeeIds.length === 0) {
    return { error: 'Gagal mengajukan reset password. Hubungi admin organisasi Anda.' }
  }

  try {
    await prisma.employees.updateMany({
      where: { id: { in: employeeIds } },
      data: { reset_requested: true, reset_requested_at: new Date() },
    })
  } catch (err: any) {
    return { error: `Database Error: ${err.message}` }
  }

  revalidatePath('/hris')
  return { success: true, name: targetEmployees[0]?.first_name || 'Karyawan' }
}

export async function resetEmployeePassword(employeeId: string, newPassword: string) {
  const emp = await prisma.employees.findUnique({
    where: { id: employeeId },
    select: { user_id: true, nik: true },
  })

  if (!emp?.user_id) return { error: 'User tidak ditemukan.' }

  const hashedPassword = bcrypt.hashSync(newPassword, 10)
  try {
    await prisma.user.update({
      where: { id: emp.user_id },
      data: { password: hashedPassword },
    })
  } catch (err: any) {
    return { error: 'Gagal mereset: ' + err.message }
  }

  await prisma.employees.update({
    where: { id: employeeId },
    data: { reset_requested: false, reset_requested_at: null },
  })

  revalidatePath('/hris')
  return { success: true }
}

export async function sendPasswordResetEmail(formData: FormData) {
  const email = (formData.get('email') as string).trim().toLowerCase()
  if (!email) return { error: 'Email wajib diisi.' }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) {
    return { success: true }
  }

  const rawToken = randomBytes(32).toString('hex')
  const hashedToken = createHash('sha256').update(rawToken).digest('hex')
  const expires = new Date(Date.now() + 1000 * 60 * 60)

  await prisma.verificationToken.deleteMany({ where: { identifier: email } })
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires,
    },
  })

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const resetUrl = new URL(`/update-password?token=${rawToken}&email=${encodeURIComponent(email)}`, appUrl).toString()
  const emailResult = await sendPasswordResetLinkEmail(email, resetUrl)

  if ('error' in emailResult && process.env.RESEND_API_KEY) {
    return { error: `Gagal mengirim email reset password: ${emailResult.error}` }
  }

  return { success: true }
}

export async function completePasswordReset(formData: FormData) {
  const email = (formData.get('email') as string).trim().toLowerCase()
  const rawToken = (formData.get('token') as string).trim()
  const password = formData.get('password') as string

  if (!email || !rawToken || !password) {
    return { error: 'Tautan reset password tidak valid.' }
  }

  if (password.length < 6) {
    return { error: 'Password minimal 6 karakter.' }
  }

  const hashedToken = createHash('sha256').update(rawToken).digest('hex')
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token: hashedToken },
  })

  if (!verificationToken || verificationToken.identifier !== email || verificationToken.expires.getTime() <= Date.now()) {
    return { error: 'Tautan reset password tidak valid atau sudah kedaluwarsa.' }
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user?.id) {
    await prisma.verificationToken.delete({ where: { token: hashedToken } })
    return { error: 'Akun tidak ditemukan.' }
  }

  const hashedPassword = bcrypt.hashSync(password, 10)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    }),
    prisma.verificationToken.delete({ where: { token: hashedToken } }),
  ])

  return { success: true }
}
