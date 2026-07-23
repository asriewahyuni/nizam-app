import React from 'react'
import Link from 'next/link'
import { getLMSCourseDetails } from '@/modules/lms/actions/course.actions'
import { Book, Play, CheckCircle, ArrowLeft, Eye, LockKeyhole } from 'lucide-react'
import BatchSelector from './BatchSelector'

export default async function LMSCourseDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; courseSlug: string }>
}) {
  const { orgSlug, courseSlug } = await params;
  const result = await getLMSCourseDetails(orgSlug, courseSlug)

  if (result.error || !result.data) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-500 font-semibold">{result.error || 'Kursus tidak ditemukan'}</p>
        <Link href={`/lms/${orgSlug}`} className="mt-4 inline-block text-indigo-600 hover:underline">
          Kembali ke Katalog
        </Link>
      </div>
    )
  }

  const { course, lessons, batches, access } = result.data
  const firstAccessibleLesson = lessons.find((lesson) => access.allowed || lesson.is_preview)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link href={`/lms/${orgSlug}`} className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-indigo-600 mb-8 transition-colors">
        <ArrowLeft size={16} className="mr-2" /> Kembali ke Katalog
      </Link>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-10">
        <div className="p-10 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-widest rounded-md">
              {course.level_code || 'ALL LEVEL'}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">{course.title}</h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-3xl mb-8">
            {course.description || 'Tidak ada deskripsi kursus.'}
          </p>
          
          <div className="mt-8">
            {access.allowed ? (
              firstAccessibleLesson ? (
                <Link
                  href={`/lms/${orgSlug}/learn/${courseSlug}/${firstAccessibleLesson.slug}`}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-emerald-700 px-5 font-semibold text-white transition-colors duration-200 hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                >
                  <Play aria-hidden="true" size={18} />
                  Mulai atau lanjutkan belajar
                </Link>
              ) : null
            ) : (
              <>
                <h3 className="mb-4 text-lg font-bold text-slate-900">Pilih Angkatan</h3>
                <BatchSelector
                  orgSlug={orgSlug}
                  courseSlug={courseSlug}
                  batches={batches || []}
                />
              </>
            )}
          </div>
        </div>
        
        <div className="p-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Materi Kursus</h2>
            <div className="text-sm font-semibold text-slate-500">
              {lessons.length} Modul
            </div>
          </div>

          {lessons.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100">
              <Book size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Belum ada materi untuk kursus ini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lessons.map((lesson, index) => {
                const canOpen = access.allowed || lesson.is_preview
                const content = (
                  <>
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold mr-4 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-900">{lesson.title}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">
                      {lesson.lesson_type}
                    </p>
                  </div>
                  {lesson.is_preview ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <Eye aria-hidden="true" size={16} />
                      Preview
                    </span>
                  ) : canOpen ? (
                    <Play aria-hidden="true" className="text-emerald-700" size={19} />
                  ) : (
                    <LockKeyhole aria-label="Terkunci" className="text-slate-400" size={18} />
                  )}
                  </>
                )
                return canOpen ? (
                  <Link
                    key={lesson.id}
                    href={`/lms/${orgSlug}/learn/${courseSlug}/${lesson.slug}`}
                    className="group flex min-h-14 cursor-pointer items-center rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:border-emerald-300 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={lesson.id} className="group flex min-h-14 items-center rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    {content}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
