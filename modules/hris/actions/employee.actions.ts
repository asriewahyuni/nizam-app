'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getEmployees(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('employees')
    .select('*')
    .eq('org_id', orgId)
    .order('first_name')

  if (error) return []
  return data
}

export async function createEmployee(orgId: string, formData: FormData) {
  const supabase = await createClient()

  // Extract basics
  const nik = formData.get('nik') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const jobTitle = formData.get('job_title') as string
  const status = formData.get('employment_status') as string || 'FULL_TIME'
  const basicSalary = Number(formData.get('basic_salary') || 0)
  const joinDate = formData.get('join_date') as string || new Date().toISOString().split('T')[0]

  const { error } = await (supabase as any).from('employees').insert({
    org_id: orgId,
    nik,
    first_name: firstName,
    last_name: lastName,
    job_title: jobTitle,
    employment_status: status,
    basic_salary: basicSalary,
    join_date: joinDate,
    department: formData.get('department'),
    email: formData.get('email'),
    whatsapp: formData.get('whatsapp') || null,
    avatar_url: formData.get('avatar_url') || null,
    bank_name: formData.get('bank_name'),
    bank_account_number: formData.get('bank_account_number'),
    tax_status: formData.get('tax_status')
  })

  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}

export async function updateEmployee(id: string, orgId: string, formData: FormData) {
  const supabase = await createClient()

  const nik = formData.get('nik') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const jobTitle = formData.get('job_title') as string
  const status = formData.get('employment_status') as string || 'FULL_TIME'
  const basicSalary = Number(formData.get('basic_salary') || 0)
  const joinDate = formData.get('join_date') as string

  const { error } = await (supabase as any)
    .from('employees')
    .update({
      nik,
      first_name: firstName,
      last_name: lastName,
      job_title: jobTitle,
      employment_status: status,
      basic_salary: basicSalary,
      join_date: joinDate,
      department: formData.get('department'),
      email: formData.get('email'),
      whatsapp: formData.get('whatsapp') || null,
      avatar_url: formData.get('avatar_url') || null,
      bank_name: formData.get('bank_name'),
      bank_account_number: formData.get('bank_account_number'),
      tax_status: formData.get('tax_status'),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}

export async function uploadEmployeeAvatar(file: File, empId: string) {
  const supabase = await createClient()
  const ext = file.name.split('.').pop()
  const path = `emp-${empId}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) return { error: upErr.message }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return { url: data.publicUrl }
}

export async function updateEmployeePasswordSelf(empId: string, newPassword: string) {
  const admin = await createAdminClient()
  const supabase = await createClient()
  const { data: emp } = await (supabase as any)
    .from('employees')
    .select('user_id')
    .eq('id', empId)
    .single()
  if (!emp?.user_id) return { error: 'User auth tidak ditemukan.' }
  const { error } = await admin.auth.admin.updateUserById(emp.user_id, { password: newPassword })
  if (error) return { error: error.message }
  return { success: true }
}

export async function updateEmployeeProfile(empId: string, payload: { avatar_url?: string; whatsapp?: string }) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('employees')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', empId)
  if (error) return { error: error.message }
  revalidatePath('/profil-saya')
  return { success: true }
}

