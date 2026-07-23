/**
 * Link lampiran LMS bertanda tangan. Akses diperiksa kembali setiap kali file
 * diminta sehingga URL database tidak dapat dipakai untuk melewati entitlement.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { queryPostgres } from '@/lib/db/postgres'
import { createSignedStorageGetUrl } from '@/lib/storage/object-storage.server'
import { canUserAccessCourse } from '@/modules/lms/lib/access.server'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await context.params
  const result = await queryPostgres<{
    org_id: string
    course_id: string
    lesson_preview: boolean
    title: string
    storage_key: string | null
    source_url: string | null
    mime_type: string | null
    is_downloadable: boolean
  }>(
    `SELECT
       asset.org_id::text,
       lesson.course_id::text,
       lesson.is_preview AS lesson_preview,
       asset.title,
       asset.storage_key,
       asset.source_url,
       asset.mime_type,
       asset.is_downloadable
     FROM public.learning_lesson_assets asset
     JOIN public.learning_lessons lesson
       ON lesson.id = asset.lesson_id
      AND lesson.org_id = asset.org_id
     WHERE asset.id = $1::uuid
       AND lesson.deleted_at IS NULL
     LIMIT 1`,
    [assetId],
  )
  const asset = result.rows[0]
  if (!asset) return NextResponse.json({ error: 'Lampiran tidak ditemukan.' }, { status: 404 })

  if (!asset.lesson_preview) {
    const session = await getInternalAuthSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan masuk.' }, { status: 401 })
    }
    const access = await canUserAccessCourse({
      orgId: asset.org_id,
      userId: session.user.id,
      courseId: asset.course_id,
    })
    if (!access.allowed) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke lampiran ini.' }, { status: 403 })
    }
  }

  if (asset.storage_key) {
    const safeFilename = asset.title.replace(/["\r\n]/g, '-')
    const disposition = asset.is_downloadable
      ? `attachment; filename="${safeFilename}"`
      : `inline; filename="${safeFilename}"`
    const signedUrl = await createSignedStorageGetUrl(asset.storage_key, {
      contentDisposition: disposition,
      contentType: asset.mime_type || undefined,
      expiresInSeconds: 5 * 60,
    })
    return NextResponse.redirect(signedUrl, {
      status: 307,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }
  if (asset.source_url && asset.source_url.startsWith('https://')) {
    return NextResponse.redirect(asset.source_url, {
      status: 307,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }
  return NextResponse.json({ error: 'File lampiran belum tersedia.' }, { status: 404 })
}
