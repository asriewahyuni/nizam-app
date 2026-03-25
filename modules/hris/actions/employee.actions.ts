'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getEmployees(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
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

  const { error } = await supabase.from('employees').insert({
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

  const { error } = await supabase
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
