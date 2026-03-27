'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ─────────────────────────────────────────────────────────────
// signUp — Create a new Business Owner account
// ─────────────────────────────────────────────────────────────
export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { 
        full_name: fullName,
        login_type: 'owner' 
      },
    },
  })

  if (error) {
    const msg = encodeURIComponent(error.message)
    redirect(`/register?error=${msg}`)
  }

  revalidatePath('/', 'layout')
  redirect('/onboarding')
}

// ─────────────────────────────────────────────────────────────
// signIn — Regular Business Owner/Admin login via email
// ─────────────────────────────────────────────────────────────
export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string | null

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const msg = encodeURIComponent('Email atau password salah.')
    redirect(`/login?error=${msg}`)
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo || '/dashboard')
}

// ─────────────────────────────────────────────────────────────
// signOut — Standard sign out
// ─────────────────────────────────────────────────────────────
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ─────────────────────────────────────────────────────────────
// getSession — Server-side session check
// ─────────────────────────────────────────────────────────────
export async function getSession() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// ─────────────────────────────────────────────────────────────
// verifyEmployeeNikBySlug — Used during custom registration flow
// ─────────────────────────────────────────────────────────────
export async function verifyEmployeeNikBySlug(slug: string, nik: string) {
  const adminClient = await createAdminClient()

  // 1. Get Organization ID from Slug (Case Insensitive)
  const { data: org, error: orgErr } = await (adminClient as any)
    .from('organizations')
    .select('id')
    .eq('slug', slug.toLowerCase().trim())
    .single()

  if (orgErr || !org) return { error: 'Organisasi tidak ditemukan' }

  // 2. Check if NIK belongs to this Org AND is not registered yet
  const { data: emp, error: empErr } = await (adminClient as any)
    .from('employees')
    .select('id, first_name, last_name, user_id')
    .eq('org_id', org.id)
    .eq('nik', nik.trim())
    .maybeSingle()

  if (empErr) return { error: 'Database error' }
  if (!emp) return { error: 'NIK tidak terdaftar di organisasi ini' }
  if (emp.user_id) return { error: 'NIK ini sudah memiliki akun aktif' }

  return { success: true, employee: emp }
}

// ─────────────────────────────────────────────────────────────
// registerEmployeeAccount — Converts employee to auth user
// ─────────────────────────────────────────────────────────────
export async function registerEmployeeAccount(formData: FormData) {
  const adminClient = await createAdminClient()
  const publicClient = await createClient()

  const nik = (formData.get('nik') as string)?.trim()
  const password = formData.get('password') as string

  // 1. Re-verify NIK
  const { data: emp, error: empErr } = await (adminClient as any)
    .from('employees')
    .select('*')
    .eq('nik', nik)
    .single()

  if (empErr || !emp) throw new Error('NIK Invalid')
  if (emp.user_id) throw new Error('Already Registered')

  // 2. Generate internal email from NIK + org_id (unique, not user-facing)
  const orgPrefix = (emp.org_id as string).replace(/-/g, '').toLowerCase().slice(0, 8)
  const nikSlug = nik.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const internalEmail = `${nikSlug}@${orgPrefix}.staff.nizam`

  // 3. Create Supabase Auth User
  const { data: authData, error: authErr } = await publicClient.auth.signUp({
    email: internalEmail,
    password,
    options: {
      data: { 
        full_name: `${emp.first_name} ${emp.last_name}`,
        nik,
        login_type: 'employee'
      },
    },
  })

  if (authErr) throw new Error(authErr.message)
  const userId = authData.user?.id
  if (!userId) throw new Error('Failed to create account')

  // 4. Update Employee table with user_id & activate
  await (adminClient as any)
    .from('employees')
    .update({ 
      user_id: userId,
      employment_status: emp.employment_status || 'PROBATION'
    })
    .eq('id', emp.id)

  // 5. Create Org Member with role from job_title (Case Insensitive)
  const { data: allRoles } = await (adminClient as any)
    .from('roles')
    .select('id, name')
    .eq('org_id', emp.org_id)

  const matchingRole = allRoles?.find((r: any) => 
    r.name.toLowerCase().trim() === emp.job_title?.toLowerCase().trim()
  )

  await (adminClient as any)
    .from('org_members')
    .insert({
      org_id: emp.org_id,
      user_id: userId,
      role: 'staff',
      role_id: matchingRole?.id || null,
      is_active: true
    })

  redirect('/dashboard')
}

// ─────────────────────────────────────────────────────────────
// signInWithNik — Employee login via NIK + password
// ─────────────────────────────────────────────────────────────
export async function signInWithNik(formData: FormData) {
  const adminClient = await createAdminClient()
  const publicClient = await createClient()

  const nik = (formData.get('nik') as string)?.trim()
  const password = (formData.get('password') as string)
  const redirectTo = formData.get('redirectTo') as string | null

  if (!nik || !password) {
     redirect(`/login?error=${encodeURIComponent('NIK dan Password wajib diisi.')}&tab=karyawan`)
  }

  // Lookup employee by NIK to get org_id (needed to reconstruct email)
  const { data: emp, error: empErr } = await (adminClient as any)
    .from('employees')
    .select('org_id, user_id')
    .eq('nik', nik)
    .single()

  if (empErr || !emp) {
    redirect(`/login?error=${encodeURIComponent('NIK tidak ditemukan.')}&tab=karyawan`)
  }

  if (!emp.user_id) {
    redirect(`/login?error=${encodeURIComponent('Akun belum diaktivasi. Silakan pendaftaran terlebih dahulu.')}&tab=karyawan`)
  }

  const orgPrefix = (emp.org_id as string).replace(/-/g, '').toLowerCase().slice(0, 8)
  const nikSlug = nik.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const internalEmail = `${nikSlug}@${orgPrefix}.staff.nizam`

  const { error } = await publicClient.auth.signInWithPassword({ 
     email: internalEmail, 
     password 
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent('NIK atau password salah.')}&tab=karyawan`)
  }

  redirect(redirectTo || '/dashboard')
}

// ─────────────────────────────────────────────────────────────
// requestPasswordReset — Employee signals they need a reset
// ─────────────────────────────────────────────────────────────
export async function requestPasswordReset(nik: string) {
  const adminClient = await createAdminClient()
  
  const { data: emp, error } = await (adminClient as any)
    .from('employees')
    .update({ 
      reset_requested: true,
      reset_requested_at: new Date().toISOString()
    })
    .eq('nik', nik.trim())
    .select('id, first_name')
    .maybeSingle()

  if (error || !emp) return { error: 'Gagal mengajukan reset. Pastikan NIK terdaftar.' }
  
  revalidatePath('/hris')
  return { success: true, name: emp.first_name }
}

// ─────────────────────────────────────────────────────────────
// resetEmployeePassword — Owner/Admin resets password manually
// ─────────────────────────────────────────────────────────────
export async function resetEmployeePassword(employeeId: string, newPassword: string) {
  const adminClient = await createAdminClient()
  
  // 1. Get user_id from employee record
  const { data: emp, error: empErr } = await (adminClient as any)
    .from('employees')
    .select('user_id, nik')
    .eq('id', employeeId)
    .single()

  if (empErr || !emp.user_id) return { error: 'User tidak ditemukan.' }

  // 2. Update Auth User password
  const { error: authErr } = await adminClient.auth.admin.updateUserById(emp.user_id, {
    password: newPassword
  })

  if (authErr) return { error: 'Gagal mereset: ' + authErr.message }

  // 3. Clear reset request flag
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
