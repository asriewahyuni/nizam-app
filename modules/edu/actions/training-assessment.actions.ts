'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'
import { getSaasAssessorContext } from '@/modules/edu/lib/assessment-access.server'
import { getTrainingAssessmentByCourseSlug } from '@/modules/edu/lib/training-assessment-mvp'

type TheoryStatus = 'UNDERSTOOD' | 'PARTIAL' | 'NOT_YET'
type PracticeStatus = 'SUCCESS' | 'NEEDS_SUPPORT' | 'FAILED'
type DecisionStatus = 'COMPETENT' | 'NOT_YET_COMPETENT'
type ChecklistStatus = 'yes' | 'no' | 'na'
type PromptAnswer = { prompt: string; answer: string }
type TrainingAssessmentDbError = { message?: string } | null
type TrainingAssessmentDb = {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: TrainingAssessmentDbError }>
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => Promise<{ error?: TrainingAssessmentDbError }>
      }
    }
  }
}

function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  return text.slice(0, maxLength)
}

function normalizeMultilineText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeTheoryStatus(value: FormDataEntryValue | null): TheoryStatus {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'PARTIAL' || normalized === 'NOT_YET') return normalized
  return 'UNDERSTOOD'
}

function normalizePracticeStatus(value: FormDataEntryValue | null): PracticeStatus {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'NEEDS_SUPPORT' || normalized === 'FAILED') return normalized
  return 'SUCCESS'
}

function normalizeDecisionStatus(value: FormDataEntryValue | null): DecisionStatus {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'NOT_YET_COMPETENT') return 'NOT_YET_COMPETENT'
  return 'COMPETENT'
}

function normalizeChecklistStatus(value: FormDataEntryValue | null): ChecklistStatus {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'yes' || normalized === 'no') return normalized
  return 'na'
}

function normalizePromptAnswers(input: string[], formData: FormData, prefix: string) {
  return input.map((prompt, index): PromptAnswer => ({
    prompt,
    answer: normalizeMultilineText(formData.get(`${prefix}_${index}`), 4000),
  }))
}

function buildRedirectPath(
  courseSlug: string,
  params: Record<string, string>,
  hash = 'submissions',
  audience: 'assessor' | 'participant' = 'assessor',
) {
  const search = new URLSearchParams(params)
  const query = search.toString()
  const basePath =
    audience === 'participant'
      ? `/learning/course/${courseSlug}/assessment/participant`
      : `/learning/course/${courseSlug}/assessment`

  return `${basePath}${query ? `?${query}` : ''}#${hash}`
}

export async function submitTrainingCourseAnswerSubmission(formData: FormData) {
  const courseSlug = String(formData.get('courseSlug') || '').trim()
  const assessment = getTrainingAssessmentByCourseSlug(courseSlug)

  if (!courseSlug || !assessment) {
    redirect('/learning')
  }

  const orgData = await getActiveOrg()
  if (!orgData) {
    redirect('/onboarding')
  }

  if (!hasRolePermission(orgData.role, orgData.permissions, 'learning')) {
    redirect(
      buildRedirectPath(
        courseSlug,
        { answerError: 'Akses learning tidak ditemukan untuk user ini.' },
        'participant-answer-form',
        'participant',
      ),
    )
  }

  const fallbackParticipantName = String(
    orgData.user?.user_metadata?.full_name
    || orgData.user?.user_metadata?.name
    || orgData.user?.email
    || 'Peserta NIZAM',
  )
    .trim()
    .slice(0, 120)
  const participantName = normalizeText(formData.get('participantName'), 120) || fallbackParticipantName
  const participantReference = normalizeText(formData.get('participantReference'), 120) || String(orgData.user?.email || '').trim() || null
  const participantRole = normalizeText(formData.get('participantRole'), 120) || String(orgData.jobTitle || '').trim() || null
  const generalNotes = normalizeMultilineText(formData.get('generalNotes'), 4000) || null
  const theoryAnswers = normalizePromptAnswers(assessment.theoryQuestions, formData, 'theoryAnswer')
  const practicalAnswers = normalizePromptAnswers(
    assessment.practicalTasks.map((task) => task.title),
    formData,
    'practicalAnswer',
  )

  const hasAnyAnswer = [...theoryAnswers, ...practicalAnswers].some((item) => item.answer.length > 0)
  if (!hasAnyAnswer) {
    redirect(
      buildRedirectPath(
        courseSlug,
        { answerError: 'Isi minimal satu jawaban sebelum mengirim ke assessor.' },
        'participant-answer-form',
        'participant',
      ),
    )
  }

  const db = (await createAdminClient()) as unknown as TrainingAssessmentDb
  const { error } = await db
    .from('training_course_answer_submissions')
    .insert({
      org_id: orgData.org.id,
      course_slug: courseSlug,
      assessment_version: assessment.version,
      participant_user_id: orgData.user?.id || null,
      participant_name: participantName,
      participant_reference: participantReference,
      participant_role: participantRole,
      theory_answers: theoryAnswers,
      practical_answers: practicalAnswers,
      general_notes: generalNotes,
      status: 'SUBMITTED',
      metadata: {
        source: 'training-center-mvp',
        courseSlug,
      },
    })

  if (error) {
    redirect(
      buildRedirectPath(
        courseSlug,
        { answerError: error.message || 'Gagal menyimpan jawaban peserta.' },
        'participant-answer-form',
        'participant',
      ),
    )
  }

  revalidatePath(`/learning/course/${courseSlug}/assessment`)
  revalidatePath(`/learning/course/${courseSlug}/assessment/participant`)
  revalidatePath(`/learning/course/${courseSlug}`)
  revalidatePath('/learning')
  redirect(buildRedirectPath(courseSlug, { answerSaved: '1' }, 'participant-submissions', 'participant'))
}

export async function submitTrainingCourseAssessment(formData: FormData) {
  const courseSlug = String(formData.get('courseSlug') || '').trim()
  const assessment = getTrainingAssessmentByCourseSlug(courseSlug)

  if (!courseSlug || !assessment) {
    redirect('/learning')
  }

  const orgData = await getActiveOrg()
  if (!orgData) {
    redirect('/onboarding')
  }

  const assessorContext = await getSaasAssessorContext({ email: orgData.user?.email })
  if (!assessorContext.hasAccess) {
    redirect(buildRedirectPath(courseSlug, { error: 'Hanya member SaaS yang diberi mandat assessor yang dapat mengirim asesmen.' }))
  }

  const participantName = normalizeText(formData.get('participantName'), 120)
  const participantReference = normalizeText(formData.get('participantReference'), 120) || null
  const participantRole = normalizeText(formData.get('participantRole'), 120) || null
  const decision = normalizeDecisionStatus(formData.get('decision'))
  const theoryStatus = normalizeTheoryStatus(formData.get('theoryStatus'))
  const practiceStatus = normalizePracticeStatus(formData.get('practiceStatus'))
  const evidenceSummary = normalizeMultilineText(formData.get('evidenceSummary'), 3000) || null
  const strengths = normalizeMultilineText(formData.get('strengths'), 3000) || null
  const repeatedErrors = normalizeMultilineText(formData.get('repeatedErrors'), 3000) || null
  const followUp = normalizeMultilineText(formData.get('followUp'), 3000) || null
  const sourceSubmissionId = normalizeText(formData.get('sourceSubmissionId'), 120) || null
  const participantQuery = normalizeText(formData.get('participantQuery'), 120) || null

  if (participantName.length < 2) {
    redirect(buildRedirectPath(courseSlug, { error: 'Nama peserta minimal 2 karakter.' }, 'assessor-form'))
  }

  const checklistResults = assessment.performanceChecklist.map((label, index) => ({
    label,
    status: normalizeChecklistStatus(formData.get(`check_${index}`)),
  }))

  const assessorName = String(
    assessorContext.source === 'impersonation'
      ? assessorContext.email
      : (
          orgData.user?.user_metadata?.full_name
          || orgData.user?.user_metadata?.name
          || assessorContext.email
          || orgData.user?.email
          || 'Assessor NIZAM'
        ),
  )
    .trim()
    .slice(0, 120)
  const assessorUserId = assessorContext.source === 'impersonation'
    ? null
    : (orgData.user?.id || null)

  const db = (await createAdminClient()) as unknown as TrainingAssessmentDb
  const { error } = await db
    .from('training_course_assessments')
    .insert({
      org_id: orgData.org.id,
      course_slug: courseSlug,
      assessment_version: assessment.version,
      participant_name: participantName,
      participant_reference: participantReference,
      participant_role: participantRole,
      assessor_user_id: assessorUserId,
      assessor_name: assessorName,
      decision,
      theory_status: theoryStatus,
      practice_status: practiceStatus,
      checklist_results: checklistResults,
      evidence_summary: evidenceSummary,
      strengths,
      repeated_errors: repeatedErrors,
      follow_up: followUp,
      metadata: {
        source: 'training-center-mvp',
        courseSlug,
        sourceSubmissionId,
      },
    })

  if (error) {
    redirect(buildRedirectPath(courseSlug, { error: error.message || 'Gagal menyimpan asesmen online.' }, 'assessor-form'))
  }

  if (sourceSubmissionId) {
    await db
      .from('training_course_answer_submissions')
      .update({
        status: 'REVIEWED',
        reviewer_user_id: assessorUserId,
        reviewer_name: assessorName,
        reviewer_note: `Submission direview dan dipakai pada asesmen final dengan keputusan ${decision === 'COMPETENT' ? 'Kompeten' : 'Belum Kompeten'}.`,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', sourceSubmissionId)
      .eq('org_id', orgData.org.id)
  }

  revalidatePath(`/learning/course/${courseSlug}/assessment`)
  revalidatePath(`/learning/course/${courseSlug}/assessment/participant`)
  revalidatePath(`/learning/course/${courseSlug}`)
  revalidatePath('/learning')
  const redirectParams: Record<string, string> = { saved: '1' }
  if (participantQuery) redirectParams.participant = participantQuery
  redirect(buildRedirectPath(courseSlug, redirectParams))
}
