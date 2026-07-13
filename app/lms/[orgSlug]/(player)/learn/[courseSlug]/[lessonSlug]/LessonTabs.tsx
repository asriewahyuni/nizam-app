'use client'

import React, { useState } from 'react'
import MarkCompleteButton from './MarkCompleteButton'

interface LessonTabsProps {
  lesson: any
  orgSlug: string
  courseSlug: string
}

export default function LessonTabs({ lesson, orgSlug, courseSlug }: LessonTabsProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: 'Gambaran Umum' },
    { id: 'qa', label: 'T&J' },
    { id: 'notes', label: 'Catatan' },
  ]

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm
                ${activeTab === tab.id
                  ? 'border-indigo-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">{lesson.title}</h1>
                <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-widest rounded">
                  {lesson.lesson_type}
                </span>
              </div>
              <MarkCompleteButton 
                orgSlug={orgSlug} 
                lessonId={lesson.id} 
                courseSlug={courseSlug} 
              />
            </div>
            
            <hr className="border-slate-100" />

            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-medium">
              {lesson.content_md ? (
                <div dangerouslySetInnerHTML={{ __html: lesson.content_md }} />
              ) : (
                <p className="text-slate-500 italic">Materi ini tidak memiliki konten teks tambahan.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'qa' && (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-700 mb-2">Tanya & Jawab</h3>
            <p className="text-slate-500 text-sm">Fitur T&J sedang dalam pengembangan. Anda dapat berdiskusi dengan peserta lain dan instruktur di sini nantinya.</p>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-700 mb-2">Catatan Pribadi</h3>
            <p className="text-slate-500 text-sm">Fitur Catatan sedang dalam pengembangan. Anda dapat menyimpan catatan privat untuk materi ini.</p>
          </div>
        )}
      </div>
    </div>
  )
}
