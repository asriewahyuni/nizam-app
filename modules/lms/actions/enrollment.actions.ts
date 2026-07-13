'use server'

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { ERPBridge } from '@/lib/erp-bridge/finances'

export async function enrollUser(orgSlug: string, courseSlug: string) {
  try {
    const session = await getInternalAuthSession()
    if (!session || !session.user) {
      return { error: 'Anda harus login untuk mendaftar kelas ini' }
    }
    const userId = session.user.id

    const orgResult = await queryPostgres<{ id: string }>(
      `select id::text as id from public.organizations where slug = $1 limit 1`,
      [orgSlug]
    )
    if (!orgResult.rows.length) return { error: 'Organisasi tidak ditemukan' }
    const orgId = orgResult.rows[0].id

    const courseResult = await queryPostgres<{ id: string, name: string }>(
      `
        select id::text as id, title as name 
        from public.learning_courses 
        where org_id = $1::uuid and slug = $2::text
        limit 1
      `,
      [orgId, courseSlug]
    )
    if (!courseResult.rows.length) return { error: 'Kursus tidak ditemukan' }
    const courseId = courseResult.rows[0].id
    const courseName = courseResult.rows[0].name

    // Check if already enrolled
    const checkResult = await queryPostgres<{ id: string }>(
      `
        select id::text as id 
        from public.learning_enrollments 
        where org_id = $1::uuid and user_id = $2::uuid and course_id = $3::uuid
      `,
      [orgId, userId, courseId]
    )

    if (checkResult.rows.length) {
      return { data: { alreadyEnrolled: true } }
    }

    // Mock Price for MVP Phase 1 (Asumsi kelas berbayar Rp 150.000)
    // Di fase berikutnya harga akan diambil dari lms_course_batches.price
    const mockPrice = 150000

    // Anti-Silo: Catat Pendapatan ke Buku Besar (GL) jika kelas berbayar
    if (mockPrice > 0) {
      // 1101 = Kas/Bank (Default)
      // 4500 = Pendapatan Program Pelatihan
      const debitAccountId = await ERPBridge.getDefaultAccount(orgId, '1101')
      const creditAccountId = await ERPBridge.getDefaultAccount(orgId, '4500')

      if (debitAccountId && creditAccountId) {
        const revenueRes = await ERPBridge.recordRevenue({
          orgId,
          amount: mockPrice,
          date: new Date().toISOString().split('T')[0],
          description: `Pendaftaran Kursus LMS: ${courseName}`,
          referenceType: 'LMS_ENROLLMENT',
          referenceId: courseId, // Seharusnya enrollment_id, tapi kita butuh uuid
          debitAccountId,
          creditAccountId
        })
        
        if ('error' in revenueRes) {
          console.error("Gagal mencatat jurnal pendapatan LMS:", revenueRes.error)
        }
      }
    }

    // Insert Enrollment
    await queryPostgres(
      `
        insert into public.learning_enrollments (org_id, user_id, course_id, status)
        values ($1::uuid, $2::uuid, $3::uuid, 'IN_PROGRESS')
      `,
      [orgId, userId, courseId]
    )

    return { data: { success: true } }
  } catch (err: any) {
    return { error: err.message || 'Gagal mendaftar' }
  }
}

export async function getStudentEnrollments(orgSlug: string) {
  try {
    const session = await getInternalAuthSession()
    if (!session || !session.user) {
      return { error: 'Not authenticated' }
    }
    const userId = session.user.id

    const orgResult = await queryPostgres<{ id: string }>(
      `select id::text as id from public.organizations where slug = $1 limit 1`,
      [orgSlug]
    )
    if (!orgResult.rows.length) return { error: 'Organisasi tidak ditemukan' }
    const orgId = orgResult.rows[0].id

    const { rows, error } = await queryPostgres(
      `
        select 
          e.id::text, e.status, e.created_at, e.completed_at,
          c.title, c.slug, c.level_code, c.description,
          (select count(*) from public.learning_lessons where course_id = c.id) as total_lessons,
          (select count(*) from public.learning_lesson_progress where enrollment_id = e.id and status = 'COMPLETED') as completed_lessons
        from public.learning_enrollments e
        join public.learning_courses c on c.id = e.course_id
        where e.org_id = $1::uuid and e.user_id = $2::uuid
        order by e.created_at desc
      `,
      [orgId, userId]
    )

    if (error) {
      return { error: 'Gagal memuat kelas saya: ' + error.message }
    }

    return { data: rows }
  } catch (err: any) {
    return { error: err.message || 'Unknown error' }
  }
}
