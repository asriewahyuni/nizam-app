'use server'

/**
 * Aksi admin untuk template, penerbitan ulang, dan pencabutan sertifikat.
 */
import { revalidatePath } from 'next/cache'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  issueCertificateForEnrollment,
  revokeCertificate,
} from '@/modules/lms/lib/certificate.service'

function safeColor(value: unknown, fallback: string) {
  const color = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback
}

async function requireAdmin(orgSlug?: string) {
  if (orgSlug) {
    const session = await getInternalAuthSession()
    if (!session?.user) throw new Error('Silakan masuk sebagai admin.')
    const result = await queryPostgres<{ id: string; slug: string; role: string }>(
      `SELECT organization.id::text, organization.slug, member.role::text
       FROM public.organizations organization
       JOIN public.org_members member
         ON member.org_id = organization.id
        AND member.user_id = $2::uuid
        AND member.is_active = TRUE
       WHERE organization.slug = $1
         AND organization.is_active = TRUE
         AND member.role IN ('owner', 'admin', 'manager')
       LIMIT 1`,
      [orgSlug, session.user.id],
    )
    const row = result.rows[0]
    if (!row) throw new Error('Hanya admin yang dapat mengelola sertifikat.')
    return {
      org: { id: row.id, slug: row.slug },
      user: session.user,
      role: row.role,
    }
  }
  const org = await getActiveOrg()
  if (!org?.user || !['owner', 'admin', 'manager'].includes(org.role)) {
    throw new Error('Hanya admin yang dapat mengelola sertifikat.')
  }
  return org
}

export type CertificateTemplateAdminItem = {
  id: string
  name: string
  heading: string
  statement: string
  primaryColor: string
  accentColor: string
  numberingPattern: string
  validityDays: number | null
  isDefault: boolean
  signers: Array<{ name: string; title: string }>
  issuedCount: number
}

export async function getCertificateAdminOverview(orgSlug: string) {
  try {
    const org = await requireAdmin(orgSlug)
    const result = await queryPostgres<{
      id: string
      name: string
      design: Record<string, unknown>
      numbering_pattern: string
      validity_days: number | null
      is_default: boolean
      issued_count: number
    }>(
      `SELECT
         template.id::text,
         template.name,
         template.design,
         template.numbering_pattern,
         template.validity_days,
         template.is_default,
         (
           SELECT COUNT(*)::int
           FROM public.lms_certificates certificate
           WHERE certificate.org_id = template.org_id
             AND certificate.template_id = template.id
         ) AS issued_count
       FROM public.lms_certificate_templates template
       WHERE template.org_id = $1::uuid
         AND template.is_active = TRUE
       ORDER BY template.is_default DESC, template.name`,
      [org.org.id],
    )
    return {
      data: result.rows.map((template) => {
        const signers = Array.isArray(template.design?.signers)
          ? template.design.signers
              .filter((item): item is Record<string, unknown> => (
                Boolean(item) && typeof item === 'object'
              ))
              .map((item) => ({
                name: String(item.name || ''),
                title: String(item.title || ''),
              }))
          : []
        return {
          id: template.id,
          name: template.name,
          heading: String(template.design?.heading || 'SERTIFIKAT KELULUSAN'),
          statement: String(template.design?.statement || 'Diberikan dengan hormat kepada'),
          primaryColor: safeColor(template.design?.primaryColor, '#047857'),
          accentColor: safeColor(template.design?.accentColor, '#F97316'),
          numberingPattern: template.numbering_pattern,
          validityDays: template.validity_days,
          isDefault: template.is_default,
          signers,
          issuedCount: Number(template.issued_count || 0),
        } satisfies CertificateTemplateAdminItem
      }),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Template gagal dimuat.' }
  }
}

export type CertificateAdminRecord = {
  id: string
  enrollmentId: string | null
  certificateNumber: string
  participantName: string
  courseTitle: string
  status: string
  issueDate: string
  expiresAt: string | null
  revision: number
}

export async function getCertificateAdminRecords(orgSlug: string) {
  try {
    const org = await requireAdmin(orgSlug)
    const result = await queryPostgres<{
      id: string
      enrollment_id: string | null
      certificate_number: string
      participant_name: string
      course_title: string | null
      status: string
      issue_date: string
      expires_at: string | null
      revision: number
    }>(
      `SELECT
         certificate.id::text,
         certificate.enrollment_id::text,
         certificate.certificate_number,
         COALESCE(
           auth_user.display_name,
           auth_user.login_email,
           certificate.user_id::text,
           'Peserta lama'
         ) AS participant_name,
         course.title AS course_title,
         certificate.status,
         certificate.issue_date::text,
         certificate.expires_at::text,
         certificate.revision
       FROM public.lms_certificates certificate
       LEFT JOIN public.internal_auth_users auth_user
         ON auth_user.id = certificate.user_id
       LEFT JOIN public.learning_courses course
         ON course.id = certificate.course_id
        AND course.org_id = certificate.org_id
       WHERE certificate.org_id = $1::uuid
       ORDER BY certificate.created_at DESC
       LIMIT 100`,
      [org.org.id],
    )
    return {
      data: result.rows.map((certificate) => ({
        id: certificate.id,
        enrollmentId: certificate.enrollment_id,
        certificateNumber: certificate.certificate_number,
        participantName: certificate.participant_name,
        courseTitle: certificate.course_title || 'Program pembelajaran',
        status: certificate.status,
        issueDate: certificate.issue_date,
        expiresAt: certificate.expires_at,
        revision: Number(certificate.revision || 1),
      } satisfies CertificateAdminRecord)),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sertifikat gagal dimuat.' }
  }
}

export async function saveCertificateTemplate(input: {
  orgSlug?: string
  id?: string
  name: string
  heading?: string
  statement?: string
  primaryColor?: string
  accentColor?: string
  numberingPattern?: string
  validityDays?: number | null
  isDefault?: boolean
  signers?: Array<{ name: string; title: string }>
}) {
  try {
    const org = await requireAdmin(input.orgSlug)
    const name = input.name.trim()
    if (!name) return { error: 'Nama template wajib diisi.' }
    const pattern = String(input.numberingPattern || 'CERT/{YYYY}/{SEQ}').trim()
    if (!pattern.includes('{SEQ}')) {
      return { error: 'Pola nomor wajib memuat {SEQ}.' }
    }
    const design = {
      heading: String(input.heading || 'SERTIFIKAT KELULUSAN').trim(),
      statement: String(input.statement || 'Diberikan dengan hormat kepada').trim(),
      primaryColor: safeColor(input.primaryColor, '#047857'),
      accentColor: safeColor(input.accentColor, '#F97316'),
      signers: (input.signers || []).slice(0, 2).map((signer) => ({
        name: String(signer.name || '').trim(),
        title: String(signer.title || '').trim(),
      })).filter((signer) => signer.name && signer.title),
    }
    const client = await connectPostgresClient()
    let id = ''
    try {
      await client.query('BEGIN')
      if (input.isDefault) {
        await client.query(
          `UPDATE public.lms_certificate_templates
           SET is_default = FALSE, updated_at = NOW()
           WHERE org_id = $1::uuid AND is_default = TRUE`,
          [org.org.id],
        )
      }
      const result = await client.query<{ id: string }>(
        `INSERT INTO public.lms_certificate_templates (
           id, org_id, name, page_size, design, numbering_pattern,
           validity_days, is_default, is_active
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, 'A4_LANDSCAPE',
           $4::jsonb, $5, $6, $7, TRUE
         )
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, design = EXCLUDED.design,
           numbering_pattern = EXCLUDED.numbering_pattern,
           validity_days = EXCLUDED.validity_days,
           is_default = EXCLUDED.is_default, is_active = TRUE, updated_at = NOW()
         WHERE public.lms_certificate_templates.org_id = $2::uuid
         RETURNING id::text`,
        [
          input.id || null,
          org.org.id,
          name,
          JSON.stringify(design),
          pattern,
          input.validityDays == null ? null : Math.max(1, Math.trunc(input.validityDays)),
          Boolean(input.isDefault),
        ],
      )
      id = result.rows[0]?.id || ''
      if (!id) throw new Error('Template bukan milik organisasi aktif.')
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    revalidatePath(`/member/${org.org.slug}/admin/sertifikat`)
    return { success: true, id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Template gagal disimpan.' }
  }
}

export async function reissueCertificateAction(enrollmentId: string, orgSlug?: string) {
  try {
    const org = await requireAdmin(orgSlug)
    const owned = await queryPostgres<{ id: string }>(
      `SELECT id::text FROM public.learning_enrollments
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [enrollmentId, org.org.id],
    )
    if (!owned.rows[0]) return { error: 'Enrollment tidak ditemukan.' }
    const certificate = await issueCertificateForEnrollment(enrollmentId, {
      forceReissue: true,
      actorUserId: org.user.id,
    })
    revalidatePath(`/member/${org.org.slug}/admin/sertifikat`)
    return { success: true, certificate }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sertifikat gagal diterbitkan ulang.' }
  }
}

export async function revokeCertificateAction(
  certificateId: string,
  reason: string,
  orgSlug?: string,
) {
  try {
    const org = await requireAdmin(orgSlug)
    await revokeCertificate({
      orgId: org.org.id,
      certificateId,
      actorUserId: org.user.id,
      reason,
    })
    revalidatePath(`/member/${org.org.slug}/admin/sertifikat`)
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sertifikat gagal dicabut.' }
  }
}
