'use server'

import { queryPostgres } from '@/lib/db/postgres'

export async function getLMSCourses(orgSlug: string) {
  try {
    // 1. Resolve org_id from orgSlug
    const orgResult = await queryPostgres<{ id: string }>(
      `select id::text as id from public.organizations where slug = $1 limit 1`,
      [orgSlug]
    )
    
    if (!orgResult.rows.length) {
      return { error: 'Organisasi tidak ditemukan' }
    }
    
    const orgId = orgResult.rows[0].id

    // 2. Fetch active courses
    const { rows: courses, error } = await queryPostgres(
      `
        select 
          c.id::text, c.slug, c.title, c.description, c.level_code, c.passing_score
        from public.learning_courses c
        where c.org_id = $1::uuid and c.is_active = true
        order by c.created_at desc
      `,
      [orgId]
    )

    if (error) {
      return { error: 'Gagal mengambil data kursus: ' + error.message }
    }

    return { data: courses }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}

export async function getLMSCourseDetails(orgSlug: string, courseSlug: string) {
  try {
    console.log("getLMSCourseDetails called with:", orgSlug, courseSlug);
    const orgResult = await queryPostgres<{ id: string }>(
      `select id::text as id from public.organizations where slug = $1 limit 1`,
      [orgSlug]
    )
    console.log("orgResult:", orgResult.rows);
    if (!orgResult.rows.length) return { error: 'Organisasi tidak ditemukan' }
    const orgId = orgResult.rows[0].id

    const { rows: courseRows, error: courseError } = await queryPostgres(
      `
        select 
          id::text, title, description, level_code, passing_score
        from public.learning_courses
        where org_id = $1::uuid and slug = $2::text and is_active = true
        limit 1
      `,
      [orgId, courseSlug]
    )
    if (courseError || !courseRows.length) return { error: 'Kursus tidak ditemukan' }
    const course = courseRows[0]

    const { rows: lessonsRows, error: lessonsError } = await queryPostgres(
      `
        select 
          id::text, slug, title, lesson_type, sort_order, is_required
        from public.learning_lessons
        where org_id = $1::uuid and course_id = $2::uuid
        order by sort_order asc
      `,
      [orgId, course.id]
    )
    if (lessonsError) return { error: 'Gagal memuat materi' }

    const { rows: batchesRows } = await queryPostgres(
      `
        select 
          id::text, name, start_date, end_date, quota, price, mode, status
        from public.lms_course_batches
        where org_id = $1::uuid and course_id = $2::uuid and status = 'OPEN'
        order by created_at desc
      `,
      [orgId, course.id]
    )

    return { data: { course, lessons: lessonsRows, batches: batchesRows || [] } }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}
