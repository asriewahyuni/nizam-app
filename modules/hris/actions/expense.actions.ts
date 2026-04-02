'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

async function resolveExpenseBranchSelection(orgId: string, branchId?: string | null): Promise<BranchSelectionResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function ensureExpenseBranchAccess(orgId: string, branchId: string | null, notFoundMessage: string) {
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedBranchId) {
    return { error: notFoundMessage }
  }

  const branchSelection = await resolveExpenseBranchSelection(orgId, trimmedBranchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error }
  }

  return { branchId: trimmedBranchId }
}

export async function getExpenseClaims(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const db = supabase as any
  const branchSelection = await resolveExpenseBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = db
    .from('expense_claims')
    .select(`
      *,
      branch:branches(id, name, code),
      employee:employee_id(first_name, last_name, nik, branch_id)
    `)
    .eq('org_id', orgId)
    .order('claim_date', { ascending: false })

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query

  if (error) return []
  return data
}

export async function createExpenseClaim(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const employeeId = String(formData.get('employee_id') || '').trim()
  if (!employeeId) return { error: 'Karyawan wajib dipilih.' }

  const { data: employee, error: employeeError } = await db
    .from('employees')
    .select('id, branch_id')
    .eq('id', employeeId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (employeeError) return { error: employeeError.message }

  const accessibleEmployee = await ensureExpenseBranchAccess(
    orgId,
    employee?.branch_id ?? null,
    'Data karyawan tidak ditemukan.'
  )
  if ('error' in accessibleEmployee) return { error: accessibleEmployee.error }

  const amount = Number(formData.get('amount') || 0)
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const claimDate = formData.get('claim_date') as string || new Date().toISOString().split('T')[0]

  const { error } = await db.from('expense_claims').insert({
    org_id: orgId,
    branch_id: accessibleEmployee.branchId,
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
  const db = supabase as any
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: claim, error: claimError } = await db
    .from('expense_claims')
    .select('id, org_id, branch_id')
    .eq('id', claimId)
    .maybeSingle()

  if (claimError) return { error: claimError.message }

  const accessibleClaim = await ensureExpenseBranchAccess(
    claim?.org_id ?? '',
    claim?.branch_id ?? null,
    'Klaim tidak ditemukan.'
  )
  if ('error' in accessibleClaim) return { error: accessibleClaim.error }

  const { error } = await db.rpc('process_expense_claim', {
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
  const db = supabase as any

  const { data: claim, error: claimError } = await db
    .from('expense_claims')
    .select('id, org_id, branch_id')
    .eq('id', claimId)
    .maybeSingle()

  if (claimError) return { error: claimError.message }

  const accessibleClaim = await ensureExpenseBranchAccess(
    claim?.org_id ?? '',
    claim?.branch_id ?? null,
    'Klaim tidak ditemukan.'
  )
  if ('error' in accessibleClaim) return { error: accessibleClaim.error }

  const { error } = await db
    .from('expense_claims')
    .delete()
    .eq('id', claimId)
    .eq('org_id', claim.org_id)
    .eq('branch_id', accessibleClaim.branchId)

  if (error) return { error: error.message }
  revalidatePath('/hris')
  return { success: true }
}
