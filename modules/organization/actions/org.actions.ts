'use server'

import { createClient } from '@/lib/supabase/server'
import { generateSlug } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { seedDemoData, type DemoBusinessType } from '@/modules/demo/actions/demo.actions'
import { applyVoucher } from './billing.actions'

const DEMO_EMAIL = 'demo@nizam.app'

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const name = (formData.get('name') as string).trim()
  if (!name) return { error: 'Nama organisasi wajib diisi' }
  const slug = generateSlug(name)
  const orgId = crypto.randomUUID()

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

  if (memberError) return { error: 'Gagal menambahkan anggota.' }

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

  revalidatePath('/dashboard')
  return redirect('/dashboard')
}

export async function getActiveOrg() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const isDemoUser = user.email === DEMO_EMAIL || user.user_metadata?.is_demo
  const cookieStore = await cookies()
  const demoOrgId = cookieStore.get('nizam_demo_org_id')?.value

  let memberData = null

  if (isDemoUser && demoOrgId) {
    const { data } = await db
      .from('org_members')
      .select('org_id, role, role_id, organizations(*), roles(permissions)')
      .eq('user_id', user.id)
      .eq('org_id', demoOrgId)
      .eq('is_active', true)
      .maybeSingle()
    memberData = data
  }

  if (!memberData) {
    const { data, error } = await db
      .from('org_members')
      .select('*, organizations(*), roles(permissions)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    if (error) (console as any).error('GetActiveOrg Error:', error)
    memberData = data
  }

  if (!memberData) return null

  const activeOrgId = memberData.org_id
  const org = memberData.organizations as any
  const planName = org?.settings?.plan
  let enabledModules = org?.enabled_modules || []

  // DYNAMIC MODULE RESOLUTION FROM SaaS PACKAGE
  if (planName) {
    const { data: pkgData } = await db
      .from('saas_packages')
      .select('modules')
      .eq('name', planName)
      .eq('is_active', true)
      .maybeSingle()
    
    if (pkgData?.modules) {
      const pkgModules = Array.isArray(pkgData.modules) ? pkgData.modules : JSON.parse(pkgData.modules || '[]')
      enabledModules = [...enabledModules, ...pkgModules]
    }
  }

  // ADD INDUSTRIAL ADD-ONS
  const activeAddons = Array.isArray(org.active_addons) ? org.active_addons : []
  activeAddons.forEach((a: any) => {
    if (a.name) enabledModules.push(a.name)
  })

  // Clean and unique
  enabledModules = Array.from(new Set(enabledModules.map((m: string) => m.trim())))

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
  const { data } = await db.from('org_members').select('*, organizations(name)').eq('org_id', orgId).eq('is_active', true)
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
  const supabase = await createClient()
  const db = supabase as any
  const { data } = await db.from('branches').select('*').eq('org_id', orgId).eq('is_active', true)
  return data || []
}

export async function createBranch(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  await db.from('branches').insert({ org_id: orgId, name: formData.get('name'), code: formData.get('code'), address: formData.get('address'), is_active: true })
  revalidatePath('/settings/branches')
  return { success: true }
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

  const { error } = await db.from('org_invitations').insert(payload)
  if (error) return { error: error.message }
  
  revalidatePath('/settings/business')
  return { success: true, code }
}

export async function deleteInvitation(id: string) {
  const supabase = await createClient()
  const db = supabase as any
  await db.from('org_invitations').delete().eq('id', id)
  revalidatePath('/settings/business')
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
