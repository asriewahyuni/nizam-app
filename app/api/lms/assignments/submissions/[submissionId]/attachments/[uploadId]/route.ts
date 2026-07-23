/**
 * Unduhan bukti tugas untuk pemilik, tutor course, atau admin organisasi.
 */
import { NextResponse } from 'next/server'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { queryPostgres } from '@/lib/db/postgres'
import { createSignedStorageGetUrl } from '@/lib/storage/object-storage.server'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ submissionId: string; uploadId: string }>
  },
) {
  const session = await getInternalAuthSession()
  if (!session?.user) return NextResponse.json({ error: 'Silakan masuk.' }, { status: 401 })
  const { submissionId, uploadId } = await context.params
  const result = await queryPostgres<{
    storage_key: string
    file_name: string
    mime_type: string
    allowed: boolean
  }>(
    `SELECT
       upload.storage_key, upload.file_name, upload.mime_type,
       (
         submission.user_id = $3::uuid
         OR EXISTS (
           SELECT 1 FROM public.org_members member
           WHERE member.org_id = submission.org_id
             AND member.user_id = $3::uuid
             AND member.is_active = TRUE
             AND member.role IN ('owner', 'admin', 'manager')
         )
         OR EXISTS (
           SELECT 1
           FROM public.learning_assignment_submissions own_submission
           JOIN public.learning_assignments assignment
             ON assignment.id = own_submission.assignment_id
            AND assignment.org_id = own_submission.org_id
           JOIN public.learning_course_instructors course_instructor
             ON course_instructor.course_id = assignment.course_id
            AND course_instructor.org_id = assignment.org_id
           JOIN public.learning_instructor_profiles instructor
             ON instructor.id = course_instructor.instructor_id
            AND instructor.org_id = course_instructor.org_id
           WHERE own_submission.id = submission.id
             AND instructor.user_id = $3::uuid
             AND instructor.is_active = TRUE
         )
       ) AS allowed
     FROM public.learning_assignment_uploads upload
     JOIN public.learning_assignment_submissions submission
       ON submission.id = upload.consumed_submission_id
      AND submission.org_id = upload.org_id
     WHERE submission.id = $1::uuid AND upload.id = $2::uuid
     LIMIT 1`,
    [submissionId, uploadId, session.user.id],
  )
  const upload = result.rows[0]
  if (!upload) return NextResponse.json({ error: 'Lampiran tidak ditemukan.' }, { status: 404 })
  if (!upload.allowed) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
  const safeName = upload.file_name.replace(/["\r\n]/g, '-')
  const signedUrl = await createSignedStorageGetUrl(upload.storage_key, {
    contentDisposition: `attachment; filename="${safeName}"`,
    contentType: upload.mime_type,
    expiresInSeconds: 5 * 60,
  })
  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
