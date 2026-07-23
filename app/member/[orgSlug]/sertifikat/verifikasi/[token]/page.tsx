import { notFound } from 'next/navigation'
import { Award, CalendarDays, CircleCheck, CircleX } from 'lucide-react'
import { queryPostgres } from '@/lib/db/postgres'

export default async function PublicCertificateVerificationPage({
  params,
}: {
  params: Promise<{ orgSlug: string; token: string }>
}) {
  const { orgSlug, token } = await params
  const result = await queryPostgres<{
    certificate_number: string
    issue_date: string
    expires_at: string | null
    status: string
    course_title: string | null
    recipient_name: string | null
  }>(
    `SELECT
       certificate.certificate_number,
       certificate.issue_date::text,
       certificate.expires_at::text,
       certificate.status,
       course.title AS course_title,
       COALESCE(auth_user.display_name, registration.full_name) AS recipient_name
     FROM public.lms_certificates certificate
     JOIN public.organizations organization
       ON organization.id = certificate.org_id
      AND organization.slug = $1
     LEFT JOIN public.learning_courses course
       ON course.id = certificate.course_id
      AND course.org_id = certificate.org_id
     LEFT JOIN public.internal_auth_users auth_user
       ON COALESCE(auth_user.legacy_user_id, auth_user.id) = certificate.user_id
     LEFT JOIN public.lms_registrations registration
       ON registration.id = certificate.registration_id
     WHERE certificate.verification_token = $2
     LIMIT 1`,
    [orgSlug, token],
  )
  const certificate = result.rows[0]
  if (!certificate) notFound()
  await queryPostgres(
    `INSERT INTO public.lms_certificate_audit (
       org_id, certificate_id, action, metadata
     )
     SELECT org_id, id, 'VERIFIED', jsonb_build_object('portal_slug', $1)
     FROM public.lms_certificates
     WHERE verification_token = $2`,
    [orgSlug, token],
  )
  const expired = Boolean(
    certificate.expires_at
    && new Date(certificate.expires_at).getTime() <= Date.now(),
  )
  const valid = certificate.status === 'ACTIVE' && !expired

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className={`rounded-3xl border bg-white p-7 shadow-sm sm:p-10 ${
        valid ? 'border-emerald-200' : 'border-red-200'
      }`}>
        <span className={`flex size-14 items-center justify-center rounded-2xl ${
          valid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
        }`}>
          {valid ? <CircleCheck aria-hidden="true" size={28} /> : <CircleX aria-hidden="true" size={28} />}
        </span>
        <p className={`mt-6 text-sm font-bold ${valid ? 'text-emerald-700' : 'text-red-700'}`}>
          {valid ? 'SERTIFIKAT VALID' : 'SERTIFIKAT TIDAK AKTIF'}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {certificate.course_title || 'Program pembelajaran'}
        </h1>
        <dl className="mt-8 divide-y divide-slate-100">
          <div className="grid gap-2 py-4 sm:grid-cols-[11rem_1fr]">
            <dt className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Award aria-hidden="true" size={17} />
              Nomor
            </dt>
            <dd className="font-mono font-semibold">{certificate.certificate_number}</dd>
          </div>
          <div className="grid gap-2 py-4 sm:grid-cols-[11rem_1fr]">
            <dt className="text-sm font-semibold text-slate-600">Penerima</dt>
            <dd className="font-semibold">{certificate.recipient_name || 'Nama tersimpan di arsip penerbit'}</dd>
          </div>
          <div className="grid gap-2 py-4 sm:grid-cols-[11rem_1fr]">
            <dt className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <CalendarDays aria-hidden="true" size={17} />
              Tanggal terbit
            </dt>
            <dd className="font-semibold">
              {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(certificate.issue_date))}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
