'use server'

/**
 * Penyimpanan progres LMS terpadu dan tenant-safe.
 */
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { resolveLessonAccess } from '@/modules/lms/lib/access.server'
import { issueCertificateForEnrollment } from '@/modules/lms/lib/certificate.service'
import { recalculateEnrollmentCompletion } from '@/modules/lms/lib/completion.service'
import { enqueueCourseCompletionNotifications } from '@/modules/notifications/coreisec-reminders.server'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Kesalahan tidak diketahui')
}

export type LmsProgressItem = {
  completed: boolean
  status: string
  lastPositionSeconds: number
}

export async function getLmsUserProgress(orgSlug: string, courseSlug: string) {
  try {
    const session = await getInternalAuthSession()
    if (!session?.user) return { data: {} as Record<string, LmsProgressItem> }

    const result = await queryPostgres<{
      lesson_id: string
      status: string
      last_position_seconds: number
    }>(
      `SELECT
         progress.lesson_id::text,
         progress.status,
         progress.last_position_seconds
       FROM public.organizations organization
       JOIN public.learning_courses course
         ON course.org_id = organization.id
        AND course.slug = $2
       JOIN public.learning_enrollments enrollment
         ON enrollment.org_id = organization.id
        AND enrollment.course_id = course.id
        AND enrollment.user_id = $3::uuid
       JOIN public.learning_lesson_progress progress
         ON progress.org_id = organization.id
        AND progress.enrollment_id = enrollment.id
       JOIN public.learning_lessons lesson
         ON lesson.org_id = organization.id
        AND lesson.course_id = course.id
        AND lesson.id = progress.lesson_id
       WHERE organization.slug = $1
         AND organization.is_active = TRUE`,
      [orgSlug, courseSlug, session.user.id],
    )

    const progressMap: Record<string, LmsProgressItem> = {}
    for (const row of result.rows) {
      progressMap[row.lesson_id] = {
        completed: row.status === 'COMPLETED',
        status: row.status,
        lastPositionSeconds: Number(row.last_position_seconds || 0),
      }
    }
    return { data: progressMap }
  } catch (error) {
    return { error: `Gagal memuat progres: ${getErrorMessage(error)}` }
  }
}

export async function markLessonComplete(orgSlug: string, lessonId: string) {
  const session = await getInternalAuthSession()
  if (!session?.user) {
    return { error: 'Anda harus masuk untuk menyimpan progres.' }
  }

  try {
    const outline = await queryPostgres<{
      course_slug: string
      lesson_slug: string
    }>(
      `SELECT course.slug AS course_slug, lesson.slug AS lesson_slug
       FROM public.organizations organization
       JOIN public.learning_courses course ON course.org_id = organization.id
       JOIN public.learning_lessons lesson
         ON lesson.org_id = organization.id
        AND lesson.course_id = course.id
       WHERE organization.slug = $1
         AND lesson.id = $2::uuid
         AND course.deleted_at IS NULL
         AND lesson.deleted_at IS NULL
       LIMIT 1`,
      [orgSlug, lessonId],
    )
    const lessonOutline = outline.rows[0]
    if (!lessonOutline) return { error: 'Materi tidak ditemukan.' }

    const access = await resolveLessonAccess({
      orgSlug,
      courseSlug: lessonOutline.course_slug,
      lessonSlug: lessonOutline.lesson_slug,
    })
    if (!access.allowed) return { error: access.message }
    if (!access.userId) return { error: 'Silakan masuk untuk menyimpan progres.' }
    if (!access.grantId) {
      return { error: 'Progres hanya dapat disimpan oleh peserta dengan akses aktif.' }
    }

    const client = await connectPostgresClient()
    try {
      await client.query('BEGIN')

      const enrollmentResult = await client.query<{ id: string }>(
        `INSERT INTO public.learning_enrollments (
           org_id,
           user_id,
           course_id,
           access_grant_id,
           status,
           started_at,
           last_activity_at
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'IN_PROGRESS', NOW(), NOW())
         ON CONFLICT (org_id, user_id, course_id) DO UPDATE
         SET
           access_grant_id = COALESCE(public.learning_enrollments.access_grant_id, EXCLUDED.access_grant_id),
           last_activity_at = NOW(),
           updated_at = NOW()
         RETURNING id::text`,
        [access.orgId, access.userId, access.lesson.courseId, access.grantId],
      )
      const enrollmentId = enrollmentResult.rows[0]?.id
      if (!enrollmentId) throw new Error('Enrollment tidak dapat disiapkan.')

      await client.query(
        `INSERT INTO public.learning_lesson_progress (
           org_id,
           enrollment_id,
           lesson_id,
           status,
           viewed_at,
           first_viewed_at,
           completed_at
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'COMPLETED', NOW(), NOW(), NOW())
         ON CONFLICT (org_id, enrollment_id, lesson_id) DO UPDATE
         SET
           status = 'COMPLETED',
           completed_at = COALESCE(public.learning_lesson_progress.completed_at, NOW()),
           first_viewed_at = COALESCE(public.learning_lesson_progress.first_viewed_at, NOW()),
           updated_at = NOW()`,
        [access.orgId, enrollmentId, access.lesson.id],
      )

      const completion = await recalculateEnrollmentCompletion(
        client,
        enrollmentId,
        access.lesson.id,
      )
      const {
        fullyCompleted,
        percentage,
        requiredQuizzes,
        passedQuizzes,
        requiredAssignments,
        passedAssignments,
      } = completion

      await client.query('COMMIT')
      let certificateWarning: string | null = null
      if (fullyCompleted) {
        try {
          await enqueueCourseCompletionNotifications(enrollmentId)
        } catch {
          // Completion tidak dibatalkan hanya karena enqueue notifikasi gagal.
        }
        try {
          await issueCertificateForEnrollment(enrollmentId)
        } catch (certificateError) {
          certificateWarning = `Course selesai, tetapi sertifikat masih menunggu penerbitan: ${
            getErrorMessage(certificateError)
          }`
        }
      }
      return {
        success: true,
        fullyCompleted,
        percentage,
        assessmentProgress: {
          quizzes: `${passedQuizzes}/${requiredQuizzes}`,
          assignments: `${passedAssignments}/${requiredAssignments}`,
        },
        certificateWarning,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    return { error: `Gagal menyimpan progres: ${getErrorMessage(error)}` }
  }
}
