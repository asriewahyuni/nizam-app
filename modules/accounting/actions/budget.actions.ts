'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getBudgets(orgId: string, period: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('budgets')
    .select('*, accounts(code, name, type)')
    .eq('org_id', orgId)
    .eq('period', period)
  if (error) return []
  return data
}

export async function saveBudget(orgId: string, accountId: string, period: string, amount: number) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('budgets')
    .upsert({
      org_id: orgId,
      account_id: accountId,
      period,
      budget_amount: amount,
      updated_at: new Date().toISOString()
    }, { onConflict: 'org_id, account_id, period' })
  if (error) throw error
  revalidatePath('/accounting/budgets')
  return { success: true }
}

export async function getBudgetVsActual(orgId: string, startDate: string, endDate: string) {
  const supabase = await createClient()

  // 1. Get ALL relevant accounts
  const { data: accounts } = await (supabase as any)
    .from('accounts')
    .select('id, code, name, type, normal_balance')
    .eq('org_id', orgId)
    .in('type', ['REVENUE', 'EXPENSE', 'COGS'])

  if (!accounts || accounts.length === 0) return []

  // 2. Get budgets
  const { data: budgets } = await (supabase as any)
    .from('budgets')
    .select('*')
    .eq('org_id', orgId)
    .gte('period', startDate)
    .lte('period', endDate)

  const budgetByAccount: Record<string, number> = {}
  for (const b of budgets || []) {
    budgetByAccount[b.account_id] = (budgetByAccount[b.account_id] || 0) + Number(b.budget_amount)
  }

  // 3. Get actuals
  const { data: entries } = await (supabase as any)
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)

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
