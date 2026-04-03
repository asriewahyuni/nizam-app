'use server'

import { createClient } from '@/lib/supabase/server'

type BranchFilter = string | null | undefined

async function getCashAccountCodes(db: any, orgId: string) {
  const { data: linkedAccounts } = await db
    .from('bank_accounts')
    .select('account_id, accounts(code)')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const codes = Array.from(
    new Set(
      (linkedAccounts || [])
        .map((account: any) => account.accounts?.code)
        .filter(Boolean)
    )
  )

  return codes.length > 0 ? codes : ['1101', '1102', '1103', '1104', '1105']
}

async function getPostedEntryIds(db: any, orgId: string, branchId?: BranchFilter) {
  let query = db
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data)) return []

  return data.map((entry: any) => entry.id)
}

async function getCurrentCashBalance(db: any, orgId: string, branchId?: BranchFilter) {
  const [cashAccountCodes, entryIds] = await Promise.all([
    getCashAccountCodes(db, orgId),
    getPostedEntryIds(db, orgId, branchId),
  ])

  if (entryIds.length === 0) return 0

  const { data: lines, error } = await db
    .from('journal_lines')
    .select('debit, credit, accounts!inner(code)')
    .in('entry_id', entryIds)
    .in('accounts.code', cashAccountCodes) as any

  if (error || !Array.isArray(lines)) return 0

  return lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0)
}

export async function getCashFlowForecast(orgId: string, days: number = 90, branchId?: BranchFilter) {
  const supabase = await createClient()
  const db = supabase as any

  // 1. Current Total Cash
  const currentCash = await getCurrentCashBalance(db, orgId, branchId)

  // 2. Projected Inflow (Sales)
  let salesQuery = db
    .from('sales')
    .select('grand_total, due_date, sale_number')
    .eq('org_id', orgId)
    .in('payment_status', ['UNPAID', 'PARTIAL'])
    .neq('status', 'VOIDED')

  if (branchId) {
    salesQuery = salesQuery.eq('branch_id', branchId)
  }

  const { data: sales } = await salesQuery

  // 3. Projected Outflow (Purchases)
  let purchasesQuery = db
    .from('purchases')
    .select('grand_total, due_date, purchase_number')
    .eq('org_id', orgId)
    .in('payment_status', ['UNPAID', 'PARTIAL'])
    .neq('status', 'VOIDED')

  if (branchId) {
    purchasesQuery = purchasesQuery.eq('branch_id', branchId)
  }

  const { data: purchases } = await purchasesQuery
    
  // 5. Generate Time Series
  const forecast = []
  let runningBalance = currentCash
  
  const todayDateStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]

  for (let i = 0; i < days; i++) {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + i)
    // Avoid UTC offset messing up local dates
    const dateStr = new Date(targetDate.getTime() - targetDate.getTimezoneOffset() * 60000).toISOString().split('T')[0]

    // Calculate delta for this day
    const dayInflow = (sales || [])
        .filter((s: any) => {
           // For Day 0, include ALL overdue (past dates) AND null due dates
           if (i === 0) return !s.due_date || s.due_date <= dateStr;
           return s.due_date === dateStr;
        })
        .reduce((sum: any, s: any) => sum + Number(s.grand_total), 0)
    
    const dayOutflow = (purchases || [])
        .filter((p: any) => {
           // For Day 0, include ALL overdue (past dates) AND null due dates
           if (i === 0) return !p.due_date || p.due_date <= dateStr;
           return p.due_date === dateStr;
        })
        .reduce((sum: any, p: any) => sum + Number(p.grand_total), 0)

    runningBalance += (dayInflow - dayOutflow)

    forecast.push({
      date: dateStr,
      inflow: dayInflow,
      outflow: dayOutflow,
      balance: runningBalance,
      isNegative: runningBalance < 0
    })
  }

  return {
    currentCash,
    forecast,
    totalProjectedInflow: (sales || []).reduce((s: any, x: any) => s + Number(x.grand_total), 0),
    totalProjectedOutflow: (purchases || []).reduce((s: any, x: any) => s + Number(x.grand_total), 0),
    lowestPoint: Math.min(...forecast.map((f: any) => f.balance)),
    days
  }
}
