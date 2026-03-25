'use server'

import { createClient } from '@/lib/supabase/server'
import { getAccountBalances } from './coa.actions'

export async function getCashFlowForecast(orgId: string, days: number = 90) {
  const supabase = await createClient()

  // 1. Current Total Cash (Balances for 1101-1105)
  const balances = await getAccountBalances(orgId)
  const currentCash = balances
    .filter(b => b.code >= '1101' && b.code <= '1105')
    .reduce((sum, b) => sum + (b.balance || 0), 0)

  // 2. Projected Inflow (Sales)
  const { data: sales, error: sErr } = await supabase
    .from('sales')
    .select('grand_total, due_date, sale_number')
    .eq('org_id', orgId)
    .in('payment_status', ['UNPAID', 'PARTIAL'])
    .neq('status', 'VOIDED')

  // 3. Projected Outflow (Purchases)
  const { data: purchases, error: pErr } = await supabase
    .from('purchases')
    .select('grand_total, due_date, purchase_number')
    .eq('org_id', orgId)
    .in('payment_status', ['UNPAID', 'PARTIAL'])
    .neq('status', 'VOIDED')
    
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
        .filter(s => {
           // For Day 0, include ALL overdue (past dates) AND null due dates
           if (i === 0) return !s.due_date || s.due_date <= dateStr;
           return s.due_date === dateStr;
        })
        .reduce((sum, s) => sum + Number(s.grand_total), 0)
    
    const dayOutflow = (purchases || [])
        .filter(p => {
           // For Day 0, include ALL overdue (past dates) AND null due dates
           if (i === 0) return !p.due_date || p.due_date <= dateStr;
           return p.due_date === dateStr;
        })
        .reduce((sum, p) => sum + Number(p.grand_total), 0)

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
    totalProjectedInflow: (sales || []).reduce((s, x) => s + Number(x.grand_total), 0),
    totalProjectedOutflow: (purchases || []).reduce((s, x) => s + Number(x.grand_total), 0),
    lowestPoint: Math.min(...forecast.map(f => f.balance)),
    days
  }
}
