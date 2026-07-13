'use server'

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'

export async function getLmsUserProgress(orgSlug: string, courseSlug: string) {
  try {
    const session = await getInternalAuthSession()
    if (!session || !session.user) return { data: {} }

    const orgResult = await queryPostgres<{ id: string }>(
      `select id::text as id from public.organizations where slug = $1 limit 1`,
      [orgSlug]
    )
    if (!orgResult.rows.length) return { error: 'Organisasi tidak ditemukan' }
    
    const courseResult = await queryPostgres<{ id: string }>(
      `select id::text as id from public.learning_courses where org_id = $1::uuid and slug = $2::text limit 1`,
      [orgResult.rows[0].id, courseSlug]
    )
    if (!courseResult.rows.length) return { error: 'Kursus tidak ditemukan' }

    const enrollmentResult = await queryPostgres<{ id: string }>(
      `select id::text as id from public.learning_enrollments where org_id = $1::uuid and user_id = $2::uuid and course_id = $3::uuid limit 1`,
      [orgResult.rows[0].id, session.user.id, courseResult.rows[0].id]
    )
    if (!enrollmentResult.rows.length) return { data: {} }

    const progressResult = await queryPostgres<{ lesson_id: string }>(
      `select lesson_id::text from public.learning_lesson_progress where enrollment_id = $1::uuid and status = 'COMPLETED'`,
      [enrollmentResult.rows[0].id]
    )

    const progressMap: Record<string, boolean> = {}
    for (const row of progressResult.rows) {
      progressMap[row.lesson_id] = true
    }

    return { data: progressMap }
  } catch (err: any) {
    return { error: err.message || 'Gagal memuat progress' }
  }
}

export async function markLessonComplete(orgSlug: string, lessonId: string) {
  try {
    // 1. Authenticate user
    const session = await getInternalAuthSession()
    if (!session || !session.user) {
      return { error: 'Anda harus login untuk menyimpan progress' }
    }
    const userId = session.user.id

    // 2. Resolve org_id
    const orgResult = await queryPostgres<{ id: string }>(
      `select id::text as id from public.organizations where slug = $1 limit 1`,
      [orgSlug]
    )
    if (!orgResult.rows.length) return { error: 'Organisasi tidak ditemukan' }
    const orgId = orgResult.rows[0].id

    // 3. Find Enrollment
    const enrollmentResult = await queryPostgres<{ id: string, course_id: string }>(
      `
        select id::text as id, course_id::text 
        from public.learning_enrollments 
        where org_id = $1::uuid and user_id = $2::uuid and status = 'IN_PROGRESS'
        limit 1
      `,
      [orgId, userId]
    )
    
    if (!enrollmentResult.rows.length) {
      return { error: 'Anda belum terdaftar (enroll) di kursus ini.' }
    }
    
    const enrollment = enrollmentResult.rows[0]

    // 4. Update or Insert Progress
    await queryPostgres(
      `
        insert into public.learning_lesson_progress (org_id, enrollment_id, lesson_id, status, completed_at)
        values ($1::uuid, $2::uuid, $3::uuid, 'COMPLETED', now())
        on conflict (org_id, enrollment_id, lesson_id) 
        do update set status = 'COMPLETED', completed_at = now(), updated_at = now()
      `,
      [orgId, enrollment.id, lessonId]
    )

    // 5. Trigger: Check if all lessons are completed for this course
    const countResult = await queryPostgres<{ total: number, completed: number }>(
      `
        with total_lessons as (
          select count(*) as cnt from public.learning_lessons where course_id = $1::uuid
        ),
        completed_lessons as (
          select count(*) as cnt from public.learning_lesson_progress 
          where enrollment_id = $2::uuid and status = 'COMPLETED'
        )
        select 
          (select cnt from total_lessons) as total,
          (select cnt from completed_lessons) as completed
      `,
      [enrollment.course_id, enrollment.id]
    )

    const { total, completed } = countResult.rows[0]

    // If fully completed, update enrollment status
    if (total > 0 && completed >= total) {
      await queryPostgres(
        `update public.learning_enrollments set status = 'COMPLETED', completed_at = now() where id = $1::uuid`,
        [enrollment.id]
      )

      console.log(`[LMS TRIGGER] User ${userId} completed course ${enrollment.course_id}.`)
    }

    return { success: true, fullyCompleted: (total > 0 && completed >= total) }
  } catch (err: any) {
    return { error: err.message || 'Gagal menyimpan progress' }
  }
}
