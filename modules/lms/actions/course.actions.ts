'use server'

/**
 * Query katalog dan detail course publik. Konten lesson tetap hanya dibuka
 * lewat service akses, sehingga daftar katalog tidak membocorkan materi.
 */
import { queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { canUserAccessCourse } from '@/modules/lms/lib/access.server'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Kesalahan tidak diketahui')
}

type OrganizationIdRow = { id: string }

export type LmsCourseCatalogItem = {
  id: string
  slug: string
  title: string
  description: string | null
  level_code: string | null
  passing_score: number
  cover_image_url: string | null
  preview_video_url: string | null
  duration_minutes: number | null
  outcomes: unknown
  is_featured: boolean
  lesson_count: number
  available_batch_count: number
  available_product_count: number
  starting_price: number | null
}

export async function getLMSCourses(orgSlug: string) {
  try {
    const orgResult = await queryPostgres<OrganizationIdRow>(
      `SELECT id::text
       FROM public.organizations
       WHERE slug = $1 AND is_active = TRUE
       LIMIT 1`,
      [orgSlug],
    )
    const orgId = orgResult.rows[0]?.id
    if (!orgId) return { error: 'Organisasi tidak ditemukan.' }

    const result = await queryPostgres<LmsCourseCatalogItem>(
      `SELECT
         course.id::text,
         course.slug,
         course.title,
         course.description,
         course.level_code,
         course.passing_score::float8,
         course.cover_image_url,
         course.preview_video_url,
         course.duration_minutes,
         course.outcomes,
         course.is_featured,
         (
           SELECT COUNT(*)::int
           FROM public.learning_lessons lesson
           WHERE lesson.org_id = course.org_id
             AND lesson.course_id = course.id
             AND lesson.deleted_at IS NULL
         ) AS lesson_count,
         (
           SELECT COUNT(*)::int
           FROM public.lms_course_batches batch
           WHERE batch.org_id = course.org_id
             AND batch.course_id = course.id
             AND batch.status = 'OPEN'
             AND batch.deleted_at IS NULL
         ) AS available_batch_count,
         (
           SELECT COUNT(*)::int
           FROM public.commerce_product_courses product_course
           JOIN public.store_products store_product
             ON store_product.id = product_course.store_product_id
            AND store_product.org_id = product_course.org_id
           WHERE product_course.org_id = course.org_id
             AND product_course.course_id = course.id
             AND store_product.is_published = TRUE
             AND (store_product.sale_starts_at IS NULL OR store_product.sale_starts_at <= NOW())
             AND (store_product.sale_ends_at IS NULL OR store_product.sale_ends_at > NOW())
         ) AS available_product_count,
         (
           SELECT MIN(offering.price)::float8
           FROM (
             SELECT batch.price
             FROM public.lms_course_batches batch
             WHERE batch.org_id = course.org_id
               AND batch.course_id = course.id
               AND batch.status = 'OPEN'
               AND batch.deleted_at IS NULL
             UNION ALL
             SELECT COALESCE(store_product.price_override, product.selling_price)
             FROM public.commerce_product_courses product_course
             JOIN public.store_products store_product
               ON store_product.id = product_course.store_product_id
              AND store_product.org_id = product_course.org_id
             JOIN public.products product
               ON product.id = store_product.product_id
              AND product.org_id = store_product.org_id
             WHERE product_course.org_id = course.org_id
               AND product_course.course_id = course.id
               AND store_product.is_published = TRUE
               AND (store_product.sale_starts_at IS NULL OR store_product.sale_starts_at <= NOW())
               AND (store_product.sale_ends_at IS NULL OR store_product.sale_ends_at > NOW())
           ) offering
         ) AS starting_price
       FROM public.learning_courses course
       WHERE course.org_id = $1::uuid
         AND course.is_active = TRUE
         AND COALESCE(course.status, 'PUBLISHED') = 'PUBLISHED'
         AND course.deleted_at IS NULL
       ORDER BY course.is_featured DESC, course.published_at DESC NULLS LAST, course.created_at DESC`,
      [orgId],
    )

    return { data: result.rows }
  } catch (error) {
    return { error: `Gagal mengambil katalog: ${getErrorMessage(error)}` }
  }
}

type CourseDetailRow = {
  id: string
  title: string
  description: string | null
  level_code: string | null
  passing_score: number
  cover_image_url: string | null
  preview_video_url: string | null
  duration_minutes: number | null
  outcomes: unknown
  closed_access_message: string | null
}

type LessonOutlineRow = {
  id: string
  slug: string
  title: string
  lesson_type: string
  sort_order: number
  is_required: boolean
  is_preview: boolean
  duration_seconds: number | null
  section_id: string | null
  section_title: string | null
  section_sort_order: number
}

type BatchRow = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  quota: number | null
  price: number
  mode: string
  status: string
  enrolled_count: number
  waitlist_enabled: boolean
}

export async function getLMSCourseDetails(orgSlug: string, courseSlug: string) {
  try {
    const orgResult = await queryPostgres<OrganizationIdRow>(
      `SELECT id::text
       FROM public.organizations
       WHERE slug = $1 AND is_active = TRUE
       LIMIT 1`,
      [orgSlug],
    )
    const orgId = orgResult.rows[0]?.id
    if (!orgId) return { error: 'Organisasi tidak ditemukan.' }

    const courseResult = await queryPostgres<CourseDetailRow>(
      `SELECT
         id::text,
         title,
         description,
         level_code,
         passing_score::float8,
         cover_image_url,
         preview_video_url,
         duration_minutes,
         outcomes,
         closed_access_message
       FROM public.learning_courses
       WHERE org_id = $1::uuid
         AND slug = $2
         AND is_active = TRUE
         AND COALESCE(status, 'PUBLISHED') = 'PUBLISHED'
         AND deleted_at IS NULL
       LIMIT 1`,
      [orgId, courseSlug],
    )
    const course = courseResult.rows[0]
    if (!course) return { error: 'Kursus tidak ditemukan.' }

    const [lessonsResult, batchesResult, session] = await Promise.all([
      queryPostgres<LessonOutlineRow>(
        `SELECT
           lesson.id::text,
           lesson.slug,
           lesson.title,
           lesson.lesson_type,
           lesson.sort_order,
           lesson.is_required,
           lesson.is_preview,
           lesson.duration_seconds,
           section.id::text AS section_id,
           section.title AS section_title,
           COALESCE(section.sort_order, 0) AS section_sort_order
         FROM public.learning_lessons lesson
         LEFT JOIN public.learning_course_sections section
           ON section.id = lesson.section_id
          AND section.org_id = lesson.org_id
         WHERE lesson.org_id = $1::uuid
           AND lesson.course_id = $2::uuid
           AND lesson.deleted_at IS NULL
         ORDER BY COALESCE(section.sort_order, 0), lesson.sort_order, lesson.created_at`,
        [orgId, course.id],
      ),
      queryPostgres<BatchRow>(
        `SELECT
           batch.id::text,
           batch.name,
           batch.start_date::text,
           batch.end_date::text,
           batch.quota,
           batch.price::float8,
           COALESCE(NULLIF(batch.delivery_mode, ''), NULLIF(batch.mode, ''), 'ONLINE') AS mode,
           batch.status,
           batch.waitlist_enabled,
           (
             SELECT COUNT(*)::int
             FROM public.lms_registrations registration
             WHERE registration.org_id = batch.org_id
               AND registration.batch_id = batch.id
               AND registration.status = 'CONFIRMED'
           ) AS enrolled_count
         FROM public.lms_course_batches batch
         WHERE batch.org_id = $1::uuid
           AND batch.course_id = $2::uuid
           AND batch.status = 'OPEN'
           AND batch.deleted_at IS NULL
         ORDER BY batch.start_date NULLS LAST, batch.created_at`,
        [orgId, course.id],
      ),
      getInternalAuthSession(),
    ])

    const access = session?.user
      ? await canUserAccessCourse({ orgId, userId: session.user.id, courseId: course.id })
      : { allowed: false, grantId: null, isStaffOverride: false }

    return {
      data: {
        course,
        lessons: lessonsResult.rows,
        batches: batchesResult.rows,
        access,
      },
    }
  } catch (error) {
    return { error: `Gagal memuat kursus: ${getErrorMessage(error)}` }
  }
}
