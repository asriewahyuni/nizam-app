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

  // Use regular signUp for owners so they get logged in automatically
  // and are prompted for email confirmation if enabled in dashboard.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { 
        full_name: fullName,
        login_type: 'owner',
        is_demo: formData.get('plan') === 'demo'
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
// registerEmployeeAccount — Converts employee to auth user
// ─────────────────────────────────────────────────────────────
export async function registerEmployeeAccount(formData: FormData) {
  const adminClient = await createAdminClient()
  const publicClient = await createClient()

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

  // 3. Generate Internal Email
  const orgPrefix = (emp.org_id as string).replace(/-/g, '').toLowerCase().slice(0, 8)
  const nikSlug = nik.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const internalEmail = `${nikSlug}@${orgPrefix}.staff.nizam`

  // 4. Create Auth User via ADMIN to bypass SMTP/Confirmation hurdles for internal staff
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true, // AUTO-CONFIRM for staff
    user_metadata: { 
      full_name: `${emp.first_name} ${emp.last_name}`,
      nik,
      login_type: 'employee'
    }
  })

  if (authErr) {
     return { error: authErr.message || 'Gagal membuat akun autentikasi.' }
  }

  const userId = authData.user?.id
  if (!userId) return { error: 'Gagal membuat user ID.' }

  // 5. Update Employee Record
  const { error: updateErr } = await (adminClient as any)
    .from('employees')
    .update({ 
      user_id: userId,
      employment_status: emp.employment_status || 'PROBATION',
      registration_status: 'REGISTERED',
    })
    .eq('id', emp.id)

  if (updateErr) return { error: 'Gagal menautkan user ke data karyawan.' }

  // 6. Map Role
  let roleId = invite?.role_id
  if (!roleId) {
     const { data: allRoles } = await (adminClient as any)
       .from('roles')
       .select('id, name')
       .eq('org_id', emp.org_id)
  
     const matchingRole = allRoles?.find((r: any) => 
       r.name.toLowerCase().trim() === emp.job_title?.toLowerCase().trim()
     )
     roleId = matchingRole?.id || null
  }

  // 7. Insert Organization Membership
  const { error: memberErr } = await (adminClient as any)
    .from('org_members')
    .upsert({
      org_id: emp.org_id,
      user_id: userId,
      role: 'staff',
      role_id: roleId,
      is_active: true
    }, { onConflict: 'org_id,user_id' })

  if (memberErr) return { error: 'Gagal mendaftarkan keanggotaan organisasi.' }

  // 8. Track Usage
  if (invite) {
     const nextUseCount = Number(invite.use_count || 0) + 1
     const maxUses = Number(invite.max_uses || 0)
     const shouldDeactivate = maxUses > 0 && nextUseCount >= maxUses
     await (adminClient as any)
       .from('org_invitations')
       .update({
         use_count: nextUseCount,
         ...(shouldDeactivate ? { is_active: false } : {})
       })
       .eq('id', invite.id)
  }

  // 9. Now Log in the user on the client side
  // Since we used admin.createUser, they are NOT logged in yet.
  // We'll perform a silent login or redirect to login.
  // BUT for better UX, we'll login them now.
  const { error: loginErr } = await publicClient.auth.signInWithPassword({ 
    email: internalEmail, 
    password 
  })

  if (loginErr) {
     return { error: 'Akun berhasil dibuat, tapi login otomatis gagal. Silakan login manual pakai NIK & password baru.' }
  }

  revalidatePath('/', 'layout')
  return { success: true, redirectTo: '/dashboard' }
}

// ─────────────────────────────────────────────────────────────
// signInWithNik — Standard login for staff
// ─────────────────────────────────────────────────────────────
export async function signInWithNik(formData: FormData) {
  const adminClient = await createAdminClient()
  const publicClient = await createClient()

  let nik = (formData.get('nik') as string)?.trim()
  const password = (formData.get('password') as string)
  const redirectTo = (formData.get('redirectTo') as string)

  if (!nik || !password) {
     redirect(`/login?error=${encodeURIComponent('NIK dan Password wajib diisi.')}&tab=karyawan`)
  }

  nik = nik.toUpperCase()

  const { data: emp, error: empErr } = await (adminClient as any)
    .from('employees')
    .select('org_id, user_id')
    .eq('nik', nik)
    .limit(1)
    .maybeSingle()

  if (empErr && empErr.code === 'PGRST116') {
     redirect(`/login?error=${encodeURIComponent('Terdeteksi duplikasi NIK di database. Harap hubungi Admin.')}&tab=karyawan`)
  }
  if (empErr) {
     redirect(`/login?error=${encodeURIComponent(`Database Error: ${empErr.message}`)}&tab=karyawan`)
  }
  if (!emp) {
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

  revalidatePath('/', 'layout')
  redirect(redirectTo || '/dashboard')
}

// REST REMAINING (signOut, verifyEmployeeNikByToken, etc.)
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function getSession() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
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
  
  const { data: emp, error } = await (adminClient as any)
    .from('employees')
    .update({ 
      reset_requested: true,
      reset_requested_at: new Date().toISOString()
    })
    .eq('nik', formattedNik)
    .select('id, first_name')
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
     return { error: `Database Error: ${error.message}` }
  }
  if (!emp && error?.code === 'PGRST116') {
     return { error: 'Terdeteksi Duplikat NIK di Database. Hubungi Administrator System.' }
  }
  if (!emp) return { error: 'Gagal mengajukan reset. Pastikan NIK terdaftar atau periksa huruf/angkanya.' }
  
  revalidatePath('/hris')
  return { success: true, name: emp.first_name }
}

export async function resetEmployeePassword(employeeId: string, newPassword: string) {
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
