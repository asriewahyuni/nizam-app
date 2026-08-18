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
       JOIN public.sales    s ON s.id = si.sale_id
       WHERE si.org_id = $1
         AND si.created_at >= $2
         AND s.status IS DISTINCT FROM 'VOIDED'
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
         AND s.status IS DISTINCT FROM 'VOIDED'
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

export type CogsRevenueTrendRow = {
  month_key: string
  month_label: string
  revenue: number
  cogs: number
  gross_profit: number
  gross_margin: number
}

export async function getCogsRevenueTrend(orgId: string, branchId?: string | null): Promise<CogsRevenueTrendRow[]> {
  // Revenue dan COGS dipisah agar grand_total tidak terhitung berkali-kali
  // saat satu sale memiliki banyak items (INNER JOIN menyebabkan double count).
  //
  // Modul operasional standalone (Klinik, Kojasmat, Workshop, PO Bus, dst)
  // tidak pernah menyentuh tabel `sales` — transaksinya langsung ke buku
  // besar (journal_entries) lewat bridge modul masing-masing. Tanpa baris
  // *_gl di bawah, chart ini selalu 0 untuk org yang murni pakai modul
  // semacam itu, padahal Laporan Keuangan (P&L/Neraca) sudah benar karena
  // itu baca langsung dari buku besar.
  //
  // Revenue digeneralisasi lewat TIPE akun (accounts.type = 'REVENUE'),
  // bukan whitelist reference_type per modul — supaya otomatis mencakup
  // modul apa pun yang posting ke akun Pendapatan tanpa perlu didaftar
  // manual di sini tiap ada modul baru. reference_type='SALE' di-exclude
  // supaya tidak dobel hitung dengan monthly_revenue_sales (sudah dihitung
  // dari sales.grand_total). Void/reversal (mis. KLINIK_VOID) otomatis
  // ikut ternetkan karena baris itu men-debit akun Pendapatan yang sama.
  //
  // COGS TIDAK bisa digeneralisasi dengan cara yang sama (accounts.type =
  // 'EXPENSE' juga mencakup gaji, sewa, pajak, dst — bukan cuma harga
  // pokok) — jadi sengaja whitelist eksplisit per reference_type yang
  // sudah diverifikasi representasikan HPP sungguhan. Baru KLINIK_DISPENSING
  // (+ pembalikannya KLINIK_VOID_HPP) yang terverifikasi saat ini; tambahkan
  // reference_type modul lain di sini kalau sudah dikonfirmasi jalur HPP-nya.
  const revBranch    = branchId ? 'AND s.branch_id = $2' : ''
  const cogsBranch   = branchId ? 'AND si.branch_id = $2' : ''
  const revBranchJe  = branchId ? 'AND je.branch_id = $2' : ''
  const cogsBranchJe = branchId ? 'AND je.branch_id = $2' : ''
  const params       = branchId ? [orgId, branchId] : [orgId]

  const result = await queryPostgres<{
    month_key:   string
    month_label: string
    revenue:     string
    cogs:        string
    gross_profit: string
  }>(
    `WITH months AS (
       SELECT generate_series(
         date_trunc('month', CURRENT_DATE - INTERVAL '11 months'),
         date_trunc('month', CURRENT_DATE),
         '1 month'::interval
       ) AS month
     ),
     monthly_revenue_sales AS (
       SELECT
         date_trunc('month', s.sale_date) AS month,
         SUM(s.grand_total)               AS revenue
       FROM public.sales s
       WHERE s.org_id = $1
         AND s.status IS DISTINCT FROM 'VOIDED'
         ${revBranch}
       GROUP BY 1
     ),
     monthly_revenue_gl AS (
       SELECT
         date_trunc('month', je.entry_date) AS month,
         SUM(jl.credit - jl.debit)          AS revenue
       FROM public.journal_lines jl
       JOIN public.journal_entries je ON je.id = jl.entry_id
       JOIN public.accounts       a  ON a.id  = jl.account_id
       WHERE je.org_id = $1
         AND je.status = 'POSTED'
         AND a.type = 'REVENUE'
         AND je.reference_type NOT IN ('SALE')
         ${revBranchJe}
       GROUP BY 1
     ),
     monthly_cogs_sales AS (
       SELECT
         date_trunc('month', s.sale_date)                       AS month,
         SUM(si.quantity * COALESCE(p.average_cost, 0))          AS cogs
       FROM public.sales_items si
       JOIN public.sales    s ON s.id = si.sale_id
       LEFT JOIN public.products p ON p.id = si.product_id
       WHERE si.org_id = $1
         AND s.status IS DISTINCT FROM 'VOIDED'
         ${cogsBranch}
       GROUP BY 1
     ),
     monthly_cogs_gl AS (
       SELECT
         date_trunc('month', je.entry_date) AS month,
         SUM(jl.debit - jl.credit)          AS cogs
       FROM public.journal_lines jl
       JOIN public.journal_entries je ON je.id = jl.entry_id
       JOIN public.accounts       a  ON a.id  = jl.account_id
       WHERE je.org_id = $1
         AND je.status = 'POSTED'
         AND a.type = 'EXPENSE'
         AND je.reference_type IN ('KLINIK_DISPENSING', 'KLINIK_VOID_HPP')
         ${cogsBranchJe}
       GROUP BY 1
     )
     SELECT
       TO_CHAR(m.month, 'YYYY-MM') AS month_key,
       TO_CHAR(m.month, 'Mon YY')  AS month_label,
       COALESCE(mrs.revenue, 0) + COALESCE(mrg.revenue, 0) AS revenue,
       COALESCE(mcs.cogs, 0)    + COALESCE(mcg.cogs, 0)    AS cogs,
       (COALESCE(mrs.revenue, 0) + COALESCE(mrg.revenue, 0))
         - (COALESCE(mcs.cogs, 0) + COALESCE(mcg.cogs, 0)) AS gross_profit
     FROM months m
     LEFT JOIN monthly_revenue_sales mrs ON mrs.month = m.month
     LEFT JOIN monthly_revenue_gl    mrg ON mrg.month = m.month
     LEFT JOIN monthly_cogs_sales    mcs ON mcs.month = m.month
     LEFT JOIN monthly_cogs_gl       mcg ON mcg.month = m.month
     ORDER BY m.month`,
    params
  ).catch(() => ({ rows: [] as any[] }))

  return result.rows.map(r => {
    const revenue = Number(r.revenue)
    const cogs    = Number(r.cogs)
    const gp      = Number(r.gross_profit)
    return {
      month_key:    r.month_key,
      month_label:  r.month_label,
      revenue,
      cogs,
      gross_profit: gp,
      gross_margin: revenue > 0 ? Math.round((gp / revenue) * 100) : 0,
    }
  })
}
