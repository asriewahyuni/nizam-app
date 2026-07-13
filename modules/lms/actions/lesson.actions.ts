'use server'

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { cookies } from 'next/headers'

export async function getLMSLessonDetails(orgSlug: string, courseSlug: string, lessonSlug: string) {
  try {
    const orgResult = await queryPostgres<{ id: string }>(
      `select id::text as id from public.organizations where slug = $1 limit 1`,
      [orgSlug]
    )
    if (!orgResult.rows.length) return { error: 'Organisasi tidak ditemukan' }
    const orgId = orgResult.rows[0].id

    const { rows: lessonRows, error: lessonError } = await queryPostgres(
      `
        select 
          l.id::text, l.course_id::text, l.title, l.content_md, l.media_items, l.lesson_type,
          c.title as course_title, c.slug as course_slug
        from public.learning_lessons l
        join public.learning_courses c on c.id = l.course_id
        where c.org_id = $1::uuid and c.slug = $2::text and l.slug = $3::text
        limit 1
      `,
      [orgId, courseSlug, lessonSlug]
    )
    if (lessonError || !lessonRows.length) return { error: 'Materi tidak ditemukan' }

    return { data: lessonRows[0] }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}
