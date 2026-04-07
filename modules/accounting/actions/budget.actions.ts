'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import type { Account, JournalEntry, JournalLine } from '@/types/database.types'

type BranchFilterResult =
  | { branchId: string | null }
  | { error: string }

type BudgetRow = {
  id: string
  org_id: string
  branch_id: string | null
  account_id: string
  period: string
  budget_amount: number | string
  updated_at: string
  accounts?: {
    code: string
    name: string
    type: string
  } | null
  branch?: {
    id: string
    name: string
    code: string
  } | null
}

type BudgetVsActualRow = {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  period: string
  budget_amount: number
  actual_amount: number
  variance: number
  variance_pct: number
  status: 'ON_TRACK' | 'UNDER' | 'OVER'
}

type BudgetSaveResult =
  | { success: true; branchId: string }
  | { error: string }

export type BudgetPeriodStatus = {
  periodDate: string
  fiscalPeriodId: string | null
  fiscalPeriodName: string | null
  isClosed: boolean
}

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

export async function getBudgetPeriodStatus(orgId: string, period: string): Promise<BudgetPeriodStatus> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('fiscal_periods')
    .select('id, name, is_closed')
    .eq('org_id', orgId)
    .lte('start_date', period)
    .gte('end_date', period)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return {
      periodDate: period,
      fiscalPeriodId: null,
      fiscalPeriodName: null,
      isClosed: false,
    }
  }

  return {
    periodDate: period,
    fiscalPeriodId: String(data.id),
    fiscalPeriodName: String(data.name || ''),
    isClosed: Boolean(data.is_closed),
  }
}

export async function getBudgets(orgId: string, period: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveBudgetBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = supabase
    .from('budgets')
    .select('*, accounts(code, name, type), branch:branches(id, name, code)')
    .eq('org_id', orgId)
    .eq('period', period)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query

  if (error) return []
  return (data ?? []) as BudgetRow[]
}

export async function saveBudget(
  orgId: string,
  accountId: string,
  period: string,
  amount: number
): Promise<BudgetSaveResult> {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih satu unit aktif terlebih dahulu untuk menyimpan budget.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  if (!Number.isFinite(amount)) {
    return { error: 'Nilai budget tidak valid.' }
  }

  const periodStatus = await getBudgetPeriodStatus(orgId, period)
  if (periodStatus.isClosed) {
    return {
      error: periodStatus.fiscalPeriodName
        ? `Periode fiskal "${periodStatus.fiscalPeriodName}" sudah ditutup. Budget tidak dapat diubah.`
        : 'Periode fiskal ini sudah ditutup. Budget tidak dapat diubah.',
    }
  }

  const branchId = activeBranchResult.branchId
  const payload = {
    org_id: orgId,
    branch_id: branchId,
    account_id: accountId,
    period,
    budget_amount: amount,
    updated_at: new Date().toISOString(),
  }

  // budgets now use partial unique indexes for branch-aware rows, so a plain
  // PostgREST upsert can no longer infer the ON CONFLICT target reliably.
  const { data: existingRows, error: existingBudgetError } = await supabase
    .from('budgets')
    .select('id')
    .eq('org_id', orgId)
    .eq('branch_id', branchId)
    .eq('account_id', accountId)
    .eq('period', period)
    .limit(1)

  if (existingBudgetError) {
    return { error: existingBudgetError.message || 'Gagal memeriksa budget yang sudah ada.' }
  }

  const existingBudgetId = existingRows?.[0]?.id ? String(existingRows[0].id) : null

  if (existingBudgetId) {
    const { error: updateError } = await supabase
      .from('budgets')
      .update({
        budget_amount: amount,
        updated_at: payload.updated_at,
      })
      .eq('id', existingBudgetId)

    if (updateError) {
      return { error: updateError.message || 'Gagal memperbarui budget.' }
    }
  } else {
    const { error: insertError } = await supabase
      .from('budgets')
      .insert(payload)

    if (insertError) {
      const insertErrorMessage = String(insertError.message || '').toLowerCase()
      const isDuplicateInsert =
        insertError.code === '23505' || insertErrorMessage.includes('duplicate key')

      if (!isDuplicateInsert) {
        return { error: insertError.message || 'Gagal menyimpan budget.' }
      }

      const { error: retryUpdateError } = await supabase
        .from('budgets')
        .update({
          budget_amount: amount,
          updated_at: payload.updated_at,
        })
        .eq('org_id', orgId)
        .eq('branch_id', branchId)
        .eq('account_id', accountId)
        .eq('period', period)

      if (retryUpdateError) {
        return { error: retryUpdateError.message || 'Gagal menyimpan budget.' }
      }
    }
  }

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
  const { data: rawAccounts } = await supabase
    .from('accounts')
    .select('id, code, name, type, normal_balance')
    .eq('org_id', orgId)
    .in('type', ['REVENUE', 'EXPENSE', 'COGS'])

  const accounts = (rawAccounts ?? []) as Pick<Account, 'id' | 'code' | 'name' | 'type' | 'normal_balance'>[]
  if (!accounts || accounts.length === 0) return []

  // 2. Get budgets
  let budgetsQuery = supabase
    .from('budgets')
    .select('*')
    .eq('org_id', orgId)
    .gte('period', startDate)
    .lte('period', endDate)

  if (branchSelection.branchId) {
    budgetsQuery = budgetsQuery.eq('branch_id', branchSelection.branchId)
  }

  const { data: rawBudgets } = await budgetsQuery
  const budgets = (rawBudgets ?? []) as BudgetRow[]

  const budgetByAccount: Record<string, number> = {}
  for (const b of budgets) {
    budgetByAccount[b.account_id] = (budgetByAccount[b.account_id] || 0) + Number(b.budget_amount)
  }

  // 3. Get actuals
  let entriesQuery = supabase
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)

  if (branchSelection.branchId) {
    entriesQuery = entriesQuery.eq('branch_id', branchSelection.branchId)
  }

  const { data: rawEntries } = await entriesQuery
  const entries = (rawEntries ?? []) as Pick<JournalEntry, 'id'>[]

  const entryIds = entries.map((entry) => entry.id)
  const actualByAccount: Record<string, number> = {}
  
  if (entryIds.length > 0) {
    const { data: rawLines } = await supabase
      .from('journal_lines')
      .select('account_id, debit, credit')
      .in('entry_id', entryIds)

    const lines = (rawLines ?? []) as Pick<JournalLine, 'account_id' | 'debit' | 'credit'>[]

    for (const line of lines) {
      actualByAccount[line.account_id] =
        (actualByAccount[line.account_id] || 0) + Number(line.debit) - Number(line.credit)
    }
  }

  // 4. Combine
  const result: BudgetVsActualRow[] = []
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

  return result.sort((a, b) => a.account_code.localeCompare(b.account_code))
}

export async function getChartOfAccountsForBudget(orgId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('accounts')
    .select('id, code, name, type')
    .eq('org_id', orgId)
    .in('type', ['REVENUE', 'EXPENSE'])
    .order('code')
  return data || []
}
