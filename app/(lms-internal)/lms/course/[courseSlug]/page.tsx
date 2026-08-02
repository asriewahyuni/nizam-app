import React from 'react'
import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Book,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Play,
  Settings,
} from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLmsCourseBySlug, getLmsLessonsByCourseId } from '@/modules/edu/actions/lms-commercial.actions'
import { createClient } from '@/lib/supabase/server'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'
import { getLearningAccessContext } from '@/modules/edu/lib/learning-access.server'
import { MotionWrapper } from '../../MotionWrapper'

export default async function LearningCoursePage(props: { params: Promise<{ courseSlug: string }> }) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const params = await props.params
  const course = await getLmsCourseBySlug(orgData.org.id, params.courseSlug)
  if (!course) notFound()

  const lessons = await getLmsLessonsByCourseId(orgData.org.id, course.id)

  const learningAccess = await getLearningAccessContext({
    userRole: orgData.role,
    permissions: orgData.permissions,
    email: orgData.user?.email,
  })
  const canManageAssessment = learningAccess.canReviewAssessments
  const canAccessParticipantAssessment =
    hasRolePermission(orgData.role, orgData.permissions, 'learning') || canManageAssessment

  let progressPercentage = 0
  let completedCount = 0
  if (orgData.user) {
    const supabase = await createClient()
    const { data: enrollment } = await supabase
      .from('learning_enrollments')
      .select('id')
      .eq('course_id', course.id)
      .eq('user_id', orgData.user.id)
      .single()

    if (enrollment && lessons.length > 0) {
      const { count } = await supabase
        .from('learning_lesson_progress')
        .select('*', { count: 'exact', head: true })
        .eq('enrollment_id', enrollment.id)
        .eq('status', 'COMPLETED')

      completedCount = count || 0
      progressPercentage = Math.round((completedCount / lessons.length) * 100)
    }
  }

  const firstLesson = lessons[0]
  const isAdmin = ['owner', 'admin'].includes(orgData.role)

  return (
    <MotionWrapper>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Navigasi Atas */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/lms"
            className="inline-flex cursor-pointer items-center text-xs font-semibold text-slate-500 transition-colors hover:text-indigo-600"
          >
            <ArrowLeft size={14} className="mr-1.5" /> Kembali ke Katalog
          </Link>

          {isAdmin && (
            <Link
              href={`/lms/admin/course/${course.slug}?tab=curriculum`}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-indigo-600"
            >
              <Settings size={14} className="text-slate-400" /> Kelola di Admin LMS
            </Link>
          )}
        </div>

        {/* Kartu Utama Kursus (Selaras dengan Portal Member) */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-700">
                {course.level_code || 'ALL LEVEL'}
              </span>
              <span
                className={`rounded px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                  course.is_active
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {course.is_active ? 'Aktif' : 'Draft'}
              </span>
            </div>

            <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {course.title}
            </h1>
            <p className="mb-6 text-xs leading-relaxed text-slate-600 sm:text-sm">
              {course.description || 'Tidak ada deskripsi kursus.'}
            </p>

            {/* CTA Utama & Progress */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {firstLesson ? (
                <Link
                  href={`/lms/course/${course.slug}/lesson/${firstLesson.slug}`}
                  className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                >
                  <Play aria-hidden="true" size={16} />
                  {progressPercentage > 0 ? 'Lanjutkan belajar' : 'Mulai belajar'}
                </Link>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-500">
                  Materi belum tersedia
                </div>
              )}

              {/* Progress Bar */}
              {lessons.length > 0 && (
                <div className="w-full sm:max-w-xs">
                  <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-600">
                    <span>
                      {completedCount}/{lessons.length} materi selesai
                    </span>
                    <strong className="text-emerald-800">{progressPercentage}%</strong>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, progressPercentage))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assessment & Tugas Shortcut (Jika Punya Akses) */}
          {(canAccessParticipantAssessment || canManageAssessment) && (
            <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Assessment & Penilaian
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {canAccessParticipantAssessment && (
                  <Link
                    href={`/lms/course/${course.slug}/assessment/participant`}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:border-emerald-300 hover:text-emerald-700 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                      <span>Halaman Assessment Peserta</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                )}

                {canManageAssessment && (
                  <Link
                    href={`/lms/course/${course.slug}/assessment`}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-black"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Panel Assessor / Penilai</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Daftar Materi Kursus (Card-Based Minimalism selaras Portal Member) */}
          <div className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Materi Kursus</h2>
              <div className="text-xs font-semibold text-slate-500">
                {lessons.length} Modul
              </div>
            </div>

            {lessons.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 py-8 text-center">
                <Book size={28} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium text-slate-500">
                  Belum ada materi untuk kursus ini.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson: any, index: number) => (
                  <Link
                    key={lesson.id}
                    href={`/lms/course/${course.slug}/lesson/${lesson.slug}`}
                    className="group flex min-h-12 cursor-pointer items-center rounded-xl border border-slate-200 bg-white p-3.5 transition-all duration-200 hover:border-emerald-300 hover:shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                  >
                    <div className="mr-3.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-slate-900">
                        {lesson.title}
                      </h3>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {lesson.lesson_type || 'TEXT'}
                        {lesson.is_preview ? ' • PREVIEW' : ''}
                      </p>
                    </div>
                    {lesson.is_preview ? (
                      <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-700">
                        <Eye aria-hidden="true" size={14} />
                        Preview
                      </span>
                    ) : (
                      <Play aria-hidden="true" className="shrink-0 text-emerald-700" size={16} />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MotionWrapper>
  )
}
