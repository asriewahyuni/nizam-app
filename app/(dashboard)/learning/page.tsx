import Link from 'next/link'
import Image from 'next/image'
import type { ComponentType } from 'react'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'
import type { TrainingBoardData } from '@/lib/edu/training-simulation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { DEFAULT_TRAINING_EVENT_SLUG, getTrainingBoardData } from '@/modules/edu/lib/training.server'
import { buildCompetencyOverview } from '@/modules/edu/lib/competency-dashboard'
import {
  TRAINING_TRACKS,
  getTrainingCenterSummary,
  getTrainingCoursesForTrack,
} from '@/modules/edu/lib/training-center-mvp'

const TRACK_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'onboarding-sop': BookOpen,
  'operasional-harian': ClipboardCheck,
  'leadership-compliance': ShieldCheck,
}

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
  const summary = getTrainingCenterSummary()
  const featuredCourse = summary.featuredCourse
  const liveOnboardingCourses = getTrainingCoursesForTrack('onboarding-sop')

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(135deg,#f0fdf4_0%,#ffffff_45%,#ecfeff_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
              <GraduationCap className="h-3.5 w-3.5" />
              Training Center MVP
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Pusat pelatihan berjenjang NIZAM untuk onboarding, praktik, dan verifikasi kompetensi.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Versi MVP ini memisahkan jalur belajar per track dan per course supaya ringan, mudah dipahami, dan aman untuk dikembangkan bertahap.
              Course pertama yang sudah live adalah <span className="font-black text-slate-900">Level 1 Pengguna Umum NIZAM</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/learning/course/pengguna-umum-nizam"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-black"
            >
              Mulai Level 1
              <ArrowRight className="h-4 w-4" />
            </Link>
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
          label="Track Live"
          value={String(summary.liveTracks)}
          hint="Jumlah jalur pelatihan yang sudah mulai dibuka."
          icon={GraduationCap}
        />
        <StatCard
          label="Course Live"
          value={String(summary.liveCourses)}
          hint="Course yang bisa langsung dipakai peserta saat ini."
          icon={BookOpen}
        />
        <StatCard
          label="Lesson Siap Pakai"
          value={String(summary.liveLessons)}
          hint="Materi lesson yang sudah tersedia di MVP tahap awal."
          icon={ClipboardCheck}
        />
        <StatCard
          label="Tim Aktif EDU"
          value={String(overview.activeTeams)}
          hint="Tim yang sudah mulai mengerjakan praktik atau evaluasi."
          icon={Users}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Learning Tracks</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Jalur pelatihan berjenjang</h2>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
              MVP aman
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {TRAINING_TRACKS.map((track) => {
              const Icon = TRACK_ICONS[track.slug] || BookOpen
              const courses = getTrainingCoursesForTrack(track.slug)
              return (
                <div key={track.slug} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex rounded-2xl bg-white p-3 text-slate-700 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                      track.status === 'LIVE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {track.shortLabel}
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-black text-slate-900">{track.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{track.description}</p>
                  <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    {courses.length} course • {track.audience}
                  </div>
                  <Link
                    href={`/learning/track/${track.slug}`}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-700 hover:text-emerald-800"
                  >
                    Buka Track
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Featured Course</div>
          <h2 className="mt-2 text-xl font-black text-slate-900">Course pertama yang sudah live</h2>
          {featuredCourse ? (
            <div className="mt-5 space-y-4">
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src={featuredCourse.coverImage}
                    alt={featuredCourse.coverAlt}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1280px) 100vw, 420px"
                  />
                </div>
              </div>
              <div>
                <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                  {featuredCourse.levelCode}
                </div>
                <h3 className="mt-3 text-lg font-black text-slate-900">{featuredCourse.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{featuredCourse.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Durasi</div>
                  <div className="mt-2 text-lg font-black text-slate-900">{featuredCourse.estimatedMinutes} menit</div>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Lesson</div>
                  <div className="mt-2 text-lg font-black text-slate-900">{featuredCourse.lessonCount} lesson</div>
                </div>
              </div>
              <Link
                href={`/learning/course/${featuredCourse.slug}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
              >
                Buka Course
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Belum ada course live.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Fokus Tahap Ini</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Yang sudah siap dipakai sekarang</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {liveOnboardingCourses.map((course) => (
              <div key={course.slug} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">{course.levelCode}</div>
                    <h3 className="mt-2 text-base font-black text-slate-900">{course.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{course.description}</p>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                    Live
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                  <span className="rounded-full bg-white px-3 py-1 border border-slate-200">{course.lessonCount} lesson</span>
                  <span className="rounded-full bg-white px-3 py-1 border border-slate-200">{course.estimatedMinutes} menit</span>
                  <span className="rounded-full bg-white px-3 py-1 border border-slate-200">{course.audience}</span>
                </div>
                <Link
                  href={`/learning/course/${course.slug}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-700 hover:text-emerald-800"
                >
                  Mulai belajar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
            <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              Track `Operasional Harian` dan `Leadership & Compliance` disiapkan sebagai tahap berikutnya setelah Level 1 stabil.
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Tahap Kompetensi</div>
          <h2 className="mt-2 text-xl font-black text-slate-900">Progress board praktik per phase</h2>
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
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Langkah Belajar</div>
              <h2 className="mt-2 text-xl font-black text-slate-900">Alur peserta pada MVP ini</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {[
              'Buka Training Center dan pilih track yang sesuai.',
              'Masuk ke course Level 1 Pengguna Umum NIZAM.',
              'Pelajari lesson per lesson dengan screenshot nyata.',
              'Kerjakan checklist dan pahami jalur akses dasar.',
              'Lanjut ke board EDU jika course berikutnya butuh praktik.',
            ].map((item, index) => (
              <div key={item} className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-900 shadow-sm">
                  {index + 1}
                </div>
                <div className="pt-1">{item}</div>
              </div>
            ))}
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

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Status MVP</div>
            <h2 className="mt-1 text-xl font-black text-slate-900">Training Center sudah punya home, track, course, dan lesson pertama</h2>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
          Tahap berikutnya adalah menambahkan progress peserta yang tersimpan, penilaian dasar per enrollment, dan review trainer.
          Untuk menjaga performa, lesson dipisah per URL dan screenshot hanya dimuat pada halaman yang relevan.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Rata-rata Progress"
          value={`${overview.averageCompletion}%`}
          hint="Persentase penyelesaian rata-rata lintas tim di board praktik."
          icon={ClipboardCheck}
        />
        <StatCard
          label="Rata-rata Skor"
          value={overview.maxScore > 0 ? `${overview.averageScore}/${overview.maxScore}` : String(overview.averageScore)}
          hint="Skor rata-rata hasil evaluasi tim saat ini."
          icon={Trophy}
        />
        <StatCard
          label="Pertanyaan Praktik"
          value={String(overview.questionCount)}
          hint="Jumlah skenario yang tersedia di board EDU saat ini."
          icon={BookOpen}
        />
        <StatCard
          label="Tim Terdaftar"
          value={String(overview.totalTeams)}
          hint="Jumlah tim yang sudah masuk ke board kompetensi."
          icon={Users}
        />
      </section>
    </div>
  )
}
