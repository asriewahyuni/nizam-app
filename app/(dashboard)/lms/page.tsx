import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Layers,
  Settings,
  Users,
  Wallet,
  Building2,
  TrendingUp,
} from 'lucide-react'
import { getLmsCourses, getLmsBatches } from '@/modules/edu/actions/lms-commercial.actions'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import { formatRupiah } from '@/lib/utils'
import { getModuleInstanceStatus } from '@/modules/marketplace/actions/marketplace.actions'
import { TambahProgramButton } from './TambahProgramButton'

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
}: {
  label: string
  value: string | number
  hint: string
  icon: any
  trend?: string
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden group">
      <div className="absolute right-0 top-0 -mr-4 -mt-4 opacity-5 transition-transform group-hover:scale-110">
        <Icon size={100} />
      </div>
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Icon size={20} />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <div className="text-3xl font-black tracking-tight text-slate-900">{value}</div>
          {trend && <div className="text-xs font-bold text-emerald-600 flex items-center"><TrendingUp size={14} className="mr-1"/>{trend}</div>}
        </div>
        <p className="mt-2 text-sm text-slate-500 font-medium">{hint}</p>
      </div>
    </div>
  )
}

export default async function LMSDashboardPage(props: {
  searchParams: Promise<{
    error?: string
  }>
}) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  // ── Module Onboarding Guard ──
  // Jika modul LMS belum di-setup, arahkan ke halaman onboarding
  const moduleInstance = await getModuleInstanceStatus(orgData.org.id, 'LMS')
  if (!moduleInstance || moduleInstance.status !== 'READY') {
    return redirect('/lms/onboarding')
  }

  const accessContext = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })

  if (!accessContext.canManage) {
    return redirect('/dashboard')
  }

  const [courses, batches] = await Promise.all([
    getLmsCourses(orgData.org.id),
    getLmsBatches(orgData.org.id),
  ])

  const activeCourses = courses.filter((c: any) => c.is_active)
  const openBatches = batches.filter((b: any) => b.status === 'OPEN')

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
            <Building2 className="h-3.5 w-3.5" />
            LMS Commercial Operations
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <GraduationCap size={32} className="text-blue-600" />
             Dashboard Operasional LMS
          </h1>
          <p className="text-sm text-slate-500 font-medium">Pantau program pelatihan, jadwal batch, dan pendapatan registrasi.</p>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <TambahProgramButton />
          <Link
            href="/lms/admin"
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Settings size={18} /> Manajemen Katalog & Batch
          </Link>
        </div>
      </div>

      {/* ── KPI Stats ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Program"
          value={activeCourses.length}
          hint="Program aktif di katalog"
          icon={BookOpen}
        />
        <StatCard
          label="Batch Berjalan"
          value={openBatches.length}
          hint="Batch registrasi dibuka"
          icon={CalendarDays}
        />
        <StatCard
          label="Total Peserta"
          value={0}
          hint="Peserta mendaftar bulan ini"
          icon={Users}
        />
        <StatCard
          label="Pendapatan (Estimasi)"
          value="Rp 0"
          hint="Dari registrasi berbayar"
          icon={Wallet}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* ── Batch yang Sedang Buka ── */}
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Pendaftaran Terbuka
              </div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Batch Berjalan (Open)</h2>
            </div>
            <Link
              href="/lms/admin"
              className="text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              Lihat Semua
            </Link>
          </div>

          <div className="space-y-4">
            {openBatches.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 italic">
                Belum ada batch yang dibuka pendaftarannya.
              </div>
            ) : (
              openBatches.map((b: any) => (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-100 hover:border-blue-100 bg-slate-50 hover:bg-blue-50/30 transition-colors group">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm group-hover:text-blue-500 group-hover:border-blue-200 transition-colors">
                      <Layers size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-blue-700 transition-colors">{b.name}</h3>
                      <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{b.learning_courses?.title || 'Program'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Harga</div>
                      <div className="font-bold text-slate-700 mt-0.5">{b.price === 0 ? 'GRATIS' : formatRupiah(b.price)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kuota</div>
                      <div className="font-bold text-slate-700 mt-0.5">{b.quota === 0 ? 'Unlimited' : b.quota}</div>
                    </div>
                    <Link
                      href={`/lms/admin`}
                      className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                    >
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Quick Overview: Program Aktif ── */}
        <section className="rounded-[28px] border border-slate-200 bg-slate-900 p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-20 -mt-20" />
          
          <div className="relative">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-400">
              Katalog
            </div>
            <h2 className="mt-2 text-xl font-black text-white">Program Tersedia</h2>
            
            <div className="mt-6 space-y-3">
              {activeCourses.slice(0, 4).map((c: any) => (
                <div key={c.slug} className="flex items-center gap-3 p-4 rounded-2xl bg-white/10 hover:bg-white/15 transition-colors border border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-300">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{c.title}</h3>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Level: {c.level_code || 'ALL'}</div>
                  </div>
                </div>
              ))}

              {activeCourses.length === 0 && (
                <div className="p-6 text-center border border-dashed border-slate-700 rounded-2xl space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                    <GraduationCap size={22} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400">Belum ada program</p>
                    <p className="text-xs text-slate-600 mt-1">Klik &ldquo;Tambah Program&rdquo; untuk mulai.</p>
                  </div>
                </div>
              )}
            </div>

            {activeCourses.length > 4 && (
              <Link href="/lms/admin" className="mt-4 block text-center text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">
                Lihat Semua Program ({activeCourses.length})
              </Link>
            )}
          </div>
        </section>
      </div>

    </div>
  )
}
