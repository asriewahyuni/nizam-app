/**
 * Tipe dasar modul Project & Construction.
 * Dipakai bersama oleh server actions dan UI dashboard awal.
 */

export type ConstructionProjectType =
  | 'ARCHITECT'
  | 'CONTRACTOR'
  | 'DESIGN_BUILD'
  | 'INTERIOR'
  | 'CONSULTING'

export type ConstructionProjectStatus =
  | 'PLANNING'
  | 'TENDER'
  | 'DESIGN'
  | 'EXECUTION'
  | 'HANDOVER'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED'

export type ConstructionStageStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'

export type ConstructionBudgetCategory =
  | 'MATERIAL'
  | 'LABOR'
  | 'SUBCON'
  | 'EQUIPMENT'
  | 'OTHER'

export type ConstructionBillingBasisType =
  | 'DOWN_PAYMENT'
  | 'PROGRESS'
  | 'FINAL'
  | 'RETENTION'
  | 'CUSTOM'

export type ConstructionBillingStatus =
  | 'PLANNED'
  | 'READY_TO_BILL'
  | 'BILLED'
  | 'PAID'

export type ConstructionChangeOrderType =
  | 'ADDITIONAL_WORK'
  | 'DEDUCTION'
  | 'SUBSTITUTION'
  | 'TIME_EXTENSION'
  | 'DESIGN_REVISION'

export type ConstructionChangeOrderStatus =
  | 'PROPOSED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'IMPLEMENTED'

export type ConstructionProjectRecord = {
  id: string
  projectCode: string
  projectName: string
  projectType: ConstructionProjectType
  projectStatus: ConstructionProjectStatus
  siteAddress: string
  contractValue: number
  estimatedCost: number
  progressPercent: number
  notes: string
  startDate: string | null
  targetEndDate: string | null
  actualEndDate: string | null
  branchId: string
  branchName: string
  branchCode: string
  clientContactId: string | null
  clientName: string
  clientType: string
  createdAt: string | null
  updatedAt: string | null
}

export type ConstructionDashboardSummary = {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  averageProgress: number
  totalContractValue: number
  totalEstimatedCost: number
}

export type ConstructionProjectStageRecord = {
  id: string
  projectId: string
  stageCode: string
  stageName: string
  sortOrder: number
  weightPercent: number
  status: ConstructionStageStatus
  progressPercent: number
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  notes: string
}

export type ConstructionBudgetItemRecord = {
  id: string
  projectId: string
  stageId: string | null
  stageName: string
  category: ConstructionBudgetCategory
  description: string
  uom: string
  plannedQuantity: number
  plannedUnitCost: number
  plannedTotal: number
  actualQuantity: number
  actualUnitCost: number
  actualTotal: number
  vendorContactId: string | null
  vendorName: string
  notes: string
  createdAt: string | null
  updatedAt: string | null
}

export type ConstructionProjectSnapshotInput = {
  projectName: string
  projectStatus: ConstructionProjectStatus
  projectType: ConstructionProjectType
  siteAddress: string
  progressPercent: number
  contractValue: number
  estimatedCost: number
  startDate: string | null
  targetEndDate: string | null
  actualEndDate: string | null
  clientContactId: string | null
  notes: string
}

export type ConstructionBudgetItemInput = {
  id?: string
  stageId?: string | null
  category: ConstructionBudgetCategory
  description: string
  uom?: string | null
  plannedQuantity?: number
  plannedUnitCost?: number
  actualQuantity?: number
  actualUnitCost?: number
  vendorContactId?: string | null
  notes?: string | null
}

export type ConstructionProgressLogRecord = {
  id: string
  projectId: string
  stageId: string | null
  stageName: string
  entryDate: string | null
  progressPercent: number
  weather: string
  summary: string
  issueNotes: string
  evidenceUrls: string[]
  createdAt: string | null
}

export type ConstructionProgressLogInput = {
  id?: string
  stageId?: string | null
  entryDate?: string | null
  progressPercent?: number
  weather?: string | null
  summary: string
  issueNotes?: string | null
  evidenceUrls?: string[]
}

export type ConstructionBillingTermRecord = {
  id: string
  projectId: string
  termLabel: string
  sequenceNo: number
  basisType: ConstructionBillingBasisType
  progressTargetPercent: number
  billingPercent: number
  billingAmount: number
  status: ConstructionBillingStatus
  invoiceReference: string
  dueDate: string | null
  paidDate: string | null
  notes: string
  createdAt: string | null
  updatedAt: string | null
}

export type ConstructionBillingTermInput = {
  id?: string
  termLabel: string
  sequenceNo?: number
  basisType?: ConstructionBillingBasisType
  progressTargetPercent?: number
  billingPercent?: number
  billingAmount?: number
  status?: ConstructionBillingStatus
  invoiceReference?: string | null
  dueDate?: string | null
  paidDate?: string | null
  notes?: string | null
}

export type ConstructionChangeOrderRecord = {
  id: string
  projectId: string
  stageId: string | null
  stageName: string
  referenceNo: string
  title: string
  changeType: ConstructionChangeOrderType
  status: ConstructionChangeOrderStatus
  requestedDate: string | null
  approvedDate: string | null
  effectiveDate: string | null
  contractValueDelta: number
  estimatedCostDelta: number
  scheduleDeltaDays: number
  reason: string
  notes: string
  approvalRequestId: string | null
  approvalStatus: string | null
  approvalRequestedAt: string | null
  approvalDecidedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type ConstructionChangeOrderInput = {
  id?: string
  stageId?: string | null
  referenceNo?: string | null
  title: string
  changeType?: ConstructionChangeOrderType
  status?: ConstructionChangeOrderStatus
  requestedDate?: string | null
  approvedDate?: string | null
  effectiveDate?: string | null
  contractValueDelta?: number
  estimatedCostDelta?: number
  scheduleDeltaDays?: number
  reason?: string | null
  notes?: string | null
}
