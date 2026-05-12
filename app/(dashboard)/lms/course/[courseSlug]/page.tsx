import Link from 'next/link'
import Image from 'next/image'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLmsCourseBySlug, getLmsLessonsByCourseId } from '@/modules/edu/actions/lms-commercial.actions'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import { KelolaMateri } from '../../KelolaMateri'

export default async function LearningCoursePage(props: { params: Promise<{ courseSlug: string }> }) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const params = await props.params
  const course = await getLmsCourseBySlug(orgData.org.id, params.courseSlug)
  if (!course) notFound()

  const lessons = await getLmsLessonsByCourseId(orgData.org.id, course.id)
  const track: any = null // Optional fallback if you want to support track UI later
  
  // Dummy fallbacks for UI styling since we no longer have MVP hardcoded attributes
  const outcomes = ['Peningkatan skill teknis', 'Pemahaman operasional', 'Kesiapan terjun lapangan']
  const assessmentSummary = ['Ujian Pilihan Ganda', 'Ujian Praktik', 'Review Penilai']
  
  const learningAccess = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })
  const canManage = learningAccess.canManage
  const canManageAssessment = learningAccess.canReviewAssessments
  const canAccessParticipantAssessment = hasRolePermission(orgData.role, orgData.permissions, 'learning') || canManageAssessment

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href={track ? `/lms/track/${track.slug}` : '/lms'}
          className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke {track?.title || 'Training Center'}
        </Link>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
              <GraduationCap className="h-3.5 w-3.5" />
              {course.level_code || 'ALL'} • {course.is_active ? 'Live' : 'Soon'}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              {course.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              {course.description || 'Tidak ada deskripsi'}
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-slate-600">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                <Clock className="h-4 w-4" />
                60 menit
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                <BookOpen className="h-4 w-4" />
                {lessons.length} lesson
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
                <ShieldCheck className="h-4 w-4" />
                Internal & External
              </div>
            </div>

            {course.is_active && lessons[0] ? (
              <Link
                href={`/lms/course/${course.slug}/lesson/${lessons[0].slug}`}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
              >
                Mulai Lesson 1
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-500">
                Course ini belum dibuka untuk peserta.
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 flex items-center justify-center">
              <GraduationCap className="w-24 h-24 text-slate-200" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Outcome</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Hasil belajar yang diharapkan</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {outcomes.map((outcome) => (
              <div key={outcome} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                {outcome}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-slate-700" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Assessment</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Ringkasan penilaian</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            {assessmentSummary.map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                {item}
              </div>
            ))}
          </div>
          {course.is_active ? (
            <div className="mt-5 space-y-3">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Masuk Sebagai</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {canAccessParticipantAssessment ? (
                  <Link
                    href={`/lms/course/${course.slug}/assessment/participant`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="font-black text-slate-900">Peserta</div>
                    <p className="mt-2 leading-6 text-slate-600">
                      Isi jawaban teori, bukti praktik, dan lihat riwayat review pribadi.
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 font-black text-emerald-700">
                      Buka Halaman Peserta
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                ) : null}

                {canManageAssessment ? (
                  <Link
                    href={`/lms/course/${course.slug}/assessment`}
                    className="rounded-xl border border-slate-900 bg-slate-900 p-4 text-sm text-white shadow-lg shadow-slate-200 transition hover:bg-black"
                  >
                    <div className="font-black">Penilai</div>
                    <p className="mt-2 leading-6 text-slate-200">
                      Review submission peserta, isi keputusan akhir, dan pantau status kelulusan per entitas.
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 font-black text-white">
                      Buka Panel Penilai
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Lesson Plan</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Urutan lesson di course ini</h2>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            {lessons.length} lesson
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {lessons.length === 0 ? (
             <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-500">
               Belum ada lesson yang diunggah ke course ini.
             </div>
          ) : lessons.map((lesson: any, idx: number) => (
            <div key={lesson.slug} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-900 shadow-sm">
                    {lesson.sort_order || idx + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{lesson.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{lesson.summary || 'Tidak ada ringkasan'}</p>
                    <div className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      15 menit
                    </div>
                  </div>
                </div>
                <Link
                  href={`/lms/course/${course.slug}/lesson/${lesson.slug}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-emerald-700 shadow-sm ring-1 ring-slate-200 transition hover:text-emerald-800"
                >
                  Buka Lesson
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Lesson Management (Admin only) ── */}
      {canManage && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <KelolaMateri courseSlug={course.slug} courseId={course.id} lessons={lessons} />
        </section>
      )}
    </div>
  )
}
