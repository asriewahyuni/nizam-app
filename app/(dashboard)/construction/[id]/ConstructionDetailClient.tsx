'use client'

import Link from 'next/link'
import React, { startTransition, useMemo, useState, useTransition } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  ClipboardList,
  Pencil,
  Plus,
  Save,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDate, formatRupiah } from '@/lib/utils'
import {
  deleteConstructionBillingTerm,
  deleteConstructionBudgetItem,
  deleteConstructionChangeOrder,
  deleteConstructionProgressLog,
  submitConstructionChangeOrderApproval,
  updateConstructionProjectSnapshot,
  upsertConstructionBillingTerm,
  upsertConstructionBudgetItem,
  upsertConstructionChangeOrder,
  upsertConstructionProgressLog,
} from '@/modules/construction/actions/construction.actions'
import type {
  ConstructionBillingBasisType,
  ConstructionBillingStatus,
  ConstructionBillingTermInput,
  ConstructionBillingTermRecord,
  ConstructionBudgetCategory,
  ConstructionBudgetItemInput,
  ConstructionBudgetItemRecord,
  ConstructionChangeOrderInput,
  ConstructionChangeOrderRecord,
  ConstructionChangeOrderStatus,
  ConstructionChangeOrderType,
  ConstructionProgressLogInput,
  ConstructionProgressLogRecord,
  ConstructionProjectRecord,
  ConstructionProjectSnapshotInput,
  ConstructionProjectStageRecord,
} from '@/modules/construction/lib/construction'

type ContactOption = {
  id: string
  name: string
  type: string
}

type ConstructionDetailClientProps = {
  orgId: string
  project: ConstructionProjectRecord
  stages: ConstructionProjectStageRecord[]
  budgetItems: ConstructionBudgetItemRecord[]
  progressLogs: ConstructionProgressLogRecord[]
  billingTerms: ConstructionBillingTermRecord[]
  changeOrders: ConstructionChangeOrderRecord[]
  contacts: ContactOption[]
}

type BudgetFormState = {
  id?: string
  stageId: string
  category: ConstructionBudgetCategory
  description: string
  uom: string
  plannedQuantity: number
  plannedUnitCost: number
  actualQuantity: number
  actualUnitCost: number
  vendorContactId: string
  notes: string
}

type ProgressFormState = {
  id?: string
  stageId: string
  entryDate: string
  progressPercent: number
  weather: string
  summary: string
  issueNotes: string
  evidenceUrlsText: string
}

type BillingFormState = {
  id?: string
  termLabel: string
  sequenceNo: number
  basisType: ConstructionBillingBasisType
  progressTargetPercent: number
  billingPercent: number
  billingAmount: number
  status: ConstructionBillingStatus
  invoiceReference: string
  dueDate: string
  paidDate: string
  notes: string
}

type ChangeOrderFormState = {
  id?: string
  stageId: string
  referenceNo: string
  title: string
  changeType: ConstructionChangeOrderType
  status: ConstructionChangeOrderStatus
  requestedDate: string
  approvedDate: string
  effectiveDate: string
  contractValueDelta: number
  estimatedCostDelta: number
  scheduleDeltaDays: number
  reason: string
  notes: string
}

const projectStatusStyles: Record<string, string> = {
  PLANNING: 'bg-amber-50 text-amber-700 border-amber-200',
  TENDER: 'bg-stone-100 text-stone-700 border-stone-200',
  DESIGN: 'bg-sky-50 text-sky-700 border-sky-200',
  EXECUTION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  HANDOVER: 'bg-orange-50 text-orange-700 border-orange-200',
  COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
  ON_HOLD: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
}

const stageStatusStyles: Record<string, string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-600 border-slate-200',
  IN_PROGRESS: 'bg-sky-50 text-sky-700 border-sky-200',
  BLOCKED: 'bg-rose-50 text-rose-700 border-rose-200',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const billingStatusStyles: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-600 border-slate-200',
  READY_TO_BILL: 'bg-amber-50 text-amber-700 border-amber-200',
  BILLED: 'bg-sky-50 text-sky-700 border-sky-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const changeOrderStatusStyles: Record<string, string> = {
  PROPOSED: 'bg-slate-100 text-slate-600 border-slate-200',
  IN_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-sky-50 text-sky-700 border-sky-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  IMPLEMENTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const approvalStatusStyles: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-sky-50 text-sky-700 border-sky-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
}

const projectTypeLabels: Record<string, string> = {
  ARCHITECT: 'Arsitek',
  CONTRACTOR: 'Kontraktor',
  DESIGN_BUILD: 'Design & Build',
  INTERIOR: 'Interior',
  CONSULTING: 'Konsultan',
}

const budgetCategoryLabels: Record<ConstructionBudgetCategory, string> = {
  MATERIAL: 'Material',
  LABOR: 'Tenaga Kerja',
  SUBCON: 'Subkon',
  EQUIPMENT: 'Alat',
  OTHER: 'Lainnya',
}

const billingBasisLabels: Record<ConstructionBillingBasisType, string> = {
  DOWN_PAYMENT: 'Down Payment',
  PROGRESS: 'Progress',
  FINAL: 'Final',
  RETENTION: 'Retensi',
  CUSTOM: 'Custom',
}

const changeOrderTypeLabels: Record<ConstructionChangeOrderType, string> = {
  ADDITIONAL_WORK: 'Pekerjaan Tambah',
  DEDUCTION: 'Pekerjaan Kurang',
  SUBSTITUTION: 'Substitusi Material',
  TIME_EXTENSION: 'Perpanjangan Waktu',
  DESIGN_REVISION: 'Revisi Desain',
}

function emptyBudgetForm(): BudgetFormState {
  return {
    stageId: '',
    category: 'MATERIAL',
    description: '',
    uom: '',
    plannedQuantity: 0,
    plannedUnitCost: 0,
    actualQuantity: 0,
    actualUnitCost: 0,
    vendorContactId: '',
    notes: '',
  }
}

function emptyProgressForm(): ProgressFormState {
  return {
    stageId: '',
    entryDate: new Date().toISOString().split('T')[0],
    progressPercent: 0,
    weather: '',
    summary: '',
    issueNotes: '',
    evidenceUrlsText: '',
  }
}

function emptyBillingForm(nextSequence = 1): BillingFormState {
  return {
    termLabel: '',
    sequenceNo: nextSequence,
    basisType: 'PROGRESS',
    progressTargetPercent: 0,
    billingPercent: 0,
    billingAmount: 0,
    status: 'PLANNED',
    invoiceReference: '',
    dueDate: '',
    paidDate: '',
    notes: '',
  }
}

function emptyChangeOrderForm(nextReferenceNo = ''): ChangeOrderFormState {
  return {
    stageId: '',
    referenceNo: nextReferenceNo,
    title: '',
    changeType: 'ADDITIONAL_WORK',
    status: 'PROPOSED',
    requestedDate: new Date().toISOString().split('T')[0],
    approvedDate: '',
    effectiveDate: '',
    contractValueDelta: 0,
    estimatedCostDelta: 0,
    scheduleDeltaDays: 0,
    reason: '',
    notes: '',
  }
}

function parseEvidenceUrls(text: string) {
  return text
    .split(/\n|,/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function formatSignedCurrency(value: number) {
  if (value === 0) return formatRupiah(0)

  const prefix = value > 0 ? '+' : '-'
  return `${prefix}${formatRupiah(Math.abs(value))}`
}

function formatSignedDays(value: number) {
  if (value === 0) return '0 hari'

  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value} hari`
}

function getCurrencyDeltaClass(value: number, positiveClass: string, negativeClass: string) {
  if (value > 0) return positiveClass
  if (value < 0) return negativeClass
  return 'text-slate-600'
}

export function ConstructionDetailClient({
  orgId,
  project,
  stages,
  budgetItems,
  progressLogs,
  billingTerms,
  changeOrders,
  contacts,
}: ConstructionDetailClientProps) {
  const router = useRouter()
  const [isSavingProject, startProjectTransition] = useTransition()
  const [isSavingBudget, startBudgetTransition] = useTransition()
  const [isSavingProgress, startProgressTransition] = useTransition()
  const [isSavingBilling, startBillingTransition] = useTransition()
  const [isSavingChangeOrder, startChangeOrderTransition] = useTransition()
  const [submittingApprovalId, setSubmittingApprovalId] = useState<string | null>(null)

  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [showBillingModal, setShowBillingModal] = useState(false)
  const [showChangeOrderModal, setShowChangeOrderModal] = useState(false)

  const [budgetError, setBudgetError] = useState('')
  const [progressError, setProgressError] = useState('')
  const [billingError, setBillingError] = useState('')
  const [changeOrderError, setChangeOrderError] = useState('')
  const [projectError, setProjectError] = useState('')

  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(emptyBudgetForm)
  const [progressForm, setProgressForm] = useState<ProgressFormState>(emptyProgressForm)
  const [billingForm, setBillingForm] = useState<BillingFormState>(emptyBillingForm(billingTerms.length + 1))
  const [changeOrderForm, setChangeOrderForm] = useState<ChangeOrderFormState>(
    emptyChangeOrderForm(`CO-${String(changeOrders.length + 1).padStart(3, '0')}`)
  )
  const [projectForm, setProjectForm] = useState<ConstructionProjectSnapshotInput>({
    projectName: project.projectName,
    projectStatus: project.projectStatus,
    projectType: project.projectType,
    siteAddress: project.siteAddress,
    progressPercent: project.progressPercent,
    contractValue: project.contractValue,
    estimatedCost: project.estimatedCost,
    startDate: project.startDate,
    targetEndDate: project.targetEndDate,
    actualEndDate: project.actualEndDate,
    clientContactId: project.clientContactId,
    notes: project.notes,
  })

  const totals = useMemo(() => {
    const plannedTotal = budgetItems.reduce((sum, item) => sum + item.plannedTotal, 0)
    const actualTotal = budgetItems.reduce((sum, item) => sum + item.actualTotal, 0)
    const variance = actualTotal - plannedTotal
    const totalStageWeight = stages.reduce((sum, stage) => sum + stage.weightPercent, 0)
    const weightedProgress = totalStageWeight > 0
      ? stages.reduce((sum, stage) => sum + ((stage.progressPercent * stage.weightPercent) / totalStageWeight), 0)
      : project.progressPercent
    const totalBillingAmount = billingTerms.reduce((sum, term) => sum + term.billingAmount, 0)
    const paidBillingAmount = billingTerms
      .filter((term) => term.status === 'PAID')
      .reduce((sum, term) => sum + term.billingAmount, 0)
    const approvedChangeOrders = changeOrders.filter((changeOrder) => (
      changeOrder.status === 'APPROVED' || changeOrder.status === 'IMPLEMENTED'
    ))
    const approvedChangeOrderContractDelta = approvedChangeOrders
      .reduce((sum, changeOrder) => sum + changeOrder.contractValueDelta, 0)
    const approvedChangeOrderCostDelta = approvedChangeOrders
      .reduce((sum, changeOrder) => sum + changeOrder.estimatedCostDelta, 0)
    const openChangeOrders = changeOrders.filter((changeOrder) => (
      changeOrder.status === 'PROPOSED' || changeOrder.status === 'IN_REVIEW'
    )).length

    return {
      plannedTotal,
      actualTotal,
      variance,
      weightedProgress,
      totalBillingAmount,
      paidBillingAmount,
      approvedChangeOrderContractDelta,
      approvedChangeOrderCostDelta,
      openChangeOrders,
    }
  }, [billingTerms, budgetItems, changeOrders, project.progressPercent, stages])

  const openCreateBudgetModal = () => {
    setBudgetError('')
    setBudgetForm(emptyBudgetForm())
    setShowBudgetModal(true)
  }

  const openEditBudgetModal = (item: ConstructionBudgetItemRecord) => {
    setBudgetError('')
    setBudgetForm({
      id: item.id,
      stageId: item.stageId || '',
      category: item.category,
      description: item.description,
      uom: item.uom || '',
      plannedQuantity: item.plannedQuantity,
      plannedUnitCost: item.plannedUnitCost,
      actualQuantity: item.actualQuantity,
      actualUnitCost: item.actualUnitCost,
      vendorContactId: item.vendorContactId || '',
      notes: item.notes || '',
    })
    setShowBudgetModal(true)
  }

  const openCreateProgressModal = () => {
    setProgressError('')
    setProgressForm(emptyProgressForm())
    setShowProgressModal(true)
  }

  const openEditProgressModal = (item: ConstructionProgressLogRecord) => {
    setProgressError('')
    setProgressForm({
      id: item.id,
      stageId: item.stageId || '',
      entryDate: item.entryDate || '',
      progressPercent: item.progressPercent,
      weather: item.weather || '',
      summary: item.summary,
      issueNotes: item.issueNotes || '',
      evidenceUrlsText: item.evidenceUrls.join('\n'),
    })
    setShowProgressModal(true)
  }

  const openCreateBillingModal = () => {
    setBillingError('')
    setBillingForm(emptyBillingForm(billingTerms.length + 1))
    setShowBillingModal(true)
  }

  const openEditBillingModal = (term: ConstructionBillingTermRecord) => {
    setBillingError('')
    setBillingForm({
      id: term.id,
      termLabel: term.termLabel,
      sequenceNo: term.sequenceNo,
      basisType: term.basisType,
      progressTargetPercent: term.progressTargetPercent,
      billingPercent: term.billingPercent,
      billingAmount: term.billingAmount,
      status: term.status,
      invoiceReference: term.invoiceReference || '',
      dueDate: term.dueDate || '',
      paidDate: term.paidDate || '',
      notes: term.notes || '',
    })
    setShowBillingModal(true)
  }

  const openCreateChangeOrderModal = () => {
    setChangeOrderError('')
    setChangeOrderForm(emptyChangeOrderForm(`CO-${String(changeOrders.length + 1).padStart(3, '0')}`))
    setShowChangeOrderModal(true)
  }

  const openEditChangeOrderModal = (changeOrder: ConstructionChangeOrderRecord) => {
    setChangeOrderError('')
    setChangeOrderForm({
      id: changeOrder.id,
      stageId: changeOrder.stageId || '',
      referenceNo: changeOrder.referenceNo || '',
      title: changeOrder.title,
      changeType: changeOrder.changeType,
      status: changeOrder.status,
      requestedDate: changeOrder.requestedDate || '',
      approvedDate: changeOrder.approvedDate || '',
      effectiveDate: changeOrder.effectiveDate || '',
      contractValueDelta: changeOrder.contractValueDelta,
      estimatedCostDelta: changeOrder.estimatedCostDelta,
      scheduleDeltaDays: changeOrder.scheduleDeltaDays,
      reason: changeOrder.reason || '',
      notes: changeOrder.notes || '',
    })
    setShowChangeOrderModal(true)
  }

  const handleProjectSave = async () => {
    setProjectError('')
    startProjectTransition(async () => {
      const result = await updateConstructionProjectSnapshot(orgId, project.id, projectForm)
      if (result.error) {
        setProjectError(result.error)
        return
      }

      startTransition(() => {
        router.refresh()
      })
    })
  }

  const handleBudgetSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBudgetError('')

    const payload: ConstructionBudgetItemInput = {
      id: budgetForm.id,
      stageId: budgetForm.stageId || null,
      category: budgetForm.category,
      description: budgetForm.description,
      uom: budgetForm.uom || null,
      plannedQuantity: budgetForm.plannedQuantity,
      plannedUnitCost: budgetForm.plannedUnitCost,
      actualQuantity: budgetForm.actualQuantity,
      actualUnitCost: budgetForm.actualUnitCost,
      vendorContactId: budgetForm.vendorContactId || null,
      notes: budgetForm.notes || null,
    }

    startBudgetTransition(async () => {
      const result = await upsertConstructionBudgetItem(orgId, project.id, payload)
      if (result.error) {
        setBudgetError(result.error)
        return
      }

      setShowBudgetModal(false)
      setBudgetForm(emptyBudgetForm())
      startTransition(() => {
        router.refresh()
      })
    })
  }

  const handleProgressSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProgressError('')

    const payload: ConstructionProgressLogInput = {
      id: progressForm.id,
      stageId: progressForm.stageId || null,
      entryDate: progressForm.entryDate || null,
      progressPercent: progressForm.progressPercent,
      weather: progressForm.weather || null,
      summary: progressForm.summary,
      issueNotes: progressForm.issueNotes || null,
      evidenceUrls: parseEvidenceUrls(progressForm.evidenceUrlsText),
    }

    startProgressTransition(async () => {
      const result = await upsertConstructionProgressLog(orgId, project.id, payload)
      if (result.error) {
        setProgressError(result.error)
        return
      }

      setShowProgressModal(false)
      setProgressForm(emptyProgressForm())
      startTransition(() => {
        router.refresh()
      })
    })
  }

  const handleBillingSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBillingError('')

    const payload: ConstructionBillingTermInput = {
      id: billingForm.id,
      termLabel: billingForm.termLabel,
      sequenceNo: billingForm.sequenceNo,
      basisType: billingForm.basisType,
      progressTargetPercent: billingForm.progressTargetPercent,
      billingPercent: billingForm.billingPercent,
      billingAmount: billingForm.billingAmount,
      status: billingForm.status,
      invoiceReference: billingForm.invoiceReference || null,
      dueDate: billingForm.dueDate || null,
      paidDate: billingForm.paidDate || null,
      notes: billingForm.notes || null,
    }

    startBillingTransition(async () => {
      const result = await upsertConstructionBillingTerm(orgId, project.id, payload)
      if (result.error) {
        setBillingError(result.error)
        return
      }

      setShowBillingModal(false)
      setBillingForm(emptyBillingForm(billingTerms.length + 1))
      startTransition(() => {
        router.refresh()
      })
    })
  }

  const handleDeleteBudgetItem = async (budgetItemId: string) => {
    if (!window.confirm('Hapus item RAB ini?')) return

    const result = await deleteConstructionBudgetItem(orgId, project.id, budgetItemId)
    if (result.error) {
      window.alert(result.error)
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  const handleDeleteProgressLog = async (progressLogId: string) => {
    if (!window.confirm('Hapus log progress ini?')) return

    const result = await deleteConstructionProgressLog(orgId, project.id, progressLogId)
    if (result.error) {
      window.alert(result.error)
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  const handleDeleteBillingTerm = async (billingTermId: string) => {
    if (!window.confirm('Hapus termin billing ini?')) return

    const result = await deleteConstructionBillingTerm(orgId, project.id, billingTermId)
    if (result.error) {
      window.alert(result.error)
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  const handleChangeOrderSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChangeOrderError('')

    const payload: ConstructionChangeOrderInput = {
      id: changeOrderForm.id,
      stageId: changeOrderForm.stageId || null,
      referenceNo: changeOrderForm.referenceNo || null,
      title: changeOrderForm.title,
      changeType: changeOrderForm.changeType,
      status: changeOrderForm.status,
      requestedDate: changeOrderForm.requestedDate || null,
      approvedDate: changeOrderForm.approvedDate || null,
      effectiveDate: changeOrderForm.effectiveDate || null,
      contractValueDelta: changeOrderForm.contractValueDelta,
      estimatedCostDelta: changeOrderForm.estimatedCostDelta,
      scheduleDeltaDays: changeOrderForm.scheduleDeltaDays,
      reason: changeOrderForm.reason || null,
      notes: changeOrderForm.notes || null,
    }

    startChangeOrderTransition(async () => {
      const result = await upsertConstructionChangeOrder(orgId, project.id, payload)
      if (result.error) {
        setChangeOrderError(result.error)
        return
      }

      setShowChangeOrderModal(false)
      setChangeOrderForm(emptyChangeOrderForm(`CO-${String(changeOrders.length + 1).padStart(3, '0')}`))
      startTransition(() => {
        router.refresh()
      })
    })
  }

  const handleDeleteChangeOrder = async (changeOrderId: string) => {
    if (!window.confirm('Hapus change order ini?')) return

    const result = await deleteConstructionChangeOrder(orgId, project.id, changeOrderId)
    if (result.error) {
      window.alert(result.error)
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  const handleSubmitChangeOrderApproval = async (changeOrderId: string) => {
    setSubmittingApprovalId(changeOrderId)
    const result = await submitConstructionChangeOrderApproval(orgId, project.id, changeOrderId)

    if (result.error) {
      window.alert(result.error)
      setSubmittingApprovalId(null)
      return
    }

    startTransition(() => {
      router.refresh()
    })
    setSubmittingApprovalId(null)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-[#d7d2c9] bg-[radial-gradient(circle_at_top_left,_rgba(224,122,95,0.22),_transparent_36%),linear-gradient(135deg,_#17324d_0%,_#254b63_54%,_#efe3cd_155%)] px-6 py-7 text-white shadow-xl shadow-slate-900/10 md:px-8 md:py-9">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/construction"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white/90 transition hover:bg-white/15"
            >
              <ArrowLeft size={16} />
              Kembali
            </Link>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${projectStatusStyles[project.projectStatus] || projectStatusStyles.PLANNING}`}>
              {project.projectStatus}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
              {projectTypeLabels[project.projectType] || project.projectType}
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">
              {project.projectCode}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.9fr]">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{project.projectName}</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/80">
                {project.clientName || 'Belum ada kontak klien terhubung'}.
                {' '}
                Lokasi proyek {project.siteAddress || 'belum diisi'}, dengan monitoring cost plan vs actual, progress harian, dan termin tagihan.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Progress Stage</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{totals.weightedProgress.toFixed(1)}%</div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Termin Billing</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">{billingTerms.length}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Contract Value</div>
            <Wallet size={18} className="text-[#e07a5f]" />
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{formatRupiah(project.contractValue)}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">RAB Planned</div>
            <ClipboardList size={18} className="text-[#254b63]" />
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{formatRupiah(totals.plannedTotal)}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Actual Cost</div>
            <BarChart3 size={18} className="text-[#3b6b5a]" />
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{formatRupiah(totals.actualTotal)}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Billing Planned</div>
            <Wallet size={18} className="text-[#6a8d73]" />
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{formatRupiah(totals.totalBillingAmount)}</div>
          <div className="mt-2 text-xs font-bold text-slate-500">
            Paid: {formatRupiah(totals.paidBillingAmount)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Approved CO</div>
            <Pencil size={18} className="text-[#d97706]" />
          </div>
          <div className={`mt-3 text-2xl font-semibold tracking-tight ${getCurrencyDeltaClass(totals.approvedChangeOrderContractDelta, 'text-emerald-700', 'text-rose-700')}`}>
            {formatSignedCurrency(totals.approvedChangeOrderContractDelta)}
          </div>
          <div className="mt-2 text-xs font-bold text-slate-500">
            Open: {totals.openChangeOrders} • Cost impact: {formatSignedCurrency(totals.approvedChangeOrderCostDelta)}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">RAB / BoQ</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Budget & Actual Cost</h2>
              </div>
              <button
                type="button"
                onClick={openCreateBudgetModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#254b63] px-4 py-3 text-sm font-black text-white transition hover:bg-[#1e3d52]"
              >
                <Plus size={16} />
                Tambah Item
              </button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-3">Item</th>
                    <th className="px-3">Tahap</th>
                    <th className="px-3">Plan</th>
                    <th className="px-3">Actual</th>
                    <th className="px-3">Variance</th>
                    <th className="px-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-500">
                        Belum ada item RAB. Tambahkan material, upah, subkon, atau alat untuk project ini.
                      </td>
                    </tr>
                  ) : (
                    budgetItems.map((item) => {
                      const variance = item.actualTotal - item.plannedTotal

                      return (
                        <tr key={item.id} className="rounded-xl bg-slate-50">
                          <td className="rounded-l-[24px] px-3 py-4 align-top">
                            <div className="font-black text-slate-900">{item.description}</div>
                            <div className="mt-1 text-xs font-medium text-slate-500">
                              {budgetCategoryLabels[item.category]}{item.uom ? ` • ${item.uom}` : ''}{item.vendorName ? ` • ${item.vendorName}` : ''}
                            </div>
                          </td>
                          <td className="px-3 py-4 align-top text-sm font-bold text-slate-700">
                            {item.stageName || 'Belum ditautkan'}
                          </td>
                          <td className="px-3 py-4 align-top">
                            <div className="text-sm font-black text-slate-900">{formatRupiah(item.plannedTotal)}</div>
                            <div className="mt-1 text-xs font-medium text-slate-500">
                              {item.plannedQuantity} x {formatRupiah(item.plannedUnitCost)}
                            </div>
                          </td>
                          <td className="px-3 py-4 align-top">
                            <div className="text-sm font-black text-slate-900">{formatRupiah(item.actualTotal)}</div>
                            <div className="mt-1 text-xs font-medium text-slate-500">
                              {item.actualQuantity} x {formatRupiah(item.actualUnitCost)}
                            </div>
                          </td>
                          <td className="px-3 py-4 align-top">
                            <div className={`text-sm font-black ${variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {formatRupiah(variance)}
                            </div>
                          </td>
                          <td className="rounded-r-[24px] px-3 py-4 align-top">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditBudgetModal(item)}
                                className="rounded-2xl bg-white p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                                aria-label="Edit item budget"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBudgetItem(item.id)}
                                className="rounded-2xl bg-white p-2 text-rose-500 transition hover:bg-rose-50"
                                aria-label="Hapus item budget"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Progress Log</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Catatan Lapangan Harian</h2>
              </div>
              <button
                type="button"
                onClick={openCreateProgressModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#e07a5f] px-4 py-3 text-sm font-black text-white transition hover:bg-[#cf694c]"
              >
                <Plus size={16} />
                Tambah Log
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {progressLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-medium text-slate-500">
                  Belum ada log harian. Mulai catat progres lapangan, cuaca, issue, dan bukti pekerjaan.
                </div>
              ) : (
                progressLogs.map((log) => (
                  <article key={log.id} className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            {log.entryDate ? formatDate(log.entryDate, 'short') : 'Tanpa tanggal'}
                          </span>
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                            {log.progressPercent}%
                          </span>
                          {log.stageName ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                              {log.stageName}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="text-lg font-semibold tracking-tight text-slate-900">{log.summary}</h3>
                        {log.weather ? (
                          <div className="text-sm font-bold text-slate-500">Cuaca: {log.weather}</div>
                        ) : null}
                        {log.issueNotes ? (
                          <p className="text-sm font-medium leading-6 text-slate-600">{log.issueNotes}</p>
                        ) : null}
                        {log.evidenceUrls.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {log.evidenceUrls.map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600 transition hover:bg-slate-200"
                              >
                                Bukti
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditProgressModal(log)}
                          className="rounded-2xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                          aria-label="Edit progress log"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProgressLog(log.id)}
                          className="rounded-2xl bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                          aria-label="Hapus progress log"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Change Order</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Register Perubahan Scope</h2>
              </div>
              <button
                type="button"
                onClick={openCreateChangeOrderModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#d97706] px-4 py-3 text-sm font-black text-white transition hover:bg-[#b86105]"
              >
                <Plus size={16} />
                Tambah CO
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {changeOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-medium text-slate-500">
                  Belum ada change order. Catat pekerjaan tambah/kurang, revisi desain, atau perpanjangan waktu di sini.
                </div>
              ) : (
                changeOrders.map((changeOrder) => {
                  const canSubmitApproval = (
                    changeOrder.approvalStatus !== 'PENDING'
                    && changeOrder.status !== 'APPROVED'
                    && changeOrder.status !== 'IMPLEMENTED'
                  )

                  return (
                  <article key={changeOrder.id} className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            {changeOrder.referenceNo || 'Tanpa Ref'}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${changeOrderStatusStyles[changeOrder.status] || changeOrderStatusStyles.PROPOSED}`}>
                            {changeOrder.status}
                          </span>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                            {changeOrderTypeLabels[changeOrder.changeType] || changeOrder.changeType}
                          </span>
                          {changeOrder.stageName ? (
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                              {changeOrder.stageName}
                            </span>
                          ) : null}
                          {changeOrder.approvalStatus ? (
                            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${approvalStatusStyles[changeOrder.approvalStatus] || approvalStatusStyles.CANCELLED}`}>
                              Approval {changeOrder.approvalStatus}
                            </span>
                          ) : null}
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold tracking-tight text-slate-900">{changeOrder.title}</h3>
                          <div className="mt-1 text-sm font-medium text-slate-500">
                            Request: {changeOrder.requestedDate ? formatDate(changeOrder.requestedDate, 'short') : 'Belum diisi'}
                            {changeOrder.effectiveDate ? ` • Berlaku: ${formatDate(changeOrder.effectiveDate, 'short')}` : ''}
                            {changeOrder.approvedDate ? ` • Approved: ${formatDate(changeOrder.approvedDate, 'short')}` : ''}
                            {changeOrder.approvalRequestedAt ? ` • Approval req: ${formatDate(changeOrder.approvalRequestedAt, 'short')}` : ''}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-sm font-medium text-slate-600 md:grid-cols-3">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Delta Kontrak</div>
                            <div className={`mt-1 font-black ${getCurrencyDeltaClass(changeOrder.contractValueDelta, 'text-emerald-700', 'text-rose-700')}`}>
                              {formatSignedCurrency(changeOrder.contractValueDelta)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Delta Cost</div>
                            <div className={`mt-1 font-black ${getCurrencyDeltaClass(changeOrder.estimatedCostDelta, 'text-rose-700', 'text-emerald-700')}`}>
                              {formatSignedCurrency(changeOrder.estimatedCostDelta)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Delta Waktu</div>
                            <div className={`mt-1 font-black ${getCurrencyDeltaClass(changeOrder.scheduleDeltaDays, 'text-amber-700', 'text-emerald-700')}`}>
                              {formatSignedDays(changeOrder.scheduleDeltaDays)}
                            </div>
                          </div>
                        </div>

                        {changeOrder.reason ? (
                          <p className="text-sm font-medium leading-6 text-slate-600">{changeOrder.reason}</p>
                        ) : null}
                        {changeOrder.notes ? (
                          <p className="text-sm font-medium leading-6 text-slate-500">{changeOrder.notes}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {canSubmitApproval ? (
                          <button
                            type="button"
                            onClick={() => handleSubmitChangeOrderApproval(changeOrder.id)}
                            disabled={submittingApprovalId === changeOrder.id}
                            className="rounded-2xl bg-[#003366] px-4 py-2 text-xs font-black text-white transition hover:bg-[#00284f] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {submittingApprovalId === changeOrder.id ? 'Mengirim...' : 'Kirim Approval'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openEditChangeOrderModal(changeOrder)}
                          className="rounded-2xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                          aria-label="Edit change order"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChangeOrder(changeOrder.id)}
                          className="rounded-2xl bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                          aria-label="Hapus change order"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                )})
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Stage Breakdown</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Tahap Pekerjaan</h2>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {stages.map((stage) => (
                <article key={stage.id} className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{stage.stageCode}</div>
                      <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{stage.stageName}</h3>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${stageStatusStyles[stage.status] || stageStatusStyles.NOT_STARTED}`}>
                      {stage.status}
                    </span>
                  </div>

                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bobot</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{stage.weightPercent}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Progress</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{stage.progressPercent}%</div>
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#254b63] via-[#3b6b5a] to-[#e07a5f]"
                      style={{ width: `${Math.min(Math.max(stage.progressPercent, 0), 100)}%` }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>{stage.plannedStartDate ? formatDate(stage.plannedStartDate, 'short') : 'Mulai TBD'}</span>
                    <span>{stage.plannedEndDate ? formatDate(stage.plannedEndDate, 'short') : 'Target TBD'}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Snapshot Project</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Update Ringkasan</h2>
              </div>
              <button
                type="button"
                onClick={handleProjectSave}
                disabled={isSavingProject}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#e07a5f] px-4 py-3 text-sm font-black text-white transition hover:bg-[#cf694c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {isSavingProject ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Nama Project</span>
                <input
                  value={projectForm.projectName}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, projectName: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Status</span>
                  <select
                    value={projectForm.projectStatus}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, projectStatus: event.target.value as ConstructionProjectSnapshotInput['projectStatus'] }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="TENDER">Tender</option>
                    <option value="DESIGN">Design</option>
                    <option value="EXECUTION">Execution</option>
                    <option value="HANDOVER">Handover</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Tipe</span>
                  <select
                    value={projectForm.projectType}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, projectType: event.target.value as ConstructionProjectSnapshotInput['projectType'] }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    <option value="ARCHITECT">Arsitek</option>
                    <option value="CONTRACTOR">Kontraktor</option>
                    <option value="DESIGN_BUILD">Design &amp; Build</option>
                    <option value="INTERIOR">Interior</option>
                    <option value="CONSULTING">Konsultan</option>
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Klien</span>
                <select
                  value={projectForm.clientContactId || ''}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, clientContactId: event.target.value || null }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                >
                  <option value="">Belum ditautkan</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}{contact.type ? ` (${contact.type})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Alamat Site</span>
                <textarea
                  value={projectForm.siteAddress}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, siteAddress: event.target.value }))}
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Progress</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={projectForm.progressPercent}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, progressPercent: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Nilai Kontrak</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={projectForm.contractValue}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, contractValue: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Estimasi Cost</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={projectForm.estimatedCost}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, estimatedCost: Number(event.target.value) || 0 }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              <div className="grid grid-cols-1 gap-3">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Mulai</span>
                  <input
                    type="date"
                    value={projectForm.startDate || ''}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, startDate: event.target.value || null }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Target Selesai</span>
                  <input
                    type="date"
                    value={projectForm.targetEndDate || ''}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, targetEndDate: event.target.value || null }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Actual Finish</span>
                  <input
                    type="date"
                    value={projectForm.actualEndDate || ''}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, actualEndDate: event.target.value || null }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Catatan</span>
                <textarea
                  value={projectForm.notes}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              {projectError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {projectError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Termin Billing</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Jadwal Penagihan</h2>
              </div>
              <button
                type="button"
                onClick={openCreateBillingModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#254b63] px-4 py-3 text-sm font-black text-white transition hover:bg-[#1e3d52]"
              >
                <Plus size={16} />
                Tambah Termin
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {billingTerms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-medium text-slate-500">
                  Belum ada termin billing. Tambahkan DP, progress billing, final, atau retensi.
                </div>
              ) : (
                billingTerms.map((term) => (
                  <article key={term.id} className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Termin {term.sequenceNo}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${billingStatusStyles[term.status] || billingStatusStyles.PLANNED}`}>
                            {term.status}
                          </span>
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                            {billingBasisLabels[term.basisType] || term.basisType}
                          </span>
                        </div>

                        <h3 className="text-lg font-semibold tracking-tight text-slate-900">{term.termLabel}</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm font-medium text-slate-600 md:grid-cols-3">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Amount</div>
                            <div className="mt-1 font-black text-slate-900">{formatRupiah(term.billingAmount)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Billing %</div>
                            <div className="mt-1 font-black text-slate-900">{term.billingPercent}%</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Target Progress</div>
                            <div className="mt-1 font-black text-slate-900">{term.progressTargetPercent}%</div>
                          </div>
                        </div>
                        <div className="text-sm font-medium text-slate-500">
                          Due: {term.dueDate ? formatDate(term.dueDate, 'short') : 'Belum diisi'}
                          {term.invoiceReference ? ` • Invoice: ${term.invoiceReference}` : ''}
                        </div>
                        {term.notes ? (
                          <p className="text-sm font-medium leading-6 text-slate-600">{term.notes}</p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditBillingModal(term)}
                          className="rounded-2xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                          aria-label="Edit termin billing"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBillingTerm(term.id)}
                          className="rounded-2xl bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                          aria-label="Hapus termin billing"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Timeline</div>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <Calendar size={18} className="mt-0.5 text-slate-400" />
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Mulai</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{project.startDate ? formatDate(project.startDate) : 'Belum diisi'}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar size={18} className="mt-0.5 text-slate-400" />
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Target</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{project.targetEndDate ? formatDate(project.targetEndDate) : 'Belum diisi'}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar size={18} className="mt-0.5 text-slate-400" />
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Actual Finish</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{project.actualEndDate ? formatDate(project.actualEndDate) : 'Belum diisi'}</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {showBudgetModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setShowBudgetModal(false)}
            aria-label="Tutup modal"
          />

          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">RAB / BoQ</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {budgetForm.id ? 'Edit Item Budget' : 'Tambah Item Budget'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowBudgetModal(false)}
                className="rounded-2xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBudgetSave} className="space-y-5 px-6 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Tahap</span>
                  <select
                    value={budgetForm.stageId}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, stageId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    <option value="">Belum ditautkan</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.stageName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Kategori</span>
                  <select
                    value={budgetForm.category}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, category: event.target.value as ConstructionBudgetCategory }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    {Object.entries(budgetCategoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.45fr]">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Deskripsi</span>
                  <input
                    value={budgetForm.description}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">UoM</span>
                  <input
                    value={budgetForm.uom}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, uom: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Qty Plan</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={budgetForm.plannedQuantity}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, plannedQuantity: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Harga Plan</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetForm.plannedUnitCost}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, plannedUnitCost: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Qty Actual</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={budgetForm.actualQuantity}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, actualQuantity: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Harga Actual</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetForm.actualUnitCost}
                    onChange={(event) => setBudgetForm((prev) => ({ ...prev, actualUnitCost: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Vendor / Subkon</span>
                <select
                  value={budgetForm.vendorContactId}
                  onChange={(event) => setBudgetForm((prev) => ({ ...prev, vendorContactId: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                >
                  <option value="">Belum ditautkan</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}{contact.type ? ` (${contact.type})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Catatan</span>
                <textarea
                  value={budgetForm.notes}
                  onChange={(event) => setBudgetForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              {budgetError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {budgetError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingBudget}
                  className="rounded-2xl bg-[#254b63] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#254b63]/20 transition hover:bg-[#1e3d52] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingBudget ? 'Menyimpan...' : 'Simpan Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showProgressModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setShowProgressModal(false)}
            aria-label="Tutup modal"
          />

          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Progress Log</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {progressForm.id ? 'Edit Progress Log' : 'Tambah Progress Log'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
                className="rounded-2xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProgressSave} className="space-y-5 px-6 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Tahap</span>
                  <select
                    value={progressForm.stageId}
                    onChange={(event) => setProgressForm((prev) => ({ ...prev, stageId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    <option value="">Belum ditautkan</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.stageName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Tanggal</span>
                  <input
                    type="date"
                    value={progressForm.entryDate}
                    onChange={(event) => setProgressForm((prev) => ({ ...prev, entryDate: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Progress %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={progressForm.progressPercent}
                    onChange={(event) => setProgressForm((prev) => ({ ...prev, progressPercent: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Cuaca</span>
                  <input
                    value={progressForm.weather}
                    onChange={(event) => setProgressForm((prev) => ({ ...prev, weather: event.target.value }))}
                    placeholder="Cerah / Hujan / Mendung"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Ringkasan</span>
                <textarea
                  value={progressForm.summary}
                  onChange={(event) => setProgressForm((prev) => ({ ...prev, summary: event.target.value }))}
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Issue / Kendala</span>
                <textarea
                  value={progressForm.issueNotes}
                  onChange={(event) => setProgressForm((prev) => ({ ...prev, issueNotes: event.target.value }))}
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Evidence URLs</span>
                <textarea
                  value={progressForm.evidenceUrlsText}
                  onChange={(event) => setProgressForm((prev) => ({ ...prev, evidenceUrlsText: event.target.value }))}
                  placeholder="Satu URL per baris"
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              {progressError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {progressError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProgress}
                  className="rounded-2xl bg-[#e07a5f] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#e07a5f]/20 transition hover:bg-[#cf694c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingProgress ? 'Menyimpan...' : 'Simpan Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showChangeOrderModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setShowChangeOrderModal(false)}
            aria-label="Tutup modal"
          />

          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Change Order</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {changeOrderForm.id ? 'Edit Change Order' : 'Tambah Change Order'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeOrderModal(false)}
                className="rounded-2xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangeOrderSave} className="space-y-5 px-6 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[0.7fr_1.3fr_1fr]">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Ref No</span>
                  <input
                    value={changeOrderForm.referenceNo}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, referenceNo: event.target.value }))}
                    placeholder="CO-001"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Judul Perubahan</span>
                  <input
                    value={changeOrderForm.title}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Tahap</span>
                  <select
                    value={changeOrderForm.stageId}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, stageId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    <option value="">Semua tahap</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.stageName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Tipe</span>
                  <select
                    value={changeOrderForm.changeType}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, changeType: event.target.value as ConstructionChangeOrderType }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    {Object.entries(changeOrderTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Status</span>
                  <select
                    value={changeOrderForm.status}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, status: event.target.value as ConstructionChangeOrderStatus }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    <option value="PROPOSED">Proposed</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="IMPLEMENTED">Implemented</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Requested Date</span>
                  <input
                    type="date"
                    value={changeOrderForm.requestedDate}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, requestedDate: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Approved Date</span>
                  <input
                    type="date"
                    value={changeOrderForm.approvedDate}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, approvedDate: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Effective Date</span>
                  <input
                    type="date"
                    value={changeOrderForm.effectiveDate}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, effectiveDate: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Delta Kontrak</span>
                  <input
                    type="number"
                    step="0.01"
                    value={changeOrderForm.contractValueDelta}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, contractValueDelta: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Delta Cost</span>
                  <input
                    type="number"
                    step="0.01"
                    value={changeOrderForm.estimatedCostDelta}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, estimatedCostDelta: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Delta Waktu (hari)</span>
                  <input
                    type="number"
                    step="1"
                    value={changeOrderForm.scheduleDeltaDays}
                    onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, scheduleDeltaDays: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Alasan / Scope Perubahan</span>
                <textarea
                  value={changeOrderForm.reason}
                  onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, reason: event.target.value }))}
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Catatan</span>
                <textarea
                  value={changeOrderForm.notes}
                  onChange={(event) => setChangeOrderForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              {changeOrderError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {changeOrderError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => setShowChangeOrderModal(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingChangeOrder}
                  className="rounded-2xl bg-[#d97706] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#d97706]/20 transition hover:bg-[#b86105] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingChangeOrder ? 'Menyimpan...' : 'Simpan Change Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showBillingModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setShowBillingModal(false)}
            aria-label="Tutup modal"
          />

          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Termin Billing</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {billingForm.id ? 'Edit Termin Billing' : 'Tambah Termin Billing'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowBillingModal(false)}
                className="rounded-2xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBillingSave} className="space-y-5 px-6 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.45fr]">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Label Termin</span>
                  <input
                    value={billingForm.termLabel}
                    onChange={(event) => setBillingForm((prev) => ({ ...prev, termLabel: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Urutan</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={billingForm.sequenceNo}
                    onChange={(event) => setBillingForm((prev) => ({ ...prev, sequenceNo: Number(event.target.value) || 1 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Basis</span>
                  <select
                    value={billingForm.basisType}
                    onChange={(event) => setBillingForm((prev) => ({ ...prev, basisType: event.target.value as ConstructionBillingBasisType }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    {Object.entries(billingBasisLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Status</span>
                  <select
                    value={billingForm.status}
                    onChange={(event) => setBillingForm((prev) => ({ ...prev, status: event.target.value as ConstructionBillingStatus }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="READY_TO_BILL">Ready to Bill</option>
                    <option value="BILLED">Billed</option>
                    <option value="PAID">Paid</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Target Progress %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={billingForm.progressTargetPercent}
                    onChange={(event) => setBillingForm((prev) => ({ ...prev, progressTargetPercent: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Billing %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={billingForm.billingPercent}
                    onChange={(event) => setBillingForm((prev) => ({ ...prev, billingPercent: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Nominal</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billingForm.billingAmount}
                    onChange={(event) => setBillingForm((prev) => ({ ...prev, billingAmount: Number(event.target.value) || 0 }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Due Date</span>
                  <input
                    type="date"
                    value={billingForm.dueDate}
                    onChange={(event) => setBillingForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Paid Date</span>
                  <input
                    type="date"
                    value={billingForm.paidDate}
                    onChange={(event) => setBillingForm((prev) => ({ ...prev, paidDate: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Invoice Reference</span>
                <input
                  value={billingForm.invoiceReference}
                  onChange={(event) => setBillingForm((prev) => ({ ...prev, invoiceReference: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Catatan</span>
                <textarea
                  value={billingForm.notes}
                  onChange={(event) => setBillingForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#254b63] focus:bg-white"
                />
              </label>

              {billingError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {billingError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => setShowBillingModal(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingBilling}
                  className="rounded-2xl bg-[#254b63] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#254b63]/20 transition hover:bg-[#1e3d52] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingBilling ? 'Menyimpan...' : 'Simpan Termin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
