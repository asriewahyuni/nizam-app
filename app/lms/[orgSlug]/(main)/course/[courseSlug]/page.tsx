import React from 'react'
import Link from 'next/link'
import { getLMSCourseDetails } from '@/modules/lms/actions/course.actions'
import { Book, Play, ArrowLeft, Eye, LockKeyhole } from 'lucide-react'
import BatchSelector from './BatchSelector'
import CourseDescriptionViewer from './CourseDescriptionViewer'

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
    <div className="px-4 py-6">
      <Link href={`/lms/${orgSlug}`} className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-5 transition-colors">
        <ArrowLeft size={14} className="mr-1.5" /> Kembali ke Katalog
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest rounded">
              {course.level_code || 'ALL LEVEL'}
            </span>
            {access.isStaffOverride && (course.is_active === false || course.status === 'DRAFT') && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold uppercase tracking-wider rounded">
                Draft (Admin Preview)
              </span>
            )}
          </div>
          <CourseDescriptionViewer description={course.description} />
          
          <div>
            {access.allowed ? (
              firstAccessibleLesson ? (
                <Link
                  href={`/lms/${orgSlug}/learn/${courseSlug}/${firstAccessibleLesson.slug}`}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white transition-colors duration-200 hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                >
                  <Play aria-hidden="true" size={16} />
                  Mulai atau lanjutkan belajar
                </Link>
              ) : null
            ) : (
              <>
                <h3 className="mb-3 text-sm font-bold text-slate-900">Pilih Angkatan</h3>
                <BatchSelector
                  orgSlug={orgSlug}
                  courseSlug={courseSlug}
                  batches={batches || []}
                />
              </>
            )}
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900">Materi Kursus</h2>
            <div className="text-xs font-semibold text-slate-500">
              {lessons.length} Modul
            </div>
          </div>

          {lessons.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100">
              <Book size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-500 font-medium">Belum ada materi untuk kursus ini.</p>
            </div>
           ) : (
             <div className="space-y-5">
               {lessons.reduce<Array<{ sectionId: string; title: string; lessons: typeof lessons }>>((groups, lesson) => {
                 const sectionId = lesson.section_id || 'UNASSIGNED'
                 const title = lesson.section_title || 'Materi lainnya'
                 const group = groups.find((item) => item.sectionId === sectionId)
                 if (group) group.lessons.push(lesson)
                 else groups.push({ sectionId, title, lessons: [lesson] })
                 return groups
               }, []).map((group) => (
                 <section key={group.sectionId} aria-labelledby={`section-${group.sectionId}`}>
                   <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                     <h3 id={`section-${group.sectionId}`} className="text-xs font-bold uppercase tracking-wider text-slate-700">{group.title}</h3>
                     <span className="text-[10px] font-semibold text-slate-500">{group.lessons.length} materi</span>
                   </div>
                   <div className="space-y-3">
                     {group.lessons.map((lesson) => {
                 const canOpen = access.allowed || lesson.is_preview
                 const lessonNumber = lessons.indexOf(lesson) + 1

                const content = (
                  <>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold mr-3 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors shrink-0">
                     {lessonNumber}

                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{lesson.title}</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                      {lesson.lesson_type}
                    </p>
                  </div>
                  {lesson.is_preview ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 shrink-0">
                      <Eye aria-hidden="true" size={14} />
                      Preview
                    </span>
                  ) : canOpen ? (
                    <Play aria-hidden="true" className="text-emerald-700 shrink-0" size={16} />
                  ) : (
                    <LockKeyhole aria-label="Terkunci" className="text-slate-400 shrink-0" size={15} />
                  )}
                  </>
                )
                return canOpen ? (
                  <Link
                    key={lesson.id}
                    href={`/lms/${orgSlug}/learn/${courseSlug}/${lesson.slug}`}
                    className="group flex min-h-12 cursor-pointer items-center rounded-xl border border-slate-200 bg-white p-3.5 transition-all duration-200 hover:border-emerald-300 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={lesson.id} className="group flex min-h-12 items-center rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    {content}
                  </div>
                )
                     })}
                   </div>
                 </section>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  )
}
