'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PlayCircle, FileText, Check } from 'lucide-react'

interface Lesson {
  id: string
  slug: string
  title: string
  lesson_type: string
  sort_order: number
  section_id: string | null
  section_title: string | null
}

interface CourseSidebarProps {
  orgSlug: string
  courseSlug: string
  lessons: Lesson[]
  progress: Record<string, { completed: boolean; status: string; lastPositionSeconds: number }>
}

export default function CourseSidebar({ orgSlug, courseSlug, lessons, progress }: CourseSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="p-4 border-b border-slate-200">
        <h2 className="font-bold text-slate-800">Konten Kursus</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {lessons.reduce<Array<{ id: string; title: string; lessons: Lesson[] }>>((groups, lesson) => {
            const id = lesson.section_id || 'UNASSIGNED'
            const group = groups.find((item) => item.id === id)
            if (group) group.lessons.push(lesson)
            else groups.push({ id, title: lesson.section_title || 'Materi lainnya', lessons: [lesson] })
            return groups
          }, []).map((group) => (
            <section key={group.id} aria-labelledby={`sidebar-section-${group.id}`}>
              <h3 id={`sidebar-section-${group.id}`} className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.title}</h3>
              {group.lessons.map((lesson) => {
            const idx = lessons.indexOf(lesson)
            const isActive = pathname.includes(`/learn/${courseSlug}/${lesson.slug}`)
            const isCompleted = Boolean(progress[lesson.id]?.completed)

            return (
              <Link
                key={lesson.id}
                href={`/lms/${orgSlug}/learn/${courseSlug}/${lesson.slug}`}
                className={`flex items-start gap-3 p-4 border-b border-slate-100 transition-colors ${
                  isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  <div className={`flex h-4 w-4 items-center justify-center rounded-[4px] border ${
                    isCompleted ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                  }`}>
                    {isCompleted && <Check size={12} className="text-white" />}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm mb-1 line-clamp-2 ${isActive ? 'font-bold text-indigo-900' : 'text-slate-700'}`}>
                    {idx + 1}. {lesson.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    {lesson.lesson_type === 'VIDEO' ? (
                      <><PlayCircle size={12} /> Video</>
                    ) : (
                      <><FileText size={12} /> Teks / Artikel</>
                    )}
                  </div>
                </div>
              </Link>
            )
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
