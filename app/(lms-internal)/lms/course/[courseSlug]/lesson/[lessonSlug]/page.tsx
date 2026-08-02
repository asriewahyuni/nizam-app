import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clock, Paperclip, ExternalLink } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getLmsCourseBySlug, getLmsLessonsByCourseId } from '@/modules/edu/actions/lms-commercial.actions'
import { CompleteLessonButton } from './CompleteLessonButton'
import { createClient } from '@/lib/supabase/server'
import { MotionWrapper } from '@/app/(lms-internal)/lms/MotionWrapper'

export default async function LearningLessonPage(props: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>
}) {
  noStore()

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const params = await props.params
  
  const course = await getLmsCourseBySlug(orgData.org.id, params.courseSlug)
  if (!course) notFound()

  const lessons = await getLmsLessonsByCourseId(orgData.org.id, course.id)
  
  // Find current lesson
  const currentLessonIndex = lessons.findIndex((l: any) => l.slug === params.lessonSlug)
  if (currentLessonIndex === -1) notFound()
  
  const lesson = lessons[currentLessonIndex]
  const previousLesson = currentLessonIndex > 0 ? lessons[currentLessonIndex - 1] : null
  const nextLesson = currentLessonIndex < lessons.length - 1 ? lessons[currentLessonIndex + 1] : null

  // Check completion status
  let isAlreadyCompleted = false
  if (orgData.user) {
    const supabase = await createClient()
    const { data: enrollment } = await supabase
      .from('learning_enrollments')
      .select('id')
      .eq('course_id', course.id)
      .eq('user_id', orgData.user.id)
      .single()

    if (enrollment) {
      const { data: progress } = await supabase
        .from('learning_lesson_progress')
        .select('id')
        .eq('enrollment_id', enrollment.id)
        .eq('lesson_id', lesson.id)
        .single()
      if (progress) isAlreadyCompleted = true
    }
  }

  const videoItem = (lesson.media_items || []).find((m: any) => m.type === 'video')
  const videoUrl = videoItem?.url || lesson.embed_url || null
  const isVideo = lesson.lesson_type === 'VIDEO' && Boolean(videoUrl)

  const attachments = (lesson.media_items || []).filter((m: any) => m.type !== 'video')

  return (
    <MotionWrapper>
      <div className="space-y-6">
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <Link
            href={`/lms/course/${course.slug}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {course.title}
          </Link>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Lesson {currentLessonIndex + 1} of {lessons.length}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                {lesson.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                {lesson.summary || 'Study the following lesson carefully.'}
              </p>
            </div>
          </div>
        </section>

        {/* Video Player or Main Content */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          {isVideo && videoUrl ? (
            <div className="mb-8 rounded-xl overflow-hidden bg-black aspect-video relative shadow-inner ring-1 ring-slate-900/10">
              {videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
                <iframe
                  src={videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              ) : (
                <video
                  src={videoUrl}
                  controls
                  controlsList="nodownload"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          ) : null}

          <div 
            className="prose prose-slate max-w-none text-slate-700 md:prose-lg prose-headings:text-slate-900 prose-a:text-indigo-600 hover:prose-a:text-indigo-500"
            dangerouslySetInnerHTML={{ __html: lesson.content_md || '<p>No text content available.</p>' }}
          />

          {/* Attachments & Links Display */}
          {attachments.length > 0 && (
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Attachments & Supporting Links</h3>
              <div className="grid gap-2">
                {attachments.map((item: any, idx: number) => {
                  const isAttachment = item.type === 'attachment'
                  return (
                    <a
                      key={idx}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                    >
                      {isAttachment ? (
                        <Paperclip className="h-4 w-4 text-slate-500 shrink-0" />
                      ) : (
                        <ExternalLink className="h-4 w-4 text-slate-500 shrink-0" />
                      )}
                      <span className="truncate">{item.name || (isAttachment ? 'Download Attachment' : 'Open Link')}</span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lesson Navigation</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Continue Learning Step-by-Step</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {previousLesson ? (
                <Link
                  href={`/lms/course/${course.slug}/lesson/${previousLesson.slug}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous Lesson
                </Link>
              ) : null}

              <CompleteLessonButton 
                lessonId={lesson.id}
                courseSlug={course.slug}
                nextLessonSlug={nextLesson?.slug || null}
                isAlreadyCompleted={isAlreadyCompleted}
              />
            </div>
          </div>
        </section>
      </div>
    </MotionWrapper>
  )
}
