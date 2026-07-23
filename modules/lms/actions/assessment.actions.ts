'use server'

/**
 * Mesin asesmen LMS: attempt kuis, penilaian objektif, tugas, review tutor,
 * dan gradebook. Semua operasi dibatasi organisasi, course, dan pengguna.
 */
import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { issueCertificateForEnrollment } from '@/modules/lms/lib/certificate.service'
import {
  recalculateEnrollmentCompletion,
  type EnrollmentCompletion,
} from '@/modules/lms/lib/completion.service'
import { uploadObjectToStorage } from '@/lib/storage/object-storage.server'
import { enqueueCourseCompletionNotifications } from '@/modules/notifications/coreisec-reminders.server'
import {
  sanitizeLearningHtml,
  sanitizeQuizOptionHtml,
} from '@/modules/lms/lib/content-sanitizer'
import { resolveLessonAccess } from '@/modules/lms/lib/access.server'

type QuizQuestionRow = {
  id: string
  question_type: string
  prompt_html: string
  explanation_html: string | null
  points: number
  sort_order: number
  options: Array<{
    id: string
    optionHtml: string
    sortOrder: number
    matchKey: string | null
  }>
}

function shuffled<T>(items: T[]) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

async function resolveActiveEnrollment(orgSlug: string, courseId: string, userId: string) {
  const result = await queryPostgres<{ org_id: string; enrollment_id: string }>(
    `SELECT
       organization.id::text AS org_id,
       enrollment.id::text AS enrollment_id
     FROM public.organizations organization
     JOIN public.learning_enrollments enrollment
       ON enrollment.org_id = organization.id
      AND enrollment.course_id = $2::uuid
      AND enrollment.user_id = $3::uuid
     JOIN public.learning_access_grants access_grant
       ON access_grant.org_id = enrollment.org_id
      AND access_grant.user_id = enrollment.user_id
      AND access_grant.course_id = enrollment.course_id
      AND access_grant.status = 'ACTIVE'
      AND access_grant.starts_at <= NOW()
      AND (access_grant.expires_at IS NULL OR access_grant.expires_at > NOW())
     WHERE organization.slug = $1
       AND organization.is_active = TRUE
     LIMIT 1`,
    [orgSlug, courseId, userId],
  )
  return result.rows[0] || null
}

async function getAssessmentReviewerContext(orgSlug?: string) {
  if (!orgSlug) return getActiveOrg()
  const session = await getInternalAuthSession()
  if (!session?.user) return null
  const result = await queryPostgres<{ id: string; slug: string; role: string }>(
    `SELECT organization.id::text, organization.slug, member.role::text
     FROM public.organizations organization
     LEFT JOIN public.org_members member
       ON member.org_id = organization.id
      AND member.user_id = $2::uuid
      AND member.is_active = TRUE
     WHERE organization.slug = $1
       AND organization.is_active = TRUE
       AND (
         member.user_id IS NOT NULL
         OR EXISTS (
           SELECT 1
           FROM public.learning_instructor_profiles instructor
           WHERE instructor.org_id = organization.id
             AND instructor.user_id = $2::uuid
             AND instructor.is_active = TRUE
         )
       )
     LIMIT 1`,
    [orgSlug, session.user.id],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    org: { id: row.id, slug: row.slug },
    user: session.user,
    role: row.role || 'tutor',
  }
}

export type LessonQuizOverview = {
  id: string
  title: string
  descriptionHtml: string
  timeLimitMinutes: number | null
  maxAttempts: number | null
  passingScore: number
  attemptsUsed: number
  latestStatus: string | null
  latestScore: number | null
  latestPassed: boolean | null
}

export type LessonAssignmentOverview = {
  id: string
  title: string
  instructionsHtml: string
  dueAt: string | null
  maxScore: number
  passingScore: number | null
  maxAttempts: number
  allowedMimeTypes: string[]
  submissionsUsed: number
  latestStatus: string | null
  latestScore: number | null
  latestFeedback: string | null
}

export type LessonAssessmentOverview = {
  quizzes: LessonQuizOverview[]
  assignments: LessonAssignmentOverview[]
}

export async function getLessonAssessmentOverview(
  orgSlug: string,
  courseSlug: string,
  lessonSlug: string,
) {
  const session = await getInternalAuthSession()
  if (!session?.user) {
    return { error: 'Silakan masuk untuk melihat kuis dan tugas.' }
  }
  const decision = await resolveLessonAccess({ orgSlug, courseSlug, lessonSlug })
  if (!decision.allowed) return { error: decision.message }

  const [quizzes, assignments] = await Promise.all([
    queryPostgres<{
      id: string
      title: string
      description: string | null
      time_limit_minutes: number | null
      max_attempts: number | null
      passing_score: number
      attempts_used: number
      latest_status: string | null
      latest_score: number | null
      latest_passed: boolean | null
    }>(
      `SELECT
         quiz.id::text,
         quiz.title,
         quiz.description,
         quiz.time_limit_minutes,
         quiz.max_attempts,
         quiz.passing_score::float8,
         (
           SELECT COUNT(*)::int
           FROM public.learning_quiz_attempts attempt
           WHERE attempt.org_id = quiz.org_id
             AND attempt.quiz_id = quiz.id
             AND attempt.user_id = $4::uuid
         ) AS attempts_used,
         latest.status AS latest_status,
         latest.score::float8 AS latest_score,
         latest.passed AS latest_passed
       FROM public.learning_quizzes quiz
       LEFT JOIN LATERAL (
         SELECT attempt.status, attempt.score, attempt.passed
         FROM public.learning_quiz_attempts attempt
         WHERE attempt.org_id = quiz.org_id
           AND attempt.quiz_id = quiz.id
           AND attempt.user_id = $4::uuid
         ORDER BY attempt.attempt_number DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE quiz.org_id = $1::uuid
         AND quiz.course_id = $2::uuid
         AND (
           quiz.lesson_id = $3::uuid
           OR (
             quiz.lesson_id IS NULL
             AND $3::uuid = (
               SELECT candidate.id
               FROM public.learning_lessons candidate
               LEFT JOIN public.learning_course_sections section
                 ON section.id = candidate.section_id
                AND section.org_id = candidate.org_id
               WHERE candidate.org_id = quiz.org_id
                 AND candidate.course_id = quiz.course_id
                 AND candidate.deleted_at IS NULL
               ORDER BY
                 COALESCE(section.sort_order, 0) DESC,
                 candidate.sort_order DESC,
                 candidate.created_at DESC
               LIMIT 1
             )
           )
         )
         AND quiz.status = 'PUBLISHED'
         AND (quiz.available_from IS NULL OR quiz.available_from <= NOW())
         AND (quiz.available_until IS NULL OR quiz.available_until > NOW())
       ORDER BY quiz.created_at`,
      [decision.orgId, decision.lesson.courseId, decision.lesson.id, session.user.id],
    ),
    queryPostgres<{
      id: string
      title: string
      instructions_html: string | null
      due_at: string | null
      max_score: number
      passing_score: number | null
      max_attempts: number
      allowed_mime_types: string[]
      submissions_used: number
      latest_status: string | null
      latest_score: number | null
      latest_feedback: string | null
    }>(
      `SELECT
         assignment.id::text,
         assignment.title,
         assignment.instructions_html,
         assignment.due_at::text,
         assignment.max_score::float8,
         assignment.passing_score::float8,
         assignment.max_attempts,
         assignment.allowed_mime_types,
         (
           SELECT COUNT(*)::int
           FROM public.learning_assignment_submissions submission
           WHERE submission.org_id = assignment.org_id
             AND submission.assignment_id = assignment.id
             AND submission.user_id = $4::uuid
         ) AS submissions_used,
         latest.status AS latest_status,
         latest.score::float8 AS latest_score,
         latest.tutor_feedback AS latest_feedback
       FROM public.learning_assignments assignment
       LEFT JOIN LATERAL (
         SELECT submission.status, submission.score, submission.tutor_feedback
         FROM public.learning_assignment_submissions submission
         WHERE submission.org_id = assignment.org_id
           AND submission.assignment_id = assignment.id
           AND submission.user_id = $4::uuid
         ORDER BY submission.attempt_number DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE assignment.org_id = $1::uuid
         AND assignment.course_id = $2::uuid
         AND (
           assignment.lesson_id = $3::uuid
           OR (
             assignment.lesson_id IS NULL
             AND $3::uuid = (
               SELECT candidate.id
               FROM public.learning_lessons candidate
               LEFT JOIN public.learning_course_sections section
                 ON section.id = candidate.section_id
                AND section.org_id = candidate.org_id
               WHERE candidate.org_id = assignment.org_id
                 AND candidate.course_id = assignment.course_id
                 AND candidate.deleted_at IS NULL
               ORDER BY
                 COALESCE(section.sort_order, 0) DESC,
                 candidate.sort_order DESC,
                 candidate.created_at DESC
               LIMIT 1
             )
           )
         )
         AND assignment.status = 'PUBLISHED'
       ORDER BY assignment.created_at`,
      [decision.orgId, decision.lesson.courseId, decision.lesson.id, session.user.id],
    ),
  ])

  return {
    data: {
      quizzes: quizzes.rows.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        descriptionHtml: sanitizeLearningHtml(quiz.description),
        timeLimitMinutes: quiz.time_limit_minutes,
        maxAttempts: quiz.max_attempts,
        passingScore: Number(quiz.passing_score),
        attemptsUsed: Number(quiz.attempts_used || 0),
        latestStatus: quiz.latest_status,
        latestScore: quiz.latest_score == null ? null : Number(quiz.latest_score),
        latestPassed: quiz.latest_passed,
      })),
      assignments: assignments.rows.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        instructionsHtml: sanitizeLearningHtml(assignment.instructions_html),
        dueAt: assignment.due_at,
        maxScore: Number(assignment.max_score),
        passingScore: assignment.passing_score == null
          ? null
          : Number(assignment.passing_score),
        maxAttempts: Number(assignment.max_attempts),
        allowedMimeTypes: assignment.allowed_mime_types || [],
        submissionsUsed: Number(assignment.submissions_used || 0),
        latestStatus: assignment.latest_status,
        latestScore: assignment.latest_score == null
          ? null
          : Number(assignment.latest_score),
        latestFeedback: assignment.latest_feedback,
      })),
    } satisfies LessonAssessmentOverview,
  }
}

export async function startQuizAttempt(orgSlug: string, quizId: string) {
  const session = await getInternalAuthSession()
  if (!session?.user) return { error: 'Silakan masuk untuk mengerjakan kuis.' }
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    const quizResult = await client.query<{
      id: string
      org_id: string
      course_id: string
      time_limit_minutes: number | null
      max_attempts: number | null
      randomize_questions: boolean
      randomize_options: boolean
      available_from: string | null
      available_until: string | null
    }>(
      `SELECT
         quiz.id::text, quiz.org_id::text, quiz.course_id::text,
         quiz.time_limit_minutes, quiz.max_attempts,
         quiz.randomize_questions, quiz.randomize_options,
         quiz.available_from::text, quiz.available_until::text
       FROM public.learning_quizzes quiz
       JOIN public.organizations organization
         ON organization.id = quiz.org_id
       WHERE quiz.id = $1::uuid
         AND organization.slug = $2
         AND organization.is_active = TRUE
         AND quiz.status = 'PUBLISHED'
         AND (quiz.available_from IS NULL OR quiz.available_from <= NOW())
         AND (quiz.available_until IS NULL OR quiz.available_until > NOW())
       LIMIT 1
       FOR UPDATE OF quiz`,
      [quizId, orgSlug],
    )
    const quiz = quizResult.rows[0]
    if (!quiz) throw new Error('Kuis tidak tersedia.')
    const enrollment = await resolveActiveEnrollment(orgSlug, quiz.course_id, session.user.id)
    if (!enrollment) throw new Error('Akses course tidak aktif.')

    const openAttempt = await client.query<{ id: string; question_order: string[]; started_at: string }>(
      `SELECT id::text, question_order::text[], started_at::text
       FROM public.learning_quiz_attempts
       WHERE org_id = $1::uuid
         AND quiz_id = $2::uuid
         AND enrollment_id = $3::uuid
         AND status = 'IN_PROGRESS'
       ORDER BY attempt_number DESC
       LIMIT 1
       FOR UPDATE`,
      [quiz.org_id, quiz.id, enrollment.enrollment_id],
    )

    const attempts = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM public.learning_quiz_attempts
       WHERE org_id = $1::uuid
         AND quiz_id = $2::uuid
         AND enrollment_id = $3::uuid`,
      [quiz.org_id, quiz.id, enrollment.enrollment_id],
    )
    const attemptCount = Number(attempts.rows[0]?.count || 0)
    if (!openAttempt.rows[0] && quiz.max_attempts && attemptCount >= quiz.max_attempts) {
      throw new Error('Kesempatan mengerjakan kuis sudah habis.')
    }

    const questionsResult = await client.query<QuizQuestionRow>(
      `SELECT
         question.id::text,
         question.question_type,
         question.prompt_html,
         question.explanation_html,
         question.points::float8,
         question.sort_order,
         COALESCE((
           SELECT jsonb_agg(
             jsonb_build_object(
               'id', option.id::text,
               'optionHtml', option.option_html,
               'sortOrder', option.sort_order,
               'matchKey', option.match_key
             )
             ORDER BY option.sort_order
           )
           FROM public.learning_question_options option
           WHERE option.org_id = question.org_id
             AND option.question_id = question.id
         ), '[]'::jsonb) AS options
       FROM public.learning_questions question
       WHERE question.org_id = $1::uuid
         AND question.quiz_id = $2::uuid
         AND question.is_active = TRUE
       ORDER BY question.sort_order, question.created_at`,
      [quiz.org_id, quiz.id],
    )
    if (questionsResult.rows.length === 0) throw new Error('Kuis belum memiliki soal.')

    const orderedQuestions = openAttempt.rows[0]
      ? openAttempt.rows[0].question_order
          .map((id) => questionsResult.rows.find((question) => question.id === id))
          .filter((question): question is QuizQuestionRow => Boolean(question))
      : quiz.randomize_questions
        ? shuffled(questionsResult.rows)
        : questionsResult.rows
    let attemptId = openAttempt.rows[0]?.id
    let startedAt = openAttempt.rows[0]?.started_at
    if (!attemptId) {
      const created = await client.query<{ id: string; started_at: string }>(
        `INSERT INTO public.learning_quiz_attempts (
           org_id, quiz_id, enrollment_id, user_id, attempt_number,
           status, question_order, idempotency_key
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
           'IN_PROGRESS', $6::uuid[], $7
         ) RETURNING id::text, started_at::text`,
        [
          quiz.org_id,
          quiz.id,
          enrollment.enrollment_id,
          session.user.id,
          attemptCount + 1,
          orderedQuestions.map((question) => question.id),
          `quiz-attempt:${quiz.id}:${enrollment.enrollment_id}:${attemptCount + 1}`,
        ],
      )
      attemptId = created.rows[0].id
      startedAt = created.rows[0].started_at
    }
    await client.query('COMMIT')
    return {
      data: {
        attemptId,
        startedAt,
        expiresAt: quiz.time_limit_minutes
          ? new Date(new Date(startedAt!).getTime() + quiz.time_limit_minutes * 60_000).toISOString()
          : null,
        questions: orderedQuestions.map((question) => ({
          ...question,
          prompt_html: sanitizeLearningHtml(question.prompt_html),
          explanation_html: null,
          options: (quiz.randomize_options ? shuffled(question.options) : question.options)
            .map((option) => ({
              ...option,
              optionHtml: sanitizeQuizOptionHtml(option.optionHtml),
            })),
        })),
      },
    }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Kuis gagal dimulai.' }
  } finally {
    client.release()
  }
}

export type QuizAnswerInput = {
  questionId: string
  selectedOptionIds?: string[]
  answerText?: string
  answerOrder?: string[]
}

function sameSet(left: string[], right: string[]) {
  const a = [...new Set(left)].sort()
  const b = [...new Set(right)].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export async function submitQuizAttempt(attemptId: string, answers: QuizAnswerInput[]) {
  const session = await getInternalAuthSession()
  if (!session?.user) return { error: 'Silakan masuk untuk mengirim jawaban.' }
  const client = await connectPostgresClient()
  let completion: EnrollmentCompletion | null = null
  try {
    await client.query('BEGIN')
    const attemptResult = await client.query<{
      id: string
      org_id: string
      quiz_id: string
      course_id: string
      enrollment_id: string
      user_id: string
      status: string
      started_at: string
      time_limit_minutes: number | null
      passing_score: number
      show_explanations: boolean
    }>(
      `SELECT
         attempt.id::text, attempt.org_id::text, attempt.quiz_id::text,
         quiz.course_id::text, attempt.enrollment_id::text, attempt.user_id::text,
         attempt.status, attempt.started_at::text,
         quiz.time_limit_minutes, quiz.passing_score::float8,
         quiz.show_explanations
       FROM public.learning_quiz_attempts attempt
       JOIN public.learning_quizzes quiz
         ON quiz.id = attempt.quiz_id
        AND quiz.org_id = attempt.org_id
       WHERE attempt.id = $1::uuid
         AND attempt.user_id = $2::uuid
       FOR UPDATE OF attempt`,
      [attemptId, session.user.id],
    )
    const attempt = attemptResult.rows[0]
    if (!attempt) throw new Error('Attempt kuis tidak ditemukan.')
    if (attempt.status !== 'IN_PROGRESS') {
      await client.query('COMMIT')
      return { data: { alreadySubmitted: true } }
    }
    if (
      attempt.time_limit_minutes
      && Date.now() > new Date(attempt.started_at).getTime() + attempt.time_limit_minutes * 60_000
    ) {
      await client.query(
        `UPDATE public.learning_quiz_attempts
         SET status = 'EXPIRED', submitted_at = NOW(), updated_at = NOW()
         WHERE id = $1::uuid`,
        [attempt.id],
      )
      await client.query('COMMIT')
      return { error: 'Waktu pengerjaan kuis telah habis.' }
    }

    const questions = await client.query<{
      id: string
      question_type: string
      points: number
      correct_option_ids: string[]
      correct_order: string[]
      accepted_texts: string[]
      explanation_html: string | null
    }>(
      `SELECT
         question.id::text,
         question.question_type,
         question.points::float8,
         COALESCE(ARRAY_AGG(option.id::text ORDER BY option.sort_order)
           FILTER (WHERE option.is_correct), '{}'::text[]) AS correct_option_ids,
         COALESCE(ARRAY_AGG(option.id::text ORDER BY option.sort_order)
           FILTER (WHERE option.id IS NOT NULL), '{}'::text[]) AS correct_order,
         COALESCE(ARRAY_AGG(lower(trim(option.match_key)))
           FILTER (WHERE option.match_key IS NOT NULL AND option.is_correct), '{}'::text[]) AS accepted_texts,
         question.explanation_html
       FROM public.learning_questions question
       LEFT JOIN public.learning_question_options option
         ON option.question_id = question.id
        AND option.org_id = question.org_id
       WHERE question.org_id = $1::uuid
         AND question.quiz_id = $2::uuid
         AND question.is_active = TRUE
       GROUP BY question.id`,
      [attempt.org_id, attempt.quiz_id],
    )
    const answerMap = new Map(answers.map((answer) => [answer.questionId, answer]))
    let awardedPoints = 0
    let totalPoints = 0
    let requiresManualReview = false
    for (const question of questions.rows) {
      totalPoints += Number(question.points || 0)
      const answer = answerMap.get(question.id) || { questionId: question.id }
      let isCorrect: boolean | null = false
      if (question.question_type === 'ESSAY') {
        isCorrect = null
        requiresManualReview = true
      } else if (question.question_type === 'SHORT_TEXT') {
        const normalized = String(answer.answerText || '').trim().toLowerCase()
        isCorrect = question.accepted_texts.includes(normalized)
      } else if (question.question_type === 'ORDERING') {
        isCorrect = sameSet(answer.answerOrder || [], question.correct_order)
          && (answer.answerOrder || []).every(
            (value, index) => value === question.correct_order[index],
          )
      } else {
        isCorrect = sameSet(answer.selectedOptionIds || [], question.correct_option_ids)
      }
      const points = isCorrect ? Number(question.points || 0) : isCorrect === null ? null : 0
      if (points) awardedPoints += points
      await client.query(
        `INSERT INTO public.learning_quiz_answers (
           org_id, attempt_id, question_id, selected_option_ids, answer_text,
           answer_order, is_correct, awarded_points
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid[], $5, $6::jsonb, $7, $8
         )
         ON CONFLICT (attempt_id, question_id) DO UPDATE SET
           selected_option_ids = EXCLUDED.selected_option_ids,
           answer_text = EXCLUDED.answer_text,
           answer_order = EXCLUDED.answer_order,
           is_correct = EXCLUDED.is_correct,
           awarded_points = EXCLUDED.awarded_points,
           updated_at = NOW()`,
        [
          attempt.org_id,
          attempt.id,
          question.id,
          answer.selectedOptionIds || [],
          answer.answerText || null,
          JSON.stringify(answer.answerOrder || []),
          isCorrect,
          points,
        ],
      )
    }
    const score = totalPoints > 0 ? awardedPoints / totalPoints * 100 : 0
    const passed = requiresManualReview ? null : score >= attempt.passing_score
    await client.query(
      `UPDATE public.learning_quiz_attempts SET
         status = $2, score = $3, passed = $4, submitted_at = NOW(),
         graded_at = CASE WHEN $2 = 'GRADED' THEN NOW() ELSE NULL END,
         updated_at = NOW()
       WHERE id = $1::uuid`,
      [attempt.id, requiresManualReview ? 'SUBMITTED' : 'GRADED', score, passed],
    )
    if (!requiresManualReview) {
      await client.query(
        `INSERT INTO public.learning_gradebook_entries (
           org_id, course_id, enrollment_id, user_id, source_type, source_id,
           score, max_score, graded_at
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'QUIZ', $5::uuid,
           $6, 100, NOW()
         )
         ON CONFLICT (org_id, enrollment_id, source_type, source_id) DO UPDATE SET
           score = EXCLUDED.score, max_score = EXCLUDED.max_score,
           graded_at = NOW(), updated_at = NOW()`,
        [
          attempt.org_id,
          attempt.course_id,
          attempt.enrollment_id,
          attempt.user_id,
          attempt.quiz_id,
          score,
        ],
      )
      completion = await recalculateEnrollmentCompletion(client, attempt.enrollment_id)
    }
    await client.query('COMMIT')
    let certificateWarning: string | null = null
    if (completion?.fullyCompleted) {
      try {
        await enqueueCourseCompletionNotifications(attempt.enrollment_id)
      } catch {
        // Nilai tetap sah walau enqueue notifikasi perlu retry terpisah.
      }
      try {
        await issueCertificateForEnrollment(attempt.enrollment_id)
      } catch (certificateError) {
        certificateWarning = certificateError instanceof Error
          ? certificateError.message
          : 'Sertifikat masih menunggu penerbitan.'
      }
    }
    return {
      data: {
        score,
        passed,
        requiresManualReview,
        completion,
        certificateWarning,
        review: attempt.show_explanations
          ? questions.rows.map((question) => ({
              questionId: question.id,
              explanationHtml: sanitizeLearningHtml(question.explanation_html),
              correctOptionIds: question.correct_option_ids,
              correctOrder: question.correct_order,
              acceptedTexts: question.accepted_texts,
            }))
          : [],
      },
    }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Jawaban gagal dikirim.' }
  } finally {
    client.release()
  }
}

export async function submitAssignment(input: {
  orgSlug: string
  assignmentId: string
  text?: string
  uploadIds?: string[]
}) {
  const session = await getInternalAuthSession()
  if (!session?.user) return { error: 'Silakan masuk untuk mengirim tugas.' }
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    const assignment = await client.query<{
      org_id: string
      course_id: string
      due_at: string | null
      max_attempts: number
      allowed_mime_types: string[]
    }>(
      `SELECT
         assignment.org_id::text, assignment.course_id::text,
         assignment.due_at::text, assignment.max_attempts,
         assignment.allowed_mime_types
       FROM public.learning_assignments assignment
       JOIN public.organizations organization
         ON organization.id = assignment.org_id
       WHERE assignment.id = $1::uuid
         AND organization.slug = $2
         AND assignment.status = 'PUBLISHED'
       LIMIT 1
       FOR UPDATE OF assignment`,
      [input.assignmentId, input.orgSlug],
    )
    const details = assignment.rows[0]
    if (!details) throw new Error('Tugas tidak ditemukan.')
    if (details.due_at && new Date(details.due_at) < new Date()) {
      throw new Error('Batas waktu pengumpulan tugas telah lewat.')
    }
    const enrollment = await resolveActiveEnrollment(
      input.orgSlug,
      details.course_id,
      session.user.id,
    )
    if (!enrollment) throw new Error('Akses course tidak aktif.')
    const uploadIds = [...new Set(input.uploadIds || [])]
    const uploaded = uploadIds.length > 0
      ? await client.query<{
          id: string
          storage_key: string
          file_name: string
          mime_type: string
          file_size_bytes: number
          checksum_sha256: string
        }>(
          `SELECT
             id::text, storage_key, file_name, mime_type,
             file_size_bytes::float8, checksum_sha256
           FROM public.learning_assignment_uploads
           WHERE org_id = $1::uuid
             AND assignment_id = $2::uuid
             AND user_id = $3::uuid
             AND id = ANY($4::uuid[])
             AND consumed_submission_id IS NULL
             AND expires_at > NOW()
           FOR UPDATE`,
          [details.org_id, input.assignmentId, session.user.id, uploadIds],
        )
      : { rows: [] }
    if (uploaded.rows.length !== uploadIds.length) {
      throw new Error('Ada lampiran yang tidak valid atau sudah digunakan.')
    }
    if (!input.text?.trim() && uploaded.rows.length === 0) {
      throw new Error('Isi jawaban atau unggah minimal satu lampiran.')
    }
    const attachmentList = uploaded.rows.map((attachment) => ({
      uploadId: attachment.id,
      storageKey: attachment.storage_key,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
      size: Number(attachment.file_size_bytes),
      checksumSha256: attachment.checksum_sha256,
    }))
    const attempts = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM public.learning_assignment_submissions
       WHERE org_id = $1::uuid
         AND assignment_id = $2::uuid
         AND enrollment_id = $3::uuid`,
      [details.org_id, input.assignmentId, enrollment.enrollment_id],
    )
    const attemptNumber = Number(attempts.rows[0]?.count || 0) + 1
    if (attemptNumber > details.max_attempts) {
      throw new Error('Kesempatan pengumpulan tugas sudah habis.')
    }
    const result = await client.query<{ id: string }>(
      `INSERT INTO public.learning_assignment_submissions (
         org_id, assignment_id, enrollment_id, user_id, attempt_number,
         submission_text, attachments, status, submitted_at
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
         $6, $7::jsonb, 'SUBMITTED', NOW()
       ) RETURNING id::text`,
      [
        details.org_id,
        input.assignmentId,
        enrollment.enrollment_id,
        session.user.id,
        attemptNumber,
        input.text?.trim() || null,
        JSON.stringify(attachmentList),
      ],
    )
    if (uploadIds.length > 0) {
      await client.query(
        `UPDATE public.learning_assignment_uploads
         SET consumed_submission_id = $2::uuid
         WHERE org_id = $1::uuid AND id = ANY($3::uuid[])`,
        [details.org_id, result.rows[0].id, uploadIds],
      )
    }
    await client.query('COMMIT')
    return { data: { submissionId: result.rows[0].id, attemptNumber } }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Tugas gagal dikirim.' }
  } finally {
    client.release()
  }
}

export async function uploadAssignmentAttachment(formData: FormData) {
  const session = await getInternalAuthSession()
  if (!session?.user) return { error: 'Silakan masuk untuk mengunggah tugas.' }
  const orgSlug = String(formData.get('orgSlug') || '').trim()
  const assignmentId = String(formData.get('assignmentId') || '').trim()
  const file = formData.get('file')
  if (!(file instanceof File) || !orgSlug || !assignmentId) {
    return { error: 'File atau tugas tidak valid.' }
  }
  if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
    return { error: 'Ukuran file harus antara 1 byte dan 25 MB.' }
  }
  const assignment = await queryPostgres<{
    org_id: string
    course_id: string
    allowed_mime_types: string[]
  }>(
    `SELECT
       assignment.org_id::text, assignment.course_id::text,
       assignment.allowed_mime_types
     FROM public.learning_assignments assignment
     JOIN public.organizations organization ON organization.id = assignment.org_id
     WHERE assignment.id = $1::uuid
       AND organization.slug = $2
       AND assignment.status = 'PUBLISHED'
     LIMIT 1`,
    [assignmentId, orgSlug],
  )
  const details = assignment.rows[0]
  if (!details) return { error: 'Tugas tidak ditemukan.' }
  const enrollment = await resolveActiveEnrollment(orgSlug, details.course_id, session.user.id)
  if (!enrollment) return { error: 'Akses course tidak aktif.' }
  const mimeType = file.type || 'application/octet-stream'
  if (
    details.allowed_mime_types.length > 0
    && !details.allowed_mime_types.includes(mimeType)
  ) {
    return { error: `Format ${mimeType} tidak diizinkan.` }
  }
  const safeName = file.name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'lampiran'
  const buffer = Buffer.from(await file.arrayBuffer())
  const checksum = createHash('sha256').update(buffer).digest('hex')
  const uploadId = randomUUID()
  const storageKey = [
    'lms-submissions',
    details.org_id,
    session.user.id,
    assignmentId,
    `${uploadId}-${safeName}`,
  ].join('/')
  try {
    await uploadObjectToStorage({
      key: storageKey,
      body: buffer,
      contentType: mimeType,
      contentDisposition: `attachment; filename="${safeName.replace(/"/g, '-')}"`,
      cacheControl: 'private, no-store',
    })
    await queryPostgres(
      `INSERT INTO public.learning_assignment_uploads (
         id, org_id, assignment_id, user_id, storage_key, file_name,
         mime_type, file_size_bytes, checksum_sha256
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9
       )`,
      [
        uploadId,
        details.org_id,
        assignmentId,
        session.user.id,
        storageKey,
        file.name,
        mimeType,
        file.size,
        checksum,
      ],
    )
    return {
      success: true,
      upload: {
        id: uploadId,
        fileName: file.name,
        mimeType,
        size: file.size,
        checksumSha256: checksum,
      },
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unggah tugas gagal.' }
  }
}

export async function reviewAssignmentSubmission(input: {
  orgSlug?: string
  submissionId: string
  score: number
  feedback: string
  rubricScores?: unknown[]
}) {
  const orgData = await getAssessmentReviewerContext(input.orgSlug)
  if (!orgData?.user) return { error: 'Silakan masuk sebagai tutor/admin.' }
  const score = Number(input.score)
  if (!Number.isFinite(score) || score < 0) return { error: 'Nilai tidak valid.' }
  const client = await connectPostgresClient()
  let completion: EnrollmentCompletion | null = null
  try {
    await client.query('BEGIN')
    const submission = await client.query<{
      org_id: string
      assignment_id: string
      course_id: string
      enrollment_id: string
      user_id: string
      max_score: number
      is_instructor: boolean
    }>(
      `SELECT
         submission.org_id::text, submission.assignment_id::text,
         assignment.course_id::text, submission.enrollment_id::text,
         submission.user_id::text, assignment.max_score::float8,
         EXISTS (
           SELECT 1
           FROM public.learning_instructor_profiles instructor
           JOIN public.learning_course_instructors course_instructor
             ON course_instructor.instructor_id = instructor.id
            AND course_instructor.org_id = instructor.org_id
           WHERE instructor.org_id = submission.org_id
             AND instructor.user_id = $2::uuid
             AND course_instructor.course_id = assignment.course_id
             AND instructor.is_active = TRUE
         ) AS is_instructor
       FROM public.learning_assignment_submissions submission
       JOIN public.learning_assignments assignment
         ON assignment.id = submission.assignment_id
        AND assignment.org_id = submission.org_id
       WHERE submission.id = $1::uuid
         AND submission.org_id = $3::uuid
       FOR UPDATE OF submission`,
      [input.submissionId, orgData.user.id, orgData.org.id],
    )
    const details = submission.rows[0]
    if (!details) throw new Error('Pengumpulan tugas tidak ditemukan.')
    if (!['owner', 'admin', 'manager'].includes(orgData.role) && !details.is_instructor) {
      throw new Error('Anda bukan tutor untuk course ini.')
    }
    if (score > details.max_score) throw new Error(`Nilai maksimal ${details.max_score}.`)
    const percentage = details.max_score > 0 ? score / details.max_score * 100 : 0
    await client.query(
      `UPDATE public.learning_assignment_submissions SET
         status = 'GRADED', score = $2, rubric_scores = $3::jsonb,
         tutor_feedback = $4, reviewed_by = $5::uuid,
         graded_by = $5::uuid, graded_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid`,
      [
        input.submissionId,
        score,
        JSON.stringify(input.rubricScores || []),
        input.feedback.trim() || null,
        orgData.user.id,
      ],
    )
    await client.query(
      `INSERT INTO public.learning_gradebook_entries (
         org_id, course_id, enrollment_id, user_id, source_type, source_id,
         score, max_score, graded_by, graded_at
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'ASSIGNMENT', $5::uuid,
         $6, $7, $8::uuid, NOW()
       )
       ON CONFLICT (org_id, enrollment_id, source_type, source_id) DO UPDATE SET
         score = EXCLUDED.score, max_score = EXCLUDED.max_score,
         graded_by = EXCLUDED.graded_by, graded_at = NOW(), updated_at = NOW()`,
      [
        details.org_id,
        details.course_id,
        details.enrollment_id,
        details.user_id,
        details.assignment_id,
        score,
        details.max_score,
        orgData.user.id,
      ],
    )
    completion = await recalculateEnrollmentCompletion(client, details.enrollment_id)
    await client.query('COMMIT')
    let certificateWarning: string | null = null
    if (completion.fullyCompleted) {
      try {
        await enqueueCourseCompletionNotifications(details.enrollment_id)
      } catch {
        // Nilai tetap sah walau enqueue notifikasi perlu retry terpisah.
      }
      try {
        await issueCertificateForEnrollment(details.enrollment_id, {
          actorUserId: orgData.user.id,
        })
      } catch (certificateError) {
        certificateWarning = certificateError instanceof Error
          ? certificateError.message
          : 'Sertifikat masih menunggu penerbitan.'
      }
    }
    return { success: true, percentage, completion, certificateWarning }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Penilaian gagal disimpan.' }
  } finally {
    client.release()
  }
}

export async function reviewQuizEssayAnswers(input: {
  orgSlug?: string
  attemptId: string
  answers: Array<{
    questionId: string
    awardedPoints: number
    feedback?: string
  }>
}) {
  const orgData = await getAssessmentReviewerContext(input.orgSlug)
  if (!orgData?.user) return { error: 'Silakan masuk sebagai tutor/admin.' }
  const client = await connectPostgresClient()
  let enrollmentId = ''
  let completion: EnrollmentCompletion | null = null
  try {
    await client.query('BEGIN')
    const attemptResult = await client.query<{
      org_id: string
      enrollment_id: string
      quiz_id: string
      course_id: string
      user_id: string
      passing_score: number
      is_instructor: boolean
    }>(
      `SELECT
         attempt.org_id::text, attempt.enrollment_id::text,
         attempt.quiz_id::text, quiz.course_id::text, attempt.user_id::text,
         quiz.passing_score::float8,
         EXISTS (
           SELECT 1
           FROM public.learning_instructor_profiles instructor
           JOIN public.learning_course_instructors course_instructor
             ON course_instructor.instructor_id = instructor.id
            AND course_instructor.org_id = instructor.org_id
           WHERE instructor.org_id = attempt.org_id
             AND instructor.user_id = $2::uuid
             AND course_instructor.course_id = quiz.course_id
             AND instructor.is_active = TRUE
         ) AS is_instructor
       FROM public.learning_quiz_attempts attempt
       JOIN public.learning_quizzes quiz
         ON quiz.id = attempt.quiz_id AND quiz.org_id = attempt.org_id
       WHERE attempt.id = $1::uuid
         AND attempt.org_id = $3::uuid
         AND attempt.status = 'SUBMITTED'
       FOR UPDATE OF attempt`,
      [input.attemptId, orgData.user.id, orgData.org.id],
    )
    const attempt = attemptResult.rows[0]
    if (!attempt) throw new Error('Attempt yang menunggu penilaian tidak ditemukan.')
    if (!['owner', 'admin', 'manager'].includes(orgData.role) && !attempt.is_instructor) {
      throw new Error('Anda bukan tutor untuk course ini.')
    }
    const essayQuestions = await client.query<{ id: string; points: number }>(
      `SELECT question.id::text, question.points::float8
       FROM public.learning_questions question
       WHERE question.org_id = $1::uuid
         AND question.quiz_id = $2::uuid
         AND question.question_type = 'ESSAY'
         AND question.is_active = TRUE`,
      [attempt.org_id, attempt.quiz_id],
    )
    const reviewMap = new Map(input.answers.map((answer) => [answer.questionId, answer]))
    if (essayQuestions.rows.some((question) => !reviewMap.has(question.id))) {
      throw new Error('Semua jawaban esai wajib dinilai.')
    }
    for (const question of essayQuestions.rows) {
      const review = reviewMap.get(question.id)!
      const points = Number(review.awardedPoints)
      if (!Number.isFinite(points) || points < 0 || points > Number(question.points)) {
        throw new Error(`Nilai soal ${question.id} harus 0-${question.points}.`)
      }
      await client.query(
        `UPDATE public.learning_quiz_answers SET
           awarded_points = $4, is_correct = CASE WHEN $4 > 0 THEN TRUE ELSE FALSE END,
           grader_feedback = $5, graded_by = $3::uuid, graded_at = NOW(),
           updated_at = NOW()
         WHERE attempt_id = $1::uuid
           AND question_id = $2::uuid
           AND org_id = $6::uuid`,
        [
          input.attemptId,
          question.id,
          orgData.user.id,
          points,
          String(review.feedback || '').trim() || null,
          attempt.org_id,
        ],
      )
    }
    const totals = await client.query<{ awarded: number; maximum: number }>(
      `SELECT
         COALESCE(SUM(answer.awarded_points), 0)::float8 AS awarded,
         COALESCE(SUM(question.points), 0)::float8 AS maximum
       FROM public.learning_quiz_answers answer
       JOIN public.learning_questions question
         ON question.id = answer.question_id AND question.org_id = answer.org_id
       WHERE answer.attempt_id = $1::uuid`,
      [input.attemptId],
    )
    const score = totals.rows[0].maximum > 0
      ? totals.rows[0].awarded / totals.rows[0].maximum * 100
      : 0
    const passed = score >= attempt.passing_score
    await client.query(
      `UPDATE public.learning_quiz_attempts SET
         status = 'GRADED', score = $2, passed = $3,
         graded_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid`,
      [input.attemptId, score, passed],
    )
    await client.query(
      `INSERT INTO public.learning_gradebook_entries (
         org_id, course_id, enrollment_id, user_id, source_type, source_id,
         score, max_score, graded_by, graded_at
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'QUIZ', $5::uuid,
         $6, 100, $7::uuid, NOW()
       )
       ON CONFLICT (org_id, enrollment_id, source_type, source_id) DO UPDATE SET
         score = EXCLUDED.score, max_score = EXCLUDED.max_score,
         graded_by = EXCLUDED.graded_by, graded_at = NOW(), updated_at = NOW()`,
      [
        attempt.org_id,
        attempt.course_id,
        attempt.enrollment_id,
        attempt.user_id,
        attempt.quiz_id,
        score,
        orgData.user.id,
      ],
    )
    enrollmentId = attempt.enrollment_id
    completion = await recalculateEnrollmentCompletion(client, enrollmentId)
    await client.query('COMMIT')
    let certificateWarning: string | null = null
    if (completion.fullyCompleted) {
      try {
        await enqueueCourseCompletionNotifications(enrollmentId)
      } catch {
        // Nilai tetap sah walau enqueue notifikasi perlu retry terpisah.
      }
      try {
        await issueCertificateForEnrollment(enrollmentId, {
          actorUserId: orgData.user.id,
        })
      } catch (certificateError) {
        certificateWarning = certificateError instanceof Error
          ? certificateError.message
          : 'Sertifikat masih menunggu penerbitan.'
      }
    }
    return { success: true, score, passed, completion, certificateWarning }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Penilaian esai gagal.' }
  } finally {
    client.release()
  }
}
