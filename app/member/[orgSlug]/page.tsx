import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  ShieldCheck,
} from 'lucide-react'
import {
  getPortalDashboard,
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'

export default async function MemberDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const tenant = await getPortalTenant(orgSlug)
  if (!tenant) notFound()
  const requestHeaders = await headers()
  const host = String(requestHeaders.get('host') || '').toLowerCase().split(':')[0]
  const basePath = tenant.primaryHostname && host === tenant.primaryHostname.toLowerCase()
    ? ''
    : `/member/${tenant.slug}`
  const member = await getPortalMemberContext(tenant)
  if (!member) {
    redirect(`/login?callbackUrl=${encodeURIComponent(basePath || '/')}`)
  }

  const dashboard = await getPortalDashboard(tenant, member)
  const summaryCards = [
    {
      label: 'Kelas aktif',
      value: dashboard.activeCourseCount,
      icon: BookOpenCheck,
      tone: 'bg-emerald-100 text-emerald-800',
    },
    {
      label: 'Kelas selesai',
      value: dashboard.completedCourseCount,
      icon: CheckCircle2,
      tone: 'bg-teal-100 text-teal-800',
    },
    {
      label: 'Sertifikat',
      value: dashboard.certificateCount,
      icon: Award,
      tone: 'bg-amber-100 text-amber-900',
    },
    {
      label: 'Pesanan',
      value: dashboard.orderCount,
      icon: CreditCard,
      tone: 'bg-orange-100 text-orange-900',
    },
  ]

  return (
    <div className="px-4 py-6 space-y-6">
      <section className="overflow-hidden rounded-3xl bg-emerald-950 text-white shadow-sm">
        <div className="flex flex-col gap-6 p-5">
          <div>
            <div className="mb-4 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-800/60 px-3 text-xs font-semibold text-emerald-50">
              <ShieldCheck aria-hidden="true" size={15} />
              Akun dan akses Anda terverifikasi
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Selamat datang, {member.displayName}
            </h1>
            <p className="mt-3 text-sm leading-6 text-emerald-100/85">
              Lanjutkan kelas, cek jadwal, pantau transaksi, dan unduh sertifikat dari satu tempat.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href={`${basePath}/kelas`}
                className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-orange-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 motion-reduce:transition-none"
              >
                Lanjutkan belajar
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <Link
                href={`${basePath}/katalog`}
                className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-emerald-200/30 bg-white/10 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/15 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 motion-reduce:transition-none"
              >
                Lihat katalog
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur">
                  <span className={`flex size-9 items-center justify-center rounded-xl ${card.tone}`}>
                    <Icon aria-hidden="true" size={18} />
                  </span>
                  <p className="mt-3 text-xl font-bold">{card.value}</p>
                  <p className="mt-0.5 text-xs text-emerald-100/80">{card.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <section aria-labelledby="kelas-aktif-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-emerald-700">Perjalanan belajar</p>
              <h2 id="kelas-aktif-title" className="mt-0.5 text-xl font-bold tracking-tight">Kelas aktif</h2>
            </div>
            <Link
              href={`${basePath}/kelas`}
              className="flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
            >
              Semua kelas
              <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>

          {dashboard.courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-300 bg-white p-6 text-center">
              <BookOpenCheck aria-hidden="true" className="mx-auto text-emerald-700" size={32} />
              <h3 className="mt-3 text-sm font-semibold">Belum ada kelas aktif</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-slate-600">
                Kelas yang dibeli, diberikan admin, atau termasuk paket membership akan tampil di sini.
              </p>
              <Link
                href={`${basePath}/katalog`}
                className="mt-4 inline-flex min-h-10 cursor-pointer items-center rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
              >
                Jelajahi katalog
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {dashboard.courses.map((course) => (
                <article key={course.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                      <BookOpenCheck aria-hidden="true" size={19} />
                    </span>
                    {course.expiresAt && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900">
                        Akses terbatas
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 line-clamp-2 text-base font-bold">{course.title}</h3>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="font-medium text-slate-600">
                        {course.completedLessons}/{course.totalLessons} materi
                      </span>
                      <span className="font-bold text-emerald-800">
                        {Math.round(course.progressPercent)}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label={`Progres ${course.title}`}
                      aria-valuenow={Math.round(course.progressPercent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${Math.max(0, Math.min(100, course.progressPercent))}%` }}
                      />
                    </div>
                  </div>
                  <Link
                    href={`/lms/${tenant.slug}/course/${course.slug}`}
                    className="mt-4 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-800 transition-colors duration-200 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                  >
                    Buka kelas
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside aria-labelledby="jadwal-title">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-orange-100 text-orange-800">
                <CalendarClock aria-hidden="true" size={21} />
              </span>
              <div>
                <p className="text-sm font-semibold text-orange-700">Jangan terlewat</p>
                <h2 id="jadwal-title" className="font-bold">Jadwal berikutnya</h2>
              </div>
            </div>
            {dashboard.nextSessions.length === 0 ? (
              <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Belum ada sesi yang dijadwalkan.
              </p>
            ) : (
              <ol className="mt-5 space-y-4">
                {dashboard.nextSessions.map((session) => (
                  <li key={session.id} className="border-l-2 border-emerald-200 pl-4">
                    <p className="font-semibold">{session.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{session.courseTitle}</p>
                    <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-800">
                      <Clock3 aria-hidden="true" size={15} />
                      {new Intl.DateTimeFormat('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Jakarta',
                      }).format(new Date(session.startsAt))}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
