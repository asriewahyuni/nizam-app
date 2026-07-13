import React from 'react'
import Link from 'next/link'
import { getLMSCourseDetails } from '@/modules/lms/actions/course.actions'
import { Book, Play, CheckCircle, ArrowLeft } from 'lucide-react'
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

  const { course, lessons, batches } = result.data

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
            <h3 className="text-lg font-bold text-slate-900 mb-4">Pilih Angkatan (Batch)</h3>
            <BatchSelector 
              orgSlug={orgSlug} 
              courseSlug={courseSlug} 
              batches={batches || []}
            />
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
              {lessons.map((lesson: any, index: number) => (
                <div key={lesson.id} className="flex items-center p-5 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all group">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold mr-4 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-900">{lesson.title}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">
                      {lesson.lesson_type}
                    </p>
                  </div>
                  {/* Public preview doesn't allow play directly without enrollment, maybe just show lock icon or "Preview" */}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
