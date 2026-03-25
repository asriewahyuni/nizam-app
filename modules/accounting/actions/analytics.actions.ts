import { createClient } from '@/lib/supabase/server'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function getDashboardAnalytics(orgId: string, branchId?: string) {
  const supabase = await createClient()

  const startDate = format(subMonths(new Date(), 5), 'yyyy-MM-01')

  // 1. Financial Analytics (Journal Entries)
  let entriesQuery = supabase
    .from('journal_entries')
    .select('id, entry_date')
    .eq('org_id', orgId)
    .eq('status', 'POSTED')
    .gte('entry_date', startDate)

  if (branchId) {
    entriesQuery = entriesQuery.eq('branch_id', branchId)
  }

  const { data: entries } = await entriesQuery

  let chartData: any[] = []
  let topExpenses: any[] = []

  if (entries && entries.length > 0) {
    const entryIds = entries.map(e => e.id)
    const entryDateMap: Record<string, string> = {}
    entries.forEach(e => { entryDateMap[e.id] = e.entry_date })

    const { data: lines } = await supabase
      .from('journal_lines')
      .select('debit, credit, entry_id, accounts!inner(code, name, type)')
      .in('entry_id', entryIds) as any

    if (lines) {
      const monthlyData: Record<string, { revenue: number; expense: number }> = {}
      const expenseBreakdown: Record<string, number> = {}

      lines.forEach((line: any) => {
        const entryDate = entryDateMap[line.entry_id]
        if (!entryDate) return

        const month = format(new Date(entryDate), 'MMM yyyy')
        if (!monthlyData[month]) monthlyData[month] = { revenue: 0, expense: 0 }

        if (line.accounts.type === 'REVENUE') {
          monthlyData[month].revenue += (Number(line.credit) - Number(line.debit))
        }
        if (line.accounts.type === 'EXPENSE') {
          const val = (Number(line.debit) - Number(line.credit))
          monthlyData[month].expense += val
          const name = line.accounts.name || line.accounts.code
          expenseBreakdown[name] = (expenseBreakdown[name] || 0) + val
        }
      })

      chartData = Object.entries(monthlyData)
        .map(([name, vals]) => ({ name, revenue: vals.revenue, expense: vals.expense, profit: vals.revenue - vals.expense }))
        .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime())

      topExpenses = Object.entries(expenseBreakdown)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    }
  }

  // 2. Product Pareto Analytics (Top 10 & 20/80 Analysis)
  // Get sales in last 3 months for better Pareto sample
  const paretoStartDate = format(subMonths(new Date(), 3), 'yyyy-MM-01')
  
  let salesQuery = supabase
    .from('sales_items')
    .select(`
      quantity,
      total_amount,
      product:products(id, name, average_cost)
    `)
    .eq('org_id', orgId)
    .gte('created_at', paretoStartDate)

  if (branchId) {
    salesQuery = salesQuery.eq('branch_id', branchId)
  }

  const { data: saleItems } = await salesQuery as any

  const productStats: Record<string, { name: string; revenue: number; profit: number; qty: number }> = {}
  let totalRevenue = 0
  let totalProfit = 0

  if (saleItems) {
    saleItems.forEach((item: any) => {
      const p = item.product
      if (!p) return
      if (!productStats[p.id]) productStats[p.id] = { name: p.name, revenue: 0, profit: 0, qty: 0 }
      
      const rev = Number(item.total_amount || 0)
      const cost = Number(p.average_cost || 0) * Number(item.quantity || 0)
      const prof = rev - cost
      
      productStats[p.id].revenue += rev
      productStats[p.id].profit += prof
      productStats[p.id].qty += Number(item.quantity || 0)
      totalRevenue += rev
      totalProfit += prof
    })
  }

  const sortedProducts = Object.values(productStats)
    .sort((a, b) => b.revenue - a.revenue)

  // Top 10 Products
  const topProducts = sortedProducts.slice(0, 10)

  // Pareto Logic: Top 20% of products that generate 80% of revenue
  let runningRevenue = 0
  const paretoTop20 = sortedProducts.filter((p, idx) => {
    runningRevenue += p.revenue
    const isUnder80Percent = runningRevenue <= (totalRevenue * 0.8)
    const isInTop20PercentCount = (idx + 1) <= Math.ceil(sortedProducts.length * 0.2)
    return isUnder80Percent || isInTop20PercentCount
  })

  // 3. Customer Pareto Analytics (Pelanggan Penyumbang Untung Terbesar)
  // Join sales items to get profit per customer
  let customerSalesQuery = supabase
    .from('sales_items')
    .select(`
      total_amount,
      quantity,
      sales!inner(customer_id, sale_date, contacts(id, name)),
      product:products(average_cost)
    `)
    .eq('org_id', orgId)
    .gte('sales.sale_date', paretoStartDate)

  if (branchId) {
    customerSalesQuery = customerSalesQuery.eq('branch_id', branchId)
  }

  const { data: customerData } = await customerSalesQuery as any

  const customerStats: Record<string, { id: string; name: string; revenue: number; profit: number }> = {}
  let totalCustomerRevenue = 0
  let totalCustomerProfit = 0

  if (customerData) {
    customerData.forEach((item: any) => {
      const sale = item.sales
      const contact = sale?.contacts
      if (!contact) return
      
      if (!customerStats[contact.id]) {
        customerStats[contact.id] = { id: contact.id, name: contact.name, revenue: 0, profit: 0 }
      }
      
      const rev = Number(item.total_amount || 0)
      const cost = Number(item.product?.average_cost || 0) * Number(item.quantity || 0)
      const prof = rev - cost
      
      customerStats[contact.id].revenue += rev
      customerStats[contact.id].profit += prof
      totalCustomerRevenue += rev
      totalCustomerProfit += prof
    })
  }

  const sortedCustomers = Object.values(customerStats)
    .sort((a, b) => b.revenue - a.revenue)

  let cRunningRevenue = 0
  const paretoTopCustomers = sortedCustomers.filter((c, idx) => {
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
      top20Revenue: paretoTop20.reduce((s, p) => s + p.revenue, 0),
      top20Profit: paretoTop20.reduce((s, p) => s + p.profit, 0),
      totalRevenue,
      totalProfit,
      paretoProducts: paretoTop20
    },
    customerPareto: {
      totalCustomers: sortedCustomers.length,
      top20Count: paretoTopCustomers.length,
      top20Revenue: paretoTopCustomers.reduce((s, c) => s + c.revenue, 0),
      top20Profit: paretoTopCustomers.reduce((s, c) => s + c.profit, 0),
      totalRevenue: totalCustomerRevenue,
      totalProfit: totalCustomerProfit,
      paretoCustomers: paretoTopCustomers
    }
  }
}
