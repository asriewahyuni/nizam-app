import Link from 'next/link'
import Image from 'next/image'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Image as ImageIcon } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getTrainingCourseBySlug,
  getTrainingLessonBySlug,
  getTrainingLessonsForCourse,
} from '@/modules/edu/lib/training-center-mvp'

export default async function LearningLessonPage(props: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>
}) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const params = await props.params
  const course = getTrainingCourseBySlug(params.courseSlug)
  if (!course) notFound()

  const lesson = getTrainingLessonBySlug(course.slug, params.lessonSlug)
  if (!lesson) notFound()

  const lessons = getTrainingLessonsForCourse(course.slug)
  const previousLesson = lessons.find((item) => item.order === lesson.order - 1) || null
  const nextLesson = lessons.find((item) => item.order === lesson.order + 1) || null

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href={`/lms/course/${course.slug}`}
          className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke {course.title}
        </Link>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
              Lesson {lesson.order} dari {lessons.length}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              {lesson.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              {lesson.summary}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600">
            <Clock className="h-4 w-4" />
            Estimasi {lesson.estimatedMinutes} menit
          </div>
        </div>

        {lesson.actionHref ? (
          <div className="mt-5">
            <Link
              href={lesson.actionHref}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
            >
              {lesson.actionLabel || 'Buka Fitur Terkait'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-slate-700" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Visual Acuan</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Lihat layar yang akan dipakai peserta</h2>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={lesson.screenshot}
                alt={lesson.screenshotAlt}
                fill
                className="object-cover object-top"
                sizes="(max-width: 1280px) 100vw, 760px"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Objective</div>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Tujuan lesson ini</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              {lesson.objectives.map((objective) => (
                <div key={objective} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {objective}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Checklist</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Yang harus dipahami peserta</h2>
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              {lesson.checks.map((check) => (
                <div key={check} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {check}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Langkah Kerja</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Urutan yang dilakukan peserta</h2>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {lesson.steps.map((step, index) => (
              <div key={step} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-900 shadow-sm">
                  {index + 1}
                </div>
                <div className="pt-1">{step}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Kesalahan Umum</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Hal yang perlu dihindari</h2>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {lesson.commonMistakes.map((mistake) => (
              <div key={mistake} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                {mistake}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Navigasi Lesson</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Lanjutkan belajar bertahap</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {previousLesson ? (
              <Link
                href={`/lms/course/${course.slug}/lesson/${previousLesson.slug}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Lesson Sebelumnya
              </Link>
            ) : (
              <Link
                href={`/lms/course/${course.slug}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Course
              </Link>
            )}

            {nextLesson ? (
              <Link
                href={`/lms/course/${course.slug}/lesson/${nextLesson.slug}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
              >
                Lesson Berikutnya
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href={`/lms/course/${course.slug}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-black"
              >
                Selesai Belajar
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
