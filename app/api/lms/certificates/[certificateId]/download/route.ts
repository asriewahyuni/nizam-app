/**
 * Unduhan sertifikat hanya untuk pemilik atau admin organisasi.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { queryPostgres } from '@/lib/db/postgres'
import { createSignedStorageGetUrl } from '@/lib/storage/object-storage.server'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  const session = await getInternalAuthSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Silakan masuk.' }, { status: 401 })
  }
  const { certificateId } = await context.params
  const result = await queryPostgres<{
    certificate_number: string
    storage_key: string | null
    file_url: string | null
  }>(
    `SELECT
       certificate.certificate_number,
       certificate.storage_key,
       certificate.file_url
     FROM public.lms_certificates certificate
     WHERE certificate.id = $1::uuid
       AND (
         certificate.user_id = $2::uuid
         OR EXISTS (
           SELECT 1
           FROM public.org_members member
           WHERE member.org_id = certificate.org_id
             AND member.user_id = $2::uuid
             AND member.is_active = TRUE
             AND member.role IN ('owner', 'admin', 'manager')
         )
       )
     LIMIT 1`,
    [certificateId, session.user.id],
  )
  const certificate = result.rows[0]
  if (!certificate) return NextResponse.json({ error: 'Sertifikat tidak ditemukan.' }, { status: 404 })

  await queryPostgres(
    `INSERT INTO public.lms_certificate_audit (
       org_id, certificate_id, action, actor_user_id, metadata
     )
     SELECT org_id, id, 'DOWNLOADED', $2::uuid, '{}'::jsonb
     FROM public.lms_certificates
     WHERE id = $1::uuid`,
    [certificateId, session.user.id],
  )

  if (certificate.storage_key) {
    const signedUrl = await createSignedStorageGetUrl(certificate.storage_key, {
      contentDisposition: `attachment; filename="${certificate.certificate_number}.pdf"`,
      contentType: 'application/pdf',
      expiresInSeconds: 5 * 60,
    })
    return NextResponse.redirect(signedUrl, 307)
  }
  if (certificate.file_url && certificate.file_url.startsWith('https://')) {
    return NextResponse.redirect(certificate.file_url, 307)
  }
  return NextResponse.json({ error: 'File sertifikat belum tersedia.' }, { status: 404 })
}
