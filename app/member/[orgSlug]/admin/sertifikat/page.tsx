/**
 * Halaman admin untuk membuat dan memperbarui template sertifikat organisasi.
 */
import { notFound } from 'next/navigation'
import { Award } from 'lucide-react'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'
import {
  getCertificateAdminOverview,
  getCertificateAdminRecords,
} from '@/modules/lms/actions/certificate.actions'
import CertificateTemplateDesigner from './CertificateTemplateDesigner'
import CertificateRecordsManager from './CertificateRecordsManager'

export const dynamic = 'force-dynamic'

export default async function CertificateTemplateAdminPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  if (!member?.isAdmin) notFound()
  const [result, recordsResult] = await Promise.all([
    getCertificateAdminOverview(orgSlug),
    getCertificateAdminRecords(orgSlug),
  ])
  if (!result.data || !recordsResult.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900" role="alert">
          {result.error || recordsResult.error || 'Data sertifikat tidak dapat dimuat.'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
          <Award aria-hidden="true" size={24} />
        </span>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">
            Administrasi LMS
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-emerald-950">
            Template sertifikat
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Atur tampilan, penomoran otomatis, penanda tangan, dan masa berlaku.
            Sertifikat baru akan memakai template default yang aktif.
          </p>
        </div>
      </div>
      <div className="mt-8">
        <CertificateTemplateDesigner orgSlug={orgSlug} templates={result.data} />
      </div>
      <section aria-labelledby="issued-heading" className="mt-12">
        <h2 id="issued-heading" className="text-2xl font-bold text-emerald-950">
          Sertifikat yang sudah terbit
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Pencabutan dan penerbitan ulang dicatat dalam audit sertifikat. Sertifikat
          yang dicabut langsung tidak lolos verifikasi publik.
        </p>
        <div className="mt-5">
          <CertificateRecordsManager
            orgSlug={orgSlug}
            initialRecords={recordsResult.data}
          />
        </div>
      </section>
    </div>
  )
}
