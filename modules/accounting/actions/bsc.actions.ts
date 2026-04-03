'use server'

import { createClient } from '@/lib/supabase/server'

export async function getBSCMetrics(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const db = supabase as any
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = now.toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  // ===== PERSPECTIVE 1: FINANCIAL =====
  // Anchor by org via journal_entries, then get P&L lines
  let thisMonthEntriesQuery = db
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', monthStart)
    .lte('entry_date', monthEnd)

  if (branchId) {
    thisMonthEntriesQuery = thisMonthEntriesQuery.eq('branch_id', branchId)
  }

  const { data: thisMonthEntries } = await thisMonthEntriesQuery

  const thisIds = (thisMonthEntries || []).map((e: any) => e.id)

  let currentRevenue = 0, currentExpenses = 0
  if (thisIds.length > 0) {
    const { data: lines } = await db
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
  let lastMonthEntriesQuery = db
    .from('journal_entries')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', lastMonthStart)
    .lte('entry_date', lastMonthEnd)

  if (branchId) {
    lastMonthEntriesQuery = lastMonthEntriesQuery.eq('branch_id', branchId)
  }

  const { data: lastMonthEntries } = await lastMonthEntriesQuery

  const lastIds = (lastMonthEntries || []).map((e: any) => e.id)
  let lastRevenue = 0
  if (lastIds.length > 0) {
    const { data: lastLines } = await db
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
  let salesQuery = db
    .from('sales')
    .select('id, grand_total, status, customer_id')
    .eq('org_id', orgId)
    .gte('created_at', monthStart)

  if (branchId) {
    salesQuery = salesQuery.eq('branch_id', branchId)
  }

  const { data: salesData } = await salesQuery

  const mtdSales = (salesData || []).reduce((s: any, x: any) => s + Number(x.grand_total), 0)
  const totalOrders = (salesData || []).length
  const uniqueCustomers = new Set((salesData || []).map((s: any) => s.customer_id)).size

  // ===== PERSPECTIVE 3: INTERNAL PROCESS (Operational efficiency) =====
  // Pending approvals / drafts (bottleneck indicator)
  let pendingPurchasesQuery = db
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')

  if (branchId) {
    pendingPurchasesQuery = pendingPurchasesQuery.eq('branch_id', branchId)
  }

  const { count: pendingPurchases } = await pendingPurchasesQuery

  let pendingSalesQuery = db
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')

  if (branchId) {
    pendingSalesQuery = pendingSalesQuery.eq('branch_id', branchId)
  }

  const { count: pendingSales } = await pendingSalesQuery

  let totalAssetsQuery = db
    .from('fixed_assets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')

  if (branchId) {
    totalAssetsQuery = totalAssetsQuery.eq('branch_id', branchId)
  }

  const { count: totalAssets } = await totalAssetsQuery

  let overdueAssetsQuery = db
    .from('fixed_assets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .or(`last_depreciation_date.is.null,last_depreciation_date.lt.${lastMonthEnd}`)

  if (branchId) {
    overdueAssetsQuery = overdueAssetsQuery.eq('branch_id', branchId)
  }

  const { count: overdueAssets } = await overdueAssetsQuery

  // ===== PERSPECTIVE 4: LEARNING & GROWTH =====
  let employeesQuery = db
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')

  if (branchId) {
    employeesQuery = employeesQuery.eq('branch_id', branchId)
  }

  const { count: employees } = await employeesQuery

  let payrollRunsQuery = db
    .from('payroll_runs')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'PAID')

  if (branchId) {
    payrollRunsQuery = payrollRunsQuery.eq('branch_id', branchId)
  }

  const { count: payrollRuns } = await payrollRunsQuery

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
