/**
 * Penerbitan, penerbitan ulang, dan pencabutan sertifikat terverifikasi.
 */
import 'server-only'

import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { PoolClient } from 'pg'
import { connectPostgresClient } from '@/lib/db/postgres'
import { uploadObjectToStorage } from '@/lib/storage/object-storage.server'
import { enqueueNotification } from '@/modules/notifications/outbox.server'
import { renderCertificatePdf } from './certificate-pdf'

const require = createRequire(import.meta.url)

type CertificateDesign = {
  primaryColor?: string
  accentColor?: string
  heading?: string
  statement?: string
  signers?: Array<{ name: string; title: string }>
}

async function loadFonts() {
  // Resolusi paket dibuat statis agar Turbopack dapat melacak berkas font yang
  // dibutuhkan saat build dan tetap membawanya ke output server.
  const fontPackageRoot = dirname(require.resolve('dejavu-fonts-ttf/package.json'))
  const [regular, bold] = await Promise.all([
    readFile(join(fontPackageRoot, 'ttf', 'DejaVuSans.ttf')),
    readFile(join(fontPackageRoot, 'ttf', 'DejaVuSans-Bold.ttf')),
  ])
  return { regular, bold }
}

function certificateNumber(pattern: string, year: number, sequence: number) {
  return pattern
    .replaceAll('{YYYY}', String(year))
    .replaceAll('{YY}', String(year).slice(-2))
    .replaceAll('{SEQ}', String(sequence).padStart(6, '0'))
}

async function reserveSequence(client: PoolClient, orgId: string, year: number) {
  const result = await client.query<{ last_number: number }>(
    `INSERT INTO public.lms_certificate_number_counters (
       org_id, issue_year, last_number
     ) VALUES ($1::uuid, $2, 1)
     ON CONFLICT (org_id, issue_year) DO UPDATE SET
       last_number = public.lms_certificate_number_counters.last_number + 1,
       updated_at = NOW()
     RETURNING last_number::int`,
    [orgId, year],
  )
  return Number(result.rows[0].last_number)
}

export async function issueCertificateForEnrollment(
  enrollmentId: string,
  options?: { forceReissue?: boolean; actorUserId?: string | null },
) {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    const result = await client.query<{
      enrollment_id: string
      org_id: string
      user_id: string
      course_id: string
      organization_name: string
      org_slug: string
      recipient_name: string
      recipient_email: string | null
      recipient_phone: string | null
      course_title: string
      status: string
      template_id: string | null
      template_design: CertificateDesign
      numbering_pattern: string
      validity_days: number | null
    }>(
      `SELECT
         enrollment.id::text AS enrollment_id,
         enrollment.org_id::text,
         enrollment.user_id::text,
         enrollment.course_id::text,
         organization.name AS organization_name,
         organization.slug AS org_slug,
         COALESCE(auth_user.display_name, auth_user.login_email, 'Peserta') AS recipient_name,
         COALESCE(auth_user.login_email, identity_user.email) AS recipient_email,
         COALESCE(
           identity_user.raw_user_meta_data->>'phone',
           identity_user.raw_user_meta_data->>'phone_number'
         ) AS recipient_phone,
         course.title AS course_title,
         enrollment.status,
         template.id::text AS template_id,
         COALESCE(template.design, '{}'::jsonb) AS template_design,
         COALESCE(template.numbering_pattern, 'CERT/{YYYY}/{SEQ}') AS numbering_pattern,
         template.validity_days
       FROM public.learning_enrollments enrollment
       JOIN public.organizations organization ON organization.id = enrollment.org_id
       JOIN public.learning_courses course
         ON course.id = enrollment.course_id
        AND course.org_id = enrollment.org_id
       LEFT JOIN public.internal_auth_users auth_user
         ON COALESCE(auth_user.legacy_user_id, auth_user.id) = enrollment.user_id
       LEFT JOIN auth.users identity_user ON identity_user.id = enrollment.user_id
       LEFT JOIN LATERAL (
         SELECT candidate.*
         FROM public.lms_certificate_templates candidate
         WHERE candidate.org_id = enrollment.org_id
           AND candidate.is_active = TRUE
         ORDER BY candidate.is_default DESC, candidate.created_at
         LIMIT 1
       ) template ON TRUE
       WHERE enrollment.id = $1::uuid
       LIMIT 1
       FOR UPDATE OF enrollment`,
      [enrollmentId],
    )
    const enrollment = result.rows[0]
    if (!enrollment) throw new Error('Enrollment tidak ditemukan.')
    if (enrollment.status !== 'COMPLETED') {
      throw new Error('Sertifikat hanya dapat diterbitkan setelah course selesai.')
    }

    const existing = await client.query<{
      id: string
      certificate_number: string
      verification_token: string
      storage_key: string | null
      revision: number
    }>(
      `SELECT
         id::text, certificate_number, verification_token, storage_key, revision
       FROM public.lms_certificates
       WHERE org_id = $1::uuid
         AND enrollment_id = $2::uuid
         AND status = 'ACTIVE'
       ORDER BY revision DESC, created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [enrollment.org_id, enrollment.enrollment_id],
    )
    if (existing.rows[0] && !options?.forceReissue) {
      await client.query('COMMIT')
      return { ...existing.rows[0], alreadyIssued: true }
    }

    const now = new Date()
    const year = now.getUTCFullYear()
    const sequence = existing.rows[0]
      ? null
      : await reserveSequence(client, enrollment.org_id, year)
    const number = existing.rows[0]?.certificate_number
      || certificateNumber(enrollment.numbering_pattern, year, sequence!)
    const token = existing.rows[0]?.verification_token
      || randomBytes(24).toString('base64url')
    const revision = existing.rows[0] ? Number(existing.rows[0].revision) + 1 : 1
    const customMemberBaseUrl = String(process.env.COREISEC_MEMBER_BASE_URL || '').trim()
    const verifyBase = (
      customMemberBaseUrl
      || process.env.NEXT_PUBLIC_APP_URL
      || 'https://member.coreisec.id'
    ).replace(/\/+$/, '')
    const verificationPath = customMemberBaseUrl
      ? `/sertifikat/verifikasi/${token}`
      : `/member/${enrollment.org_slug}/sertifikat/verifikasi/${token}`
    const verificationUrl = `${verifyBase}${verificationPath}`
    const pdf = await renderCertificatePdf({
      organizationName: enrollment.organization_name,
      recipientName: enrollment.recipient_name,
      courseTitle: enrollment.course_title,
      certificateNumber: number,
      issueDateLabel: new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(now),
      verificationUrl,
      ...enrollment.template_design,
    }, await loadFonts())
    const safeNumber = number.replace(/[^a-z0-9_-]+/gi, '-')
    const storageKey = `certificates/${enrollment.org_id}/${year}/${safeNumber}-r${revision}.pdf`
    await uploadObjectToStorage({
      key: storageKey,
      body: pdf,
      contentType: 'application/pdf',
      contentDisposition: `attachment; filename="${safeNumber}.pdf"`,
      cacheControl: 'private, no-store',
    })
    const expiresAt = enrollment.validity_days
      ? new Date(now.getTime() + enrollment.validity_days * 86_400_000).toISOString()
      : null
    let certificateId = existing.rows[0]?.id
    if (certificateId) {
      await client.query(
        `UPDATE public.lms_certificates SET
           template_id = $3::uuid, storage_key = $4, file_url = NULL,
           issue_date = CURRENT_DATE, expires_at = $5::timestamptz,
           revision = $6, updated_at = NOW()
         WHERE id = $1::uuid AND org_id = $2::uuid`,
        [
          certificateId,
          enrollment.org_id,
          enrollment.template_id,
          storageKey,
          expiresAt,
          revision,
        ],
      )
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO public.lms_certificates (
           org_id, registration_id, user_id, enrollment_id, course_id,
           template_id, certificate_number, issue_date, verification_token,
           status, expires_at, revision, storage_key
         ) VALUES (
           $1::uuid, NULL, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6,
           CURRENT_DATE, $7, 'ACTIVE', $8::timestamptz, 1, $9
         ) RETURNING id::text`,
        [
          enrollment.org_id,
          enrollment.user_id,
          enrollment.enrollment_id,
          enrollment.course_id,
          enrollment.template_id,
          number,
          token,
          expiresAt,
          storageKey,
        ],
      )
      certificateId = inserted.rows[0].id
    }
    await client.query(
      `INSERT INTO public.lms_certificate_audit (
         org_id, certificate_id, action, actor_user_id, metadata
       ) VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::jsonb)`,
      [
        enrollment.org_id,
        certificateId,
        existing.rows[0] ? 'REISSUED' : 'ISSUED',
        options?.actorUserId || null,
        JSON.stringify({ revision, storageKey, verificationUrl }),
      ],
    )
    await client.query('COMMIT')
    const variables = {
      name: enrollment.recipient_name,
      course_title: enrollment.course_title,
      certificate_number: number,
      verification_url: verificationUrl,
    }
    try {
      if (enrollment.recipient_email) {
        await enqueueNotification({
          orgId: enrollment.org_id,
          userId: enrollment.user_id,
          eventType: 'CERTIFICATE_ISSUED',
          channel: 'EMAIL',
          recipient: enrollment.recipient_email,
          templateKey: 'CERTIFICATE_ISSUED',
          variables,
          idempotencyKey: `certificate:${certificateId}:revision:${revision}:email`,
        })
      }
      if (enrollment.recipient_phone) {
        await enqueueNotification({
          orgId: enrollment.org_id,
          userId: enrollment.user_id,
          eventType: 'CERTIFICATE_ISSUED',
          channel: 'WHATSAPP',
          recipient: enrollment.recipient_phone,
          templateKey: 'CERTIFICATE_ISSUED',
          variables,
          idempotencyKey: `certificate:${certificateId}:revision:${revision}:whatsapp`,
        })
      }
    } catch {
      // Sertifikat tetap sah; worker rekonsiliasi dapat membuat ulang notifikasi.
    }
    return {
      id: certificateId!,
      certificate_number: number,
      verification_token: token,
      storage_key: storageKey,
      revision,
      alreadyIssued: false,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function revokeCertificate(input: {
  orgId: string
  certificateId: string
  actorUserId: string
  reason: string
}) {
  const reason = input.reason.trim()
  if (!reason) throw new Error('Alasan pencabutan wajib diisi.')
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    const updated = await client.query<{ id: string }>(
      `UPDATE public.lms_certificates SET
         status = 'REVOKED', revoked_at = NOW(), revoked_reason = $3,
         updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid AND status = 'ACTIVE'
       RETURNING id::text`,
      [input.certificateId, input.orgId, reason],
    )
    if (!updated.rows[0]) throw new Error('Sertifikat aktif tidak ditemukan.')
    await client.query(
      `INSERT INTO public.lms_certificate_audit (
         org_id, certificate_id, action, actor_user_id, metadata
       ) VALUES ($1::uuid, $2::uuid, 'REVOKED', $3::uuid, $4::jsonb)`,
      [input.orgId, input.certificateId, input.actorUserId, JSON.stringify({ reason })],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
