'use client'

import { useState } from 'react'
import { ClipboardCheck, Download, ExternalLink, FileText, MessageCircle } from 'lucide-react'
import type { LessonAssessmentOverview } from '@/modules/lms/actions/assessment.actions'
import MarkCompleteButton from './MarkCompleteButton'
import AssessmentPanel from './AssessmentPanel'

type LessonAsset = {
  id: string
  assetType: string
  title: string
  mimeType: string | null
  fileSizeBytes: number | null
  isDownloadable: boolean
  url: string | null
}

type Lesson = {
  id: string
  title: string
  lesson_type: string
  content_html?: string | null
  content_md?: string | null
  is_preview?: boolean
  assets?: LessonAsset[]
}

export default function LessonTabs({
  lesson,
  orgSlug,
  courseSlug,
  assessments,
}: {
  lesson: Lesson
  orgSlug: string
  courseSlug: string
  assessments: LessonAssessmentOverview
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'assessment' | 'discussion'>('overview')
  const assessmentCount = assessments.quizzes.length + assessments.assignments.length
  const tabs = [
    { id: 'overview' as const, label: 'Materi', icon: FileText },
    ...(!lesson.is_preview ? [{
      id: 'assessment' as const,
      label: assessmentCount > 0 ? `Kuis & tugas (${assessmentCount})` : 'Kuis & tugas',
      icon: ClipboardCheck,
    }] : []),
    { id: 'discussion' as const, label: 'Diskusi', icon: MessageCircle },
  ]
  const contentHtml = lesson.content_html || lesson.content_md || ''

  return (
    <div className="w-full">
      <div className="border-b border-slate-200">
        <nav className="flex gap-2" aria-label="Bagian materi">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-11 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-bold transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 ${
                  activeTab === tab.id
                    ? 'border-emerald-700 text-emerald-900'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
                aria-selected={activeTab === tab.id}
                role="tab"
              >
                <Icon aria-hidden="true" size={17} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="py-8">
        {activeTab === 'overview' ? (
          <div className="space-y-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h1 className="text-2xl font-bold text-slate-950">{lesson.title}</h1>
                <span className="mt-3 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                  {lesson.lesson_type}
                </span>
              </div>
              {!lesson.is_preview && (
                <MarkCompleteButton
                  orgSlug={orgSlug}
                  lessonId={lesson.id}
                  courseSlug={courseSlug}
                />
              )}
            </div>

            <hr className="border-slate-100" />

            {contentHtml ? (
              <div
                className="prose prose-slate max-w-none font-medium leading-relaxed text-slate-700"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            ) : (
              <p className="italic text-slate-500">Materi ini tidak memiliki teks tambahan.</p>
            )}

            {lesson.assets && lesson.assets.length > 0 && (
              <section aria-labelledby="lampiran-title" className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h2 id="lampiran-title" className="font-bold text-slate-950">Lampiran materi</h2>
                <ul className="mt-4 space-y-2">
                  {lesson.assets.map((asset) => (
                    <li key={asset.id}>
                      {asset.url ? (
                        <a
                          href={asset.url}
                          target={asset.url.startsWith('http') ? '_blank' : undefined}
                          rel={asset.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-emerald-300 hover:text-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                        >
                          <span className="truncate">{asset.title}</span>
                          {asset.isDownloadable
                            ? <Download aria-label="Unduh" size={18} />
                            : <ExternalLink aria-label="Buka" size={18} />}
                        </a>
                      ) : (
                        <span className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                          {asset.title} belum tersedia
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : activeTab === 'assessment' ? (
          <AssessmentPanel overview={assessments} orgSlug={orgSlug} />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-7 text-center">
            <MessageCircle aria-hidden="true" className="mx-auto text-emerald-700" size={32} />
            <h2 className="mt-4 text-lg font-bold text-slate-800">Ruang diskusi course</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Diskusi internal dan tautan grup resmi dikelola per course dan angkatan.
              Gunakan panel diskusi yang diberikan tutor untuk menjaga percakapan tetap aman.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
