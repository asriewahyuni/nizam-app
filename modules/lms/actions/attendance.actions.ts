'use server'

/**
 * Token QR kehadiran dan check-in peserta. Token hanya disimpan sebagai hash.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'

type AttendanceState = { success?: boolean; message?: string; error?: string }

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function hashMatches(left: string, right: string) {
  const a = Buffer.from(left, 'hex')
  const b = Buffer.from(right, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function createAttendanceQrToken(
  orgSlug: string,
  sessionId: string,
  validityMinutes = 120,
) {
  const authSession = await getInternalAuthSession()
  if (!authSession?.user) return { error: 'Silakan masuk sebagai tutor/admin.' }
  const minutes = Math.max(5, Math.min(Math.trunc(validityMinutes), 24 * 60))
  const token = randomBytes(32).toString('base64url')
  const result = await queryPostgres<{ org_slug: string; expires_at: string }>(
    `UPDATE public.lms_batch_sessions class_session SET
       attendance_token_hash = $3,
       attendance_token_expires_at = NOW() + make_interval(mins => $4),
       updated_at = NOW()
     FROM public.organizations organization,
          public.lms_course_batches batch
     WHERE class_session.id = $1::uuid
       AND organization.slug = $2
       AND organization.is_active = TRUE
       AND organization.id = class_session.org_id
       AND batch.id = class_session.batch_id
       AND batch.org_id = class_session.org_id
       AND (
         EXISTS (
           SELECT 1
           FROM public.org_members member
           WHERE member.org_id = class_session.org_id
             AND member.user_id = $5::uuid
             AND member.is_active = TRUE
             AND member.role IN ('owner', 'admin', 'manager')
         )
         OR EXISTS (
           SELECT 1
           FROM public.learning_instructor_profiles instructor
           JOIN public.learning_course_instructors course_instructor
             ON course_instructor.org_id = instructor.org_id
            AND course_instructor.instructor_id = instructor.id
           WHERE instructor.org_id = class_session.org_id
             AND instructor.user_id = $5::uuid
             AND instructor.is_active = TRUE
             AND course_instructor.course_id = batch.course_id
         )
       )
     RETURNING organization.slug AS org_slug,
       class_session.attendance_token_expires_at::text AS expires_at`,
    [sessionId, orgSlug, tokenHash(token), minutes, authSession.user.id],
  )
  const updatedSession = result.rows[0]
  if (!updatedSession) return { error: 'Sesi tidak ditemukan atau Anda tidak berhak mengelolanya.' }
  const customMemberBaseUrl = String(process.env.COREISEC_MEMBER_BASE_URL || '').trim()
  const baseUrl = (
    customMemberBaseUrl
    || process.env.NEXT_PUBLIC_APP_URL
    || 'https://member.coreisec.id'
  ).replace(/\/+$/, '')
  const checkInPath = customMemberBaseUrl
    ? '/kehadiran'
    : `/member/${updatedSession.org_slug}/kehadiran`
  const url = new URL(`${baseUrl}${checkInPath}`)
  url.searchParams.set('sessionId', sessionId)
  url.searchParams.set('token', token)
  return { success: true, checkInUrl: url.toString(), expiresAt: updatedSession.expires_at }
}

export async function checkInWithAttendanceToken(
  _previous: AttendanceState,
  formData: FormData,
): Promise<AttendanceState> {
  const session = await getInternalAuthSession()
  if (!session?.user) return { error: 'Silakan masuk sebelum check-in.' }
  const orgSlug = String(formData.get('orgSlug') || '').trim()
  const sessionId = String(formData.get('sessionId') || '').trim()
  const token = String(formData.get('token') || '').trim()
  if (!orgSlug || !sessionId || token.length < 32) {
    return { error: 'Tautan QR tidak valid.' }
  }
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    const sessionResult = await client.query<{
      id: string
      org_id: string
      batch_id: string
      course_id: string
      start_time: string
      end_time: string
      attendance_token_hash: string | null
      attendance_token_expires_at: string | null
    }>(
      `SELECT
         class_session.id::text, class_session.org_id::text,
         class_session.batch_id::text, batch.course_id::text,
         class_session.start_time::text, class_session.end_time::text,
         class_session.attendance_token_hash,
         class_session.attendance_token_expires_at::text
       FROM public.lms_batch_sessions class_session
       JOIN public.lms_course_batches batch
         ON batch.id = class_session.batch_id
        AND batch.org_id = class_session.org_id
       JOIN public.organizations organization
         ON organization.id = class_session.org_id
        AND organization.slug = $2
       WHERE class_session.id = $1::uuid
       LIMIT 1
       FOR UPDATE OF class_session`,
      [sessionId, orgSlug],
    )
    const classSession = sessionResult.rows[0]
    if (!classSession?.attendance_token_hash || !classSession.attendance_token_expires_at) {
      throw new Error('QR kehadiran tidak aktif.')
    }
    if (new Date(classSession.attendance_token_expires_at).getTime() <= Date.now()) {
      throw new Error('QR kehadiran sudah kedaluwarsa.')
    }
    if (!hashMatches(classSession.attendance_token_hash, tokenHash(token))) {
      throw new Error('Token QR tidak cocok.')
    }
    const entitled = await client.query<{ allowed: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM public.learning_access_grants access_grant
         WHERE access_grant.org_id = $1::uuid
           AND access_grant.user_id = $2::uuid
           AND access_grant.course_id = $3::uuid
           AND (access_grant.batch_id IS NULL OR access_grant.batch_id = $4::uuid)
           AND access_grant.status = 'ACTIVE'
           AND access_grant.starts_at <= NOW()
           AND (access_grant.expires_at IS NULL OR access_grant.expires_at > NOW())
       ) AS allowed`,
      [
        classSession.org_id,
        session.user.id,
        classSession.course_id,
        classSession.batch_id,
      ],
    )
    if (!entitled.rows[0]?.allowed) throw new Error('Anda bukan peserta aktif sesi ini.')
    const late = Date.now() > new Date(classSession.start_time).getTime() + 15 * 60_000
    const attendance = await client.query<{ status: string; check_in_at: string }>(
      `INSERT INTO public.lms_session_attendances (
         org_id, session_id, user_id, status, check_in_at, verification_method
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4, NOW(), 'QR'
       )
       ON CONFLICT (org_id, session_id, user_id) DO UPDATE SET
         status = CASE
           WHEN public.lms_session_attendances.check_in_at IS NULL THEN EXCLUDED.status
           ELSE public.lms_session_attendances.status
         END,
         check_in_at = COALESCE(public.lms_session_attendances.check_in_at, NOW()),
         verification_method = 'QR', updated_at = NOW()
       RETURNING status, check_in_at::text`,
      [
        classSession.org_id,
        classSession.id,
        session.user.id,
        late ? 'LATE' : 'PRESENT',
      ],
    )
    await client.query('COMMIT')
    return {
      success: true,
      message: attendance.rows[0].status === 'LATE'
        ? 'Check-in berhasil dan tercatat terlambat.'
        : 'Check-in berhasil. Kehadiran Anda sudah tercatat.',
    }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: error instanceof Error ? error.message : 'Check-in gagal.' }
  } finally {
    client.release()
  }
}
