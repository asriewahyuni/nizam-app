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

  let progressData: Record<string, boolean> = {}
  if (session?.user) {
    const progressResult = await getLmsUserProgress(orgSlug, courseSlug)
    if (progressResult.data) {
      progressData = progressResult.data
    }
  }

  const completedCount = Object.keys(progressData).length
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
    </div>
  )
}
