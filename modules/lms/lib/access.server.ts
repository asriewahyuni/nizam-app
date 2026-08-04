/**
 * Service akses LMS terpadu. Semua portal dan action harus melewati service ini
 * agar tenant, pengguna, course, prasyarat, masa akses, dan drip selalu konsisten.
 */
import 'server-only'

import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { sanitizeLearningHtml } from './content-sanitizer'

type LessonAccessRow = {
  org_id: string
  course_id: string
  course_slug: string
  course_title: string
  lesson_id: string
  lesson_slug: string
  lesson_title: string
  lesson_type: string
  content_md: string | null
  content_html: string | null
  media_items: unknown
  section_id: string | null
  is_preview: boolean
  is_required: boolean
  drip_value: number | null
  drip_unit: string | null
  embed_provider: string | null
  embed_url: string | null
}

type AccessGrantRow = {
  id: string
  starts_at: string
  expires_at: string | null
  discussion_group_url: string | null
}

export type LearningAsset = {
  id: string
  assetType: string
  title: string
  mimeType: string | null
  fileSizeBytes: number | null
  isDownloadable: boolean
  url: string | null
}

export type AccessibleLesson = {
  id: string
  courseId: string
  courseSlug: string
  courseTitle: string
  slug: string
  title: string
  lessonType: string
  contentHtml: string
  mediaItems: unknown
  isPreview: boolean
  isRequired: boolean
  embedProvider: string | null
  embedUrl: string | null
  discussionGroupUrl: string | null
  assets: LearningAsset[]
}

export type LessonAccessDecision =
  | {
      allowed: true
      orgId: string
      userId: string | null
      grantId: string | null
      isStaffOverride: boolean
      lesson: AccessibleLesson
    }
  | {
      allowed: false
      code: 'NOT_FOUND' | 'LOGIN_REQUIRED' | 'NO_ACCESS' | 'PREREQUISITE' | 'DRIP_LOCKED'
      message: string
      unlocksAt?: string
    }

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Kesalahan tidak diketahui')
}

function dripMilliseconds(value: number, unit: string) {
  const normalizedUnit = unit.toUpperCase()
  const perHour = 60 * 60 * 1000
  if (normalizedUnit === 'HOUR' || normalizedUnit === 'HOURS') return value * perHour
  if (normalizedUnit === 'DAY' || normalizedUnit === 'DAYS') return value * 24 * perHour
  if (normalizedUnit === 'WEEK' || normalizedUnit === 'WEEKS') return value * 7 * 24 * perHour
  if (normalizedUnit === 'MONTH' || normalizedUnit === 'MONTHS') return value * 30 * 24 * perHour
  if (normalizedUnit === 'YEAR' || normalizedUnit === 'YEARS') return value * 365 * 24 * perHour
  return 0
}

export async function getStaffOverride(orgId: string, userId: string) {
  const result = await queryPostgres<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM public.org_members
       WHERE org_id = $1::uuid
         AND user_id = $2::uuid
         AND is_active = TRUE
         AND role IN ('owner', 'admin', 'manager')
     ) OR EXISTS (
       SELECT 1
       FROM public.learning_instructor_profiles
       WHERE org_id = $1::uuid
         AND user_id = $2::uuid
         AND is_active = TRUE
     ) AS allowed`,
    [orgId, userId],
  )
  return Boolean(result.rows[0]?.allowed)
}

async function getActiveGrant(orgId: string, userId: string, courseId: string) {
  const result = await queryPostgres<AccessGrantRow>(
    `SELECT
       grant_row.id::text,
       grant_row.starts_at::text,
       grant_row.expires_at::text,
       batch.discussion_group_url
     FROM public.learning_access_grants grant_row
     LEFT JOIN public.lms_course_batches batch
       ON batch.id = grant_row.batch_id
     WHERE grant_row.org_id = $1::uuid
       AND grant_row.user_id = $2::uuid
       AND grant_row.course_id = $3::uuid
       AND grant_row.status = 'ACTIVE'
       AND grant_row.starts_at <= NOW()
       AND (grant_row.expires_at IS NULL OR grant_row.expires_at > NOW())
     ORDER BY grant_row.expires_at DESC NULLS FIRST, grant_row.created_at DESC
     LIMIT 1`,
    [orgId, userId, courseId],
  )
  return result.rows[0] || null
}

async function hasMissingPrerequisite(orgId: string, userId: string, courseId: string) {
  const result = await queryPostgres<{ missing_count: number }>(
    `SELECT COUNT(*)::int AS missing_count
     FROM public.learning_course_prerequisites prerequisite
     WHERE prerequisite.org_id = $1::uuid
       AND prerequisite.course_id = $3::uuid
       AND NOT EXISTS (
         SELECT 1
         FROM public.learning_enrollments enrollment
         WHERE enrollment.org_id = prerequisite.org_id
           AND enrollment.user_id = $2::uuid
           AND enrollment.course_id = prerequisite.prerequisite_course_id
           AND (
             prerequisite.requirement_type = 'ENROLLED'
             OR (
               prerequisite.requirement_type = 'COMPLETED'
               AND enrollment.status = 'COMPLETED'
             )
             OR (
               prerequisite.requirement_type = 'PASSED'
               AND enrollment.status = 'COMPLETED'
               AND COALESCE(enrollment.final_score, 0) >= COALESCE(prerequisite.minimum_score, 0)
             )
           )
       )`,
    [orgId, userId, courseId],
  )
  return Number(result.rows[0]?.missing_count || 0) > 0
}

async function getLessonAssets(orgId: string, lessonId: string): Promise<LearningAsset[]> {
  const result = await queryPostgres<{
    id: string
    asset_type: string
    title: string
    mime_type: string | null
    file_size_bytes: string | null
    is_downloadable: boolean
    storage_key: string | null
    source_url: string | null
  }>(
    `SELECT
       id::text,
       asset_type,
       title,
       mime_type,
       file_size_bytes::text,
       is_downloadable,
       storage_key,
       source_url
     FROM public.learning_lesson_assets
     WHERE org_id = $1::uuid
       AND lesson_id = $2::uuid
     ORDER BY sort_order, created_at`,
    [orgId, lessonId],
  )

  return result.rows.map((asset) => ({
    id: asset.id,
    assetType: asset.asset_type,
    title: asset.title,
    mimeType: asset.mime_type,
    fileSizeBytes: asset.file_size_bytes ? Number(asset.file_size_bytes) : null,
    isDownloadable: asset.is_downloadable,
    url: asset.storage_key ? `/api/lms/assets/${asset.id}` : asset.source_url,
  }))
}

/**
 * Mengambil lesson hanya bila aksesnya sah. Preview tetap disanitasi dan tidak
 * membuka lampiran private bila lesson bukan preview.
 */
export async function resolveLessonAccess(input: {
  orgSlug: string
  courseSlug: string
  lessonSlug: string
}): Promise<LessonAccessDecision> {
  try {
    const session = await getInternalAuthSession()
    const userId = session?.user?.id || null

    let staffOverride = false
    if (userId) {
      const orgRes = await queryPostgres<{ id: string }>(
        `SELECT id::text FROM public.organizations WHERE slug = $1 AND is_active = TRUE LIMIT 1`,
        [input.orgSlug],
      )
      const orgId = orgRes.rows[0]?.id
      if (orgId) {
        staffOverride = await getStaffOverride(orgId, userId)
      }
    }

    const lessonResult = await queryPostgres<LessonAccessRow>(
      `SELECT
         organization.id::text AS org_id,
         course.id::text AS course_id,
         course.slug AS course_slug,
         course.title AS course_title,
         lesson.id::text AS lesson_id,
         lesson.slug AS lesson_slug,
         lesson.title AS lesson_title,
         lesson.lesson_type,
         lesson.content_md,
         lesson.content_html,
         lesson.media_items,
         lesson.section_id::text,
         COALESCE(lesson.is_preview, FALSE) AS is_preview,
         COALESCE(lesson.is_required, TRUE) AS is_required,
         lesson.drip_value,
         lesson.drip_unit,
         lesson.embed_provider,
         lesson.embed_url
       FROM public.organizations organization
       JOIN public.learning_courses course
         ON course.org_id = organization.id
       JOIN public.learning_lessons lesson
         ON lesson.org_id = organization.id
        AND lesson.course_id = course.id
       WHERE organization.slug = $1
         AND organization.is_active = TRUE
         AND course.slug = $2
         AND ($4::boolean = TRUE OR (course.is_active = TRUE AND COALESCE(course.status, 'PUBLISHED') = 'PUBLISHED'))
         AND course.deleted_at IS NULL
         AND lesson.slug = $3
         AND lesson.deleted_at IS NULL
       LIMIT 1`,
      [input.orgSlug, input.courseSlug, input.lessonSlug, staffOverride],
    )
    const row = lessonResult.rows[0]
    if (!row) {
      return { allowed: false, code: 'NOT_FOUND', message: 'Materi tidak ditemukan.' }
    }

    let grant: AccessGrantRow | null = null
    if (userId && !staffOverride) {
      grant = await getActiveGrant(row.org_id, userId, row.course_id)
    }

    if (!row.is_preview && !staffOverride && !userId) {
      return {
        allowed: false,
        code: 'LOGIN_REQUIRED',
        message: 'Silakan masuk untuk membuka materi ini.',
      }
    }

    if (!row.is_preview && !staffOverride && !grant) {
      return {
        allowed: false,
        code: 'NO_ACCESS',
        message: 'Materi ini hanya tersedia untuk peserta yang memiliki akses aktif.',
      }
    }

    if (userId && !staffOverride && await hasMissingPrerequisite(row.org_id, userId, row.course_id)) {
      return {
        allowed: false,
        code: 'PREREQUISITE',
        message: 'Selesaikan course prasyarat sebelum membuka materi ini.',
      }
    }

    if (
      grant
      && !staffOverride
      && row.drip_value
      && row.drip_value > 0
      && row.drip_unit
    ) {
      const unlocksAt = new Date(
        new Date(grant.starts_at).getTime() + dripMilliseconds(row.drip_value, row.drip_unit),
      )
      if (unlocksAt.getTime() > Date.now()) {
        return {
          allowed: false,
          code: 'DRIP_LOCKED',
          message: 'Materi ini belum terbuka sesuai jadwal belajar Anda.',
          unlocksAt: unlocksAt.toISOString(),
        }
      }
    }

    const content = row.content_html || row.content_md || ''
    const assets = row.is_preview || staffOverride || grant
      ? await getLessonAssets(row.org_id, row.lesson_id)
      : []

    return {
      allowed: true,
      orgId: row.org_id,
      userId,
      grantId: grant?.id || null,
      isStaffOverride: staffOverride,
      lesson: {
        id: row.lesson_id,
        courseId: row.course_id,
        courseSlug: row.course_slug,
        courseTitle: row.course_title,
        slug: row.lesson_slug,
        title: row.lesson_title,
        lessonType: row.lesson_type,
        contentHtml: sanitizeLearningHtml(content),
        mediaItems: row.media_items,
        isPreview: row.is_preview,
        isRequired: row.is_required,
        embedProvider: row.embed_provider,
        embedUrl: row.embed_url,
        discussionGroupUrl: grant?.discussion_group_url || null,
        assets,
      },
    }
  } catch (error) {
    console.error('[LMS access] Gagal memeriksa akses lesson:', errorMessage(error))
    return {
      allowed: false,
      code: 'NOT_FOUND',
      message: 'Materi belum dapat dibuka. Silakan coba lagi.',
    }
  }
}

export async function canUserAccessCourse(input: {
  orgId: string
  userId: string
  courseId: string
}) {
  const staffOverride = await getStaffOverride(input.orgId, input.userId)
  if (staffOverride) return { allowed: true, grantId: null, isStaffOverride: true }
  const grant = await getActiveGrant(input.orgId, input.userId, input.courseId)
  return {
    allowed: Boolean(grant),
    grantId: grant?.id || null,
    isStaffOverride: false,
  }
}
