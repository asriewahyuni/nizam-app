import React from 'react'
import Link from 'next/link'
import { getLMSLessonDetails } from '@/modules/lms/actions/lesson.actions'
import { getLMSCourseDetails } from '@/modules/lms/actions/course.actions'
import { getLessonAssessmentOverview } from '@/modules/lms/actions/assessment.actions'
import LessonTabs from './LessonTabs'
import VideoPlayer from './VideoPlayer'

export default async function LMSLearnPage(props: {
  params: Promise<{ orgSlug: string; courseSlug: string; lessonSlug: string }>
}) {
  const params = await props.params
  const result = await getLMSLessonDetails(params.orgSlug, params.courseSlug, params.lessonSlug)

  if (result.error || !result.data) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-500 font-semibold">{result.error || 'Materi tidak ditemukan'}</p>
        <Link href={`/lms/${params.orgSlug}/course/${params.courseSlug}`} className="mt-4 inline-block text-indigo-600 hover:underline">
          Kembali ke Kursus
        </Link>
      </div>
    )
  }

  const lesson = result.data
  const courseResult = await getLMSCourseDetails(params.orgSlug, params.courseSlug)
  const courseLessons = courseResult.data?.lessons || []
  const lessonIndex = courseLessons.findIndex((item) => item.slug === params.lessonSlug)
  const previousLesson = lessonIndex > 0 ? courseLessons[lessonIndex - 1] : null
  const nextLesson = lessonIndex >= 0 && lessonIndex < courseLessons.length - 1 ? courseLessons[lessonIndex + 1] : null
  const assessmentResult = lesson.is_preview
    ? null
    : await getLessonAssessmentOverview(
        params.orgSlug,
        params.courseSlug,
        params.lessonSlug,
      )
  const assessments = assessmentResult?.data || { quizzes: [], assignments: [] }

  // Extract video URL if any
  let videoUrl: string | null = null
  if (lesson.lesson_type === 'VIDEO') {
    if (Array.isArray(lesson.media_items)) {
      const videoMedia = lesson.media_items.find((media: unknown) => {
        if (!media || typeof media !== 'object') return false
        return String((media as Record<string, unknown>).type || '') === 'video'
      }) as Record<string, unknown> | undefined
      if (videoMedia) videoUrl = String(videoMedia.url || '') || null
    }
    if (!videoUrl && lesson.embed_url) videoUrl = lesson.embed_url
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Video Player Area */}
      {lesson.lesson_type === 'VIDEO' && videoUrl ? (
        <div className="w-full bg-black aspect-video lg:max-h-[70vh] flex items-center justify-center">
          <VideoPlayer url={videoUrl} />
        </div>
      ) : lesson.lesson_type === 'VIDEO' ? (
        <div className="w-full bg-slate-900 aspect-video lg:max-h-[70vh] flex items-center justify-center text-slate-400">
          <p>Video tidak tersedia.</p>
        </div>
      ) : null}

      {/* Content Area */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <LessonTabs 
          lesson={lesson} 
          orgSlug={params.orgSlug} 
          courseSlug={params.courseSlug} 
          assessments={assessments}
         />
         <nav aria-label="Navigasi materi" className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
           {previousLesson ? (
             <Link href={`/lms/${params.orgSlug}/learn/${params.courseSlug}/${previousLesson.slug}`} className="min-h-11 cursor-pointer rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200">
               ← {previousLesson.title}
             </Link>
           ) : <span />}
           {nextLesson && (
             <Link href={`/lms/${params.orgSlug}/learn/${params.courseSlug}/${nextLesson.slug}`} className="min-h-11 cursor-pointer rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200">
               {nextLesson.title} →
             </Link>
           )}
         </nav>
       </div>
     </div>
   )
}
