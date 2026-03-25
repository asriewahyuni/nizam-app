'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getExpenseClaims(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expense_claims')
    .select(`
      *,
      employee:employee_id(first_name, last_name, nik)
    `)
    .eq('org_id', orgId)
    .order('claim_date', { ascending: false })

  if (error) return []
  return data
}

export async function createExpenseClaim(orgId: string, formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const employeeId = formData.get('employee_id') as string // If HR creating for someone
  const amount = Number(formData.get('amount') || 0)
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const claimDate = formData.get('claim_date') as string || new Date().toISOString().split('T')[0]

  const { error } = await supabase.from('expense_claims').insert({
    org_id: orgId,
    employee_id: employeeId,
    amount,
    category,
    description,
    claim_date: claimDate,
    status: 'PENDING'
  })

  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}

export async function approveExpenseClaim(
  claimId: string, 
  expenseAccountId: string, 
  payableAccountId: string
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.rpc('process_expense_claim', {
    p_claim_id: claimId,
    p_approved_by: user.id,
    p_expense_account_id: expenseAccountId,
    p_payable_account_id: payableAccountId
  })

  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}

export async function deleteExpenseClaim(claimId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('expense_claims').delete().eq('id', claimId)
  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}
