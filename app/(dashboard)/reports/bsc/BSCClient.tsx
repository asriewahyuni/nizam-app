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
  saveBSCPerspectiveWeights,
  upsertBSCKPI,
  archiveBSCKPI,
  recordBSCKPIMeasurement,
  seedDefaultBSCKpis,
  syncBSCKpisFromExistingData,
  applyBscKpiSuggestedIndicator,
} from '@/modules/accounting/actions/bsc.actions'
import { analyzeBscKpiCoverage, buildOperationalMetricCatalog } from '@/modules/accounting/lib/bsc-kpi-mapping'

type BSCPerspective = 'FINANCIAL' | 'CUSTOMER' | 'INTERNAL_PROCESS' | 'LEARNING_GROWTH'
type BSCDirection = 'HIGHER_BETTER' | 'LOWER_BETTER'

type BSCWeightMap = Record<BSCPerspective, number>

const PERSPECTIVES: BSCPerspective[] = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH']

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
    targetValue: '0',
  })
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [measurementDrafts, setMeasurementDrafts] = useState<Record<string, { actual: string; date: string; note: string }>>({})

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

  const perspectiveKpiMap = useMemo(() => {
    const grouped: Record<BSCPerspective, typeof sortedKpis> = {
      FINANCIAL: [],
      CUSTOMER: [],
      INTERNAL_PROCESS: [],
      LEARNING_GROWTH: [],
    }
    for (const kpi of sortedKpis) {
      grouped[kpi.perspective].push(kpi)
    }
    return grouped
  }, [sortedKpis])

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
  }, [kpiCoverage.unmapped])

  const totalActiveKpis = sortedKpis.length
  const measuredActiveKpis = sortedKpis.filter((kpi) => Boolean(kpi.latest_measurement)).length

  const formatMetricValue = (unit: string, value: number) => {
    const numericValue = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
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

  const getScoreStatus = (score100: number) => {
    if (score100 >= 85) {
      return { label: 'On Track', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' }
    }
    if (score100 >= 70) {
      return { label: 'Perlu Akselerasi', className: 'bg-amber-50 text-amber-700 border-amber-100' }
    }
    return { label: 'Perhatian', className: 'bg-rose-50 text-rose-700 border-rose-100' }
  }

  const formatKpiValue = (value: number, unit: string | null) => {
    const parsed = Math.round((Number(value) || 0) * 100) / 100
    if (!unit) return String(parsed)
    if (unit === '%') return `${parsed}%`
    if (unit.toUpperCase() === 'IDR') return formatRupiah(parsed)
    return `${parsed} ${unit}`
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
      window.alert('Pilih unit aktif terlebih dahulu untuk mengubah setup BSC.')
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
      window.alert('Pilih unit aktif terlebih dahulu untuk memulai template BSC.')
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
      targetValue: '0',
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
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-1000">
      
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-blue-600 font-black tracking-widest text-xs uppercase bg-blue-50 w-fit px-4 py-2 rounded-full border border-blue-100 mb-2">
           <BarChart3 size={14} />
           Performance Navigation · Live Data
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Balanced Scorecard (BSC)</h1>
        <p className="text-slate-500 font-medium text-lg italic opacity-80">4 Perspektif strategis — semua dari data operasional real-time.</p>
      </div>

      <div className="bg-white rounded-[36px] border border-slate-100 shadow-sm p-8 space-y-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Card Utama</p>
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm font-black text-slate-700 uppercase tracking-widest">Sementara dikosongkan</p>
          <p className="text-sm text-slate-500 font-medium mt-2">Siap untuk layout utama versi berikutnya.</p>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {PERSPECTIVES.map((perspective) => {
          const visual = perspectiveVisual[perspective]
          const Icon = visual.icon

          return (
            <motion.div
              key={perspective}
              variants={item}
              className={`bg-white rounded-[34px] p-7 border border-slate-100 shadow-sm transition-all ${visual.cardAccentClass}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${visual.iconWrapClass}`}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perspective</p>
                    <h3 className="text-lg font-black text-slate-900">{visual.title}</h3>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Kosong</p>
                <p className="text-xs text-slate-500 font-medium mt-2">Card perspektif ini sementara dikosongkan.</p>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* BSC Setup & Measurement */}
      <div className="space-y-8">
        <div className="bg-white rounded-[36px] border border-slate-100 shadow-sm p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Strategy Workbench</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Setup KPI, Bobot, dan Pengukuran</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Skor internal dihitung dalam skala 0-100, lalu ditampilkan juga sebagai skala 0-4.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleSyncFromExistingData}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                title="Sinkronkan KPI yang punya sumber data existing secara otomatis."
              >
                <Zap size={14} />
                Sinkron Data Existing
              </button>
              <button
                type="button"
                onClick={handleSeedTemplate}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                title="Isi KPI contoh 4 perspektif x 4 indikator agar cepat mulai."
              >
                <RefreshCcw size={14} />
                Isi Template KPI
              </button>
              <div className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${activeBranchName ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                Scope: {scopeLabel}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">Siklus: {setupData.cycle?.cycle_name || `BSC ${setupData.scope.cycle_key}`}</span>
            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">Periode: {setupData.scope.start_date} s/d {setupData.scope.end_date}</span>
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">Score: {setupData.summary.overall_score_100} / 100 ({setupData.summary.overall_score_4} / 4)</span>
            <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">Coverage: {setupData.summary.completion_percent}%</span>
          </div>
          {setupData.error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {setupData.error}
            </div>
          )}
          {!canManageSetup && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Mode read-only. Pilih satu unit aktif jika ingin mengubah setup BSC.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-slate-900">Bobot Perspektif</h4>
              <button
                type="button"
                onClick={handleSaveWeights}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
              >
                <Save size={14} />
                Simpan Bobot
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Object.keys(weightDraft) as BSCPerspective[]).map((perspective) => (
                <label key={perspective} className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{perspectiveLabel[perspective]}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weightDraft[perspective]}
                    onChange={(event) =>
                      setWeightDraft((prev) => ({
                        ...prev,
                        [perspective]: Number(event.target.value || 0),
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-blue-400"
                  />
                </label>
              ))}
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm font-semibold text-slate-600">
              Total bobot: {(Object.values(weightDraft).reduce((sum, value) => sum + Number(value || 0), 0)).toFixed(2)}%
            </div>
            <button
              type="button"
              onClick={handleSeedTemplate}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
            >
              <RefreshCcw size={14} />
              Isi Template KPI 4x4
            </button>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-slate-900">Tambah KPI</h4>
            </div>
            <form onSubmit={handleSubmitKpi} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perspektif</span>
                  <select
                    value={kpiForm.perspective}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, perspective: event.target.value as BSCPerspective }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  >
                    {PERSPECTIVES.map((perspective) => (
                      <option key={perspective} value={perspective}>
                        {perspectiveLabel[perspective]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Arah KPI</span>
                  <select
                    value={kpiForm.direction}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, direction: event.target.value as BSCDirection }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="HIGHER_BETTER">Semakin tinggi semakin baik</option>
                    <option value="LOWER_BETTER">Semakin rendah semakin baik</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nama KPI</span>
                <input
                  value={kpiForm.name}
                  onChange={(event) => setKpiForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  placeholder="Contoh: Net Profit Margin"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target</span>
                  <input
                    type="number"
                    value={kpiForm.targetValue}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, targetValue: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bobot KPI (%)</span>
                  <input
                    type="number"
                    value={kpiForm.weightPercent}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, weightPercent: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Satuan</span>
                  <input
                    value={kpiForm.unit}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, unit: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                    placeholder="%, days, docs"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
              >
                <Plus size={14} />
                Tambah KPI
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-black text-slate-900">Audit Sinkron KPI vs Data Existing</h4>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Menandai KPI yang sudah bisa diukur otomatis dan KPI yang belum punya sumber data saat ini.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">
                Terukur: {kpiCoverage.measurable.length}
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700">
                Belum Ada Sumber: {kpiCoverage.unmapped.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Data Yang Bisa Diukur KPI-nya</p>
              {kpiCoverage.measurable.length === 0 ? (
                <p className="text-sm font-semibold text-emerald-800">Belum ada KPI yang match dengan data existing.</p>
              ) : (
                <div className="space-y-2">
                  {kpiCoverage.measurable.map((item) => (
                    <div key={item.kpi_id} className="rounded-2xl border border-emerald-100 bg-white p-3">
                      <p className="text-xs font-black text-slate-900">{item.kpi_name}</p>
                      <p className="text-[11px] font-semibold text-slate-600 mt-1">
                        Sumber: {item.metric.label} ({item.metric.key}) · Nilai sekarang: {formatMetricValue(item.metric.unit, item.metric.value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-amber-100 bg-amber-50/60 p-5 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">KPI Yang Belum Punya Sumber Data</p>
              {kpiCoverage.unmapped.length === 0 ? (
                <p className="text-sm font-semibold text-emerald-700">Semua KPI aktif sudah punya sumber data.</p>
              ) : (
                <div className="space-y-4">
                  {PERSPECTIVES.filter((perspective) => unmappedByPerspective[perspective].length > 0).map((perspective) => (
                    <div key={perspective} className="rounded-2xl border border-amber-100 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                          {perspectiveLabel[perspective]}
                        </p>
                        <span className="px-2 py-1 rounded-md bg-amber-50 border border-amber-100 text-[10px] font-black text-amber-700">
                          {unmappedByPerspective[perspective].length} KPI
                        </span>
                      </div>

                      <div className="space-y-2">
                        {unmappedByPerspective[perspective].map((item) => (
                          <div key={item.kpi_id} className="rounded-xl border border-amber-100 bg-amber-50/40 p-2">
                            <p className="text-xs font-black text-slate-900">{item.kpi_name}</p>
                            <p className="text-[11px] font-semibold text-amber-700 mt-1">
                              Saran dari data yang ada:
                            </p>
                            <div className="mt-2 space-y-2">
                              {item.suggestions.map((suggestion) => (
                                <div
                                  key={`${item.kpi_id}-${suggestion.key}`}
                                  className="rounded-lg bg-amber-50 border border-amber-100 p-2 space-y-1"
                                >
                                  <p className="text-[10px] font-bold text-amber-900">
                                    {suggestion.label}: {formatMetricValue(suggestion.unit, suggestion.value)}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {suggestion.references.map((reference) => (
                                      <Link
                                        key={`${item.kpi_id}-${suggestion.key}-${reference.path}`}
                                        href={reference.path}
                                        className="inline-flex items-center rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 hover:bg-amber-100 transition-colors"
                                      >
                                        {reference.label}
                                      </Link>
                                    ))}
                                    <button
                                      type="button"
                                      disabled={isPending}
                                      onClick={() => handleApplySuggestedIndicator(item.kpi_id, suggestion.key)}
                                      className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-60"
                                    >
                                      Pakai Indikator Ini
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 space-y-5">
          <h4 className="text-lg font-black text-slate-900">Daftar KPI Aktif</h4>
          {sortedKpis.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center space-y-2">
              <p className="text-sm font-black text-slate-700 uppercase tracking-widest">Belum ada KPI di siklus ini</p>
              <p className="text-sm text-slate-500 font-medium">Gunakan form di atas atau klik tombol template 4x4 untuk mulai cepat.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedKpis.map((kpi) => {
                const draft = getMeasurementDraft(
                  kpi.id,
                  kpi.latest_measurement ? Number(kpi.latest_measurement.actual_value) : null,
                  kpi.latest_measurement?.measurement_date || null
                )
                return (
                  <div key={kpi.id} className="rounded-3xl border border-slate-200 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {perspectiveLabel[kpi.perspective]} · {kpi.code}
                        </p>
                        <h5 className="text-base font-black text-slate-900">{kpi.name}</h5>
                        <p className="text-xs text-slate-500 font-medium">
                          Target {kpi.target_value} {kpi.unit || ''} · Bobot {kpi.weight_percent}% · {kpi.direction === 'HIGHER_BETTER' ? 'Higher better' : 'Lower better'}
                        </p>
                        <div className="mt-2">
                          <span
                            className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${
                              kpi.source_type === 'AUTO'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            Source: {kpi.source_type === 'AUTO' ? 'AUTO' : 'MANUAL'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditKpiModal(kpi)}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchiveKpi(kpi.id)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-black uppercase tracking-wider text-rose-700"
                        >
                          <Trash2 size={12} />
                          Nonaktifkan
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-end">
                      <label className="space-y-1 lg:col-span-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actual</span>
                        <input
                          type="number"
                          value={draft.actual}
                          onChange={(event) =>
                            setMeasurementDrafts((prev) => ({
                              ...prev,
                              [kpi.id]: { ...draft, actual: event.target.value },
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                        />
                      </label>
                      <label className="space-y-1 lg:col-span-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</span>
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(event) =>
                            setMeasurementDrafts((prev) => ({
                              ...prev,
                              [kpi.id]: { ...draft, date: event.target.value },
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                        />
                      </label>
                      <label className="space-y-1 lg:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catatan</span>
                        <input
                          value={draft.note}
                          onChange={(event) =>
                            setMeasurementDrafts((prev) => ({
                              ...prev,
                              [kpi.id]: { ...draft, note: event.target.value },
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                          placeholder="Opsional"
                        />
                      </label>
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
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                      >
                        <Save size={13} />
                        Simpan
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold">
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-slate-600">
                        Achievement: {kpi.latest_measurement ? `${kpi.latest_measurement.achievement_percent}%` : '-'}
                      </div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-slate-600">
                        Score 100: {kpi.latest_measurement ? kpi.latest_measurement.score_100 : '-'}
                      </div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-slate-600">
                        Score 4: {kpi.latest_measurement ? kpi.latest_measurement.score_4 : '-'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {isEditModalOpen && kpiForm.id && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[32px] bg-white border border-slate-100 shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Popup Edit KPI</p>
                <h4 className="text-xl font-black text-slate-900">Ubah KPI Aktif</h4>
              </div>
              <button
                type="button"
                onClick={closeEditKpiModal}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-600"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleSubmitKpi} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perspektif</span>
                  <select
                    value={kpiForm.perspective}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, perspective: event.target.value as BSCPerspective }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  >
                    {PERSPECTIVES.map((perspective) => (
                      <option key={perspective} value={perspective}>
                        {perspectiveLabel[perspective]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Arah KPI</span>
                  <select
                    value={kpiForm.direction}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, direction: event.target.value as BSCDirection }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="HIGHER_BETTER">Semakin tinggi semakin baik</option>
                    <option value="LOWER_BETTER">Semakin rendah semakin baik</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1 block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nama KPI</span>
                <input
                  value={kpiForm.name}
                  onChange={(event) => setKpiForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  placeholder="Contoh: Net Profit Margin"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target</span>
                  <input
                    type="number"
                    value={kpiForm.targetValue}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, targetValue: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bobot KPI (%)</span>
                  <input
                    type="number"
                    value={kpiForm.weightPercent}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, weightPercent: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Satuan</span>
                  <input
                    value={kpiForm.unit}
                    onChange={(event) => setKpiForm((prev) => ({ ...prev, unit: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                    placeholder="%, days, docs"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditKpiModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
                >
                  <Save size={14} />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
