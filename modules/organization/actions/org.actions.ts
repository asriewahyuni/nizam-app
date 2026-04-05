'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { normalizeSaasEntitlementName } from '@/lib/saas/module-catalog'
import { generateSlug } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { seedDemoData, type DemoBusinessType } from '@/modules/demo/actions/demo.actions'
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
import { applyVoucher } from './billing.actions'
import { syncParentCoAToChildOrg } from '@/modules/accounting/actions/coa.actions'

const ACTIVE_CONTEXT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const DEFAULT_BRANCH_NAME = 'Unit Utama'
const DEFAULT_BRANCH_CODE = 'MAIN'

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

type CreateOrganizationSuccess = {
  success: true
  orgId: string
  branchId: string
}

type CreateOrganizationFailure = {
  error: string
}

type CreateOrganizationActionResult = CreateOrganizationSuccess | CreateOrganizationFailure

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
  const supabase = await createClient()
  const db = supabase as any
  const admin = (await createAdminClient()) as any
  const cookieStore = await cookies()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const name = (formData.get('name') as string).trim()
  if (!name) return { error: 'Nama organisasi wajib diisi' }
  const slug = generateSlug(name)
  const orgId = crypto.randomUUID()
  const defaultBranchId = crypto.randomUUID()

  // POPULATE OWNER EMAIL FROM SESSION
  const ownerEmail = user.email
  const planParam = formData.get('plan') as string
  const businessType = (formData.get('type') || 'BLANK') as DemoBusinessType
  const isDemo = planParam === 'demo'
  const isAbs = planParam === 'abs'
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

  const { error: orgError } = await db
    .from('organizations')
    .insert({
      id: orgId,
      name,
      slug,
      owner_email: ownerEmail,
      parent_org_id: parentOrgId || null,
      settings: {
        currency: 'IDR',
        timezone: 'Asia/Jakarta',
        fiscal_year_start_month: 1,
        plan: isDemo ? 'Demo' : 'Trial', // Default plan for new orgs
        is_demo: isDemo,
        business_type: businessType
      },
    })

  if (orgError) {
    if (orgError.code === '23505') return { error: 'Nama organisasi ini sudah digunakan.' }
    return { error: 'Gagal membuat organisasi.' }
  }

  const { error: memberError } = await admin
    .from('org_members')
    .insert({ org_id: orgId, user_id: user.id, role: 'owner' })

  if (memberError) {
    await admin.from('organizations').delete().eq('id', orgId)
    return { error: 'Gagal menambahkan anggota.' }
  }

  const { error: branchError } = await admin
    .from('branches')
    .insert({
      id: defaultBranchId,
      org_id: orgId,
      name: DEFAULT_BRANCH_NAME,
      code: DEFAULT_BRANCH_CODE,
      address: null,
      is_active: true,
    })

  if (branchError) {
    await admin.from('organizations').delete().eq('id', orgId)
    return { error: 'Gagal menyiapkan unit default organisasi.' }
  }

  await persistMembershipActiveContext(admin, {
    userId: user.id,
    orgId,
    branchId: defaultBranchId,
  })

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
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const memberData = await resolveActiveMembership(
    db,
    user,
    cookieStore,
    'org_id, role, role_id, joined_at, last_active_at, last_active_branch_id, organizations(*), roles(permissions)'
  )

  if (!memberData) return null

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
  // Note: enabled_modules column may not exist in DB; rely on saas_packages + active_addons
  let enabledModules: string[] = []

  // DYNAMIC MODULE RESOLUTION FROM SaaS PACKAGE
  if (planName) {
    const { data: pkgData } = await db
      .from('saas_packages')
      .select('modules')
      .eq('name', planName)
      .eq('is_active', true)
      .maybeSingle()
    
    if (pkgData?.modules) {
      try {
        const pkgModules = Array.isArray(pkgData.modules) ? pkgData.modules : JSON.parse(pkgData.modules || '[]')
        enabledModules = [...enabledModules, ...pkgModules]
      } catch (pkgError) {
        (console as any).error('GetActiveOrg: failed to parse package modules', pkgError)
      }
    }
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
    .select('job_title')
    .eq('org_id', activeOrgId)
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    org,
    role: memberData.role as string,
    roleId: memberData.role_id,
    jobTitle: empData?.job_title || memberData.role,
    permissions: (memberData.roles as any)?.permissions || [],
    enabledModules,
    user
  }
}

export async function getMyOrganizations(): Promise<AccessibleOrganization[]> {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
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
}

export async function setActiveOrg(orgId: string) {
  const supabase = await createClient()
  const admin = (await createAdminClient()) as any
  const db = supabase as any
  const cookieStore = await cookies()
  const trimmedOrgId = orgId.trim()

  if (!trimmedOrgId) {
    return { error: 'Organisasi tidak valid.' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const { data: membership, error } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('org_id', trimmedOrgId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !membership) {
    return { error: 'Anda tidak memiliki akses ke organisasi tersebut.' }
  }

  cookieStore.delete('nizam_demo_org_id')
  cookieStore.set(ACTIVE_ORG_COOKIE, trimmedOrgId, getActiveContextCookieOptions())
  const branchAccessScope = await getBranchAccessScope(trimmedOrgId)
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

export async function updateOrgSettings(orgId: string, updates: any) {
  const supabase = await createClient()
  const db = supabase as any
  const { error } = await db.from('organizations').update(updates).eq('id', orgId)
  if (error) return { error: 'Gagal menyimpan.' }
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Auth failed' }

  const file = formData.get('file') as File
  const filePath = `${orgId}/logo-${Date.now()}`

  await supabase.storage.from('brand_assets').upload(filePath, file, { upsert: true })
  const { data: { publicUrl } } = supabase.storage.from('brand_assets').getPublicUrl(filePath)
  await db.from('organizations').update({ logo_url: publicUrl }).eq('id', orgId)

  revalidatePath('/settings/business')
  return { success: true, url: publicUrl }
}

export async function getOrgMembers(orgId: string) {
  const supabase = await createClient()
  const db = supabase as any
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: actorMembership } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!actorMembership || !['owner', 'admin'].includes(String(actorMembership.role || ''))) {
    return []
  }

  const { data } = await db
    .from('org_members')
    .select(`
      *,
      organizations(name),
      user:user_id (
        email
      ),
      unit_assignments:org_member_units(
        branch_id,
        branch:branches(id, name, code)
      )
    `)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
  return data || []
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
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
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

export async function getActiveBranch(orgId: string) {
  return getCurrentAccessibleBranch(orgId)
}

export async function setActiveBranch(orgId: string, branchId: string | null) {
  const supabase = await createClient()
  const admin = (await createAdminClient()) as any
  const cookieStore = await cookies()
  const { data: { user } } = await supabase.auth.getUser()
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
  const supabase = await createClient()
  const db = supabase as any
  const { data } = await db.from('org_invitations').select('*, roles(name)').eq('org_id', orgId).order('created_at', { ascending: false })
  return data || []
}

export async function createInvitationToken(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
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
    .select('*, roles(name)')
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
  const supabase = await createClient()
  const db = supabase as any
  const { data, error } = await db
    .from('org_invitations')
    .select('*, organizations(*), roles(*)')
    .eq('invitation_code', code.toUpperCase().trim())
    .eq('is_active', true)
    .maybeSingle()
  
  if (error) return { error: error.message }
  if (!data) return { error: 'Link tidak valid atau telah non-aktif.' }
  
  return { success: true, invitation: data }
}
