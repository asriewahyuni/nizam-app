/**
 * Proxy media LMS lama dan baru. Lampiran yang sudah tertaut ke lesson mengikuti
 * hak akses course; file belum tertaut hanya dapat dibuka admin organisasi.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { queryPostgres } from '@/lib/db/postgres'
import {
  createSignedStorageGetUrl,
  decodeStorageKeySegments,
  isObjectStorageConfigured,
  isPublicLmsMediaStorageKey,
} from '@/lib/storage/object-storage.server'
import { canUserAccessCourse } from '@/modules/lms/lib/access.server'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key?: string[] }> },
) {
  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ error: 'Bucket belum dikonfigurasi.' }, { status: 404 })
  }
  const session = await getInternalAuthSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Silakan masuk.' }, { status: 401 })
  }
  const key = decodeStorageKeySegments((await context.params).key)
  if (!key || !isPublicLmsMediaStorageKey(key)) {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 })
  }
  const parts = key.split('/').filter(Boolean)
  const orgId = parts[1] || ''
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) {
    return NextResponse.json({ error: 'Lokasi file tidak valid.' }, { status: 400 })
  }
  const asset = await queryPostgres<{ course_id: string; lesson_preview: boolean }>(
    `SELECT lesson.course_id::text, lesson.is_preview AS lesson_preview
     FROM public.learning_lesson_assets asset
     JOIN public.learning_lessons lesson
       ON lesson.id = asset.lesson_id
      AND lesson.org_id = asset.org_id
     WHERE asset.org_id = $1::uuid AND asset.storage_key = $2
     LIMIT 1`,
    [orgId, key],
  )
  if (asset.rows[0] && !asset.rows[0].lesson_preview) {
    const access = await canUserAccessCourse({
      orgId,
      userId: session.user.id,
      courseId: asset.rows[0].course_id,
    })
    if (!access.allowed) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses.' }, { status: 403 })
    }
  } else if (!asset.rows[0]) {
    const member = await queryPostgres<{ allowed: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM public.org_members
         WHERE org_id = $1::uuid
           AND user_id = $2::uuid
           AND is_active = TRUE
           AND role IN ('owner', 'admin', 'manager')
       ) AS allowed`,
      [orgId, session.user.id],
    )
    if (!member.rows[0]?.allowed) {
      return NextResponse.json({ error: 'File belum ditautkan ke lesson.' }, { status: 403 })
    }
  }
  const signedUrl = await createSignedStorageGetUrl(key, { expiresInSeconds: 5 * 60 })
  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
