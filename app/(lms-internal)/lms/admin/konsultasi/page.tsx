/**
 * Pusat operasional Consulting 360 untuk admin, manager, dan owner.
 */
import { redirect } from 'next/navigation'
import { CalendarClock, Gauge, UsersRound } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getConsultingAdminOverview } from '@/modules/consulting/lib/consulting.server'
import ConsultingOperationsClient from './ConsultingOperationsClient'

export const metadata = {
  title: 'Operasional Consulting 360 — Nizam LMS',
}

export default async function ConsultingOperationsPage() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) redirect('/login')
  if (!['owner', 'admin', 'manager'].includes(String(orgData.role || '').toLowerCase())) {
    redirect('/lms')
  }
  const overview = await getConsultingAdminOverview(orgData.org.id)
  const active = overview.engagements.filter((engagement) => (
    ['ACTIVE', 'IN_PROGRESS', 'COMPLETION_PENDING'].includes(engagement.status)
  ))
  const utilization = overview.consultants.length > 0
    ? Math.round(active.length / overview.consultants.length * 100) / 100
    : 0

  return (
    <div className="space-y-7">
      <header className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white">
        <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          <CalendarClock aria-hidden="true" size={16} />
          Operasional LMS
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Consulting 360</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
          Kalender konsultan, kehadiran, ringkasan member, rencana tindakan,
          persetujuan akhir, dan lencana berada dalam satu panel.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Engagement aktif', value: active.length, icon: UsersRound },
          { label: 'Paket tersedia', value: overview.offerings.length, icon: CalendarClock },
          { label: 'Member/konsultan', value: utilization, icon: Gauge },
        ].map((metric) => (
          <section key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <metric.icon aria-hidden="true" size={20} className="text-teal-700" />
            <div className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{metric.label}</div>
            <div className="mt-1 font-mono text-2xl font-black text-slate-950">{metric.value}</div>
          </section>
        ))}
      </div>

      <ConsultingOperationsClient
        orgSlug={orgData.org.slug}
        engagements={overview.engagements}
        showRefundTools
        canFinalizeRefunds={['owner', 'admin'].includes(String(orgData.role || '').toLowerCase())}
      />
    </div>
  )
}
