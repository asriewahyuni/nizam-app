'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type BranchFilterResult =
  | { branchId: string | null }
  | { error: string }

async function resolveBudgetBranchId(orgId: string, branchId?: string | null): Promise<BranchFilterResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return branchSelection
  }

  return { branchId: branchSelection.branchId }
}

async function requireActiveBranchId(orgId: string, errorMessage: string): Promise<BranchFilterResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: errorMessage }
  }

  return { branchId: branchSelection.branchId }
}

export async function getBudgets(orgId: string, period: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveBudgetBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = (supabase as any)
    .from('budgets')
    .select('*, accounts(code, name, type), branch:branches(id, name, code)')
    .eq('org_id', orgId)
    .eq('period', period)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query

  if (error) return []
  return data
}

export async function saveBudget(orgId: string, accountId: string, period: string, amount: number) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih satu unit aktif terlebih dahulu untuk menyimpan budget.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { error } = await (supabase as any)
    .from('budgets')
    .upsert({
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
      account_id: accountId,
      period,
      budget_amount: amount,
      updated_at: new Date().toISOString()
    }, { onConflict: 'org_id,branch_id,account_id,period' })
  if (error) return { error: error.message || 'Gagal menyimpan budget.' }

  revalidatePath('/accounting/budgets')
  return { success: true, branchId: activeBranchResult.branchId }
}

export async function getBudgetVsActual(
  orgId: string,
  startDate: string,
  endDate: string,
  branchId?: string | null
) {
  const supabase = await createClient()
  const branchSelection = await resolveBudgetBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  // 1. Get ALL relevant accounts
  const { data: accounts } = await (supabase as any)
    .from('accounts')
    .select('id, code, name, type, normal_balance')
    .eq('org_id', orgId)
    .in('type', ['REVENUE', 'EXPENSE', 'COGS'])

  if (!accounts || accounts.length === 0) return []

  // 2. Get budgets
  let budgetsQuery = (supabase as any)
    .from('budgets')
    .select('*')
    .eq('org_id', orgId)
    .gte('period', startDate)
    .lte('period', endDate)

  if (branchSelection.branchId) {
    budgetsQuery = budgetsQuery.eq('branch_id', branchSelection.branchId)
  }

  const { data: budgets } = await budgetsQuery

  const budgetByAccount: Record<string, number> = {}
  for (const b of budgets || []) {
    budgetByAccount[b.account_id] = (budgetByAccount[b.account_id] || 0) + Number(b.budget_amount)
  }

  // 3. Get actuals
  let entriesQuery = (supabase as any)
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)

  if (branchSelection.branchId) {
    entriesQuery = entriesQuery.eq('branch_id', branchSelection.branchId)
  }

  const { data: entries } = await entriesQuery

  const entryIds = (entries || []).map((e: any) => e.id)
  const actualByAccount: Record<string, number> = {}
  
  if (entryIds.length > 0) {
    const { data: lines } = await (supabase as any)
      .from('journal_lines')
      .select('account_id, debit, credit')
      .in('entry_id', entryIds)

    for (const l of lines || []) {
      actualByAccount[l.account_id] = (actualByAccount[l.account_id] || 0) + Number(l.debit) - Number(l.credit)
    }
  }

  // 4. Combine
  const result = []
  for (const acc of accounts) {
    const budgetAmount = budgetByAccount[acc.id] || 0
    const actualRaw = actualByAccount[acc.id] || 0
    
    // Adjust signs based on normal balance
    const actualAmount = acc.normal_balance === 'DEBIT' ? actualRaw : -actualRaw
    
    if (budgetAmount === 0 && actualAmount === 0) continue

    const variance = actualAmount - budgetAmount
    const variancePct = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0
    
    result.push({
      account_id: acc.id,
      account_code: acc.code,
      account_name: acc.name,
      account_type: acc.type,
      period: startDate,
      budget_amount: budgetAmount,
      actual_amount: actualAmount,
      variance,
      variance_pct: Math.round(variancePct * 10) / 10,
      status: Math.abs(variancePct) <= 5 ? 'ON_TRACK' : variance < 0 ? 'UNDER' : 'OVER'
    })
  }

  return result.sort((a: any, b: any) => a.account_code.localeCompare(b.account_code))
}

export async function getChartOfAccountsForBudget(orgId: string) {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('accounts')
    .select('id, code, name, type')
    .eq('org_id', orgId)
    .in('type', ['REVENUE', 'EXPENSE'])
    .order('code')
  return data || []
}
