'use server'

import { createClient } from '@/lib/supabase/server'
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
  canAccessAllBranchesForOrg,
  getBranchAccessScope,
  getCurrentAccessibleBranch,
} from '@/modules/organization/lib/branch-access.server'
import { applyVoucher } from './billing.actions'

const DEMO_EMAIL = 'demo@nizam.app'
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

async function resolveActiveMembership(
  db: any,
  user: { id: string; email?: string | null; user_metadata?: Record<string, any> | null },
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  const isDemoUser = user.email === DEMO_EMAIL || user.user_metadata?.is_demo
  const demoOrgId = cookieStore.get('nizam_demo_org_id')?.value
  const activeOrgIdCookie = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

  let memberData: any = null

  if (isDemoUser && demoOrgId) {
    const { data } = await db
      .from('org_members')
      .select('org_id, role, role_id, joined_at, organizations(*), roles(permissions)')
      .eq('user_id', user.id)
      .eq('org_id', demoOrgId)
      .eq('is_active', true)
      .maybeSingle()
    memberData = data
  }

  if (!memberData && activeOrgIdCookie) {
    const { data } = await db
      .from('org_members')
      .select('org_id, role, role_id, joined_at, organizations(*), roles(permissions)')
      .eq('user_id', user.id)
      .eq('org_id', activeOrgIdCookie)
      .eq('is_active', true)
      .maybeSingle()
    memberData = data
  }

  if (!memberData) {
    const { data, error } = await db
      .from('org_members')
      .select('org_id, role, role_id, joined_at, organizations(*), roles(permissions)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      ;(console as any).error('resolveActiveMembership Error:', error)
    }
    memberData = data
  }

  return memberData
}

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
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

  const { error: orgError } = await db
    .from('organizations')
    .insert({
      id: orgId,
      name,
      slug,
      owner_email: ownerEmail,
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

  const { error: memberError } = await db
    .from('org_members')
    .insert({ org_id: orgId, user_id: user.id, role: 'owner' })

  if (memberError) {
    await db.from('organizations').delete().eq('id', orgId)
    return { error: 'Gagal menambahkan anggota.' }
  }

  const { error: branchError } = await db
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
    await db.from('organizations').delete().eq('id', orgId)
    return { error: 'Gagal menyiapkan unit default organisasi.' }
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

  revalidatePath('/dashboard')
  return redirect('/dashboard')
}

export async function getActiveOrg() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const memberData = await resolveActiveMembership(db, user, cookieStore)

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

  // Clean and unique
  enabledModules = Array.from(new Set(enabledModules.map((m: string) => normalizeSaasEntitlementName(String(m))).filter(Boolean)))

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
    .select('org_id, role, role_id, joined_at, organizations(id, name, slug, logo_url, settings, is_active)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })

  if (error || !Array.isArray(data)) {
    if (error) {
      ;(console as any).error('getMyOrganizations Error:', error)
    }
    return []
  }

  return data
    .map((membership: any) => {
      const org = membership.organizations
      if (!org || typeof org !== 'object') return null

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
        },
      } satisfies AccessibleOrganization
    })
    .filter((membership): membership is AccessibleOrganization => Boolean(membership))
}

export async function setActiveOrg(orgId: string) {
  const supabase = await createClient()
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
  if (!branchAccessScope.canAccessAllBranches && branchAccessScope.accessibleBranches.length > 0) {
    cookieStore.set(
      ACTIVE_BRANCH_COOKIE,
      branchAccessScope.accessibleBranches[0].id,
      getActiveContextCookieOptions()
    )
  } else {
    cookieStore.delete(ACTIVE_BRANCH_COOKIE)
  }

  revalidatePath('/', 'layout')
  return { success: true, orgId: trimmedOrgId }
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
    revalidatePath('/', 'layout')
    return { success: true, branchId: null }
  }

  const trimmedBranchId = branchId.trim()
  if (!branchAccessScope.accessibleBranchIds.includes(trimmedBranchId)) {
    return { error: 'Anda tidak memiliki akses ke unit tersebut.' }
  }

  cookieStore.set(ACTIVE_BRANCH_COOKIE, trimmedBranchId, getActiveContextCookieOptions())
  revalidatePath('/', 'layout')
  return { success: true, branchId: trimmedBranchId }
}

export async function canSelectAllBranches(orgId: string) {
  return canAccessAllBranchesForOrg(orgId)
}

export async function createBranch(orgId: string, formData: FormData) {
  const supabase = await createClient()
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
  revalidatePath('/', 'layout')
  revalidatePath('/settings/branches')
  revalidatePath('/settings/users')
  return {
    success: true,
    branch: insertedBranch,
    branchId: insertedBranch.id,
  }
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
