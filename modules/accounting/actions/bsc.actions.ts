'use server'

import { createClient } from '@/lib/supabase/server'

export async function getBSCMetrics(orgId: string) {
  const supabase = await createClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = now.toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  // ===== PERSPECTIVE 1: FINANCIAL =====
  // Anchor by org via journal_entries, then get P&L lines
  const { data: thisMonthEntries } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', monthStart)
    .lte('entry_date', monthEnd)

  const thisIds = (thisMonthEntries || []).map(e => e.id)

  let currentRevenue = 0, currentExpenses = 0
  if (thisIds.length > 0) {
    const { data: lines } = await supabase
      .from('journal_lines')
      .select('debit, credit, accounts!inner(type, code)')
      .in('entry_id', thisIds) as any

    for (const l of lines || []) {
      const acc = l.accounts
      if (acc.type === 'REVENUE' || acc.code?.startsWith('4')) currentRevenue += Number(l.credit) - Number(l.debit)
      if (acc.type === 'EXPENSE' || acc.code?.startsWith('5') || acc.code?.startsWith('6')) currentExpenses += Number(l.debit) - Number(l.credit)
    }
  }

  // Last month for comparison
  const { data: lastMonthEntries } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', lastMonthStart)
    .lte('entry_date', lastMonthEnd)

  const lastIds = (lastMonthEntries || []).map(e => e.id)
  let lastRevenue = 0
  if (lastIds.length > 0) {
    const { data: lastLines } = await supabase
      .from('journal_lines')
      .select('debit, credit, accounts!inner(type, code)')
      .in('entry_id', lastIds) as any

    for (const l of lastLines || []) {
      const acc = l.accounts
      if (acc.type === 'REVENUE' || acc.code?.startsWith('4')) lastRevenue += Number(l.credit) - Number(l.debit)
    }
  }

  const netProfit = currentRevenue - currentExpenses
  const profitMargin = currentRevenue > 0 ? (netProfit / currentRevenue) * 100 : 0
  const revenueGrowth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0

  // ===== PERSPECTIVE 2: CUSTOMER (Sales) =====
  const { data: salesData } = await supabase
    .from('sales')
    .select('id, grand_total, status, customer_id')
    .eq('org_id', orgId)
    .gte('created_at', monthStart)

  const mtdSales = (salesData || []).reduce((s, x) => s + Number(x.grand_total), 0)
  const totalOrders = (salesData || []).length
  const uniqueCustomers = new Set((salesData || []).map(s => s.customer_id)).size

  // ===== PERSPECTIVE 3: INTERNAL PROCESS (Operational efficiency) =====
  // Pending approvals / drafts (bottleneck indicator)
  const { count: pendingPurchases } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')

  const { count: pendingSales } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')

  const { count: totalAssets } = await supabase
    .from('fixed_assets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')

  const { count: overdueAssets } = await supabase
    .from('fixed_assets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .or(`last_depreciation_date.is.null,last_depreciation_date.lt.${lastMonthEnd}`)

  // ===== PERSPECTIVE 4: LEARNING & GROWTH =====
  const { count: employees } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')

  const { count: payrollRuns } = await supabase
    .from('payroll_runs')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'PAID')

  return {
    financial: {
      currentRevenue,
      currentExpenses,
      netProfit,
      profitMargin: Math.round(profitMargin * 10) / 10,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      lastRevenue
    },
    customer: {
      mtdSales,
      totalOrders,
      uniqueCustomers
    },
    internal: {
      pendingPurchases: pendingPurchases || 0,
      pendingSales: pendingSales || 0,
      totalAssets: totalAssets || 0,
      overdueDepreciation: overdueAssets || 0,
      processHealth: Math.max(0, 100 - ((pendingPurchases || 0) + (pendingSales || 0)) * 2)
    },
    learning: {
      activeEmployees: employees || 0,
      payrollRunsCompleted: payrollRuns || 0,
      hrCompletionRate: (payrollRuns || 0) > 0 ? 100 : 0
    }
  }
}
