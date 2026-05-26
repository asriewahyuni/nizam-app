'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getServerAuthContext } from '@/lib/supabase/auth.server'
import { isInternalAuthProvider } from '@/lib/auth/provider'
import { normalizeSaasEntitlementName } from '@/lib/saas/module-catalog'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import {
  buildLogoStorageKey,
  buildPublicStorageObjectPath,
  deleteObjectFromStorage,
  extractManagedStorageKey,
  isObjectStorageFeatureEnabled,
  uploadObjectToStorage,
} from '@/lib/storage/object-storage.server'
import { generateSlug } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { seedDemoData, type DemoBusinessType } from '@/modules/demo/actions/demo.actions'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { ensureShadowAuthUserForInternalUser } from '@/lib/auth/internal-auth-shadow.server'
import {
  ACTIVE_BRANCH_COOKIE,
  ACTIVE_ORG_COOKIE,
  type AccessibleOrganization,
  type BranchSummary,
} from '@/modules/organization/lib/org-context'
import type { CoAManagementMode } from '@/types/database.types'
import {
  persistMembershipActiveContext,
  resolveActiveMembership,
} from '@/modules/organization/lib/active-context.server'
import {
  canAccessAllBranchesForOrg,
  getBranchAccessScope,
  getCurrentAccessibleBranch,
} from '@/modules/organization/lib/branch-access.server'
import { applyVoucher } from './billing.actions'
import { syncParentCoAToChildOrg } from '@/modules/accounting/actions/coa.actions'
import { nudgeEduModeValidation } from '@/modules/edu/lib/progress-hooks.server'

const ACTIVE_CONTEXT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const DEFAULT_BRANCH_NAME = 'Unit Utama'
const DEFAULT_BRANCH_CODE = 'MAIN'
const DEMO_ACCOUNT_EMAIL = 'demo@nizam.app'
const DEMO_SESSION_COOKIE_MAX_AGE = 60 * 60 * 12
const TRIAL_PLAN_NAME = 'Trial'
const DEFAULT_TRIAL_DURATION_DAYS = 3
const TRIAL_REUSE_BLOCK_MESSAGE = 'Akun ini sudah pernah menggunakan paket Trial. Trial hanya bisa dipakai sekali per akun. Silakan lanjut dengan paket berbayar atau voucher.'

async function getAuthenticatedUserFromSupabaseOrInternal(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.id) {
    return user as { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }
  }

  const internalSession = await getInternalAuthSession()
  if (!internalSession?.user?.id) return null

  return {
    id: internalSession.user.id,
    email: internalSession.user.email,
    user_metadata: internalSession.user.user_metadata as Record<string, unknown> | null,
  }
}
const FULL_ORG_ACCESS_ROLES = new Set(['owner', 'admin'])

type OrgMembershipBranchScope = {
  accessibleBranches: BranchSummary[]
  canAccessAllBranches: boolean
}

type OrganizationMembershipRow = {
  id: string
  org_id: string
  role: string | null
}

type OrganizationBranchRow = {
  id: string
  org_id: string
  name: string
  code: string | null
  address: string | null
  is_active: boolean | null
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
  branchAccessScope: OrgMembershipBranchScope
) {
  if (branchAccessScope.accessibleBranches.length === 1) {
    return branchAccessScope.accessibleBranches[0]?.id ?? null
  }

  if (!branchAccessScope.canAccessAllBranches) {
    return branchAccessScope.accessibleBranches[0]?.id ?? null
  }

  return null
}

function normalizeOrganizationBranches(rows: OrganizationBranchRow[]): BranchSummary[] {
  return rows.map((branch) => ({
    id: String(branch.id),
    org_id: String(branch.org_id),
    name: String(branch.name),
    code: String(branch.code || ''),
    address: branch.address ? String(branch.address) : null,
    is_active: Boolean(branch.is_active),
  }))
}

function groupBranchesByOrgId(rows: BranchSummary[]) {
  return rows.reduce<Record<string, BranchSummary[]>>((acc, branch) => {
    const bucket = acc[branch.org_id] || []
    bucket.push(branch)
    acc[branch.org_id] = bucket
    return acc
  }, {})
}

function normalizeRoleName(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function getLegacyRoleLabel(role: string | null | undefined) {
  const normalizedRole = normalizeRoleName(role)
  if (normalizedRole === 'manager') return 'Manager'
  if (normalizedRole === 'staff') return 'Staff'
  if (normalizedRole === 'viewer') return 'Viewer'
  return null
}

async function resolveFallbackMembershipRole(
  db: any,
  orgId: string,
  input: {
    membershipRoleId?: string | null
    employeeRoleId?: string | null
    employeeJobTitle?: string | null
    membershipRole?: string | null
  }
) {
  const { data: roleRows, error } = await db
    .from('roles')
    .select('id, name, permissions')
    .eq('org_id', orgId)

  if (error || !Array.isArray(roleRows) || roleRows.length === 0) {
    return null
  }

  const orderedRoleIds = [
    String(input.membershipRoleId || '').trim(),
    String(input.employeeRoleId || '').trim(),
  ].filter(Boolean)

  const fallbackById = orderedRoleIds
    .map((roleId) => roleRows.find((role: any) => String(role?.id || '').trim() === roleId))
    .find(Boolean)
  if (fallbackById) return fallbackById

  const normalizedJobTitle = normalizeRoleName(input.employeeJobTitle)
  if (normalizedJobTitle) {
    const fallbackByJobTitle = roleRows.find(
      (role: any) => normalizeRoleName(role?.name) === normalizedJobTitle
    )
    if (fallbackByJobTitle) return fallbackByJobTitle
  }

  const legacyRoleLabel = getLegacyRoleLabel(input.membershipRole)
  if (legacyRoleLabel) {
    const fallbackLegacyRole = roleRows.find(
      (role: any) => normalizeRoleName(role?.name) === legacyRoleLabel.toLowerCase()
    )
    if (fallbackLegacyRole) return fallbackLegacyRole
  }

  return null
}

async function resolveAccessibleBranchesForMembership(
  admin: any,
  membership: OrganizationMembershipRow
): Promise<OrgMembershipBranchScope> {
  const { data: branchRows, error: branchesError } = await admin
    .from('branches')
    .select('id, org_id, name, code, address, is_active')
    .eq('org_id', membership.org_id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (branchesError || !Array.isArray(branchRows)) {
    return {
      accessibleBranches: [],
      canAccessAllBranches: false,
    }
  }

  const activeBranches = normalizeOrganizationBranches(branchRows as OrganizationBranchRow[])
  if (activeBranches.length === 0) {
    return {
      accessibleBranches: [],
      canAccessAllBranches: false,
    }
  }

  if (FULL_ORG_ACCESS_ROLES.has(String(membership.role || '').toLowerCase())) {
    return {
      accessibleBranches: activeBranches,
      canAccessAllBranches: true,
    }
  }

  const { data: assignmentRows, error: assignmentsError } = await admin
    .from('org_member_units')
    .select('branch_id')
    .eq('org_id', membership.org_id)
    .eq('org_member_id', membership.id)

  if (assignmentsError || !Array.isArray(assignmentRows)) {
    return {
      accessibleBranches: [],
      canAccessAllBranches: false,
    }
  }

  const assignedBranchIds = new Set(
    assignmentRows
      .map((assignment) => String(assignment?.branch_id || '').trim())
      .filter(Boolean)
  )
  const accessibleBranches = activeBranches.filter((branch) => assignedBranchIds.has(branch.id))

  return {
    accessibleBranches,
    canAccessAllBranches:
      accessibleBranches.length > 0 && accessibleBranches.length === activeBranches.length,
  }
}

type CreateOrganizationSuccess = {
  success: true
  orgId: string
  branchId: string
  preservedContext: boolean
  organization: {
    id: string
    name: string
    slug: string
    logo_url: string | null
    settings: Record<string, unknown>
    is_active: boolean
    created_at: string
    manager_employee_id: string | null
    coa_management_mode: CoAManagementMode
  }
}

type CreateOrganizationFailure = {
  error: string
}

type CreateOrganizationActionResult = CreateOrganizationSuccess | CreateOrganizationFailure

type HoldingContextSuccess = {
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

type RpcClient = {
  rpc: (
    fn: string,
    params?: Record<string, unknown>
  ) => Promise<{ error: { message?: string | null } | null }>
}

const OPTIONAL_ORGANIZATION_COLUMNS = new Set(['owner_email', 'parent_org_id', 'is_demo', 'coa_management_mode'])
const DEFAULT_COA_MANAGEMENT_MODE: CoAManagementMode = 'INHERITED'

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

function normalizeCoAManagementMode(value: unknown): CoAManagementMode {
  return String(value || '').trim().toUpperCase() === 'LOCAL' ? 'LOCAL' : 'INHERITED'
}

function isMissingOrganizationColumn(error: unknown, columnName: string) {
  return extractMissingColumnName(error) === columnName
}

function isMissingCoAConsolidationMappingsSchemaError(error: unknown) {
  const rawMessage = extractErrorMessage(error).trim().toLowerCase()
  return (
    rawMessage.includes('coa_consolidation_mappings') &&
    (rawMessage.includes('does not exist') || rawMessage.includes('schema cache') || rawMessage.includes('relation'))
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDemoPlanName(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'demo'
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function readPlanNameFromSettings(settings: unknown): string | null {
  if (!isPlainObject(settings)) return null

  const rawPlan = settings.plan
  if (typeof rawPlan !== 'string') return null

  const trimmedPlan = rawPlan.trim()
  return trimmedPlan || null
}

function readDemoFlagFromSettings(settings: unknown): boolean {
  // Hanya baca settings.is_demo sebagai fallback legacy (migrasi lama).
  // Jangan pernah derive isDemo dari nama plan di settings — itu rawan false-positive
  // (org non-demo dengan plan bernama "Demo" akan ke-flag salah).
  // Sumber kebenaran utama = kolom organizations.is_demo di DB.
  if (!isPlainObject(settings)) return false
  return Boolean(settings.is_demo)
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value) return null

  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function resolveOrganizationSubscriptionEnd(org: unknown): Date | null {
  if (!isPlainObject(org)) return null

  const settings = isPlainObject(org.settings) ? org.settings : null
  const candidates = [
    parseOptionalDate(org.subscription_end),
    parseOptionalDate(settings?.expires_at),
  ].filter((candidate): candidate is Date => candidate instanceof Date)

  if (candidates.length === 0) return null

  return candidates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest
  )
}

function isDemoAccountUser(user: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  if (!user) return false
  const normalizedEmail = String(user.email || '').trim().toLowerCase()
  if (normalizedEmail === DEMO_ACCOUNT_EMAIL) return true
  return Boolean(user.user_metadata && (user.user_metadata as Record<string, unknown>).is_demo)
}

function hasUnlimitedSubscriptionAccess(input: {
  userEmail?: string | null
  org?: unknown
}) {
  if (isPlatformAdminEmail(input.userEmail)) return true
  if (!isPlainObject(input.org)) return false
  return isPlatformAdminEmail(
    typeof input.org.owner_email === 'string' ? input.org.owner_email : null
  )
}

async function getOrganizationPackageState(
  db: any,
  orgId: string
): Promise<{ plan: string | null; isDemo: boolean }> {
  const trimmedOrgId = String(orgId || '').trim()
  if (!trimmedOrgId) {
    return { plan: null, isDemo: false }
  }

  const { data: orgRow, error } = await db
    .from('organizations')
    .select('is_demo, settings')
    .eq('id', trimmedOrgId)
    .maybeSingle()

  if (error || !orgRow) {
    return { plan: null, isDemo: false }
  }

  const plan = readPlanNameFromSettings(orgRow.settings)
  // Sumber kebenaran utama = organizations.is_demo (kolom DB).
  // settings.is_demo hanya sebagai fallback legacy (org lama sebelum kolom is_demo ada).
  // isDemoPlanName(plan) DIHAPUS — nama plan "Demo" bukan indikator org adalah demo.
  const isDemo = Boolean(orgRow.is_demo) || readDemoFlagFromSettings(orgRow.settings)

  return { plan, isDemo }
}

async function hasConsumedTrial(
  db: any,
  user: { id?: string | null; email?: string | null }
): Promise<boolean> {
  const authUserId = String(user.id || '').trim()
  const email = normalizeEmail(user.email)

  if (!authUserId && !email) return false

  if (authUserId) {
    const { data: byUser, error: byUserError } = await db
      .from('saas_trial_claims')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (byUserError) {
      throw new Error(byUserError.message || 'Gagal memeriksa riwayat Trial berdasarkan akun.')
    }
    if (byUser?.id) return true
  }

  if (email) {
    const { data: byEmail, error: byEmailError } = await db
      .from('saas_trial_claims')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (byEmailError) {
      throw new Error(byEmailError.message || 'Gagal memeriksa riwayat Trial berdasarkan email.')
    }
    if (byEmail?.id) return true
  }

  return false
}

async function recordTrialClaim(
  db: any,
  input: {
    authUserId?: string | null
    email?: string | null
    orgId: string
    claimedAt?: string | null
  }
) {
  const authUserId = String(input.authUserId || '').trim() || null
  const email = normalizeEmail(input.email)

  if (!authUserId && !email) {
    return { error: 'Akun Trial tidak valid karena identitas user/email kosong.' as const }
  }

  const payload = {
    auth_user_id: authUserId,
    email,
    first_org_id: input.orgId,
    claimed_at: input.claimedAt || new Date().toISOString(),
  }

  const { error } = await db
    .from('saas_trial_claims')
    .insert(payload)

  if (!error) return { success: true as const }

  if (String(error.code || '').trim() === '23505') {
    return { error: TRIAL_REUSE_BLOCK_MESSAGE }
  }

  return {
    error: error.message || 'Gagal mencatat penggunaan Trial untuk akun ini.',
  }
}

function mergeOrganizationSettingsWithPlanState(
  settings: unknown,
  packageState: { plan: string | null; isDemo: boolean }
) {
  const nextSettings = isPlainObject(settings) ? { ...settings } : {}

  if (packageState.plan) {
    nextSettings.plan = packageState.plan
  }
  nextSettings.is_demo = packageState.isDemo

  return nextSettings
}

async function syncChildOrganizationPlanFromParent(
  db: any,
  parentOrgId: string,
  childOrgId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmedParentOrgId = String(parentOrgId || '').trim()
  const trimmedChildOrgId = String(childOrgId || '').trim()
  if (!trimmedParentOrgId || !trimmedChildOrgId) {
    return { success: false, error: 'Parameter sinkronisasi paket parent-child tidak valid.' }
  }
  if (trimmedParentOrgId === trimmedChildOrgId) {
    return { success: false, error: 'Sinkronisasi paket parent-child tidak bisa dilakukan pada org yang sama.' }
  }

  const [parentPackageState, { data: childOrg, error: childOrgError }] = await Promise.all([
    getOrganizationPackageState(db, trimmedParentOrgId),
    db
      .from('organizations')
      .select('id, is_demo, settings')
      .eq('id', trimmedChildOrgId)
      .maybeSingle(),
  ])

  if (childOrgError || !childOrg) {
    return { success: false, error: childOrgError?.message || 'Organisasi anak tidak ditemukan.' }
  }

  const currentPlan = readPlanNameFromSettings(childOrg.settings)
  const currentIsDemo = Boolean(childOrg.is_demo) || readDemoFlagFromSettings(childOrg.settings)
  const shouldSyncPlan = Boolean(parentPackageState.plan)
  if ((!shouldSyncPlan || currentPlan === parentPackageState.plan) && currentIsDemo === parentPackageState.isDemo) {
    return { success: true }
  }

  const nextSettings = mergeOrganizationSettingsWithPlanState(childOrg.settings, parentPackageState)

  const { error: updateError } = await db
    .from('organizations')
    .update({
      settings: nextSettings,
      is_demo: parentPackageState.isDemo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trimmedChildOrgId)

  if (updateError) {
    return { success: false, error: updateError.message || 'Sinkronisasi paket parent-child gagal.' }
  }

  return { success: true }
}

async function syncParentRolesToChildOrg(
  db: RpcClient,
  parentOrgId: string,
  childOrgId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmedParentOrgId = String(parentOrgId || '').trim()
  const trimmedChildOrgId = String(childOrgId || '').trim()
  if (!trimmedParentOrgId || !trimmedChildOrgId) {
    return { success: false, error: 'Parameter sinkronisasi role parent-child tidak valid.' }
  }
  if (trimmedParentOrgId === trimmedChildOrgId) {
    return { success: false, error: 'Sinkronisasi role parent-child tidak bisa dilakukan pada org yang sama.' }
  }

  const { error } = await db.rpc('sync_parent_roles_to_child_org', {
    p_parent_org_id: trimmedParentOrgId,
    p_child_org_id: trimmedChildOrgId,
  })

  if (error) {
    return { success: false, error: error.message || 'Sinkronisasi role parent-child gagal.' }
  }

  return { success: true }
}

function mapCreateOrganizationError(
  defaultMessage: string,
  error: { code?: string | null; message?: string | null } | null | undefined
): string {
  if (!error) return defaultMessage

  if (error.code === '23505') {
    return 'Nama atau slug organisasi ini sudah digunakan.'
  }

  if (error.code === 'PGRST301') {
    return 'Sesi login tidak valid untuk operasi database. Coba login ulang lalu ulangi.'
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

async function getHoldingManagementContext(
  expectedParentOrgId?: string,
  options?: HoldingContextOptions
): Promise<HoldingContextResult> {
  const supabase = await createClient()
  const db = supabase
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)

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
    const internalProvider = isInternalAuthProvider()
    let admin: any = null
    try {
      admin = (await createAdminClient()) as any
    } catch (adminInitError) {
      ;(console as any).warn('CreateOrganization: admin client unavailable, fallback to session client', adminInitError)
    }
    const privilegedDb = admin ?? db
    const organizationWriteDb = internalProvider ? admin : db
    const cookieStore = await cookies()
    const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)
    if (!user) return { error: 'Tidak terautentikasi' }

    let memberUserId = String(user.id || '').trim()
    if (internalProvider) {
      const shadowAuthResult = await ensureShadowAuthUserForInternalUser({
        internalUserId:
          typeof user.user_metadata?.internal_user_id === 'string'
            ? user.user_metadata.internal_user_id
            : memberUserId,
        currentAuthUserId:
          typeof user.user_metadata?.legacy_user_id === 'string'
            ? user.user_metadata.legacy_user_id
            : memberUserId,
        email: user.email || '',
        fullName:
          typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name
            : null,
        loginType:
          typeof user.user_metadata?.login_type === 'string'
            ? user.user_metadata.login_type
            : 'owner',
      })

      if ('error' in shadowAuthResult) {
        return { error: shadowAuthResult.error || 'Terjadi kesalahan saat sinkronisasi akun' }
      }

      memberUserId = shadowAuthResult.authUserId
    }

    if (internalProvider && !organizationWriteDb) {
      return { error: 'Konfigurasi service role Supabase belum diisi. Lengkapi environment lalu coba lagi.' }
    }

    const name = (formData.get('name') as string).trim()
    if (!name) return { error: 'Nama organisasi wajib diisi' }
    const slug = generateSlug(name)
    const orgId = crypto.randomUUID()
    let defaultBranchId = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    // POPULATE OWNER EMAIL FROM SESSION
    const ownerEmail = user.email
    const hasUnlimitedAccess = hasUnlimitedSubscriptionAccess({ userEmail: ownerEmail })
    const planParam = String(formData.get('plan') || '').trim().toLowerCase()
    const businessType = (formData.get('type') || 'BLANK') as DemoBusinessType
    const requestedDemoPlan = planParam === 'demo'
    const parentOrgIdRaw = String(formData.get('parent_org_id') || '').trim()
    const parentOrgId = parentOrgIdRaw || null
    const preserveParentContext = parentOrgId
      ? String(formData.get('preserve_parent_context') || 'true').trim().toLowerCase() !== 'false'
      : false
    const accountIsDemo = isDemoAccountUser(user as { email?: string | null; user_metadata?: Record<string, unknown> | null })
    let parentOrgIsDemo = false
    let parentPackageState: { plan: string | null; isDemo: boolean } | null = null

    if (parentOrgId) {
      const holdingContext = await getHoldingManagementContext(parentOrgId, { ownerOnly: true })
      if ('error' in holdingContext) return { error: holdingContext.error }

      const [limits, packageState] = await Promise.all([
        getOrgLimits(parentOrgId),
        getOrganizationPackageState(db, parentOrgId),
      ])
      if (limits.maxChildOrgs !== null && limits.currentChildOrgs >= limits.maxChildOrgs) {
        return {
          error: `Batas anak perusahaan tercapai (${limits.currentChildOrgs}/${limits.maxChildOrgs}). Upgrade paket SaaS Anda untuk menambah lebih banyak entitas.`,
        }
      }

      parentPackageState = packageState
      parentOrgIsDemo = parentPackageState.isDemo
    }

    const isDemo = accountIsDemo || requestedDemoPlan || parentOrgIsDemo
    const shouldSkipCoaSeed = parentOrgId ? true : !isDemo
    const shouldAutoApplyAbsVoucher = !parentOrgId && !isDemo && planParam === 'abs'
    let selectedPlan = isDemo ? 'Demo' : 'Trial'
    if (parentPackageState?.plan) {
      selectedPlan = parentPackageState.plan
    }
    const shouldClaimTrial =
      !hasUnlimitedAccess &&
      !isDemo &&
      !parentOrgId &&
      planParam !== 'abs' &&
      selectedPlan === TRIAL_PLAN_NAME

    if (shouldClaimTrial) {
      const alreadyUsedTrial = await hasConsumedTrial(privilegedDb, user)
      if (alreadyUsedTrial) {
        return { error: TRIAL_REUSE_BLOCK_MESSAGE }
      }
    }

    // ── AUTO-SET subscription_end FOR TIME-LIMITED PLANS ──────────────────────
    // Lookup duration from saas_packages and stamp an expiry on the org row.
    // Only applies to non-Demo, non-inherited-plan root orgs (i.e. fresh Trials).
    let subscriptionEndToSet: string | null = null
    if (!isDemo && !parentOrgId && !hasUnlimitedAccess) {
      try {
        const { data: pkgMeta } = await organizationWriteDb
          .from('saas_packages')
          .select('duration_days')
          .eq('name', selectedPlan)
          .eq('is_active', true)
          .maybeSingle()
        if (typeof pkgMeta?.duration_days === 'number' && pkgMeta.duration_days > 0) {
          const expiry = new Date()
          expiry.setDate(expiry.getDate() + pkgMeta.duration_days)
          subscriptionEndToSet = expiry.toISOString()
        } else if (selectedPlan === TRIAL_PLAN_NAME) {
          const expiry = new Date()
          expiry.setDate(expiry.getDate() + DEFAULT_TRIAL_DURATION_DAYS)
          subscriptionEndToSet = expiry.toISOString()
        }
      } catch (_) {
        if (selectedPlan === TRIAL_PLAN_NAME) {
          const expiry = new Date()
          expiry.setDate(expiry.getDate() + DEFAULT_TRIAL_DURATION_DAYS)
          subscriptionEndToSet = expiry.toISOString()
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
        // Demo root orgs should be ready-to-explore immediately, while regular orgs
        // and child entities keep the manual/sync-first CoA activation behavior.
        skip_coa_seed: shouldSkipCoaSeed,
      },
    }
    if (subscriptionEndToSet) {
      orgInsertPayload.subscription_end = subscriptionEndToSet
    }
    if (ownerEmail) {
      orgInsertPayload.owner_email = ownerEmail
    }
    if (parentOrgId) {
      orgInsertPayload.parent_org_id = parentOrgId
    }

    let { error: orgError } = await organizationWriteDb.from('organizations').insert(orgInsertPayload)
    while (orgError) {
      const missingColumn = extractMissingColumnName(orgError)
      if (!missingColumn || !OPTIONAL_ORGANIZATION_COLUMNS.has(missingColumn)) break
      if (missingColumn === 'parent_org_id' && parentOrgId) break
      if (!(missingColumn in orgInsertPayload)) break

      delete orgInsertPayload[missingColumn]
      ;({ error: orgError } = await organizationWriteDb.from('organizations').insert(orgInsertPayload))
    }

    if (orgError) {
      ;(console as any).error('CreateOrganization: organizations insert failed', orgError)
      return {
        error: mapCreateOrganizationError('Gagal membuat organisasi.', orgError),
      }
    }

    const { error: memberError } = await privilegedDb
      .from('org_members')
      .insert({ org_id: orgId, user_id: memberUserId, role: 'owner' })

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

    await persistMembershipActiveContext(privilegedDb, {
      userId: memberUserId,
      orgId,
      branchId: defaultBranchId,
    })

    if (parentOrgId) {
      const [coaSyncResult, roleSyncResult] = await Promise.allSettled([
        syncParentCoAToChildOrg(parentOrgId, orgId),
        syncParentRolesToChildOrg(privilegedDb, parentOrgId, orgId),
      ])

      if (coaSyncResult.status === 'fulfilled') {
        if (!coaSyncResult.value.success) {
          ;(console as any).warn('CreateOrganization: CoA parent sync warning', coaSyncResult.value.error)
        }
      } else {
        ;(console as any).warn('CreateOrganization: CoA parent sync failed unexpectedly', coaSyncResult.reason)
      }

      if (roleSyncResult.status === 'fulfilled') {
        if (!roleSyncResult.value.success) {
          const roleSyncError = 'error' in roleSyncResult.value ? roleSyncResult.value.error : 'Unknown role sync error.'
          ;(console as any).warn('CreateOrganization: role parent sync warning', roleSyncError)
        }
      } else {
        ;(console as any).warn('CreateOrganization: role parent sync failed unexpectedly', roleSyncResult.reason)
      }
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
    if (shouldAutoApplyAbsVoucher) {
      try {
        await applyVoucher(orgId, 'ABS2024')
      } catch (absErr) {
        (console as any).error('ABS Activation Error:', absErr)
      }
    }

    if (shouldClaimTrial) {
      const trialClaimResult = await recordTrialClaim(privilegedDb, {
        authUserId: user.id,
        email: ownerEmail || user.email || null,
        orgId,
        claimedAt: createdAt,
      })

      if ('error' in trialClaimResult) {
        ;(console as any).error('CreateOrganization: trial claim failed', trialClaimResult.error)
        await privilegedDb.from('organizations').delete().eq('id', orgId)
        return { error: trialClaimResult.error }
      }
    }

    if (!preserveParentContext) {
      if (isDemo) {
        cookieStore.set('nizam_demo_org_id', orgId, {
          maxAge: DEMO_SESSION_COOKIE_MAX_AGE,
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
        })
      } else {
        cookieStore.delete('nizam_demo_org_id')
      }

      cookieStore.set(ACTIVE_ORG_COOKIE, orgId, getActiveContextCookieOptions())
      cookieStore.set(
        ACTIVE_BRANCH_COOKIE,
        defaultBranchId,
        isDemo
          ? {
              maxAge: DEMO_SESSION_COOKIE_MAX_AGE,
              path: '/',
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            }
          : getActiveContextCookieOptions()
      )
    }

    return {
      success: true,
      orgId,
      branchId: defaultBranchId,
      preservedContext: preserveParentContext,
      organization: {
        id: orgId,
        name,
        slug,
        logo_url: null,
        settings: isPlainObject(orgInsertPayload.settings) ? orgInsertPayload.settings : {},
        is_active: true,
        created_at: createdAt,
        manager_employee_id: null,
        coa_management_mode: DEFAULT_COA_MANAGEMENT_MODE,
      },
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

  const planSync = await syncChildOrganizationPlanFromParent(db, activeOrgId, trimmedChildOrgId)
  if (!planSync.success) {
    const planSyncError = 'error' in planSync ? planSync.error : 'Unknown plan sync error.'
    ;(console as any).warn('Plan sync warning (linkSubOrganization):', planSyncError)
  }

  const coaSync = await syncParentCoAToChildOrg(activeOrgId, trimmedChildOrgId)
  if (!coaSync.success) {
    ;(console as any).warn('CoA sync warning (linkSubOrganization):', coaSync.error)
  }

  const roleSync = await syncParentRolesToChildOrg(db, activeOrgId, trimmedChildOrgId)
  if (!roleSync.success) {
    const roleSyncError = 'error' in roleSync ? roleSync.error : 'Unknown role sync error.'
    ;(console as any).warn('Role sync warning (linkSubOrganization):', roleSyncError)
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

async function readOrganizationRowWithCoAManagementMode(reader: any, orgId: string) {
  const { data, error } = await reader
    .from('organizations')
    .select('id, name, parent_org_id, coa_management_mode')
    .eq('id', orgId)
    .maybeSingle()

  if (error && isMissingOrganizationColumn(error, 'coa_management_mode')) {
    const fallback = await reader
      .from('organizations')
      .select('id, name, parent_org_id')
      .eq('id', orgId)
      .maybeSingle()

    if (fallback.error || !fallback.data) {
      return {
        data: null,
        error: fallback.error,
      }
    }

    return {
      data: {
        ...fallback.data,
        coa_management_mode: DEFAULT_COA_MANAGEMENT_MODE,
      },
      error: null,
    }
  }

  if (error || !data) {
    return {
      data: null,
      error,
    }
  }

  return {
    data: {
      ...data,
      coa_management_mode: normalizeCoAManagementMode((data as { coa_management_mode?: unknown }).coa_management_mode),
    },
    error: null,
  }
}

async function updateOrganizationCoAManagementMode(
  writer: any,
  orgId: string,
  parentOrgId: string,
  mode: CoAManagementMode
) {
  const { error } = await writer
    .from('organizations')
    .update({
      coa_management_mode: mode,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)
    .eq('parent_org_id', parentOrgId)

  if (error && isMissingOrganizationColumn(error, 'coa_management_mode')) {
    return {
      error: 'Database belum update untuk mode CoA child org. Jalankan migrasi terbaru lalu coba lagi.',
    }
  }

  if (error) {
    return {
      error: error.message || 'Gagal memperbarui mode CoA entitas anak.',
    }
  }

  return { success: true as const }
}

type ConsolidationWorkspaceAccount = {
  id: string
  code: string
  name: string
  type: string
  normal_balance: string
}

type ConsolidationWorkspaceRow = ConsolidationWorkspaceAccount & {
  mapped_group_account_id: string | null
  suggested_group_account_id: string | null
}

type ConsolidationWorkspaceSummary = {
  totalLocalAccounts: number
  mappedLocalAccounts: number
  unmappedLocalAccounts: number
  suggestedLocalAccounts: number
}

async function readCoAConsolidationMappings(
  reader: any,
  parentOrgId: string,
  childOrgId: string
) {
  const { data, error } = await reader
    .from('coa_consolidation_mappings')
    .select('local_account_id, group_account_id, is_active')
    .eq('parent_org_id', parentOrgId)
    .eq('child_org_id', childOrgId)
    .eq('is_active', true)

  if (error && isMissingCoAConsolidationMappingsSchemaError(error)) {
    return {
      data: null,
      error: {
        message: 'Database belum update untuk mapping konsolidasi CoA. Jalankan migrasi 1244 lalu coba lagi.',
      },
    }
  }

  return { data, error }
}

async function buildChildCoAConsolidationWorkspace(
  reader: any,
  parentOrgId: string,
  childOrgId: string,
  childOrgName: string
) {
  const [{ data: localAccounts, error: localAccountsError }, { data: groupAccounts, error: groupAccountsError }, mappingsResult] = await Promise.all([
    reader
      .from('accounts')
      .select('id, code, name, type, normal_balance')
      .eq('org_id', childOrgId)
      .eq('is_active', true)
      .order('code', { ascending: true }),
    reader
      .from('accounts')
      .select('id, code, name, type, normal_balance')
      .eq('org_id', parentOrgId)
      .eq('is_active', true)
      .order('code', { ascending: true }),
    readCoAConsolidationMappings(reader, parentOrgId, childOrgId),
  ])

  if (localAccountsError || groupAccountsError) {
    return {
      error:
        localAccountsError?.message ||
        groupAccountsError?.message ||
        'Gagal membaca akun untuk workspace mapping konsolidasi.',
    }
  }

  if (mappingsResult.error) {
    return {
      error: mappingsResult.error.message || 'Gagal membaca mapping konsolidasi CoA.',
    }
  }

  const normalizedGroupAccounts = ((groupAccounts || []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id || '').trim(),
    code: String(row.code || '').trim(),
    name: String(row.name || '').trim(),
    type: String(row.type || '').trim(),
    normal_balance: String(row.normal_balance || '').trim(),
  })).filter((row) => Boolean(row.id && row.code && row.name))

  const groupAccountsByCode = new Map<string, ConsolidationWorkspaceAccount>()
  normalizedGroupAccounts.forEach((account) => {
    groupAccountsByCode.set(account.code, account)
  })

  const activeMappingsByLocalAccountId = new Map<string, string>()
  ;((mappingsResult.data || []) as Array<{ local_account_id?: string | null; group_account_id?: string | null }>)
    .forEach((row) => {
      const localAccountId = String(row?.local_account_id || '').trim()
      const groupAccountId = String(row?.group_account_id || '').trim()
      if (!localAccountId || !groupAccountId) return
      activeMappingsByLocalAccountId.set(localAccountId, groupAccountId)
    })

  const normalizedLocalAccounts = ((localAccounts || []) as Array<Record<string, unknown>>).map((row) => {
    const id = String(row.id || '').trim()
    const code = String(row.code || '').trim()
    const localAccountType = String(row.type || '').trim()
    const suggestedGroupAccount = groupAccountsByCode.get(code) || null
    const suggestedGroupAccountId = suggestedGroupAccount?.type === localAccountType
      ? suggestedGroupAccount.id
      : null
    const mappedGroupAccountId = activeMappingsByLocalAccountId.get(id) || null

    return {
      id,
      code,
      name: String(row.name || '').trim(),
      type: localAccountType,
      normal_balance: String(row.normal_balance || '').trim(),
      mapped_group_account_id: mappedGroupAccountId,
      suggested_group_account_id: suggestedGroupAccountId,
    } satisfies ConsolidationWorkspaceRow
  }).filter((row) => Boolean(row.id && row.code && row.name))

  const summary: ConsolidationWorkspaceSummary = {
    totalLocalAccounts: normalizedLocalAccounts.length,
    mappedLocalAccounts: normalizedLocalAccounts.filter((account) => Boolean(account.mapped_group_account_id)).length,
    unmappedLocalAccounts: normalizedLocalAccounts.filter((account) => !account.mapped_group_account_id).length,
    suggestedLocalAccounts: normalizedLocalAccounts.filter((account) => !account.mapped_group_account_id && account.suggested_group_account_id).length,
  }

  return {
    success: true as const,
    workspace: {
      childOrgId,
      childOrgName,
      parentOrgId,
      localAccounts: normalizedLocalAccounts,
      groupAccounts: normalizedGroupAccounts,
      summary,
    },
  }
}

export async function getChildCoAConsolidationWorkspace(childOrgId: string) {
  const trimmedChildOrgId = String(childOrgId || '').trim()
  if (!trimmedChildOrgId) {
    return { error: 'Anak perusahaan tidak valid.' }
  }

  const holdingContext = await getHoldingManagementContext()
  if ('error' in holdingContext) return { error: holdingContext.error }

  const { db, activeOrgId } = holdingContext
  let admin: any = db
  try {
    admin = (await createAdminClient()) as any
  } catch {
    admin = db
  }

  const { data: childOrg, error: childOrgError } = await admin
    .from('organizations')
    .select('id, name, parent_org_id')
    .eq('id', trimmedChildOrgId)
    .maybeSingle()

  if (childOrgError || !childOrg) {
    return { error: childOrgError?.message || 'Organisasi anak tidak ditemukan.' }
  }

  if (String(childOrg.parent_org_id || '').trim() !== activeOrgId) {
    return { error: 'Organisasi tersebut tidak terdaftar sebagai anak dari holding aktif.' }
  }

  const childContextResult = await readOrganizationRowWithCoAManagementMode(admin, trimmedChildOrgId)
  if (childContextResult.error || !childContextResult.data) {
    return { error: childContextResult.error?.message || 'Gagal membaca mode CoA entitas anak.' }
  }

  if (childContextResult.data.coa_management_mode !== 'LOCAL') {
    return {
      error: 'Entitas anak ini masih mengikuti CoA holding. Mapping konsolidasi manual hanya diperlukan untuk mode CoA lokal.',
    }
  }

  return buildChildCoAConsolidationWorkspace(
    admin,
    activeOrgId,
    trimmedChildOrgId,
    String(childOrg.name || '').trim() || 'Entitas Anak'
  )
}

export async function saveChildCoAConsolidationMappings(
  childOrgId: string,
  entries: Array<{ localAccountId: string; groupAccountId: string | null }>
) {
  const trimmedChildOrgId = String(childOrgId || '').trim()
  if (!trimmedChildOrgId) {
    return { error: 'Anak perusahaan tidak valid.' }
  }

  if (!Array.isArray(entries)) {
    return { error: 'Payload mapping konsolidasi tidak valid.' }
  }

  const holdingContext = await getHoldingManagementContext()
  if ('error' in holdingContext) return { error: holdingContext.error }

  const { db, activeOrgId } = holdingContext
  let admin: any = db
  try {
    admin = (await createAdminClient()) as any
  } catch {
    admin = db
  }

  const childContextResult = await readOrganizationRowWithCoAManagementMode(admin, trimmedChildOrgId)
  if (childContextResult.error || !childContextResult.data) {
    return { error: childContextResult.error?.message || 'Gagal membaca konteks entitas anak.' }
  }

  const childOrg = childContextResult.data
  if (childOrg.parent_org_id !== activeOrgId) {
    return { error: 'Organisasi tersebut tidak terdaftar sebagai anak dari holding aktif.' }
  }

  if (childOrg.coa_management_mode !== 'LOCAL') {
    return {
      error: 'Entitas anak ini tidak berada di mode CoA lokal. Simpan mapping hanya tersedia untuk child LOCAL.',
    }
  }

  const [{ data: localAccounts, error: localAccountsError }, { data: groupAccounts, error: groupAccountsError }, mappingsResult] = await Promise.all([
    admin
      .from('accounts')
      .select('id, code, name, type, normal_balance')
      .eq('org_id', trimmedChildOrgId)
      .eq('is_active', true),
    admin
      .from('accounts')
      .select('id, code, name, type, normal_balance')
      .eq('org_id', activeOrgId)
      .eq('is_active', true),
    readCoAConsolidationMappings(admin, activeOrgId, trimmedChildOrgId),
  ])

  if (localAccountsError || groupAccountsError) {
    return {
      error:
        localAccountsError?.message ||
        groupAccountsError?.message ||
        'Gagal membaca akun untuk penyimpanan mapping konsolidasi.',
    }
  }

  if (mappingsResult.error) {
    return {
      error: mappingsResult.error.message || 'Gagal membaca tabel mapping konsolidasi CoA.',
    }
  }

  const localAccountById = new Map<string, ConsolidationWorkspaceAccount>()
  ;((localAccounts || []) as Array<Record<string, unknown>>).forEach((row) => {
    const id = String(row.id || '').trim()
    if (!id) return
    localAccountById.set(id, {
      id,
      code: String(row.code || '').trim(),
      name: String(row.name || '').trim(),
      type: String(row.type || '').trim(),
      normal_balance: String(row.normal_balance || '').trim(),
    })
  })

  const groupAccountById = new Map<string, ConsolidationWorkspaceAccount>()
  ;((groupAccounts || []) as Array<Record<string, unknown>>).forEach((row) => {
    const id = String(row.id || '').trim()
    if (!id) return
    groupAccountById.set(id, {
      id,
      code: String(row.code || '').trim(),
      name: String(row.name || '').trim(),
      type: String(row.type || '').trim(),
      normal_balance: String(row.normal_balance || '').trim(),
    })
  })

  const normalizedEntries = entries.map((entry) => ({
    localAccountId: String(entry?.localAccountId || '').trim(),
    groupAccountId: String(entry?.groupAccountId || '').trim() || null,
  }))

  const seenLocalAccountIds = new Set<string>()
  for (const entry of normalizedEntries) {
    if (!entry.localAccountId) {
      return { error: 'Ditemukan baris mapping tanpa akun lokal.' }
    }

    if (seenLocalAccountIds.has(entry.localAccountId)) {
      return { error: 'Ada akun lokal yang dikirim lebih dari satu kali pada payload mapping.' }
    }
    seenLocalAccountIds.add(entry.localAccountId)

    const localAccount = localAccountById.get(entry.localAccountId)
    if (!localAccount) {
      return { error: 'Salah satu akun lokal tidak ditemukan atau sudah nonaktif.' }
    }

    if (!entry.groupAccountId) continue

    const groupAccount = groupAccountById.get(entry.groupAccountId)
    if (!groupAccount) {
      return { error: `Akun holding untuk ${localAccount.code} - ${localAccount.name} tidak ditemukan.` }
    }

    if (groupAccount.type !== localAccount.type) {
      return {
        error:
          `Akun holding ${groupAccount.code} - ${groupAccount.name} tidak satu kategori dengan akun lokal ` +
          `${localAccount.code} - ${localAccount.name}. Pilih akun dengan tipe yang sama.`,
      }
    }
  }

  const activeMappingRows = (mappingsResult.data || []) as Array<{ local_account_id?: string | null }>
  const currentlyMappedIds = new Set(
    activeMappingRows
      .map((row) => String(row?.local_account_id || '').trim())
      .filter(Boolean)
  )

  const upsertPayload = normalizedEntries
    .filter((entry) => entry.groupAccountId)
    .map((entry) => ({
      parent_org_id: activeOrgId,
      child_org_id: trimmedChildOrgId,
      local_account_id: entry.localAccountId,
      group_account_id: entry.groupAccountId,
      is_active: true,
      updated_at: new Date().toISOString(),
    }))

  const clearLocalAccountIds = normalizedEntries
    .filter((entry) => !entry.groupAccountId && currentlyMappedIds.has(entry.localAccountId))
    .map((entry) => entry.localAccountId)

  if (clearLocalAccountIds.length > 0) {
    const { error: clearError } = await admin
      .from('coa_consolidation_mappings')
      .delete()
      .eq('parent_org_id', activeOrgId)
      .eq('child_org_id', trimmedChildOrgId)
      .in('local_account_id', clearLocalAccountIds)

    if (clearError) {
      return {
        error: clearError.message || 'Gagal menghapus mapping konsolidasi yang dikosongkan.',
      }
    }
  }

  if (upsertPayload.length > 0) {
    const { error: upsertError } = await admin
      .from('coa_consolidation_mappings')
      .upsert(upsertPayload, {
        onConflict: 'parent_org_id,child_org_id,local_account_id',
      })

    if (upsertError) {
      return {
        error: upsertError.message || 'Gagal menyimpan mapping konsolidasi CoA.',
      }
    }
  }

  revalidatePath('/settings/sub-orgs')
  revalidatePath('/reports')

  return buildChildCoAConsolidationWorkspace(
    admin,
    activeOrgId,
    trimmedChildOrgId,
    String(childOrg.name || '').trim() || 'Entitas Anak'
  )
}

export async function setChildOrganizationCoAManagementMode(
  childOrgId: string,
  mode: CoAManagementMode
) {
  const trimmedChildOrgId = String(childOrgId || '').trim()
  const normalizedMode = normalizeCoAManagementMode(mode)

  if (!trimmedChildOrgId) {
    return { error: 'Anak perusahaan tidak valid.' }
  }

  const holdingContext = await getHoldingManagementContext(undefined, { ownerOnly: true })
  if ('error' in holdingContext) return { error: holdingContext.error }

  const { db, activeOrgId } = holdingContext
  let admin: any = db
  try {
    admin = (await createAdminClient()) as any
  } catch {
    admin = db
  }

  const { data: childOrg, error: childOrgError } = await readOrganizationRowWithCoAManagementMode(admin, trimmedChildOrgId)
  if (childOrgError || !childOrg) {
    return { error: childOrgError?.message || 'Organisasi anak tidak ditemukan.' }
  }

  if (childOrg.parent_org_id !== activeOrgId) {
    return { error: 'Organisasi tersebut tidak terdaftar sebagai anak dari holding aktif.' }
  }

  if (childOrg.coa_management_mode === normalizedMode) {
    return { success: true, managementMode: normalizedMode, changed: false }
  }

  if (normalizedMode === 'INHERITED') {
    const [{ data: parentAccounts, error: parentAccountsError }, { data: childAccounts, error: childAccountsError }] = await Promise.all([
      admin
        .from('accounts')
        .select('code')
        .eq('org_id', activeOrgId)
        .eq('is_active', true),
      admin
        .from('accounts')
        .select('code')
        .eq('org_id', trimmedChildOrgId)
        .eq('is_active', true),
    ])

    if (parentAccountsError || childAccountsError) {
      return {
        error:
          parentAccountsError?.message ||
          childAccountsError?.message ||
          'Gagal memeriksa keselarasan CoA parent-child.',
      }
    }

    const parentCodes = new Set(
      ((parentAccounts || []) as Array<{ code?: string | null }>)
        .map((row) => String(row?.code || '').trim())
        .filter(Boolean)
    )

    const localOnlyCodes = Array.from(
      new Set(
        ((childAccounts || []) as Array<{ code?: string | null }>)
          .map((row) => String(row?.code || '').trim())
          .filter((code) => Boolean(code) && !parentCodes.has(code))
      )
    )

    if (localOnlyCodes.length > 0) {
      const preview = localOnlyCodes.slice(0, 4).join(', ')
      const suffix = localOnlyCodes.length > 4 ? ' dan lainnya' : ''
      return {
        error:
          `Entitas anak masih memiliki ${localOnlyCodes.length} akun aktif yang belum ada di holding: ${preview}${suffix}. ` +
          'Rapikan akun lokal tersebut terlebih dahulu sebelum kembali ke mode inherited.',
      }
    }
  }

  const updateResult = await updateOrganizationCoAManagementMode(admin, trimmedChildOrgId, activeOrgId, normalizedMode)
  if ('error' in updateResult) {
    return updateResult
  }

  if (normalizedMode === 'INHERITED') {
    const coaSync = await syncParentCoAToChildOrg(activeOrgId, trimmedChildOrgId)
    if (!coaSync.success) {
      const rollbackResult = await updateOrganizationCoAManagementMode(admin, trimmedChildOrgId, activeOrgId, 'LOCAL')
      if ('error' in rollbackResult) {
        ;(console as any).warn('Rollback mode CoA child org gagal:', rollbackResult.error)
      }

      return {
        error: coaSync.error || 'Mode CoA sudah diubah, tetapi sinkronisasi CoA parent gagal. Perubahan dibatalkan.',
      }
    }
  }

  revalidatePath('/settings/sub-orgs')
  revalidatePath('/settings/accounts')
  revalidatePath('/accounting/coa-requests')
  revalidatePath('/reports')

  return {
    success: true,
    managementMode: normalizedMode,
    changed: true,
  }
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
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)

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
    const planSync = await syncChildOrganizationPlanFromParent(db, trimmedParentOrgId, trimmedChildOrgId)
    if (!planSync.success) {
      const planSyncError = 'error' in planSync ? planSync.error : 'Unknown plan sync error.'
      ;(console as any).warn('Plan sync warning (setOrganizationParent):', planSyncError)
    }

    const coaSync = await syncParentCoAToChildOrg(trimmedParentOrgId, trimmedChildOrgId)
    if (!coaSync.success) {
      ;(console as any).warn('CoA sync warning (setOrganizationParent):', coaSync.error)
    }

    const roleSync = await syncParentRolesToChildOrg(db, trimmedParentOrgId, trimmedChildOrgId)
    if (!roleSync.success) {
      const roleSyncError = 'error' in roleSync ? roleSync.error : 'Unknown role sync error.'
      ;(console as any).warn('Role sync warning (setOrganizationParent):', roleSyncError)
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

  revalidatePath('/settings/sub-orgs')
  revalidatePath('/reports')
  if (!result.preservedContext) {
    revalidatePath('/', 'layout')
    revalidatePath('/dashboard')
  }
  await nudgeEduModeValidation('organization.create.quick')
  return result
}

const getActiveOrgCached = cache(async () => {
  const { supabase, user } = await getServerAuthContext()
  let db = supabase as any
  if (isInternalAuthProvider()) {
    try {
      db = (await createAdminClient()) as any
    } catch (adminError) {
      ;(console as any).error('GetActiveOrg: admin client unavailable in internal mode', adminError)
      return null
    }
  }
  if (!user) return null

  const cookieStore = await cookies()
  const memberData = await resolveActiveMembership(
    db,
    user,
    cookieStore,
    'org_id, role, role_id, joined_at, last_active_at, last_active_branch_id, organizations(*), roles(permissions)'
  )

  if (!memberData) {
    // User tidak punya org_members aktif → diarahkan ke onboarding.
    // Penyebab umum: akun dibuat manual (seeding) tapi lupa isi tabel org_members.
    ;(console as any).warn('GetActiveOrg: user tidak punya keanggotaan org aktif. Pastikan tabel org_members sudah diisi.', {
      userId: user.id,
    })
    return null
  }

  const activeOrgId = memberData.org_id
  const org = memberData.organizations as any
  if (!org || typeof org !== 'object') {
    (console as any).error('GetActiveOrg: membership found without organization payload', {
      userId: user.id,
      orgId: activeOrgId,
    })
    return null
  }
  const planName = org?.settings?.plan
  let enabledModules: string[] = []
  let isSubscriptionExpired = false
  let subscriptionEnd: Date | null = null
  const hasUnlimitedAccess = hasUnlimitedSubscriptionAccess({
    userEmail: user.email,
    org,
  })

  const useCustomModules = org?.settings?.use_custom_modules === true
  const customEnabledModules = Array.isArray(org?.enabled_modules)
    ? org.enabled_modules
        .map((moduleName: unknown) => normalizeSaasEntitlementName(String(moduleName || '').trim()))
        .filter(Boolean)
    : []

  // DYNAMIC MODULE RESOLUTION + SUBSCRIPTION EXPIRY CHECK FROM SaaS PACKAGE
  if (planName) {
    const { data: pkgData, error: pkgError } = await db
      .from('saas_packages')
      .select('modules, duration_days')
      .eq('name', planName)
      .eq('is_active', true)
      .maybeSingle()

    // Bug #3 guard: paket di settings.plan tidak ketemu di tabel saas_packages.
    // Bisa terjadi kalau nama paket di-rename atau dihapus. Jangan crash — log warning saja.
    if (!pkgData && !pkgError) {
      ;(console as any).warn(`GetActiveOrg: paket "${planName}" tidak ditemukan di saas_packages. Modul akan kosong. Org: ${activeOrgId}`)
    }
    
    if (!useCustomModules && pkgData?.modules) {
      try {
        const pkgModules = Array.isArray(pkgData.modules) ? pkgData.modules : JSON.parse(pkgData.modules || '[]')
        enabledModules = [...enabledModules, ...pkgModules]
      } catch (pkgParseError) {
        (console as any).error('GetActiveOrg: failed to parse package modules', pkgParseError)
      }
    }

    // ── SUBSCRIPTION EXPIRY CHECK ──────────────────────────────────────────
    // Bypass for Demo, Enterprise, and permanently-active plans (null duration).
    // For time-limited plans (e.g. Trial), check subscription_end.
    // subscription_end = null means either: unlimited license OR the field has not
    // been set yet (legacy org created before this feature). We treat null as valid
    // (no enforcement) to avoid locking out existing paying customers.
    const isTimeLimited = typeof pkgData?.duration_days === 'number' && pkgData.duration_days > 0
    const isDemoPlan = planName === 'Demo'
    if (isTimeLimited && !isDemoPlan && !hasUnlimitedAccess) {
      // Keep supporting the legacy settings.expires_at field so old admin edits
      // or manual extensions do not keep a tenant locked out after renewal.
      subscriptionEnd = resolveOrganizationSubscriptionEnd(org)
      if (subscriptionEnd) {
        isSubscriptionExpired = subscriptionEnd < new Date()
      }
      // If both expiry fields are missing (legacy org), we do NOT force-expire.
    }
  }

  if (useCustomModules) {
    enabledModules = [...enabledModules, ...customEnabledModules]
  }

  // ADD INDUSTRIAL ADD-ONS
  const activeAddons = Array.isArray(org.active_addons) ? org.active_addons : []
  activeAddons.forEach((a: any) => {
    if (a.name) enabledModules.push(normalizeSaasEntitlementName(String(a.name)))
  })

  // Clean and unique, preserving the granular names for precise sidebar permission checks
  enabledModules = Array.from(new Set(enabledModules.map((m: string) => String(m).trim()).filter(Boolean)))

  // Fetch Job Title from employees table
  const { data: empData } = await db
    .from('employees')
    .select('job_title, role_id')
    .eq('org_id', activeOrgId)
    .eq('user_id', user.id)
    .maybeSingle()

  let resolvedRoleId = String(memberData.role_id || empData?.role_id || '').trim() || null
  let resolvedPermissions = Array.isArray((memberData.roles as any)?.permissions)
    ? (memberData.roles as any).permissions.filter((permission: unknown): permission is string => typeof permission === 'string')
    : []

  if (!resolvedPermissions.length) {
    const fallbackRole = await resolveFallbackMembershipRole(db, activeOrgId, {
      membershipRoleId: memberData.role_id,
      employeeRoleId: empData?.role_id,
      employeeJobTitle: empData?.job_title,
      membershipRole: memberData.role,
    })

    if (fallbackRole) {
      resolvedRoleId = String(resolvedRoleId || fallbackRole.id || '').trim() || null
      resolvedPermissions = Array.isArray(fallbackRole.permissions)
        ? fallbackRole.permissions.filter((permission: unknown): permission is string => typeof permission === 'string')
        : []
    }
  }

  return {
    org,
    role: memberData.role as string,
    roleId: resolvedRoleId,
    jobTitle: empData?.job_title || memberData.role,
    permissions: resolvedPermissions,
    enabledModules,
    user,
    isSubscriptionExpired,
    subscriptionEnd,
  }
})

export async function getActiveOrg() {
  // Cache the active org lookup per request because many dashboard pages
  // and helpers ask for the same org/user context during a single render.
  return getActiveOrgCached()
}

const getMyOrganizationsCached = cache(async (): Promise<AccessibleOrganization[]> => {
  const { supabase, user } = await getServerAuthContext()
  let db = supabase as any
  if (isInternalAuthProvider()) {
    try {
      db = (await createAdminClient()) as any
    } catch (adminError) {
      ;(console as any).error('getMyOrganizations: admin client unavailable in internal mode', adminError)
      return []
    }
  }
  if (!user) return []

  const { data, error } = await db
    .from('org_members')
    .select('org_id, role, role_id, joined_at, organizations(id, name, slug, logo_url, settings, is_active, parent_org_id)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })

  if (error || !Array.isArray(data)) {
    if (error) {
      ;(console as any).error('getMyOrganizations Error:', error)
    }
    return []
  }

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
})

export async function getMyOrganizations(): Promise<AccessibleOrganization[]> {
  return getMyOrganizationsCached()
}

export async function setActiveOrg(orgId: string) {
  const { supabase, user } = await getServerAuthContext()
  const admin = (await createAdminClient()) as any
  const db = supabase as any
  const cookieStore = await cookies()
  const trimmedOrgId = orgId.trim()

  if (!trimmedOrgId) {
    return { error: 'Organisasi tidak valid.' }
  }

  if (!user) return { error: 'Tidak terautentikasi.' }

  const membershipLookup = await db
    .from('org_members')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('org_id', trimmedOrgId)
    .eq('is_active', true)
    .maybeSingle()

  let membership = membershipLookup.data
  const error = membershipLookup.error

  if (error || !membership) {
    const { data: childOrg } = await admin
      .from('organizations')
      .select('id, parent_org_id')
      .eq('id', trimmedOrgId)
      .maybeSingle()

    if (childOrg?.parent_org_id) {
      const { data: parentMembership } = await admin
        .from('org_members')
        .select('id, role')
        .eq('user_id', user.id)
        .eq('org_id', childOrg.parent_org_id)
        .eq('is_active', true)
        .maybeSingle()

      const parentRole = String(parentMembership?.role || '').toLowerCase()
      if (parentRole === 'owner' || parentRole === 'admin') {
        const fallbackRole = parentRole === 'owner' ? 'owner' : 'admin'
        const { error: upsertError } = await admin
          .from('org_members')
          .upsert(
            {
              org_id: trimmedOrgId,
              user_id: user.id,
              role: fallbackRole,
              is_active: true,
            },
            { onConflict: 'org_id,user_id' }
          )

        if (upsertError) {
          return { error: `Gagal menautkan ke organisasi anak: ${upsertError.message || 'unknown error'}` }
        }

        const { data: refreshedMembership } = await admin
          .from('org_members')
          .select('id, org_id, role')
          .eq('user_id', user.id)
          .eq('org_id', trimmedOrgId)
          .eq('is_active', true)
          .maybeSingle()

        membership = refreshedMembership || membership
      }
    }
  }

  if (!membership) {
    return { error: 'Anda tidak memiliki akses ke organisasi tersebut.' }
  }

  cookieStore.delete('nizam_demo_org_id')
  cookieStore.set(ACTIVE_ORG_COOKIE, trimmedOrgId, getActiveContextCookieOptions())
  const branchAccessScope = await resolveAccessibleBranchesForMembership(
    admin,
    membership as OrganizationMembershipRow
  )
  const persistedBranchId = resolvePersistedBranchIdForOrgSwitch(branchAccessScope)

  if (persistedBranchId) {
    cookieStore.set(
      ACTIVE_BRANCH_COOKIE,
      persistedBranchId,
      getActiveContextCookieOptions()
    )
  } else {
    cookieStore.delete(ACTIVE_BRANCH_COOKIE)
  }

  await persistMembershipActiveContext(admin, {
    userId: user.id,
    orgId: trimmedOrgId,
    branchId: persistedBranchId,
  })

  revalidatePath('/', 'layout')
  return { success: true, orgId: trimmedOrgId, branchId: persistedBranchId }
}

function normalizeOrganizationLogoUrl(value: unknown): string | null {
  const normalized = String(value || '').trim()
  return normalized || null
}

/**
 * Membersihkan file logo lama jika organisasi berpindah ke file logo bucket yang baru.
 */
async function cleanupReplacedManagedLogo(previousLogoUrl: string | null, nextLogoUrl: string | null) {
  const previousKey = extractManagedStorageKey(previousLogoUrl)
  const nextKey = extractManagedStorageKey(nextLogoUrl)

  if (!previousKey || previousKey === nextKey || !previousKey.startsWith('logos/')) {
    return
  }

  try {
    await deleteObjectFromStorage(previousKey)
  } catch (error) {
    console.error('[Organization] Gagal menghapus logo lama dari bucket:', error)
  }
}

export async function updateOrgSettings(orgId: string, updates: any) {
  const supabase = await createClient()
  const db = supabase as any
  const normalizedUpdates =
    updates && typeof updates === 'object'
      ? {
          ...updates,
          ...(Object.prototype.hasOwnProperty.call(updates, 'logo_url')
            ? { logo_url: normalizeOrganizationLogoUrl(updates.logo_url) }
            : {}),
        }
      : updates
  const nextLogoUrl = Object.prototype.hasOwnProperty.call(normalizedUpdates || {}, 'logo_url')
    ? normalizeOrganizationLogoUrl(normalizedUpdates.logo_url)
    : null
  let previousLogoUrl: string | null = null

  if (Object.prototype.hasOwnProperty.call(normalizedUpdates || {}, 'logo_url')) {
    const { data: previousOrg } = await db
      .from('organizations')
      .select('logo_url')
      .eq('id', orgId)
      .maybeSingle()

    previousLogoUrl = normalizeOrganizationLogoUrl(previousOrg?.logo_url)
  }

  const { error } = await db.from('organizations').update(normalizedUpdates).eq('id', orgId)
  if (error) return { error: 'Gagal menyimpan.' }

  if (Object.prototype.hasOwnProperty.call(normalizedUpdates || {}, 'logo_url')) {
    await cleanupReplacedManagedLogo(previousLogoUrl, nextLogoUrl)
  }

  revalidatePath('/', 'layout')
  revalidatePath('/settings/business')
  return { success: true }
}

export async function checkSlugAvailability(orgId: string, slug: string) {
  const supabase = await createClient()
  const db = supabase as any
  const { data } = await db.from('organizations').select('id').eq('slug', slug.toLowerCase().trim()).neq('id', orgId).maybeSingle()
  return { available: !data }
}

export async function uploadLogo(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)
  if (!user) return { success: false, error: 'Auth failed' }

  const file = formData.get('file') as File
  if (!file || typeof file.arrayBuffer !== 'function' || file.size === 0) {
    return { success: false, error: 'File logo tidak valid.' }
  }
  if (!String(file.type || '').startsWith('image/')) {
    return { success: false, error: 'Logo harus berupa file gambar PNG, JPG, WEBP, atau SVG.' }
  }
  if (file.size > 1024 * 1024) {
    return { success: false, error: 'Ukuran logo maksimal 1 MB agar performa tetap ringan.' }
  }

  const { data: organization } = await db
    .from('organizations')
    .select('logo_url')
    .eq('id', orgId)
    .maybeSingle()

  const previousLogoUrl = normalizeOrganizationLogoUrl(organization?.logo_url)

  if (isObjectStorageFeatureEnabled('logos')) {
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const storageKey = buildLogoStorageKey(orgId, file.name)
    const proxiedLogoUrl = buildPublicStorageObjectPath(storageKey)
    const normalizedLogoUrl = normalizeOrganizationLogoUrl(proxiedLogoUrl)

    try {
      await uploadObjectToStorage({
        key: storageKey,
        body: fileBuffer,
        contentType: file.type || 'application/octet-stream',
        cacheControl: 'public, max-age=31536000, immutable',
      })
    } catch (error) {
      console.error('[Organization] Gagal upload logo ke bucket:', error)
      return { success: false, error: 'Gagal upload logo ke bucket Railway. Cek kredensial bucket lalu coba lagi.' }
    }

    const { error } = await db
      .from('organizations')
      .update({ logo_url: normalizedLogoUrl })
      .eq('id', orgId)

    if (error) {
      try {
        await deleteObjectFromStorage(storageKey)
      } catch (cleanupError) {
        console.error('[Organization] Gagal membersihkan logo baru setelah update database gagal:', cleanupError)
      }

      return { success: false, error: 'Gagal menyimpan logo perusahaan.' }
    }

    await cleanupReplacedManagedLogo(previousLogoUrl, normalizedLogoUrl)

    revalidatePath('/', 'layout')
    revalidatePath('/settings/business')
    return { success: true, url: normalizedLogoUrl }
  }

  const base64Payload = Buffer.from(await file.arrayBuffer()).toString('base64')
  const publicUrl = `data:${file.type};base64,${base64Payload}`
  const normalizedLogoUrl = normalizeOrganizationLogoUrl(publicUrl)
  const { error } = await db
    .from('organizations')
    .update({ logo_url: normalizedLogoUrl })
    .eq('id', orgId)
  if (error) {
    return { success: false, error: 'Gagal menyimpan logo perusahaan.' }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/settings/business')
  return { success: true, url: normalizedLogoUrl }
}

export async function getOrgMembers(orgId: string) {
  const supabase = await createClient()
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)

  if (!user) return []

  const { queryPostgres: qp } = await import('@/lib/db/postgres')

  // Verify actor is owner or admin
  const authCheck = await qp<{ role: string }>(`
    SELECT role FROM public.org_members
    WHERE org_id = $1 AND user_id = $2 AND is_active = true
    LIMIT 1
  `, [orgId, user.id])

  const actorRole = authCheck.rows[0]?.role || ''
  if (!['owner', 'admin'].includes(actorRole)) return []

  // Fetch members with role and email
  const membersResult = await qp<{
    id: string
    org_id: string
    user_id: string
    role: string
    role_id: string | null
    is_active: boolean
    joined_at: string | null
    last_active_at: string | null
    last_active_branch_id: string | null
    custom_role_name: string | null
    user_email: string | null
  }>(`
    SELECT
      m.id,
      m.org_id,
      m.user_id,
      m.role,
      m.role_id,
      m.is_active,
      m.joined_at,
      m.last_active_at,
      m.last_active_branch_id,
      r.name AS custom_role_name,
      u.email AS user_email
    FROM public.org_members m
    LEFT JOIN public.roles r ON r.id = m.role_id
    LEFT JOIN public.users u ON u.id = m.user_id
    WHERE m.org_id = $1 AND m.is_active = true
    ORDER BY m.joined_at ASC
  `, [orgId])

  if (membersResult.rows.length === 0) return []

  // Fetch unit assignments for all members in one query
  const memberIds = membersResult.rows.map((m) => m.id)
  const unitsResult = await qp<{
    org_member_id: string
    branch_id: string
    branch_name: string | null
    branch_code: string | null
  }>(`
    SELECT
      mu.org_member_id,
      mu.branch_id,
      b.name AS branch_name,
      b.code AS branch_code
    FROM public.org_member_units mu
    LEFT JOIN public.branches b ON b.id = mu.branch_id
    WHERE mu.org_member_id = ANY($1::uuid[])
  `, [memberIds])

  // Group unit assignments by member id
  const unitsByMemberId = new Map<string, { branch_id: string; branch: { id: string; name: string | null; code: string | null } | null }[]>()
  for (const unit of unitsResult.rows) {
    const memberId = unit.org_member_id
    if (!unitsByMemberId.has(memberId)) unitsByMemberId.set(memberId, [])
    unitsByMemberId.get(memberId)!.push({
      branch_id: unit.branch_id,
      branch: unit.branch_name ? { id: unit.branch_id, name: unit.branch_name, code: unit.branch_code } : null,
    })
  }

  // Assemble the result in the shape the UI expects
  return membersResult.rows.map((m) => ({
    id: m.id,
    org_id: m.org_id,
    user_id: m.user_id,
    role: m.role,
    role_id: m.role_id,
    is_active: m.is_active,
    joined_at: m.joined_at,
    last_active_at: m.last_active_at,
    last_active_branch_id: m.last_active_branch_id,
    custom_role: m.custom_role_name ? { name: m.custom_role_name } : null,
    organizations: null,
    user: m.user_email ? { email: m.user_email } : null,
    unit_assignments: unitsByMemberId.get(m.id) || [],
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
  const buildSelectFields = (includeCoAManagementMode: boolean) => {
    const baseFields = managerFeatureEnabled
      ? 'id, name, slug, logo_url, settings, is_active, created_at, manager_employee_id'
      : 'id, name, slug, logo_url, settings, is_active, created_at'

    return includeCoAManagementMode
      ? `${baseFields}, coa_management_mode`
      : baseFields
  }

  const readChildOrgs = async (reader: any) => {
    let includeCoAManagementMode = true

    while (true) {
      const { data, error } = await reader
        .from('organizations')
        .select(buildSelectFields(includeCoAManagementMode))
        .eq('parent_org_id', trimmedParentOrgId)
        .order('created_at', { ascending: false })

      if (error && includeCoAManagementMode && isMissingOrganizationColumn(error, 'coa_management_mode')) {
        includeCoAManagementMode = false
        continue
      }

      if (error) return { data: null, error }

      const normalizedRows = (data || []).map((row: any) => ({
        ...row,
        manager_employee_id: managerFeatureEnabled ? (row?.manager_employee_id ? String(row.manager_employee_id) : null) : null,
        coa_management_mode: normalizeCoAManagementMode(row?.coa_management_mode),
      }))

      return { data: normalizedRows, error: null }
    }
  }

  const admin = (await createAdminClient()) as any
  const { data: adminData, error: adminError } = await readChildOrgs(admin)

  if (!adminError) {
    return adminData || []
  }

  const { data: userData, error: userError } = await readChildOrgs(db)

  if (!userError) {
    return userData || []
  }

  return []
}

export async function destroyOrganization(orgId: string) {
  const supabase = await createClient()
  const db = supabase as any
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)
  if (!user) return { error: 'Unauthorized' }
  const { data: member } = await db.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).single()
  if (member?.role !== 'owner') return { error: 'Hanya OWNER yang bisa menghapus.' }
  await db.from('organizations').delete().eq('id', orgId)
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getBranches(orgId: string) {
  const scope = await getBranchAccessScope(orgId)
  return scope.accessibleBranches
}

export async function getBranchesByOrganizations(orgIds: string[]) {
  const normalizedOrgIds = Array.from(new Set(orgIds.map((orgId) => String(orgId || '').trim()).filter(Boolean)))
  if (normalizedOrgIds.length === 0) {
    return {} as Record<string, BranchSummary[]>
  }

  const { user } = await getServerAuthContext()
  if (!user) {
    return Object.fromEntries(normalizedOrgIds.map((orgId) => [orgId, []])) as Record<string, BranchSummary[]>
  }

  const admin = (await createAdminClient()) as any
  const { data: membershipRows, error: membershipsError } = await admin
    .from('org_members')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('org_id', normalizedOrgIds)

  if (membershipsError || !Array.isArray(membershipRows) || membershipRows.length === 0) {
    return Object.fromEntries(normalizedOrgIds.map((orgId) => [orgId, []])) as Record<string, BranchSummary[]>
  }

  const typedMemberships = (membershipRows as OrganizationMembershipRow[]).filter(
    (membership) => normalizedOrgIds.includes(String(membership.org_id || '').trim())
  )
  const membershipByOrgId = new Map(
    typedMemberships.map((membership) => [String(membership.org_id), membership] as const)
  )
  const { data: branchRows, error: branchesError } = await admin
    .from('branches')
    .select('id, org_id, name, code, address, is_active')
    .in('org_id', Array.from(membershipByOrgId.keys()))
    .eq('is_active', true)
    .order('name', { ascending: true })

  const normalizedBranches = !branchesError && Array.isArray(branchRows)
    ? normalizeOrganizationBranches(branchRows as OrganizationBranchRow[])
    : []
  const branchesByOrgId = groupBranchesByOrgId(normalizedBranches)

  const restrictedMemberships = typedMemberships.filter(
    (membership) => !FULL_ORG_ACCESS_ROLES.has(String(membership.role || '').toLowerCase())
  )
  let assignedBranchIdsByMembershipId = new Map<string, Set<string>>()
  if (restrictedMemberships.length > 0) {
    const { data: assignmentRows, error: assignmentsError } = await admin
      .from('org_member_units')
      .select('org_member_id, branch_id')
      .in('org_member_id', restrictedMemberships.map((membership) => membership.id))

    if (!assignmentsError && Array.isArray(assignmentRows)) {
      assignedBranchIdsByMembershipId = assignmentRows.reduce((acc, assignment) => {
        const membershipId = String(assignment?.org_member_id || '').trim()
        const branchId = String(assignment?.branch_id || '').trim()
        if (!membershipId || !branchId) return acc
        const bucket = acc.get(membershipId) || new Set<string>()
        bucket.add(branchId)
        acc.set(membershipId, bucket)
        return acc
      }, new Map<string, Set<string>>())
    }
  }

  const entries = normalizedOrgIds.map((orgId) => {
    const membership = membershipByOrgId.get(orgId)
    if (!membership) return [orgId, []] as const

    const orgBranches = branchesByOrgId[orgId] || []
    if (orgBranches.length === 0) {
      return [orgId, []] as const
    }

    if (FULL_ORG_ACCESS_ROLES.has(String(membership.role || '').toLowerCase())) {
      return [orgId, orgBranches] as const
    }

    const assignedBranchIds = assignedBranchIdsByMembershipId.get(membership.id) || new Set<string>()
    return [
      orgId,
      orgBranches.filter((branch) => assignedBranchIds.has(branch.id)),
    ] as const
  })

  return Object.fromEntries(entries) as Record<string, BranchSummary[]>
}

export async function getActiveBranch(orgId: string) {
  return getCurrentAccessibleBranch(orgId)
}

export async function setActiveBranch(orgId: string, branchId: string | null) {
  const supabase = await createClient()
  const admin = (await createAdminClient()) as any
  const cookieStore = await cookies()
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)
  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = orgId.trim()
  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }

  const branchAccessScope = await getBranchAccessScope(trimmedOrgId)

  if (!branchAccessScope.role) {
    return { error: 'Anda tidak memiliki akses ke organisasi ini.' }
  }

  if (!branchId) {
    if (!branchAccessScope.canAccessAllBranches) {
      return { error: 'Anda harus memilih unit yang termasuk dalam akses Anda.' }
    }
    cookieStore.delete(ACTIVE_BRANCH_COOKIE)
    await persistMembershipActiveContext(admin, {
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

  cookieStore.set(ACTIVE_BRANCH_COOKIE, trimmedBranchId, getActiveContextCookieOptions())
  await persistMembershipActiveContext(admin, {
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

export async function createBranch(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const admin = (await createAdminClient()) as any
  const db = supabase as any
  const cookieStore = await cookies()
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)

  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = String(orgId || '').trim()
  const name = String(formData.get('name') || '').trim()
  const code = String(formData.get('code') || '').trim().toUpperCase()
  const addressRaw = String(formData.get('address') || '').trim()
  const address = addressRaw || null

  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }
  if (!name) return { error: 'Nama unit wajib diisi.' }
  if (!code) return { error: 'Kode unit wajib diisi.' }

  const { data: actorMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', trimmedOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!actorMembership || !['owner', 'admin'].includes(String(actorMembership.role || ''))) {
    return { error: 'Hanya owner atau admin yang dapat menambahkan unit.' }
  }

  // ── Enforce branch limit dari SaaS plan ───────────────────────────────
  const limits = await getOrgLimits(trimmedOrgId)
  if (limits.maxBranches !== null && limits.currentBranches >= limits.maxBranches) {
    return {
      error: `Batas unit tercapai (${limits.currentBranches}/${limits.maxBranches}). Upgrade paket SaaS Anda untuk menambah lebih banyak unit.`,
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

  const { data: duplicateCodeBranch } = await db
    .from('branches')
    .select('id')
    .eq('org_id', trimmedOrgId)
    .eq('code', code)
    .maybeSingle()

  if (duplicateCodeBranch?.id) {
    return { error: 'Kode unit sudah digunakan pada organisasi ini.' }
  }

  const { data: insertedBranch, error: insertError } = await db
    .from('branches')
    .insert({
      org_id: trimmedOrgId,
      name,
      code,
      address,
      is_active: true,
    })
    .select('id, org_id, name, code, address, is_active')
    .single()

  if (insertError || !insertedBranch?.id) {
    return { error: insertError?.message || 'Gagal menambahkan unit baru.' }
  }

  cookieStore.set(ACTIVE_BRANCH_COOKIE, insertedBranch.id, getActiveContextCookieOptions())
  await persistMembershipActiveContext(admin, {
    userId: user.id,
    orgId: trimmedOrgId,
    branchId: insertedBranch.id,
  })
  revalidatePath('/', 'layout')
  revalidatePath('/settings/branches')
  revalidatePath('/settings/users')
  await nudgeEduModeValidation('organization.create.branch')
  return {
    success: true,
    branch: insertedBranch,
    branchId: insertedBranch.id,
  }
}

export async function updateBranch(orgId: string, branchId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)
  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = String(orgId || '').trim()
  const trimmedBranchId = String(branchId || '').trim()
  const name = String(formData.get('name') || '').trim()
  const code = String(formData.get('code') || '').trim().toUpperCase()
  const addressRaw = String(formData.get('address') || '').trim()
  const address = addressRaw || null

  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }
  if (!trimmedBranchId) return { error: 'Unit tidak valid.' }
  if (!name) return { error: 'Nama unit wajib diisi.' }
  if (!code) return { error: 'Kode unit wajib diisi.' }

  // Check actor permissions
  const { data: actorMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', trimmedOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!actorMembership || !['owner', 'admin'].includes(String(actorMembership.role || ''))) {
    return { error: 'Hanya owner atau admin yang dapat mengubah unit.' }
  }

  // Duplicate check (ignore self)
  const { data: dupName } = await db
    .from('branches')
    .select('id')
    .eq('org_id', trimmedOrgId)
    .eq('name', name)
    .neq('id', trimmedBranchId)
    .maybeSingle()
  if (dupName?.id) return { error: 'Nama unit sudah digunakan.' }

  const { data: dupCode } = await db
    .from('branches')
    .select('id')
    .eq('org_id', trimmedOrgId)
    .eq('code', code)
    .neq('id', trimmedBranchId)
    .maybeSingle()
  if (dupCode?.id) return { error: 'Kode unit sudah digunakan.' }

  const { error: updateError } = await db
    .from('branches')
    .update({ name, code, address, updated_at: new Date().toISOString() })
    .eq('id', trimmedBranchId)
    .eq('org_id', trimmedOrgId)

  if (updateError) return { error: updateError.message || 'Gagal memperbarui unit.' }

  revalidatePath('/settings/branches')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteBranch(orgId: string, branchId: string) {
  const supabase = await createClient()
  const db = supabase as any
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)
  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = String(orgId || '').trim()
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }
  if (!trimmedBranchId) return { error: 'Unit tidak valid.' }

  const { data: actorMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', trimmedOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!actorMembership || String(actorMembership.role || '') !== 'owner') {
    return { error: 'Hanya owner yang dapat menghapus unit.' }
  }

  // Prevent deleting the only branch
  const { count: branchCount } = await db
    .from('branches')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', trimmedOrgId)
    .eq('is_active', true)

  if ((branchCount ?? 0) <= 1) {
    return { error: 'Tidak dapat menghapus satu-satunya unit aktif.' }
  }

  // ── Pre-flight: cek semua tabel yang punya FK NOT NULL ke branches ──
  // Tabel-tabel ini tidak bisa pakai ON DELETE SET NULL karena kolomnya NOT NULL,
  // sehingga harus dicek manual sebelum delete.
  const blockerTables: { table: string; label: string }[] = [
    { table: 'bank_accounts',          label: 'Akun Bank'          },
    { table: 'bank_transactions',      label: 'Transaksi Bank'     },
    { table: 'bank_mutations',         label: 'Mutasi Bank'        },
    { table: 'service_orders',         label: 'Order Jasa'         },
    { table: 'construction_projects',  label: 'Project Konstruksi' },
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
      error: `Unit ini tidak dapat dihapus karena masih memiliki data terkait:\n• ${blockers.join('\n• ')}\n\nPindahkan atau hapus data tersebut terlebih dahulu sebelum menghapus unit.`,
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
      return { error: 'Unit masih memiliki data terkait dan tidak dapat dihapus. Hapus semua data yang menggunakan unit ini terlebih dahulu.' }
    }
    return { error: deleteError.message || 'Gagal menghapus unit.' }
  }

  revalidatePath('/settings/branches')
  revalidatePath('/', 'layout')
  return { success: true }
}


export async function assignBranchPIC(orgId: string, branchId: string, employeeId: string | null) {
  const supabase = await createClient()
  const db = supabase as any
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)
  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = String(orgId || '').trim()
  const trimmedBranchId = String(branchId || '').trim()
  const normalizedEmployeeId = String(employeeId || '').trim() || null

  if (!trimmedOrgId) return { error: 'Organisasi tidak valid.' }
  if (!trimmedBranchId) return { error: 'Unit tidak valid.' }

  const { data: actorMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', trimmedOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!actorMembership || !['owner', 'admin'].includes(String(actorMembership.role || ''))) {
    return { error: 'Hanya owner atau admin yang dapat mengubah PIC unit.' }
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

  if (updateError) return { error: updateError.message || 'Gagal menyimpan PIC unit.' }

  revalidatePath('/settings/branches')
  return { success: true }
}

export async function updateMemberUnitAccess(orgId: string, memberId: string, branchIds: string[]) {
  const supabase = await createClient()
  const db = supabase as any
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)

  if (!user) return { error: 'Tidak terautentikasi.' }

  const trimmedOrgId = orgId.trim()
  const trimmedMemberId = memberId.trim()
  if (!trimmedOrgId || !trimmedMemberId) {
    return { error: 'Data anggota tidak valid.' }
  }

  const { data: actorMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', trimmedOrgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!actorMembership || !['owner', 'admin'].includes(String(actorMembership.role || ''))) {
    return { error: 'Hanya owner atau admin yang dapat mengatur akses unit.' }
  }

  const { data: targetMembership } = await db
    .from('org_members')
    .select('id, role')
    .eq('id', trimmedMemberId)
    .eq('org_id', trimmedOrgId)
    .eq('is_active', true)
    .maybeSingle()

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
    return { error: 'Minimal satu unit harus dipilih untuk anggota non-owner/admin.' }
  }

  let validBranches: Array<{ id: string; name: string; code: string }> = []
  if (normalizedBranchIds.length > 0) {
    const { data: branchRows, error: branchError } = await db
      .from('branches')
      .select('id, name, code')
      .eq('org_id', trimmedOrgId)
      .eq('is_active', true)
      .in('id', normalizedBranchIds)

    if (branchError) {
      return { error: 'Gagal memverifikasi unit yang dipilih.' }
    }

    validBranches = Array.isArray(branchRows) ? branchRows : []
    if (validBranches.length !== normalizedBranchIds.length) {
      return { error: 'Satu atau lebih unit yang dipilih tidak valid.' }
    }
  }

  const { error: deleteError } = await db
    .from('org_member_units')
    .delete()
    .eq('org_id', trimmedOrgId)
    .eq('org_member_id', trimmedMemberId)

  if (deleteError) {
    return { error: 'Gagal menghapus akses unit sebelumnya.' }
  }

  if (normalizedBranchIds.length > 0) {
    const { error: insertError } = await db
      .from('org_member_units')
      .insert(
        normalizedBranchIds.map((branchId) => ({
          org_member_id: trimmedMemberId,
          org_id: trimmedOrgId,
          branch_id: branchId,
          assigned_by: user.id,
        }))
      )

    if (insertError) {
      return { error: 'Gagal menyimpan akses unit anggota.' }
    }
  }

  revalidatePath('/settings/users')
  revalidatePath('/', 'layout')
  return {
    success: true,
    branchIds: normalizedBranchIds,
    branches: validBranches,
  }
}

// INVITATION TOKENS
export async function getInvitations(orgId: string) {
  const { queryPostgres: qp } = await import('@/lib/db/postgres')
  const result = await qp<Record<string, unknown>>(`
    SELECT i.*, r.name AS role_name
    FROM public.org_invitations i
    LEFT JOIN public.roles r ON r.id = i.role_id
    WHERE i.org_id = $1
    ORDER BY i.created_at DESC
  `, [orgId])
  return result.rows.map((row) => ({
    ...row,
    roles: row.role_name ? { name: row.role_name } : null,
  }))
}

export async function createInvitationToken(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const user = await getAuthenticatedUserFromSupabaseOrInternal(supabase)
  if (!user) return { error: 'Unauthorized' }

  const code = Math.random().toString(36).substring(2, 10).toUpperCase()
  const durationDays = parseInt(formData.get('duration') as string || '0')
  
  let expiresAt = null
  if (durationDays > 0) {
     const date = new Date()
     date.setDate(date.getDate() + durationDays)
     expiresAt = date.toISOString()
  }

  const payload = {
    org_id: orgId,
    role_id: formData.get('role_id') || null,
    label: formData.get('label') || 'General Link',
    invitation_code: code,
    created_by: user.id,
    expires_at: expiresAt,
    is_active: true
  }

  const { data, error } = await db
    .from('org_invitations')
    .insert(payload)
    .select('*')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/settings/business')
  revalidatePath('/settings/users')
  revalidatePath('/hris')
  return { success: true, code, invitation: data }
}

export async function deleteInvitation(id: string) {
  const supabase = await createClient()
  const db = supabase as any
  await db.from('org_invitations').delete().eq('id', id)
  revalidatePath('/settings/business')
  revalidatePath('/settings/users')
  revalidatePath('/hris')
  return { success: true }
}

export async function getInvitationByCode(code: string) {
  const { queryPostgres: qp } = await import('@/lib/db/postgres')
  const result = await qp<Record<string, unknown>>(`
    SELECT
      i.*,
      o.id AS org_id_ref, o.name AS org_name, o.slug AS org_slug,
      o.logo_url AS org_logo_url, o.settings AS org_settings, o.is_active AS org_is_active,
      r.id AS role_id_ref, r.name AS role_name, r.permissions AS role_permissions
    FROM public.org_invitations i
    LEFT JOIN public.organizations o ON o.id = i.org_id
    LEFT JOIN public.roles r ON r.id = i.role_id
    WHERE i.invitation_code = $1 AND i.is_active = true
    LIMIT 1
  `, [code.toUpperCase().trim()])

  const row = result.rows[0]
  if (!row) return { error: 'Link tidak valid atau telah non-aktif.' }

  return {
    success: true,
    invitation: {
      ...row,
      organizations: row.org_name ? {
        id: row.org_id_ref,
        name: row.org_name,
        slug: row.org_slug,
        logo_url: row.org_logo_url,
        settings: row.org_settings,
        is_active: row.org_is_active,
      } : null,
      roles: row.role_name ? {
        id: row.role_id_ref,
        name: row.role_name,
        permissions: row.role_permissions,
      } : null,
    }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// resolveOrgBySlug — publik, tanpa auth — untuk login page ?org=slug
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveOrgBySlug(slug: string): Promise<{
  id: string
  name: string
  logo_url: string | null
  slug: string
} | null> {
  if (!slug) return null
  const db = await createClient()
  const { data } = await (db as any)
    .from('organizations')
    .select('id, name, logo_url, slug')
    .eq('slug', slug.toLowerCase().trim())
    .eq('is_active', true)
    .maybeSingle()
  return data || null
}
