import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { ACTIVE_BRANCH_COOKIE, ACTIVE_ORG_COOKIE } from '@/modules/organization/lib/org-context'
import {
  TRAINING_QUESTIONS,
  type TrainingQuestion,
} from '@/lib/edu/training-simulation'

export const EDU_SESSION_COOKIE = 'nizam_edu_session_id'
export const DEFAULT_EDU_TIME_LIMIT_MINUTES = 180
export const EDU_REALTIME_PILOT_QUESTION_LIMIT = 5
export const EDU_VALIDATOR_VERSION = 'v1-pilot-1-5'

type SessionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED'
type StepStatus = 'LOCKED' | 'ACTIVE' | 'VALIDATING' | 'PASSED' | 'NEEDS_REVIEW' | 'TIMED_OUT'

type TrainingEventRow = {
  id: string
  slug: string
  title: string
  description: string | null
  settings?: Record<string, unknown> | null
}

type TrainingTeamRow = {
  id: string
  name: string
  status: string | null
}

type TrainingSessionRow = {
  id: string
  event_id: string
  team_id: string
  org_id: string
  active_branch_id: string | null
  status: SessionStatus
  current_question_id: number
  started_by: string | null
  started_at: string
  deadline_at: string | null
  paused_at: string | null
  total_paused_seconds: number | null
  completed_at: string | null
  last_validated_at: string | null
  last_heartbeat_at: string | null
  metadata: Record<string, unknown> | null
}

type TrainingSessionStepRow = {
  id: string
  session_id: string
  question_id: number
  status: StepStatus
  started_at: string | null
  completed_at: string | null
  deadline_at: string | null
  elapsed_seconds: number | null
  transaction_ok: boolean | null
  context_ok: boolean | null
  evidence_ok: boolean | null
  points_awarded: number | null
  matched_record_ids: unknown
  matched_tables: unknown
  validator_version: string | null
  trainer_note: string | null
  system_note: string | null
}

type TrainingProgressEventRow = {
  id: string
  session_id: string
  question_id: number | null
  event_type: string
  severity: 'info' | 'success' | 'warning' | 'error'
  message: string
  source_module: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

type ScopedOrgRow = {
  id: string
  name: string
  parent_org_id: string | null
  created_at?: string | null
}

type TrainingValidationResult = {
  transactionOk: boolean
  contextOk: boolean
  evidenceOk: boolean
  matchedRecordIds: string[]
  matchedTables: string[]
  summary: string
  details?: string[]
  sourceModule?: string
  validatorVersion?: string
  needsReview?: boolean
}

export type TrainingSessionClientState = {
  hasSession: boolean
  active: boolean
  outsideScope?: boolean
  session?: {
    id: string
    status: SessionStatus
    teamId: string
    teamName: string
    eventId: string
    eventSlug: string
    eventTitle: string
    orgId: string
    orgName: string
    currentQuestionId: number
    totalQuestions: number
    pilotMode: boolean
    startedAt: string
    deadlineAt: string | null
    pausedAt: string | null
    completedAt: string | null
    remainingSeconds: number
    elapsedSeconds: number
    completionPercent: number
    currentQuestion: {
      id: number
      title: string
      prompt: string
      module: string
      scope: string
      phase: TrainingQuestion['phase']
      verification: string[]
      href: string
    } | null
    currentStep: {
      status: StepStatus
      transactionOk: boolean
      contextOk: boolean
      evidenceOk: boolean
      pointsAwarded: number
      systemNote: string | null
      trainerNote: string | null
    } | null
    steps: Array<{
      questionId: number
      status: StepStatus
      pointsAwarded: number
    }>
    recentEvents: Array<{
      id: string
      message: string
      severity: 'info' | 'success' | 'warning' | 'error'
      createdAt: string
    }>
  }
}

const QUESTION_ROUTE_BY_ID: Record<number, string> = {
  1: '/settings/sub-orgs',
  2: '/contacts',
  3: '/cash',
  4: '/cash',
  5: '/purchasing',
  6: '/purchasing',
  7: '/inventory',
  8: '/sales',
  9: '/cash',
  10: '/pos',
  11: '/accounting/reimburse',
  12: '/accounting/assets',
  13: '/hris',
  14: '/cash',
  15: '/reports?consolidated=true',
}

function getEduCookieOptions() {
  return {
    maxAge: 60 * 60 * 12,
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function readSessionQuestionLimit(metadata: Record<string, unknown> | null | undefined) {
  const raw = Number(metadata?.question_limit || EDU_REALTIME_PILOT_QUESTION_LIMIT)
  if (!Number.isFinite(raw)) return EDU_REALTIME_PILOT_QUESTION_LIMIT
  return Math.max(1, Math.min(TRAINING_QUESTIONS.length, Math.round(raw)))
}

function getStepQuestionSet(metadata: Record<string, unknown> | null | undefined) {
  const questionLimit = readSessionQuestionLimit(metadata)
  return TRAINING_QUESTIONS.slice(0, questionLimit)
}

function calculateElapsedSeconds(session: Pick<TrainingSessionRow, 'started_at' | 'completed_at' | 'total_paused_seconds'>) {
  const startedAtMs = new Date(session.started_at).getTime()
  const endedAtMs = session.completed_at ? new Date(session.completed_at).getTime() : Date.now()
  const baseSeconds = Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000))
  return Math.max(0, baseSeconds - Number(session.total_paused_seconds || 0))
}

function calculateRemainingSeconds(session: Pick<TrainingSessionRow, 'deadline_at' | 'status' | 'started_at' | 'completed_at' | 'total_paused_seconds'>) {
  if (!session.deadline_at) return 0
  if (session.status === 'COMPLETED') return 0
  const deadlineMs = new Date(session.deadline_at).getTime()
  return Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000))
}

function getCompletionPercent(steps: TrainingSessionStepRow[]) {
  if (steps.length === 0) return 0
  const passedCount = steps.filter((step) => step.status === 'PASSED').length
  return Math.round((passedCount / steps.length) * 100)
}

function getQuestionHref(questionId: number) {
  return QUESTION_ROUTE_BY_ID[questionId] || '/dashboard'
}

function getQuestionById(questionId: number) {
  return TRAINING_QUESTIONS.find((question) => question.id === questionId) || null
}

async function getTrainingScopedOrganizations(admin: any, rootOrgId: string): Promise<ScopedOrgRow[]> {
  const trimmedRootOrgId = String(rootOrgId || '').trim()
  if (!trimmedRootOrgId) return []

  const { data, error } = await admin
    .from('organizations')
    .select('id, name, parent_org_id, created_at')
    .or(`id.eq.${trimmedRootOrgId},parent_org_id.eq.${trimmedRootOrgId}`)
    .order('created_at', { ascending: true })

  if (error || !Array.isArray(data)) return []
  return data as ScopedOrgRow[]
}

function pickPreferredDistributionOrg(children: ScopedOrgRow[]) {
  return (
    children.find((child) => String(child.name || '').toLowerCase().includes('distribusi')) ||
    children[0] ||
    null
  )
}

async function logTrainingProgressEvent(admin: any, input: {
  sessionId: string
  questionId?: number | null
  eventType: string
  severity?: 'info' | 'success' | 'warning' | 'error'
  message: string
  sourceModule?: string | null
  payload?: Record<string, unknown>
  createdBy?: string | null
}) {
  await admin
    .from('training_progress_events')
    .insert({
      session_id: input.sessionId,
      question_id: input.questionId ?? null,
      event_type: input.eventType,
      severity: input.severity || 'info',
      message: input.message,
      source_module: input.sourceModule || null,
      payload: input.payload || {},
      created_by: input.createdBy || null,
    })
}

async function syncLeaderboardSnapshot(admin: any, input: {
  session: TrainingSessionRow
  team: TrainingTeamRow
  step: TrainingSessionStepRow
  summary: string
}) {
  await admin
    .from('training_team_scores')
    .upsert({
      team_id: input.team.id,
      question_id: input.step.question_id,
      transaction_ok: Boolean(input.step.transaction_ok),
      context_ok: Boolean(input.step.context_ok),
      evidence_ok: Boolean(input.step.evidence_ok),
      note: input.summary,
      updated_by: input.session.started_by,
    }, { onConflict: 'team_id,question_id' })

  await admin
    .from('training_teams')
    .update({
      elapsed_minutes: Math.round(calculateElapsedSeconds(input.session) / 60),
      status: input.session.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE',
    })
    .eq('id', input.team.id)
}

async function loadTrainingSessionBundle(admin: any, sessionId: string) {
  const normalizedSessionId = String(sessionId || '').trim()
  if (!normalizedSessionId) return null

  const { data: sessionRow, error: sessionError } = await admin
    .from('training_sessions')
    .select('id, event_id, team_id, org_id, active_branch_id, status, current_question_id, started_by, started_at, deadline_at, paused_at, total_paused_seconds, completed_at, last_validated_at, last_heartbeat_at, metadata')
    .eq('id', normalizedSessionId)
    .maybeSingle()

  if (sessionError || !sessionRow?.id) return null

  const session = sessionRow as TrainingSessionRow

  const [{ data: eventRow }, { data: teamRow }, { data: stepRows }, { data: progressRows }, scopedOrgs] = await Promise.all([
    admin
      .from('training_events')
      .select('id, slug, title, description, settings')
      .eq('id', session.event_id)
      .maybeSingle(),
    admin
      .from('training_teams')
      .select('id, name, status')
      .eq('id', session.team_id)
      .maybeSingle(),
    admin
      .from('training_session_steps')
      .select('id, session_id, question_id, status, started_at, completed_at, deadline_at, elapsed_seconds, transaction_ok, context_ok, evidence_ok, points_awarded, matched_record_ids, matched_tables, validator_version, trainer_note, system_note')
      .eq('session_id', session.id)
      .order('question_id', { ascending: true }),
    admin
      .from('training_progress_events')
      .select('id, session_id, question_id, event_type, severity, message, source_module, payload, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false })
      .limit(6),
    getTrainingScopedOrganizations(admin, session.org_id),
  ])

  if (!eventRow?.id || !teamRow?.id) return null

  return {
    session,
    event: eventRow as TrainingEventRow,
    team: teamRow as TrainingTeamRow,
    steps: (Array.isArray(stepRows) ? stepRows : []) as TrainingSessionStepRow[],
    progressEvents: (Array.isArray(progressRows) ? progressRows : []) as TrainingProgressEventRow[],
    scopedOrgs,
  }
}

function buildTrainingSessionClientState(bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): TrainingSessionClientState {
  const scopedOrgRows = bundle.scopedOrgs
  const rootOrg = scopedOrgRows.find((org) => org.id === bundle.session.org_id) || scopedOrgRows[0] || null
  const currentQuestion = getQuestionById(bundle.session.current_question_id)
  const currentStep = bundle.steps.find((step) => step.question_id === bundle.session.current_question_id) || null
  const totalQuestions = getStepQuestionSet(bundle.session.metadata).length
  const pilotMode = totalQuestions < TRAINING_QUESTIONS.length
  const completionPercent = getCompletionPercent(bundle.steps)
  const elapsedSeconds = calculateElapsedSeconds(bundle.session)
  const remainingSeconds = calculateRemainingSeconds(bundle.session)
  const isActive = bundle.session.status === 'ACTIVE' || bundle.session.status === 'PAUSED'

  return {
    hasSession: true,
    active: isActive,
    session: {
      id: bundle.session.id,
      status: bundle.session.status,
      teamId: bundle.team.id,
      teamName: bundle.team.name,
      eventId: bundle.event.id,
      eventSlug: bundle.event.slug,
      eventTitle: bundle.event.title,
      orgId: bundle.session.org_id,
      orgName: rootOrg?.name || 'Training Org',
      currentQuestionId: bundle.session.current_question_id,
      totalQuestions,
      pilotMode,
      startedAt: bundle.session.started_at,
      deadlineAt: bundle.session.deadline_at,
      pausedAt: bundle.session.paused_at,
      completedAt: bundle.session.completed_at,
      remainingSeconds,
      elapsedSeconds,
      completionPercent,
      currentQuestion: currentQuestion ? {
        id: currentQuestion.id,
        title: currentQuestion.title,
        prompt: currentQuestion.prompt,
        module: currentQuestion.module,
        scope: currentQuestion.scope,
        phase: currentQuestion.phase,
        verification: currentQuestion.verification,
        href: getQuestionHref(currentQuestion.id),
      } : null,
      currentStep: currentStep ? {
        status: currentStep.status,
        transactionOk: Boolean(currentStep.transaction_ok),
        contextOk: Boolean(currentStep.context_ok),
        evidenceOk: Boolean(currentStep.evidence_ok),
        pointsAwarded: Number(currentStep.points_awarded || 0),
        systemNote: currentStep.system_note || null,
        trainerNote: currentStep.trainer_note || null,
      } : null,
      steps: bundle.steps.map((step) => ({
        questionId: step.question_id,
        status: step.status,
        pointsAwarded: Number(step.points_awarded || 0),
      })),
      recentEvents: bundle.progressEvents.map((event) => ({
        id: event.id,
        message: event.message,
        severity: event.severity,
        createdAt: event.created_at,
      })),
    },
  }
}

async function validateQuestionOne(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const rootOrgId = bundle.session.org_id
  const childOrgsCreatedInSession = bundle.scopedOrgs.filter((org) =>
    org.parent_org_id === rootOrgId && new Date(String(org.created_at || 0)).getTime() >= new Date(bundle.session.started_at).getTime()
  )
  const requiredOrgs = [bundle.scopedOrgs.find((org) => org.id === rootOrgId), ...childOrgsCreatedInSession.slice(0, 2)].filter(Boolean) as ScopedOrgRow[]
  const branchOrgIds = requiredOrgs.map((org) => org.id)

  const { data: activeBranches } = await admin
    .from('branches')
    .select('id, org_id')
    .in('org_id', branchOrgIds)
    .eq('is_active', true)

  const activeBranchCounts = ((Array.isArray(activeBranches) ? activeBranches : []) as Array<{ id: string; org_id: string }>)
    .reduce<Record<string, number>>((acc, branch) => {
      acc[branch.org_id] = (acc[branch.org_id] || 0) + 1
      return acc
    }, {})

  const transactionOk = childOrgsCreatedInSession.length >= 2
  const contextOk = transactionOk && childOrgsCreatedInSession.every((org) => org.parent_org_id === rootOrgId)
  const evidenceOk = transactionOk && requiredOrgs.every((org) => Number(activeBranchCounts[org.id] || 0) > 0)

  return {
    transactionOk,
    contextOk,
    evidenceOk,
    matchedRecordIds: [
      ...childOrgsCreatedInSession.map((org) => org.id),
      ...readStringArray((activeBranches || []).map((branch: any) => branch?.id)),
    ],
    matchedTables: ['organizations', 'branches'],
    sourceModule: 'settings/sub-orgs',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: transactionOk
      ? `Terdeteksi ${childOrgsCreatedInSession.length} anak perusahaan baru dan ${Object.values(activeBranchCounts).reduce((sum, count) => sum + count, 0)} cabang aktif.`
      : 'Belum terdeteksi dua anak perusahaan baru pada holding aktif.',
  }
}

async function validateQuestionTwo(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const scopeOrgIds = bundle.scopedOrgs.map((org) => org.id)
  const startedAt = bundle.session.started_at

  const [
    { data: products },
    { data: contacts },
    { data: warehouses },
    { data: bankAccounts },
  ] = await Promise.all([
    admin
      .from('products')
      .select('id, org_id')
      .in('org_id', scopeOrgIds)
      .gte('created_at', startedAt),
    admin
      .from('contacts')
      .select('id, org_id, type')
      .in('org_id', scopeOrgIds)
      .gte('created_at', startedAt),
    admin
      .from('warehouses')
      .select('id, org_id')
      .in('org_id', scopeOrgIds)
      .eq('is_active', true)
      .gte('created_at', startedAt),
    admin
      .from('bank_accounts')
      .select('id, org_id')
      .in('org_id', scopeOrgIds)
      .eq('is_active', true)
      .gte('created_at', startedAt),
  ])

  const typedContacts = (Array.isArray(contacts) ? contacts : []) as Array<{ id: string; org_id: string; type: string | null }>
  const supplierCount = typedContacts.filter((contact) => String(contact.type || '').toUpperCase() === 'SUPPLIER').length
  const customerCount = typedContacts.filter((contact) => String(contact.type || '').toUpperCase() === 'CUSTOMER').length
  const productCount = Array.isArray(products) ? products.length : 0
  const warehouseCount = Array.isArray(warehouses) ? warehouses.length : 0
  const bankAccountCount = Array.isArray(bankAccounts) ? bankAccounts.length : 0

  const transactionOk =
    productCount >= 3 &&
    supplierCount >= 1 &&
    customerCount >= 2 &&
    warehouseCount >= 2 &&
    bankAccountCount >= 1

  const orgCoverage = new Set<string>()
  ;(products || []).forEach((row: any) => orgCoverage.add(String(row?.org_id || '')))
  typedContacts.forEach((row) => orgCoverage.add(String(row.org_id || '')))
  ;(warehouses || []).forEach((row: any) => orgCoverage.add(String(row?.org_id || '')))
  ;(bankAccounts || []).forEach((row: any) => orgCoverage.add(String(row?.org_id || '')))

  const contextOk = transactionOk && orgCoverage.size >= 1
  const evidenceOk = transactionOk && warehouseCount >= 2 && bankAccountCount >= 1

  return {
    transactionOk,
    contextOk,
    evidenceOk,
    matchedRecordIds: [
      ...readStringArray((products || []).map((row: any) => row?.id)),
      ...typedContacts.map((row) => row.id),
      ...readStringArray((warehouses || []).map((row: any) => row?.id)),
      ...readStringArray((bankAccounts || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['products', 'contacts', 'warehouses', 'bank_accounts'],
    sourceModule: 'master-data',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: `Produk ${productCount}/3, supplier ${supplierCount}/1, customer ${customerCount}/2, gudang ${warehouseCount}/2, rekening ${bankAccountCount}/1.`,
  }
}

async function validateQuestionThree(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const scopeOrgIds = bundle.scopedOrgs.map((org) => org.id)
  const startedAt = bundle.session.started_at
  const rootOrgId = bundle.session.org_id

  const [{ data: bankTransactions }, { data: journalEntries }] = await Promise.all([
    admin
      .from('bank_transactions')
      .select('id, org_id, type, status')
      .in('org_id', scopeOrgIds)
      .eq('status', 'POSTED')
      .eq('type', 'IN')
      .gte('created_at', startedAt),
    admin
      .from('journal_entries')
      .select('id, org_id, status')
      .in('org_id', scopeOrgIds)
      .eq('status', 'POSTED')
      .gte('created_at', startedAt),
  ])

  const txOrgIds = Array.from(new Set(readStringArray((bankTransactions || []).map((row: any) => row?.org_id))))
  const journalOrgIds = Array.from(new Set(readStringArray((journalEntries || []).map((row: any) => row?.org_id))))
  const childOrgIds = bundle.scopedOrgs.filter((org) => org.parent_org_id === rootOrgId).map((org) => org.id)

  const transactionOk = txOrgIds.length >= 3
  const contextOk = transactionOk && txOrgIds.includes(rootOrgId) && childOrgIds.filter((orgId) => txOrgIds.includes(orgId)).length >= 2
  const evidenceOk = contextOk && journalOrgIds.includes(rootOrgId) && childOrgIds.filter((orgId) => journalOrgIds.includes(orgId)).length >= 2

  return {
    transactionOk,
    contextOk,
    evidenceOk,
    matchedRecordIds: [
      ...readStringArray((bankTransactions || []).map((row: any) => row?.id)),
      ...readStringArray((journalEntries || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['bank_transactions', 'journal_entries'],
    sourceModule: 'cash',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: `Modal awal terdeteksi pada ${txOrgIds.length} entitas dan jurnal posted pada ${journalOrgIds.length} entitas.`,
  }
}

async function validateQuestionFour(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const rootOrgId = bundle.session.org_id
  const childOrgs = bundle.scopedOrgs.filter((org) => org.parent_org_id === rootOrgId)
  const distributionOrg = pickPreferredDistributionOrg(childOrgs)

  if (!distributionOrg) {
    return {
      transactionOk: false,
      contextOk: false,
      evidenceOk: false,
      matchedRecordIds: [],
      matchedTables: ['bank_transactions'],
      sourceModule: 'cash',
      validatorVersion: EDU_VALIDATOR_VERSION,
      summary: 'Belum ada entitas anak distribusi yang bisa dijadikan tujuan transfer modal.',
    }
  }

  const [{ data: sourceTx }, { data: targetTx }, { data: sourceJe }, { data: targetJe }] = await Promise.all([
    admin
      .from('bank_transactions')
      .select('id, amount, transaction_date, description')
      .eq('org_id', rootOrgId)
      .eq('status', 'POSTED')
      .eq('type', 'TRANSFER')
      .gte('created_at', startedAt)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('bank_transactions')
      .select('id, amount, transaction_date, description')
      .eq('org_id', distributionOrg.id)
      .eq('status', 'POSTED')
      .eq('type', 'IN')
      .gte('created_at', startedAt)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('journal_entries')
      .select('id')
      .eq('org_id', rootOrgId)
      .eq('status', 'POSTED')
      .gte('created_at', startedAt),
    admin
      .from('journal_entries')
      .select('id')
      .eq('org_id', distributionOrg.id)
      .eq('status', 'POSTED')
      .gte('created_at', startedAt),
  ])

  const sourceRows = (Array.isArray(sourceTx) ? sourceTx : []) as Array<{ id: string; amount: number; transaction_date: string; description: string | null }>
  const targetRows = (Array.isArray(targetTx) ? targetTx : []) as Array<{ id: string; amount: number; transaction_date: string; description: string | null }>

  const paired = sourceRows.find((source) =>
    targetRows.some((target) =>
      Number(target.amount || 0) === Number(source.amount || 0) &&
      String(target.transaction_date || '') === String(source.transaction_date || '') &&
      String(target.description || '').trim().toLowerCase() === String(source.description || '').trim().toLowerCase()
    )
  )

  const transactionOk = Boolean(paired)
  const contextOk = transactionOk && Boolean(distributionOrg.id)
  const evidenceOk = transactionOk && Array.isArray(sourceJe) && sourceJe.length > 0 && Array.isArray(targetJe) && targetJe.length > 0

  return {
    transactionOk,
    contextOk,
    evidenceOk,
    matchedRecordIds: [
      ...sourceRows.map((row) => row.id),
      ...targetRows.map((row) => row.id),
      ...readStringArray((sourceJe || []).map((row: any) => row?.id)),
      ...readStringArray((targetJe || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['bank_transactions', 'journal_entries'],
    sourceModule: 'cash',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: transactionOk
      ? `Transfer modal root -> ${distributionOrg.name} terdeteksi dengan pasangan transaksi sumber dan tujuan yang konsisten.`
      : `Belum terdeteksi pasangan transfer modal yang konsisten menuju ${distributionOrg.name}.`,
  }
}

async function validateQuestionFive(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const rootOrgId = bundle.session.org_id
  const childOrgs = bundle.scopedOrgs.filter((org) => org.parent_org_id === rootOrgId)
  const distributionOrg = pickPreferredDistributionOrg(childOrgs)

  if (!distributionOrg) {
    return {
      transactionOk: false,
      contextOk: false,
      evidenceOk: false,
      matchedRecordIds: [],
      matchedTables: ['purchases'],
      sourceModule: 'purchasing',
      validatorVersion: EDU_VALIDATOR_VERSION,
      summary: 'Belum ada entitas distribusi untuk divalidasi pada soal pembelian.',
    }
  }

  const { data: purchases } = await admin
    .from('purchases')
    .select('id, org_id, status, due_date, vendor_id, warehouse_id, notes')
    .eq('org_id', distributionOrg.id)
    .gte('created_at', startedAt)
    .order('created_at', { ascending: false })
    .limit(10)

  const purchaseRows = (Array.isArray(purchases) ? purchases : []) as Array<{
    id: string
    org_id: string
    status: string | null
    due_date: string | null
    vendor_id: string | null
    warehouse_id: string | null
    notes: string | null
  }>

  const eligiblePurchaseRows = purchaseRows.filter((purchase) => {
    const status = String(purchase.status || '').trim().toUpperCase()
    return status !== 'DRAFT' && status !== 'VOID' && status !== 'VOIDED' && status !== 'CANCELLED'
  })

  const creditPurchase = eligiblePurchaseRows.find((purchase) =>
    Boolean(purchase.due_date) || String(purchase.notes || '').toUpperCase().includes('TERMIN: TEMPO')
  )

  const purchaseIds = eligiblePurchaseRows.map((purchase) => purchase.id)
  const [{ data: stockMovements }, { data: journalEntries }] = purchaseIds.length > 0
    ? await Promise.all([
        admin
          .from('stock_movements')
          .select('id, reference_id, reference_type')
          .eq('org_id', distributionOrg.id)
          .eq('reference_type', 'PURCHASE')
          .in('reference_id', purchaseIds)
          .gte('created_at', startedAt),
        admin
          .from('journal_entries')
          .select('id, reference_id, reference_type, status')
          .eq('org_id', distributionOrg.id)
          .eq('status', 'POSTED')
          .eq('reference_type', 'PURCHASE')
          .in('reference_id', purchaseIds)
          .gte('created_at', startedAt),
      ])
    : [{ data: [] }, { data: [] }]

  const stockMovementIds = readStringArray((stockMovements || []).map((row: any) => row?.id))
  const journalEntryIds = readStringArray((journalEntries || []).map((row: any) => row?.id))

  const transactionOk = Boolean(creditPurchase)
  const contextOk = Boolean(creditPurchase?.vendor_id) && Boolean(creditPurchase?.warehouse_id)
  const evidenceOk =
    Boolean(creditPurchase) &&
    String(creditPurchase?.status || '').toUpperCase() === 'RECEIVED' &&
    stockMovementIds.length > 0 &&
    journalEntryIds.length > 0

  return {
    transactionOk,
    contextOk,
    evidenceOk,
    matchedRecordIds: [
      ...purchaseIds,
      ...stockMovementIds,
      ...journalEntryIds,
    ],
    matchedTables: ['purchases', 'stock_movements', 'journal_entries'],
    sourceModule: 'purchasing',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: transactionOk
      ? `PO kredit ${creditPurchase?.status === 'RECEIVED' ? 'sudah diterima' : 'sudah dibuat'} pada ${distributionOrg.name}; bukti stok/jurnal ${evidenceOk ? 'lengkap' : 'belum lengkap'}.`
      : `Belum terdeteksi PO kredit baru pada ${distributionOrg.name}.`,
  }
}

async function runTrainingValidator(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>) {
  switch (bundle.session.current_question_id) {
    case 1:
      return validateQuestionOne(admin, bundle)
    case 2:
      return validateQuestionTwo(admin, bundle)
    case 3:
      return validateQuestionThree(admin, bundle)
    case 4:
      return validateQuestionFour(admin, bundle)
    case 5:
      return validateQuestionFive(admin, bundle)
    default:
      return {
        transactionOk: false,
        contextOk: false,
        evidenceOk: false,
        matchedRecordIds: [],
        matchedTables: [],
        summary: 'Validator otomatis belum tersedia untuk soal ini pada pilot realtime 1-5.',
        sourceModule: 'edu',
        validatorVersion: EDU_VALIDATOR_VERSION,
        needsReview: true,
      } satisfies TrainingValidationResult
  }
}

export async function clearEduSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(EDU_SESSION_COOKIE)
}

export async function setEduSessionCookie(sessionId: string) {
  const cookieStore = await cookies()
  cookieStore.set(EDU_SESSION_COOKIE, sessionId, getEduCookieOptions())
}

export async function primeEduOrgContext(rootOrgId: string) {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORG_COOKIE, rootOrgId, getEduCookieOptions())
  const activeBranch = await getActiveBranch(rootOrgId)
  if (activeBranch?.id) {
    cookieStore.set(ACTIVE_BRANCH_COOKIE, activeBranch.id, getEduCookieOptions())
  } else {
    cookieStore.delete(ACTIVE_BRANCH_COOKIE)
  }
}

export async function getCurrentTrainingSessionState(): Promise<TrainingSessionClientState> {
  const cookieStore = await cookies()
  const sessionId = String(cookieStore.get(EDU_SESSION_COOKIE)?.value || '').trim()
  if (!sessionId) return { hasSession: false, active: false }

  const orgData = await getActiveOrg()
  if (!orgData) {
    return { hasSession: false, active: false }
  }

  const admin = (await createAdminClient()) as any
  const bundle = await loadTrainingSessionBundle(admin, sessionId)
  if (!bundle) return { hasSession: false, active: false }

  const scopedOrgIds = bundle.scopedOrgs.map((org) => org.id)
  if (!scopedOrgIds.includes(orgData.org.id)) {
    return { hasSession: true, active: false, outsideScope: true }
  }

  return buildTrainingSessionClientState(bundle)
}

export async function validateCurrentTrainingSession() {
  const cookieStore = await cookies()
  const sessionId = String(cookieStore.get(EDU_SESSION_COOKIE)?.value || '').trim()
  if (!sessionId) return { hasSession: false, active: false } satisfies TrainingSessionClientState

  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) {
    return { hasSession: false, active: false } satisfies TrainingSessionClientState
  }

  const admin = (await createAdminClient()) as any
  const bundle = await loadTrainingSessionBundle(admin, sessionId)
  if (!bundle) return { hasSession: false, active: false } satisfies TrainingSessionClientState

  const scopedOrgIds = bundle.scopedOrgs.map((org) => org.id)
  if (!scopedOrgIds.includes(orgData.org.id)) {
    return { hasSession: true, active: false, outsideScope: true } satisfies TrainingSessionClientState
  }

  if (bundle.session.status === 'COMPLETED' || bundle.session.status === 'EXPIRED' || bundle.session.status === 'ABANDONED') {
    return buildTrainingSessionClientState(bundle)
  }

  if (bundle.session.deadline_at && new Date(bundle.session.deadline_at).getTime() <= Date.now() && bundle.session.status === 'ACTIVE') {
    await admin
      .from('training_sessions')
      .update({
        status: 'EXPIRED',
        completed_at: new Date().toISOString(),
        last_validated_at: new Date().toISOString(),
      })
      .eq('id', bundle.session.id)

    await logTrainingProgressEvent(admin, {
      sessionId: bundle.session.id,
      questionId: bundle.session.current_question_id,
      eventType: 'session_expired',
      severity: 'warning',
      message: 'Sesi realtime berakhir karena batas waktu global habis.',
      sourceModule: 'edu',
      createdBy: bundle.session.started_by,
    })

    revalidatePath('/edu')
    revalidatePath('/dashboard')
    const expiredBundle = await loadTrainingSessionBundle(admin, bundle.session.id)
    return expiredBundle ? buildTrainingSessionClientState(expiredBundle) : { hasSession: false, active: false }
  }

  if (bundle.session.status !== 'ACTIVE') {
    return buildTrainingSessionClientState(bundle)
  }

  const currentStep = bundle.steps.find((step) => step.question_id === bundle.session.current_question_id)
  if (!currentStep) {
    return buildTrainingSessionClientState(bundle)
  }

  const validation = await runTrainingValidator(admin, bundle)
  const passed = validation.transactionOk && validation.contextOk && validation.evidenceOk
  const nextPoints = Number(validation.transactionOk) + Number(validation.contextOk) + Number(validation.evidenceOk)
  const summary = validation.summary

  await admin
    .from('training_session_steps')
    .update({
      status: passed ? 'PASSED' : currentStep.status,
      completed_at: passed ? new Date().toISOString() : currentStep.completed_at,
      transaction_ok: validation.transactionOk,
      context_ok: validation.contextOk,
      evidence_ok: validation.evidenceOk,
      points_awarded: nextPoints,
      matched_record_ids: validation.matchedRecordIds,
      matched_tables: validation.matchedTables,
      validator_version: validation.validatorVersion || EDU_VALIDATOR_VERSION,
      system_note: summary,
    })
    .eq('id', currentStep.id)

  const refreshedSession: TrainingSessionRow = {
    ...bundle.session,
    last_validated_at: new Date().toISOString(),
  }
  const refreshedStep: TrainingSessionStepRow = {
    ...currentStep,
    status: passed ? 'PASSED' : currentStep.status,
    completed_at: passed ? new Date().toISOString() : currentStep.completed_at,
    transaction_ok: validation.transactionOk,
    context_ok: validation.contextOk,
    evidence_ok: validation.evidenceOk,
    points_awarded: nextPoints,
    system_note: summary,
    matched_record_ids: validation.matchedRecordIds,
    matched_tables: validation.matchedTables,
    validator_version: validation.validatorVersion || EDU_VALIDATOR_VERSION,
  }

  await syncLeaderboardSnapshot(admin, {
    session: refreshedSession,
    team: bundle.team,
    step: refreshedStep,
    summary,
  })

  await logTrainingProgressEvent(admin, {
    sessionId: bundle.session.id,
    questionId: bundle.session.current_question_id,
    eventType: passed ? 'step_passed' : 'step_checked',
    severity: passed ? 'success' : (validation.needsReview ? 'warning' : 'info'),
    message: summary,
    sourceModule: validation.sourceModule,
    payload: {
      transactionOk: validation.transactionOk,
      contextOk: validation.contextOk,
      evidenceOk: validation.evidenceOk,
      points: nextPoints,
    },
    createdBy: bundle.session.started_by,
  })

  if (passed) {
    const questionSet = getStepQuestionSet(bundle.session.metadata)
    const currentQuestionIndex = questionSet.findIndex((question) => question.id === bundle.session.current_question_id)
    const nextQuestion = questionSet[currentQuestionIndex + 1]

    if (nextQuestion) {
      await admin
        .from('training_session_steps')
        .update({
          status: 'ACTIVE',
          started_at: new Date().toISOString(),
        })
        .eq('session_id', bundle.session.id)
        .eq('question_id', nextQuestion.id)

      await admin
        .from('training_sessions')
        .update({
          current_question_id: nextQuestion.id,
          last_validated_at: new Date().toISOString(),
        })
        .eq('id', bundle.session.id)

      await logTrainingProgressEvent(admin, {
        sessionId: bundle.session.id,
        questionId: nextQuestion.id,
        eventType: 'step_advanced',
        severity: 'success',
        message: `Lanjut ke soal ${nextQuestion.id}: ${nextQuestion.title}.`,
        sourceModule: validation.sourceModule,
        createdBy: bundle.session.started_by,
      })
    } else {
      await admin
        .from('training_sessions')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          last_validated_at: new Date().toISOString(),
        })
        .eq('id', bundle.session.id)

      await admin
        .from('training_teams')
        .update({
          status: 'COMPLETED',
          elapsed_minutes: Math.round(calculateElapsedSeconds(refreshedSession) / 60),
        })
        .eq('id', bundle.team.id)

      await logTrainingProgressEvent(admin, {
        sessionId: bundle.session.id,
        questionId: bundle.session.current_question_id,
        eventType: 'session_completed',
        severity: 'success',
        message: 'Pilot realtime EDU Mode selesai. Semua soal realtime 1-5 telah lolos.',
        sourceModule: 'edu',
        createdBy: bundle.session.started_by,
      })
    }
  } else {
    await admin
      .from('training_sessions')
      .update({
        last_validated_at: new Date().toISOString(),
      })
      .eq('id', bundle.session.id)
  }

  revalidatePath('/edu')
  revalidatePath('/dashboard')

  const refreshedBundle = await loadTrainingSessionBundle(admin, bundle.session.id)
  return refreshedBundle ? buildTrainingSessionClientState(refreshedBundle) : { hasSession: false, active: false }
}
