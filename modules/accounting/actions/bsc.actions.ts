'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * bsc.actions.ts
 * ------------------------------------------------------------------
 * Nizametrics actions:
 * - Real-time operational snapshot (existing dashboard block)
 * - Configurable KPI setup per cycle (monthly scope)
 * - Hybrid score model: internal 0..100 and display 0..4
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDateInTimeZone, generateSlug } from '@/lib/utils'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import {
  analyzeBscKpiCoverage,
  buildOperationalMetricCatalog,
  getPerspectiveSuggestions,
  type BSCOperationalMetric,
  type BSCOperationalMetricKey,
} from '@/modules/accounting/lib/bsc-kpi-mapping'

export type BSCPerspective = 'FINANCIAL' | 'CUSTOMER' | 'INTERNAL_PROCESS' | 'LEARNING_GROWTH'
export type BSCDirection = 'HIGHER_BETTER' | 'LOWER_BETTER'
export type BSCKPISourceType = 'AUTO' | 'MANUAL'

export type BSCWeightMap = Record<BSCPerspective, number>

export type BSCCycle = {
  id: string
  org_id: string
  branch_id: string | null
  cycle_key: string
  cycle_name: string
  period_type: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM'
  start_date: string
  end_date: string
  status: 'ACTIVE' | 'LOCKED' | 'CLOSED'
}

export type BSCLatestMeasurement = {
  id: string
  measurement_date: string
  actual_value: number
  achievement_percent: number
  score_100: number
  score_4: number
  note: string | null
}

export type BSCKPIItem = {
  id: string
  cycle_id: string
  perspective: BSCPerspective
  code: string
  name: string
  description: string | null
  unit: string | null
  direction: BSCDirection
  weight_percent: number
  target_value: number
  baseline_value: number | null
  source_type: BSCKPISourceType
  formula_key: string | null
  is_active: boolean
  latest_measurement: BSCLatestMeasurement | null
}

export type BSCSetupSummary = {
  overall_score_100: number
  overall_score_4: number
  completion_percent: number
  perspective_scores: Record<BSCPerspective, { weight_percent: number; score_100: number; score_4: number; kpi_count: number }>
}

export type BSCSetupPayload = {
  cycle: BSCCycle | null
  perspectiveWeights: BSCWeightMap
  kpis: BSCKPIItem[]
  summary: BSCSetupSummary
  scope: {
    branch_id: string | null
    cycle_key: string
    start_date: string
    end_date: string
  }
  error?: string
}

export type BSCDeckSummary = {
  overall_score_100: number | null
  overall_score_4: number | null
  completion_percent: number | null
  cycle_name: string | null
  perspective_scores: Record<BSCPerspective, { score_100: number; score_4: number; kpi_count: number }>
  status: 'ready' | 'empty' | 'error'
  error?: string
}

type UpsertBSCKPIInput = {
  id?: string
  perspective: BSCPerspective
  name: string
  description?: string | null
  unit?: string | null
  direction: BSCDirection
  weightPercent: number
  targetValue: number
  baselineValue?: number | null
  sourceType?: BSCKPISourceType
  formulaKey?: string | null
}

type RecordMeasurementInput = {
  kpiId: string
  actualValue: number
  measurementDate?: string
  note?: string | null
}

type EnsureActiveCycleSuccess = {
  cycle: BSCCycle
  branchId: string | null
  cycleKey: string
  startDate: string
  endDate: string
}

type EnsureActiveCycleResult =
  | EnsureActiveCycleSuccess
  | { error: string }

const PERSPECTIVES: BSCPerspective[] = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH']

const DEFAULT_PERSPECTIVE_WEIGHTS: BSCWeightMap = {
  FINANCIAL: 25,
  CUSTOMER: 25,
  INTERNAL_PROCESS: 25,
  LEARNING_GROWTH: 25,
}

const PERSPECTIVE_CODE_MAP: Record<BSCPerspective, string> = {
  FINANCIAL: 'FIN',
  CUSTOMER: 'CUS',
  INTERNAL_PROCESS: 'INT',
  LEARNING_GROWTH: 'LRN',
}

const LOWER_IS_BETTER_METRIC_KEYS = new Set<BSCOperationalMetricKey>([
  'financial.operating_expense_ratio',
  'financial.current_expenses',
  'internal.draft_document_backlog',
  'internal.pending_purchases',
  'internal.pending_sales',
  'internal.overdue_depreciation',
])

const DEFAULT_KPI_4X4_TEMPLATE: Array<{
  perspective: BSCPerspective
  name: string
  direction: BSCDirection
  target: number
  unit: string
  formulaKey: string | null
}> = [
  { perspective: 'FINANCIAL', name: 'Revenue Growth', direction: 'HIGHER_BETTER', target: 10, unit: '%', formulaKey: 'revenue_growth' },
  { perspective: 'FINANCIAL', name: 'Net Profit Margin', direction: 'HIGHER_BETTER', target: 15, unit: '%', formulaKey: 'net_profit_margin' },
  { perspective: 'FINANCIAL', name: 'Operating Expense Ratio', direction: 'LOWER_BETTER', target: 35, unit: '%', formulaKey: 'operating_expense_ratio' },
  { perspective: 'FINANCIAL', name: 'Cash Conversion Cycle', direction: 'LOWER_BETTER', target: 45, unit: 'days', formulaKey: null },

  { perspective: 'CUSTOMER', name: 'Customer Retention Rate', direction: 'HIGHER_BETTER', target: 85, unit: '%', formulaKey: null },
  { perspective: 'CUSTOMER', name: 'New Customer Acquisition', direction: 'HIGHER_BETTER', target: 30, unit: 'customers', formulaKey: 'unique_customers' },
  { perspective: 'CUSTOMER', name: 'On-time Delivery', direction: 'HIGHER_BETTER', target: 95, unit: '%', formulaKey: null },
  { perspective: 'CUSTOMER', name: 'Complaint Resolution Time', direction: 'LOWER_BETTER', target: 24, unit: 'hours', formulaKey: null },

  { perspective: 'INTERNAL_PROCESS', name: 'Order Cycle Time', direction: 'LOWER_BETTER', target: 3, unit: 'days', formulaKey: null },
  { perspective: 'INTERNAL_PROCESS', name: 'First Pass Yield', direction: 'HIGHER_BETTER', target: 98, unit: '%', formulaKey: null },
  { perspective: 'INTERNAL_PROCESS', name: 'Inventory Turnover', direction: 'HIGHER_BETTER', target: 8, unit: 'x', formulaKey: null },
  { perspective: 'INTERNAL_PROCESS', name: 'Draft Document Backlog', direction: 'LOWER_BETTER', target: 3, unit: 'docs', formulaKey: 'draft_document_backlog' },

  { perspective: 'LEARNING_GROWTH', name: 'Training Hours per Employee', direction: 'HIGHER_BETTER', target: 8, unit: 'hours', formulaKey: null },
  { perspective: 'LEARNING_GROWTH', name: 'Employee Engagement Score', direction: 'HIGHER_BETTER', target: 80, unit: '%', formulaKey: null },
  { perspective: 'LEARNING_GROWTH', name: 'Absenteeism Rate', direction: 'LOWER_BETTER', target: 2, unit: '%', formulaKey: null },
  { perspective: 'LEARNING_GROWTH', name: 'Digital Adoption Rate', direction: 'HIGHER_BETTER', target: 90, unit: '%', formulaKey: 'hr_completion_rate' },
]

const DEFAULT_SUMMARY: BSCSetupSummary = {
  overall_score_100: 0,
  overall_score_4: 0,
  completion_percent: 0,
  perspective_scores: {
    FINANCIAL: { weight_percent: 25, score_100: 0, score_4: 0, kpi_count: 0 },
    CUSTOMER: { weight_percent: 25, score_100: 0, score_4: 0, kpi_count: 0 },
    INTERNAL_PROCESS: { weight_percent: 25, score_100: 0, score_4: 0, kpi_count: 0 },
    LEARNING_GROWTH: { weight_percent: 25, score_100: 0, score_4: 0, kpi_count: 0 },
  },
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeJournalLineAccount(value: unknown): { type?: string | null; code?: string | null } | null {
  const accountValue = Array.isArray(value) ? value.find((item) => item && typeof item === 'object') : value
  if (!accountValue || typeof accountValue !== 'object') return null
  return accountValue as { type?: string | null; code?: string | null }
}

function isPerspective(value: string): value is BSCPerspective {
  return PERSPECTIVES.includes(value as BSCPerspective)
}

function isDirection(value: string): value is BSCDirection {
  return value === 'HIGHER_BETTER' || value === 'LOWER_BETTER'
}

function normalizeDateOnly(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null
  return input
}

function getCurrentCycleRange() {
  const today = getDateInTimeZone('Asia/Jakarta')
  const [yearRaw, monthRaw] = today.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const cycleKey = `${yearRaw}-${monthRaw}`
  const startDate = `${yearRaw}-${monthRaw}-01`

  const jsMonthIndex = month - 1
  const monthEndDate = new Date(Date.UTC(year, jsMonthIndex + 1, 0))
  const endDate = `${yearRaw}-${String(monthEndDate.getUTCMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getUTCDate()).padStart(2, '0')}`
  const cycleName = `Nizametrics ${cycleKey}`

  return {
    today,
    cycleKey,
    cycleName,
    startDate,
    endDate,
  }
}

function buildEmptySetup(scope: { branch_id: string | null; cycle_key: string; start_date: string; end_date: string }, error?: string): BSCSetupPayload {
  return {
    cycle: null,
    perspectiveWeights: { ...DEFAULT_PERSPECTIVE_WEIGHTS },
    kpis: [],
    summary: {
      ...DEFAULT_SUMMARY,
      perspective_scores: {
        FINANCIAL: { ...DEFAULT_SUMMARY.perspective_scores.FINANCIAL },
        CUSTOMER: { ...DEFAULT_SUMMARY.perspective_scores.CUSTOMER },
        INTERNAL_PROCESS: { ...DEFAULT_SUMMARY.perspective_scores.INTERNAL_PROCESS },
        LEARNING_GROWTH: { ...DEFAULT_SUMMARY.perspective_scores.LEARNING_GROWTH },
      },
    },
    scope,
    ...(error ? { error } : {}),
  }
}

function buildDefaultTemplateRows(cycleId: string, userId: string | null) {
  return DEFAULT_KPI_4X4_TEMPLATE.map((template, index) => {
    const slug = generateSlug(template.name).replace(/-/g, '_').toUpperCase()
    const suffix = String(index + 1).padStart(2, '0')
    return {
      cycle_id: cycleId,
      perspective: template.perspective,
      code: `${PERSPECTIVE_CODE_MAP[template.perspective]}_${slug.slice(0, 18)}_${suffix}`,
      name: template.name,
      description: 'Template KPI default Nizametrics 4x4.',
      unit: template.unit,
      direction: template.direction,
      weight_percent: 25,
      target_value: template.target,
      baseline_value: null,
      source_type: template.formulaKey ? 'AUTO' : 'MANUAL',
      formula_key: template.formulaKey,
      is_active: true,
      created_by: userId,
    }
  })
}

function normalizeKpiText(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeFormulaKey(value: string | null | undefined) {
  return normalizeKpiText(value).replace(/\s+/g, '_')
}

function distributeExactWeights(count: number) {
  if (count <= 0) return []
  const baseWeight = Math.floor(10000 / count) / 100
  const weights = Array.from({ length: count }, () => baseWeight)
  const allocatedWeight = round2(baseWeight * count)
  weights[count - 1] = round2(weights[count - 1] + (100 - allocatedWeight))
  return weights
}

function inferGeneratedKpiDirection(metricKey: BSCOperationalMetricKey): BSCDirection {
  return LOWER_IS_BETTER_METRIC_KEYS.has(metricKey) ? 'LOWER_BETTER' : 'HIGHER_BETTER'
}

function inferGeneratedKpiTarget(metric: BSCOperationalMetric, direction: BSCDirection) {
  const currentValue = round2(Math.abs(toFiniteNumber(metric.value)))

  if (metric.key === 'learning.active_employees' || metric.key === 'learning.payroll_runs_completed') {
    return round2(Math.max(1, currentValue))
  }

  if (direction === 'LOWER_BETTER') {
    if (metric.unit === '%') return round2(clamp(currentValue > 0 ? currentValue * 0.9 : 10, 1, 100))
    if (metric.unit === 'IDR') return round2(Math.max(1, currentValue > 0 ? currentValue * 0.95 : 1000000))
    if (metric.unit === 'docs' || metric.unit === 'assets') return round2(Math.max(1, currentValue > 0 ? Math.floor(currentValue * 0.85) : 1))
    return round2(Math.max(1, currentValue > 0 ? currentValue * 0.9 : 1))
  }

  if (metric.unit === '%') return round2(clamp(currentValue > 0 ? currentValue * 1.1 : 80, 1, 100))
  if (metric.unit === 'IDR') return round2(Math.max(1, currentValue > 0 ? currentValue * 1.1 : 1000000))
  if (['orders', 'customers', 'employees', 'runs', 'assets'].includes(metric.unit)) {
    return round2(Math.max(1, currentValue + Math.max(1, Math.ceil(currentValue * 0.1))))
  }
  return round2(Math.max(1, currentValue > 0 ? currentValue * 1.1 : 1))
}

function buildGeneratedKpiRows(
  cycleId: string,
  userId: string | null,
  activeKpis: Array<{ id: string; perspective: BSCPerspective; name: string; formula_key: string | null }>,
  catalog: Record<BSCOperationalMetricKey, BSCOperationalMetric>
) {
  const activeCoverage = analyzeBscKpiCoverage(activeKpis, catalog)
  const coveredMetricKeys = new Set(activeCoverage.measurable.map((item) => item.metric.key))
  const existingFormulaKeys = new Set(
    activeKpis
      .map((kpi) => normalizeFormulaKey(kpi.formula_key))
      .filter(Boolean)
  )
  const existingNames = new Set(
    activeKpis
      .map((kpi) => normalizeKpiText(kpi.name))
      .filter(Boolean)
  )

  const generated: Array<{
    cycle_id: string
    perspective: BSCPerspective
    code: string
    name: string
    description: string
    unit: string
    direction: BSCDirection
    weight_percent: number
    target_value: number
    baseline_value: number
    source_type: 'AUTO'
    formula_key: string
    is_active: true
    created_by: string | null
    metric_key: BSCOperationalMetricKey
  }> = []

  let totalSuggested = 0

  for (const perspective of PERSPECTIVES) {
    const availableSuggestions = getPerspectiveSuggestions(perspective, catalog, 3)
    totalSuggested += availableSuggestions.length

    const filteredSuggestions = availableSuggestions.filter((metric) => {
      const formulaKey = metric.key.split('.').slice(1).join('_')
      return !coveredMetricKeys.has(metric.key)
        && !existingFormulaKeys.has(normalizeFormulaKey(formulaKey))
        && !existingNames.has(normalizeKpiText(metric.label))
    })

    const weights = distributeExactWeights(filteredSuggestions.length)

    filteredSuggestions.forEach((metric, index) => {
      const formulaKey = metric.key.split('.').slice(1).join('_')
      const direction = inferGeneratedKpiDirection(metric.key)
      const code = `${PERSPECTIVE_CODE_MAP[perspective]}_${formulaKey.toUpperCase().slice(0, 24)}`

      generated.push({
        cycle_id: cycleId,
        perspective,
        code,
        name: metric.label,
        description: `Dibuat otomatis dari data operasional: ${metric.label}.`,
        unit: metric.unit,
        direction,
        weight_percent: weights[index] || 0,
        target_value: inferGeneratedKpiTarget(metric, direction),
        baseline_value: round2(metric.value),
        source_type: 'AUTO',
        formula_key: formulaKey,
        is_active: true,
        created_by: userId,
        metric_key: metric.key,
      })
    })
  }

  return {
    generated,
    totalSuggested,
    skippedCount: totalSuggested - generated.length,
  }
}

function ensureWeightMap(rows: any[] | null | undefined): BSCWeightMap {
  const mapped: BSCWeightMap = { ...DEFAULT_PERSPECTIVE_WEIGHTS }
  for (const row of rows || []) {
    const perspective = String(row.perspective || '')
    if (!isPerspective(perspective)) continue
    mapped[perspective] = toFiniteNumber(row.weight_percent)
  }
  return mapped
}

function convertScore100ToScore4(score100: number) {
  return round2(clamp(score100, 0, 100) / 25)
}

function computeBSCSummary(kpis: BSCKPIItem[], perspectiveWeights: BSCWeightMap): BSCSetupSummary {
  const scores: BSCSetupSummary['perspective_scores'] = {
    FINANCIAL: { weight_percent: perspectiveWeights.FINANCIAL, score_100: 0, score_4: 0, kpi_count: 0 },
    CUSTOMER: { weight_percent: perspectiveWeights.CUSTOMER, score_100: 0, score_4: 0, kpi_count: 0 },
    INTERNAL_PROCESS: { weight_percent: perspectiveWeights.INTERNAL_PROCESS, score_100: 0, score_4: 0, kpi_count: 0 },
    LEARNING_GROWTH: { weight_percent: perspectiveWeights.LEARNING_GROWTH, score_100: 0, score_4: 0, kpi_count: 0 },
  }

  let totalKpis = 0
  let measuredKpis = 0

  for (const perspective of PERSPECTIVES) {
    const perspectiveKpis = kpis.filter((kpi) => kpi.perspective === perspective && kpi.is_active)
    let weightedScoreTotal = 0
    let activeWeightTotal = 0

    for (const kpi of perspectiveKpis) {
      totalKpis += 1
      const weight = toFiniteNumber(kpi.weight_percent)
      activeWeightTotal += weight

      if (kpi.latest_measurement) {
        measuredKpis += 1
        const score100 = toFiniteNumber(kpi.latest_measurement.score_100)
        weightedScoreTotal += score100 * (weight / 100)
      }
    }

    const perspectiveScore100 = activeWeightTotal > 0 ? weightedScoreTotal * (100 / activeWeightTotal) : 0
    scores[perspective] = {
      weight_percent: toFiniteNumber(perspectiveWeights[perspective]),
      score_100: round2(perspectiveScore100),
      score_4: convertScore100ToScore4(perspectiveScore100),
      kpi_count: perspectiveKpis.length,
    }
  }

  const perspectiveWeightTotal = PERSPECTIVES.reduce((sum, perspective) => sum + toFiniteNumber(scores[perspective].weight_percent), 0)
  const overallWeighted = PERSPECTIVES.reduce((sum, perspective) => {
    return sum + (scores[perspective].score_100 * toFiniteNumber(scores[perspective].weight_percent)) / 100
  }, 0)

  const overallScore100 = perspectiveWeightTotal > 0 ? overallWeighted * (100 / perspectiveWeightTotal) : 0
  const completionPercent = totalKpis > 0 ? (measuredKpis / totalKpis) * 100 : 0

  return {
    overall_score_100: round2(overallScore100),
    overall_score_4: convertScore100ToScore4(overallScore100),
    completion_percent: round2(completionPercent),
    perspective_scores: scores,
  }
}

async function resolveBSCBranchId(orgId: string, branchId?: string | null) {
  const selection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in selection) {
    return { error: selection.error }
  }

  return { branchId: selection.branchId }
}

async function findCycleByScope(db: any, orgId: string, cycleKey: string, branchId: string | null) {
  let query = db
    .from('bsc_cycles')
    .select('*')
    .eq('org_id', orgId)
    .eq('cycle_key', cycleKey)
    .in('status', ['ACTIVE', 'LOCKED'])

  if (branchId) query = query.eq('branch_id', branchId)
  else query = query.is('branch_id', null)

  const { data, error } = await query.maybeSingle()
  if (error) return { error: error.message }
  return { cycle: data as BSCCycle | null }
}

async function ensureActiveCycle(orgId: string, branchId?: string | null): Promise<EnsureActiveCycleResult> {
  const supabase = await createClient()
  const db = supabase as any
  const branchSelection = await resolveBSCBranchId(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: String(branchSelection.error || 'Gagal menentukan cakupan Nizametrics.') }
  }

  const { cycleKey, cycleName, startDate, endDate } = getCurrentCycleRange()
  const cycleLookup = await findCycleByScope(db, orgId, cycleKey, branchSelection.branchId)
  if ('error' in cycleLookup) {
    return { error: String(cycleLookup.error || 'Gagal memuat siklus Nizametrics.') }
  }

  let cycle = cycleLookup.cycle

  if (!cycle) {
    const { data: userData } = await supabase.auth.getUser()
    const { data: createdCycle, error: insertError } = await db
      .from('bsc_cycles')
      .insert({
        org_id: orgId,
        branch_id: branchSelection.branchId,
        cycle_key: cycleKey,
        cycle_name: cycleName,
        period_type: 'MONTHLY',
        start_date: startDate,
        end_date: endDate,
        status: 'ACTIVE',
        created_by: userData?.user?.id || null,
      })
      .select('*')
      .single()

    if (insertError || !createdCycle?.id) {
      return { error: insertError?.message || 'Gagal membuat siklus Nizametrics aktif.' }
    }

    cycle = createdCycle as BSCCycle
  }

  if (!cycle) {
    return { error: 'Gagal memastikan siklus Nizametrics aktif.' }
  }

  const defaultWeightRows = PERSPECTIVES.map((perspective) => ({
    cycle_id: cycle.id,
    perspective,
    weight_percent: DEFAULT_PERSPECTIVE_WEIGHTS[perspective],
  }))

  const { error: defaultWeightError } = await db
    .from('bsc_perspective_weights')
    .upsert(defaultWeightRows, { onConflict: 'cycle_id,perspective' })

  if (defaultWeightError) {
    return { error: defaultWeightError.message || 'Gagal menyiapkan bobot perspektif default.' }
  }

  return {
    cycle,
    branchId: branchSelection.branchId,
    cycleKey,
    startDate,
    endDate,
  }
}

export async function getBSCDeckSummaries(orgIds: string[]): Promise<Record<string, BSCDeckSummary>> {
  const normalizedOrgIds = Array.from(
    new Set(orgIds.map((orgId) => String(orgId || '').trim()).filter(Boolean))
  )

  if (normalizedOrgIds.length === 0) {
    return {}
  }

  const supabase = await createClient()
  const db = supabase as any
  const range = getCurrentCycleRange()

  const { data: cycleRows, error: cycleError } = await db
    .from('bsc_cycles')
    .select('id, org_id, branch_id, cycle_name, cycle_key, created_at')
    .in('org_id', normalizedOrgIds)
    .eq('cycle_key', range.cycleKey)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })

  if (cycleError) {
    return Object.fromEntries(
      normalizedOrgIds.map((orgId) => [
        orgId,
        {
          overall_score_100: null,
          overall_score_4: null,
          completion_percent: null,
          cycle_name: null,
          perspective_scores: {
            FINANCIAL: { score_100: 0, score_4: 0, kpi_count: 0 },
            CUSTOMER: { score_100: 0, score_4: 0, kpi_count: 0 },
            INTERNAL_PROCESS: { score_100: 0, score_4: 0, kpi_count: 0 },
            LEARNING_GROWTH: { score_100: 0, score_4: 0, kpi_count: 0 },
          },
          status: 'error' as const,
          error: cycleError.message || 'Gagal memuat ringkasan Nizametrics.',
        },
      ])
    )
  }

  const preferredCycleByOrg = new Map<string, {
    id: string
    org_id: string
    branch_id: string | null
    cycle_name: string | null
  }>()

  for (const row of (cycleRows || []) as Array<Record<string, unknown>>) {
    const orgId = String(row.org_id || '').trim()
    const cycleId = String(row.id || '').trim()
    if (!orgId || !cycleId) continue

    const candidate = {
      id: cycleId,
      org_id: orgId,
      branch_id: row.branch_id ? String(row.branch_id) : null,
      cycle_name: row.cycle_name ? String(row.cycle_name) : null,
    }

    const existing = preferredCycleByOrg.get(orgId)
    if (!existing) {
      preferredCycleByOrg.set(orgId, candidate)
      continue
    }

    if (existing.branch_id && !candidate.branch_id) {
      preferredCycleByOrg.set(orgId, candidate)
    }
  }

  const cycleIds = Array.from(preferredCycleByOrg.values()).map((cycle) => cycle.id)
  if (cycleIds.length === 0) {
    return Object.fromEntries(
      normalizedOrgIds.map((orgId) => [
        orgId,
        {
          overall_score_100: null,
          overall_score_4: null,
          completion_percent: null,
          cycle_name: null,
          perspective_scores: {
            FINANCIAL: { score_100: 0, score_4: 0, kpi_count: 0 },
            CUSTOMER: { score_100: 0, score_4: 0, kpi_count: 0 },
            INTERNAL_PROCESS: { score_100: 0, score_4: 0, kpi_count: 0 },
            LEARNING_GROWTH: { score_100: 0, score_4: 0, kpi_count: 0 },
          },
          status: 'empty' as const,
        },
      ])
    )
  }

  const [{ data: weightRows, error: weightError }, { data: kpiRows, error: kpiError }] = await Promise.all([
    db
      .from('bsc_perspective_weights')
      .select('cycle_id, perspective, weight_percent')
      .in('cycle_id', cycleIds),
    db
      .from('bsc_kpis')
      .select('id, cycle_id, perspective, weight_percent, is_active')
      .in('cycle_id', cycleIds)
      .eq('is_active', true),
  ])

  if (weightError || kpiError) {
    const message = weightError?.message || kpiError?.message || 'Gagal memuat detail Nizametrics.'
    return Object.fromEntries(
      normalizedOrgIds.map((orgId) => [
        orgId,
        {
          overall_score_100: null,
          overall_score_4: null,
          completion_percent: null,
          cycle_name: preferredCycleByOrg.get(orgId)?.cycle_name || null,
          perspective_scores: {
            FINANCIAL: { score_100: 0, score_4: 0, kpi_count: 0 },
            CUSTOMER: { score_100: 0, score_4: 0, kpi_count: 0 },
            INTERNAL_PROCESS: { score_100: 0, score_4: 0, kpi_count: 0 },
            LEARNING_GROWTH: { score_100: 0, score_4: 0, kpi_count: 0 },
          },
          status: preferredCycleByOrg.has(orgId) ? 'error' as const : 'empty' as const,
          ...(preferredCycleByOrg.has(orgId) ? { error: message } : {}),
        },
      ])
    )
  }

  const activeKpis = (kpiRows || []) as Array<Record<string, unknown>>
  const kpiIds = activeKpis.map((kpi) => String(kpi.id || '')).filter(Boolean)
  let latestByKpi = new Map<string, BSCLatestMeasurement>()

  if (kpiIds.length > 0) {
    const { data: latestRows, error: latestError } = await db
      .from('v_bsc_latest_kpi_measurements')
      .select('id, kpi_id, measurement_date, actual_value, achievement_percent, score_100, score_4, note')
      .in('kpi_id', kpiIds)

    if (latestError) {
      return Object.fromEntries(
        normalizedOrgIds.map((orgId) => [
          orgId,
          {
            overall_score_100: null,
            overall_score_4: null,
            completion_percent: null,
            cycle_name: preferredCycleByOrg.get(orgId)?.cycle_name || null,
            perspective_scores: {
              FINANCIAL: { score_100: 0, score_4: 0, kpi_count: 0 },
              CUSTOMER: { score_100: 0, score_4: 0, kpi_count: 0 },
              INTERNAL_PROCESS: { score_100: 0, score_4: 0, kpi_count: 0 },
              LEARNING_GROWTH: { score_100: 0, score_4: 0, kpi_count: 0 },
            },
            status: preferredCycleByOrg.has(orgId) ? 'error' as const : 'empty' as const,
            ...(preferredCycleByOrg.has(orgId) ? { error: latestError.message || 'Gagal memuat score Nizametrics.' } : {}),
          },
        ])
      )
    }

    latestByKpi = new Map(
      ((latestRows || []) as Array<Record<string, unknown>>).map((measurement) => [
        String(measurement.kpi_id),
        {
          id: String(measurement.id || ''),
          measurement_date: String(measurement.measurement_date || ''),
          actual_value: toFiniteNumber(measurement.actual_value),
          achievement_percent: toFiniteNumber(measurement.achievement_percent),
          score_100: toFiniteNumber(measurement.score_100),
          score_4: toFiniteNumber(measurement.score_4),
          note: measurement.note ? String(measurement.note) : null,
        },
      ])
    )
  }

  const weightsByCycle = new Map<string, Array<Record<string, unknown>>>()
  for (const row of (weightRows || []) as Array<Record<string, unknown>>) {
    const cycleId = String(row.cycle_id || '').trim()
    if (!cycleId) continue
    const current = weightsByCycle.get(cycleId) || []
    current.push(row)
    weightsByCycle.set(cycleId, current)
  }

  const kpisByCycle = new Map<string, BSCKPIItem[]>()
  for (const row of activeKpis) {
    const cycleId = String(row.cycle_id || '').trim()
    const kpiId = String(row.id || '').trim()
    if (!cycleId || !kpiId) continue

    const current = kpisByCycle.get(cycleId) || []
    current.push({
      id: kpiId,
      cycle_id: cycleId,
      perspective: isPerspective(String(row.perspective)) ? (row.perspective as BSCPerspective) : 'FINANCIAL',
      code: '',
      name: '',
      description: null,
      unit: null,
      direction: 'HIGHER_BETTER',
      weight_percent: toFiniteNumber(row.weight_percent),
      target_value: 0,
      baseline_value: null,
      source_type: 'MANUAL',
      formula_key: null,
      is_active: Boolean(row.is_active),
      latest_measurement: latestByKpi.get(kpiId) || null,
    })
    kpisByCycle.set(cycleId, current)
  }

  return Object.fromEntries(
    normalizedOrgIds.map((orgId) => {
      const cycle = preferredCycleByOrg.get(orgId)
      if (!cycle) {
        return [
          orgId,
          {
            overall_score_100: null,
            overall_score_4: null,
            completion_percent: null,
            cycle_name: null,
            perspective_scores: {
              FINANCIAL: { score_100: 0, score_4: 0, kpi_count: 0 },
              CUSTOMER: { score_100: 0, score_4: 0, kpi_count: 0 },
              INTERNAL_PROCESS: { score_100: 0, score_4: 0, kpi_count: 0 },
              LEARNING_GROWTH: { score_100: 0, score_4: 0, kpi_count: 0 },
            },
            status: 'empty' as const,
          },
        ]
      }

      const weights = ensureWeightMap(weightsByCycle.get(cycle.id))
      const summary = computeBSCSummary(kpisByCycle.get(cycle.id) || [], weights)

      return [
        orgId,
        {
          overall_score_100: summary.overall_score_100,
          overall_score_4: summary.overall_score_4,
          completion_percent: summary.completion_percent,
          cycle_name: cycle.cycle_name,
          perspective_scores: summary.perspective_scores,
          status: 'ready' as const,
        },
      ]
    })
  )
}

// ---------------------------------------------------------------------
// Nizametrics dashboard metrics (read-only operational snapshot)
// ---------------------------------------------------------------------
export async function getBSCMetrics(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const db = supabase as any
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = now.toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  // ===== PERSPECTIVE 1: FINANCIAL =====
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

  let currentRevenue = 0
  let currentExpenses = 0
  if (thisIds.length > 0) {
    const { data: lines } = await db
      .from('journal_lines')
      .select('debit, credit, accounts!inner(type, code)')
      .in('entry_id', thisIds) as any

    for (const line of lines || []) {
      const account = normalizeJournalLineAccount(line.accounts)
      if (!account) continue
      if (account.type === 'REVENUE' || account.code?.startsWith('4')) currentRevenue += Number(line.credit) - Number(line.debit)
      if (account.type === 'EXPENSE' || account.code?.startsWith('5') || account.code?.startsWith('6')) currentExpenses += Number(line.debit) - Number(line.credit)
    }
  }

  // Last month comparison
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

    for (const line of lastLines || []) {
      const account = normalizeJournalLineAccount(line.accounts)
      if (!account) continue
      if (account.type === 'REVENUE' || account.code?.startsWith('4')) lastRevenue += Number(line.credit) - Number(line.debit)
    }
  }

  const netProfit = currentRevenue - currentExpenses
  const profitMargin = currentRevenue > 0 ? (netProfit / currentRevenue) * 100 : 0
  const revenueGrowth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0

  // ===== PERSPECTIVE 2: CUSTOMER =====
  let salesQuery = db
    .from('sales')
    .select('id, grand_total, status, customer_id')
    .eq('org_id', orgId)
    .gte('created_at', monthStart)

  if (branchId) {
    salesQuery = salesQuery.eq('branch_id', branchId)
  }

  const { data: salesData } = await salesQuery
  const mtdSales = (salesData || []).reduce((sum: number, sale: any) => sum + Number(sale.grand_total), 0)
  const totalOrders = (salesData || []).length
  const uniqueCustomers = new Set((salesData || []).map((sale: any) => sale.customer_id)).size

  // ===== PERSPECTIVE 3: INTERNAL PROCESS =====
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
      lastRevenue,
    },
    customer: {
      mtdSales,
      totalOrders,
      uniqueCustomers,
    },
    internal: {
      pendingPurchases: pendingPurchases || 0,
      pendingSales: pendingSales || 0,
      totalAssets: totalAssets || 0,
      overdueDepreciation: overdueAssets || 0,
      processHealth: Math.max(0, 100 - ((pendingPurchases || 0) + (pendingSales || 0)) * 2),
    },
    learning: {
      activeEmployees: employees || 0,
      payrollRunsCompleted: payrollRuns || 0,
      hrCompletionRate: (payrollRuns || 0) > 0 ? 100 : 0,
    },
  }
}

// ---------------------------------------------------------------------
// Configurable Nizametrics setup + measurement
// ---------------------------------------------------------------------
export async function getBSCSetup(orgId: string, branchId?: string | null): Promise<BSCSetupPayload> {
  const supabase = await createClient()
  const db = supabase as any
  const range = getCurrentCycleRange()

  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) {
    return buildEmptySetup(
      {
        branch_id: null,
        cycle_key: range.cycleKey,
        start_date: range.startDate,
        end_date: range.endDate,
      },
      ensured.error
    )
  }
  const cycle = ensured.cycle

  const [{ data: weightRows, error: weightError }, { data: kpiRows, error: kpiError }] = await Promise.all([
    db
      .from('bsc_perspective_weights')
      .select('perspective, weight_percent')
      .eq('cycle_id', cycle.id),
    db
      .from('bsc_kpis')
      .select('*')
      .eq('cycle_id', cycle.id)
      .eq('is_active', true)
      .order('perspective', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (weightError || kpiError) {
    return buildEmptySetup(
      {
        branch_id: ensured.branchId,
        cycle_key: range.cycleKey,
        start_date: range.startDate,
        end_date: range.endDate,
      },
      weightError?.message || kpiError?.message || 'Gagal memuat setup Nizametrics.'
    )
  }

  const activeKpiRows = (kpiRows || []) as any[]

  const kpiIds = activeKpiRows.map((kpi) => String(kpi.id))

  let latestByKpi = new Map<string, BSCLatestMeasurement>()
  if (kpiIds.length > 0) {
    const { data: latestRows } = await db
      .from('v_bsc_latest_kpi_measurements')
      .select('*')
      .in('kpi_id', kpiIds)

    latestByKpi = new Map(
      (latestRows || []).map((measurement: any) => [
        String(measurement.kpi_id),
        {
          id: String(measurement.id),
          measurement_date: String(measurement.measurement_date),
          actual_value: toFiniteNumber(measurement.actual_value),
          achievement_percent: toFiniteNumber(measurement.achievement_percent),
          score_100: toFiniteNumber(measurement.score_100),
          score_4: toFiniteNumber(measurement.score_4),
          note: measurement.note ? String(measurement.note) : null,
        },
      ])
    )
  }

  const perspectiveWeights = ensureWeightMap(weightRows)
  const kpis: BSCKPIItem[] = activeKpiRows.map((kpi) => ({
    id: String(kpi.id),
    cycle_id: String(kpi.cycle_id),
    perspective: isPerspective(String(kpi.perspective)) ? (kpi.perspective as BSCPerspective) : 'FINANCIAL',
    code: String(kpi.code || ''),
    name: String(kpi.name || ''),
    description: kpi.description ? String(kpi.description) : null,
    unit: kpi.unit ? String(kpi.unit) : null,
    direction: isDirection(String(kpi.direction)) ? (kpi.direction as BSCDirection) : 'HIGHER_BETTER',
    weight_percent: toFiniteNumber(kpi.weight_percent),
    target_value: toFiniteNumber(kpi.target_value),
    baseline_value: kpi.baseline_value === null || kpi.baseline_value === undefined ? null : toFiniteNumber(kpi.baseline_value),
    source_type: String(kpi.source_type || 'MANUAL') === 'AUTO' ? 'AUTO' : 'MANUAL',
    formula_key: kpi.formula_key ? String(kpi.formula_key) : null,
    is_active: Boolean(kpi.is_active),
    latest_measurement: latestByKpi.get(String(kpi.id)) || null,
  }))

  const summary = computeBSCSummary(kpis, perspectiveWeights)

  return {
    cycle,
    perspectiveWeights,
    kpis,
    summary,
    scope: {
      branch_id: ensured.branchId,
      cycle_key: range.cycleKey,
      start_date: range.startDate,
      end_date: range.endDate,
    },
  }
}

export async function saveBSCPerspectiveWeights(orgId: string, weights: BSCWeightMap, branchId?: string | null) {
  const totalWeight = PERSPECTIVES.reduce((sum, perspective) => sum + toFiniteNumber(weights[perspective]), 0)
  if (Math.abs(totalWeight - 100) > 0.01) {
    return { error: 'Total bobot 4 perspektif harus tepat 100%.' }
  }

  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) return { error: ensured.error }

  const supabase = await createClient()
  const db = supabase as any

  const rows = PERSPECTIVES.map((perspective) => ({
    cycle_id: ensured.cycle.id,
    perspective,
    weight_percent: round2(toFiniteNumber(weights[perspective])),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await db
    .from('bsc_perspective_weights')
    .upsert(rows, { onConflict: 'cycle_id,perspective' })

  if (error) return { error: error.message || 'Gagal menyimpan bobot perspektif Nizametrics.' }

  revalidatePath('/reports/nizametrics')
  return { success: true }
}

export async function upsertBSCKPI(orgId: string, input: UpsertBSCKPIInput, branchId?: string | null) {
  const name = String(input.name || '').trim()
  if (!name) return { error: 'Nama KPI wajib diisi.' }

  if (!isPerspective(input.perspective)) return { error: 'Perspektif KPI tidak valid.' }
  if (!isDirection(input.direction)) return { error: 'Arah KPI tidak valid.' }

  const targetValue = toFiniteNumber(input.targetValue)
  const weightPercent = round2(toFiniteNumber(input.weightPercent))

  if (targetValue <= 0) return { error: 'Target KPI harus lebih besar dari 0.' }
  if (weightPercent <= 0 || weightPercent > 100) return { error: 'Bobot KPI harus di antara 0..100.' }

  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) return { error: ensured.error }

  const supabase = await createClient()
  const db = supabase as any

  const kpiId = String(input.id || '').trim() || null

  let existingKpi: { id: string; perspective: BSCPerspective } | null = null
  if (kpiId) {
    const { data } = await db
      .from('bsc_kpis')
      .select('id, perspective')
      .eq('id', kpiId)
      .eq('cycle_id', ensured.cycle.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!data?.id) {
      return { error: 'KPI tidak ditemukan pada siklus aktif.' }
    }

    existingKpi = {
      id: String(data.id),
      perspective: isPerspective(String(data.perspective)) ? (data.perspective as BSCPerspective) : input.perspective,
    }
  }

  const { data: perspectiveKpis } = await db
    .from('bsc_kpis')
    .select('id, weight_percent')
    .eq('cycle_id', ensured.cycle.id)
    .eq('perspective', input.perspective)
    .eq('is_active', true)

  const currentWeight = (perspectiveKpis || []).reduce((sum: number, item: any) => {
    if (existingKpi && String(item.id) === existingKpi.id) return sum
    return sum + toFiniteNumber(item.weight_percent)
  }, 0)

  if (currentWeight + weightPercent > 100.001) {
    return { error: `Bobot KPI perspektif ${input.perspective} melebihi 100%. Sisa maksimal ${round2(100 - currentWeight)}%.` }
  }

  const payload = {
    cycle_id: ensured.cycle.id,
    perspective: input.perspective,
    name,
    description: input.description ? String(input.description).trim() : null,
    unit: input.unit ? String(input.unit).trim() : null,
    direction: input.direction,
    weight_percent: weightPercent,
    target_value: targetValue,
    baseline_value: input.baselineValue === null || input.baselineValue === undefined ? null : toFiniteNumber(input.baselineValue),
    source_type: input.sourceType === 'AUTO' ? 'AUTO' : 'MANUAL',
    formula_key: input.formulaKey ? String(input.formulaKey).trim() : null,
    updated_at: new Date().toISOString(),
  }

  if (existingKpi) {
    const { error } = await db
      .from('bsc_kpis')
      .update(payload)
      .eq('id', existingKpi.id)
      .eq('cycle_id', ensured.cycle.id)

    if (error) return { error: error.message || 'Gagal memperbarui KPI.' }

    revalidatePath('/reports/nizametrics')
    return { success: true, kpiId: existingKpi.id }
  }

  const generatedSlug = generateSlug(name).replace(/-/g, '_').toUpperCase()
  const cleanedSlug = generatedSlug || 'KPI'
  const code = `${PERSPECTIVE_CODE_MAP[input.perspective]}_${cleanedSlug.slice(0, 24)}_${Date.now().toString().slice(-4)}`

  const { data: inserted, error } = await db
    .from('bsc_kpis')
    .insert({
      ...payload,
      code,
      created_by: (await supabase.auth.getUser())?.data?.user?.id || null,
    })
    .select('id')
    .single()

  if (error || !inserted?.id) {
    return { error: error?.message || 'Gagal menambahkan KPI baru.' }
  }

  revalidatePath('/reports/nizametrics')
  return { success: true, kpiId: String(inserted.id) }
}

export async function archiveBSCKPI(orgId: string, kpiId: string, branchId?: string | null) {
  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) return { error: ensured.error }

  const supabase = await createClient()
  const db = supabase as any

  const { error } = await db
    .from('bsc_kpis')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', kpiId)
    .eq('cycle_id', ensured.cycle.id)

  if (error) return { error: error.message || 'Gagal menonaktifkan KPI.' }

  revalidatePath('/reports/nizametrics')
  return { success: true }
}

export async function recordBSCKPIMeasurement(orgId: string, input: RecordMeasurementInput, branchId?: string | null) {
  const kpiId = String(input.kpiId || '').trim()
  if (!kpiId) return { error: 'KPI tidak valid.' }

  const actualValue = toFiniteNumber(input.actualValue)
  if (!Number.isFinite(actualValue)) return { error: 'Nilai aktual KPI harus berupa angka.' }

  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) return { error: ensured.error }

  const measurementDateRaw = input.measurementDate ? String(input.measurementDate).trim() : getDateInTimeZone('Asia/Jakarta')
  const measurementDate = normalizeDateOnly(measurementDateRaw)
  if (!measurementDate) return { error: 'Format tanggal pengukuran harus YYYY-MM-DD.' }

  const supabase = await createClient()
  const db = supabase as any

  const { data: kpi } = await db
    .from('bsc_kpis')
    .select('id')
    .eq('id', kpiId)
    .eq('cycle_id', ensured.cycle.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!kpi?.id) return { error: 'KPI tidak ditemukan pada siklus aktif.' }

  const userId = (await supabase.auth.getUser())?.data?.user?.id || null

  const { error } = await db
    .from('bsc_kpi_measurements')
    .upsert(
      {
        cycle_id: ensured.cycle.id,
        kpi_id: kpiId,
        measurement_date: measurementDate,
        actual_value: actualValue,
        note: input.note ? String(input.note).trim() : null,
        measured_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cycle_id,kpi_id,measurement_date' }
    )

  if (error) return { error: error.message || 'Gagal menyimpan pengukuran KPI.' }

  revalidatePath('/reports/nizametrics')
  return { success: true }
}

export async function seedDefaultBSCKpis(orgId: string, branchId?: string | null) {
  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) return { error: ensured.error }

  const supabase = await createClient()
  const db = supabase as any

  const { count } = await db
    .from('bsc_kpis')
    .select('*', { count: 'exact', head: true })
    .eq('cycle_id', ensured.cycle.id)
    .eq('is_active', true)

  if ((count || 0) > 0) {
    return { error: 'Siklus Nizametrics aktif sudah memiliki KPI. Template default hanya untuk setup awal kosong.' }
  }

  const userId = (await supabase.auth.getUser())?.data?.user?.id || null

  const rows = buildDefaultTemplateRows(ensured.cycle.id, userId)

  const { error } = await db
    .from('bsc_kpis')
    .insert(rows)

  if (error) return { error: error.message || 'Gagal membuat template KPI default.' }

  revalidatePath('/reports/nizametrics')
  return { success: true, inserted: rows.length }
}

export async function generateBSCKpisFromExistingData(orgId: string, branchId?: string | null) {
  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) return { error: ensured.error }

  const supabase = await createClient()
  const db = supabase as any

  const [{ data: activeKpis, error: kpiError }, metrics] = await Promise.all([
    db
      .from('bsc_kpis')
      .select('id, perspective, name, formula_key')
      .eq('cycle_id', ensured.cycle.id)
      .eq('is_active', true),
    getBSCMetrics(orgId, ensured.branchId),
  ])

  if (kpiError) {
    return { error: kpiError.message || 'Gagal memuat KPI aktif untuk generator otomatis.' }
  }

  const normalizedKpis = (activeKpis || [])
    .map((row: any) => {
      const perspectiveRaw = String(row.perspective || '')
      if (!isPerspective(perspectiveRaw)) return null
      return {
        id: String(row.id),
        perspective: perspectiveRaw,
        name: String(row.name || ''),
        formula_key: row.formula_key ? String(row.formula_key) : null,
      }
    })
    .filter(Boolean) as Array<{ id: string; perspective: BSCPerspective; name: string; formula_key: string | null }>

  const metricCatalog = buildOperationalMetricCatalog(metrics)
  const userId = typeof supabase.auth?.getUser === 'function'
    ? (await supabase.auth.getUser())?.data?.user?.id || null
    : null
  const generation = buildGeneratedKpiRows(ensured.cycle.id, userId, normalizedKpis, metricCatalog)

  if (generation.generated.length > 0) {
    const rowsToInsert = generation.generated.map((item) => {
      const row = { ...item }
      delete (row as { metric_key?: BSCOperationalMetricKey }).metric_key
      return row
    })
    const { error: insertError } = await db
      .from('bsc_kpis')
      .insert(rowsToInsert)

    if (insertError) {
      return { error: insertError.message || 'Gagal membuat KPI otomatis dari data existing.' }
    }
  }

  const syncResult = await syncBSCKpisFromExistingData(orgId, branchId)
  if (syncResult.error && generation.generated.length === 0) {
    return { error: syncResult.error }
  }

  if (syncResult.error) {
    return {
      success: true,
      inserted_count: generation.generated.length,
      skipped_count: generation.skippedCount,
      synced_count: 0,
      warning: syncResult.error,
      generated: generation.generated.map((item) => ({
        name: item.name,
        perspective: item.perspective,
        metric_key: item.metric_key,
        target_value: item.target_value,
        unit: item.unit,
      })),
    }
  }

  revalidatePath('/reports/nizametrics')

  return {
    success: true,
    inserted_count: generation.generated.length,
    skipped_count: generation.skippedCount,
    synced_count: syncResult.synced_count || 0,
    generated: generation.generated.map((item) => ({
      name: item.name,
      perspective: item.perspective,
      metric_key: item.metric_key,
      target_value: item.target_value,
      unit: item.unit,
    })),
  }
}

export async function applyBscKpiSuggestedIndicator(
  orgId: string,
  input: { kpiId: string; metricKey: string },
  branchId?: string | null
) {
  const kpiId = String(input.kpiId || '').trim()
  const metricKey = String(input.metricKey || '').trim()
  if (!kpiId) return { error: 'KPI tidak valid.' }
  if (!/^[a-z_]+\.[a-z_]+$/.test(metricKey)) return { error: 'Metric key tidak valid.' }

  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) return { error: ensured.error }

  const supabase = await createClient()
  const db = supabase as any

  const { data: existingKpi } = await db
    .from('bsc_kpis')
    .select('id')
    .eq('id', kpiId)
    .eq('cycle_id', ensured.cycle.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!existingKpi?.id) {
    return { error: 'KPI tidak ditemukan pada siklus aktif.' }
  }

  const formulaKey = metricKey.split('.').slice(1).join('_')
  const { error } = await db
    .from('bsc_kpis')
    .update({
      source_type: 'AUTO',
      formula_key: formulaKey || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', kpiId)
    .eq('cycle_id', ensured.cycle.id)

  if (error) return { error: error.message || 'Gagal menerapkan indikator ke KPI.' }

  revalidatePath('/reports/nizametrics')
  return { success: true }
}

export async function syncBSCKpisFromExistingData(orgId: string, branchId?: string | null) {
  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) return { error: ensured.error }

  const supabase = await createClient()
  const db = supabase as any

  const [{ data: activeKpis, error: kpiError }, metrics] = await Promise.all([
    db
      .from('bsc_kpis')
      .select('id, perspective, name, formula_key')
      .eq('cycle_id', ensured.cycle.id)
      .eq('is_active', true),
    getBSCMetrics(orgId, ensured.branchId),
  ])

  if (kpiError) {
    return { error: kpiError.message || 'Gagal memuat KPI aktif untuk sinkronisasi.' }
  }

  const normalizedKpis = (activeKpis || [])
    .map((row: any) => {
      const perspectiveRaw = String(row.perspective || '')
      if (!isPerspective(perspectiveRaw)) return null
      return {
        id: String(row.id),
        perspective: perspectiveRaw,
        name: String(row.name || ''),
        formula_key: row.formula_key ? String(row.formula_key) : null,
      }
    })
    .filter(Boolean) as Array<{ id: string; perspective: BSCPerspective; name: string; formula_key: string | null }>

  const metricCatalog = buildOperationalMetricCatalog(metrics)
  const coverage = analyzeBscKpiCoverage(normalizedKpis, metricCatalog)

  if (coverage.measurable.length === 0) {
    return {
      error: 'Belum ada KPI yang bisa disinkronkan otomatis dari data saat ini.',
      synced_count: 0,
      measurable_count: 0,
      unmapped_count: coverage.unmapped.length,
      unmapped: coverage.unmapped.map((item) => ({
        kpi_name: item.kpi_name,
        perspective: item.perspective,
        suggestions: item.suggestions.map((suggestion) => ({
          metric_key: suggestion.key,
          label: suggestion.label,
          unit: suggestion.unit,
          value: round2(suggestion.value),
        })),
      })),
    }
  }

  const userId = typeof supabase.auth?.getUser === 'function'
    ? (await supabase.auth.getUser())?.data?.user?.id || null
    : null
  const measurementDate = getDateInTimeZone('Asia/Jakarta')
  const metadataUpdateTime = new Date().toISOString()

  if (coverage.measurable.length > 0) {
    const metadataUpdates = coverage.measurable.map((item) => {
      const formulaKey = item.metric.key.split('.').slice(1).join('_')
      return db
        .from('bsc_kpis')
        .update({
          source_type: 'AUTO',
          formula_key: formulaKey || null,
          updated_at: metadataUpdateTime,
        })
        .eq('id', item.kpi_id)
        .eq('cycle_id', ensured.cycle.id)
    })

    await Promise.all(metadataUpdates)
  }

  const measurementRows = coverage.measurable.map((item) => ({
    cycle_id: ensured.cycle.id,
    kpi_id: item.kpi_id,
    measurement_date: measurementDate,
    actual_value: round2(item.metric.value),
    note: `Nizametrics auto-sync dari data operasional: ${item.metric.label} (${item.metric.key})`,
    measured_by: userId,
    updated_at: new Date().toISOString(),
  }))

  const { error: syncError } = await db
    .from('bsc_kpi_measurements')
    .upsert(measurementRows, { onConflict: 'cycle_id,kpi_id,measurement_date' })

  if (syncError) {
    return { error: syncError.message || 'Gagal menyimpan sinkronisasi KPI otomatis.' }
  }

  revalidatePath('/reports/nizametrics')

  return {
    success: true,
    synced_count: measurementRows.length,
    measurable_count: coverage.measurable.length,
    unmapped_count: coverage.unmapped.length,
    measurable: coverage.measurable.map((item) => ({
      kpi_name: item.kpi_name,
      perspective: item.perspective,
      metric_key: item.metric.key,
      metric_label: item.metric.label,
      unit: item.metric.unit,
      value: round2(item.metric.value),
      matched_by: item.matched_by,
    })),
    unmapped: coverage.unmapped.map((item) => ({
      kpi_name: item.kpi_name,
      perspective: item.perspective,
      suggestions: item.suggestions.map((suggestion) => ({
        metric_key: suggestion.key,
        label: suggestion.label,
        unit: suggestion.unit,
        value: round2(suggestion.value),
      })),
    })),
  }
}

// ---------------------------------------------------------------------
// Lock / Unlock siklus Nizametrics
// ---------------------------------------------------------------------
export async function lockBSCCycle(orgId: string, branchId?: string | null) {
  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) return { error: ensured.error }

  if (ensured.cycle.status !== 'ACTIVE') {
    return { error: 'Siklus tidak dalam mode setup — tidak bisa dikunci.' }
  }

  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bsc_cycles')
    .update({ status: 'LOCKED' })
    .eq('id', ensured.cycle.id)

  if (error) return { error: error.message || 'Gagal mengunci siklus Nizametrics.' }

  revalidatePath('/reports/nizametrics')
  return { success: true }
}

export async function unlockBSCCycle(orgId: string, branchId?: string | null) {
  const ensured = await ensureActiveCycle(orgId, branchId)
  if ('error' in ensured) return { error: ensured.error }

  if (ensured.cycle.status !== 'LOCKED') {
    return { error: 'Siklus tidak dalam mode terkunci — tidak bisa dibuka.' }
  }

  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bsc_cycles')
    .update({ status: 'ACTIVE' })
    .eq('id', ensured.cycle.id)

  if (error) return { error: error.message || 'Gagal membuka kunci siklus Nizametrics.' }

  revalidatePath('/reports/nizametrics')
  return { success: true }
}
