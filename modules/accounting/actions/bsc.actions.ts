'use server'

import { prisma } from '@/lib/prisma'
import { ensureAccountingAccess, getPostedEntryIds, parseDateOnly, resolveBranchFilter, toNumber } from '@/modules/accounting/lib/reporting.server'

export async function getBSCMetrics(orgId: string, branchId?: string | null) {
  const membership = await ensureAccountingAccess(orgId)
  if (!membership) {
    return {
      financial: { currentRevenue: 0, currentExpenses: 0, netProfit: 0, profitMargin: 0, revenueGrowth: 0, lastRevenue: 0 },
      customer: { mtdSales: 0, totalOrders: 0, uniqueCustomers: 0 },
      internal: { pendingPurchases: 0, pendingSales: 0, totalAssets: 0, overdueDepreciation: 0, processHealth: 100 },
      learning: { activeEmployees: 0, payrollRunsCompleted: 0, hrCompletionRate: 0 },
    }
  }

  const branchSelection = await resolveBranchFilter(orgId, branchId)
  if ('error' in branchSelection) {
    return {
      financial: { currentRevenue: 0, currentExpenses: 0, netProfit: 0, profitMargin: 0, revenueGrowth: 0, lastRevenue: 0 },
      customer: { mtdSales: 0, totalOrders: 0, uniqueCustomers: 0 },
      internal: { pendingPurchases: 0, pendingSales: 0, totalAssets: 0, overdueDepreciation: 0, processHealth: 100 },
      learning: { activeEmployees: 0, payrollRunsCompleted: 0, hrCompletionRate: 0 },
    }
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = now.toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const [thisIds, lastIds] = await Promise.all([
    getPostedEntryIds(orgId, { branchId: branchSelection.branchId, startDate: monthStart, endDate: monthEnd }),
    getPostedEntryIds(orgId, { branchId: branchSelection.branchId, startDate: lastMonthStart, endDate: lastMonthEnd }),
  ])

  let currentRevenue = 0
  let currentExpenses = 0
  if (thisIds.length > 0) {
    const lines = await prisma.journal_lines.findMany({
      where: { entry_id: { in: thisIds } },
      include: { accounts: { select: { type: true, code: true } } },
    })

    lines.forEach((line) => {
      const accountType = String(line.accounts.type)
      if (accountType === 'REVENUE' || line.accounts.code.startsWith('4')) {
        currentRevenue += toNumber(line.credit) - toNumber(line.debit)
      }
      if (accountType === 'EXPENSE' || line.accounts.code.startsWith('5') || line.accounts.code.startsWith('6')) {
        currentExpenses += toNumber(line.debit) - toNumber(line.credit)
      }
    })
  }

  let lastRevenue = 0
  if (lastIds.length > 0) {
    const lastLines = await prisma.journal_lines.findMany({
      where: { entry_id: { in: lastIds } },
      include: { accounts: { select: { type: true, code: true } } },
    })

    lastLines.forEach((line) => {
      const accountType = String(line.accounts.type)
      if (accountType === 'REVENUE' || line.accounts.code.startsWith('4')) {
        lastRevenue += toNumber(line.credit) - toNumber(line.debit)
      }
    })
  }

  const [salesData, pendingPurchases, pendingSales, totalAssets, overdueAssets, employees, payrollRuns] = await Promise.all([
    prisma.sales.findMany({
      where: {
        org_id: orgId,
        created_at: {
          gte: parseDateOnly(monthStart),
        },
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      select: {
        id: true,
        grand_total: true,
        customer_id: true,
      },
    }),
    prisma.purchases.count({
      where: {
        org_id: orgId,
        status: 'DRAFT',
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
    }),
    prisma.sales.count({
      where: {
        org_id: orgId,
        status: 'DRAFT',
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
    }),
    prisma.fixed_assets.count({
      where: {
        org_id: orgId,
        status: 'ACTIVE',
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
    }),
    prisma.fixed_assets.count({
      where: {
        org_id: orgId,
        status: 'ACTIVE',
        OR: [
          { last_depreciation_date: null },
          { last_depreciation_date: { lt: parseDateOnly(lastMonthEnd) } },
        ],
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
    }),
    prisma.employees.count({
      where: {
        org_id: orgId,
        employment_status: { not: 'TERMINATED' },
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
    }),
    prisma.payroll_runs.count({
      where: {
        org_id: orgId,
        status: 'PAID',
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
    }),
  ])

  const mtdSales = salesData.reduce((sum, sale) => sum + toNumber(sale.grand_total), 0)
  const totalOrders = salesData.length
  const uniqueCustomers = new Set(salesData.map((sale) => sale.customer_id).filter(Boolean)).size
  const netProfit = currentRevenue - currentExpenses
  const profitMargin = currentRevenue > 0 ? (netProfit / currentRevenue) * 100 : 0
  const revenueGrowth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0

  return {
    financial: {
      currentRevenue,
      currentExpenses,
      netProfit,
      profitMargin: Math.round(profitMargin * 10) / 10,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      lastRevenue,
    },
    customer: {
      mtdSales,
      totalOrders,
      uniqueCustomers,
    },
    internal: {
      pendingPurchases,
      pendingSales,
      totalAssets,
      overdueDepreciation: overdueAssets,
      processHealth: Math.max(0, 100 - (pendingPurchases + pendingSales) * 2),
    },
    learning: {
      activeEmployees: employees,
      payrollRunsCompleted: payrollRuns,
      hrCompletionRate: payrollRuns > 0 ? 100 : 0,
    },
  }
}
