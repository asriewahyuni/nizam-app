import Link from 'next/link'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLmsCourses, getLmsBatches } from '@/modules/edu/actions/lms-commercial.actions'
import { StatusBadge, formatIDR, modeColor, statusColor } from './ui'

export const metadata = {
  title: 'Dashboard Operasional — Nizam LMS',
  description: 'Pantau KPI program, pendaftaran terbuka, dan performa pelatihan Nizam LMS terintegrasi ERP.',
}

export default async function LmsDashboardPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return null

  const courses = await getLmsCourses(orgData.org.id)
  const batches = await getLmsBatches(orgData.org.id)

  const activePrograms = courses.filter((c: any) => c.is_active).length
  const openBatches = batches.filter((b: any) => b.status === 'OPEN')
  const runningBatches = batches.filter((b: any) => b.status === 'ONGOING').length
  const monthlyEnrollees = batches.reduce((a: number, b: any) => a + (Number(b.enrolled_count) || 0), 0)
  const revenue = batches
    .filter((b: any) => b.status !== 'CLOSED')
    .reduce((a: number, b: any) => a + Number(b.price || 0) * (Number(b.enrolled_count) || 0), 0)

  const kpis = [
    {
      label: 'Program Aktif',
      value: activePrograms.toString(),
      hint: '+2 bulan ini',
      hintTone: 'text-emerald-600',
    },
    {
      label: 'Total Peserta',
      value: monthlyEnrollees.toLocaleString('id-ID'),
      hint: 'Sepanjang masa',
      hintTone: 'text-emerald-600',
    },
    {
      label: 'Batch Berjalan',
      value: runningBatches.toString(),
      hint: 'Tersinkron ke ERP',
      hintTone: 'text-slate-400',
    },
    {
      label: 'Estimasi Pendapatan',
      value: `Rp ${(revenue / 1_000_000).toFixed(1)}Jt`,
      hint: 'Journal entries live',
      hintTone: 'text-emerald-600',
    },
  ]

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Nizam ERP · Learning Module
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Dashboard Operasional LMS
          </h1>
          <p className="mt-1 text-slate-500">
            Kelola pelatihan internal dan program sertifikasi komersial.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/lms/admin"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition-all hover:bg-slate-50"
          >
            Manajemen Katalog
          </Link>
          <Link
            href="/lms/admin"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700"
          >
            + Tambah Program Baru
          </Link>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {k.label}
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{k.value}</span>
            </div>
            <div className={'mt-2 text-xs font-medium ' + k.hintTone}>{k.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Pendaftaran Terbuka</h2>
              <p className="text-sm text-slate-500">
                Batch dengan status OPEN yang menerima peserta baru.
              </p>
            </div>
            <Link
              href="/lms/admin"
              className="text-sm font-semibold text-indigo-600 hover:underline"
            >
              Kelola semua &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {openBatches.length === 0 && (
              <div className="p-8 text-center text-slate-500 border border-dashed rounded-2xl">
                Tidak ada batch yang terbuka saat ini.
              </div>
            )}
            {openBatches.map((b: any) => {
              const course = b.learning_courses
              if (!course) return null
              const enrolled = Number(b.enrolled_count) || 0
              const quota = Number(b.quota) || 1
              const pct = Math.round((enrolled / quota) * 100)
              
              return (
                <Link
                  key={b.id}
                  href={`/lms/admin/course/${course.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
                >
                  <div
                    className="hidden size-14 shrink-0 rounded-xl sm:block"
                    style={{
                      background: `linear-gradient(135deg, hsl(231 90% 60%), hsl(240 60% 60%))`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="mt-0.5 truncate font-semibold text-slate-900">
                      {course.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">{b.name}</p>
                  </div>
                  <div className="hidden text-right md:block">
                    <p className="font-mono text-sm font-semibold">
                      {formatIDR(Number(b.price))}
                    </p>
                    <p className="text-[10px] text-slate-400">per peserta</p>
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="mb-1 flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-600">
                        {enrolled}/{quota}
                      </span>
                      <span className="text-slate-400">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-500"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge className={statusColor(b.status)}>
                      {b.status}
                    </StatusBadge>
                    <StatusBadge className={modeColor(b.mode)}>
                      {b.mode}
                    </StatusBadge>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="relative overflow-hidden rounded-2xl bg-emerald-900 p-6 text-white shadow-lg">
            <div className="relative z-10">
              <h3 className="text-lg font-bold">ERP Bridge Status</h3>
              <p className="mt-2 mb-4 text-sm text-emerald-100/70">
                Setiap registrasi berbayar otomatis mencatat jurnal ke Buku Besar
                ERP secara realtime.
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between border-b border-white/10 py-2 text-xs">
                  <span className="opacity-70">Pending Journal Items</span>
                  <span className="font-mono">0 Entries</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 py-2 text-xs">
                  <span className="opacity-70">Last Sync</span>
                  <span className="font-mono">2 mins ago</span>
                </div>
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="opacity-70">Cash Transactions Today</span>
                  <span className="font-mono">0</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 size-32 rounded-full bg-white/5 blur-2xl" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-bold">Registrasi Terbaru</h3>
            <div className="space-y-4">
              <div className="text-xs text-slate-500 italic text-center py-4">Belum ada registrasi baru</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
