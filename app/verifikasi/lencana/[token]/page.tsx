/**
 * Verifikasi publik lencana Consulting 360 tanpa membuka catatan privat.
 */
import { notFound } from 'next/navigation'
import { BadgeCheck, CalendarDays, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { getPublicBadgeVerification } from '@/modules/consulting/lib/consulting.server'
import BadgeVerificationClient from './BadgeVerificationClient'

export const metadata = {
  title: 'Verifikasi Lencana Consulting 360',
}

export default async function PublicBadgeVerificationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const badge = await getPublicBadgeVerification(token)
  if (!badge) notFound()
  const active = badge.status === 'ACTIVE'

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
        <header
          className="p-6 text-white sm:p-8"
          style={{
            background: `linear-gradient(135deg, ${badge.primaryColor}, #0f172a)`,
          }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/75">
                <ShieldCheck aria-hidden="true" size={16} />
                Verifikasi resmi Nizam
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight">{badge.badgeTitle}</h1>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed text-white/80">
                {badge.badgeDescription}
              </p>
            </div>
            <BadgeVerificationClient token={token} />
          </div>
        </header>

        <div className="p-6 sm:p-8">
          <div className={`flex items-center gap-3 rounded-2xl border p-4 ${
            active
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}>
            <BadgeCheck aria-hidden="true" size={24} />
            <div>
              <div className="font-black">
                {active ? 'Lencana aktif dan valid' : 'Lencana telah dicabut'}
              </div>
              <div className="mt-0.5 text-sm font-semibold">
                Nomor {badge.badgeNumber}
              </div>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <dt className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <UserRoundCheck aria-hidden="true" size={17} />
                Pemilik
              </dt>
              <dd className="mt-2 text-lg font-black">{badge.holderName}</dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <dt className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <BadgeCheck aria-hidden="true" size={17} />
                Program
              </dt>
              <dd className="mt-2 text-lg font-black">{badge.programName}</dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <dt className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <UserRoundCheck aria-hidden="true" size={17} />
                Konsultan
              </dt>
              <dd className="mt-2 text-lg font-black">{badge.consultantName}</dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <dt className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <CalendarDays aria-hidden="true" size={17} />
                Tanggal terbit
              </dt>
              <dd className="mt-2 text-lg font-black">
                {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(badge.awardedAt))}
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-center text-xs font-semibold leading-relaxed text-slate-500">
            Halaman publik ini hanya menampilkan bukti lencana. Tujuan, catatan,
            ringkasan, dan rencana tindakan konsultasi tetap privat.
          </p>
        </div>
      </div>
    </main>
  )
}
