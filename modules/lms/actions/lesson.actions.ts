'use server'

/**
 * Action lesson publik yang memakai service akses LMS terpadu.
 */
import { resolveLessonAccess } from '@/modules/lms/lib/access.server'

export async function getLMSLessonDetails(
  orgSlug: string,
  courseSlug: string,
  lessonSlug: string,
) {
  const decision = await resolveLessonAccess({ orgSlug, courseSlug, lessonSlug })
  if (!decision.allowed) {
    return {
      error: decision.message,
      code: decision.code,
      unlocksAt: decision.unlocksAt,
    }
  }

  const lesson = decision.lesson
  return {
    data: {
      id: lesson.id,
      course_id: lesson.courseId,
      title: lesson.title,
      content_md: lesson.contentHtml,
      content_html: lesson.contentHtml,
      media_items: lesson.mediaItems,
      embed_provider: lesson.embedProvider,
      embed_url: lesson.embedUrl,
      discussion_group_url: lesson.discussionGroupUrl,
      lesson_type: lesson.lessonType,
      course_title: lesson.courseTitle,
      course_slug: lesson.courseSlug,
      is_preview: lesson.isPreview,
      assets: lesson.assets,
      access: {
        grantId: decision.grantId,
        staffOverride: decision.isStaffOverride,
      },
    },
  }
}
