import React from 'react'
import Link from 'next/link'
import { getLMSCourses } from '@/modules/lms/actions/course.actions'
import { Book, ChevronRight } from 'lucide-react'

export default async function LMSLandingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params;
  const result = await getLMSCourses(orgSlug)

  if (result.error) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-500 font-semibold">{result.error}</p>
      </div>
    )
  }

  const courses = result.data || []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Katalog Pembelajaran</h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Tingkatkan kompetensi Anda dan pastikan operasional perusahaan berjalan sesuai standar. Pilih modul pelatihan di bawah ini.
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Book size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Belum Ada Kursus</h3>
          <p className="text-slate-500">Katalog pembelajaran untuk organisasi ini masih kosong.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((c: any) => (
            <Link key={c.id} href={`/lms/${orgSlug}/course/${c.slug}`} className="group block h-full">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-indigo-200 transition-all h-full flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-widest rounded">
                      {c.level_code || 'ALL LEVEL'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed">
                    {c.description || 'Tidak ada deskripsi kursus.'}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Buka Modul
                  </span>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
