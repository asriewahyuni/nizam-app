import React from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { getLMSCourseDetails } from '@/modules/lms/actions/course.actions'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import CourseSidebar from './CourseSidebar'

import { getLmsUserProgress } from '@/modules/lms/actions/progress.actions'

export default async function CoursePlayerLayout(props: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string; courseSlug: string }>
}) {
  const params = await props.params
  const { orgSlug, courseSlug } = params
  const session = await getInternalAuthSession()

  const result = await getLMSCourseDetails(orgSlug, courseSlug)
  if (result.error || !result.data) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Kursus tidak ditemukan</h1>
          <Link href={`/lms/${orgSlug}`} className="text-indigo-400 hover:underline">
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    )
  }

  const { course, lessons } = result.data

  let progressData: Record<string, { completed: boolean; status: string; lastPositionSeconds: number }> = {}
  if (session?.user) {
    const progressResult = await getLmsUserProgress(orgSlug, courseSlug)
    if (progressResult.data) {
      progressData = progressResult.data
    }
  }

  const completedCount = Object.values(progressData).filter((item) => item.completed).length
  const totalCount = lessons.length
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white font-sans">
      {/* Dark Header */}
      <header className="flex h-14 shrink-0 items-center justify-between bg-slate-900 px-4 text-white">
        <div className="flex items-center gap-4">
          <Link
            href={`/lms/${orgSlug}/course/${courseSlug}`}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-800 transition-colors"
            title="Kembali ke Kursus"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{orgSlug}</span>
            <h1 className="text-sm font-bold truncate max-w-[300px] sm:max-w-md">{course.title}</h1>
          </div>
        </div>
        
        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <CheckCircle size={16} className={percentage === 100 ? "text-emerald-500" : "text-slate-500"} />
            <span className="text-xs font-bold text-slate-300">{percentage}% Selesai</span>
          </div>
        </div>
      </header>

      {/* Split Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content (Video & Tabs) */}
        <main className="flex-1 overflow-y-auto bg-white">
          {props.children}
        </main>

        {/* Sidebar */}
        <aside className="hidden w-80 shrink-0 flex-col border-l border-slate-200 bg-slate-50 md:flex lg:w-96 overflow-y-auto">
          <CourseSidebar 
            orgSlug={orgSlug} 
            courseSlug={courseSlug} 
            lessons={lessons} 
            progress={progressData}
          />
        </aside>
      </div>
      <nav
        aria-label="Materi course pada layar kecil"
        className="flex shrink-0 gap-2 overflow-x-auto border-t border-slate-200 bg-white p-2 md:hidden"
      >
        {lessons.map((lesson, index) => (
          <Link
            key={lesson.id}
            href={`/lms/${orgSlug}/learn/${courseSlug}/${lesson.slug}`}
            className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
          >
            <span>{index + 1}.</span>
            <span className="max-w-48 truncate">{lesson.title}</span>
            {progressData[lesson.id]?.completed && (
              <CheckCircle aria-label="Selesai" size={16} className="text-emerald-700" />
            )}
          </Link>
        ))}
      </nav>
    </div>
  )
}
