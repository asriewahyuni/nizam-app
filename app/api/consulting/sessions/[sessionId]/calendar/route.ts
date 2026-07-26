/**
 * Unduhan kalender privat untuk sesi Consulting 360 milik member/konsultan.
 */
import { NextResponse } from 'next/server'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { queryPostgres } from '@/lib/db/postgres'

export const runtime = 'nodejs'

function escapeIcs(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}

function icsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const authSession = await getInternalAuthSession()
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 })
  }
  const { sessionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 400 })
  }
  const result = await queryPostgres<{
    id: string
    starts_at: string
    ends_at: string
    product_name: string
    consultant_name: string
    meeting_url: string | null
    location_name: string | null
  }>(
    `SELECT
       consulting_session.id::text,
       consulting_session.starts_at::text,
       consulting_session.ends_at::text,
       store_product.public_name AS product_name,
       instructor.display_name AS consultant_name,
       consulting_session.meeting_url,
       consulting_session.location_name
     FROM public.consulting_sessions consulting_session
     JOIN public.consulting_engagements engagement
       ON engagement.org_id = consulting_session.org_id
      AND engagement.id = consulting_session.engagement_id
     JOIN public.consulting_offerings offering
       ON offering.org_id = engagement.org_id
      AND offering.id = engagement.offering_id
     JOIN public.store_products store_product
       ON store_product.org_id = offering.org_id
      AND store_product.id = offering.store_product_id
     JOIN public.learning_instructor_profiles instructor
       ON instructor.org_id = consulting_session.org_id
      AND instructor.id = consulting_session.consultant_id
     WHERE consulting_session.id = $1::uuid
       AND (
         consulting_session.user_id = $2::uuid
         OR consulting_session.user_id = (
           SELECT legacy_user_id
           FROM public.internal_auth_users
           WHERE id = $2::uuid
           LIMIT 1
         )
         OR instructor.user_id = $2::uuid
         OR instructor.user_id = (
           SELECT legacy_user_id
           FROM public.internal_auth_users
           WHERE id = $2::uuid
           LIMIT 1
         )
         OR EXISTS (
           SELECT 1
           FROM public.org_members member
           WHERE member.org_id = consulting_session.org_id
             AND member.is_active = TRUE
             AND member.role IN ('owner', 'admin', 'manager')
             AND (
               member.user_id = $2::uuid
               OR member.user_id = (
                 SELECT legacy_user_id
                 FROM public.internal_auth_users
                 WHERE id = $2::uuid
                 LIMIT 1
               )
             )
         )
       )
     LIMIT 1`,
    [sessionId, authSession.user.id],
  )
  const session = result.rows[0]
  if (!session) {
    return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 })
  }
  const description = [
    `Sesi privat bersama ${session.consultant_name}`,
    session.meeting_url ? `Tautan: ${session.meeting_url}` : '',
  ].filter(Boolean).join('\n')
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nizam//Consulting 360//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:consulting-${session.id}@nizam`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(session.starts_at)}`,
    `DTEND:${icsDate(session.ends_at)}`,
    `SUMMARY:${escapeIcs(session.product_name)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(session.location_name || session.meeting_url || 'Online')}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="consulting-360-${session.id}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
