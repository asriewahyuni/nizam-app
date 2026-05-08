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
export const EDU_REALTIME_QUESTION_LIMIT = TRAINING_QUESTIONS.length
export const EDU_VALIDATOR_VERSION = 'v2-full-1-15'

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
  const raw = Number(metadata?.question_limit || EDU_REALTIME_QUESTION_LIMIT)
  if (!Number.isFinite(raw)) return EDU_REALTIME_QUESTION_LIMIT
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

function pickPreferredRetailOrg(children: ScopedOrgRow[]) {
  return (
    children.find((child) => String(child.name || '').toLowerCase().includes('retail')) ||
    children[1] ||
    children[0] ||
    null
  )
}

function sumNumericValues(values: Array<number | null | undefined>) {
  return values.reduce<number>((sum, value) => sum + Number(value || 0), 0)
}

function toUpperText(value: unknown) {
  return String(value || '').trim().toUpperCase()
}

function isActiveBusinessDocumentStatus(status: unknown) {
  const normalized = toUpperText(status)
  return normalized !== 'DRAFT' && normalized !== 'VOID' && normalized !== 'VOIDED' && normalized !== 'CANCELLED'
}

function asJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return value as Record<string, unknown>
}

function sumBalanceRows(rows: Array<{ balance?: number | null }> | null | undefined) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Number(row?.balance || 0), 0)
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

async function validateQuestionSix(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const distributionOrg = pickPreferredDistributionOrg(bundle.scopedOrgs.filter((org) => org.parent_org_id === bundle.session.org_id))

  if (!distributionOrg) {
    return {
      transactionOk: false,
      contextOk: false,
      evidenceOk: false,
      matchedRecordIds: [],
      matchedTables: ['purchase_payments'],
      sourceModule: 'purchasing',
      validatorVersion: EDU_VALIDATOR_VERSION,
      summary: 'Belum ada entitas distribusi untuk validasi pembayaran hutang supplier.',
    }
  }

  const { data: paymentRows } = await admin
    .from('purchase_payments')
    .select('id, purchase_id, amount, discount_amount')
    .eq('org_id', distributionOrg.id)
    .gte('created_at', startedAt)
    .order('created_at', { ascending: false })

  const payments = (Array.isArray(paymentRows) ? paymentRows : []) as Array<{
    id: string
    purchase_id: string | null
    amount: number | null
    discount_amount: number | null
  }>
  const purchaseIds = Array.from(new Set(readStringArray(payments.map((row) => row.purchase_id))))

  const [{ data: purchases }, { data: paymentJournals }, { data: returnRows }] = purchaseIds.length > 0
    ? await Promise.all([
        admin
          .from('purchases')
          .select('id, due_date, vendor_id, grand_total, status')
          .eq('org_id', distributionOrg.id)
          .in('id', purchaseIds),
        admin
          .from('journal_entries')
          .select('id, reference_id')
          .eq('org_id', distributionOrg.id)
          .eq('status', 'POSTED')
          .eq('reference_type', 'PURCHASE_PAYMENT')
          .in('reference_id', payments.map((row) => row.id)),
        admin
          .from('purchase_returns')
          .select('id, purchase_id, total_amount')
          .eq('org_id', distributionOrg.id)
          .in('purchase_id', purchaseIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const purchaseById = new Map(
    ((Array.isArray(purchases) ? purchases : []) as Array<{
      id: string
      due_date: string | null
      vendor_id: string | null
      grand_total: number | null
      status: string | null
    }>).map((row) => [row.id, row])
  )
  const returnedByPurchaseId = new Map<string, number>()
  for (const row of (Array.isArray(returnRows) ? returnRows : []) as Array<{ purchase_id?: string | null; total_amount?: number | null }>) {
    const purchaseId = String(row.purchase_id || '')
    if (!purchaseId) continue
    returnedByPurchaseId.set(purchaseId, (returnedByPurchaseId.get(purchaseId) || 0) + Number(row.total_amount || 0))
  }
  const paidByPurchaseId = new Map<string, number>()
  for (const row of payments) {
    const purchaseId = String(row.purchase_id || '')
    if (!purchaseId) continue
    paidByPurchaseId.set(purchaseId, (paidByPurchaseId.get(purchaseId) || 0) + Number(row.amount || 0) + Number(row.discount_amount || 0))
  }

  const partialPayment = payments.find((payment) => {
    const purchase = purchaseById.get(String(payment.purchase_id || ''))
    if (!purchase || !isActiveBusinessDocumentStatus(purchase.status)) return false
    const outstanding = Number(purchase.grand_total || 0)
      - Number(returnedByPurchaseId.get(purchase.id) || 0)
      - Number(paidByPurchaseId.get(purchase.id) || 0)
    return Boolean(purchase.due_date) && outstanding > 0.0001
  })

  return {
    transactionOk: payments.length > 0,
    contextOk: Boolean(partialPayment && purchaseById.get(String(partialPayment.purchase_id || ''))?.vendor_id),
    evidenceOk: Boolean(partialPayment) && readStringArray((paymentJournals || []).map((row: any) => row?.id)).length > 0,
    matchedRecordIds: [
      ...payments.map((row) => row.id),
      ...purchaseIds,
      ...readStringArray((paymentJournals || []).map((row: any) => row?.id)),
      ...readStringArray((returnRows || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['purchase_payments', 'purchases', 'purchase_returns', 'journal_entries'],
    sourceModule: 'purchasing',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: partialPayment
      ? `Pembayaran sebagian hutang supplier pada ${distributionOrg.name} terdeteksi dan sisa hutang masih terbuka.`
      : payments.length > 0
        ? `Pembayaran hutang supplier sudah ada pada ${distributionOrg.name}, tetapi sistem belum melihat sisa hutang terbuka yang relevan.`
        : `Belum ada pembayaran hutang supplier baru pada ${distributionOrg.name}.`,
  }
}

async function validateQuestionSeven(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const distributionOrg = pickPreferredDistributionOrg(bundle.scopedOrgs.filter((org) => org.parent_org_id === bundle.session.org_id))

  if (!distributionOrg) {
    return {
      transactionOk: false,
      contextOk: false,
      evidenceOk: false,
      matchedRecordIds: [],
      matchedTables: ['inventory_adjustments'],
      sourceModule: 'inventory',
      validatorVersion: EDU_VALIDATOR_VERSION,
      summary: 'Belum ada entitas distribusi untuk validasi mutasi stok antar gudang.',
    }
  }

  const { data: transferRows } = await admin
    .from('inventory_adjustments')
    .select('id, notes, status')
    .eq('org_id', distributionOrg.id)
    .gte('created_at', startedAt)
    .ilike('notes', '%[TRANSFER]%')
    .order('created_at', { ascending: false })

  const transfers = (Array.isArray(transferRows) ? transferRows : []) as Array<{ id: string; notes: string | null; status: string | null }>
  const transferIds = transfers.map((row) => row.id)
  const [{ data: itemRows }, { data: stockMovements }] = transferIds.length > 0
    ? await Promise.all([
        admin
          .from('inventory_adjustment_items')
          .select('id, adjustment_id, product_id, warehouse_id, diff_quantity')
          .eq('org_id', distributionOrg.id)
          .in('adjustment_id', transferIds),
        admin
          .from('stock_movements')
          .select('id, reference_id')
          .eq('org_id', distributionOrg.id)
          .eq('reference_type', 'ADJUSTMENT')
          .in('reference_id', transferIds),
      ])
    : [{ data: [] }, { data: [] }]

  const itemsByTransferId = new Map<string, Array<{ warehouse_id: string | null; diff_quantity: number | null }>>()
  for (const row of (Array.isArray(itemRows) ? itemRows : []) as Array<{
    adjustment_id: string | null
    warehouse_id: string | null
    diff_quantity: number | null
  }>) {
    const adjustmentId = String(row.adjustment_id || '')
    if (!adjustmentId) continue
    const items = itemsByTransferId.get(adjustmentId) || []
    items.push(row)
    itemsByTransferId.set(adjustmentId, items)
  }

  const validTransfer = transfers.find((transfer) => {
    const items = itemsByTransferId.get(transfer.id) || []
    const hasSource = items.some((item) => Number(item.diff_quantity || 0) < 0)
    const hasTarget = items.some((item) => Number(item.diff_quantity || 0) > 0)
    const warehouseCount = new Set(items.map((item) => String(item.warehouse_id || '')).filter(Boolean)).size
    return hasSource && hasTarget && warehouseCount >= 2
  })

  return {
    transactionOk: transfers.length > 0,
    contextOk: Boolean(validTransfer),
    evidenceOk: Boolean(validTransfer) && readStringArray((stockMovements || []).map((row: any) => row?.id)).length > 0,
    matchedRecordIds: [
      ...transferIds,
      ...readStringArray((itemRows || []).map((row: any) => row?.id)),
      ...readStringArray((stockMovements || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['inventory_adjustments', 'inventory_adjustment_items', 'stock_movements'],
    sourceModule: 'inventory',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: validTransfer
      ? `Mutasi stok antar gudang pada ${distributionOrg.name} terdeteksi lengkap dengan jejak ledger stok.`
      : transfers.length > 0
        ? `Mutasi stok sudah dibuat pada ${distributionOrg.name}, tetapi pasangan gudang sumber/tujuan belum terbaca jelas.`
        : `Belum ada mutasi stok antar gudang baru pada ${distributionOrg.name}.`,
  }
}

async function validateQuestionEight(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const distributionOrg = pickPreferredDistributionOrg(bundle.scopedOrgs.filter((org) => org.parent_org_id === bundle.session.org_id))

  if (!distributionOrg) {
    return {
      transactionOk: false,
      contextOk: false,
      evidenceOk: false,
      matchedRecordIds: [],
      matchedTables: ['sales'],
      sourceModule: 'sales',
      validatorVersion: EDU_VALIDATOR_VERSION,
      summary: 'Belum ada entitas distribusi untuk validasi penjualan kredit.',
    }
  }

  const { data: saleRows } = await admin
    .from('sales')
    .select('id, customer_id, warehouse_id, due_date, payment_term, status')
    .eq('org_id', distributionOrg.id)
    .gte('created_at', startedAt)
    .order('created_at', { ascending: false })

  const creditSales = ((Array.isArray(saleRows) ? saleRows : []) as Array<{
    id: string
    customer_id: string | null
    warehouse_id: string | null
    due_date: string | null
    payment_term: string | null
    status: string | null
  }>).filter((sale) =>
    isActiveBusinessDocumentStatus(sale.status) && (Boolean(sale.due_date) || toUpperText(sale.payment_term) === 'TEMPO')
  )

  const saleIds = creditSales.map((row) => row.id)
  const [{ data: stockMovements }, { data: journalEntries }] = saleIds.length > 0
    ? await Promise.all([
        admin
          .from('stock_movements')
          .select('id, reference_id')
          .eq('org_id', distributionOrg.id)
          .eq('reference_type', 'SALE')
          .in('reference_id', saleIds),
        admin
          .from('journal_entries')
          .select('id, reference_id')
          .eq('org_id', distributionOrg.id)
          .eq('status', 'POSTED')
          .eq('reference_type', 'SALE')
          .in('reference_id', saleIds),
      ])
    : [{ data: [] }, { data: [] }]

  const deliveredCreditSale = creditSales.find((sale) =>
    readStringArray((stockMovements || []).filter((row: any) => row?.reference_id === sale.id).map((row: any) => row?.id)).length > 0 &&
    readStringArray((journalEntries || []).filter((row: any) => row?.reference_id === sale.id).map((row: any) => row?.id)).length > 0
  )

  return {
    transactionOk: creditSales.length > 0,
    contextOk: Boolean(deliveredCreditSale?.customer_id) && Boolean(deliveredCreditSale?.warehouse_id),
    evidenceOk: Boolean(deliveredCreditSale),
    matchedRecordIds: [
      ...saleIds,
      ...readStringArray((stockMovements || []).map((row: any) => row?.id)),
      ...readStringArray((journalEntries || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['sales', 'stock_movements', 'journal_entries'],
    sourceModule: 'sales',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: deliveredCreditSale
      ? `Penjualan kredit pada ${distributionOrg.name} terdeteksi lengkap dengan stok keluar dan jurnal penjualan.`
      : creditSales.length > 0
        ? `Sales order kredit sudah ada pada ${distributionOrg.name}, tetapi bukti stok/jurnal belum lengkap.`
        : `Belum ada penjualan kredit baru pada ${distributionOrg.name}.`,
  }
}

async function validateQuestionNine(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const distributionOrg = pickPreferredDistributionOrg(bundle.scopedOrgs.filter((org) => org.parent_org_id === bundle.session.org_id))

  if (!distributionOrg) {
    return {
      transactionOk: false,
      contextOk: false,
      evidenceOk: false,
      matchedRecordIds: [],
      matchedTables: ['sales_payments'],
      sourceModule: 'cash',
      validatorVersion: EDU_VALIDATOR_VERSION,
      summary: 'Belum ada entitas distribusi untuk validasi pelunasan piutang customer.',
    }
  }

  const { data: paymentRows } = await admin
    .from('sales_payments')
    .select('id, sale_id, amount, discount_amount')
    .eq('org_id', distributionOrg.id)
    .gte('created_at', startedAt)
    .order('created_at', { ascending: false })

  const payments = (Array.isArray(paymentRows) ? paymentRows : []) as Array<{
    id: string
    sale_id: string | null
    amount: number | null
    discount_amount: number | null
  }>
  const saleIds = Array.from(new Set(readStringArray(payments.map((row) => row.sale_id))))
  const [{ data: sales }, { data: paymentJournals }] = saleIds.length > 0
    ? await Promise.all([
        admin
          .from('sales')
          .select('id, customer_id, due_date, grand_total, status')
          .eq('org_id', distributionOrg.id)
          .in('id', saleIds),
        admin
          .from('journal_entries')
          .select('id, reference_id')
          .eq('org_id', distributionOrg.id)
          .eq('status', 'POSTED')
          .eq('reference_type', 'PAYMENT_IN')
          .in('reference_id', payments.map((row) => row.id)),
      ])
    : [{ data: [] }, { data: [] }]

  const saleById = new Map(
    ((Array.isArray(sales) ? sales : []) as Array<{
      id: string
      customer_id: string | null
      due_date: string | null
      grand_total: number | null
      status: string | null
    }>).map((row) => [row.id, row])
  )
  const paidBySaleId = new Map<string, number>()
  for (const row of payments) {
    const saleId = String(row.sale_id || '')
    if (!saleId) continue
    paidBySaleId.set(saleId, (paidBySaleId.get(saleId) || 0) + Number(row.amount || 0) + Number(row.discount_amount || 0))
  }

  const partialCollection = payments.find((payment) => {
    const sale = saleById.get(String(payment.sale_id || ''))
    if (!sale || !isActiveBusinessDocumentStatus(sale.status)) return false
    const outstanding = Number(sale.grand_total || 0) - Number(paidBySaleId.get(sale.id) || 0)
    return Boolean(sale.due_date) && outstanding > 0.0001
  })

  return {
    transactionOk: payments.length > 0,
    contextOk: Boolean(partialCollection && saleById.get(String(partialCollection.sale_id || ''))?.customer_id),
    evidenceOk: Boolean(partialCollection) && readStringArray((paymentJournals || []).map((row: any) => row?.id)).length > 0,
    matchedRecordIds: [
      ...payments.map((row) => row.id),
      ...saleIds,
      ...readStringArray((paymentJournals || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['sales_payments', 'sales', 'journal_entries'],
    sourceModule: 'cash',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: partialCollection
      ? `Pelunasan sebagian piutang customer pada ${distributionOrg.name} terdeteksi dan sisa tagihan masih terbuka.`
      : payments.length > 0
        ? `Penerimaan piutang sudah ada pada ${distributionOrg.name}, tetapi sisa tagihan belum terbaca sebagai partial.`
        : `Belum ada penerimaan piutang baru pada ${distributionOrg.name}.`,
  }
}

async function validateQuestionTen(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const retailOrg = pickPreferredRetailOrg(bundle.scopedOrgs.filter((org) => org.parent_org_id === bundle.session.org_id))

  if (!retailOrg) {
    return {
      transactionOk: false,
      contextOk: false,
      evidenceOk: false,
      matchedRecordIds: [],
      matchedTables: ['sales'],
      sourceModule: 'pos',
      validatorVersion: EDU_VALIDATOR_VERSION,
      summary: 'Belum ada entitas retail untuk validasi transaksi POS.',
    }
  }

  const { data: saleRows } = await admin
    .from('sales')
    .select('id, customer_id, warehouse_id, payment_status, notes, pos_payment_method')
    .eq('org_id', retailOrg.id)
    .gte('created_at', startedAt)
    .order('created_at', { ascending: false })

  const posSales = ((Array.isArray(saleRows) ? saleRows : []) as Array<{
    id: string
    customer_id: string | null
    warehouse_id: string | null
    payment_status: string | null
    notes: string | null
    pos_payment_method?: string | null
  }>).filter((sale) =>
    Boolean(sale.pos_payment_method) || String(sale.notes || '').toLowerCase().includes('pos')
  )

  const saleIds = posSales.map((row) => row.id)
  const [{ data: stockMovements }, { data: paymentRows }, { data: journalEntries }] = saleIds.length > 0
    ? await Promise.all([
        admin
          .from('stock_movements')
          .select('id, reference_id')
          .eq('org_id', retailOrg.id)
          .eq('reference_type', 'SALE')
          .in('reference_id', saleIds),
        admin
          .from('sales_payments')
          .select('id, sale_id')
          .eq('org_id', retailOrg.id)
          .in('sale_id', saleIds),
        admin
          .from('journal_entries')
          .select('id, reference_id')
          .eq('org_id', retailOrg.id)
          .eq('status', 'POSTED')
          .in('reference_id', saleIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const validPosSale = posSales.find((sale) => {
    const hasStock = readStringArray((stockMovements || []).filter((row: any) => row?.reference_id === sale.id).map((row: any) => row?.id)).length > 0
    const hasPayment = readStringArray((paymentRows || []).filter((row: any) => row?.sale_id === sale.id).map((row: any) => row?.id)).length > 0
    return hasStock && hasPayment && toUpperText(sale.payment_status) === 'PAID'
  })

  return {
    transactionOk: posSales.length > 0,
    contextOk: Boolean(validPosSale?.customer_id) && Boolean(validPosSale?.warehouse_id),
    evidenceOk: Boolean(validPosSale) && readStringArray((journalEntries || []).map((row: any) => row?.id)).length > 0,
    matchedRecordIds: [
      ...saleIds,
      ...readStringArray((stockMovements || []).map((row: any) => row?.id)),
      ...readStringArray((paymentRows || []).map((row: any) => row?.id)),
      ...readStringArray((journalEntries || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['sales', 'stock_movements', 'sales_payments', 'journal_entries'],
    sourceModule: 'pos',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: validPosSale
      ? `Transaksi POS tunai pada ${retailOrg.name} terdeteksi lengkap dengan stok keluar dan pembayaran masuk.`
      : posSales.length > 0
        ? `Transaksi POS sudah ada pada ${retailOrg.name}, tetapi bukti stok atau pembayaran belum lengkap.`
        : `Belum ada transaksi POS baru pada ${retailOrg.name}.`,
  }
}

async function validateQuestionEleven(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const retailOrg = pickPreferredRetailOrg(bundle.scopedOrgs.filter((org) => org.parent_org_id === bundle.session.org_id))

  if (!retailOrg) {
    return {
      transactionOk: false,
      contextOk: false,
      evidenceOk: false,
      matchedRecordIds: [],
      matchedTables: ['reimbursements'],
      sourceModule: 'accounting/reimburse',
      validatorVersion: EDU_VALIDATOR_VERSION,
      summary: 'Belum ada entitas retail untuk validasi reimbursement.',
    }
  }

  const { data: reimbursementRows } = await admin
    .from('reimbursements')
    .select('id, branch_id, status, journal_id')
    .eq('org_id', retailOrg.id)
    .gte('created_at', startedAt)
    .order('created_at', { ascending: false })

  const reimbursements = (Array.isArray(reimbursementRows) ? reimbursementRows : []) as Array<{
    id: string
    branch_id: string | null
    status: string | null
    journal_id: string | null
  }>
  const reimbursementIds = reimbursements.map((row) => row.id)
  const [{ data: itemRows }, { data: journalEntries }] = reimbursementIds.length > 0
    ? await Promise.all([
        admin
          .from('reimbursement_items')
          .select('id, reimbursement_id')
          .in('reimbursement_id', reimbursementIds),
        admin
          .from('journal_entries')
          .select('id, reference_id')
          .eq('org_id', retailOrg.id)
          .eq('status', 'POSTED')
          .eq('reference_type', 'CASH_OUT')
          .in('reference_id', reimbursementIds),
      ])
    : [{ data: [] }, { data: [] }]

  const reimbursed = reimbursements.find((row) =>
    ['APPROVED', 'PAID'].includes(toUpperText(row.status)) &&
    readStringArray((itemRows || []).filter((item: any) => item?.reimbursement_id === row.id).map((item: any) => item?.id)).length > 0
  )
  const paidReimbursement = reimbursements.find((row) =>
    toUpperText(row.status) === 'PAID' &&
    (
      Boolean(row.journal_id) ||
      readStringArray((journalEntries || []).filter((entry: any) => entry?.reference_id === row.id).map((entry: any) => entry?.id)).length > 0
    )
  )

  return {
    transactionOk: reimbursements.length > 0,
    contextOk: Boolean(reimbursed?.branch_id),
    evidenceOk: Boolean(paidReimbursement),
    matchedRecordIds: [
      ...reimbursementIds,
      ...readStringArray((itemRows || []).map((row: any) => row?.id)),
      ...readStringArray((journalEntries || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['reimbursements', 'reimbursement_items', 'journal_entries'],
    sourceModule: 'accounting/reimburse',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: paidReimbursement
      ? `Reimbursement pada ${retailOrg.name} sudah dibayar dan jurnal bebannya terdeteksi.`
      : reimbursed
        ? `Reimbursement pada ${retailOrg.name} sudah diajukan/diproses, tetapi bukti pembayaran atau jurnal belum lengkap.`
        : `Belum ada reimbursement baru pada ${retailOrg.name}.`,
  }
}

async function validateQuestionTwelve(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const distributionOrg = pickPreferredDistributionOrg(bundle.scopedOrgs.filter((org) => org.parent_org_id === bundle.session.org_id))

  if (!distributionOrg) {
    return {
      transactionOk: false,
      contextOk: false,
      evidenceOk: false,
      matchedRecordIds: [],
      matchedTables: ['fixed_assets'],
      sourceModule: 'accounting/assets',
      validatorVersion: EDU_VALIDATOR_VERSION,
      summary: 'Belum ada entitas distribusi untuk validasi aset tetap.',
    }
  }

  const { data: assetRows } = await admin
    .from('fixed_assets')
    .select('id, branch_id, purchase_price, asset_account_id, status')
    .eq('org_id', distributionOrg.id)
    .gte('created_at', startedAt)
    .order('created_at', { ascending: false })

  const assets = (Array.isArray(assetRows) ? assetRows : []) as Array<{
    id: string
    branch_id: string | null
    purchase_price: number | null
    asset_account_id: string | null
    status: string | null
  }>
  const assetIds = assets.map((row) => row.id)
  const { data: journalEntries } = assetIds.length > 0
    ? await admin
        .from('journal_entries')
        .select('id, reference_id')
        .eq('org_id', distributionOrg.id)
        .eq('status', 'POSTED')
        .eq('reference_type', 'ADJUSTMENT')
        .in('reference_id', assetIds)
    : { data: [] }

  const validAsset = assets.find((asset) =>
    Number(asset.purchase_price || 0) > 0 &&
    Boolean(asset.asset_account_id) &&
    toUpperText(asset.status) !== 'VOIDED'
  )

  return {
    transactionOk: assets.length > 0,
    contextOk: Boolean(validAsset?.branch_id) && Boolean(validAsset?.asset_account_id),
    evidenceOk: Boolean(validAsset) && readStringArray((journalEntries || []).map((row: any) => row?.id)).length > 0,
    matchedRecordIds: [
      ...assetIds,
      ...readStringArray((journalEntries || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['fixed_assets', 'journal_entries'],
    sourceModule: 'accounting/assets',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: validAsset
      ? `Aset tetap baru pada ${distributionOrg.name} terdeteksi dan jurnal kapitalisasinya sudah posted.`
      : assets.length > 0
        ? `Aset baru sudah dibuat pada ${distributionOrg.name}, tetapi akun aset atau jurnal kapitalisasinya belum lengkap.`
        : `Belum ada aset tetap baru pada ${distributionOrg.name}.`,
  }
}

async function validateQuestionThirteen(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const rootOrgId = bundle.session.org_id
  const retailOrg = pickPreferredRetailOrg(bundle.scopedOrgs.filter((org) => org.parent_org_id === rootOrgId))
  const scopeOrgIds = bundle.scopedOrgs.map((org) => org.id)

  const { data: auditRows } = await admin
    .from('audit_logs')
    .select('id, org_id, record_id, new_data')
    .in('org_id', scopeOrgIds)
    .eq('table_name', 'EMPLOYEE_CHILD_TRANSFER')
    .gte('created_at', startedAt)
    .order('created_at', { ascending: false })

  const audits = (Array.isArray(auditRows) ? auditRows : []) as Array<{
    id: string
    org_id: string
    record_id: string | null
    new_data: Record<string, unknown> | null
  }>

  const relevantAudit = audits.find((row) => {
    const payload = asJsonRecord(row.new_data)
    return (
      String(payload.transfer_type || '') === 'HOLDING_ENTITY_MUTATION' &&
      String(payload.from_org_id || '') === rootOrgId &&
      (!retailOrg || String(payload.to_org_id || '') === retailOrg.id)
    )
  })

  const targetPayload = asJsonRecord(relevantAudit?.new_data)
  const targetEmployeeId = String(targetPayload.target_employee_id || '').trim()
  const targetOrgId = String(targetPayload.to_org_id || '').trim()
  const targetBranchId = String(targetPayload.to_branch_id || '').trim()
  const [{ data: employeeRow }, { data: branchRow }] = targetEmployeeId && targetOrgId
    ? await Promise.all([
        admin
          .from('employees')
          .select('id, org_id, branch_id')
          .eq('id', targetEmployeeId)
          .eq('org_id', targetOrgId)
          .maybeSingle(),
        targetBranchId
          ? admin
              .from('branches')
              .select('id, pic_employee_id')
              .eq('id', targetBranchId)
              .eq('org_id', targetOrgId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])
    : [{ data: null }, { data: null }]

  const assignedAsPic = Boolean(targetPayload.target_assigned_as_pic)
  const picEvidenceOk = !assignedAsPic || String(branchRow?.pic_employee_id || '') === targetEmployeeId

  return {
    transactionOk: Boolean(relevantAudit),
    contextOk: Boolean(relevantAudit && targetOrgId && targetOrgId !== rootOrgId && targetBranchId),
    evidenceOk: Boolean(employeeRow?.id) && picEvidenceOk,
    matchedRecordIds: [
      ...readStringArray(audits.map((row) => row.id)),
      ...readStringArray([employeeRow?.id, branchRow?.id]),
    ],
    matchedTables: ['audit_logs', 'employees', 'branches'],
    sourceModule: 'hris',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: relevantAudit
      ? `Mutasi karyawan dari holding ke entitas tujuan terdeteksi dan profil target ${employeeRow?.id ? 'sudah aktif' : 'belum terbaca'}.`
      : 'Belum ada mutasi karyawan antar entitas dalam holding yang terdeteksi.',
  }
}

async function validateQuestionFourteen(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const startedAt = bundle.session.started_at
  const childOrgs = bundle.scopedOrgs.filter((org) => org.parent_org_id === bundle.session.org_id)
  const distributionOrg = pickPreferredDistributionOrg(childOrgs)
  const retailOrg = pickPreferredRetailOrg(childOrgs)

  if (!distributionOrg || !retailOrg || distributionOrg.id === retailOrg.id) {
    return {
      transactionOk: false,
      contextOk: false,
      evidenceOk: false,
      matchedRecordIds: [],
      matchedTables: ['bank_transactions'],
      sourceModule: 'cash',
      validatorVersion: EDU_VALIDATOR_VERSION,
      summary: 'Belum ada pasangan entitas distribusi dan retail untuk validasi transaksi antar entitas kedua.',
    }
  }

  const [{ data: sourceTx }, { data: targetTx }, { data: sourceJe }, { data: targetJe }] = await Promise.all([
    admin
      .from('bank_transactions')
      .select('id, amount, transaction_date, description')
      .eq('org_id', distributionOrg.id)
      .eq('status', 'POSTED')
      .eq('type', 'TRANSFER')
      .gte('created_at', startedAt)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('bank_transactions')
      .select('id, amount, transaction_date, description')
      .eq('org_id', retailOrg.id)
      .eq('status', 'POSTED')
      .eq('type', 'IN')
      .gte('created_at', startedAt)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('journal_entries')
      .select('id')
      .eq('org_id', distributionOrg.id)
      .eq('status', 'POSTED')
      .gte('created_at', startedAt),
    admin
      .from('journal_entries')
      .select('id')
      .eq('org_id', retailOrg.id)
      .eq('status', 'POSTED')
      .gte('created_at', startedAt),
  ])

  const pairedTransfer = ((Array.isArray(sourceTx) ? sourceTx : []) as Array<{
    id: string
    amount: number | null
    transaction_date: string | null
    description: string | null
  }>).find((source) =>
    ((Array.isArray(targetTx) ? targetTx : []) as Array<{
      id: string
      amount: number | null
      transaction_date: string | null
      description: string | null
    }>).some((target) =>
      Number(target.amount || 0) === Number(source.amount || 0) &&
      String(target.transaction_date || '') === String(source.transaction_date || '') &&
      String(target.description || '').trim().toLowerCase() === String(source.description || '').trim().toLowerCase()
    )
  )

  return {
    transactionOk: Boolean(pairedTransfer),
    contextOk: Boolean(pairedTransfer) && distributionOrg.id !== retailOrg.id,
    evidenceOk: Boolean(pairedTransfer) && readStringArray((sourceJe || []).map((row: any) => row?.id)).length > 0 && readStringArray((targetJe || []).map((row: any) => row?.id)).length > 0,
    matchedRecordIds: [
      ...readStringArray((sourceTx || []).map((row: any) => row?.id)),
      ...readStringArray((targetTx || []).map((row: any) => row?.id)),
      ...readStringArray((sourceJe || []).map((row: any) => row?.id)),
      ...readStringArray((targetJe || []).map((row: any) => row?.id)),
    ],
    matchedTables: ['bank_transactions', 'journal_entries'],
    sourceModule: 'cash',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: pairedTransfer
      ? `Transfer operasional antar entitas ${distributionOrg.name} -> ${retailOrg.name} terdeteksi konsisten di sisi sumber dan tujuan.`
      : `Belum ada pasangan transaksi antar entitas kedua yang konsisten antara ${distributionOrg.name} dan ${retailOrg.name}.`,
  }
}

async function validateQuestionFifteen(admin: any, bundle: NonNullable<Awaited<ReturnType<typeof loadTrainingSessionBundle>>>): Promise<TrainingValidationResult> {
  const rootOrgId = bundle.session.org_id
  const startedAt = bundle.session.started_at
  const childOrgIds = bundle.scopedOrgs.filter((org) => org.parent_org_id === rootOrgId).map((org) => org.id)

  const { data: journalRows } = await admin
    .from('journal_entries')
    .select('id, org_id')
    .in('org_id', [rootOrgId, ...childOrgIds])
    .eq('status', 'POSTED')
    .gte('created_at', startedAt)

  let balanceSheetDeltaOk = false
  let profitLossDeltaOk = false
  let cashFlowDeltaOk = false

  try {
    const { getBalanceSheet, getProfitLoss, getCashFlow } = await import('@/modules/accounting/actions/reports.actions')
    const startDate = startedAt.slice(0, 10)
    const [parentBalance, consolidatedBalance, parentProfit, consolidatedProfit, parentCash, consolidatedCash] = await Promise.all([
      getBalanceSheet(rootOrgId, undefined, null, false),
      getBalanceSheet(rootOrgId, undefined, null, true),
      getProfitLoss(rootOrgId, startDate, undefined, null, false),
      getProfitLoss(rootOrgId, startDate, undefined, null, true),
      getCashFlow(rootOrgId, null, false, { startDate }),
      getCashFlow(rootOrgId, null, true, { startDate }),
    ])

    balanceSheetDeltaOk =
      Math.abs(sumBalanceRows(parentBalance.assets) - sumBalanceRows(consolidatedBalance.assets)) > 0.0001 ||
      Math.abs(sumBalanceRows(parentBalance.liabilities) - sumBalanceRows(consolidatedBalance.liabilities)) > 0.0001
    profitLossDeltaOk =
      Math.abs(Number(parentProfit.totalRevenue || 0) - Number(consolidatedProfit.totalRevenue || 0)) > 0.0001 ||
      Math.abs(Number(parentProfit.totalExpenses || 0) - Number(consolidatedProfit.totalExpenses || 0)) > 0.0001
    cashFlowDeltaOk = Math.abs(Number(parentCash.netChange || 0) - Number(consolidatedCash.netChange || 0)) > 0.0001
  } catch (_error) {
    balanceSheetDeltaOk = false
    profitLossDeltaOk = false
    cashFlowDeltaOk = false
  }

  const childJournalCoverage = new Set(readStringArray((journalRows || []).map((row: any) => row?.org_id))).size
  const changedMetricCount = Number(balanceSheetDeltaOk) + Number(profitLossDeltaOk) + Number(cashFlowDeltaOk)

  return {
    transactionOk: readStringArray((journalRows || []).map((row: any) => row?.id)).length > 0,
    contextOk: childOrgIds.length >= 2 && childJournalCoverage >= 2,
    evidenceOk: changedMetricCount >= 2,
    matchedRecordIds: readStringArray((journalRows || []).map((row: any) => row?.id)),
    matchedTables: ['journal_entries'],
    sourceModule: 'reports',
    validatorVersion: EDU_VALIDATOR_VERSION,
    summary: changedMetricCount >= 2
      ? `Laporan parent-only vs consolidated menunjukkan perubahan material pada minimal ${changedMetricCount} area utama.`
      : 'Belum terdeteksi perbedaan material yang cukup antara laporan parent-only dan consolidated.',
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
    case 6:
      return validateQuestionSix(admin, bundle)
    case 7:
      return validateQuestionSeven(admin, bundle)
    case 8:
      return validateQuestionEight(admin, bundle)
    case 9:
      return validateQuestionNine(admin, bundle)
    case 10:
      return validateQuestionTen(admin, bundle)
    case 11:
      return validateQuestionEleven(admin, bundle)
    case 12:
      return validateQuestionTwelve(admin, bundle)
    case 13:
      return validateQuestionThirteen(admin, bundle)
    case 14:
      return validateQuestionFourteen(admin, bundle)
    case 15:
      return validateQuestionFifteen(admin, bundle)
    default:
      return {
        transactionOk: false,
        contextOk: false,
        evidenceOk: false,
        matchedRecordIds: [],
        matchedTables: [],
        summary: 'Validator otomatis belum tersedia untuk soal ini.',
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
        message: 'EDU Mode selesai. Semua soal realtime yang aktif telah lolos.',
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
