'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  CircleDollarSign, 
  Users, 
  Settings, 
  BookOpen,
  BarChart3,
  Zap,
  Save,
  Plus,
  Trash2,
  RefreshCcw
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatRupiah, getDateInTimeZone } from '@/lib/utils'
import {
  generateBSCKpisFromExistingData,
  saveBSCPerspectiveWeights,
  upsertBSCKPI,
  archiveBSCKPI,
  recordBSCKPIMeasurement,
  seedDefaultBSCKpis,
  syncBSCKpisFromExistingData,
  applyBscKpiSuggestedIndicator,
} from '@/modules/accounting/actions/bsc.actions'
import { analyzeBscKpiCoverage, buildOperationalMetricCatalog, getPerspectiveSuggestions } from '@/modules/accounting/lib/bsc-kpi-mapping'

type BSCPerspective = 'FINANCIAL' | 'CUSTOMER' | 'INTERNAL_PROCESS' | 'LEARNING_GROWTH'
type BSCDirection = 'HIGHER_BETTER' | 'LOWER_BETTER'

type BSCWeightMap = Record<BSCPerspective, number>

const PERSPECTIVES: BSCPerspective[] = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH']

function normalizeKpiText(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type ActionOutcome = {
  error?: string
  success?: boolean
}

type BSCSetupData = {
  cycle: {
    id: string
    cycle_key: string
    cycle_name: string
    start_date: string
    end_date: string
  } | null
  perspectiveWeights: BSCWeightMap
  kpis: Array<{
    id: string
    perspective: BSCPerspective
    code: string
    name: string
    formula_key?: string | null
    source_type?: 'AUTO' | 'MANUAL'
    unit: string | null
    direction: BSCDirection
    weight_percent: number
    target_value: number
    latest_measurement: {
      measurement_date: string
      actual_value: number
      achievement_percent: number
      score_100: number
      score_4: number
    } | null
  }>
  summary: {
    overall_score_100: number
    overall_score_4: number
    completion_percent: number
    perspective_scores: Record<BSCPerspective, { score_100: number; score_4: number; weight_percent: number; kpi_count: number }>
  }
  scope: {
    branch_id: string | null
    cycle_key: string
    start_date: string
    end_date: string
  }
  error?: string
}

interface BSCClientProps {
  orgId: string
  activeBranchId?: string | null
  activeBranchName?: string | null
  allowAllBranchSelection?: boolean
  initialData: {
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
  setupData: BSCSetupData
}

export function BSCClient({
  orgId,
  activeBranchId = null,
  activeBranchName = null,
  allowAllBranchSelection = false,
  initialData,
  setupData,
}: BSCClientProps) {
  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
  const item = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const todayDate = getDateInTimeZone('Asia/Jakarta')

  const perspectiveLabel: Record<BSCPerspective, string> = {
    FINANCIAL: 'Financial',
    CUSTOMER: 'Customer',
    INTERNAL_PROCESS: 'Internal Process',
    LEARNING_GROWTH: 'Learning & Growth',
  }

  const canManageSetup = Boolean(activeBranchId) || allowAllBranchSelection
  const scopeLabel = activeBranchName || (allowAllBranchSelection ? 'Semua Unit (Agregat)' : 'Unit Belum Dipilih')

  const [weightDraft, setWeightDraft] = useState<BSCWeightMap>(setupData.perspectiveWeights)
  const [kpiForm, setKpiForm] = useState<{
    id: string | null
    perspective: BSCPerspective
    name: string
    unit: string
    direction: BSCDirection
    weightPercent: string
    targetValue: string
  }>({
    id: null,
    perspective: 'FINANCIAL',
    name: '',
    unit: '',
    direction: 'HIGHER_BETTER',
    weightPercent: '25',
    targetValue: '1',
  })
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [measurementDrafts, setMeasurementDrafts] = useState<Record<string, { actual: string; date: string; note: string }>>({})
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false)

  const sortedKpis = useMemo(() => {
    return [...setupData.kpis].sort((a, b) => {
      if (a.perspective === b.perspective) return a.name.localeCompare(b.name)
      return a.perspective.localeCompare(b.perspective)
    })
  }, [setupData.kpis])

  const metricCatalog = useMemo(() => buildOperationalMetricCatalog(initialData), [initialData])
  const kpiCoverage = useMemo(() => {
    return analyzeBscKpiCoverage(
      sortedKpis.map((kpi) => ({
        id: kpi.id,
        perspective: kpi.perspective,
        name: kpi.name,
        formula_key: kpi.formula_key || null,
      })),
      metricCatalog
    )
  }, [sortedKpis, metricCatalog])

  const unmappedByPerspective = useMemo(() => {
    const grouped = {
      FINANCIAL: [] as typeof kpiCoverage.unmapped,
      CUSTOMER: [] as typeof kpiCoverage.unmapped,
      INTERNAL_PROCESS: [] as typeof kpiCoverage.unmapped,
      LEARNING_GROWTH: [] as typeof kpiCoverage.unmapped,
    }
    for (const item of kpiCoverage.unmapped) {
      grouped[item.perspective].push(item)
    }
    return grouped
  }, [kpiCoverage])

  const quickStartSuggestions = useMemo(() => {
    const coveredMetricKeys = new Set(kpiCoverage.measurable.map((item) => item.metric.key))
    const existingNames = new Set(sortedKpis.map((kpi) => normalizeKpiText(kpi.name)).filter(Boolean))
    const existingFormulaKeys = new Set(
      sortedKpis
        .map((kpi) => normalizeKpiText(kpi.formula_key).replace(/\s+/g, '_'))
        .filter(Boolean)
    )

    return PERSPECTIVES.map((perspective) => {
      const suggestions = getPerspectiveSuggestions(perspective, metricCatalog, 3).filter((metric) => {
        const formulaKey = metric.key.split('.').slice(1).join('_')
        return !coveredMetricKeys.has(metric.key)
          && !existingFormulaKeys.has(normalizeKpiText(formulaKey).replace(/\s+/g, '_'))
          && !existingNames.has(normalizeKpiText(metric.label))
      })

      return { perspective, suggestions }
    }).filter((group) => group.suggestions.length > 0)
  }, [kpiCoverage, metricCatalog, sortedKpis])

  const totalActiveKpis = sortedKpis.length
  const quickStartSuggestionCount = quickStartSuggestions.reduce((sum, group) => sum + group.suggestions.length, 0)

  const formatMetricValue = (unit: string | null, value: number) => {
    const numericValue = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
    if (!unit) return String(numericValue)
    if (unit === 'IDR') return formatRupiah(numericValue)
    if (unit === '%') return `${numericValue}%`
    return `${numericValue} ${unit}`
  }

  const perspectiveVisual: Record<
    BSCPerspective,
    {
      title: string
      icon: React.ComponentType<{ size?: number; className?: string }>
      iconWrapClass: string
      scorePillClass: string
      progressClass: string
      cardAccentClass: string
    }
  > = {
    FINANCIAL: {
      title: 'Financial',
      icon: CircleDollarSign,
      iconWrapClass: 'bg-emerald-500 text-white',
      scorePillClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      progressClass: 'bg-emerald-500',
      cardAccentClass: 'hover:border-emerald-200',
    },
    CUSTOMER: {
      title: 'Customer',
      icon: Users,
      iconWrapClass: 'bg-blue-600 text-white',
      scorePillClass: 'bg-blue-50 text-blue-700 border-blue-100',
      progressClass: 'bg-blue-500',
      cardAccentClass: 'hover:border-blue-200',
    },
    INTERNAL_PROCESS: {
      title: 'Internal Process',
      icon: Settings,
      iconWrapClass: 'bg-indigo-600 text-white',
      scorePillClass: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      progressClass: 'bg-indigo-500',
      cardAccentClass: 'hover:border-indigo-200',
    },
    LEARNING_GROWTH: {
      title: 'Learning & Growth',
      icon: BookOpen,
      iconWrapClass: 'bg-rose-600 text-white',
      scorePillClass: 'bg-rose-50 text-rose-700 border-rose-100',
      progressClass: 'bg-rose-500',
      cardAccentClass: 'hover:border-rose-200',
    },
  }

  const getMeasurementDraft = (kpiId: string, fallbackActual: number | null, fallbackDate: string | null) => {
    const existing = measurementDrafts[kpiId]
    if (existing) return existing
    return {
      actual: fallbackActual !== null ? String(fallbackActual) : '',
      date: fallbackDate || todayDate,
      note: '',
    }
  }

  const handleSaveWeights = () => {
    if (!canManageSetup) {
      window.alert('Pilih unit aktif terlebih dahulu untuk mengubah setup Nizameter.')
      return
    }

    startTransition(async () => {
      const result = await saveBSCPerspectiveWeights(orgId, weightDraft, activeBranchId)
      const actionResult = result as ActionOutcome
      if (actionResult.error) {
        window.alert(actionResult.error)
        return
      }
      router.refresh()
    })
  }

  const handleSeedTemplate = () => {
    if (!canManageSetup) {
      window.alert('Pilih unit aktif terlebih dahulu untuk memulai template Nizameter.')
      return
    }

    startTransition(async () => {
      const result = await seedDefaultBSCKpis(orgId, activeBranchId)
      const actionResult = result as ActionOutcome
      if (actionResult.error) {
        window.alert(actionResult.error)
        return
      }
      router.refresh()
    })
  }

  const handleGenerateFromExistingData = () => {
    if (!canManageSetup) {
      window.alert('Pilih unit aktif terlebih dahulu untuk membuat KPI otomatis dari data existing.')
      return
    }

    startTransition(async () => {
      const result = await generateBSCKpisFromExistingData(orgId, activeBranchId)
      const actionResult = result as ActionOutcome & {
        inserted_count?: number
        synced_count?: number
        skipped_count?: number
        warning?: string
        generated?: Array<{
          name: string
          perspective: BSCPerspective
          target_value: number
          unit: string
        }>
      }

      if (actionResult.error) {
        window.alert(actionResult.error)
        return
      }

      const generatedPreview = (actionResult.generated || [])
        .slice(0, 4)
        .map((item) => `- ${item.name} (${perspectiveLabel[item.perspective]}) target awal ${item.target_value} ${item.unit}`)
        .join('\n')

      window.alert(
        `Generator selesai.\n` +
          `KPI baru: ${actionResult.inserted_count || 0}\n` +
          `Nilai awal tersinkron: ${actionResult.synced_count || 0}\n` +
          `Dilewati karena sudah ada: ${actionResult.skipped_count || 0}` +
          (generatedPreview ? `\n\nContoh KPI baru:\n${generatedPreview}` : '') +
          (actionResult.warning ? `\n\nCatatan:\n${actionResult.warning}` : '')
      )
      router.refresh()
    })
  }

  const handleSyncFromExistingData = () => {
    if (!canManageSetup) {
      window.alert('Pilih unit aktif terlebih dahulu untuk sinkron KPI dari data existing.')
      return
    }

    startTransition(async () => {
      const result = await syncBSCKpisFromExistingData(orgId, activeBranchId)
      const actionResult = result as ActionOutcome & {
        synced_count?: number
        measurable_count?: number
        unmapped_count?: number
        unmapped?: Array<{
          kpi_name: string
          perspective: BSCPerspective
          suggestions: Array<{ label: string }>
        }>
      }
      if (actionResult.error) {
        window.alert(actionResult.error)
        return
      }

      const unmappedPreview = (actionResult.unmapped || [])
        .slice(0, 3)
        .map((item) => {
          const suggestion = item.suggestions?.[0]?.label || 'Tidak ada saran'
          return `- ${item.kpi_name} (${item.perspective}) -> saran: ${suggestion}`
        })
        .join('\n')

      window.alert(
        `Sinkron selesai.\n` +
          `KPI tersinkron: ${actionResult.synced_count || 0}\n` +
          `KPI belum punya sumber: ${actionResult.unmapped_count || 0}` +
          (unmappedPreview ? `\n\nContoh saran:\n${unmappedPreview}` : '')
      )
      router.refresh()
    })
  }

  const handleApplySuggestedIndicator = (kpiId: string, metricKey: string) => {
    if (!canManageSetup) {
      window.alert('Pilih unit aktif terlebih dahulu untuk menerapkan indikator.')
      return
    }

    startTransition(async () => {
      const result = await applyBscKpiSuggestedIndicator(orgId, { kpiId, metricKey }, activeBranchId)
      const actionResult = result as ActionOutcome
      if (actionResult.error) {
        window.alert(actionResult.error)
        return
      }
      window.alert('Indikator berhasil dipasang ke KPI. Silakan sinkron data existing untuk isi nilai otomatis.')
      router.refresh()
    })
  }

  const resetKpiForm = () => {
    setKpiForm({
      id: null,
      perspective: 'FINANCIAL',
      name: '',
      unit: '',
      direction: 'HIGHER_BETTER',
      weightPercent: '25',
      targetValue: '1',
    })
  }

  const openEditKpiModal = (kpi: BSCSetupData['kpis'][number]) => {
    setKpiForm({
      id: kpi.id,
      perspective: kpi.perspective,
      name: kpi.name,
      unit: kpi.unit || '',
      direction: kpi.direction,
      weightPercent: String(kpi.weight_percent),
      targetValue: String(kpi.target_value),
    })
    setIsEditModalOpen(true)
  }

  const closeEditKpiModal = () => {
    setIsEditModalOpen(false)
    resetKpiForm()
  }

  const handleSubmitKpi = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canManageSetup) {
      window.alert('Pilih unit aktif terlebih dahulu untuk menyimpan KPI.')
      return
    }

    const isEditing = Boolean(kpiForm.id)

    startTransition(async () => {
      const result = await upsertBSCKPI(
        orgId,
        {
          id: kpiForm.id || undefined,
          perspective: kpiForm.perspective,
          name: kpiForm.name,
          unit: kpiForm.unit || null,
          direction: kpiForm.direction,
          weightPercent: Number(kpiForm.weightPercent),
          targetValue: Number(kpiForm.targetValue),
        },
        activeBranchId
      )
      const actionResult = result as ActionOutcome
      if (actionResult.error) {
        window.alert(actionResult.error)
        return
      }
      if (isEditing) {
        setIsEditModalOpen(false)
      }
      resetKpiForm()
      router.refresh()
    })
  }

  const handleArchiveKpi = (kpiId: string) => {
    if (!canManageSetup) {
      window.alert('Pilih unit aktif terlebih dahulu untuk mengubah KPI.')
      return
    }
    if (!window.confirm('Nonaktifkan KPI ini dari siklus aktif?')) return

    startTransition(async () => {
      const result = await archiveBSCKPI(orgId, kpiId, activeBranchId)
      const actionResult = result as ActionOutcome
      if (actionResult.error) {
        window.alert(actionResult.error)
        return
      }
      router.refresh()
    })
  }

  const handleSaveMeasurement = (kpiId: string, fallbackActual: number | null, fallbackDate: string | null) => {
    if (!canManageSetup) {
      window.alert('Pilih unit aktif terlebih dahulu untuk mengukur KPI.')
      return
    }
    const draft = getMeasurementDraft(kpiId, fallbackActual, fallbackDate)

    startTransition(async () => {
      const result = await recordBSCKPIMeasurement(
        orgId,
        {
          kpiId,
          actualValue: Number(draft.actual),
          measurementDate: draft.date,
          note: draft.note || null,
        },
        activeBranchId
      )
      const actionResult = result as ActionOutcome
      if (actionResult.error) {
        window.alert(actionResult.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Nizameter</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {setupData.cycle?.cycle_name || `Nizameter ${setupData.scope.cycle_key}`} · {setupData.scope.start_date} – {setupData.scope.end_date}
            {activeBranchName && <span className="ml-2 text-blue-500">· {scopeLabel}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-sm font-bold text-emerald-700">
            {setupData.summary.overall_score_100}/100
          </span>
          <span className="px-3 py-1.5 rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
            {setupData.summary.completion_percent}% terukur
          </span>
          <button
            type="button"
            onClick={handleSyncFromExistingData}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            <RefreshCcw size={12} /> Refresh
          </button>
          <button
            type="button"
            onClick={handleGenerateFromExistingData}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold disabled:opacity-50"
          >
            <Zap size={12} /> Generate KPI
          </button>
          <button
            type="button"
            onClick={() => setShowAdvancedSetup((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <Settings size={12} /> Setup
          </button>
        </div>
      </div>

      {setupData.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {setupData.error}
        </div>
      )}
      {!canManageSetup && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Mode baca. Pilih unit aktif untuk mengubah setup Nizameter.
        </div>
      )}

      {/* 4 Perspective Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {PERSPECTIVES.map((perspective) => {
          const visual = perspectiveVisual[perspective]
          const Icon = visual.icon
          const perspectiveKpis = sortedKpis.filter((kpi) => kpi.perspective === perspective)
          const measuredCount = perspectiveKpis.filter((kpi) => Boolean(kpi.latest_measurement)).length
          const perspectiveSummary = setupData.summary.perspective_scores[perspective]
          const coveragePercent = perspectiveSummary.kpi_count > 0
            ? Math.round((measuredCount / perspectiveSummary.kpi_count) * 100)
            : 0

          return (
            <div key={perspective} className={`bg-white rounded-2xl p-5 border border-slate-100 shadow-sm transition-all ${visual.cardAccentClass}`}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${visual.iconWrapClass}`}>
                  <Icon size={17} />
                </div>
                <p className="text-sm font-semibold text-slate-800 leading-tight">{visual.title}</p>
              </div>
              <p className="text-3xl font-black text-slate-900 leading-none">
                {perspectiveSummary.score_100}
                <span className="text-base font-medium text-slate-300">/100</span>
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${visual.progressClass}`}
                  style={{ width: `${Math.max(0, Math.min(100, perspectiveSummary.score_100))}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {perspectiveSummary.kpi_count} KPI · {coveragePercent}% terukur
              </p>
            </div>
          )
        })}
      </div>

      {/* KPI Table */}
      {sortedKpis.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 px-8 py-12 text-center">
          <p className="text-sm text-slate-400">
            Belum ada KPI. Klik <span className="font-semibold text-slate-600">Generate KPI</span> untuk mulai.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{sortedKpis.length} KPI Aktif</p>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
              <span>Actual</span>
              <span>Tanggal</span>
              <span className="w-10 text-right">Skor</span>
              <span className="w-14" />
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {sortedKpis.map((kpi) => {
              const draft = getMeasurementDraft(
                kpi.id,
                kpi.latest_measurement ? Number(kpi.latest_measurement.actual_value) : null,
                kpi.latest_measurement?.measurement_date || null
              )
              const visual = perspectiveVisual[kpi.perspective]

              return (
                <div key={kpi.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${visual.progressClass}`} />
                      <p className="text-sm font-semibold text-slate-900 truncate">{kpi.name}</p>
                      {kpi.source_type === 'AUTO' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                          AUTO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 ml-4">
                      Target {kpi.target_value}{kpi.unit ? ` ${kpi.unit}` : ''} · Bobot {kpi.weight_percent}%
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      value={draft.actual}
                      onChange={(event) =>
                        setMeasurementDrafts((prev) => ({ ...prev, [kpi.id]: { ...draft, actual: event.target.value } }))
                      }
                      className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-bold text-slate-800 outline-none text-right focus:border-blue-400"
                      placeholder="0"
                    />
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(event) =>
                        setMeasurementDrafts((prev) => ({ ...prev, [kpi.id]: { ...draft, date: event.target.value } }))
                      }
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        handleSaveMeasurement(
                          kpi.id,
                          kpi.latest_measurement ? Number(kpi.latest_measurement.actual_value) : null,
                          kpi.latest_measurement?.measurement_date || null
                        )
                      }
                      className="p-1.5 rounded-lg bg-slate-900 text-white disabled:opacity-50"
                      title="Simpan pengukuran"
                    >
                      <Save size={13} />
                    </button>
                  </div>

                  <div className="text-right w-10 shrink-0">
                    {kpi.latest_measurement ? (
                      <>
                        <p className="text-sm font-black text-slate-900">{kpi.latest_measurement.score_100}</p>
                        <p className="text-[10px] text-slate-400">{kpi.latest_measurement.achievement_percent}%</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-200 font-medium">—</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditKpiModal(kpi)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      title="Edit KPI"
                    >
                      <Settings size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchiveKpi(kpi.id)}
                      className="p-1.5 rounded-lg border border-rose-100 text-rose-300 hover:bg-rose-50 hover:text-rose-600"
                      title="Nonaktifkan"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Advanced Setup - collapsible */}
      {showAdvancedSetup && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Bobot Perspektif</p>
              <button
                type="button"
                onClick={handleSaveWeights}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
              >
                <Save size={12} /> Simpan
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(weightDraft) as BSCPerspective[]).map((perspective) => (
                <label key={perspective} className="space-y-1">
                  <span className="text-xs text-slate-400 font-medium">{perspectiveLabel[perspective]}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weightDraft[perspective]}
                    onChange={(event) =>
                      setWeightDraft((prev) => ({ ...prev, [perspective]: Number(event.target.value || 0) }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Total: {(Object.values(weightDraft).reduce((sum, value) => sum + Number(value || 0), 0)).toFixed(0)}%
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Tambah KPI Manual</p>
              <button
                type="button"
                onClick={handleSeedTemplate}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-50"
              >
                Isi Template
              </button>
            </div>
            <form onSubmit={handleSubmitKpi} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Perspektif</span>
                  <select
                    value={kpiForm.perspective}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, perspective: event.target.value as BSCPerspective }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  >
                    {PERSPECTIVES.map((perspective) => (
                      <option key={perspective} value={perspective}>{perspectiveLabel[perspective]}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Arah</span>
                  <select
                    value={kpiForm.direction}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, direction: event.target.value as BSCDirection }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="HIGHER_BETTER">↑ Lebih tinggi lebih baik</option>
                    <option value="LOWER_BETTER">↓ Lebih rendah lebih baik</option>
                  </select>
                </label>
              </div>
              <input
                value={kpiForm.name}
                onChange={(event) => setKpiForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nama KPI"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  value={kpiForm.targetValue}
                  onChange={(event) => setKpiForm((prev) => ({ ...prev, targetValue: event.target.value }))}
                  placeholder="Target"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                />
                <input
                  type="number"
                  value={kpiForm.weightPercent}
                  onChange={(event) => setKpiForm((prev) => ({ ...prev, weightPercent: event.target.value }))}
                  placeholder="Bobot %"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                />
                <input
                  value={kpiForm.unit}
                  onChange={(event) => setKpiForm((prev) => ({ ...prev, unit: event.target.value }))}
                  placeholder="Satuan"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Plus size={13} /> Tambah KPI
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && kpiForm.id && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-100 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-slate-900">Edit KPI</p>
              <button
                type="button"
                onClick={closeEditKpiModal}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitKpi} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Perspektif</span>
                  <select
                    value={kpiForm.perspective}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, perspective: event.target.value as BSCPerspective }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  >
                    {PERSPECTIVES.map((perspective) => (
                      <option key={perspective} value={perspective}>{perspectiveLabel[perspective]}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Arah</span>
                  <select
                    value={kpiForm.direction}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, direction: event.target.value as BSCDirection }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="HIGHER_BETTER">↑ Lebih tinggi lebih baik</option>
                    <option value="LOWER_BETTER">↓ Lebih rendah lebih baik</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="text-xs text-slate-400 font-medium">Nama KPI</span>
                <input
                  value={kpiForm.name}
                  onChange={(event) => setKpiForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Contoh: Net Profit Margin"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                />
              </label>

              <div className="grid grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Target</span>
                  <input
                    type="number"
                    value={kpiForm.targetValue}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, targetValue: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Bobot (%)</span>
                  <input
                    type="number"
                    value={kpiForm.weightPercent}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, weightPercent: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Satuan</span>
                  <input
                    value={kpiForm.unit}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, unit: event.target.value }))}
                    placeholder="%, days"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeEditKpiModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <Save size={13} /> Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
