import { createAdminClient } from '@/lib/supabase/server'
import { getActiveBranch } from '@/modules/organization/actions/org.actions'
import { getEmployees } from '@/modules/hris/actions/employee.actions'

type CompetencyTrainingRow = {
  id?: string | null
  org_id?: string | null
  branch_id?: string | null
  title?: string | null
  skill_category?: string | null
  target_role?: string | null
  training_type?: string | null
  delivery_mode?: string | null
  scope_type?: string | null
  status?: string | null
  facilitator_name?: string | null
  start_date?: string | null
  end_date?: string | null
  duration_hours?: number | string | null
  objective?: string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type BranchLookupRow = {
  id?: string | null
  name?: string | null
  code?: string | null
}

type TrainingParticipantRow = {
  id?: string | null
  training_id?: string | null
  org_id?: string | null
  employee_id?: string | null
  status?: string | null
  assigned_at?: string | null
  assigned_by?: string | null
  completed_at?: string | null
  note?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type TrainingSessionRow = {
  id?: string | null
  training_id?: string | null
  org_id?: string | null
  branch_id?: string | null
  title?: string | null
  session_date?: string | null
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  facilitator_name?: string | null
  status?: string | null
  note?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type TrainingEvaluationRow = {
  id?: string | null
  training_id?: string | null
  org_id?: string | null
  participant_id?: string | null
  session_id?: string | null
  evaluator_name?: string | null
  evaluation_type?: string | null
  result_status?: string | null
  score?: number | string | null
  note?: string | null
  evaluated_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type EmployeeLookup = {
  id: string
  nik: string | null
  first_name: string | null
  last_name: string | null
  job_title: string | null
  employment_status: string | null
  registration_status?: string | null
  branch_id?: string | null
  branch?: {
    id?: string | null
    name?: string | null
    code?: string | null
  } | null
}

export type CompetencyTrainingRecord = {
  id: string
  orgId: string
  branchId: string | null
  branchName: string | null
  branchCode: string | null
  title: string
  skillCategory: string
  targetRole: string | null
  trainingType: 'INTERNAL' | 'EXTERNAL' | 'CERTIFICATION' | 'COACHING'
  deliveryMode: 'CLASSROOM' | 'ONLINE' | 'HYBRID' | 'ON_THE_JOB'
  scopeType: 'ORG' | 'BRANCH'
  status: 'DRAFT' | 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'ARCHIVED'
  facilitatorName: string | null
  startDate: string | null
  endDate: string | null
  durationHours: number
  objective: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  participantCount: number
  sessionCount: number
  evaluationCount: number
}

export type CompetencyTrainingSummary = {
  total: number
  draft: number
  planned: number
  ongoing: number
  completed: number
  archived: number
  branchScoped: number
  orgScoped: number
}

export type CompetencyTrainingParticipantRecord = {
  id: string
  trainingId: string
  employeeId: string
  employeeName: string
  employeeNik: string | null
  employeeJobTitle: string | null
  employeeStatus: string | null
  branchName: string | null
  branchCode: string | null
  status: 'ASSIGNED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  assignedAt: string
  completedAt: string | null
  note: string | null
  latestEvaluation: {
    resultStatus: 'OBSERVED' | 'PASS' | 'REMEDIAL' | 'FAIL'
    evaluationType: 'PRETEST' | 'POSTTEST' | 'OBSERVATION' | 'ASSESSMENT' | 'CERTIFICATION'
    score: number | null
    evaluatedAt: string
    evaluatorName: string
  } | null
}

export type CompetencyTrainingSessionRecord = {
  id: string
  trainingId: string
  branchId: string | null
  branchName: string | null
  branchCode: string | null
  title: string
  sessionDate: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  facilitatorName: string | null
  status: 'SCHEDULED' | 'DONE' | 'CANCELLED'
  note: string | null
  createdAt: string
  updatedAt: string
}

export type CompetencyTrainingEvaluationRecord = {
  id: string
  trainingId: string
  participantId: string
  participantName: string
  participantNik: string | null
  sessionId: string | null
  sessionTitle: string | null
  evaluatorName: string
  evaluationType: 'PRETEST' | 'POSTTEST' | 'OBSERVATION' | 'ASSESSMENT' | 'CERTIFICATION'
  resultStatus: 'OBSERVED' | 'PASS' | 'REMEDIAL' | 'FAIL'
  score: number | null
  note: string | null
  evaluatedAt: string
}

export type CompetencyTrainingAssignableEmployee = {
  id: string
  fullName: string
  nik: string | null
  jobTitle: string | null
  branchId: string | null
  branchName: string | null
  branchCode: string | null
  employmentStatus: string | null
}

export type CompetencyTrainingDetail = {
  training: CompetencyTrainingRecord
  participants: CompetencyTrainingParticipantRecord[]
  sessions: CompetencyTrainingSessionRecord[]
  evaluations: CompetencyTrainingEvaluationRecord[]
  assignableEmployees: CompetencyTrainingAssignableEmployee[]
  summary: {
    participantCount: number
    completedParticipantCount: number
    sessionCount: number
    scheduledSessionCount: number
    evaluationCount: number
    passedCount: number
    remedialCount: number
  }
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function normalizeTrainingType(value: unknown): CompetencyTrainingRecord['trainingType'] {
  const normalized = normalizeText(value).toUpperCase()
  if (normalized === 'EXTERNAL' || normalized === 'CERTIFICATION' || normalized === 'COACHING') {
    return normalized
  }
  return 'INTERNAL'
}

function normalizeDeliveryMode(value: unknown): CompetencyTrainingRecord['deliveryMode'] {
  const normalized = normalizeText(value).toUpperCase()
  if (normalized === 'ONLINE' || normalized === 'HYBRID' || normalized === 'ON_THE_JOB') {
    return normalized
  }
  return 'CLASSROOM'
}

function normalizeScopeType(value: unknown): CompetencyTrainingRecord['scopeType'] {
  return normalizeText(value).toUpperCase() === 'BRANCH' ? 'BRANCH' : 'ORG'
}

function normalizeTrainingStatus(value: unknown): CompetencyTrainingRecord['status'] {
  const normalized = normalizeText(value).toUpperCase()
  if (normalized === 'PLANNED' || normalized === 'ONGOING' || normalized === 'COMPLETED' || normalized === 'ARCHIVED') {
    return normalized
  }
  return 'DRAFT'
}

function normalizeParticipantStatus(value: unknown): CompetencyTrainingParticipantRecord['status'] {
  const normalized = normalizeText(value).toUpperCase()
  if (normalized === 'CONFIRMED' || normalized === 'IN_PROGRESS' || normalized === 'COMPLETED' || normalized === 'CANCELLED') {
    return normalized
  }
  return 'ASSIGNED'
}

function normalizeSessionStatus(value: unknown): CompetencyTrainingSessionRecord['status'] {
  const normalized = normalizeText(value).toUpperCase()
  if (normalized === 'DONE' || normalized === 'CANCELLED') {
    return normalized
  }
  return 'SCHEDULED'
}

function normalizeEvaluationType(value: unknown): CompetencyTrainingEvaluationRecord['evaluationType'] {
  const normalized = normalizeText(value).toUpperCase()
  if (normalized === 'PRETEST' || normalized === 'POSTTEST' || normalized === 'OBSERVATION' || normalized === 'CERTIFICATION') {
    return normalized
  }
  return 'ASSESSMENT'
}

function normalizeEvaluationResult(value: unknown): CompetencyTrainingEvaluationRecord['resultStatus'] {
  const normalized = normalizeText(value).toUpperCase()
  if (normalized === 'PASS' || normalized === 'REMEDIAL' || normalized === 'FAIL') {
    return normalized
  }
  return 'OBSERVED'
}

function buildEmployeeName(employee?: EmployeeLookup | null) {
  if (!employee) return 'Karyawan'
  const firstName = normalizeText(employee.first_name)
  const lastName = normalizeText(employee.last_name)
  return [firstName, lastName].filter(Boolean).join(' ') || employee.nik || 'Karyawan'
}

function normalizeAssignableEmployee(employee: EmployeeLookup): CompetencyTrainingAssignableEmployee {
  return {
    id: normalizeText(employee.id),
    fullName: buildEmployeeName(employee),
    nik: normalizeText(employee.nik) || null,
    jobTitle: normalizeText(employee.job_title) || null,
    branchId: normalizeText(employee.branch?.id || employee.branch_id) || null,
    branchName: normalizeText(employee.branch?.name) || null,
    branchCode: normalizeText(employee.branch?.code) || null,
    employmentStatus: normalizeText(employee.employment_status) || null,
  }
}

function mapTrainingRow(
  row: CompetencyTrainingRow,
  branchMap: Map<string, { name: string | null; code: string | null }>,
  counter: { participantCount: number; sessionCount: number; evaluationCount: number },
): CompetencyTrainingRecord {
  const branchId = normalizeText(row.branch_id) || null
  const branch = branchId ? branchMap.get(branchId) : null

  return {
    id: normalizeText(row.id),
    orgId: normalizeText(row.org_id),
    branchId,
    branchName: branch?.name || null,
    branchCode: branch?.code || null,
    title: normalizeText(row.title),
    skillCategory: normalizeText(row.skill_category) || 'General Business Skill',
    targetRole: normalizeText(row.target_role) || null,
    trainingType: normalizeTrainingType(row.training_type),
    deliveryMode: normalizeDeliveryMode(row.delivery_mode),
    scopeType: normalizeScopeType(row.scope_type),
    status: normalizeTrainingStatus(row.status),
    facilitatorName: normalizeText(row.facilitator_name) || null,
    startDate: normalizeText(row.start_date) || null,
    endDate: normalizeText(row.end_date) || null,
    durationHours: Number(row.duration_hours || 0),
    objective: row.objective ? String(row.objective) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: normalizeText(row.created_at),
    updatedAt: normalizeText(row.updated_at),
    participantCount: counter.participantCount,
    sessionCount: counter.sessionCount,
    evaluationCount: counter.evaluationCount,
  }
}

async function getBranchInfoMap(branchIds: string[]) {
  const db = await createAdminClient()
  const uniqueBranchIds = Array.from(new Set(branchIds.map((branchId) => normalizeText(branchId)).filter(Boolean)))
  const branchMap = new Map<string, { name: string | null; code: string | null }>()

  if (uniqueBranchIds.length === 0) {
    return branchMap
  }

  const { data: branchRows } = await db
    .from('branches')
    .select('id, name, code')
    .in('id', uniqueBranchIds)

  ;((Array.isArray(branchRows) ? branchRows : []) as BranchLookupRow[]).forEach((branch) => {
    const id = normalizeText(branch.id)
    if (!id) return
    branchMap.set(id, {
      name: branch.name ? String(branch.name) : null,
      code: branch.code ? String(branch.code) : null,
    })
  })

  return branchMap
}

async function getTrainingCountMaps(trainingIds: string[]) {
  const db = await createAdminClient()
  const uniqueTrainingIds = Array.from(new Set(trainingIds.map((trainingId) => normalizeText(trainingId)).filter(Boolean)))
  const participantCounts = new Map<string, number>()
  const sessionCounts = new Map<string, number>()
  const evaluationCounts = new Map<string, number>()

  if (uniqueTrainingIds.length === 0) {
    return { participantCounts, sessionCounts, evaluationCounts }
  }

  const [participantRows, sessionRows, evaluationRows] = await Promise.all([
    db.from('hris_competency_training_participants').select('training_id').in('training_id', uniqueTrainingIds),
    db.from('hris_competency_training_sessions').select('training_id').in('training_id', uniqueTrainingIds),
    db.from('hris_competency_training_evaluations').select('training_id').in('training_id', uniqueTrainingIds),
  ])

  ;(Array.isArray(participantRows.data) ? participantRows.data : []).forEach((row: { training_id?: string | null }) => {
    const trainingId = normalizeText(row.training_id)
    if (!trainingId) return
    participantCounts.set(trainingId, (participantCounts.get(trainingId) || 0) + 1)
  })

  ;(Array.isArray(sessionRows.data) ? sessionRows.data : []).forEach((row: { training_id?: string | null }) => {
    const trainingId = normalizeText(row.training_id)
    if (!trainingId) return
    sessionCounts.set(trainingId, (sessionCounts.get(trainingId) || 0) + 1)
  })

  ;(Array.isArray(evaluationRows.data) ? evaluationRows.data : []).forEach((row: { training_id?: string | null }) => {
    const trainingId = normalizeText(row.training_id)
    if (!trainingId) return
    evaluationCounts.set(trainingId, (evaluationCounts.get(trainingId) || 0) + 1)
  })

  return { participantCounts, sessionCounts, evaluationCounts }
}

/**
 * Membaca daftar program pelatihan internal tenant yang dibuat dari menu
 * peningkatan kompetensi HR. Data ini sengaja dipisah dari board simulasi ERP.
 */
export async function listCompetencyTrainings(orgId: string) {
  const db = await createAdminClient()
  const normalizedOrgId = normalizeText(orgId)
  if (!normalizedOrgId) return []

  const { data, error } = await db
    .from('hris_competency_trainings')
    .select('id, org_id, branch_id, title, skill_category, target_role, training_type, delivery_mode, scope_type, status, facilitator_name, start_date, end_date, duration_hours, objective, notes, created_at, updated_at')
    .eq('org_id', normalizedOrgId)
    .order('created_at', { ascending: false })

  if (error) {
    // Jika tabel belum dibuat (migration belum dijalankan), kembalikan array kosong
    // daripada crash halaman. Code 42P01 = relation does not exist.
    const pgCode = (error as unknown as Record<string, unknown>).code
    if (pgCode === '42P01' || String(error.message).includes('does not exist')) {
      console.warn('[LMS] hris_competency_trainings table not found. Run migration 1245.')
      return []
    }
    throw new Error(error.message || 'Gagal membaca daftar pelatihan.')
  }

  const rows = (Array.isArray(data) ? data : []) as CompetencyTrainingRow[]
  const branchIds = rows.map((row) => normalizeText(row.branch_id)).filter(Boolean)
  const branchMap = await getBranchInfoMap(branchIds)
  const trainingIds = rows.map((row) => normalizeText(row.id)).filter(Boolean)
  const { participantCounts, sessionCounts, evaluationCounts } = await getTrainingCountMaps(trainingIds)

  return rows.map((row) =>
    mapTrainingRow(row, branchMap, {
      participantCount: participantCounts.get(normalizeText(row.id)) || 0,
      sessionCount: sessionCounts.get(normalizeText(row.id)) || 0,
      evaluationCount: evaluationCounts.get(normalizeText(row.id)) || 0,
    }),
  )
}

export function summarizeCompetencyTrainings(records: CompetencyTrainingRecord[]): CompetencyTrainingSummary {
  return records.reduce<CompetencyTrainingSummary>((summary, record) => {
    summary.total += 1
    summary.branchScoped += record.scopeType === 'BRANCH' ? 1 : 0
    summary.orgScoped += record.scopeType === 'ORG' ? 1 : 0

    if (record.status === 'PLANNED') summary.planned += 1
    else if (record.status === 'ONGOING') summary.ongoing += 1
    else if (record.status === 'COMPLETED') summary.completed += 1
    else if (record.status === 'ARCHIVED') summary.archived += 1
    else summary.draft += 1

    return summary
  }, {
    total: 0,
    draft: 0,
    planned: 0,
    ongoing: 0,
    completed: 0,
    archived: 0,
    branchScoped: 0,
    orgScoped: 0,
  })
}

export async function getCompetencyTrainingDetail(orgId: string, trainingId: string): Promise<CompetencyTrainingDetail | null> {
  const db = await createAdminClient()
  const normalizedOrgId = normalizeText(orgId)
  const normalizedTrainingId = normalizeText(trainingId)
  if (!normalizedOrgId || !normalizedTrainingId) return null

  const { data: trainingRow, error: trainingError } = await db
    .from('hris_competency_trainings')
    .select('id, org_id, branch_id, title, skill_category, target_role, training_type, delivery_mode, scope_type, status, facilitator_name, start_date, end_date, duration_hours, objective, notes, created_at, updated_at')
    .eq('org_id', normalizedOrgId)
    .eq('id', normalizedTrainingId)
    .maybeSingle()

  if (trainingError) {
    throw new Error(trainingError.message || 'Gagal membaca detail pelatihan.')
  }

  if (!trainingRow?.id) {
    return null
  }

  const [participantResponse, sessionResponse, evaluationResponse] = await Promise.all([
    db
      .from('hris_competency_training_participants')
      .select('id, training_id, org_id, employee_id, status, assigned_at, assigned_by, completed_at, note, created_at, updated_at')
      .eq('org_id', normalizedOrgId)
      .eq('training_id', normalizedTrainingId)
      .order('assigned_at', { ascending: false }),
    db
      .from('hris_competency_training_sessions')
      .select('id, training_id, org_id, branch_id, title, session_date, start_time, end_time, location, facilitator_name, status, note, created_at, updated_at')
      .eq('org_id', normalizedOrgId)
      .eq('training_id', normalizedTrainingId)
      .order('session_date', { ascending: false }),
    db
      .from('hris_competency_training_evaluations')
      .select('id, training_id, org_id, participant_id, session_id, evaluator_name, evaluation_type, result_status, score, note, evaluated_at, created_at, updated_at')
      .eq('org_id', normalizedOrgId)
      .eq('training_id', normalizedTrainingId)
      .order('evaluated_at', { ascending: false }),
  ])

  const participantRows = (Array.isArray(participantResponse.data) ? participantResponse.data : []) as TrainingParticipantRow[]
  const sessionRows = (Array.isArray(sessionResponse.data) ? sessionResponse.data : []) as TrainingSessionRow[]
  const evaluationRows = (Array.isArray(evaluationResponse.data) ? evaluationResponse.data : []) as TrainingEvaluationRow[]

  const activeBranch = await getActiveBranch(normalizedOrgId)
  const trainingScopeType = normalizeScopeType(trainingRow.scope_type)
  const employeeScopeBranchId = trainingScopeType === 'BRANCH'
    ? (normalizeText(trainingRow.branch_id) || null)
    : (activeBranch?.id || null)
  const employees = await getEmployees(normalizedOrgId, employeeScopeBranchId)
  const typedEmployees = (Array.isArray(employees) ? employees : []) as EmployeeLookup[]
  const employeeMap = new Map(typedEmployees.map((employee) => [normalizeText(employee.id), employee] as const))
  const assignableEmployees = typedEmployees
    .filter((employee) => {
      const employmentStatus = normalizeText(employee.employment_status).toUpperCase()
      return employmentStatus !== 'RESIGNED' && employmentStatus !== 'TERMINATED'
    })
    .map(normalizeAssignableEmployee)

  const sessionBranchIds = sessionRows.map((session) => normalizeText(session.branch_id)).filter(Boolean)
  const trainingBranchIds = [normalizeText(trainingRow.branch_id), ...sessionBranchIds].filter(Boolean)
  const branchMap = await getBranchInfoMap(trainingBranchIds)

  const latestEvaluationByParticipantId = new Map<string, CompetencyTrainingParticipantRecord['latestEvaluation']>()

  evaluationRows.forEach((evaluation) => {
    const participantId = normalizeText(evaluation.participant_id)
    if (!participantId || latestEvaluationByParticipantId.has(participantId)) return

    latestEvaluationByParticipantId.set(participantId, {
      resultStatus: normalizeEvaluationResult(evaluation.result_status),
      evaluationType: normalizeEvaluationType(evaluation.evaluation_type),
      score: evaluation.score === null || evaluation.score === undefined || evaluation.score === '' ? null : Number(evaluation.score),
      evaluatedAt: normalizeText(evaluation.evaluated_at || evaluation.created_at),
      evaluatorName: normalizeText(evaluation.evaluator_name) || 'Penilai',
    })
  })

  const participants = participantRows.map((participant): CompetencyTrainingParticipantRecord => {
    const employee = employeeMap.get(normalizeText(participant.employee_id)) || null
    return {
      id: normalizeText(participant.id),
      trainingId: normalizeText(participant.training_id),
      employeeId: normalizeText(participant.employee_id),
      employeeName: buildEmployeeName(employee),
      employeeNik: normalizeText(employee?.nik) || null,
      employeeJobTitle: normalizeText(employee?.job_title) || null,
      employeeStatus: normalizeText(employee?.employment_status) || null,
      branchName: normalizeText(employee?.branch?.name) || null,
      branchCode: normalizeText(employee?.branch?.code) || null,
      status: normalizeParticipantStatus(participant.status),
      assignedAt: normalizeText(participant.assigned_at || participant.created_at),
      completedAt: normalizeText(participant.completed_at) || null,
      note: participant.note ? String(participant.note) : null,
      latestEvaluation: latestEvaluationByParticipantId.get(normalizeText(participant.id)) || null,
    }
  })

  const sessionTitleById = new Map<string, string>()
  const sessions = sessionRows.map((session): CompetencyTrainingSessionRecord => {
    const sessionId = normalizeText(session.id)
    const branchId = normalizeText(session.branch_id) || null
    const branch = branchId ? branchMap.get(branchId) : null
    const record = {
      id: sessionId,
      trainingId: normalizeText(session.training_id),
      branchId,
      branchName: branch?.name || null,
      branchCode: branch?.code || null,
      title: normalizeText(session.title),
      sessionDate: normalizeText(session.session_date) || null,
      startTime: normalizeText(session.start_time) || null,
      endTime: normalizeText(session.end_time) || null,
      location: normalizeText(session.location) || null,
      facilitatorName: normalizeText(session.facilitator_name) || null,
      status: normalizeSessionStatus(session.status),
      note: session.note ? String(session.note) : null,
      createdAt: normalizeText(session.created_at),
      updatedAt: normalizeText(session.updated_at),
    } satisfies CompetencyTrainingSessionRecord
    sessionTitleById.set(sessionId, record.title)
    return record
  })

  const participantNameById = new Map(participants.map((participant) => [participant.id, participant] as const))
  const evaluations = evaluationRows.map((evaluation): CompetencyTrainingEvaluationRecord => {
    const participant = participantNameById.get(normalizeText(evaluation.participant_id))
    return {
      id: normalizeText(evaluation.id),
      trainingId: normalizeText(evaluation.training_id),
      participantId: normalizeText(evaluation.participant_id),
      participantName: participant?.employeeName || 'Peserta',
      participantNik: participant?.employeeNik || null,
      sessionId: normalizeText(evaluation.session_id) || null,
      sessionTitle: sessionTitleById.get(normalizeText(evaluation.session_id)) || null,
      evaluatorName: normalizeText(evaluation.evaluator_name) || 'Penilai',
      evaluationType: normalizeEvaluationType(evaluation.evaluation_type),
      resultStatus: normalizeEvaluationResult(evaluation.result_status),
      score: evaluation.score === null || evaluation.score === undefined || evaluation.score === '' ? null : Number(evaluation.score),
      note: evaluation.note ? String(evaluation.note) : null,
      evaluatedAt: normalizeText(evaluation.evaluated_at || evaluation.created_at),
    }
  })

  const training = mapTrainingRow(trainingRow as CompetencyTrainingRow, branchMap, {
    participantCount: participants.length,
    sessionCount: sessions.length,
    evaluationCount: evaluations.length,
  })

  return {
    training,
    participants,
    sessions,
    evaluations,
    assignableEmployees,
    summary: {
      participantCount: participants.length,
      completedParticipantCount: participants.filter((participant) => participant.status === 'COMPLETED').length,
      sessionCount: sessions.length,
      scheduledSessionCount: sessions.filter((session) => session.status === 'SCHEDULED').length,
      evaluationCount: evaluations.length,
      passedCount: evaluations.filter((evaluation) => evaluation.resultStatus === 'PASS').length,
      remedialCount: evaluations.filter((evaluation) => evaluation.resultStatus === 'REMEDIAL').length,
    },
  }
}
