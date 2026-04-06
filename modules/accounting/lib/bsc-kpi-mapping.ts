export type BSCPerspective = 'FINANCIAL' | 'CUSTOMER' | 'INTERNAL_PROCESS' | 'LEARNING_GROWTH'

export type BSCOperationalMetrics = {
  financial: {
    currentRevenue: number
    currentExpenses: number
    netProfit: number
    profitMargin: number
    revenueGrowth: number
    lastRevenue: number
  }
  customer: {
    mtdSales: number
    totalOrders: number
    uniqueCustomers: number
  }
  internal: {
    pendingPurchases: number
    pendingSales: number
    totalAssets: number
    overdueDepreciation: number
    processHealth: number
  }
  learning: {
    activeEmployees: number
    payrollRunsCompleted: number
    hrCompletionRate: number
  }
}

export type BSCOperationalMetricKey =
  | 'financial.revenue_growth'
  | 'financial.net_profit_margin'
  | 'financial.operating_expense_ratio'
  | 'financial.net_profit'
  | 'financial.current_revenue'
  | 'financial.current_expenses'
  | 'customer.mtd_sales'
  | 'customer.total_orders'
  | 'customer.unique_customers'
  | 'internal.draft_document_backlog'
  | 'internal.pending_purchases'
  | 'internal.pending_sales'
  | 'internal.total_assets'
  | 'internal.overdue_depreciation'
  | 'internal.process_health'
  | 'learning.active_employees'
  | 'learning.payroll_runs_completed'
  | 'learning.hr_completion_rate'

export type BSCOperationalMetric = {
  key: BSCOperationalMetricKey
  perspective: BSCPerspective
  label: string
  unit: string
  value: number
  references: Array<{
    label: string
    path: string
  }>
}

export type BSCKpiMappingInput = {
  id: string
  perspective: BSCPerspective
  name: string
  formula_key?: string | null
}

export type BSCMappedKpiItem = {
  kpi_id: string
  perspective: BSCPerspective
  kpi_name: string
  formula_key: string | null
  matched_by: 'FORMULA_KEY' | 'NAME_ALIAS'
  metric: BSCOperationalMetric
}

export type BSCUnmappedKpiItem = {
  kpi_id: string
  perspective: BSCPerspective
  kpi_name: string
  formula_key: string | null
  suggestions: BSCOperationalMetric[]
}

export type BSCKpiCoverage = {
  measurable: BSCMappedKpiItem[]
  unmapped: BSCUnmappedKpiItem[]
}

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function buildMetric(
  key: BSCOperationalMetricKey,
  perspective: BSCPerspective,
  label: string,
  unit: string,
  value: number,
  references: Array<{ label: string; path: string }>
): BSCOperationalMetric {
  return { key, perspective, label, unit, value: Number.isFinite(value) ? value : 0, references }
}

export function buildOperationalMetricCatalog(metrics: BSCOperationalMetrics): Record<BSCOperationalMetricKey, BSCOperationalMetric> {
  const currentRevenue = Number(metrics.financial.currentRevenue || 0)
  const currentExpenses = Number(metrics.financial.currentExpenses || 0)
  const operatingExpenseRatio = currentRevenue > 0 ? (currentExpenses / currentRevenue) * 100 : 0
  const draftDocumentBacklog = Number(metrics.internal.pendingPurchases || 0) + Number(metrics.internal.pendingSales || 0)

  return {
    'financial.revenue_growth': buildMetric('financial.revenue_growth', 'FINANCIAL', 'Revenue Growth', '%', Number(metrics.financial.revenueGrowth || 0), [{ label: 'Jurnal Akuntansi', path: '/accounting/journal' }, { label: 'Laporan Keuangan', path: '/reports' }]),
    'financial.net_profit_margin': buildMetric('financial.net_profit_margin', 'FINANCIAL', 'Net Profit Margin', '%', Number(metrics.financial.profitMargin || 0), [{ label: 'Jurnal Akuntansi', path: '/accounting/journal' }, { label: 'Laporan Keuangan', path: '/reports' }]),
    'financial.operating_expense_ratio': buildMetric('financial.operating_expense_ratio', 'FINANCIAL', 'Operating Expense Ratio', '%', operatingExpenseRatio, [{ label: 'Jurnal Akuntansi', path: '/accounting/journal' }, { label: 'Laporan Keuangan', path: '/reports' }]),
    'financial.net_profit': buildMetric('financial.net_profit', 'FINANCIAL', 'Net Profit', 'IDR', Number(metrics.financial.netProfit || 0), [{ label: 'Jurnal Akuntansi', path: '/accounting/journal' }, { label: 'Laporan Keuangan', path: '/reports' }]),
    'financial.current_revenue': buildMetric('financial.current_revenue', 'FINANCIAL', 'Current Revenue (MTD)', 'IDR', currentRevenue, [{ label: 'Jurnal Akuntansi', path: '/accounting/journal' }, { label: 'Laporan Keuangan', path: '/reports' }]),
    'financial.current_expenses': buildMetric('financial.current_expenses', 'FINANCIAL', 'Current Expenses (MTD)', 'IDR', currentExpenses, [{ label: 'Jurnal Akuntansi', path: '/accounting/journal' }, { label: 'Laporan Keuangan', path: '/reports' }]),

    'customer.mtd_sales': buildMetric('customer.mtd_sales', 'CUSTOMER', 'MTD Sales', 'IDR', Number(metrics.customer.mtdSales || 0), [{ label: 'Modul Sales', path: '/sales' }]),
    'customer.total_orders': buildMetric('customer.total_orders', 'CUSTOMER', 'Total Orders', 'orders', Number(metrics.customer.totalOrders || 0), [{ label: 'Modul Sales', path: '/sales' }]),
    'customer.unique_customers': buildMetric('customer.unique_customers', 'CUSTOMER', 'Unique Customers', 'customers', Number(metrics.customer.uniqueCustomers || 0), [{ label: 'Modul Sales', path: '/sales' }, { label: 'Kontak Pelanggan', path: '/contacts' }]),

    'internal.draft_document_backlog': buildMetric('internal.draft_document_backlog', 'INTERNAL_PROCESS', 'Draft Document Backlog', 'docs', draftDocumentBacklog, [{ label: 'Modul Purchasing', path: '/purchasing' }, { label: 'Modul Sales', path: '/sales' }]),
    'internal.pending_purchases': buildMetric('internal.pending_purchases', 'INTERNAL_PROCESS', 'Pending Purchases', 'docs', Number(metrics.internal.pendingPurchases || 0), [{ label: 'Modul Purchasing', path: '/purchasing' }]),
    'internal.pending_sales': buildMetric('internal.pending_sales', 'INTERNAL_PROCESS', 'Pending Sales', 'docs', Number(metrics.internal.pendingSales || 0), [{ label: 'Modul Sales', path: '/sales' }]),
    'internal.total_assets': buildMetric('internal.total_assets', 'INTERNAL_PROCESS', 'Total Active Assets', 'assets', Number(metrics.internal.totalAssets || 0), [{ label: 'Modul Aset Tetap', path: '/accounting/assets' }]),
    'internal.overdue_depreciation': buildMetric('internal.overdue_depreciation', 'INTERNAL_PROCESS', 'Overdue Depreciation', 'assets', Number(metrics.internal.overdueDepreciation || 0), [{ label: 'Modul Aset Tetap', path: '/accounting/assets' }]),
    'internal.process_health': buildMetric('internal.process_health', 'INTERNAL_PROCESS', 'Process Health', '%', Number(metrics.internal.processHealth || 0), [{ label: 'Modul Purchasing', path: '/purchasing' }, { label: 'Modul Sales', path: '/sales' }]),

    'learning.active_employees': buildMetric('learning.active_employees', 'LEARNING_GROWTH', 'Active Employees', 'employees', Number(metrics.learning.activeEmployees || 0), [{ label: 'Modul HRIS', path: '/hris' }]),
    'learning.payroll_runs_completed': buildMetric('learning.payroll_runs_completed', 'LEARNING_GROWTH', 'Payroll Runs Completed', 'runs', Number(metrics.learning.payrollRunsCompleted || 0), [{ label: 'Modul HRIS', path: '/hris' }]),
    'learning.hr_completion_rate': buildMetric('learning.hr_completion_rate', 'LEARNING_GROWTH', 'HR Completion Rate', '%', Number(metrics.learning.hrCompletionRate || 0), [{ label: 'Modul HRIS', path: '/hris' }]),
  }
}

const FORMULA_KEY_ALIAS: Record<string, BSCOperationalMetricKey> = {
  revenue_growth: 'financial.revenue_growth',
  net_profit_margin: 'financial.net_profit_margin',
  operating_expense_ratio: 'financial.operating_expense_ratio',
  net_profit: 'financial.net_profit',
  current_revenue: 'financial.current_revenue',
  current_expenses: 'financial.current_expenses',
  mtd_sales: 'customer.mtd_sales',
  total_orders: 'customer.total_orders',
  unique_customers: 'customer.unique_customers',
  draft_document_backlog: 'internal.draft_document_backlog',
  pending_purchases: 'internal.pending_purchases',
  pending_sales: 'internal.pending_sales',
  total_assets: 'internal.total_assets',
  overdue_depreciation: 'internal.overdue_depreciation',
  process_health: 'internal.process_health',
  active_employees: 'learning.active_employees',
  payroll_runs_completed: 'learning.payroll_runs_completed',
  hr_completion_rate: 'learning.hr_completion_rate',
}

const NAME_ALIAS_RULES: Array<{ includes: string[]; key: BSCOperationalMetricKey }> = [
  { includes: ['revenue growth'], key: 'financial.revenue_growth' },
  { includes: ['pertumbuhan pendapatan'], key: 'financial.revenue_growth' },
  { includes: ['net profit margin'], key: 'financial.net_profit_margin' },
  { includes: ['margin laba bersih'], key: 'financial.net_profit_margin' },
  { includes: ['operating expense ratio'], key: 'financial.operating_expense_ratio' },
  { includes: ['rasio beban operasional'], key: 'financial.operating_expense_ratio' },
  { includes: ['net profit'], key: 'financial.net_profit' },
  { includes: ['laba bersih'], key: 'financial.net_profit' },
  { includes: ['pendapatan mtd'], key: 'financial.current_revenue' },
  { includes: ['current revenue'], key: 'financial.current_revenue' },
  { includes: ['beban mtd'], key: 'financial.current_expenses' },
  { includes: ['current expenses'], key: 'financial.current_expenses' },

  { includes: ['mtd sales'], key: 'customer.mtd_sales' },
  { includes: ['total penjualan'], key: 'customer.mtd_sales' },
  { includes: ['total orders'], key: 'customer.total_orders' },
  { includes: ['jumlah order'], key: 'customer.total_orders' },
  { includes: ['new customer acquisition'], key: 'customer.unique_customers' },
  { includes: ['pelanggan aktif'], key: 'customer.unique_customers' },
  { includes: ['unique customers'], key: 'customer.unique_customers' },

  { includes: ['draft document backlog'], key: 'internal.draft_document_backlog' },
  { includes: ['backlog dokumen draft'], key: 'internal.draft_document_backlog' },
  { includes: ['pending purchases'], key: 'internal.pending_purchases' },
  { includes: ['draft po'], key: 'internal.pending_purchases' },
  { includes: ['pending sales'], key: 'internal.pending_sales' },
  { includes: ['draft so'], key: 'internal.pending_sales' },
  { includes: ['total active assets'], key: 'internal.total_assets' },
  { includes: ['total aset aktif'], key: 'internal.total_assets' },
  { includes: ['overdue depreciation'], key: 'internal.overdue_depreciation' },
  { includes: ['depresiasi tertunda'], key: 'internal.overdue_depreciation' },
  { includes: ['process health'], key: 'internal.process_health' },

  { includes: ['active employees'], key: 'learning.active_employees' },
  { includes: ['karyawan aktif'], key: 'learning.active_employees' },
  { includes: ['payroll runs'], key: 'learning.payroll_runs_completed' },
  { includes: ['payroll runs selesai'], key: 'learning.payroll_runs_completed' },
  { includes: ['hr completion rate'], key: 'learning.hr_completion_rate' },
  { includes: ['digital adoption rate'], key: 'learning.hr_completion_rate' },
]

const PERSPECTIVE_SUGGESTION_ORDER: Record<BSCPerspective, BSCOperationalMetricKey[]> = {
  FINANCIAL: [
    'financial.revenue_growth',
    'financial.net_profit_margin',
    'financial.operating_expense_ratio',
    'financial.net_profit',
    'financial.current_revenue',
    'financial.current_expenses',
  ],
  CUSTOMER: [
    'customer.mtd_sales',
    'customer.total_orders',
    'customer.unique_customers',
  ],
  INTERNAL_PROCESS: [
    'internal.draft_document_backlog',
    'internal.process_health',
    'internal.pending_purchases',
    'internal.pending_sales',
    'internal.total_assets',
    'internal.overdue_depreciation',
  ],
  LEARNING_GROWTH: [
    'learning.active_employees',
    'learning.payroll_runs_completed',
    'learning.hr_completion_rate',
  ],
}

export function getPerspectiveSuggestions(
  perspective: BSCPerspective,
  catalog: Record<BSCOperationalMetricKey, BSCOperationalMetric>,
  limit = 3
) {
  return PERSPECTIVE_SUGGESTION_ORDER[perspective]
    .map((key) => catalog[key])
    .filter(Boolean)
    .slice(0, limit)
}

export function resolveKpiMetric(
  kpi: BSCKpiMappingInput,
  catalog: Record<BSCOperationalMetricKey, BSCOperationalMetric>
): { metric: BSCOperationalMetric; matched_by: 'FORMULA_KEY' | 'NAME_ALIAS' } | null {
  const formulaKey = normalizeText(kpi.formula_key).replace(/\s+/g, '_')
  if (formulaKey && FORMULA_KEY_ALIAS[formulaKey]) {
    return {
      metric: catalog[FORMULA_KEY_ALIAS[formulaKey]],
      matched_by: 'FORMULA_KEY',
    }
  }

  const normalizedName = normalizeText(kpi.name)
  for (const rule of NAME_ALIAS_RULES) {
    for (const token of rule.includes) {
      if (normalizedName.includes(token)) {
        return {
          metric: catalog[rule.key],
          matched_by: 'NAME_ALIAS',
        }
      }
    }
  }

  return null
}

export function analyzeBscKpiCoverage(
  kpis: BSCKpiMappingInput[],
  catalog: Record<BSCOperationalMetricKey, BSCOperationalMetric>
): BSCKpiCoverage {
  const measurable: BSCMappedKpiItem[] = []
  const unmapped: BSCUnmappedKpiItem[] = []

  for (const kpi of kpis) {
    const resolved = resolveKpiMetric(kpi, catalog)
    if (resolved) {
      measurable.push({
        kpi_id: kpi.id,
        perspective: kpi.perspective,
        kpi_name: kpi.name,
        formula_key: kpi.formula_key || null,
        matched_by: resolved.matched_by,
        metric: resolved.metric,
      })
      continue
    }

    unmapped.push({
      kpi_id: kpi.id,
      perspective: kpi.perspective,
      kpi_name: kpi.name,
      formula_key: kpi.formula_key || null,
      suggestions: getPerspectiveSuggestions(kpi.perspective, catalog, 3),
    })
  }

  return { measurable, unmapped }
}
