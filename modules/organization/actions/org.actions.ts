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
import { syncParentCoAToChildOrg } from '@/modules/accounting/actions/coa.actions'

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

type OrgMemberRole = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer' | 'hr'

const ALLOWED_MEMBER_ROLES: OrgMemberRole[] = [
  'owner',
  'admin',
  'manager',
  'staff',
  'viewer',
  'hr',
]

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

function normalizeMemberRole(value: unknown): OrgMemberRole | null {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (!normalizedValue) return null

  return ALLOWED_MEMBER_ROLES.includes(normalizedValue as OrgMemberRole)
    ? (normalizedValue as OrgMemberRole)
    : null
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

type HoldingContextSuccess = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
  userId: string
  activeOrgId: string
}

type HoldingContextFailure = {
  error: string
}

type HoldingContextResult = HoldingContextSuccess | HoldingContextFailure

type HoldingContextOptions = {
  ownerOnly?: boolean
}

const OPTIONAL_ORGANIZATION_COLUMNS = new Set(['owner_email', 'parent_org_id', 'is_demo'])

function extractErrorMessage(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

function extractMissingColumnName(error: unknown): string | null {
  const message = extractErrorMessage(error)
  if (!message) return null

  const postgrestMatch = message.match(/could not find the '([a-zA-Z0-9_]+)' column/i)
  if (postgrestMatch?.[1]) return postgrestMatch[1]

  const postgresMatch = message.match(/column "?([a-zA-Z0-9_]+)"? does not exist/i)
  if (postgresMatch?.[1]) return postgresMatch[1]

  return null
}

function mapCreateOrganizationError(
  defaultMessage: string,
  error: { code?: string | null; message?: string | null } | null | undefined
): string {
  if (!error) return defaultMessage

  if (error.code === '23505') {
    return 'Nama atau slug organisasi ini sudah digunakan.'
  }

  const message = String(error.message || '').trim()
  const missingColumn = extractMissingColumnName(error)
  if (missingColumn === 'parent_org_id') {
    return 'Database belum update untuk fitur struktur organisasi. Jalankan migrasi terbaru lalu coba lagi.'
  }
  if (missingColumn === 'owner_email') {
    return 'Database belum update untuk metadata owner organisasi. Jalankan migrasi terbaru lalu coba lagi.'
  }

  const relationMatch = message.match(/relation "([^"]+)" does not exist/i)
  if (relationMatch?.[1]) {
    return `Database belum lengkap. Tabel "${relationMatch[1]}" belum tersedia. Jalankan migrasi Supabase terbaru lalu coba lagi.`
  }

  if (/function .* does not exist/i.test(message)) {
    return 'Database belum lengkap. Function yang dibutuhkan belum tersedia. Jalankan migrasi Supabase terbaru lalu coba lagi.'
  }

  if (/trigger .* does not exist/i.test(message)) {
    return 'Database belum lengkap. Trigger organisasi belum sinkron. Jalankan migrasi Supabase terbaru lalu coba lagi.'
  }

  if (/Unit Utama organisasi .* belum tersedia/i.test(message)) {
    return 'Setup CoA default gagal karena trigger governance akun di database belum sinkron. Jalankan SQL migrasi 1150 (rebind accounts governance + ensure MAIN branch), lalu coba lagi.'
  }

  if (/row-level security|permission denied/i.test(message)) {
    return 'Akses database ditolak oleh kebijakan keamanan. Coba login ulang lalu ulangi proses.'
  }

  if (message && process.env.NODE_ENV !== 'production') {
    return `${defaultMessage} (${message})`
  }

  return defaultMessage
}

async function seedDefaultCoAAfterBranchReady(db: any, orgId: string) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return
  if (!db || typeof db.rpc !== 'function') return

  try {
    // Avoid duplicate seeding for environments where trigger already seeded CoA.
    try {
      if (typeof db.from === 'function') {
        const { data: existingAccounts } = await db
          .from('accounts')
          .select('id')
          .eq('org_id', trimmedOrgId)
          .limit(1)

        if (Array.isArray(existingAccounts) && existingAccounts.length > 0) {
          return
        }
      }
    } catch (checkError) {
      ;(console as any).warn('CreateOrganization: account pre-check skipped', checkError)
    }

    const { error } = await db.rpc('seed_default_coa', { p_org_id: trimmedOrgId })
    if (error) {
      ;(console as any).warn('CreateOrganization: post-branch CoA seed failed', error)
    }
  } catch (seedError) {
    ;(console as any).warn('CreateOrganization: post-branch CoA seed threw error', seedError)
  }
}

async function getHoldingManagementContext(
  expectedParentOrgId?: string,
  options?: HoldingContextOptions
): Promise<HoldingContextResult> {
  const supabase = await createClient()
  const db = supabase
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Tidak terautentikasi.' }

  const activeOrg = await getActiveOrg()
  if (!activeOrg) return { error: 'Organisasi aktif tidak ditemukan.' }

  const role = String(activeOrg.role || '').toLowerCase()
  if (options?.ownerOnly) {
    if (role !== 'owner') {
      return { error: 'Perubahan data anak perusahaan hanya dapat dilakukan oleh OWNER organisasi induk.' }
    }
  } else if (role !== 'owner' && role !== 'admin') {
    return { error: 'Hanya owner/admin organisasi induk yang dapat mengelola anak perusahaan.' }
  }

  const activeOrgId = String(activeOrg.org?.id || '').trim()
  if (!activeOrgId) {
    return { error: 'Organisasi aktif tidak valid.' }
  }

  const activeOrgEntity = activeOrg.org as typeof activeOrg.org & { parent_org_id?: string | null }
  const parentOrgId = activeOrgEntity.parent_org_id
  if (parentOrgId) {
    return { error: 'Fitur ini hanya tersedia dari konteks Organisasi Induk (Holding).' }
  }

  const expected = String(expectedParentOrgId || '').trim()
  if (expected && expected !== activeOrgId) {
    return { error: 'Ganti Organisasi Aktif ke holding yang sesuai sebelum melanjutkan.' }
  }

  return {
    db,
    userId: user.id,
    activeOrgId,
  }
}

async function createOrganizationRecord(
  formData: FormData
): Promise<CreateOrganizationActionResult> {
  try {
    const supabase = await createClient()
    const db = supabase as any
    let admin: any = null
    try {
      admin = (await createAdminClient()) as any
    } catch (adminInitError) {
      ;(console as any).warn('CreateOrganization: admin client unavailable, fallback to session client', adminInitError)
    }
    const privilegedDb = admin ?? db
    const cookieStore = await cookies()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Tidak terautentikasi' }

    const name = (formData.get('name') as string).trim()
    if (!name) return { error: 'Nama organisasi wajib diisi' }
    const slug = generateSlug(name)
    const orgId = crypto.randomUUID()
    let defaultBranchId = crypto.randomUUID()

    // POPULATE OWNER EMAIL FROM SESSION
    const ownerEmail = user.email
    const planParam = String(formData.get('plan') || '').trim().toLowerCase()
    const businessType = (formData.get('type') || 'BLANK') as DemoBusinessType
    const isDemo = planParam === 'demo'
    const isAbs = planParam === 'abs'
    const selectedPlan = isDemo ? 'Demo' : 'Trial'
    const parentOrgIdRaw = String(formData.get('parent_org_id') || '').trim()
    const parentOrgId = parentOrgIdRaw || null

    if (parentOrgId) {
      const holdingContext = await getHoldingManagementContext(parentOrgId, { ownerOnly: true })
      if ('error' in holdingContext) return { error: holdingContext.error }

      // ── Enforce child org limit ───────────────────────────────────
      const limits = await getOrgLimits(parentOrgId)
      if (limits.maxChildOrgs !== null && limits.currentChildOrgs >= limits.maxChildOrgs) {
        return {
          error: `Batas anak perusahaan tercapai (${limits.currentChildOrgs}/${limits.maxChildOrgs}). Upgrade paket SaaS Anda untuk menambah lebih banyak entitas.`,
        }
      }
    }

    const orgInsertPayload: Record<string, unknown> = {
      id: orgId,
      name,
      slug,
      is_demo: isDemo,
      settings: {
        currency: 'IDR',
        timezone: 'Asia/Jakarta',
        fiscal_year_start_month: 1,
        plan: selectedPlan, // Default plan for new orgs
        is_demo: isDemo,
        business_type: businessType,
        // Delay CoA trigger seeding until Unit Utama exists to satisfy governance checks.
        skip_coa_seed: true,
      },
    }
    if (ownerEmail) {
      orgInsertPayload.owner_email = ownerEmail
    }
    if (parentOrgId) {
      orgInsertPayload.parent_org_id = parentOrgId
    }

    let { error: orgError } = await db.from('organizations').insert(orgInsertPayload)
    while (orgError) {
      const missingColumn = extractMissingColumnName(orgError)
      if (!missingColumn || !OPTIONAL_ORGANIZATION_COLUMNS.has(missingColumn)) break
      if (missingColumn === 'parent_org_id' && parentOrgId) break
      if (!(missingColumn in orgInsertPayload)) break

      delete orgInsertPayload[missingColumn]
      ;({ error: orgError } = await db.from('organizations').insert(orgInsertPayload))
    }

    if (orgError) {
      ;(console as any).error('CreateOrganization: organizations insert failed', orgError)
      return {
        error: mapCreateOrganizationError('Gagal membuat organisasi.', orgError),
      }
    }

    const { error: memberError } = await privilegedDb
      .from('org_members')
      .insert({ org_id: orgId, user_id: user.id, role: 'owner' })

    if (memberError) {
      ;(console as any).error('CreateOrganization: org_members insert failed', memberError)
      if (admin) {
        await admin.from('organizations').delete().eq('id', orgId)
      }
      return {
        error: mapCreateOrganizationError('Gagal menambahkan anggota.', memberError),
      }
    }

    let { error: branchError } = await privilegedDb
      .from('branches')
      .insert({
        id: defaultBranchId,
        org_id: orgId,
        name: DEFAULT_BRANCH_NAME,
        code: DEFAULT_BRANCH_CODE,
        address: null,
        is_active: true,
      })

    if (branchError?.code === '23505') {
      const { data: existingBranchByCode } = await privilegedDb
        .from('branches')
        .select('id')
        .eq('org_id', orgId)
        .eq('code', DEFAULT_BRANCH_CODE)
        .maybeSingle()

      const existingBranchId = String(existingBranchByCode?.id || '').trim()
      if (existingBranchId) {
        defaultBranchId = existingBranchId
        branchError = null
      }
    }

    if (branchError) {
      ;(console as any).error('CreateOrganization: branches insert failed', branchError)
      if (admin) {
        await admin.from('organizations').delete().eq('id', orgId)
      }
      return {
        error: mapCreateOrganizationError('Gagal menyiapkan unit default organisasi.', branchError),
      }
    }

    await seedDefaultCoAAfterBranchReady(privilegedDb, orgId)

    await persistMembershipActiveContext(privilegedDb, {
      userId: user.id,
      orgId,
      branchId: defaultBranchId,
    })
  } catch (error) {
    if (isUniqueConstraintError(error, ['slug'])) {
      return { error: 'Nama organisasi ini sudah digunakan.' }
    }

    // IF DEMO, SEED DATA
    if (isDemo) {
      try {
        await seedDemoData(supabase, orgId, businessType)
      } catch (seedErr) {
        (console as any).error('Seed Data Error:', seedErr)
      }
    }

    // IF ABS, APPLY VOUCHER AUTOMATICALLY
    if (isAbs) {
      try {
        await applyVoucher(orgId, 'ABS2024')
      } catch (absErr) {
        (console as any).error('ABS Activation Error:', absErr)
      }
    }

    cookieStore.set(ACTIVE_ORG_COOKIE, orgId, getActiveContextCookieOptions())
    cookieStore.set(ACTIVE_BRANCH_COOKIE, defaultBranchId, getActiveContextCookieOptions())

    return {
      success: true,
      orgId,
      branchId: defaultBranchId,
    }
  } catch (error) {
    const message = extractErrorMessage(error)
    if (/Missing SUPABASE_(LOCAL_)?SERVICE_ROLE_KEY/i.test(message)) {
      return { error: 'Konfigurasi service role Supabase belum diisi. Lengkapi environment lalu coba lagi.' }
    }
    if (/Missing NEXT_PUBLIC_SUPABASE_(LOCAL_)?URL|Missing NEXT_PUBLIC_SUPABASE_(LOCAL_)?ANON_KEY/i.test(message)) {
      return { error: 'Konfigurasi Supabase belum lengkap (URL/ANON key). Lengkapi environment lalu coba lagi.' }
    }
    return { error: 'Terjadi kesalahan sistem saat membuat organisasi.' }
  }
}

export async function createOrganization(formData: FormData) {
  const result = await createOrganizationRecord(formData)
  if ('error' in result) return result

  revalidatePath('/dashboard')
  return redirect('/dashboard')
}

export async function getOrgLimits(orgId: string): Promise<{
  maxBranches: number | null
  maxChildOrgs: number | null
  maxUsers: number | null
  currentBranches: number
  currentChildOrgs: number
  currentUsers: number
}> {
  const supabase = await createClient()
  const db = supabase as any

  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) {
    return { maxBranches: null, maxChildOrgs: null, maxUsers: null, currentBranches: 0, currentChildOrgs: 0, currentUsers: 0 }
  }

  // Ambil plan dari settings organisasi
  const { data: org } = await db
    .from('organizations')
    .select('settings')
    .eq('id', trimmedOrgId)
    .maybeSingle()

  const planName = org?.settings?.plan

  // Ambil limits dari saas_packages
  let maxBranches: number | null = null
  let maxChildOrgs: number | null = null
  let maxUsers: number | null = null

  if (planName) {
    const { data: pkg } = await db
      .from('saas_packages')
      .select('max_branches, max_child_orgs, max_users')
      .eq('name', planName)
      .eq('is_active', true)
      .maybeSingle()

    if (pkg) {
      maxBranches   = pkg.max_branches   ?? null
      maxChildOrgs  = pkg.max_child_orgs ?? null
      maxUsers      = pkg.max_users      ?? null
    }
  }

  // Hitung usage saat ini
  const [{ count: branchCount }, { count: childOrgCount }, { count: userCount }] = await Promise.all([
    db.from('branches').select('id', { count: 'exact', head: true }).eq('org_id', trimmedOrgId).eq('is_active', true),
    db.from('organizations').select('id', { count: 'exact', head: true }).eq('parent_org_id', trimmedOrgId),
    db.from('org_members').select('id', { count: 'exact', head: true }).eq('org_id', trimmedOrgId).eq('is_active', true),
  ])

  return {
    maxBranches,
    maxChildOrgs,
    maxUsers,
    currentBranches:  branchCount   ?? 0,
    currentChildOrgs: childOrgCount ?? 0,
    currentUsers:     userCount     ?? 0,
  }
}

export async function linkSubOrganization(parentOrgId: string, childOrgId: string) {
  const trimmedParentOrgId = String(parentOrgId || '').trim()
  const trimmedChildOrgId = String(childOrgId || '').trim()

  if (!trimmedParentOrgId || !trimmedChildOrgId) {
    return { error: 'Data organisasi tidak valid.' }
  }

  if (trimmedParentOrgId === trimmedChildOrgId) {
    return { error: 'Organisasi induk dan anak tidak boleh sama.' }
  }

  const holdingContext = await getHoldingManagementContext(trimmedParentOrgId, { ownerOnly: true })
  if ('error' in holdingContext) return { error: holdingContext.error }
  const { db, userId, activeOrgId } = holdingContext

  // ── Enforce child org limit ────────────────────────────────────────────
  const limits = await getOrgLimits(trimmedParentOrgId)
  if (limits.maxChildOrgs !== null && limits.currentChildOrgs >= limits.maxChildOrgs) {
    return {
      error: `Batas anak perusahaan tercapai (${limits.currentChildOrgs}/${limits.maxChildOrgs}). Upgrade paket SaaS Anda untuk menambah lebih banyak entitas.`,
    }
  }

  const { data: childOrgMembership } = await db
    .from('org_members')
    .select('org_id')
    .eq('org_id', trimmedChildOrgId)
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .maybeSingle()

  if (!childOrgMembership) {
    return { error: 'Hanya OWNER organisasi target yang dapat menautkan entitas sebagai anak perusahaan.' }
  }

  const { data: childOrg, error: childOrgError } = await db
    .from('organizations')
    .select('id, parent_org_id')
    .eq('id', trimmedChildOrgId)
    .maybeSingle()

  if (childOrgError || !childOrg) {
    return { error: 'Organisasi yang akan ditautkan tidak ditemukan.' }
  }

  if (childOrg.parent_org_id && childOrg.parent_org_id !== activeOrgId) {
    return { error: 'Organisasi tersebut sudah terhubung ke holding lain.' }
  }

  if (childOrg.parent_org_id === activeOrgId) {
    return { success: true }
  }

  const { error } = await db
    .from('organizations')
    .update({ parent_org_id: activeOrgId, updated_at: new Date().toISOString() })
    .eq('id', trimmedChildOrgId)

  if (error) return { error: error.message }

  const coaSync = await syncParentCoAToChildOrg(activeOrgId, trimmedChildOrgId)
  if (!coaSync.success) {
    ;(console as any).warn('CoA sync warning (linkSubOrganization):', coaSync.error)
  }

  revalidatePath('/settings/sub-orgs')
  revalidatePath('/reports')
  return { success: true }
}

export async function assignSubOrgManager(childOrgId: string, employeeId: string | null) {
  const trimmedChildOrgId = String(childOrgId || '').trim()
  if (!trimmedChildOrgId) return { error: 'Anak perusahaan tidak valid.' }
  const managerFeatureEnabled = await isSubOrgManagerFeatureEnabled()
  if (!managerFeatureEnabled) {
    return { error: 'Fitur PIC anak perusahaan belum aktif. Jalankan migrasi 1128 dan reload schema Supabase.' }
  }

  const normalizedEmployeeId = String(employeeId || '').trim() || null

  const holdingContext = await getHoldingManagementContext(undefined, { ownerOnly: true })
  if ('error' in holdingContext) return { error: holdingContext.error }
  const { db, activeOrgId } = holdingContext

  const { data: childOrg } = await db
    .from('organizations')
    .select('id')
    .eq('id', trimmedChildOrgId)
    .eq('parent_org_id', activeOrgId)
    .maybeSingle()

  if (!childOrg) {
    return { error: 'Organisasi tersebut tidak terdaftar sebagai anak dari holding aktif.' }
  }

  if (normalizedEmployeeId) {
    const { data: employee } = await db
      .from('employees')
      .select('id')
      .eq('id', normalizedEmployeeId)
      .eq('org_id', activeOrgId)
      .maybeSingle()

    if (!employee) {
      return { error: 'PIC harus berasal dari organisasi induk yang sedang aktif.' }
    }
  }

  const { error } = await db
    .from('organizations')
    .update({ manager_employee_id: normalizedEmployeeId, updated_at: new Date().toISOString() })
    .eq('id', trimmedChildOrgId)
    .eq('parent_org_id', activeOrgId)

  if (error) return { error: error.message }
  revalidatePath('/settings/sub-orgs')
  return { success: true }
}

export async function updateChildOrganization(childOrgId: string, name: string) {
  const trimmedChildOrgId = String(childOrgId || '').trim()
  const trimmedName = String(name || '').trim()

  if (!trimmedChildOrgId) return { error: 'Anak perusahaan tidak valid.' }
  if (!trimmedName) return { error: 'Nama organisasi wajib diisi.' }

  const slug = generateSlug(trimmedName)
  if (!slug) return { error: 'Nama organisasi tidak valid untuk dibuatkan slug.' }

  const holdingContext = await getHoldingManagementContext(undefined, { ownerOnly: true })
  if ('error' in holdingContext) return { error: holdingContext.error }
  const { db, activeOrgId } = holdingContext

  const { data: childOrg, error: childOrgError } = await db
    .from('organizations')
    .select('id, parent_org_id')
    .eq('id', trimmedChildOrgId)
    .maybeSingle()

  if (childOrgError || !childOrg) {
    return { error: 'Organisasi anak tidak ditemukan.' }
  }

  if (childOrg.parent_org_id !== activeOrgId) {
    return { error: 'Organisasi tersebut tidak terdaftar sebagai anak dari holding aktif.' }
  }

  const { error: updateError } = await db
    .from('organizations')
    .update({
      name: trimmedName,
      slug,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trimmedChildOrgId)
    .eq('parent_org_id', activeOrgId)

  if (updateError) {
    if (updateError.code === '23505') {
      return { error: 'Nama organisasi ini sudah digunakan.' }
    }
    return { error: updateError.message || 'Gagal memperbarui organisasi anak.' }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/settings/sub-orgs')
  revalidatePath('/reports')
  return { success: true }
}

export async function deleteChildOrganization(childOrgId: string) {
  const trimmedChildOrgId = String(childOrgId || '').trim()
  if (!trimmedChildOrgId) return { error: 'Anak perusahaan tidak valid.' }

  const holdingContext = await getHoldingManagementContext(undefined, { ownerOnly: true })
  if ('error' in holdingContext) return { error: holdingContext.error }
  const { db, userId, activeOrgId } = holdingContext

  const { data: childOrg, error: childOrgError } = await db
    .from('organizations')
    .select('id, parent_org_id')
    .eq('id', trimmedChildOrgId)
    .maybeSingle()

  if (childOrgError || !childOrg) {
    return { error: 'Organisasi anak tidak ditemukan.' }
  }

  if (childOrg.parent_org_id !== activeOrgId) {
    return { error: 'Organisasi tersebut tidak terdaftar sebagai anak dari holding aktif.' }
  }

  const { data: childMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', trimmedChildOrgId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (String(childMembership?.role || '').toLowerCase() !== 'owner') {
    return { error: 'Untuk menghapus anak perusahaan, akun Anda harus OWNER pada organisasi anak tersebut.' }
  }

  const { error: deleteError } = await db
    .from('organizations')
    .delete()
    .eq('id', trimmedChildOrgId)
    .eq('parent_org_id', activeOrgId)

  if (deleteError) {
    return { error: deleteError.message || 'Gagal menghapus organisasi anak.' }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/settings/sub-orgs')
  revalidatePath('/reports')
  return { success: true }
}

export async function setOrganizationParent(childOrgId: string, parentOrgId: string | null) {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedChildOrgId = String(childOrgId || '').trim()
  const trimmedParentOrgId = String(parentOrgId || '').trim() || null

  if (!trimmedChildOrgId) {
    return { error: 'Organisasi anak tidak valid.' }
  }

  if (trimmedParentOrgId && trimmedChildOrgId === trimmedParentOrgId) {
    return { error: 'Organisasi tidak bisa menjadi induk untuk dirinya sendiri.' }
  }

  const { data: childMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', trimmedChildOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!childMembership || String(childMembership.role || '').toLowerCase() !== 'owner') {
    return { error: 'Hanya OWNER organisasi anak yang dapat mengubah hierarki.' }
  }

  if (trimmedParentOrgId) {
    const { data: parentMembership } = await db
      .from('org_members')
      .select('role')
      .eq('org_id', trimmedParentOrgId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    const parentRole = String(parentMembership?.role || '').toLowerCase()
    if (!parentMembership || parentRole !== 'owner') {
      return { error: 'Anda harus OWNER di organisasi induk tujuan.' }
    }
  }

  const { data: childOrg, error: childOrgError } = await db
    .from('organizations')
    .select('id, parent_org_id')
    .eq('id', trimmedChildOrgId)
    .maybeSingle()

  if (childOrgError || !childOrg) {
    return { error: 'Organisasi anak tidak ditemukan.' }
  }

  if ((childOrg.parent_org_id || null) === trimmedParentOrgId) {
    return { success: true }
  }

  if (trimmedParentOrgId) {
    const { data: parentOrg, error: parentOrgError } = await db
      .from('organizations')
      .select('id, parent_org_id')
      .eq('id', trimmedParentOrgId)
      .maybeSingle()

    if (parentOrgError || !parentOrg) {
      return { error: 'Organisasi induk tujuan tidak ditemukan.' }
    }

    // Anti-cycle guard: walk upward from parent candidate and ensure child is never encountered.
    let cursor: string | null = trimmedParentOrgId
    let depth = 0
    while (cursor && depth < 50) {
      if (cursor === trimmedChildOrgId) {
        return { error: 'Relasi induk-anak tidak valid karena membentuk siklus.' }
      }

      const { data: currentOrg, error: currentOrgError }: { data: { parent_org_id: string | null } | null; error: unknown } = await db
        .from('organizations')
        .select('parent_org_id')
        .eq('id', cursor)
        .maybeSingle()

      if (currentOrgError || !currentOrg) break
      cursor = currentOrg.parent_org_id || null
      depth += 1
    }
  }

  const { error: updateError } = await db
    .from('organizations')
    .update({
      parent_org_id: trimmedParentOrgId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trimmedChildOrgId)

  if (updateError) return { error: updateError.message }

  if (trimmedParentOrgId) {
    const coaSync = await syncParentCoAToChildOrg(trimmedParentOrgId, trimmedChildOrgId)
    if (!coaSync.success) {
      ;(console as any).warn('CoA sync warning (setOrganizationParent):', coaSync.error)
    }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/settings/sub-orgs')
  revalidatePath('/reports')
  return { success: true }
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

  const { data, error } = await db
    .from('org_members')
    .select('org_id, role, role_id, joined_at, organizations(id, name, slug, logo_url, settings, is_active, parent_org_id)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })

    const results: AccessibleOrganization[] = []

  const parentOrgIds = Array.from(
    new Set(
      (data || [])
        .map((membership: any) => {
          const parentOrgId = membership?.organizations?.parent_org_id
          return typeof parentOrgId === 'string' && parentOrgId.trim() ? parentOrgId.trim() : null
        })
        .filter((orgId): orgId is string => Boolean(orgId))
    )
  )

  let parentOrgNameById = new Map<string, string>()
  if (parentOrgIds.length > 0) {
    const { data: parentRows, error: parentRowsError } = await db
      .from('organizations')
      .select('id, name')
      .in('id', parentOrgIds)

    if (!parentRowsError && Array.isArray(parentRows)) {
      parentOrgNameById = new Map(
        parentRows
          .filter((row: any) => row?.id && row?.name)
          .map((row: any) => [String(row.id), String(row.name)])
      )
    }
  }

  const mapped: (AccessibleOrganization | null)[] = data.map((membership: any) => {
    const org = membership.organizations
    if (!org || typeof org !== 'object') return null
    const parentOrgId = typeof org.parent_org_id === 'string' ? org.parent_org_id : null

    return {
      orgId: membership.org_id,
      role: membership.role || 'staff',
      roleId: membership.role_id || null,
      joinedAt: membership.joined_at || new Date(0).toISOString(),
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo_url: org.logo_url ?? null,
        settings: org.settings ?? {},
        is_active: Boolean(org.is_active),
        parent_org_id: parentOrgId,
        parent_org_name: parentOrgId ? parentOrgNameById.get(parentOrgId) ?? null : null,
      },
    } satisfies AccessibleOrganization
  })
  return mapped.filter((m): m is AccessibleOrganization => m !== null)
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

export async function isSubOrgManagerFeatureEnabled() {
  const admin = (await createAdminClient()) as any
  const { error } = await admin
    .from('organizations')
    .select('manager_employee_id')
    .limit(1)

  if (!error) return true

  const message = String(error?.message || '').toLowerCase()
  if (message.includes('manager_employee_id') && (message.includes('schema cache') || message.includes('column'))) {
    return false
  }

  return false
}

/**
 * Ambil semua karyawan di org holding untuk keperluan PIC assignment.
 * Menggunakan admin client agar tidak terpotong oleh RLS branch aktif user.
 */
export async function getHoldingEmployees(orgId: string) {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) return []

  const admin = (await createAdminClient()) as any
  const { data, error } = await admin
    .from('employees')
    .select('id, first_name, last_name, job_title, branch_id')
    .eq('org_id', trimmedOrgId)
    .order('first_name')

  if (error) {
    ;(console as any).error('getHoldingEmployees Error:', error)
    return []
  }

  return data || []
}

export async function getChildOrgs(parentOrgId: string) {
  const trimmedParentOrgId = String(parentOrgId || '').trim()
  if (!trimmedParentOrgId) return []

  const holdingContext = await getHoldingManagementContext(trimmedParentOrgId)
  if ('error' in holdingContext) return []
  const { db } = holdingContext
  const managerFeatureEnabled = await isSubOrgManagerFeatureEnabled()
  const selectFields = managerFeatureEnabled
    ? 'id, name, slug, logo_url, settings, is_active, created_at, manager_employee_id'
    : 'id, name, slug, logo_url, settings, is_active, created_at'

  const admin = (await createAdminClient()) as any
  const { data: adminData, error: adminError } = await admin
    .from('organizations')
    .select(selectFields)
    .eq('parent_org_id', trimmedParentOrgId)
    .order('created_at', { ascending: false })

  if (!adminError) {
    if (managerFeatureEnabled) return adminData || []
    return (adminData || []).map((row: any) => ({ ...row, manager_employee_id: null }))
  }

  const { data: userData, error: userError } = await db
    .from('organizations')
    .select(selectFields)
    .eq('parent_org_id', trimmedParentOrgId)
    .order('created_at', { ascending: false })

  if (!userError) {
    if (managerFeatureEnabled) return userData || []
    return (userData || []).map((row: any) => ({ ...row, manager_employee_id: null }))
  }

  return []
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

  // ── Enforce branch limit dari SaaS plan ───────────────────────────────
  const limits = await getOrgLimits(trimmedOrgId)
  if (limits.maxBranches !== null && limits.currentBranches >= limits.maxBranches) {
    return {
      error: `Batas cabang tercapai (${limits.currentBranches}/${limits.maxBranches}). Upgrade paket SaaS Anda untuk menambah lebih banyak cabang.`,
    }
  }

  const { data: duplicateNameBranch } = await db
    .from('branches')
    .select('id')
    .eq('org_id', trimmedOrgId)
    .eq('name', name)
    .maybeSingle()

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

export async function updateBranch(orgId: string, branchId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = String(orgId || '').trim()
  const trimmedBranchId = String(branchId || '').trim()
  const name = String(formData.get('name') || '').trim()
  const code = String(formData.get('code') || '').trim().toUpperCase()
  const addressRaw = String(formData.get('address') || '').trim()
  const address = addressRaw || null

  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }
  if (!trimmedBranchId) return { error: 'Cabang tidak valid.' }
  if (!name) return { error: 'Nama cabang wajib diisi.' }
  if (!code) return { error: 'Kode cabang wajib diisi.' }

  // Check actor permissions
  const { data: actorMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', trimmedOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!actorMembership || !['owner', 'admin'].includes(String(actorMembership.role || ''))) {
    return { error: 'Hanya owner atau admin yang dapat mengubah cabang.' }
  }

  // Duplicate check (ignore self)
  const { data: dupName } = await db
    .from('branches')
    .select('id')
    .eq('org_id', trimmedOrgId)
    .eq('name', name)
    .neq('id', trimmedBranchId)
    .maybeSingle()
  if (dupName?.id) return { error: 'Nama cabang sudah digunakan.' }

  const { data: dupCode } = await db
    .from('branches')
    .select('id')
    .eq('org_id', trimmedOrgId)
    .eq('code', code)
    .neq('id', trimmedBranchId)
    .maybeSingle()
  if (dupCode?.id) return { error: 'Kode cabang sudah digunakan.' }

  const { error: updateError } = await db
    .from('branches')
    .update({ name, code, address, updated_at: new Date().toISOString() })
    .eq('id', trimmedBranchId)
    .eq('org_id', trimmedOrgId)

  if (updateError) return { error: updateError.message || 'Gagal memperbarui cabang.' }

  revalidatePath('/settings/branches')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteBranch(orgId: string, branchId: string) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = String(orgId || '').trim()
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }
  if (!trimmedBranchId) return { error: 'Cabang tidak valid.' }

  const { data: actorMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', trimmedOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!actorMembership || String(actorMembership.role || '') !== 'owner') {
    return { error: 'Hanya owner yang dapat menghapus cabang.' }
  }

  // Prevent deleting the only branch
  const { count: branchCount } = await db
    .from('branches')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', trimmedOrgId)
    .eq('is_active', true)

  if ((branchCount ?? 0) <= 1) {
    return { error: 'Tidak dapat menghapus satu-satunya cabang yang aktif.' }
  }

  // ── Pre-flight: cek semua tabel yang punya FK NOT NULL ke branches ──
  // Tabel-tabel ini tidak bisa pakai ON DELETE SET NULL karena kolomnya NOT NULL,
  // sehingga harus dicek manual sebelum delete.
  const blockerTables: { table: string; label: string }[] = [
    { table: 'bank_accounts',          label: 'Akun Bank'          },
    { table: 'bank_transactions',      label: 'Transaksi Bank'     },
    { table: 'bank_mutations',         label: 'Mutasi Bank'        },
    { table: 'service_orders',         label: 'Order Jasa'         },
    { table: 'fleet_assets',           label: 'Armada'             },
    { table: 'fleet_bookings',         label: 'Booking Armada'     },
    { table: 'fleet_routes',           label: 'Rute Armada'        },
    { table: 'fleet_schedules',        label: 'Jadwal Armada'      },
    { table: 'fleet_tickets',          label: 'Tiket Armada'       },
    { table: 'fleet_maintenance_labs', label: 'Perawatan Armada'   },
    { table: 'fleet_terminals',        label: 'Terminal Armada'    },
  ]

  const blockers: string[] = []
  for (const { table, label } of blockerTables) {
    try {
      const { count } = await db
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', trimmedBranchId)
      if ((count ?? 0) > 0) {
        blockers.push(`${label} (${count} data)`)
      }
    } catch {
      // Tabel mungkin belum ada di schema ini — skip
    }
  }

  if (blockers.length > 0) {
    return {
      error: `Cabang ini tidak dapat dihapus karena masih memiliki data terkait:\n• ${blockers.join('\n• ')}\n\nPindahkan atau hapus data tersebut terlebih dahulu sebelum menghapus cabang.`,
    }
  }

  const { error: deleteError } = await db
    .from('branches')
    .delete()
    .eq('id', trimmedBranchId)
    .eq('org_id', trimmedOrgId)

  if (deleteError) {
    // Tangkap FK violation yang mungkin masih lolos dari pre-flight check
    if (deleteError.code === '23503') {
      return { error: 'Cabang masih memiliki data terkait dan tidak dapat dihapus. Hapus semua data yang menggunakan cabang ini terlebih dahulu.' }
    }
    return { error: deleteError.message || 'Gagal menghapus cabang.' }
  }

  revalidatePath('/settings/branches')
  revalidatePath('/', 'layout')
  return { success: true }
}


export async function assignBranchPIC(orgId: string, branchId: string, employeeId: string | null) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = String(orgId || '').trim()
  const trimmedBranchId = String(branchId || '').trim()
  const normalizedEmployeeId = String(employeeId || '').trim() || null

  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }
  if (!trimmedBranchId) return { error: 'Cabang tidak valid.' }

  const { data: actorMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', trimmedOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!actorMembership || !['owner', 'admin'].includes(String(actorMembership.role || ''))) {
    return { error: 'Hanya owner atau admin yang dapat mengubah PIC cabang.' }
  }

  if (normalizedEmployeeId) {
    const { data: employee } = await db
      .from('employees')
      .select('id')
      .eq('id', normalizedEmployeeId)
      .eq('org_id', trimmedOrgId)
      .maybeSingle()
    if (!employee) return { error: 'PIC harus berasal dari organisasi aktif.' }
  }

  const { error: updateError } = await db
    .from('branches')
    .update({ pic_employee_id: normalizedEmployeeId, updated_at: new Date().toISOString() })
    .eq('id', trimmedBranchId)
    .eq('org_id', trimmedOrgId)

  if (updateError) return { error: updateError.message || 'Gagal menyimpan PIC cabang.' }

  revalidatePath('/settings/branches')
  return { success: true }
}

export async function updateMemberUnitAccess(orgId: string, memberId: string, branchIds: string[]) {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

export async function updateOrgMemberRole(
  orgId: string,
  memberId: string,
  nextRole: string
) {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Unauthorized' }

  const trimmedOrgId = String(orgId || '').trim()
  const trimmedMemberId = String(memberId || '').trim()
  const normalizedRole = normalizeMemberRole(nextRole)

  if (!trimmedOrgId || !trimmedMemberId) {
    return { error: 'Data anggota tidak valid.' }
  }

  if (!normalizedRole) {
    return { error: 'Peran tidak valid.' }
  }

  const actorMembership = await getOrgMembership(user.id, trimmedOrgId)
  if (!actorMembership) {
    return { error: 'Anda tidak memiliki akses ke organisasi ini.' }
  }

  if (!actorMembership.isOwnerOrAdmin) {
    return { error: 'Hanya owner atau admin yang dapat mengubah peran anggota.' }
  }

  const targetMembership = await prisma.org_members.findFirst({
    where: {
      id: trimmedMemberId,
      org_id: trimmedOrgId,
      is_active: true,
    },
    select: {
      id: true,
      user_id: true,
      role: true,
      role_id: true,
    },
  })

  if (!targetMembership) {
    return { error: 'Anggota organisasi tidak ditemukan.' }
  }

  const currentRole = String(targetMembership.role || 'staff').toLowerCase()
  if (currentRole === normalizedRole) {
    return {
      success: true,
      memberId: trimmedMemberId,
      role: normalizedRole,
      roleId: targetMembership.role_id ?? null,
    }
  }

  if (currentRole === 'owner' && normalizedRole !== 'owner') {
    const ownerCount = await prisma.org_members.count({
      where: {
        org_id: trimmedOrgId,
        role: 'owner',
        is_active: true,
      },
    })

    if (ownerCount <= 1) {
      return { error: 'Organisasi harus memiliki minimal satu owner aktif.' }
    }
  }

  try {
    const updatedMembership = await prisma.org_members.update({
      where: { id: trimmedMemberId },
      data: {
        role: normalizedRole,
      },
      select: {
        id: true,
        role: true,
        role_id: true,
      },
    })

    revalidatePath('/settings/users')
    revalidatePath('/', 'layout')
    return {
      success: true,
      memberId: updatedMembership.id,
      role: updatedMembership.role,
      roleId: updatedMembership.role_id ?? null,
    }
  } catch (error) {
    console.error('updateOrgMemberRole Error:', error)
    return { error: 'Gagal memperbarui peran anggota.' }
  }
}

export async function removeOrgMember(orgId: string, memberId: string) {
  const user = await getAuthenticatedUser()
  if (!user) return { error: 'Unauthorized' }

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
    return { error: 'Hanya owner atau admin yang dapat menghapus anggota.' }
  }

  const targetMembership = await prisma.org_members.findFirst({
    where: {
      id: trimmedMemberId,
      org_id: trimmedOrgId,
      is_active: true,
    },
    select: {
      id: true,
      user_id: true,
      role: true,
    },
  })

  if (!targetMembership) {
    return { error: 'Anggota organisasi tidak ditemukan.' }
  }

  if (targetMembership.user_id === user.id) {
    return { error: 'Anda tidak dapat menghapus keanggotaan Anda sendiri.' }
  }

  if (String(targetMembership.role || '').toLowerCase() === 'owner') {
    const ownerCount = await prisma.org_members.count({
      where: {
        org_id: trimmedOrgId,
        role: 'owner',
        is_active: true,
      },
    })

    if (ownerCount <= 1) {
      return { error: 'Organisasi harus memiliki minimal satu owner aktif.' }
    }
  }

  try {
    await prisma.org_members.delete({
      where: { id: trimmedMemberId },
    })
  } catch (error) {
    console.error('removeOrgMember Error:', error)
    return { error: 'Gagal menghapus anggota organisasi.' }
  }

  revalidatePath('/settings/users')
  revalidatePath('/', 'layout')
  return {
    success: true,
    memberId: trimmedMemberId,
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
