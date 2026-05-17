'use server'

import type { LooseDb } from '@/lib/supabase/loose'
import { createClient } from '@/lib/supabase/server'
import { getServerAuthContext } from '@/lib/supabase/auth.server'
import { revalidatePath } from 'next/cache'
import { getBranchAccessScope, resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import type {
  ConstructionBillingBasisType,
  ConstructionBillingStatus,
  ConstructionBillingTermInput,
  ConstructionBillingTermRecord,
  ConstructionChangeOrderInput,
  ConstructionChangeOrderRecord,
  ConstructionChangeOrderStatus,
  ConstructionChangeOrderType,
  ConstructionBudgetCategory,
  ConstructionBudgetItemInput,
  ConstructionBudgetItemRecord,
  ConstructionDashboardSummary,
  ConstructionProgressLogInput,
  ConstructionProgressLogRecord,
  ConstructionProjectRecord,
  ConstructionProjectSnapshotInput,
  ConstructionProjectStageRecord,
  ConstructionProjectStatus,
  ConstructionProjectType,
} from '@/modules/construction/lib/construction'

type BranchResult =
  | { branchId: string | null }
  | { error: string }

const DEFAULT_STAGE_BLUEPRINTS = [
  { stageCode: 'PLANNING', stageName: 'Perencanaan', weightPercent: 15 },
  { stageCode: 'PROCUREMENT', stageName: 'Pengadaan', weightPercent: 20 },
  { stageCode: 'EXECUTION', stageName: 'Pelaksanaan', weightPercent: 50 },
  { stageCode: 'HANDOVER', stageName: 'Serah Terima', weightPercent: 15 },
] as const

const CONSTRUCTION_BUDGET_CATEGORIES: readonly ConstructionBudgetCategory[] = [
  'MATERIAL',
  'LABOR',
  'SUBCON',
  'EQUIPMENT',
  'OTHER',
] as const

const CONSTRUCTION_BILLING_BASIS_TYPES: readonly ConstructionBillingBasisType[] = [
  'DOWN_PAYMENT',
  'PROGRESS',
  'FINAL',
  'RETENTION',
  'CUSTOM',
] as const

const CONSTRUCTION_BILLING_STATUSES: readonly ConstructionBillingStatus[] = [
  'PLANNED',
  'READY_TO_BILL',
  'BILLED',
  'PAID',
] as const

const CONSTRUCTION_CHANGE_ORDER_TYPES: readonly ConstructionChangeOrderType[] = [
  'ADDITIONAL_WORK',
  'DEDUCTION',
  'SUBSTITUTION',
  'TIME_EXTENSION',
  'DESIGN_REVISION',
] as const

const CONSTRUCTION_CHANGE_ORDER_STATUSES: readonly ConstructionChangeOrderStatus[] = [
  'PROPOSED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'IMPLEMENTED',
] as const

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

function normalizeRequiredText(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

function normalizeNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || '0').replace(/,/g, ''))
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0
  return parsed
}

function sanitizeNumber(value: number | null | undefined) {
  const parsed = Number(value ?? 0)
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0
  return parsed
}

function sanitizeInteger(value: number | null | undefined, fallback = 1) {
  const parsed = Math.trunc(Number(value ?? fallback))
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function sanitizeSignedInteger(value: number | null | undefined) {
  const parsed = Math.trunc(Number(value ?? 0))
  if (!Number.isFinite(parsed)) return 0
  return parsed
}

function sanitizeStringArray(values: string[] | null | undefined) {
  if (!Array.isArray(values)) return []
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
}

function normalizeProjectType(value: string): ConstructionProjectType {
  const normalized = value.trim().toUpperCase()
  if (
    normalized === 'ARCHITECT' ||
    normalized === 'CONTRACTOR' ||
    normalized === 'DESIGN_BUILD' ||
    normalized === 'INTERIOR' ||
    normalized === 'CONSULTING'
  ) {
    return normalized
  }

  return 'CONTRACTOR'
}

function normalizeProjectStatus(value: string): ConstructionProjectStatus {
  const normalized = value.trim().toUpperCase()
  if (
    normalized === 'PLANNING' ||
    normalized === 'TENDER' ||
    normalized === 'DESIGN' ||
    normalized === 'EXECUTION' ||
    normalized === 'HANDOVER' ||
    normalized === 'COMPLETED' ||
    normalized === 'ON_HOLD' ||
    normalized === 'CANCELLED'
  ) {
    return normalized
  }

  return 'PLANNING'
}

function normalizeBudgetCategory(value: string): ConstructionBudgetCategory {
  const normalized = value.trim().toUpperCase() as ConstructionBudgetCategory
  return CONSTRUCTION_BUDGET_CATEGORIES.includes(normalized) ? normalized : 'MATERIAL'
}

function normalizeBillingBasisType(value: string): ConstructionBillingBasisType {
  const normalized = value.trim().toUpperCase() as ConstructionBillingBasisType
  return CONSTRUCTION_BILLING_BASIS_TYPES.includes(normalized) ? normalized : 'PROGRESS'
}

function normalizeBillingStatus(value: string): ConstructionBillingStatus {
  const normalized = value.trim().toUpperCase() as ConstructionBillingStatus
  return CONSTRUCTION_BILLING_STATUSES.includes(normalized) ? normalized : 'PLANNED'
}

function normalizeChangeOrderType(value: string): ConstructionChangeOrderType {
  const normalized = value.trim().toUpperCase() as ConstructionChangeOrderType
  return CONSTRUCTION_CHANGE_ORDER_TYPES.includes(normalized) ? normalized : 'ADDITIONAL_WORK'
}

function normalizeChangeOrderStatus(value: string): ConstructionChangeOrderStatus {
  const normalized = value.trim().toUpperCase() as ConstructionChangeOrderStatus
  return CONSTRUCTION_CHANGE_ORDER_STATUSES.includes(normalized) ? normalized : 'PROPOSED'
}

function mapProjectRow(row: Record<string, unknown>): ConstructionProjectRecord {
  const branch = (row.branch as { id?: unknown; name?: unknown; code?: unknown } | null) || null
  const client = (row.client as { id?: unknown; name?: unknown; type?: unknown } | null) || null

  return {
    id: String(row.id || ''),
    projectCode: String(row.project_code || ''),
    projectName: String(row.project_name || ''),
    projectType: normalizeProjectType(String(row.project_type || 'CONTRACTOR')),
    projectStatus: normalizeProjectStatus(String(row.project_status || 'PLANNING')),
    siteAddress: String(row.site_address || ''),
    contractValue: Number(row.contract_value || 0),
    estimatedCost: Number(row.estimated_cost || 0),
    progressPercent: Number(row.progress_percent || 0),
    notes: String(row.notes || ''),
    startDate: typeof row.start_date === 'string' ? row.start_date : null,
    targetEndDate: typeof row.target_end_date === 'string' ? row.target_end_date : null,
    actualEndDate: typeof row.actual_end_date === 'string' ? row.actual_end_date : null,
    branchId: String(branch?.id || row.branch_id || ''),
    branchName: String(branch?.name || ''),
    branchCode: String(branch?.code || ''),
    clientContactId: client?.id ? String(client.id) : null,
    clientName: String(client?.name || ''),
    clientType: String(client?.type || ''),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

function mapStageRow(row: Record<string, unknown>): ConstructionProjectStageRecord {
  return {
    id: String(row.id || ''),
    projectId: String(row.project_id || ''),
    stageCode: String(row.stage_code || ''),
    stageName: String(row.stage_name || ''),
    sortOrder: Number(row.sort_order || 0),
    weightPercent: Number(row.weight_percent || 0),
    status: String(row.status || 'NOT_STARTED') as ConstructionProjectStageRecord['status'],
    progressPercent: Number(row.progress_percent || 0),
    plannedStartDate: typeof row.planned_start_date === 'string' ? row.planned_start_date : null,
    plannedEndDate: typeof row.planned_end_date === 'string' ? row.planned_end_date : null,
    actualStartDate: typeof row.actual_start_date === 'string' ? row.actual_start_date : null,
    actualEndDate: typeof row.actual_end_date === 'string' ? row.actual_end_date : null,
    notes: String(row.notes || ''),
  }
}

function mapBudgetItemRow(row: Record<string, unknown>): ConstructionBudgetItemRecord {
  const stage = (row.stage as { id?: unknown; stage_name?: unknown } | null) || null
  const vendor = (row.vendor as { id?: unknown; name?: unknown } | null) || null

  return {
    id: String(row.id || ''),
    projectId: String(row.project_id || ''),
    stageId: stage?.id ? String(stage.id) : (row.stage_id ? String(row.stage_id) : null),
    stageName: String(stage?.stage_name || ''),
    category: normalizeBudgetCategory(String(row.category || 'MATERIAL')),
    description: String(row.description || ''),
    uom: String(row.uom || ''),
    plannedQuantity: Number(row.planned_quantity || 0),
    plannedUnitCost: Number(row.planned_unit_cost || 0),
    plannedTotal: Number(row.planned_total || 0),
    actualQuantity: Number(row.actual_quantity || 0),
    actualUnitCost: Number(row.actual_unit_cost || 0),
    actualTotal: Number(row.actual_total || 0),
    vendorContactId: vendor?.id ? String(vendor.id) : (row.vendor_contact_id ? String(row.vendor_contact_id) : null),
    vendorName: String(vendor?.name || ''),
    notes: String(row.notes || ''),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

function mapProgressLogRow(row: Record<string, unknown>): ConstructionProgressLogRecord {
  const stage = (row.stage as { id?: unknown; stage_name?: unknown } | null) || null
  const evidenceUrlsRaw = Array.isArray(row.evidence_urls) ? row.evidence_urls : []

  return {
    id: String(row.id || ''),
    projectId: String(row.project_id || ''),
    stageId: stage?.id ? String(stage.id) : (row.stage_id ? String(row.stage_id) : null),
    stageName: String(stage?.stage_name || ''),
    entryDate: typeof row.entry_date === 'string' ? row.entry_date : null,
    progressPercent: Number(row.progress_percent || 0),
    weather: String(row.weather || ''),
    summary: String(row.summary || ''),
    issueNotes: String(row.issue_notes || ''),
    evidenceUrls: evidenceUrlsRaw.map((value) => String(value || '')).filter(Boolean),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
  }
}

function mapBillingTermRow(row: Record<string, unknown>): ConstructionBillingTermRecord {
  return {
    id: String(row.id || ''),
    projectId: String(row.project_id || ''),
    termLabel: String(row.term_label || ''),
    sequenceNo: Number(row.sequence_no || 0),
    basisType: normalizeBillingBasisType(String(row.basis_type || 'PROGRESS')),
    progressTargetPercent: Number(row.progress_target_percent || 0),
    billingPercent: Number(row.billing_percent || 0),
    billingAmount: Number(row.billing_amount || 0),
    status: normalizeBillingStatus(String(row.status || 'PLANNED')),
    invoiceReference: String(row.invoice_reference || ''),
    dueDate: typeof row.due_date === 'string' ? row.due_date : null,
    paidDate: typeof row.paid_date === 'string' ? row.paid_date : null,
    notes: String(row.notes || ''),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

function mapChangeOrderRow(row: Record<string, unknown>): ConstructionChangeOrderRecord {
  const stage = (row.stage as { id?: unknown; stage_name?: unknown } | null) || null

  return {
    id: String(row.id || ''),
    projectId: String(row.project_id || ''),
    stageId: stage?.id ? String(stage.id) : (row.stage_id ? String(row.stage_id) : null),
    stageName: String(stage?.stage_name || ''),
    referenceNo: String(row.reference_no || ''),
    title: String(row.title || ''),
    changeType: normalizeChangeOrderType(String(row.change_type || 'ADDITIONAL_WORK')),
    status: normalizeChangeOrderStatus(String(row.status || 'PROPOSED')),
    requestedDate: typeof row.requested_date === 'string' ? row.requested_date : null,
    approvedDate: typeof row.approved_date === 'string' ? row.approved_date : null,
    effectiveDate: typeof row.effective_date === 'string' ? row.effective_date : null,
    contractValueDelta: Number(row.contract_value_delta || 0),
    estimatedCostDelta: Number(row.estimated_cost_delta || 0),
    scheduleDeltaDays: sanitizeSignedInteger(Number(row.schedule_delta_days || 0)),
    reason: String(row.reason || ''),
    notes: String(row.notes || ''),
    approvalRequestId: null,
    approvalStatus: null,
    approvalRequestedAt: null,
    approvalDecidedAt: null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

async function getAccessibleConstructionProjectRow(orgId: string, projectId: string) {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const scope = await getBranchAccessScope(orgId)
  if (!scope.role || scope.accessibleBranchIds.length === 0) {
    return { error: 'Akses unit tidak ditemukan.' as const }
  }

  const { data, error } = await db
    .from('construction_projects')
    .select(`
      *,
      branch:branches(id, name, code),
      client:contacts(id, name, type)
    `)
    .eq('org_id', orgId)
    .eq('id', projectId)
    .maybeSingle()

  if (error) return { error: error.message as const }
  if (!data) return { error: 'Project tidak ditemukan.' as const }

  const project = mapProjectRow((data as Record<string, unknown>) || {})
  if (!scope.accessibleBranchIds.includes(project.branchId)) {
    return { error: 'Anda tidak memiliki akses ke unit project ini.' as const }
  }

  return { project }
}

async function resolveConstructionBranchSelection(orgId: string, branchId?: string | null): Promise<BranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function requireCreateBranchId(orgId: string): Promise<{ branchId: string } | { error: string }> {
  const branchSelection = await resolveConstructionBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk membuat project konstruksi.' }
  }

  return { branchId: branchSelection.branchId }
}

/**
 * Mengambil daftar project untuk dashboard awal construction.
 */
export async function getConstructionProjects(orgId: string, branchId?: string | null): Promise<ConstructionProjectRecord[]> {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const branchSelection = await resolveConstructionBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = db
    .from('construction_projects')
    .select(`
      *,
      branch:branches(id, name, code),
      client:contacts(id, name, type)
    `)
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching construction projects:', error)
    return []
  }

  return Array.isArray(data)
    ? data.map((row) => mapProjectRow((row as Record<string, unknown>) || {}))
    : []
}

/**
 * Mengambil satu project tertentu dengan validasi akses cabang.
 */
export async function getConstructionProjectById(orgId: string, projectId: string): Promise<ConstructionProjectRecord | null> {
  const result = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in result) return null
  return result.project
}

/**
 * Mengambil breakdown tahap project.
 */
export async function getConstructionProjectStages(
  orgId: string,
  projectId: string
): Promise<ConstructionProjectStageRecord[]> {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return []

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { data, error } = await db
    .from('construction_project_stages')
    .select('*')
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching construction stages:', error)
    return []
  }

  return Array.isArray(data)
    ? data.map((row) => mapStageRow((row as Record<string, unknown>) || {}))
    : []
}

/**
 * Mengambil item RAB/BoQ dan actual cost project.
 */
export async function getConstructionBudgetItems(
  orgId: string,
  projectId: string
): Promise<ConstructionBudgetItemRecord[]> {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return []

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { data, error } = await db
    .from('construction_budget_items')
    .select(`
      *,
      stage:construction_project_stages(id, stage_name),
      vendor:contacts(id, name)
    `)
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching construction budget items:', error)
    return []
  }

  return Array.isArray(data)
    ? data.map((row) => mapBudgetItemRow((row as Record<string, unknown>) || {}))
    : []
}

/**
 * Mengambil log progres harian project.
 */
export async function getConstructionProgressLogs(
  orgId: string,
  projectId: string
): Promise<ConstructionProgressLogRecord[]> {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return []

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { data, error } = await db
    .from('construction_progress_logs')
    .select(`
      *,
      stage:construction_project_stages(id, stage_name)
    `)
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching construction progress logs:', error)
    return []
  }

  return Array.isArray(data)
    ? data.map((row) => mapProgressLogRow((row as Record<string, unknown>) || {}))
    : []
}

/**
 * Mengambil termin billing project.
 */
export async function getConstructionBillingTerms(
  orgId: string,
  projectId: string
): Promise<ConstructionBillingTermRecord[]> {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return []

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { data, error } = await db
    .from('construction_billing_terms')
    .select('*')
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .order('sequence_no', { ascending: true })

  if (error) {
    console.error('Error fetching construction billing terms:', error)
    return []
  }

  return Array.isArray(data)
    ? data.map((row) => mapBillingTermRow((row as Record<string, unknown>) || {}))
    : []
}

/**
 * Mengambil daftar change order project.
 */
export async function getConstructionChangeOrders(
  orgId: string,
  projectId: string
): Promise<ConstructionChangeOrderRecord[]> {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return []

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { data, error } = await db
    .from('construction_change_orders')
    .select(`
      *,
      stage:construction_project_stages(id, stage_name)
    `)
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .order('requested_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching construction change orders:', error)
    return []
  }

  const changeOrders = Array.isArray(data)
    ? data.map((row) => mapChangeOrderRow((row as Record<string, unknown>) || {}))
    : []

  const changeOrderIds = changeOrders.map((changeOrder) => changeOrder.id).filter(Boolean)
  if (changeOrderIds.length === 0) return changeOrders

  const { data: approvalRows, error: approvalError } = await db
    .from('approval_requests')
    .select('id, source_id, status, requested_at, decided_at')
    .eq('org_id', orgId)
    .eq('source_type', 'CONSTRUCTION_CHANGE_ORDER')
    .in('source_id', changeOrderIds)
    .order('requested_at', { ascending: false })

  if (approvalError) {
    console.error('Error fetching construction change order approvals:', approvalError)
    return changeOrders
  }

  const latestApprovalBySourceId = new Map<string, {
    id: string
    status: string | null
    requestedAt: string | null
    decidedAt: string | null
  }>()

  for (const approvalRow of (approvalRows as Array<Record<string, unknown>> | null) || []) {
    const sourceId = String(approvalRow.source_id || '').trim()
    if (!sourceId || latestApprovalBySourceId.has(sourceId)) continue

    latestApprovalBySourceId.set(sourceId, {
      id: String(approvalRow.id || ''),
      status: typeof approvalRow.status === 'string' ? approvalRow.status : null,
      requestedAt: typeof approvalRow.requested_at === 'string' ? approvalRow.requested_at : null,
      decidedAt: typeof approvalRow.decided_at === 'string' ? approvalRow.decided_at : null,
    })
  }

  return changeOrders.map((changeOrder) => {
    const approval = latestApprovalBySourceId.get(changeOrder.id)
    if (!approval) return changeOrder

    return {
      ...changeOrder,
      approvalRequestId: approval.id || null,
      approvalStatus: approval.status,
      approvalRequestedAt: approval.requestedAt,
      approvalDecidedAt: approval.decidedAt,
    }
  })
}

export async function getConstructionDashboard(
  orgId: string,
  branchId?: string | null
): Promise<ConstructionDashboardSummary> {
  const projects = await getConstructionProjects(orgId, branchId)

  const totalProjects = projects.length
  const activeProjects = projects.filter((project) => (
    project.projectStatus !== 'COMPLETED' && project.projectStatus !== 'CANCELLED'
  )).length
  const completedProjects = projects.filter((project) => project.projectStatus === 'COMPLETED').length
  const totalContractValue = projects.reduce((sum, project) => sum + project.contractValue, 0)
  const totalEstimatedCost = projects.reduce((sum, project) => sum + project.estimatedCost, 0)
  const averageProgress = totalProjects > 0
    ? projects.reduce((sum, project) => sum + project.progressPercent, 0) / totalProjects
    : 0

  return {
    totalProjects,
    activeProjects,
    completedProjects,
    averageProgress,
    totalContractValue,
    totalEstimatedCost,
  }
}

/**
 * Membuat project baru beserta stage default agar modul siap dipakai.
 */
export async function createConstructionProject(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const activeBranch = await requireCreateBranchId(orgId)
  if ('error' in activeBranch) return { error: activeBranch.error }

  const projectName = normalizeRequiredText(formData.get('project_name'))
  if (!projectName) {
    return { error: 'Nama project wajib diisi.' }
  }

  const projectType = normalizeProjectType(normalizeRequiredText(formData.get('project_type')))
  const projectStatus = normalizeProjectStatus(normalizeRequiredText(formData.get('project_status')) || 'PLANNING')

  const payload = {
    org_id: orgId,
    branch_id: activeBranch.branchId,
    client_contact_id: normalizeOptionalText(formData.get('client_contact_id')),
    project_code: normalizeOptionalText(formData.get('project_code')),
    project_name: projectName,
    project_type: projectType,
    project_status: projectStatus,
    site_address: normalizeOptionalText(formData.get('site_address')),
    start_date: normalizeOptionalText(formData.get('start_date')),
    target_end_date: normalizeOptionalText(formData.get('target_end_date')),
    contract_value: normalizeNumber(formData.get('contract_value')),
    estimated_cost: normalizeNumber(formData.get('estimated_cost')),
    notes: normalizeOptionalText(formData.get('notes')),
  }

  const { data: insertedProject, error } = await db
    .from('construction_projects')
    .insert(payload)
    .select('id')
    .single()

  if (error) return { error: error.message }

  const projectId = String(insertedProject?.id || '')
  if (projectId) {
    const stagesPayload = DEFAULT_STAGE_BLUEPRINTS.map((stage, index) => ({
      org_id: orgId,
      project_id: projectId,
      stage_code: stage.stageCode,
      stage_name: stage.stageName,
      sort_order: index + 1,
      weight_percent: stage.weightPercent,
      status: index === 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
    }))

    const { error: stagesError } = await db
      .from('construction_project_stages')
      .insert(stagesPayload)

    if (stagesError) {
      console.error('Error seeding construction stages:', stagesError)
    }
  }

  revalidatePath('/construction')
  return { success: true }
}

/**
 * Memperbarui snapshot utama project dari halaman detail.
 */
export async function updateConstructionProjectSnapshot(
  orgId: string,
  projectId: string,
  input: ConstructionProjectSnapshotInput
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const projectName = String(input.projectName || '').trim()
  if (!projectName) {
    return { error: 'Nama project wajib diisi.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { error } = await db
    .from('construction_projects')
    .update({
      project_name: projectName,
      project_type: normalizeProjectType(String(input.projectType || 'CONTRACTOR')),
      project_status: normalizeProjectStatus(String(input.projectStatus || 'PLANNING')),
      site_address: normalizeOptionalString(input.siteAddress),
      progress_percent: Math.max(0, Math.min(100, sanitizeNumber(input.progressPercent))),
      contract_value: sanitizeNumber(input.contractValue),
      estimated_cost: sanitizeNumber(input.estimatedCost),
      start_date: normalizeOptionalString(input.startDate),
      target_end_date: normalizeOptionalString(input.targetEndDate),
      actual_end_date: normalizeOptionalString(input.actualEndDate),
      client_contact_id: normalizeOptionalString(input.clientContactId),
      notes: normalizeOptionalString(input.notes),
    })
    .eq('org_id', orgId)
    .eq('id', projectId)

  if (error) return { error: error.message }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  return { success: true }
}

/**
 * Auto-generate invoice dari billing term saat status → BILLED.
 * Calls RPC createInvoiceFromConstructionBillingTerm.
 */
export async function generateInvoiceFromBillingTerm(
  orgId: string,
  projectId: string,
  billingTermId: string,
  invoiceDate?: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBillingTermId = billingTermId.trim()
  if (!trimmedBillingTermId) {
    return { error: 'Billing term tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  // Call RPC
  const { data, error } = await db.rpc('createInvoiceFromConstructionBillingTerm', {
    p_org_id: orgId,
    p_billing_term_id: trimmedBillingTermId,
    p_invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
  })

  if (error) {
    return { error: error.message || 'Gagal generate invoice.' }
  }

  if (!data || !data[0]) {
    return { error: 'RPC response kosong.' }
  }

  const result = data[0]
  if (!result.success) {
    return { error: result.error_message || 'Gagal generate invoice.' }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  revalidatePath('/accounting/invoices')

  return {
    success: true,
    invoiceId: result.invoice_id,
    invoiceNumber: result.invoice_number,
  }
}

/**
 * Menambah atau memperbarui item RAB/BoQ.
 */
export async function upsertConstructionBudgetItem(
  orgId: string,
  projectId: string,
  input: ConstructionBudgetItemInput
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const description = String(input.description || '').trim()
  if (!description) {
    return { error: 'Deskripsi item RAB wajib diisi.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const payload = {
    org_id: orgId,
    project_id: projectId,
    stage_id: normalizeOptionalString(input.stageId),
    category: normalizeBudgetCategory(String(input.category || 'MATERIAL')),
    description,
    uom: normalizeOptionalString(input.uom),
    planned_quantity: sanitizeNumber(input.plannedQuantity),
    planned_unit_cost: sanitizeNumber(input.plannedUnitCost),
    actual_quantity: sanitizeNumber(input.actualQuantity),
    actual_unit_cost: sanitizeNumber(input.actualUnitCost),
    vendor_contact_id: normalizeOptionalString(input.vendorContactId),
    notes: normalizeOptionalString(input.notes),
  }

  const budgetItemId = String(input.id || '').trim()
  if (budgetItemId) {
    const { error } = await db
      .from('construction_budget_items')
      .update(payload)
      .eq('org_id', orgId)
      .eq('project_id', projectId)
      .eq('id', budgetItemId)

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('construction_budget_items')
      .insert(payload)

    if (error) return { error: error.message }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  return { success: true }
}

/**
 * Auto-generate invoice dari billing term saat status → BILLED.
 * Calls RPC createInvoiceFromConstructionBillingTerm.
 */
export async function generateInvoiceFromBillingTerm(
  orgId: string,
  projectId: string,
  billingTermId: string,
  invoiceDate?: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBillingTermId = billingTermId.trim()
  if (!trimmedBillingTermId) {
    return { error: 'Billing term tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  // Call RPC
  const { data, error } = await db.rpc('createInvoiceFromConstructionBillingTerm', {
    p_org_id: orgId,
    p_billing_term_id: trimmedBillingTermId,
    p_invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
  })

  if (error) {
    return { error: error.message || 'Gagal generate invoice.' }
  }

  if (!data || !data[0]) {
    return { error: 'RPC response kosong.' }
  }

  const result = data[0]
  if (!result.success) {
    return { error: result.error_message || 'Gagal generate invoice.' }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  revalidatePath('/accounting/invoices')

  return {
    success: true,
    invoiceId: result.invoice_id,
    invoiceNumber: result.invoice_number,
  }
}

/**
 * Menghapus item budget tertentu dari project.
 */
export async function deleteConstructionBudgetItem(
  orgId: string,
  projectId: string,
  budgetItemId: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBudgetItemId = budgetItemId.trim()
  if (!trimmedBudgetItemId) {
    return { error: 'Item budget tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { error } = await db
    .from('construction_budget_items')
    .delete()
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .eq('id', trimmedBudgetItemId)

  if (error) return { error: error.message }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  return { success: true }
}

/**
 * Auto-generate invoice dari billing term saat status → BILLED.
 * Calls RPC createInvoiceFromConstructionBillingTerm.
 */
export async function generateInvoiceFromBillingTerm(
  orgId: string,
  projectId: string,
  billingTermId: string,
  invoiceDate?: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBillingTermId = billingTermId.trim()
  if (!trimmedBillingTermId) {
    return { error: 'Billing term tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  // Call RPC
  const { data, error } = await db.rpc('createInvoiceFromConstructionBillingTerm', {
    p_org_id: orgId,
    p_billing_term_id: trimmedBillingTermId,
    p_invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
  })

  if (error) {
    return { error: error.message || 'Gagal generate invoice.' }
  }

  if (!data || !data[0]) {
    return { error: 'RPC response kosong.' }
  }

  const result = data[0]
  if (!result.success) {
    return { error: result.error_message || 'Gagal generate invoice.' }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  revalidatePath('/accounting/invoices')

  return {
    success: true,
    invoiceId: result.invoice_id,
    invoiceNumber: result.invoice_number,
  }
}

/**
 * Menambah atau memperbarui progress log harian project.
 */
export async function upsertConstructionProgressLog(
  orgId: string,
  projectId: string,
  input: ConstructionProgressLogInput
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const summary = String(input.summary || '').trim()
  if (!summary) {
    return { error: 'Ringkasan progress wajib diisi.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const payload = {
    org_id: orgId,
    project_id: projectId,
    stage_id: normalizeOptionalString(input.stageId),
    entry_date: normalizeOptionalString(input.entryDate),
    progress_percent: Math.max(0, Math.min(100, sanitizeNumber(input.progressPercent))),
    weather: normalizeOptionalString(input.weather),
    summary,
    issue_notes: normalizeOptionalString(input.issueNotes),
    evidence_urls: sanitizeStringArray(input.evidenceUrls),
  }

  const progressLogId = String(input.id || '').trim()
  if (progressLogId) {
    const { error } = await db
      .from('construction_progress_logs')
      .update(payload)
      .eq('org_id', orgId)
      .eq('project_id', projectId)
      .eq('id', progressLogId)

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('construction_progress_logs')
      .insert(payload)

    if (error) return { error: error.message }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  return { success: true }
}

/**
 * Auto-generate invoice dari billing term saat status → BILLED.
 * Calls RPC createInvoiceFromConstructionBillingTerm.
 */
export async function generateInvoiceFromBillingTerm(
  orgId: string,
  projectId: string,
  billingTermId: string,
  invoiceDate?: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBillingTermId = billingTermId.trim()
  if (!trimmedBillingTermId) {
    return { error: 'Billing term tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  // Call RPC
  const { data, error } = await db.rpc('createInvoiceFromConstructionBillingTerm', {
    p_org_id: orgId,
    p_billing_term_id: trimmedBillingTermId,
    p_invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
  })

  if (error) {
    return { error: error.message || 'Gagal generate invoice.' }
  }

  if (!data || !data[0]) {
    return { error: 'RPC response kosong.' }
  }

  const result = data[0]
  if (!result.success) {
    return { error: result.error_message || 'Gagal generate invoice.' }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  revalidatePath('/accounting/invoices')

  return {
    success: true,
    invoiceId: result.invoice_id,
    invoiceNumber: result.invoice_number,
  }
}

/**
 * Menghapus progress log harian.
 */
export async function deleteConstructionProgressLog(
  orgId: string,
  projectId: string,
  progressLogId: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedProgressLogId = progressLogId.trim()
  if (!trimmedProgressLogId) {
    return { error: 'Log progress tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { error } = await db
    .from('construction_progress_logs')
    .delete()
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .eq('id', trimmedProgressLogId)

  if (error) return { error: error.message }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  return { success: true }
}

/**
 * Auto-generate invoice dari billing term saat status → BILLED.
 * Calls RPC createInvoiceFromConstructionBillingTerm.
 */
export async function generateInvoiceFromBillingTerm(
  orgId: string,
  projectId: string,
  billingTermId: string,
  invoiceDate?: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBillingTermId = billingTermId.trim()
  if (!trimmedBillingTermId) {
    return { error: 'Billing term tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  // Call RPC
  const { data, error } = await db.rpc('createInvoiceFromConstructionBillingTerm', {
    p_org_id: orgId,
    p_billing_term_id: trimmedBillingTermId,
    p_invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
  })

  if (error) {
    return { error: error.message || 'Gagal generate invoice.' }
  }

  if (!data || !data[0]) {
    return { error: 'RPC response kosong.' }
  }

  const result = data[0]
  if (!result.success) {
    return { error: result.error_message || 'Gagal generate invoice.' }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  revalidatePath('/accounting/invoices')

  return {
    success: true,
    invoiceId: result.invoice_id,
    invoiceNumber: result.invoice_number,
  }
}

/**
 * Menambah atau memperbarui termin billing project.
 */
export async function upsertConstructionBillingTerm(
  orgId: string,
  projectId: string,
  input: ConstructionBillingTermInput
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const termLabel = String(input.termLabel || '').trim()
  if (!termLabel) {
    return { error: 'Label termin wajib diisi.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  let sequenceNo = sanitizeInteger(input.sequenceNo)

  if (!input.id && (!input.sequenceNo || input.sequenceNo <= 0)) {
    const existingTerms = await getConstructionBillingTerms(orgId, projectId)
    sequenceNo = existingTerms.length + 1
  }

  const payload = {
    org_id: orgId,
    project_id: projectId,
    term_label: termLabel,
    sequence_no: sequenceNo,
    basis_type: normalizeBillingBasisType(String(input.basisType || 'PROGRESS')),
    progress_target_percent: Math.max(0, Math.min(100, sanitizeNumber(input.progressTargetPercent))),
    billing_percent: Math.max(0, Math.min(100, sanitizeNumber(input.billingPercent))),
    billing_amount: sanitizeNumber(input.billingAmount),
    status: normalizeBillingStatus(String(input.status || 'PLANNED')),
    invoice_reference: normalizeOptionalString(input.invoiceReference),
    due_date: normalizeOptionalString(input.dueDate),
    paid_date: normalizeOptionalString(input.paidDate),
    notes: normalizeOptionalString(input.notes),
  }

  const billingTermId = String(input.id || '').trim()
  if (billingTermId) {
    const { error } = await db
      .from('construction_billing_terms')
      .update(payload)
      .eq('org_id', orgId)
      .eq('project_id', projectId)
      .eq('id', billingTermId)

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('construction_billing_terms')
      .insert(payload)

    if (error) return { error: error.message }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  return { success: true }
}

/**
 * Auto-generate invoice dari billing term saat status → BILLED.
 * Calls RPC createInvoiceFromConstructionBillingTerm.
 */
export async function generateInvoiceFromBillingTerm(
  orgId: string,
  projectId: string,
  billingTermId: string,
  invoiceDate?: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBillingTermId = billingTermId.trim()
  if (!trimmedBillingTermId) {
    return { error: 'Billing term tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  // Call RPC
  const { data, error } = await db.rpc('createInvoiceFromConstructionBillingTerm', {
    p_org_id: orgId,
    p_billing_term_id: trimmedBillingTermId,
    p_invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
  })

  if (error) {
    return { error: error.message || 'Gagal generate invoice.' }
  }

  if (!data || !data[0]) {
    return { error: 'RPC response kosong.' }
  }

  const result = data[0]
  if (!result.success) {
    return { error: result.error_message || 'Gagal generate invoice.' }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  revalidatePath('/accounting/invoices')

  return {
    success: true,
    invoiceId: result.invoice_id,
    invoiceNumber: result.invoice_number,
  }
}

/**
 * Menghapus termin billing project.
 */
export async function deleteConstructionBillingTerm(
  orgId: string,
  projectId: string,
  billingTermId: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBillingTermId = billingTermId.trim()
  if (!trimmedBillingTermId) {
    return { error: 'Termin billing tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { error } = await db
    .from('construction_billing_terms')
    .delete()
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .eq('id', trimmedBillingTermId)

  if (error) return { error: error.message }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  return { success: true }
}

/**
 * Auto-generate invoice dari billing term saat status → BILLED.
 * Calls RPC createInvoiceFromConstructionBillingTerm.
 */
export async function generateInvoiceFromBillingTerm(
  orgId: string,
  projectId: string,
  billingTermId: string,
  invoiceDate?: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBillingTermId = billingTermId.trim()
  if (!trimmedBillingTermId) {
    return { error: 'Billing term tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  // Call RPC
  const { data, error } = await db.rpc('createInvoiceFromConstructionBillingTerm', {
    p_org_id: orgId,
    p_billing_term_id: trimmedBillingTermId,
    p_invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
  })

  if (error) {
    return { error: error.message || 'Gagal generate invoice.' }
  }

  if (!data || !data[0]) {
    return { error: 'RPC response kosong.' }
  }

  const result = data[0]
  if (!result.success) {
    return { error: result.error_message || 'Gagal generate invoice.' }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  revalidatePath('/accounting/invoices')

  return {
    success: true,
    invoiceId: result.invoice_id,
    invoiceNumber: result.invoice_number,
  }
}

/**
 * Menambah atau memperbarui change order project.
 */
export async function upsertConstructionChangeOrder(
  orgId: string,
  projectId: string,
  input: ConstructionChangeOrderInput
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const title = String(input.title || '').trim()
  if (!title) {
    return { error: 'Judul change order wajib diisi.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const changeOrderId = String(input.id || '').trim()
  const requestedDate = normalizeOptionalString(input.requestedDate)
  let referenceNo = normalizeOptionalString(input.referenceNo)

  if (!changeOrderId && !referenceNo) {
    const { count } = await db
      .from('construction_change_orders')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('project_id', projectId)

    referenceNo = `CO-${String((count || 0) + 1).padStart(3, '0')}`
  }

  const payload = {
    org_id: orgId,
    project_id: projectId,
    stage_id: normalizeOptionalString(input.stageId),
    reference_no: referenceNo,
    title,
    change_type: normalizeChangeOrderType(String(input.changeType || 'ADDITIONAL_WORK')),
    status: normalizeChangeOrderStatus(String(input.status || 'PROPOSED')),
    requested_date: changeOrderId ? requestedDate : (requestedDate || new Date().toISOString().slice(0, 10)),
    approved_date: normalizeOptionalString(input.approvedDate),
    effective_date: normalizeOptionalString(input.effectiveDate),
    contract_value_delta: sanitizeNumber(input.contractValueDelta),
    estimated_cost_delta: sanitizeNumber(input.estimatedCostDelta),
    schedule_delta_days: sanitizeSignedInteger(input.scheduleDeltaDays),
    reason: normalizeOptionalString(input.reason),
    notes: normalizeOptionalString(input.notes),
  }

  if (changeOrderId) {
    const { error } = await db
      .from('construction_change_orders')
      .update(payload)
      .eq('org_id', orgId)
      .eq('project_id', projectId)
      .eq('id', changeOrderId)

    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('construction_change_orders')
      .insert(payload)

    if (error) return { error: error.message }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  return { success: true }
}

/**
 * Auto-generate invoice dari billing term saat status → BILLED.
 * Calls RPC createInvoiceFromConstructionBillingTerm.
 */
export async function generateInvoiceFromBillingTerm(
  orgId: string,
  projectId: string,
  billingTermId: string,
  invoiceDate?: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBillingTermId = billingTermId.trim()
  if (!trimmedBillingTermId) {
    return { error: 'Billing term tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  // Call RPC
  const { data, error } = await db.rpc('createInvoiceFromConstructionBillingTerm', {
    p_org_id: orgId,
    p_billing_term_id: trimmedBillingTermId,
    p_invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
  })

  if (error) {
    return { error: error.message || 'Gagal generate invoice.' }
  }

  if (!data || !data[0]) {
    return { error: 'RPC response kosong.' }
  }

  const result = data[0]
  if (!result.success) {
    return { error: result.error_message || 'Gagal generate invoice.' }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  revalidatePath('/accounting/invoices')

  return {
    success: true,
    invoiceId: result.invoice_id,
    invoiceNumber: result.invoice_number,
  }
}

/**
 * Mengirim change order ke approval center.
 */
export async function submitConstructionChangeOrderApproval(
  orgId: string,
  projectId: string,
  changeOrderId: string
) {
  const { supabase, user, error: authError } = await getServerAuthContext()
  if (authError || !user?.id) {
    return { error: 'Tidak terautentikasi untuk mengirim approval.' }
  }

  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedChangeOrderId = changeOrderId.trim()
  if (!trimmedChangeOrderId) {
    return { error: 'Change order tidak valid.' }
  }

  const db = supabase as unknown as LooseDb
  const { data: changeOrderRow, error: changeOrderError } = await db
    .from('construction_change_orders')
    .select('id, reference_no, title, status, contract_value_delta, estimated_cost_delta')
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .eq('id', trimmedChangeOrderId)
    .maybeSingle()

  if (changeOrderError) return { error: changeOrderError.message }
  if (!changeOrderRow) return { error: 'Change order tidak ditemukan.' }

  const currentStatus = normalizeChangeOrderStatus(String(changeOrderRow.status || 'PROPOSED'))
  if (currentStatus === 'APPROVED' || currentStatus === 'IMPLEMENTED') {
    return { error: 'Change order yang sudah approved tidak perlu dikirim ulang ke approval.' }
  }

  const { data: pendingApproval, error: pendingApprovalError } = await db
    .from('approval_requests')
    .select('id')
    .eq('org_id', orgId)
    .eq('branch_id', projectResult.project.branchId)
    .eq('source_type', 'CONSTRUCTION_CHANGE_ORDER')
    .eq('source_id', trimmedChangeOrderId)
    .eq('status', 'PENDING')
    .maybeSingle()

  if (pendingApprovalError) return { error: pendingApprovalError.message }
  if (pendingApproval?.id) {
    return { error: 'Change order ini sudah masuk approval center dan masih menunggu keputusan.' }
  }

  const referenceNo = String(changeOrderRow.reference_no || '').trim()
  const title = String(changeOrderRow.title || '').trim()
  const contractValueDelta = sanitizeNumber(Number(changeOrderRow.contract_value_delta || 0))
  const estimatedCostDelta = sanitizeNumber(Number(changeOrderRow.estimated_cost_delta || 0))
  const approvalReason = [
    referenceNo || 'CO',
    title || 'Change Order',
    `Kontrak ${contractValueDelta >= 0 ? '+' : '-'}${Math.abs(contractValueDelta).toLocaleString('id-ID')}`,
    `Cost ${estimatedCostDelta >= 0 ? '+' : '-'}${Math.abs(estimatedCostDelta).toLocaleString('id-ID')}`,
  ].join(' • ')

  const { error: statusError } = await db
    .from('construction_change_orders')
    .update({
      status: 'IN_REVIEW',
      approved_date: null,
    })
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .eq('id', trimmedChangeOrderId)

  if (statusError) return { error: statusError.message }

  const { error: approvalInsertError } = await db
    .from('approval_requests')
    .insert({
      org_id: orgId,
      branch_id: projectResult.project.branchId,
      requester_id: user.id,
      source_type: 'CONSTRUCTION_CHANGE_ORDER',
      source_id: trimmedChangeOrderId,
      status: 'PENDING',
      reason: approvalReason,
      notes: `Approval change order untuk project ${projectResult.project.projectCode} - ${projectResult.project.projectName}`,
    })

  if (approvalInsertError) {
    await db
      .from('construction_change_orders')
      .update({
        status: currentStatus,
      })
      .eq('org_id', orgId)
      .eq('project_id', projectId)
      .eq('id', trimmedChangeOrderId)

    return { error: approvalInsertError.message }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  revalidatePath('/accounting/approvals')
  return { success: true }
}

/**
 * Menghapus change order project.
 */
export async function deleteConstructionChangeOrder(
  orgId: string,
  projectId: string,
  changeOrderId: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedChangeOrderId = changeOrderId.trim()
  if (!trimmedChangeOrderId) {
    return { error: 'Change order tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb
  const { error } = await db
    .from('construction_change_orders')
    .delete()
    .eq('org_id', orgId)
    .eq('project_id', projectId)
    .eq('id', trimmedChangeOrderId)

  if (error) return { error: error.message }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  return { success: true }
}

/**
 * Auto-generate invoice dari billing term saat status → BILLED.
 * Calls RPC createInvoiceFromConstructionBillingTerm.
 */
export async function generateInvoiceFromBillingTerm(
  orgId: string,
  projectId: string,
  billingTermId: string,
  invoiceDate?: string
) {
  const projectResult = await getAccessibleConstructionProjectRow(orgId, projectId)
  if ('error' in projectResult) return { error: projectResult.error }

  const trimmedBillingTermId = billingTermId.trim()
  if (!trimmedBillingTermId) {
    return { error: 'Billing term tidak valid.' }
  }

  const supabase = await createClient()
  const db = supabase as unknown as LooseDb

  // Call RPC
  const { data, error } = await db.rpc('createInvoiceFromConstructionBillingTerm', {
    p_org_id: orgId,
    p_billing_term_id: trimmedBillingTermId,
    p_invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
  })

  if (error) {
    return { error: error.message || 'Gagal generate invoice.' }
  }

  if (!data || !data[0]) {
    return { error: 'RPC response kosong.' }
  }

  const result = data[0]
  if (!result.success) {
    return { error: result.error_message || 'Gagal generate invoice.' }
  }

  revalidatePath('/construction')
  revalidatePath(`/construction/${projectId}`)
  revalidatePath('/accounting/invoices')

  return {
    success: true,
    invoiceId: result.invoice_id,
    invoiceNumber: result.invoice_number,
  }
}
