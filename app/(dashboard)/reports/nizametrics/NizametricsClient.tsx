'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BarChart3, CircleDollarSign, Users, Settings,
  Save, Plus, Trash2, RefreshCcw, Zap,
  Lock, LockOpen, Star, Lightbulb,
  ChevronDown, ChevronUp, ShoppingCart,
  CheckCircle2, AlertCircle, BookOpen, X, Pencil,
  ListTodo,
} from 'lucide-react'
import { formatRupiah, getDateInTimeZone } from '@/lib/utils'
import {
  buildOperationalMetricCatalog,
  analyzeBscKpiCoverage,
  getPerspectiveSuggestions,
  type BSCOperationalMetric,
  type BSCOperationalMetricKey,
} from '@/modules/accounting/lib/bsc-kpi-mapping'
import {
  saveBSCPerspectiveWeights,
  upsertBSCKPI,
  archiveBSCKPI,
  recordBSCKPIMeasurement,
  generateBSCKpisFromExistingData,
  syncBSCKpisFromExistingData,
  applyBscKpiSuggestedIndicator,
  seedDefaultBSCKpis,
  lockBSCCycle,
  unlockBSCCycle,
  type BSCPerspective,
  type BSCDirection,
  type BSCWeightMap,
  type BSCSetupPayload,
  type BSCKPIItem,
} from '@/modules/accounting/actions/bsc.actions'

// ─── Types ──────────────────────────────────────────────────────────────────

type BSCSetupData = BSCSetupPayload

export interface NizametricsClientProps {
  orgId: string
  activeBranchId: string | null
  activeBranchName: string | null
  allowAllBranchSelection: boolean
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

// ─── Domain Config ───────────────────────────────────────────────────────────

const PERSPECTIVES: BSCPerspective[] = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH']

const LOWER_BETTER_FORMULA_KEYS = new Set<BSCOperationalMetricKey>([
  'financial.operating_expense_ratio',
  'financial.current_expenses',
  'internal.draft_document_backlog',
  'internal.pending_purchases',
  'internal.pending_sales',
  'internal.overdue_depreciation',
])

type DomainConfig = {
  domainLabel: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: { bg: string; text: string; border: string; progress: string; accent: string; button: string }
  ikhtiyyar: {
    label: string
    ikhtiyyarFormulaKey: string
    getValue: (data: NizametricsClientProps['initialData']) => number
    unit: string
    targetDefault: number
    direction: BSCDirection
  }
}

const DOMAIN_CONFIG: Record<BSCPerspective, DomainConfig> = {
  FINANCIAL: {
    domainLabel: 'Finance',
    icon: CircleDollarSign,
    color: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', progress: 'bg-emerald-500', accent: 'border-emerald-100', button: 'bg-emerald-600 hover:bg-emerald-700' },
    ikhtiyyar: {
      label: 'Net Profit Margin',
      ikhtiyyarFormulaKey: 'net_profit_margin',
      getValue: (d) => d.financial.profitMargin,
      unit: '%',
      targetDefault: 15,
      direction: 'HIGHER_BETTER',
    },
  },
  CUSTOMER: {
    domainLabel: 'Marketing',
    icon: ShoppingCart,
    color: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', progress: 'bg-blue-500', accent: 'border-blue-100', button: 'bg-blue-600 hover:bg-blue-700' },
    ikhtiyyar: {
      label: 'Avg Order Value',
      ikhtiyyarFormulaKey: 'mtd_sales',
      getValue: (d) => d.customer.totalOrders > 0 ? d.customer.mtdSales / d.customer.totalOrders : 0,
      unit: 'IDR',
      targetDefault: 1_000_000,
      direction: 'HIGHER_BETTER',
    },
  },
  INTERNAL_PROCESS: {
    domainLabel: 'Operasional',
    icon: Settings,
    color: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', progress: 'bg-indigo-500', accent: 'border-indigo-100', button: 'bg-indigo-600 hover:bg-indigo-700' },
    ikhtiyyar: {
      label: 'Draft Backlog',
      ikhtiyyarFormulaKey: 'draft_document_backlog',
      getValue: (d) => d.internal.pendingPurchases + d.internal.pendingSales,
      unit: 'docs',
      targetDefault: 5,
      direction: 'LOWER_BETTER',
    },
  },
  LEARNING_GROWTH: {
    domainLabel: 'HR',
    icon: Users,
    color: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', progress: 'bg-rose-500', accent: 'border-rose-100', button: 'bg-rose-600 hover:bg-rose-700' },
    ikhtiyyar: {
      label: 'HR Completion Rate',
      ikhtiyyarFormulaKey: 'hr_completion_rate',
      getValue: (d) => d.learning.hrCompletionRate,
      unit: '%',
      targetDefault: 95,
      direction: 'HIGHER_BETTER',
    },
  },
}

// ─── Todo & Plan Types ───────────────────────────────────────────────────────

type TodoPriority = 'high' | 'medium' | 'low'
type TodoItem = { priority: TodoPriority; text: string }

type PlanItem = {
  id: string
  text: string
  perspective: BSCPerspective
  priority: TodoPriority
  done: boolean
}

function genId() {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const PRIORITY_COLORS: Record<TodoPriority, { dot: string; label: string; ring: string }> = {
  high:   { dot: 'bg-rose-500',   label: 'Tinggi', ring: 'ring-rose-200' },
  medium: { dot: 'bg-amber-400',  label: 'Sedang', ring: 'ring-amber-200' },
  low:    { dot: 'bg-slate-300',  label: 'Rendah', ring: 'ring-slate-200' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatValue(unit: string | null | undefined, value: number): string {
  const v = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
  if (!unit) return String(v)
  if (unit === 'IDR') return formatRupiah(v)
  if (unit === '%') return `${v}%`
  return `${v} ${unit}`
}

function inferTargetForMetric(metricKey: BSCOperationalMetricKey, currentValue: number): number {
  const targets: Partial<Record<BSCOperationalMetricKey, number>> = {
    'financial.net_profit_margin': 15,
    'financial.revenue_growth': 10,
    'financial.operating_expense_ratio': 35,
    'internal.draft_document_backlog': 5,
    'internal.pending_purchases': 3,
    'internal.pending_sales': 3,
    'internal.overdue_depreciation': 0,
    'learning.hr_completion_rate': 95,
  }
  if (targets[metricKey] !== undefined) return targets[metricKey]!
  const isLower = LOWER_BETTER_FORMULA_KEYS.has(metricKey)
  if (currentValue <= 0) return isLower ? 10 : 1
  return isLower ? Math.max(1, Math.round(currentValue * 0.9)) : Math.max(1, Math.round(currentValue * 1.1))
}

function buildTodoList(
  perspective: BSCPerspective,
  ikhtiyyarValue: number,
  ikhtiyyarTarget: number,
  direction: BSCDirection,
  ikhtiyyarLabel: string,
  ikhtiyyarUnit: string,
  kpis: BSCKPIItem[],
  data: NizametricsClientProps['initialData']
): TodoItem[] {
  const todos: TodoItem[] = []
  const gap = direction === 'HIGHER_BETTER'
    ? ikhtiyyarTarget - ikhtiyyarValue
    : ikhtiyyarValue - ikhtiyyarTarget
  const isOnTarget = gap <= 0
  const gapPct = ikhtiyyarTarget !== 0 ? (Math.abs(gap) / Math.abs(ikhtiyyarTarget)) * 100 : 0

  if (perspective === 'FINANCIAL') {
    if (!isOnTarget) {
      const priority: TodoPriority = gapPct > 20 ? 'high' : gapPct > 10 ? 'medium' : 'low'
      todos.push({ priority, text: `Tingkatkan Net Profit Margin dari ${ikhtiyyarValue.toFixed(1)}% → ${ikhtiyyarTarget}%: review beban operasional & harga jual.` })
    } else {
      todos.push({ priority: 'low', text: 'Margin sudah on-target — pertahankan dengan monitoring jurnal mingguan.' })
    }
    if (data.financial.currentExpenses > data.financial.currentRevenue * 0.5) {
      todos.push({ priority: 'high', text: 'Pengeluaran > 50% pendapatan — identifikasi beban terbesar dan cari efisiensi.' })
    }
    if (data.financial.revenueGrowth < 5) {
      todos.push({ priority: 'medium', text: 'Pertumbuhan pendapatan rendah — pertimbangkan ekspansi produk atau segmen baru.' })
    }
  } else if (perspective === 'CUSTOMER') {
    const aov = data.customer.totalOrders > 0 ? data.customer.mtdSales / data.customer.totalOrders : 0
    if (!isOnTarget) {
      const priority: TodoPriority = gapPct > 30 ? 'high' : gapPct > 15 ? 'medium' : 'low'
      todos.push({ priority, text: `Naikkan AOV dari ${formatValue('IDR', aov)} → ${formatValue('IDR', ikhtiyyarTarget)}: coba bundling atau program upsell.` })
    } else {
      todos.push({ priority: 'low', text: 'AOV on-target — pertahankan dengan program loyalitas pelanggan.' })
    }
    if (data.customer.totalOrders < 10) {
      todos.push({ priority: 'high', text: 'Volume pesanan rendah — jalankan kampanye akuisisi pelanggan baru bulan ini.' })
    } else {
      todos.push({ priority: 'medium', text: 'Fokus retensi pelanggan aktif — follow-up pasca pembelian & repeat order.' })
    }
  } else if (perspective === 'INTERNAL_PROCESS') {
    const backlog = data.internal.pendingPurchases + data.internal.pendingSales
    if (!isOnTarget) {
      const priority: TodoPriority = gapPct > 50 ? 'high' : gapPct > 20 ? 'medium' : 'low'
      todos.push({ priority, text: `Kurangi Draft Backlog ${backlog} → ≤${ikhtiyyarTarget} docs: tuntaskan PO & SO yang tertunda.` })
    } else {
      todos.push({ priority: 'low', text: 'Draft Backlog on-target — pertahankan kedisiplinan penyelesaian dokumen.' })
    }
    if (data.internal.pendingPurchases > 5) {
      todos.push({ priority: 'medium', text: `${data.internal.pendingPurchases} PO/draft pembelian belum selesai — tetapkan PIC per dokumen.` })
    }
    if (data.internal.overdueDepreciation > 0) {
      todos.push({ priority: 'high', text: `${data.internal.overdueDepreciation} aset terlambat penyusutan — jalankan rekonsiliasi aset segera.` })
    }
  } else if (perspective === 'LEARNING_GROWTH') {
    if (!isOnTarget) {
      const priority: TodoPriority = gapPct > 20 ? 'high' : gapPct > 10 ? 'medium' : 'low'
      todos.push({ priority, text: `HR Completion Rate ${ikhtiyyarValue.toFixed(0)}% → target ${ikhtiyyarTarget}%: pastikan semua payroll run selesai tepat waktu.` })
    } else {
      todos.push({ priority: 'low', text: 'HR Completion Rate on-target — pertahankan siklus penggajian rutin.' })
    }
    if (data.learning.activeEmployees === 0) {
      todos.push({ priority: 'high', text: 'Belum ada karyawan aktif — setup data karyawan di modul HR.' })
    } else if (data.learning.payrollRunsCompleted === 0) {
      todos.push({ priority: 'high', text: 'Belum ada payroll run selesai bulan ini — jalankan siklus penggajian.' })
    } else {
      todos.push({ priority: 'low', text: `${data.learning.activeEmployees} karyawan aktif — lengkapi data kehadiran & evaluasi periode ini.` })
    }
  }

  // Shared: unmeasured KPIs
  const unmeasured = kpis.filter((k) => !k.latest_measurement)
  if (unmeasured.length > 0) {
    todos.push({ priority: 'medium', text: `${unmeasured.length} parameter KPI belum ada pengukuran — isi sebelum akhir bulan.` })
  }

  return todos.slice(0, 4)
}

function buildRecommendations(
  kpis: BSCKPIItem[],
  ikhtiyyarValue: number,
  ikhtiyyarTarget: number,
  direction: BSCDirection,
  ikhtiyyarLabel: string,
  isLocked: boolean,
  uncoveredMetrics: BSCOperationalMetric[]
): string[] {
  const recs: string[] = []
  const gap = direction === 'HIGHER_BETTER'
    ? ikhtiyyarTarget - ikhtiyyarValue
    : ikhtiyyarValue - ikhtiyyarTarget

  if (gap > 0) {
    const gapStr = direction === 'HIGHER_BETTER' && ikhtiyyarTarget >= 50
      ? `${gap.toFixed(1)}pp`
      : formatValue(direction === 'HIGHER_BETTER' && ikhtiyyarTarget < 100 ? '%' : null, gap)
    recs.push(`${ikhtiyyarLabel} masih ${gapStr} dari target. Ukhtiyyar ini jadi prioritas bulan ini.`)
  }

  if (isLocked) {
    const unmeasured = kpis.filter((k) => !k.latest_measurement)
    if (unmeasured.length > 0) {
      recs.push(`${unmeasured.length} parameter belum ada pengukuran — segera isi sebelum bulan berakhir.`)
    }
  } else if (uncoveredMetrics.length > 0) {
    const m = uncoveredMetrics[0]
    recs.push(`Data tersedia: ${m.label} (${formatValue(m.unit, m.value)}) — pertimbangkan tambah sebagai parameter.`)
  }

  return recs
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function NizametricsClient({
  orgId,
  activeBranchId = null,
  activeBranchName = null,
  allowAllBranchSelection = false,
  initialData,
  setupData,
}: NizametricsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const todayDate = getDateInTimeZone('Asia/Jakarta')

  // ── State ──
  const [ikhtiyyarTargets, setIkhtiyyarTargets] = useState<Record<BSCPerspective, number>>({
    FINANCIAL: DOMAIN_CONFIG.FINANCIAL.ikhtiyyar.targetDefault,
    CUSTOMER: DOMAIN_CONFIG.CUSTOMER.ikhtiyyar.targetDefault,
    INTERNAL_PROCESS: DOMAIN_CONFIG.INTERNAL_PROCESS.ikhtiyyar.targetDefault,
    LEARNING_GROWTH: DOMAIN_CONFIG.LEARNING_GROWTH.ikhtiyyar.targetDefault,
  })
  const [ikhtiyyarTargetEditing, setIkhtiyyarTargetEditing] = useState<BSCPerspective | null>(null)
  const [ikhtiyyarTargetDraft, setIkhtiyyarTargetDraft] = useState<string>('')
  const [ikhtiyyarOverrides, setIkhtiyyarOverrides] = useState<Record<BSCPerspective, number | null>>({
    FINANCIAL: null, CUSTOMER: null, INTERNAL_PROCESS: null, LEARNING_GROWTH: null,
  })
  const [ikhtiyyarValueEditing, setIkhtiyyarValueEditing] = useState<BSCPerspective | null>(null)
  const [ikhtiyyarValueDraft, setIkhtiyyarValueDraft] = useState<string>('')
  const [cycleIsLocked, setCycleIsLocked] = useState(setupData.cycle?.status === 'LOCKED')
  const [paramPickerOpen, setParamPickerOpen] = useState<BSCPerspective | null>(null)
  const [measurementDrafts, setMeasurementDrafts] = useState<Record<string, { actual: string; note: string }>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [weightDraft, setWeightDraft] = useState<BSCWeightMap>(setupData.perspectiveWeights)
  const [kpiEditForm, setKpiEditForm] = useState<{
    id: string | null; perspective: BSCPerspective; name: string; unit: string
    direction: BSCDirection; weightPercent: string; targetValue: string
  }>({ id: null, perspective: 'FINANCIAL', name: '', unit: '', direction: 'HIGHER_BETTER', weightPercent: '25', targetValue: '1' })
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // ── Plan state ──
  const [planTitle, setPlanTitle] = useState('Rencana Bulan Ini')
  const [planTitleEditing, setPlanTitleEditing] = useState(false)
  const [planTitleDraft, setPlanTitleDraft] = useState('')
  const [planItems, setPlanItems] = useState<PlanItem[]>([])
  const [planForm, setPlanForm] = useState<{ text: string; perspective: BSCPerspective; priority: TodoPriority }>({
    text: '', perspective: 'FINANCIAL', priority: 'medium',
  })
  const [planExpanded, setPlanExpanded] = useState(true)
  const [kpiTargetEditing, setKpiTargetEditing] = useState<string | null>(null)
  const [kpiTargetDraft, setKpiTargetDraft] = useState('')

  const canManageSetup = Boolean(activeBranchId) || allowAllBranchSelection
  const scopeLabel = activeBranchName || (allowAllBranchSelection ? 'Semua Unit' : '—')

  // ── Derived ──
  const metricCatalog = useMemo(() => buildOperationalMetricCatalog(initialData), [initialData])

  const sortedKpis = useMemo(() =>
    [...setupData.kpis].sort((a, b) => {
      if (a.perspective !== b.perspective) return a.perspective.localeCompare(b.perspective)
      return a.name.localeCompare(b.name)
    }), [setupData.kpis])

  const kpiCoverage = useMemo(() =>
    analyzeBscKpiCoverage(
      sortedKpis.map((k) => ({ id: k.id, perspective: k.perspective, name: k.name, formula_key: k.formula_key || null })),
      metricCatalog
    ), [sortedKpis, metricCatalog])

  const getMeasurementDraft = (kpiId: string, fallbackActual: number | null) => {
    return measurementDrafts[kpiId] ?? {
      actual: fallbackActual !== null ? String(fallbackActual) : '',
      note: '',
    }
  }

  // ── Lock / Unlock ──
  const handleLockCycle = () => {
    if (!canManageSetup) { window.alert('Pilih unit aktif terlebih dahulu.'); return }
    if (sortedKpis.length === 0) {
      window.alert('Tambahkan minimal 1 parameter sebelum mengunci bulan ini.')
      return
    }
    if (!window.confirm('Kunci parameter bulan ini? Setelah dikunci, Anda tidak bisa menambah/menghapus parameter — hanya bisa mengisi pengukuran.')) return
    startTransition(async () => {
      const result = await lockBSCCycle(orgId, activeBranchId) as { error?: string; success?: boolean }
      if (result.error) { window.alert(result.error); return }
      setCycleIsLocked(true)
      router.refresh()
    })
  }

  const handleUnlockCycle = () => {
    if (!canManageSetup) { window.alert('Pilih unit aktif terlebih dahulu.'); return }
    if (!window.confirm('Buka kunci? Anda bisa mengubah parameter lagi, tapi pengukuran yang sudah diisi tidak akan terhapus.')) return
    startTransition(async () => {
      const result = await unlockBSCCycle(orgId, activeBranchId) as { error?: string; success?: boolean }
      if (result.error) { window.alert(result.error); return }
      setCycleIsLocked(false)
      router.refresh()
    })
  }

  // ── Add / Remove Parameter ──
  const handleAddParam = (perspective: BSCPerspective, metricKey: BSCOperationalMetricKey) => {
    if (!canManageSetup) { window.alert('Pilih unit aktif terlebih dahulu.'); return }
    if (cycleIsLocked) { window.alert('Siklus dikunci. Buka kunci dulu untuk menambah parameter.'); return }

    const metric = metricCatalog[metricKey]
    if (!metric) return

    const perspectiveKpis = sortedKpis.filter((k) => k.perspective === perspective)
    const usedWeight = perspectiveKpis.reduce((sum, k) => sum + k.weight_percent, 0)
    const available = Math.max(0, Math.round((100 - usedWeight) * 100) / 100)
    if (available <= 0) {
      window.alert('Bobot perspektif ini sudah 100%. Kurangi bobot parameter lain dulu di Mode Lanjutan.')
      return
    }

    const assignedWeight = Math.min(25, available)

    startTransition(async () => {
      const result = await upsertBSCKPI(orgId, {
        perspective,
        name: metric.label,
        unit: metric.unit,
        direction: LOWER_BETTER_FORMULA_KEYS.has(metricKey) ? 'LOWER_BETTER' : 'HIGHER_BETTER',
        weightPercent: assignedWeight,
        targetValue: inferTargetForMetric(metricKey, metric.value),
        formulaKey: metricKey.split('.').slice(1).join('_'),
        sourceType: 'AUTO',
        baselineValue: metric.value,
      }, activeBranchId) as { error?: string }

      if (result.error) { window.alert(result.error); return }
      setParamPickerOpen(null)
      router.refresh()
    })
  }

  const handleRemoveParam = (kpiId: string) => {
    if (!canManageSetup) { window.alert('Pilih unit aktif terlebih dahulu.'); return }
    if (cycleIsLocked) { window.alert('Siklus dikunci. Buka kunci dulu untuk menghapus parameter.'); return }
    if (!window.confirm('Hapus parameter ini dari bulan ini?')) return
    startTransition(async () => {
      const result = await archiveBSCKPI(orgId, kpiId, activeBranchId) as { error?: string }
      if (result.error) { window.alert(result.error); return }
      router.refresh()
    })
  }

  // ── Measurement ──
  const handleSaveMeasurement = (kpiId: string) => {
    if (!canManageSetup) { window.alert('Pilih unit aktif terlebih dahulu.'); return }
    const draft = getMeasurementDraft(kpiId, null)
    if (!draft.actual) { window.alert('Isi nilai aktual terlebih dahulu.'); return }

    startTransition(async () => {
      const result = await recordBSCKPIMeasurement(orgId, {
        kpiId,
        actualValue: Number(draft.actual),
        measurementDate: todayDate,
        note: draft.note || null,
      }, activeBranchId) as { error?: string }

      if (result.error) { window.alert(result.error); return }
      setMeasurementDrafts((prev) => { const next = { ...prev }; delete next[kpiId]; return next })
      router.refresh()
    })
  }

  // ── Quick Actions ──
  const handleGenerateKpis = () => {
    if (!canManageSetup) { window.alert('Pilih unit aktif terlebih dahulu.'); return }
    if (cycleIsLocked) { window.alert('Siklus dikunci. Buka kunci dulu.'); return }
    startTransition(async () => {
      const result = await generateBSCKpisFromExistingData(orgId, activeBranchId) as {
        error?: string; inserted_count?: number; synced_count?: number; skipped_count?: number
      }
      if (result.error) { window.alert(result.error); return }
      window.alert(`Selesai. KPI baru: ${result.inserted_count || 0} · Tersinkron: ${result.synced_count || 0} · Dilewati: ${result.skipped_count || 0}`)
      router.refresh()
    })
  }

  const handleSyncValues = () => {
    if (!canManageSetup) { window.alert('Pilih unit aktif terlebih dahulu.'); return }
    startTransition(async () => {
      const result = await syncBSCKpisFromExistingData(orgId, activeBranchId) as {
        error?: string; synced_count?: number
      }
      if (result.error) { window.alert(result.error); return }
      window.alert(`Sinkron selesai. ${result.synced_count || 0} KPI diperbarui.`)
      router.refresh()
    })
  }

  // ── Advanced BSC ──
  const handleSaveWeights = () => {
    if (!canManageSetup) { window.alert('Pilih unit aktif.'); return }
    startTransition(async () => {
      const result = await saveBSCPerspectiveWeights(orgId, weightDraft, activeBranchId) as { error?: string }
      if (result.error) { window.alert(result.error); return }
      router.refresh()
    })
  }

  const handleSubmitKpiEdit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canManageSetup) { window.alert('Pilih unit aktif.'); return }
    startTransition(async () => {
      const result = await upsertBSCKPI(orgId, {
        id: kpiEditForm.id || undefined,
        perspective: kpiEditForm.perspective,
        name: kpiEditForm.name,
        unit: kpiEditForm.unit || null,
        direction: kpiEditForm.direction,
        weightPercent: Number(kpiEditForm.weightPercent),
        targetValue: Number(kpiEditForm.targetValue),
      }, activeBranchId) as { error?: string }
      if (result.error) { window.alert(result.error); return }
      setIsEditModalOpen(false)
      setKpiEditForm({ id: null, perspective: 'FINANCIAL', name: '', unit: '', direction: 'HIGHER_BETTER', weightPercent: '25', targetValue: '1' })
      router.refresh()
    })
  }

  // ── Plan handlers ──
  const handleAddPlanItem = () => {
    if (!planForm.text.trim()) return
    const newItem: PlanItem = {
      id: genId(),
      text: planForm.text.trim(),
      perspective: planForm.perspective,
      priority: planForm.priority,
      done: false,
    }
    setPlanItems((prev) => [...prev, newItem])
    setPlanForm((prev) => ({ ...prev, text: '' }))
  }

  const handleTogglePlanItem = (id: string) => {
    setPlanItems((prev) => prev.map((i) => i.id === id ? { ...i, done: !i.done } : i))
  }

  const handleDeletePlanItem = (id: string) => {
    setPlanItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleMovePlanItem = (id: string, perspective: BSCPerspective) => {
    setPlanItems((prev) => prev.map((i) => i.id === id ? { ...i, perspective } : i))
  }

  // ── KPI target inline edit ──
  const handleSaveKpiTarget = (kpi: BSCKPIItem) => {
    const parsed = Number(kpiTargetDraft)
    if (Number.isNaN(parsed) || kpiTargetDraft.trim() === '') {
      setKpiTargetEditing(null)
      return
    }
    setKpiTargetEditing(null)
    if (parsed === kpi.target_value) return
    startTransition(async () => {
      const result = await upsertBSCKPI(orgId, {
        id: kpi.id,
        perspective: kpi.perspective,
        name: kpi.name,
        unit: kpi.unit || null,
        direction: kpi.direction,
        weightPercent: kpi.weight_percent,
        targetValue: parsed,
      }, activeBranchId) as { error?: string }
      if (result.error) { window.alert(result.error); return }
      router.refresh()
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24">

      {/* ── Header ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[10px] font-semibold uppercase tracking-wide">
            <BarChart3 size={12} />
            Nizametrics
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-semibold uppercase tracking-wide">
            ✦ Beta
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {setupData.cycle?.cycle_name || setupData.scope.cycle_key}
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Scope: {scopeLabel}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">Pengukuran Kinerja</h1>
            <p className="text-slate-500 font-medium text-base mt-1">
              4 domain — {setupData.scope.start_date} s/d {setupData.scope.end_date}
            </p>
          </div>

          {/* Lock / Unlock control */}
          <div className="flex items-center gap-3">
            {cycleIsLocked ? (
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold uppercase tracking-wider">
                  <Lock size={14} />
                  Parameter Terkunci
                </div>
                <button
                  type="button"
                  onClick={handleUnlockCycle}
                  disabled={isPending || !canManageSetup}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold uppercase tracking-wider hover:bg-slate-50 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <LockOpen size={14} />
                  Buka Kunci
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold uppercase tracking-wider">
                  <CheckCircle2 size={14} />
                  Mode Setup
                </div>
                <button
                  type="button"
                  onClick={handleLockCycle}
                  disabled={isPending || !canManageSetup}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider hover:bg-slate-700 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Lock size={14} />
                  Lock Bulan Ini
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info row */}
        {!canManageSetup && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
            Mode read-only — pilih unit aktif untuk mengubah setup atau mengisi pengukuran.
          </div>
        )}
        {setupData.error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            {setupData.error}
          </div>
        )}

        {/* Quick toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleGenerateKpis}
            disabled={isPending || !canManageSetup || cycleIsLocked}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold uppercase tracking-wider hover:bg-blue-700 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Zap size={13} />
            Generate dari Data Saya
          </button>
          <button
            type="button"
            onClick={handleSyncValues}
            disabled={isPending || !canManageSetup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold uppercase tracking-wider hover:bg-slate-50 transition-all disabled:opacity-40 cursor-pointer"
          >
            <RefreshCcw size={13} />
            Sync Nilai
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Score: {setupData.summary.overall_score_100}/100
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Coverage: {setupData.summary.completion_percent}%
            </span>
          </div>
        </div>
      </div>

      {/* ── 4 Domain Blocks ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {PERSPECTIVES.map((perspective) => {
          const domain = DOMAIN_CONFIG[perspective]
          const Icon = domain.icon
          const perspectiveKpis = sortedKpis.filter((k) => k.perspective === perspective)
          const perspectiveSummary = setupData.summary.perspective_scores[perspective]

          // Ikhtiyyar live value (override manual jika ada)
          const ikhtiyyarComputed = domain.ikhtiyyar.getValue(initialData)
          const ikhtiyyarIsOverridden = ikhtiyyarOverrides[perspective] !== null
          const ikhtiyyarValue = ikhtiyyarIsOverridden ? ikhtiyyarOverrides[perspective]! : ikhtiyyarComputed
          const ikhtiyyarTarget = ikhtiyyarTargets[perspective]
          const ikhtiyyarDir = domain.ikhtiyyar.direction
          const isEditingValue = ikhtiyyarValueEditing === perspective

          // Progress bar for Ikhtiyyar
          const ikhtiyyarProgress = ikhtiyyarDir === 'HIGHER_BETTER'
            ? Math.min(100, (ikhtiyyarValue / Math.max(0.01, ikhtiyyarTarget)) * 100)
            : Math.max(0, 100 - ((Math.max(0, ikhtiyyarValue - ikhtiyyarTarget) / Math.max(0.01, ikhtiyyarTarget)) * 100))

          const ikhtiyyarOnTarget = ikhtiyyarDir === 'HIGHER_BETTER'
            ? ikhtiyyarValue >= ikhtiyyarTarget
            : ikhtiyyarValue <= ikhtiyyarTarget

          // Covered / uncovered metrics
          const coveredFormulas = new Set(perspectiveKpis.map((k) => k.formula_key).filter(Boolean))
          const allMetrics = getPerspectiveSuggestions(perspective, metricCatalog, 20)
          const uncoveredMetrics = allMetrics.filter((m) => !coveredFormulas.has(m.key.split('.').slice(1).join('_')))
          const isPickerOpen = paramPickerOpen === perspective

          // Recommendations
          const recommendations = buildRecommendations(
            perspectiveKpis, ikhtiyyarValue, ikhtiyyarTarget,
            ikhtiyyarDir, domain.ikhtiyyar.label, cycleIsLocked, uncoveredMetrics
          )

          // Todolist
          const todoList = buildTodoList(
            perspective, ikhtiyyarValue, ikhtiyyarTarget,
            ikhtiyyarDir, domain.ikhtiyyar.label, domain.ikhtiyyar.unit,
            perspectiveKpis, initialData
          )
          const isEditingTarget = ikhtiyyarTargetEditing === perspective

          return (
            <motion.div
              key={perspective}
              variants={item}
              className="bg-white rounded-[34px] border border-slate-100 shadow-sm overflow-hidden"
            >
              {/* Domain header */}
              <div className={`px-7 pt-7 pb-5 border-b ${domain.color.accent}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${domain.color.bg} ${domain.color.text}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Domain</p>
                      <h3 className="text-lg font-semibold text-slate-900">{domain.domainLabel}</h3>
                    </div>
                  </div>
                  <div className={`px-3 py-2 rounded-xl border text-right ${domain.color.bg} ${domain.color.border}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Score</p>
                    <p className={`text-base font-semibold ${domain.color.text}`}>{perspectiveSummary.score_100}/100</p>
                  </div>
                </div>

                {/* Ikhtiyyar card */}
                <div className={`mt-4 rounded-xl border ${domain.color.border} ${domain.color.bg} p-4 space-y-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Star size={12} className={domain.color.text} fill="currentColor" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ikhtiyyar</span>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ikhtiyyarOnTarget ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {ikhtiyyarOnTarget ? 'On Target' : 'Below Target'}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-slate-500">{domain.ikhtiyyar.label}</p>
                        {ikhtiyyarIsOverridden && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/80 border border-slate-300 text-slate-500">
                            Manual
                          </span>
                        )}
                      </div>
                      {isEditingValue ? (
                        <input
                          type="number"
                          value={ikhtiyyarValueDraft}
                          onChange={(e) => setIkhtiyyarValueDraft(e.target.value)}
                          onBlur={() => {
                            const parsed = Number(ikhtiyyarValueDraft)
                            if (!Number.isNaN(parsed)) {
                              setIkhtiyyarOverrides((prev) => ({ ...prev, [perspective]: parsed }))
                            }
                            setIkhtiyyarValueEditing(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const parsed = Number(ikhtiyyarValueDraft)
                              if (!Number.isNaN(parsed)) {
                                setIkhtiyyarOverrides((prev) => ({ ...prev, [perspective]: parsed }))
                              }
                              setIkhtiyyarValueEditing(null)
                            }
                            if (e.key === 'Escape') setIkhtiyyarValueEditing(null)
                          }}
                          autoFocus
                          placeholder={String(ikhtiyyarComputed)}
                          className="mt-0.5 w-32 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xl font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIkhtiyyarValueDraft(String(ikhtiyyarValue))
                            setIkhtiyyarValueEditing(perspective)
                          }}
                          className="flex items-center gap-1.5 group cursor-pointer mt-0.5"
                          title="Klik untuk override nilai aktual"
                        >
                          <span className={`text-2xl font-semibold ${domain.color.text} group-hover:opacity-80 transition-opacity`}>
                            {formatValue(domain.ikhtiyyar.unit, ikhtiyyarValue)}
                          </span>
                          <Pencil size={11} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 mb-1" />
                        </button>
                      )}
                      {ikhtiyyarIsOverridden && (
                        <button
                          type="button"
                          onClick={() => setIkhtiyyarOverrides((prev) => ({ ...prev, [perspective]: null }))}
                          className="text-[10px] font-semibold text-slate-400 hover:text-rose-500 transition-colors mt-0.5 cursor-pointer underline underline-offset-2"
                        >
                          Reset ke data sistem ({formatValue(domain.ikhtiyyar.unit, ikhtiyyarComputed)})
                        </button>
                      )}
                    </div>
                    {/* Editable Ikhtiyyar Target */}
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Target</p>
                      {isEditingTarget ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={ikhtiyyarTargetDraft}
                            onChange={(e) => setIkhtiyyarTargetDraft(e.target.value)}
                            onBlur={() => {
                              const parsed = Number(ikhtiyyarTargetDraft)
                              if (!Number.isNaN(parsed) && parsed > 0) {
                                setIkhtiyyarTargets((prev) => ({ ...prev, [perspective]: parsed }))
                              }
                              setIkhtiyyarTargetEditing(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const parsed = Number(ikhtiyyarTargetDraft)
                                if (!Number.isNaN(parsed) && parsed > 0) {
                                  setIkhtiyyarTargets((prev) => ({ ...prev, [perspective]: parsed }))
                                }
                                setIkhtiyyarTargetEditing(null)
                              }
                              if (e.key === 'Escape') setIkhtiyyarTargetEditing(null)
                            }}
                            autoFocus
                            className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 text-right"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIkhtiyyarTargetDraft(String(ikhtiyyarTarget))
                            setIkhtiyyarTargetEditing(perspective)
                          }}
                          className="flex items-center gap-1 group cursor-pointer"
                          title="Klik untuk ubah target"
                        >
                          <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                            {formatValue(domain.ikhtiyyar.unit, ikhtiyyarTarget)}
                          </span>
                          <Pencil size={10} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/70 border border-white/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${domain.color.progress} transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(0, ikhtiyyarProgress))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Parameters */}
              <div className="px-7 py-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Parameter Bulan Ini
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      {perspectiveKpis.length}
                    </span>
                  </p>
                  {cycleIsLocked && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 flex items-center gap-1">
                      <Lock size={10} /> Terkunci
                    </span>
                  )}
                </div>

                {perspectiveKpis.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Belum Ada Parameter</p>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      {cycleIsLocked ? 'Buka kunci untuk menambah parameter.' : 'Klik "+ Tambah" di bawah atau gunakan "Generate dari Data Saya".'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {perspectiveKpis.map((kpi) => {
                      const isIkhtiyyar = kpi.formula_key === domain.ikhtiyyar.ikhtiyyarFormulaKey
                      const draft = getMeasurementDraft(kpi.id, kpi.latest_measurement?.actual_value ?? null)
                      const hasScore = Boolean(kpi.latest_measurement)

                      return (
                        <div
                          key={kpi.id}
                          className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${isIkhtiyyar ? `${domain.color.bg} ${domain.color.border}` : 'border-slate-100 bg-slate-50/50'}`}
                        >
                          {/* KPI row header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {isIkhtiyyar && (
                                <Star size={11} className={domain.color.text} fill="currentColor" />
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 leading-tight">{kpi.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {kpiTargetEditing === kpi.id ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[11px] text-slate-500 font-medium">Target</span>
                                      <input
                                        type="number"
                                        value={kpiTargetDraft}
                                        onChange={(e) => setKpiTargetDraft(e.target.value)}
                                        onBlur={() => handleSaveKpiTarget(kpi)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveKpiTarget(kpi)
                                          if (e.key === 'Escape') setKpiTargetEditing(null)
                                        }}
                                        autoFocus
                                        className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                                      />
                                      {kpi.unit && <span className="text-[11px] text-slate-400 font-medium">{kpi.unit}</span>}
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setKpiTargetDraft(String(kpi.target_value))
                                        setKpiTargetEditing(kpi.id)
                                      }}
                                      className="flex items-center gap-1 group cursor-pointer"
                                      title="Klik untuk ubah target"
                                    >
                                      <span className="text-[11px] text-slate-500 font-medium group-hover:text-slate-700 transition-colors">
                                        Target {formatValue(kpi.unit, kpi.target_value)}
                                      </span>
                                      <Pencil size={9} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                                    </button>
                                  )}
                                  {kpi.baseline_value !== null && (
                                    <span className="text-[11px] text-slate-400 font-medium">· Dasar {formatValue(kpi.unit, kpi.baseline_value)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasScore && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${domain.color.bg} ${domain.color.border} ${domain.color.text}`}>
                                  {kpi.latest_measurement!.score_100}/100
                                </span>
                              )}
                              {!cycleIsLocked && canManageSetup && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveParam(kpi.id)}
                                  disabled={isPending}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Measurement row (visible when locked) */}
                          {cycleIsLocked && canManageSetup && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder={`Aktual (${kpi.unit || 'angka'})`}
                                value={draft.actual}
                                onChange={(e) =>
                                  setMeasurementDrafts((prev) => ({
                                    ...prev,
                                    [kpi.id]: { ...draft, actual: e.target.value },
                                  }))
                                }
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 min-w-0"
                              />
                              <input
                                type="text"
                                placeholder="Catatan"
                                value={draft.note}
                                onChange={(e) =>
                                  setMeasurementDrafts((prev) => ({
                                    ...prev,
                                    [kpi.id]: { ...draft, note: e.target.value },
                                  }))
                                }
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-400 min-w-0 hidden sm:block"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveMeasurement(kpi.id)}
                                disabled={isPending || !draft.actual}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer ${domain.color.button}`}
                              >
                                <Save size={11} />
                                Simpan
                              </button>
                            </div>
                          )}

                          {/* Last measurement preview */}
                          {kpi.latest_measurement && !cycleIsLocked && (
                            <p className="text-[11px] text-slate-500 font-medium">
                              Pengukuran terakhir: {formatValue(kpi.unit, kpi.latest_measurement.actual_value)}
                              {' '}({kpi.latest_measurement.measurement_date})
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Parameter picker button (only in ACTIVE mode) */}
                {!cycleIsLocked && canManageSetup && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setParamPickerOpen(isPickerOpen ? null : perspective)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 bg-white text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer w-full justify-center"
                    >
                      {isPickerOpen ? <ChevronUp size={13} /> : <Plus size={13} />}
                      {isPickerOpen ? 'Tutup Picker' : '+ Tambah Parameter'}
                    </button>

                    {/* Picker dropdown */}
                    {isPickerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-slate-100">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Pilih dari data tersedia
                          </p>
                        </div>
                        <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                          {allMetrics.length === 0 ? (
                            <p className="px-4 py-4 text-xs text-slate-500 font-medium">Semua metrik sudah ditambahkan.</p>
                          ) : (
                            allMetrics.map((metric) => {
                              const formulaKey = metric.key.split('.').slice(1).join('_')
                              const alreadyAdded = coveredFormulas.has(formulaKey)
                              return (
                                <div
                                  key={metric.key}
                                  className={`flex items-center justify-between gap-3 px-4 py-3 ${alreadyAdded ? 'opacity-40' : 'hover:bg-slate-50'}`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-900">{metric.label}</p>
                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                      Sekarang: {formatValue(metric.unit, metric.value)}
                                    </p>
                                  </div>
                                  {alreadyAdded ? (
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sudah ada</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleAddParam(perspective, metric.key)}
                                      disabled={isPending}
                                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white transition-all disabled:opacity-40 cursor-pointer ${domain.color.button}`}
                                    >
                                      <Plus size={11} />
                                      Tambah
                                    </button>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Recommendations */}
                {recommendations.length > 0 && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Lightbulb size={12} className="text-amber-600 shrink-0" />
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Rekomendasi</p>
                    </div>
                    {recommendations.map((rec, i) => (
                      <p key={i} className="text-xs text-amber-800 font-medium leading-relaxed pl-5">
                        {rec}
                      </p>
                    ))}
                  </div>
                )}

                {/* Todolist dari Gap Ikhtiyyar */}
                {todoList.length > 0 && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <ListTodo size={12} className="text-slate-500 shrink-0" />
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Todolist Domain</p>
                    </div>
                    <div className="space-y-1.5 pl-1">
                      {todoList.map((todo, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span
                            className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                              todo.priority === 'high'
                                ? 'bg-rose-500'
                                : todo.priority === 'medium'
                                  ? 'bg-amber-400'
                                  : 'bg-slate-300'
                            }`}
                          />
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">{todo.text}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-0.5 pl-1">
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /><span className="text-[10px] text-slate-400 font-semibold">Prioritas Tinggi</span></div>
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /><span className="text-[10px] text-slate-400 font-semibold">Sedang</span></div>
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /><span className="text-[10px] text-slate-400 font-semibold">Rendah</span></div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* ── Plan & Todolist Section ── */}
      <div className="rounded-[32px] border border-slate-200 bg-white overflow-hidden shadow-sm">

        {/* Plan header */}
        <div className="px-8 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
              <ListTodo size={17} className="text-white" />
            </div>
            <div className="min-w-0">
              {planTitleEditing ? (
                <input
                  type="text"
                  value={planTitleDraft}
                  onChange={(e) => setPlanTitleDraft(e.target.value)}
                  onBlur={() => { if (planTitleDraft.trim()) setPlanTitle(planTitleDraft.trim()); setPlanTitleEditing(false) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { if (planTitleDraft.trim()) setPlanTitle(planTitleDraft.trim()); setPlanTitleEditing(false) }
                    if (e.key === 'Escape') setPlanTitleEditing(false)
                  }}
                  autoFocus
                  className="text-lg font-semibold text-slate-900 border-b-2 border-blue-400 bg-transparent outline-none w-full"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { setPlanTitleDraft(planTitle); setPlanTitleEditing(true) }}
                  className="flex items-center gap-2 group cursor-pointer"
                >
                  <h3 className="text-lg font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">{planTitle}</h3>
                  <Pencil size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                </button>
              )}
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                {planItems.length} tugas · {planItems.filter((i) => i.done).length} selesai
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Progress bar mini */}
            {planItems.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all duration-500"
                    style={{ width: `${Math.round((planItems.filter((i) => i.done).length / planItems.length) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-500">
                  {Math.round((planItems.filter((i) => i.done).length / planItems.length) * 100)}%
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setPlanExpanded((prev) => !prev)}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all cursor-pointer"
            >
              {planExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {planExpanded && (
          <div className="px-8 py-6 space-y-6">

            {/* Quick-add form */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
              <div className="flex gap-2.5 flex-wrap sm:flex-nowrap">
                <input
                  type="text"
                  placeholder="Tulis rencana atau tugas..."
                  value={planForm.text}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, text: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlanItem() }}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 placeholder:font-normal placeholder:text-slate-400 min-w-0"
                />
                <button
                  type="button"
                  onClick={handleAddPlanItem}
                  disabled={!planForm.text.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider hover:bg-slate-700 transition-all disabled:opacity-40 cursor-pointer shrink-0"
                >
                  <Plus size={13} />
                  Tambah
                </button>
              </div>

              {/* Domain + priority selector */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mr-1">Domain:</span>
                {PERSPECTIVES.map((p) => {
                  const d = DOMAIN_CONFIG[p]
                  const isSelected = planForm.perspective === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlanForm((prev) => ({ ...prev, perspective: p }))}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                        isSelected
                          ? `${d.color.bg} ${d.color.text} ${d.color.border} border ring-2 ${
                              p === 'FINANCIAL' ? 'ring-emerald-200'
                              : p === 'CUSTOMER' ? 'ring-blue-200'
                              : p === 'INTERNAL_PROCESS' ? 'ring-indigo-200'
                              : 'ring-rose-200'
                            }`
                          : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <d.icon size={11} />
                      {d.domainLabel}
                    </button>
                  )
                })}
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 ml-3 mr-1">Prioritas:</span>
                {(['high', 'medium', 'low'] as TodoPriority[]).map((p) => {
                  const pc = PRIORITY_COLORS[p]
                  const isSelected = planForm.priority === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlanForm((prev) => ({ ...prev, priority: p }))}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                        isSelected
                          ? `ring-2 ${pc.ring} border-slate-200 bg-white text-slate-700`
                          : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${pc.dot}`} />
                      {pc.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Distribution grid — 2×2 matching domain colors */}
            {planItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-10 text-center">
                <ListTodo size={28} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Belum ada rencana</p>
                <p className="text-xs text-slate-400 font-medium mt-1">Tulis tugas di atas lalu pilih domain tujuannya.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PERSPECTIVES.map((perspective) => {
                  const domain = DOMAIN_CONFIG[perspective]
                  const DIcon = domain.icon
                  const items = planItems.filter((i) => i.perspective === perspective)
                  const doneCount = items.filter((i) => i.done).length

                  return (
                    <div
                      key={perspective}
                      className={`rounded-xl border p-4 space-y-3 min-h-[120px] transition-all ${domain.color.bg} ${domain.color.border}`}
                    >
                      {/* Column header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <DIcon size={14} className={domain.color.text} />
                          <p className={`text-[11px] font-semibold uppercase tracking-wide ${domain.color.text}`}>
                            {domain.domainLabel}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {doneCount}/{items.length}
                        </span>
                      </div>

                      {/* Items */}
                      {items.length === 0 ? (
                        <p className="text-[11px] text-slate-400 font-medium italic">Belum ada tugas di domain ini.</p>
                      ) : (
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="group flex items-start gap-2 rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 shadow-sm transition-all hover:bg-white hover:shadow"
                            >
                              {/* Checkbox */}
                              <button
                                type="button"
                                onClick={() => handleTogglePlanItem(item.id)}
                                className="mt-0.5 shrink-0 cursor-pointer transition-transform active:scale-90"
                                aria-label={item.done ? 'Tandai belum selesai' : 'Tandai selesai'}
                              >
                                {item.done ? (
                                  <CheckCircle2 size={15} className="text-emerald-500" />
                                ) : (
                                  <div className={`w-3.5 h-3.5 rounded-full border-2 ${domain.color.border} transition-colors`} />
                                )}
                              </button>

                              {/* Text + priority dot */}
                              <div className="flex-1 min-w-0 flex items-start gap-1.5">
                                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_COLORS[item.priority].dot}`} />
                                <p className={`text-xs font-semibold leading-relaxed flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                  {item.text}
                                </p>
                              </div>

                              {/* Actions (visible on hover) */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                {/* Move domain dropdown */}
                                <select
                                  value={item.perspective}
                                  onChange={(e) => handleMovePlanItem(item.id, e.target.value as BSCPerspective)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] font-semibold text-slate-400 bg-transparent border-0 outline-none cursor-pointer py-0 px-0.5 max-w-[60px]"
                                  title="Pindah domain"
                                >
                                  {PERSPECTIVES.map((p) => (
                                    <option key={p} value={p}>{DOMAIN_CONFIG[p].domainLabel}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePlanItem(item.id)}
                                  className="p-0.5 rounded text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                                  aria-label="Hapus tugas"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Summary strip */}
            {planItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 px-1">
                {(['high', 'medium', 'low'] as TodoPriority[]).map((p) => {
                  const count = planItems.filter((i) => i.priority === p && !i.done).length
                  if (count === 0) return null
                  return (
                    <div key={p} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[p].dot}`} />
                      <span className="text-[11px] font-semibold text-slate-500">{count} {PRIORITY_COLORS[p].label.toLowerCase()} pending</span>
                    </div>
                  )
                })}
                {planItems.filter((i) => i.done).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPlanItems((prev) => prev.filter((i) => !i.done))}
                    className="ml-auto text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    Hapus yang selesai ({planItems.filter((i) => i.done).length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Advanced BSC Section ── */}
      <div className="rounded-[32px] border border-slate-200 bg-slate-50/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center justify-between gap-3 w-full px-8 py-5 text-left cursor-pointer hover:bg-slate-100/50 transition-all"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Mode Lanjutan</p>
            <h4 className="text-base font-semibold text-slate-900 mt-0.5">Bobot Perspektif · KPI List · Audit Sinkron</h4>
          </div>
          {showAdvanced ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
        </button>

        {showAdvanced && (
          <div className="px-8 pb-8 space-y-8">

            {/* Perspective Weights */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h5 className="text-base font-semibold text-slate-900">Bobot Perspektif</h5>
                <button
                  type="button"
                  onClick={handleSaveWeights}
                  disabled={isPending || !canManageSetup}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  <Save size={13} />
                  Simpan Bobot
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {PERSPECTIVES.map((p) => (
                  <label key={p} className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {DOMAIN_CONFIG[p].domainLabel}
                    </span>
                    <input
                      type="number" min={0} max={100}
                      value={weightDraft[p]}
                      onChange={(e) => setWeightDraft((prev) => ({ ...prev, [p]: Number(e.target.value || 0) }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs font-semibold text-slate-500">
                Total: {Object.values(weightDraft).reduce((s, v) => s + Number(v || 0), 0).toFixed(2)}%
                {' '}(harus tepat 100%)
              </p>
            </div>

            {/* KPI Coverage Audit */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h5 className="text-base font-semibold text-slate-900">Audit Sinkron KPI vs Data Existing</h5>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                  <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">
                    Terukur: {kpiCoverage.measurable.length}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700">
                    Unmapped: {kpiCoverage.unmapped.length}
                  </span>
                </div>
              </div>

              {kpiCoverage.measurable.length > 0 && (
                <div className="space-y-2">
                  {kpiCoverage.measurable.map((item) => (
                    <div key={item.kpi_id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-900">{item.kpi_name}</p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        → {item.metric.label} · {formatValue(item.metric.unit, item.metric.value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {kpiCoverage.unmapped.length > 0 && (
                <div className="space-y-2">
                  {kpiCoverage.unmapped.map((item) => (
                    <div key={item.kpi_id} className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2 space-y-1">
                      <p className="text-xs font-semibold text-slate-900">{item.kpi_name}</p>
                      <p className="text-[11px] text-amber-700 font-semibold">Belum ada sumber data — saran:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.suggestions.slice(0, 2).map((s) => (
                          <button
                            key={`${item.kpi_id}-${s.key}`}
                            type="button"
                            onClick={() => {
                              if (!canManageSetup) return
                              startTransition(async () => {
                                const result = await applyBscKpiSuggestedIndicator(orgId, { kpiId: item.kpi_id, metricKey: s.key }, activeBranchId) as { error?: string }
                                if (result.error) { window.alert(result.error); return }
                                router.refresh()
                              })
                            }}
                            disabled={isPending || !canManageSetup}
                            className="px-2 py-1 rounded-lg border border-blue-200 bg-blue-50 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            Pakai: {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Full KPI list */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h5 className="text-base font-semibold text-slate-900">Semua KPI Aktif ({sortedKpis.length})</h5>
              </div>
              {sortedKpis.length === 0 ? (
                <p className="text-sm text-slate-500 font-medium">Belum ada KPI aktif di siklus ini.</p>
              ) : (
                <div className="space-y-2">
                  {sortedKpis.map((kpi) => (
                    <div key={kpi.id} className="rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {DOMAIN_CONFIG[kpi.perspective].domainLabel} · {kpi.code}
                        </p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">{kpi.name}</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Target {formatValue(kpi.unit, kpi.target_value)} · Bobot {kpi.weight_percent}% · {kpi.direction === 'HIGHER_BETTER' ? 'Higher better' : 'Lower better'}
                        </p>
                        {kpi.latest_measurement && (
                          <p className="text-xs text-emerald-700 font-semibold mt-1">
                            Aktual: {formatValue(kpi.unit, kpi.latest_measurement.actual_value)} · Score {kpi.latest_measurement.score_100}/100
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setKpiEditForm({
                              id: kpi.id, perspective: kpi.perspective, name: kpi.name,
                              unit: kpi.unit || '', direction: kpi.direction,
                              weightPercent: String(kpi.weight_percent), targetValue: String(kpi.target_value),
                            })
                            setIsEditModalOpen(true)
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canManageSetup) return
                            if (!window.confirm('Nonaktifkan KPI ini?')) return
                            startTransition(async () => {
                              const result = await archiveBSCKPI(orgId, kpi.id, activeBranchId) as { error?: string }
                              if (result.error) { window.alert(result.error); return }
                              router.refresh()
                            })
                          }}
                          disabled={isPending || !canManageSetup}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 size={11} />
                          Nonaktifkan
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── Edit KPI Modal ── */}
      {isEditModalOpen && kpiEditForm.id && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] bg-white border border-slate-100 shadow-md p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xl font-semibold text-slate-900">Edit KPI</h4>
              <button
                type="button"
                onClick={() => { setIsEditModalOpen(false) }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <form onSubmit={handleSubmitKpiEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Arah KPI</span>
                  <select
                    value={kpiEditForm.direction}
                    onChange={(e) => setKpiEditForm((prev) => ({ ...prev, direction: e.target.value as BSCDirection }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="HIGHER_BETTER">Higher Better</option>
                    <option value="LOWER_BETTER">Lower Better</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Satuan</span>
                  <input
                    value={kpiEditForm.unit}
                    onChange={(e) => setKpiEditForm((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="%, docs, IDR"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none"
                  />
                </label>
              </div>
              <label className="space-y-1 block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nama KPI</span>
                <input
                  value={kpiEditForm.name}
                  onChange={(e) => setKpiEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Target</span>
                  <input
                    type="number"
                    value={kpiEditForm.targetValue}
                    onChange={(e) => setKpiEditForm((prev) => ({ ...prev, targetValue: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bobot (%)</span>
                  <input
                    type="number"
                    value={kpiEditForm.weightPercent}
                    onChange={(e) => setKpiEditForm((prev) => ({ ...prev, weightPercent: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none"
                  />
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer">Batal</button>
                <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-50 cursor-pointer">
                  <Save size={13} />
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
