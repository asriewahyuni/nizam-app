/**
 * Dashboard read-only rekonsiliasi dan gerbang go-live Coreisec.
 */
import { AlertTriangle, CheckCircle2, CircleX, RefreshCw } from 'lucide-react'
import { notFound } from 'next/navigation'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'
import { getCoreisecReadiness } from '@/modules/migration/coreisec-readiness.server'

export const dynamic = 'force-dynamic'

export default async function CoreisecMigrationPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const member = await getPortalMemberContext(tenant)
  if (!member?.isAdmin) notFound()
  const report = await getCoreisecReadiness(tenant.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">
            Rekonsiliasi Coreisec
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-emerald-950 sm:text-4xl">
            Gerbang go-live
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Status ini bersifat baca-saja. Portal belum boleh dipindahkan penuh
            selama masih ada pemeriksaan wajib yang gagal.
          </p>
        </div>
        <div
          className={`flex min-h-14 items-center gap-3 rounded-2xl border px-5 py-3 ${
            report.ready
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          }`}
          role="status"
        >
          {report.ready
            ? <CheckCircle2 aria-hidden="true" className="shrink-0" />
            : <AlertTriangle aria-hidden="true" className="shrink-0" />}
          <div>
            <p className="font-bold">
              {report.ready ? 'Siap untuk keputusan cutover' : 'Belum boleh go-live'}
            </p>
            <p className="text-xs opacity-80">
              Diperiksa {new Date(report.generatedAt).toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>

      <section aria-labelledby="check-heading" className="mt-10">
        <div className="flex items-center gap-2">
          <RefreshCw aria-hidden="true" size={20} className="text-emerald-700" />
          <h2 id="check-heading" className="text-xl font-bold text-emerald-950">
            Pemeriksaan wajib
          </h2>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {report.checks.map((check) => (
            <article
              key={check.key}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {check.passed ? (
                  <CheckCircle2
                    aria-label="Lulus"
                    className="mt-0.5 shrink-0 text-emerald-700"
                    size={22}
                  />
                ) : (
                  <CircleX
                    aria-label="Gagal"
                    className="mt-0.5 shrink-0 text-red-700"
                    size={22}
                  />
                )}
                <div>
                  <h3 className="font-bold text-slate-950">{check.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{check.detail}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="entity-heading" className="mt-10">
        <h2 id="entity-heading" className="text-xl font-bold text-emerald-950">
          Rekonsiliasi per jenis data
        </h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead className="bg-emerald-950 text-emerald-50">
              <tr>
                <th className="px-4 py-3 font-semibold">Jenis data</th>
                <th className="px-4 py-3 text-right font-semibold">Sumber</th>
                <th className="px-4 py-3 text-right font-semibold">Mapping</th>
                <th className="px-4 py-3 text-right font-semibold">Target ada</th>
                <th className="px-4 py-3 text-right font-semibold">Hilang</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.entities.map((entity) => (
                <tr key={entity.entityType} className="border-t border-slate-100">
                  <th scope="row" className="px-4 py-3 font-semibold text-slate-800">
                    {entity.entityType}
                  </th>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {entity.expected ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{entity.mapped}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{entity.targetFound}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{entity.missingTarget}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-bold ${
                        entity.passed
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-red-100 text-red-900'
                      }`}
                    >
                      {entity.passed ? 'Cocok' : 'Periksa'}
                    </span>
                  </td>
                </tr>
              ))}
              {report.entities.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Belum ada hasil impor untuk direkonsiliasi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
