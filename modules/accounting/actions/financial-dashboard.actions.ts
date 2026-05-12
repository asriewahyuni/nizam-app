'use server'

import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { getProfitLoss, getCashFlow, getCashBalanceSnapshot } from './reports.actions'
import type { BranchFilter } from './reports.actions'

export type MonthlySnapshot = {
  month: string
  revenue: number
  expenses: number
  profit: number
}

export type ExpenseCategory = {
  name: string
  amount: number
  percentage: number
}

export type DashboardFinancialData = {
  currentMonth: {
    revenue: number
    expenses: number
    netProfit: number
    cashBalance: number
  }
  monthlyTrend: MonthlySnapshot[]
  expenseBreakdown: ExpenseCategory[]
  cashFlow: {
    operating: number
    investing: number
    financing: number
    netCashFlow: number
  }
}

export async function getFinancialDashboardData(
  orgId: string,
  branchId?: BranchFilter
): Promise<DashboardFinancialData> {
  const today = new Date()
  const currentMonthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const currentMonthEnd = format(endOfMonth(today), 'yyyy-MM-dd')

  // Current month P&L
  const currentPL = await getProfitLoss(orgId, currentMonthStart, currentMonthEnd, branchId)

  // Cash balance
  const cashBalance = await getCashBalanceSnapshot(orgId, branchId)

  // Monthly trend (last 6 months)
  const monthlyTrend: MonthlySnapshot[] = []
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(today, i)
    const start = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(monthDate), 'yyyy-MM-dd')
    const pl = await getProfitLoss(orgId, start, end, branchId)
    monthlyTrend.push({
      month: format(monthDate, 'MMM'),
      revenue: pl.totalRevenue,
      expenses: pl.totalExpenses,
      profit: pl.netProfit,
    })
  }

  // Expense breakdown (from current month P&L)
  const expenseBreakdown: ExpenseCategory[] = currentPL.expenses
    .filter((e: any) => e.balance && e.balance > 0)
    .map((e: any) => ({
      name: e.name || e.code,
      amount: e.balance,
      percentage: currentPL.totalExpenses > 0 ? Math.round((e.balance / currentPL.totalExpenses) * 100) : 0,
    }))
    .sort((a: any, b: any) => b.amount - a.amount)

  // Cash flow
  const cf = await getCashFlow(orgId, branchId, false, {
    startDate: currentMonthStart,
    endDate: currentMonthEnd,
  })

  return {
    currentMonth: {
      revenue: currentPL.totalRevenue,
      expenses: currentPL.totalExpenses,
      netProfit: currentPL.netProfit,
      cashBalance: typeof cashBalance === 'number' ? cashBalance : 0,
    },
    monthlyTrend,
    expenseBreakdown,
    cashFlow: {
      operating: cf?.ocf ?? 0,
      investing: cf?.icf ?? 0,
      financing: cf?.fcf ?? 0,
      netCashFlow: (cf?.ocf ?? 0) + (cf?.icf ?? 0) + (cf?.fcf ?? 0),
    },
  }
}
