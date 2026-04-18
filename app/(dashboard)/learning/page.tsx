import Link from 'next/link'
import type { ComponentType } from 'react'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import type { TrainingBoardData } from '@/lib/edu/training-simulation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { DEFAULT_TRAINING_EVENT_SLUG, getTrainingBoardData } from '@/modules/edu/lib/training.server'
import { buildCompetencyOverview } from '@/modules/edu/lib/competency-dashboard'

const LEARNING_TRACKS = [
  {
    title: 'Onboarding & SOP',
    description: 'Materi pengenalan perusahaan, aturan kerja, dan SOP inti untuk anggota baru.',
    icon: BookOpen,
  },
  {
    title: 'Operasional Harian',
    description: 'Latihan transaksi harian seperti purchasing, inventory, sales, dan approval kerja.',
    icon: ClipboardCheck,
  },
  {
    title: 'Leadership & Compliance',
    description: 'Penguatan kompetensi supervisor, disiplin proses, dan audit kepatuhan internal.',
    icon: ShieldCheck,
  },
]

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</div>
          <p className="mt-2 text-sm text-slate-600">{hint}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export default async function LearningPage() {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  let board: TrainingBoardData | null = null
  let boardError: string | null = null

  try {
    board = await getTrainingBoardData(DEFAULT_TRAINING_EVENT_SLUG)
  } catch (error: unknown) {
    boardError = error instanceof Error
      ? error.message
      : 'Board training belum bisa dimuat.'
  }

  const overview = buildCompetencyOverview(board)

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(135deg,#f0fdf4_0%,#ffffff_45%,#ecfeff_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
              <GraduationCap className="h-3.5 w-3.5" />
              Peningkatan Kompetensi
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Modul belajar yang berdiri sendiri, aman, dan siap dipakai tanpa mengganggu sistem HRIS yang berjalan.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Halaman ini menjadi pintu masuk kompetensi karyawan: pelatihan, evaluasi, progres tim, dan jalur pengembangan.
              Fondasinya memanfaatkan modul training yang sudah ada, tetapi tetap dipisahkan dari flow operasional lain.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/edu"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
            >
              Buka Board Training
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/settings/roles"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              Atur Akses Learning
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tim Terdaftar"
          value={String(overview.totalTeams)}
          hint="Jumlah tim yang sudah masuk ke board kompetensi."
          icon={Users}
        />
        <StatCard
          label="Tim Aktif"
          value={String(overview.activeTeams)}
          hint="Tim yang sudah mulai mengerjakan simulasi atau evaluasi."
          icon={Target}
        />
        <StatCard
          label="Rata-rata Progress"
          value={`${overview.averageCompletion}%`}
          hint="Persentase penyelesaian rata-rata lintas tim."
          icon={ClipboardCheck}
        />
        <StatCard
          label="Rata-rata Skor"
          value={overview.maxScore > 0 ? `${overview.averageScore}/${overview.maxScore}` : String(overview.averageScore)}
          hint="Skor rata-rata hasil evaluasi tim saat ini."
          icon={Trophy}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Learning Tracks</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Rancangan jalur kompetensi</h2>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
              MVP aman
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {LEARNING_TRACKS.map((track) => {
              const Icon = track.icon
              return (
                <div key={track.title} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="inline-flex rounded-2xl bg-white p-3 text-slate-700 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-slate-900">{track.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{track.description}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Tahap Kompetensi</div>
          <h2 className="mt-2 text-xl font-black text-slate-900">Progress per phase</h2>
          <div className="mt-5 space-y-4">
            {overview.phaseSummaries.map((phase) => (
              <div key={phase.key} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{phase.label}</h3>
                    <p className="mt-1 text-sm text-slate-600">{phase.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-900">{phase.completionPercent}%</div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {phase.questionCount} task
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.max(6, phase.completionPercent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Quick Wins</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Implementasi aman tanpa ganggu modul lama</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              Modul kompetensi dipisah sebagai route baru, jadi flow HRIS, payroll, attendance, dan reimburse tetap aman.
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              Permission learning dibuat terpisah, sehingga owner/admin bisa buka langsung dan role lain bisa diaktifkan bertahap.
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              Board training existing tetap dipakai sebagai fondasi evaluasi, jadi kita tidak duplikasi logika yang sudah berjalan.
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Leaderboard</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Tim dengan progres terbaik</h2>
            </div>
            <Link href="/edu" className="text-sm font-black text-emerald-700 hover:text-emerald-800">
              Lihat semua
            </Link>
          </div>

          {boardError ? (
            <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {boardError}
            </div>
          ) : overview.topTeams.length === 0 ? (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Belum ada tim pada board training. Kamu bisa mulai dari tombol <span className="font-black text-slate-900">Buka Board Training</span>.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {overview.topTeams.map((team, index) => (
                <div key={team.id} className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-900 shadow-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">{team.name}</div>
                      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {team.verifiedTasks} task verified • {team.timeMinutes} menit
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-900">{team.totalScore}</div>
                    <div className="text-xs text-slate-500">{team.completionPercent}% selesai</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
