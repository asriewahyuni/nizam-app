import { isInternalAuthProvider } from '@/lib/auth/provider'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { queryPostgres } from '@/lib/db/postgres'
import { format, subMonths } from 'date-fns'

function buildEmptyAnalytics() {
  return {
    chartData: [],
    topExpenses: [],
    topProducts: [],
    paretoAnalysis: {
      totalProducts: 0,
      top20Count: 0,
      top20Revenue: 0,
      top20Profit: 0,
      totalRevenue: 0,
      totalProfit: 0,
      paretoProducts: [],
    },
    customerPareto: {
      totalCustomers: 0,
      top20Count: 0,
      top20Revenue: 0,
      top20Profit: 0,
      totalRevenue: 0,
      totalProfit: 0,
      paretoCustomers: [],
    },
  }
}

export async function getDashboardAnalytics(orgId: string, branchId?: string) {
  const startDate = format(subMonths(new Date(), 5), 'yyyy-MM-01')
  const paretoStartDate = format(subMonths(new Date(), 3), 'yyyy-MM-01')

  // Jalankan 3 query berat secara paralel
  const [linesResult, productResult, customerResult] = await Promise.all([
    // ── 1. Journal lines untuk chart revenue/expense
    queryPostgres<{
      debit: string
      credit: string
      entry_date: string
      account_name: string
      account_code: string
      account_type: string
    }>(
      `SELECT
        jl.debit,
        jl.credit,
        je.entry_date,
        a.name  AS account_name,
        a.code  AS account_code,
        a.type  AS account_type
       FROM public.journal_lines jl
       JOIN public.journal_entries je ON je.id = jl.entry_id
       JOIN public.accounts        a  ON a.id  = jl.account_id
       WHERE je.org_id = $1
         AND je.status = 'POSTED'
         AND je.entry_date >= $2
         ${branchId ? 'AND je.branch_id = $3' : ''}`,
      branchId ? [orgId, startDate, branchId] : [orgId, startDate]
    ).catch(() => ({ rows: [] as any[] })),

    // ── 2. Product pareto
    queryPostgres<{
      product_id: string
      product_name: string
      average_cost: string
      total_amount: string
      quantity: string
    }>(
      `SELECT
         p.id   AS product_id,
         p.name AS product_name,
         p.average_cost,
         si.total_amount,
         si.quantity
       FROM public.sales_items si
       JOIN public.products p ON p.id = si.product_id
       WHERE si.org_id = $1
         AND si.created_at >= $2
         ${branchId ? 'AND si.branch_id = $3' : ''}`,
      branchId ? [orgId, paretoStartDate, branchId] : [orgId, paretoStartDate]
    ).catch(() => ({ rows: [] as any[] })),

    // ── 3. Customer pareto
    queryPostgres<{
      customer_id: string
      customer_name: string
      total_amount: string
      quantity: string
      average_cost: string
    }>(
      `SELECT
         s.customer_id,
         c.name  AS customer_name,
         si.total_amount,
         si.quantity,
         p.average_cost
       FROM public.sales_items si
       JOIN public.sales    s ON s.id = si.sale_id
       JOIN public.contacts c ON c.id = s.customer_id
       LEFT JOIN public.products p ON p.id = si.product_id
       WHERE si.org_id = $1
         AND s.sale_date >= $2
         ${branchId ? 'AND si.branch_id = $3' : ''}`,
      branchId ? [orgId, paretoStartDate, branchId] : [orgId, paretoStartDate]
    ).catch(() => ({ rows: [] as any[] })),
  ])

  // ── Process chart data ───────────────────────────────────────────────────
  let chartData: any[] = []
  let topExpenses: any[] = []

  const monthlyData: Record<string, { revenue: number; expense: number }> = {}
  const expenseBreakdown: Record<string, number> = {}

  for (const line of linesResult.rows) {
    const month = format(new Date(line.entry_date), 'MMM yyyy')
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, expense: 0 }

    if (line.account_type === 'REVENUE') {
      monthlyData[month].revenue += Number(line.credit) - Number(line.debit)
    }
    if (line.account_type === 'EXPENSE') {
      const val = Number(line.debit) - Number(line.credit)
      monthlyData[month].expense += val
      const label = line.account_name || line.account_code
      expenseBreakdown[label] = (expenseBreakdown[label] || 0) + val
    }
  }

  chartData = Object.entries(monthlyData)
    .map(([name, vals]) => ({ name, revenue: vals.revenue, expense: vals.expense, profit: vals.revenue - vals.expense }))
    .sort((a: any, b: any) => new Date(a.name).getTime() - new Date(b.name).getTime())

  topExpenses = Object.entries(expenseBreakdown)
    .map(([name, value]) => ({ name, value }))
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 5)

  // ── Process product pareto ───────────────────────────────────────────────
  let totalRevenue = 0
  let totalProfit = 0
  const productStats: Record<string, { name: string; revenue: number; profit: number; qty: number }> = {}

  for (const item of productResult.rows) {
    if (!productStats[item.product_id]) {
      productStats[item.product_id] = { name: item.product_name, revenue: 0, profit: 0, qty: 0 }
    }
    const rev = Number(item.total_amount || 0)
    const cost = Number(item.average_cost || 0) * Number(item.quantity || 0)
    productStats[item.product_id].revenue += rev
    productStats[item.product_id].profit += rev - cost
    productStats[item.product_id].qty += Number(item.quantity || 0)
    totalRevenue += rev
    totalProfit += rev - cost
  }

  const sortedProducts = Object.values(productStats).sort((a: any, b: any) => b.revenue - a.revenue)
  let runningRevenue = 0
  const paretoTop20 = sortedProducts.filter((p: any, idx: number) => {
    runningRevenue += p.revenue
    return runningRevenue <= totalRevenue * 0.8 || idx + 1 <= Math.ceil(sortedProducts.length * 0.2)
  })

  // ── Process customer pareto ──────────────────────────────────────────────
  let totalCustomerRevenue = 0
  let totalCustomerProfit = 0
  const customerStats: Record<string, { id: string; name: string; revenue: number; profit: number }> = {}

  for (const item of customerResult.rows) {
    if (!customerStats[item.customer_id]) {
      customerStats[item.customer_id] = { id: item.customer_id, name: item.customer_name, revenue: 0, profit: 0 }
    }
    const rev = Number(item.total_amount || 0)
    const cost = Number(item.average_cost || 0) * Number(item.quantity || 0)
    customerStats[item.customer_id].revenue += rev
    customerStats[item.customer_id].profit += rev - cost
    totalCustomerRevenue += rev
    totalCustomerProfit += rev - cost
  }

  const sortedCustomers = Object.values(customerStats).sort((a: any, b: any) => b.revenue - a.revenue)
  let cRunningRevenue = 0
  const paretoTopCustomers = sortedCustomers.filter((c: any, idx: number) => {
    cRunningRevenue += c.revenue
    return cRunningRevenue <= totalCustomerRevenue * 0.8 || idx + 1 <= Math.ceil(sortedCustomers.length * 0.2)
  })

  return {
    chartData,
    topExpenses,
    topProducts: sortedProducts.slice(0, 10),
    paretoAnalysis: {
      totalProducts: sortedProducts.length,
      top20Count: paretoTop20.length,
      top20Revenue: paretoTop20.reduce((s: any, p: any) => s + p.revenue, 0),
      top20Profit: paretoTop20.reduce((s: any, p: any) => s + p.profit, 0),
      totalRevenue,
      totalProfit,
      paretoProducts: paretoTop20,
    },
    customerPareto: {
      totalCustomers: sortedCustomers.length,
      top20Count: paretoTopCustomers.length,
      top20Revenue: paretoTopCustomers.reduce((s: any, c: any) => s + c.revenue, 0),
      top20Profit: paretoTopCustomers.reduce((s: any, c: any) => s + c.profit, 0),
      totalRevenue: totalCustomerRevenue,
      totalProfit: totalCustomerProfit,
      paretoCustomers: paretoTopCustomers,
    },
  }
}
