import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStudentEnrollments } from '@/modules/lms/actions/enrollment.actions'
import { Book, Play, CheckCircle2, ChevronRight, GraduationCap } from 'lucide-react'

export default async function LMSMyProgressPage({
  params,
}: {
  params: { orgSlug: string }
}) {
  const result = await getStudentEnrollments(params.orgSlug)

  if (result.error === 'Not authenticated') {
    // If not authenticated, redirect to login with a callback
    return redirect(`/login?callbackUrl=/lms/${params.orgSlug}/my-progress`)
  }

  if (result.error) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-500 font-semibold">{result.error}</p>
      </div>
    )
  }

  const enrollments = result.data || []

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-700 mb-4">
          <GraduationCap className="h-4 w-4" />
          Dashboard Siswa
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Kelas Saya</h1>
        <p className="mt-2 text-slate-500 max-w-2xl">
          Lanjutkan proses belajarmu dan pantau persentase kelulusan di setiap kelas.
        </p>
      </div>

      {enrollments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Book size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Belum Ada Kelas</h3>
          <p className="text-slate-500 mb-6">Anda belum terdaftar di kelas manapun.</p>
          <Link 
            href={`/lms/${params.orgSlug}`}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Lihat Katalog
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {enrollments.map((e: any) => {
            const total = Number(e.total_lessons) || 0
            const completed = Number(e.completed_lessons) || 0
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
            
            return (
              <div key={e.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-indigo-200 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md ${
                      e.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {e.status === 'COMPLETED' ? 'Lulus' : 'In Progress'}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      {e.level_code || 'ALL LEVEL'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{e.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2">{e.description}</p>
                </div>
                
                <div className="w-full md:w-64 shrink-0">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                    <span>Progress</span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">
                    {completed} dari {total} Modul Selesai
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  <Link 
                    href={`/lms/${params.orgSlug}/course/${e.slug}`}
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    {e.status === 'COMPLETED' ? 'Review Materi' : 'Lanjutkan Belajar'}
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
