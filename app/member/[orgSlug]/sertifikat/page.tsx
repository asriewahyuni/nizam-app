import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Award, Download, QrCode } from 'lucide-react'
import {
  getPortalCertificates,
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'

export default async function MemberCertificatesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  if (!member) redirect(`/login?callbackUrl=${encodeURIComponent(`/member/${orgSlug}/sertifikat`)}`)
  const certificates = await getPortalCertificates(tenant, member)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-emerald-700">Bukti kelulusan</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Sertifikat</h1>
      <p className="mt-3 text-slate-600">Setiap sertifikat memiliki nomor dan tautan verifikasi publik.</p>

      {certificates.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-emerald-300 bg-white p-10 text-center">
          <Award aria-hidden="true" className="mx-auto text-emerald-700" size={42} />
          <h2 className="mt-4 text-lg font-semibold">Belum ada sertifikat</h2>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {certificates.map((certificate) => (
            <article key={certificate.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
                  <Award aria-hidden="true" size={22} />
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  certificate.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-red-50 text-red-800'
                }`}>
                  {certificate.status}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-bold">{certificate.courseTitle}</h2>
              <p className="mt-2 font-mono text-sm text-slate-600">{certificate.certificateNumber}</p>
              <p className="mt-3 text-sm text-slate-600">
                Terbit {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(certificate.issueDate))}
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {certificate.verificationToken && (
                  <Link
                    href={`/member/${tenant.slug}/sertifikat/verifikasi/${certificate.verificationToken}`}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 font-semibold text-emerald-800 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                  >
                    <QrCode aria-hidden="true" size={18} />
                    Verifikasi
                  </Link>
                )}
                {certificate.canDownload && (
                  <a
                    href={`/api/lms/certificates/${certificate.id}/download`}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                  >
                    <Download aria-hidden="true" size={18} />
                    Unduh PDF
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
