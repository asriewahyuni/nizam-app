/**
 * Satu kalkulasi completion untuk lesson, kuis, tugas, gradebook, dan sertifikat.
 */
import type { PoolClient } from 'pg'

export type EnrollmentCompletion = {
  fullyCompleted: boolean
  percentage: number
  requiredLessons: number
  completedLessons: number
  requiredQuizzes: number
  passedQuizzes: number
  requiredAssignments: number
  passedAssignments: number
}

export async function recalculateEnrollmentCompletion(
  client: PoolClient,
  enrollmentId: string,
  lastLessonId?: string | null,
): Promise<EnrollmentCompletion> {
  const result = await client.query<{
    org_id: string
    course_id: string
    required_lessons: number
    completed_lessons: number
    required_quizzes: number
    passed_quizzes: number
    required_assignments: number
    passed_assignments: number
  }>(
    `SELECT
       enrollment.org_id::text,
       enrollment.course_id::text,
       (
         SELECT COUNT(*)::int FROM public.learning_lessons lesson
         WHERE lesson.org_id = enrollment.org_id
           AND lesson.course_id = enrollment.course_id
           AND lesson.is_required = TRUE
           AND lesson.deleted_at IS NULL
       ) AS required_lessons,
       (
         SELECT COUNT(DISTINCT progress.lesson_id)::int
         FROM public.learning_lesson_progress progress
         JOIN public.learning_lessons lesson
           ON lesson.id = progress.lesson_id
          AND lesson.org_id = progress.org_id
         WHERE progress.org_id = enrollment.org_id
           AND progress.enrollment_id = enrollment.id
           AND progress.status = 'COMPLETED'
           AND lesson.course_id = enrollment.course_id
           AND lesson.is_required = TRUE
           AND lesson.deleted_at IS NULL
       ) AS completed_lessons,
       (
         SELECT COUNT(*)::int FROM public.learning_quizzes quiz
         WHERE quiz.org_id = enrollment.org_id
           AND quiz.course_id = enrollment.course_id
           AND quiz.status = 'PUBLISHED'
       ) AS required_quizzes,
       (
         SELECT COUNT(*)::int FROM public.learning_quizzes quiz
         WHERE quiz.org_id = enrollment.org_id
           AND quiz.course_id = enrollment.course_id
           AND quiz.status = 'PUBLISHED'
           AND EXISTS (
             SELECT 1 FROM public.learning_quiz_attempts attempt
             WHERE attempt.org_id = quiz.org_id
               AND attempt.quiz_id = quiz.id
               AND attempt.enrollment_id = enrollment.id
               AND attempt.status = 'GRADED'
               AND attempt.passed = TRUE
           )
       ) AS passed_quizzes,
       (
         SELECT COUNT(*)::int FROM public.learning_assignments assignment
         WHERE assignment.org_id = enrollment.org_id
           AND assignment.course_id = enrollment.course_id
           AND assignment.status = 'PUBLISHED'
       ) AS required_assignments,
       (
         SELECT COUNT(*)::int FROM public.learning_assignments assignment
         WHERE assignment.org_id = enrollment.org_id
           AND assignment.course_id = enrollment.course_id
           AND assignment.status = 'PUBLISHED'
           AND EXISTS (
             SELECT 1 FROM public.learning_assignment_submissions submission
             WHERE submission.org_id = assignment.org_id
               AND submission.assignment_id = assignment.id
               AND submission.enrollment_id = enrollment.id
               AND submission.status = 'GRADED'
               AND submission.score >= COALESCE(assignment.passing_score, 0)
           )
       ) AS passed_assignments
     FROM public.learning_enrollments enrollment
     WHERE enrollment.id = $1::uuid
     LIMIT 1
     FOR UPDATE OF enrollment`,
    [enrollmentId],
  )
  const row = result.rows[0]
  if (!row) throw new Error('Enrollment tidak ditemukan.')
  const requiredLessons = Number(row.required_lessons || 0)
  const completedLessons = Number(row.completed_lessons || 0)
  const requiredQuizzes = Number(row.required_quizzes || 0)
  const passedQuizzes = Number(row.passed_quizzes || 0)
  const requiredAssignments = Number(row.required_assignments || 0)
  const passedAssignments = Number(row.passed_assignments || 0)
  const percentage = requiredLessons > 0
    ? Math.min(100, completedLessons / requiredLessons * 100)
    : 0
  const fullyCompleted = requiredLessons > 0
    && completedLessons >= requiredLessons
    && passedQuizzes >= requiredQuizzes
    && passedAssignments >= requiredAssignments
  await client.query(
    `UPDATE public.learning_enrollments SET
       status = CASE WHEN $2 THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
       completed_at = CASE WHEN $2 THEN COALESCE(completed_at, NOW()) ELSE NULL END,
       last_lesson_id = COALESCE($3::uuid, last_lesson_id),
       progress_percent = $4,
       last_activity_at = NOW(), updated_at = NOW()
     WHERE id = $1::uuid`,
    [enrollmentId, fullyCompleted, lastLessonId || null, percentage],
  )
  return {
    fullyCompleted,
    percentage,
    requiredLessons,
    completedLessons,
    requiredQuizzes,
    passedQuizzes,
    requiredAssignments,
    passedAssignments,
  }
}
