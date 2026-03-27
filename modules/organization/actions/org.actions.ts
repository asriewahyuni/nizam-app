'use server'

import { createClient } from '@/lib/supabase/server'
import { generateSlug } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

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

  const { error: orgError } = await db
    .from('organizations')
    .insert({
      id: orgId,
      name,
      slug,
      settings: {
        currency: 'IDR',
        timezone: 'Asia/Jakarta',
        fiscal_year_start_month: 1,
        plan: 'Trial' // Default plan for new orgs
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
    
    if (error) console.error('GetActiveOrg Error:', error)
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
      enabledModules = Array.from(new Set([...enabledModules, ...pkgModules]))
    }
  }

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
  revalidatePath('/settings')
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
