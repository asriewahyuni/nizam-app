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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="overflow-hidden rounded-3xl bg-emerald-950 text-white shadow-sm">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.45fr_0.55fr] lg:p-10">
          <div>
            <div className="mb-5 inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-800/60 px-3 text-sm font-semibold text-emerald-50">
              <ShieldCheck aria-hidden="true" size={17} />
              Akun dan akses Anda terverifikasi
            </div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
              Selamat datang, {member.displayName}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-100/85">
              Lanjutkan kelas, cek jadwal, pantau transaksi, dan unduh sertifikat dari satu tempat.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`${basePath}/kelas`}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 font-semibold text-white transition-colors duration-200 hover:bg-orange-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 motion-reduce:transition-none"
              >
                Lanjutkan belajar
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link
                href={`${basePath}/katalog`}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-emerald-200/30 bg-white/10 px-5 font-semibold text-white transition-colors duration-200 hover:bg-white/15 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 motion-reduce:transition-none"
              >
                Lihat katalog
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-end">
            {summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <span className={`flex size-10 items-center justify-center rounded-xl ${card.tone}`}>
                    <Icon aria-hidden="true" size={20} />
                  </span>
                  <p className="mt-4 text-2xl font-bold">{card.value}</p>
                  <p className="mt-1 text-sm text-emerald-100/80">{card.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="kelas-aktif-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Perjalanan belajar</p>
              <h2 id="kelas-aktif-title" className="mt-1 text-2xl font-bold tracking-tight">Kelas aktif</h2>
            </div>
            <Link
              href={`${basePath}/kelas`}
              className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
            >
              Semua kelas
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>

          {dashboard.courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-300 bg-white p-8 text-center">
              <BookOpenCheck aria-hidden="true" className="mx-auto text-emerald-700" size={38} />
              <h3 className="mt-4 font-semibold">Belum ada kelas aktif</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                Kelas yang dibeli, diberikan admin, atau termasuk paket membership akan tampil di sini.
              </p>
              <Link
                href={`${basePath}/katalog`}
                className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-emerald-700 px-5 font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
              >
                Jelajahi katalog
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {dashboard.courses.map((course) => (
                <article key={course.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                      <BookOpenCheck aria-hidden="true" size={21} />
                    </span>
                    {course.expiresAt && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                        Akses terbatas
                      </span>
                    )}
                  </div>
                  <h3 className="mt-5 line-clamp-2 text-lg font-bold">{course.title}</h3>
                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="font-medium text-slate-600">
                        {course.completedLessons}/{course.totalLessons} materi
                      </span>
                      <span className="font-bold text-emerald-800">
                        {Math.round(course.progressPercent)}%
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-slate-100"
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
                    className="mt-5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 font-semibold text-emerald-800 transition-colors duration-200 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                  >
                    Buka kelas
                    <ArrowRight aria-hidden="true" size={17} />
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
