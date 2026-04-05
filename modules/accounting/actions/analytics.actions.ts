import { format, subMonths, startOfMonth } from 'date-fns'
import { getAuthUser, getMembership } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'

function createEmptyAnalytics() {
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
  const user = await getAuthUser()
  if (!user) return createEmptyAnalytics()

  const membership = await getMembership(user.userId, orgId)
  if (!membership) return createEmptyAnalytics()

  const startDate = startOfMonth(subMonths(new Date(), 5))

  // 1. Financial Analytics (Journal Entries)
  const entries = await prisma.journal_entries.findMany({
    where: {
      org_id: orgId,
      status: 'POSTED',
      entry_date: {
        gte: startDate,
      },
      ...(branchId ? { branch_id: branchId } : {}),
    },
    select: {
      id: true,
      entry_date: true,
    },
  })

  let chartData: any[] = []
  let topExpenses: any[] = []

  if (entries.length > 0) {
    const entryIds = entries.map((entry) => entry.id)
    const entryDateMap = new Map(entries.map((entry) => [entry.id, entry.entry_date]))

    const lines = await prisma.journal_lines.findMany({
      where: {
        entry_id: {
          in: entryIds,
        },
      },
      select: {
        debit: true,
        credit: true,
        entry_id: true,
        accounts: {
          select: {
            code: true,
            name: true,
            type: true,
          },
        },
      },
    })

    if (lines.length > 0) {
      const monthlyData: Record<string, { revenue: number; expense: number; sortKey: number }> = {}
      const expenseBreakdown: Record<string, number> = {}

      lines.forEach((line) => {
        const entryDate = entryDateMap.get(line.entry_id)
        if (!entryDate) return

        const month = format(entryDate, 'MMM yyyy')
        if (!monthlyData[month]) {
          monthlyData[month] = {
            revenue: 0,
            expense: 0,
            sortKey: startOfMonth(entryDate).getTime(),
          }
        }

        if (line.accounts?.type === 'REVENUE') {
          monthlyData[month].revenue += Number(line.credit || 0) - Number(line.debit || 0)
        }
        if (line.accounts?.type === 'EXPENSE') {
          const val = Number(line.debit || 0) - Number(line.credit || 0)
          monthlyData[month].expense += val
          const name = line.accounts.name || line.accounts.code
          expenseBreakdown[name] = (expenseBreakdown[name] || 0) + val
        }
      })

      chartData = Object.entries(monthlyData)
        .map(([name, vals]) => ({
          name,
          revenue: vals.revenue,
          expense: vals.expense,
          profit: vals.revenue - vals.expense,
          sortKey: vals.sortKey,
        }))
        .sort((a: any, b: any) => a.sortKey - b.sortKey)
        .map(({ sortKey, ...item }) => item)

      topExpenses = Object.entries(expenseBreakdown)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 5)
    }
  }

  // 2. Product Pareto Analytics (Top 10 & 20/80 Analysis)
  // Get sales in last 3 months for better Pareto sample
  const paretoStartDate = startOfMonth(subMonths(new Date(), 3))

  const saleItems = await prisma.sales_items.findMany({
    where: {
      org_id: orgId,
      created_at: {
        gte: paretoStartDate,
      },
      ...(branchId ? { branch_id: branchId } : {}),
    },
    select: {
      quantity: true,
      total_amount: true,
      products: {
        select: {
          id: true,
          name: true,
          average_cost: true,
        },
      },
    },
  })

  const productStats: Record<string, { name: string; revenue: number; profit: number; qty: number }> = {}
  let totalRevenue = 0
  let totalProfit = 0

  saleItems.forEach((item) => {
    const product = item.products
    if (!product) return
    if (!productStats[product.id]) {
      productStats[product.id] = { name: product.name, revenue: 0, profit: 0, qty: 0 }
    }

    const rev = Number(item.total_amount || 0)
    const quantity = Number(item.quantity || 0)
    const cost = Number(product.average_cost || 0) * quantity
    const prof = rev - cost

    productStats[product.id].revenue += rev
    productStats[product.id].profit += prof
    productStats[product.id].qty += quantity
    totalRevenue += rev
    totalProfit += prof
  })

  const sortedProducts = Object.values(productStats)
    .sort((a: any, b: any) => b.revenue - a.revenue)

  // Pareto Logic: Top 20% of products that generate 80% of revenue
  let runningRevenue = 0
  const paretoTop20 = sortedProducts.filter((p: any, idx: any) => {
    runningRevenue += p.revenue
    const isUnder80Percent = runningRevenue <= (totalRevenue * 0.8)
    const isInTop20PercentCount = (idx + 1) <= Math.ceil(sortedProducts.length * 0.2)
    return isUnder80Percent || isInTop20PercentCount
  })

  // 3. Customer Pareto Analytics (Pelanggan Penyumbang Untung Terbesar)
  const recentSales = await prisma.sales.findMany({
    where: {
      org_id: orgId,
      sale_date: {
        gte: paretoStartDate,
      },
      ...(branchId ? { branch_id: branchId } : {}),
    },
    select: {
      contacts: {
        select: {
          id: true,
          name: true,
        },
      },
      sales_items: {
        select: {
          total_amount: true,
          quantity: true,
          products: {
            select: {
              average_cost: true,
            },
          },
        },
      },
    },
  })

  const customerStats: Record<string, { id: string; name: string; revenue: number; profit: number }> = {}
  let totalCustomerRevenue = 0
  let totalCustomerProfit = 0

  recentSales.forEach((sale) => {
    const contact = sale.contacts
    if (!contact) return

    if (!customerStats[contact.id]) {
      customerStats[contact.id] = { id: contact.id, name: contact.name, revenue: 0, profit: 0 }
    }

    sale.sales_items.forEach((item) => {
      const revenue = Number(item.total_amount || 0)
      const cost = Number(item.products?.average_cost || 0) * Number(item.quantity || 0)
      const prof = revenue - cost

      customerStats[contact.id].revenue += revenue
      customerStats[contact.id].profit += prof
      totalCustomerRevenue += revenue
      totalCustomerProfit += prof
    })
  })

  const sortedCustomers = Object.values(customerStats)
    .sort((a: any, b: any) => b.revenue - a.revenue)

  let cRunningRevenue = 0
  const paretoTopCustomers = sortedCustomers.filter((c: any, idx: any) => {
    cRunningRevenue += c.revenue
    const isUnder80Percent = cRunningRevenue <= (totalCustomerRevenue * 0.8)
    const isInTop20PercentCount = (idx + 1) <= Math.ceil(sortedCustomers.length * 0.2)
    return isUnder80Percent || isInTop20PercentCount
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
      paretoProducts: paretoTop20
    },
    customerPareto: {
      totalCustomers: sortedCustomers.length,
      top20Count: paretoTopCustomers.length,
      top20Revenue: paretoTopCustomers.reduce((s: any, c: any) => s + c.revenue, 0),
      top20Profit: paretoTopCustomers.reduce((s: any, c: any) => s + c.profit, 0),
      totalRevenue: totalCustomerRevenue,
      totalProfit: totalCustomerProfit,
      paretoCustomers: paretoTopCustomers
    }
  }
}
