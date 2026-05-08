import { createAdminClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database.types'

type ChecklistStatus = 'yes' | 'no' | 'na'
type AnswerSubmissionStatus = 'SUBMITTED' | 'REVIEWED'

export type TrainingAssessmentSubmission = {
  id: string
  courseSlug: string
  assessmentVersion: string
  participantName: string
  participantReference: string | null
  participantRole: string | null
  assessorName: string
  decision: 'COMPETENT' | 'NOT_YET_COMPETENT'
  theoryStatus: 'UNDERSTOOD' | 'PARTIAL' | 'NOT_YET'
  practiceStatus: 'SUCCESS' | 'NEEDS_SUPPORT' | 'FAILED'
  checklistResults: Array<{ label: string; status: ChecklistStatus }>
  evidenceSummary: string | null
  strengths: string | null
  repeatedErrors: string | null
  followUp: string | null
  createdAt: string
  updatedAt: string
}

export type TrainingCourseAnswerSubmission = {
  id: string
  courseSlug: string
  assessmentVersion: string
  participantUserId: string | null
  participantName: string
  participantReference: string | null
  participantRole: string | null
  theoryAnswers: Array<{ prompt: string; answer: string }>
  practicalAnswers: Array<{ prompt: string; answer: string }>
  generalNotes: string | null
  status: AnswerSubmissionStatus
  reviewerName: string | null
  reviewerNote: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export type TrainingAssessmentParticipantStatus = {
  participantKey: string
  participantName: string
  participantReference: string | null
  participantRole: string | null
  latestDecision: 'COMPETENT' | 'NOT_YET_COMPETENT'
  latestTheoryStatus: 'UNDERSTOOD' | 'PARTIAL' | 'NOT_YET'
  latestPracticeStatus: 'SUCCESS' | 'NEEDS_SUPPORT' | 'FAILED'
  latestAssessorName: string
  latestAssessedAt: string
  assessmentCount: number
}

function normalizeChecklistResults(raw: Json): Array<{ label: string; status: ChecklistStatus }> {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []

    const label = typeof item.label === 'string' ? item.label.trim() : ''
    const statusValue = typeof item.status === 'string' ? item.status.trim().toLowerCase() : ''
    const status: ChecklistStatus =
      statusValue === 'yes' || statusValue === 'no' || statusValue === 'na'
        ? statusValue
        : 'na'

    if (!label) return []

    return [{ label, status }]
  })
}

function normalizePromptAnswers(raw: Json): Array<{ prompt: string; answer: string }> {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []

    const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : ''
    const answer = typeof item.answer === 'string' ? item.answer.trim() : ''

    if (!prompt) return []

    return [{ prompt, answer }]
  })
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export async function listTrainingCourseAssessments(input: {
  orgId: string
  courseSlug: string
  search?: string
  limit?: number
}) {
  const db = (await createAdminClient()) as any
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(100, Math.round(input.limit || 20))) : 20
  const search = normalizeSearchText(input.search)

  const { data, error } = await db
    .from('training_course_assessments')
    .select(
      'id, course_slug, assessment_version, participant_name, participant_reference, participant_role, assessor_name, decision, theory_status, practice_status, checklist_results, evidence_summary, strengths, repeated_errors, follow_up, created_at, updated_at',
    )
    .eq('org_id', input.orgId)
    .eq('course_slug', input.courseSlug)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message || 'Gagal membaca submission asesmen.')
  }

  const mapped = Array.isArray(data)
    ? data.map((row: any): TrainingAssessmentSubmission => ({
        id: String(row.id),
        courseSlug: String(row.course_slug || ''),
        assessmentVersion: String(row.assessment_version || ''),
        participantName: String(row.participant_name || ''),
        participantReference: row.participant_reference ? String(row.participant_reference) : null,
        participantRole: row.participant_role ? String(row.participant_role) : null,
        assessorName: String(row.assessor_name || ''),
        decision: row.decision === 'NOT_YET_COMPETENT' ? 'NOT_YET_COMPETENT' : 'COMPETENT',
        theoryStatus: row.theory_status === 'PARTIAL' || row.theory_status === 'NOT_YET' ? row.theory_status : 'UNDERSTOOD',
        practiceStatus: row.practice_status === 'NEEDS_SUPPORT' || row.practice_status === 'FAILED' ? row.practice_status : 'SUCCESS',
        checklistResults: normalizeChecklistResults(row.checklist_results as Json),
        evidenceSummary: row.evidence_summary ? String(row.evidence_summary) : null,
        strengths: row.strengths ? String(row.strengths) : null,
        repeatedErrors: row.repeated_errors ? String(row.repeated_errors) : null,
        followUp: row.follow_up ? String(row.follow_up) : null,
        createdAt: String(row.created_at || ''),
        updatedAt: String(row.updated_at || ''),
      }))
    : []

  if (!search) {
    return mapped
  }

  return mapped.filter((row) => {
    const haystacks = [
      row.participantName,
      row.participantReference || '',
      row.participantRole || '',
      row.assessorName,
    ].map((value) => normalizeSearchText(value))

    return haystacks.some((value) => value.includes(search))
  })
}

export async function listTrainingCourseAnswerSubmissions(input: {
  orgId: string
  courseSlug: string
  search?: string
  participantUserId?: string | null
  status?: AnswerSubmissionStatus | null
  limit?: number
}) {
  const db = (await createAdminClient()) as any
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(100, Math.round(input.limit || 20))) : 20
  const search = normalizeSearchText(input.search)

  let query = db
    .from('training_course_answer_submissions')
    .select(
      'id, course_slug, assessment_version, participant_user_id, participant_name, participant_reference, participant_role, theory_answers, practical_answers, general_notes, status, reviewer_name, reviewer_note, reviewed_at, created_at, updated_at',
    )
    .eq('org_id', input.orgId)
    .eq('course_slug', input.courseSlug)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.participantUserId) {
    query = query.eq('participant_user_id', input.participantUserId)
  }

  if (input.status) {
    query = query.eq('status', input.status)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Gagal membaca submission jawaban peserta.')
  }

  const mapped = Array.isArray(data)
    ? data.map((row: any): TrainingCourseAnswerSubmission => ({
        id: String(row.id),
        courseSlug: String(row.course_slug || ''),
        assessmentVersion: String(row.assessment_version || ''),
        participantUserId: row.participant_user_id ? String(row.participant_user_id) : null,
        participantName: String(row.participant_name || ''),
        participantReference: row.participant_reference ? String(row.participant_reference) : null,
        participantRole: row.participant_role ? String(row.participant_role) : null,
        theoryAnswers: normalizePromptAnswers(row.theory_answers as Json),
        practicalAnswers: normalizePromptAnswers(row.practical_answers as Json),
        generalNotes: row.general_notes ? String(row.general_notes) : null,
        status: row.status === 'REVIEWED' ? 'REVIEWED' : 'SUBMITTED',
        reviewerName: row.reviewer_name ? String(row.reviewer_name) : null,
        reviewerNote: row.reviewer_note ? String(row.reviewer_note) : null,
        reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
        createdAt: String(row.created_at || ''),
        updatedAt: String(row.updated_at || ''),
      }))
    : []

  if (!search) {
    return mapped
  }

  return mapped.filter((row) => {
    const haystacks = [
      row.participantName,
      row.participantReference || '',
      row.participantRole || '',
      row.reviewerName || '',
      ...row.theoryAnswers.map((item) => `${item.prompt} ${item.answer}`),
      ...row.practicalAnswers.map((item) => `${item.prompt} ${item.answer}`),
      row.generalNotes || '',
    ].map((value) => normalizeSearchText(value))

    return haystacks.some((value) => value.includes(search))
  })
}

export function summarizeTrainingAssessmentParticipants(submissions: TrainingAssessmentSubmission[]) {
  const grouped = new Map<string, TrainingAssessmentParticipantStatus>()

  for (const submission of submissions) {
    const participantKey = [
      normalizeSearchText(submission.participantReference || ''),
      normalizeSearchText(submission.participantName),
    ]
      .filter(Boolean)
      .join('::')
      || `submission:${submission.id}`

    const existing = grouped.get(participantKey)
    if (!existing) {
      grouped.set(participantKey, {
        participantKey,
        participantName: submission.participantName,
        participantReference: submission.participantReference,
        participantRole: submission.participantRole,
        latestDecision: submission.decision,
        latestTheoryStatus: submission.theoryStatus,
        latestPracticeStatus: submission.practiceStatus,
        latestAssessorName: submission.assessorName,
        latestAssessedAt: submission.createdAt,
        assessmentCount: 1,
      })
      continue
    }

    existing.assessmentCount += 1
  }

  return Array.from(grouped.values()).sort((left, right) =>
    new Date(right.latestAssessedAt).getTime() - new Date(left.latestAssessedAt).getTime(),
  )
}
