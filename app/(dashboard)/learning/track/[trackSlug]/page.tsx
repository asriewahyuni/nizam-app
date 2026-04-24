import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, ClipboardCheck, GraduationCap, ShieldCheck } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getTrainingCoursesForTrack,
  getTrainingTrackBySlug,
} from '@/modules/edu/lib/training-center-mvp'

const TRACK_ICONS = {
  'onboarding-sop': BookOpen,
  'operasional-harian': ClipboardCheck,
  'leadership-compliance': ShieldCheck,
} as const

export default async function LearningTrackPage(props: { params: Promise<{ trackSlug: string }> }) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const params = await props.params
  const track = getTrainingTrackBySlug(params.trackSlug)
  if (!track) notFound()

  const courses = getTrainingCoursesForTrack(track.slug)
  const Icon = TRACK_ICONS[track.slug as keyof typeof TRACK_ICONS] || GraduationCap

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href="/learning"
          className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Training Center
        </Link>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
              <Icon className="h-3.5 w-3.5" />
              {track.shortLabel}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              {track.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              {track.description}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Audience</div>
            <div className="mt-2 font-bold text-slate-900">{track.audience}</div>
            <div className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Course</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{courses.length}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {courses.map((course) => (
          <div key={course.slug} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                  {course.levelCode}
                </div>
                <h2 className="mt-3 text-xl font-black text-slate-900">{course.title}</h2>
              </div>
              <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                course.status === 'LIVE'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {course.status === 'LIVE' ? 'Live' : 'Soon'}
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">{course.description}</p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{course.lessonCount} lesson</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{course.estimatedMinutes} menit</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{course.audience}</span>
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-600">
              {course.outcomes.slice(0, 2).map((outcome) => (
                <div key={outcome} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                  {outcome}
                </div>
              ))}
            </div>

            {course.status === 'LIVE' ? (
              <Link
                href={`/learning/course/${course.slug}`}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
              >
                Buka Course
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-500">
                Course ini disiapkan untuk fase berikutnya.
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
