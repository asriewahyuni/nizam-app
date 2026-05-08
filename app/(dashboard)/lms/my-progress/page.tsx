import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  LayoutGrid,
  PlayCircle,
} from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import {
  TRAINING_TRACKS,
  TRAINING_COURSES,
  getTrainingLessonsForCourse,
} from '@/modules/edu/lib/training-center-mvp'

export default async function LearningMyProgressPage() {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const accessContext = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })

  if (!accessContext.canRead && !accessContext.canManage) {
    return redirect('/dashboard')
  }

  const liveCourses = TRAINING_COURSES.filter((c) => c.status === 'LIVE')
  const totalLessons = liveCourses.reduce(
    (acc, c) => acc + getTrainingLessonsForCourse(c.slug).length,
    0,
  )
  const totalMinutes = liveCourses.reduce((acc, c) => acc + c.estimatedMinutes, 0)

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="overflow-hidden rounded-[32px] border border-violet-200 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.12),_transparent_40%),linear-gradient(135deg,#f5f3ff_0%,#ffffff_50%,#eff6ff_100%)] p-6 shadow-sm">
        <Link
          href="/lms"
          className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Training Center
        </Link>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-violet-700">
              <GraduationCap className="h-3.5 w-3.5" />
              Progress Belajar Saya
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Jalur belajar dan progress kamu di Training Center.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Ikuti materi secara urut dari Level 0 ke Level berikutnya. Setiap lesson punya
              checklist yang harus dipahami sebelum lanjut ke course berikutnya.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm font-bold text-slate-600">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
              <BookOpen className="h-4 w-4 text-violet-600" />
              {liveCourses.length} course aktif
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
              <LayoutGrid className="h-4 w-4 text-violet-600" />
              {totalLessons} lesson
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
              <Clock className="h-4 w-4 text-violet-600" />
              {Math.round(totalMinutes / 60)} jam total
            </div>
          </div>
        </div>
      </section>

      {/* ── Panduan Alur ── */}
      <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-amber-100 p-2">
            <PlayCircle className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
              Alur Belajar Yang Direkomendasikan
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Mulai dari <strong>Level 0 · Orientasi Perusahaan</strong> →{' '}
              <strong>Level 1 · Pengguna Umum NIZAM</strong> → lanjut ke course berikutnya.
              Jangan lewati tahap dasar agar pemahaman tetap solid dan trainer bisa memverifikasi.
            </p>
          </div>
        </div>
      </section>

      {/* ── Courses Per Track ── */}
      {TRAINING_TRACKS.map((track) => {
        const trackCourses = TRAINING_COURSES.filter((c) => c.trackSlug === track.slug)

        return (
          <section
            key={track.slug}
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                  {track.shortLabel}
                </div>
                <h2 className="mt-2 text-xl font-black text-slate-900">{track.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{track.description}</p>
              </div>
              <Link
                href={`/lms/track/${track.slug}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300"
              >
                Lihat Track
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {trackCourses.map((course, index) => {
                const lessons = getTrainingLessonsForCourse(course.slug)
                const isLive = course.status === 'LIVE'

                return (
                  <div
                    key={course.slug}
                    className={`rounded-[22px] border p-5 transition ${
                      isLive
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-dashed border-slate-200 bg-slate-50/50 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black shadow-sm ${
                            isLive ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                                isLive
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {isLive ? 'Live' : 'Soon'}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              {course.levelCode}
                            </span>
                          </div>
                          <h3 className="mt-1.5 text-base font-black text-slate-900">
                            {course.title}
                          </h3>
                          <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                            <span>{lessons.length} lesson</span>
                            <span>{course.estimatedMinutes} menit</span>
                            <span>{course.audience}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {isLive ? (
                          <>
                            <Link
                              href={`/lms/course/${course.slug}`}
                              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700"
                            >
                              Mulai Belajar
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                            {lessons[0] ? (
                              <Link
                                href={`/lms/course/${course.slug}/lesson/${lessons[0].slug}`}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-slate-300"
                              >
                                Lesson 1
                              </Link>
                            ) : null}
                          </>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-400">
                            Segera Hadir
                          </div>
                        )}
                      </div>
                    </div>

                    {isLive && lessons.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {lessons.slice(0, 4).map((lesson) => (
                          <Link
                            key={lesson.slug}
                            href={`/lms/course/${course.slug}/lesson/${lesson.slug}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {lesson.title}
                          </Link>
                        ))}
                        {lessons.length > 4 ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500">
                            +{lessons.length - 4} lesson lagi
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* ── Info Cards ── */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <BookOpen className="h-5 w-5 text-violet-600" />
          <h3 className="mt-4 text-base font-black text-slate-900">Belajar Mandiri</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Setiap lesson punya materi, checklist, dan langkah kerja. Bisa dibuka kapan saja dan
            diulang berkali-kali.
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-violet-600" />
          <h3 className="mt-4 text-base font-black text-slate-900">Assessment Peserta</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Setelah selesai course, kerjakan assessment sebagai peserta untuk mendapatkan review
            dari trainer.
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <GraduationCap className="h-5 w-5 text-violet-600" />
          <h3 className="mt-4 text-base font-black text-slate-900">Status Kelulusan</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Trainer memberi status Kompeten atau Perlu Ulang berdasarkan hasil assessment yang
            dikerjakan.
          </p>
        </div>
      </section>
    </div>
  )
}
