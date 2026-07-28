'use server'

/**
 * Pendaftaran course tanpa harga contoh. Akses gratis dibuat atomik; kelas
 * berbayar selalu diarahkan ke checkout/registrasi dan baru aktif setelah bayar.
 */
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Kesalahan tidak diketahui')
}

type CourseRow = {
  id: string
  title: string
}

type BatchRow = {
  id: string
  price: number
  quota: number | null
  waitlist_enabled: boolean
  status: string
}

export async function enrollUser(
  orgSlug: string,
  courseSlug: string,
  batchId?: string,
) {
  const session = await getInternalAuthSession()
  if (!session?.user) return { error: 'Anda harus masuk untuk mendaftar kelas ini.' }

  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')

    const courseResult = await client.query<CourseRow & { org_id: string }>(
      `SELECT course.id::text, course.title, organization.id::text AS org_id
       FROM public.organizations organization
       JOIN public.learning_courses course ON course.org_id = organization.id
       WHERE organization.slug = $1
         AND organization.is_active = TRUE
         AND course.slug = $2
         AND course.is_active = TRUE
         AND COALESCE(course.status, 'PUBLISHED') = 'PUBLISHED'
         AND course.deleted_at IS NULL
       LIMIT 1
       FOR UPDATE OF course`,
      [orgSlug, courseSlug],
    )
    const course = courseResult.rows[0]
    if (!course) throw new Error('Kursus tidak ditemukan.')

    const existing = await client.query<{ id: string }>(
      `SELECT id::text
       FROM public.learning_access_grants
       WHERE org_id = $1::uuid
         AND user_id = $2::uuid
         AND course_id = $3::uuid
         AND status = 'ACTIVE'
         AND starts_at <= NOW()
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [course.org_id, session.user.id, course.id],
    )
    if (existing.rows[0]) {
      await client.query('ROLLBACK')
      return { data: { alreadyEnrolled: true } }
    }

    let selectedBatch: BatchRow | null = null
    if (batchId) {
      const batchResult = await client.query<BatchRow & {
        enrollment_opens_at: string | null
        enrollment_closes_at: string | null
      }>(
        `SELECT
           id::text,
           price::float8,
           quota,
           waitlist_enabled,
           status,
           enrollment_opens_at::text,
           enrollment_closes_at::text
         FROM public.lms_course_batches
         WHERE id = $1::uuid
           AND org_id = $2::uuid
           AND course_id = $3::uuid
           AND deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [batchId, course.org_id, course.id],
      )
      const batchRow = batchResult.rows[0] || null
      const withinEnrollmentWindow = Boolean(batchRow)
        && (!batchRow.enrollment_opens_at || new Date(batchRow.enrollment_opens_at) <= new Date())
        && (!batchRow.enrollment_closes_at || new Date(batchRow.enrollment_closes_at) > new Date())
      selectedBatch = withinEnrollmentWindow ? batchRow : null
      if (!selectedBatch || selectedBatch.status !== 'OPEN') {
        throw new Error('Angkatan tidak tersedia atau pendaftarannya sudah ditutup.')
      }
    } else {
      const offeringResult = await client.query<{ batch_count: number; product_count: number }>(
        `SELECT
           (
             SELECT COUNT(*)::int
             FROM public.lms_course_batches batch
             WHERE batch.org_id = $1::uuid
               AND batch.course_id = $2::uuid
               AND batch.status = 'OPEN'
               AND batch.deleted_at IS NULL
               AND (batch.enrollment_opens_at IS NULL OR batch.enrollment_opens_at <= NOW())
               AND (batch.enrollment_closes_at IS NULL OR batch.enrollment_closes_at > NOW())
           ) AS batch_count,
           (
             SELECT COUNT(*)::int
             FROM public.commerce_product_courses product_course
             JOIN public.store_products store_product
               ON store_product.id = product_course.store_product_id
              AND store_product.org_id = product_course.org_id
             WHERE product_course.org_id = $1::uuid
               AND product_course.course_id = $2::uuid
               AND store_product.is_published = TRUE
           ) AS product_count`,
        [course.org_id, course.id],
      )
      const offerings = offeringResult.rows[0]
      if (Number(offerings?.batch_count || 0) > 0) {
        await client.query('ROLLBACK')
        return { error: 'Pilih angkatan yang tersedia terlebih dahulu.' }
      }
      if (Number(offerings?.product_count || 0) > 0) {
        await client.query('ROLLBACK')
        return {
          data: {
            requiresCheckout: true,
            checkoutUrl: `/member/${orgSlug}/checkout?course=${encodeURIComponent(courseSlug)}`,
          },
        }
      }
    }

    if (selectedBatch && selectedBatch.price > 0) {
      // Kalau batch ini sudah terhubung ke Product (harmonisasi Course-Batch-Product),
      // arahkan ke checkout member sungguhan, bukan lagi halaman pendaftaran lama.
      const linkedProduct = await client.query<{ store_product_id: string }>(
        `SELECT store_product.id::text AS store_product_id
         FROM public.commerce_product_courses product_course
         JOIN public.store_products store_product
           ON store_product.id = product_course.store_product_id
          AND store_product.org_id = product_course.org_id
         WHERE product_course.org_id = $1::uuid
           AND product_course.batch_id = $2::uuid
           AND store_product.is_published = TRUE
         LIMIT 1`,
        [course.org_id, selectedBatch.id],
      )
      await client.query('ROLLBACK')
      const storeProductId = linkedProduct.rows[0]?.store_product_id
      return {
        data: {
          requiresCheckout: true,
          checkoutUrl: storeProductId
            ? `/member/${orgSlug}/checkout?product=${encodeURIComponent(storeProductId)}`
            : `/lms/daftar/${selectedBatch.id}`,
          batchId: selectedBatch.id,
        },
      }
    }

    if (selectedBatch?.quota && selectedBatch.quota > 0) {
      const countResult = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM public.lms_registrations
         WHERE org_id = $1::uuid
           AND batch_id = $2::uuid
           AND status = 'CONFIRMED'`,
        [course.org_id, selectedBatch.id],
      )
      if (Number(countResult.rows[0]?.count || 0) >= selectedBatch.quota) {
        if (!selectedBatch.waitlist_enabled) {
          throw new Error('Kuota angkatan ini sudah penuh.')
        }
        const waitlistResult = await client.query<{ id: string; position: number }>(
          `INSERT INTO public.lms_waitlist_entries (
             org_id,
             batch_id,
             user_id,
             position,
             status
           )
           VALUES (
             $1::uuid,
             $2::uuid,
             $3::uuid,
             (
               SELECT COALESCE(MAX(position), 0) + 1
               FROM public.lms_waitlist_entries
               WHERE batch_id = $2::uuid
             ),
             'WAITING'
           )
           ON CONFLICT (org_id, batch_id, user_id) DO UPDATE
           SET updated_at = NOW()
           RETURNING id::text, position`,
          [course.org_id, selectedBatch.id, session.user.id],
        )
        await client.query('COMMIT')
        return {
          data: {
            waitlisted: true,
            position: waitlistResult.rows[0]?.position,
          },
        }
      }
    }

    const idempotencyKey = [
      'free-enrollment',
      session.user.id,
      course.id,
      selectedBatch?.id || 'no-batch',
    ].join(':')
    const grantResult = await client.query<{ id: string }>(
      `INSERT INTO public.learning_access_grants (
         org_id,
         user_id,
         course_id,
         batch_id,
         source_type,
         source_reference,
         status,
         starts_at,
         idempotency_key,
         metadata
       )
       VALUES (
         $1::uuid,
         $2::uuid,
         $3::uuid,
         $4::uuid,
         'TRIAL',
         'free-public-enrollment',
         'ACTIVE',
         NOW(),
         $5,
         jsonb_build_object('course_title', $6::text)
       )
       ON CONFLICT (org_id, idempotency_key) DO UPDATE
       SET updated_at = NOW()
       RETURNING id::text`,
      [
        course.org_id,
        session.user.id,
        course.id,
        selectedBatch?.id || null,
        idempotencyKey,
        course.title,
      ],
    )
    const grantId = grantResult.rows[0]?.id
    if (!grantId) throw new Error('Hak akses tidak dapat dibuat.')

    await client.query(
      `INSERT INTO public.learning_enrollments (
         org_id,
         user_id,
         course_id,
         batch_id,
         access_grant_id,
         status,
         started_at
       )
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'IN_PROGRESS', NOW())
       ON CONFLICT (org_id, user_id, course_id) DO UPDATE
       SET
         batch_id = COALESCE(EXCLUDED.batch_id, public.learning_enrollments.batch_id),
         access_grant_id = EXCLUDED.access_grant_id,
         status = CASE
           WHEN public.learning_enrollments.status = 'COMPLETED' THEN 'COMPLETED'
           ELSE 'IN_PROGRESS'
         END,
         updated_at = NOW()`,
      [course.org_id, session.user.id, course.id, selectedBatch?.id || null, grantId],
    )

    if (selectedBatch) {
      const fullName = String(session.user.user_metadata.full_name || session.user.email || 'Peserta')
      const email = session.user.email || `${session.user.id}@member.invalid`
      await client.query(
        `INSERT INTO public.lms_registrations (
           org_id,
           batch_id,
           user_id,
           full_name,
           email,
           status,
           amount_paid,
           payment_method,
           idempotency_key
         )
         VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4, $5, 'CONFIRMED', 0, 'FREE', $6
         )
         ON CONFLICT (org_id, idempotency_key) DO UPDATE
         SET status = 'CONFIRMED', updated_at = NOW()`,
        [course.org_id, selectedBatch.id, session.user.id, fullName, email, idempotencyKey],
      )
    }

    await client.query('COMMIT')
    return { data: { success: true, grantId } }
  } catch (error) {
    await client.query('ROLLBACK')
    return { error: getErrorMessage(error) }
  } finally {
    client.release()
  }
}

export async function getStudentEnrollments(orgSlug: string) {
  try {
    const session = await getInternalAuthSession()
    if (!session?.user) return { error: 'Silakan masuk untuk melihat kelas Anda.' }

    const result = await queryPostgres<{
      id: string
      status: string
      created_at: string
      completed_at: string | null
      title: string
      slug: string
      level_code: string | null
      description: string | null
      total_lessons: number
      completed_lessons: number
      progress_percent: number
      access_expires_at: string | null
    }>(
      `SELECT
         enrollment.id::text,
         enrollment.status,
         enrollment.created_at::text,
         enrollment.completed_at::text,
         course.title,
         course.slug,
         course.level_code,
         course.description,
         enrollment.progress_percent::float8,
         access_grant.expires_at::text AS access_expires_at,
         (
           SELECT COUNT(*)::int
           FROM public.learning_lessons lesson
           WHERE lesson.org_id = course.org_id
             AND lesson.course_id = course.id
             AND lesson.deleted_at IS NULL
         ) AS total_lessons,
         (
           SELECT COUNT(*)::int
           FROM public.learning_lesson_progress progress
           WHERE progress.org_id = enrollment.org_id
             AND progress.enrollment_id = enrollment.id
             AND progress.status = 'COMPLETED'
         ) AS completed_lessons
       FROM public.organizations organization
       JOIN public.learning_enrollments enrollment
         ON enrollment.org_id = organization.id
        AND enrollment.user_id = $2::uuid
       JOIN public.learning_courses course
         ON course.id = enrollment.course_id
        AND course.org_id = organization.id
       LEFT JOIN public.learning_access_grants access_grant
         ON access_grant.id = enrollment.access_grant_id
        AND access_grant.org_id = enrollment.org_id
       WHERE organization.slug = $1
         AND organization.is_active = TRUE
       ORDER BY enrollment.last_activity_at DESC NULLS LAST, enrollment.created_at DESC`,
      [orgSlug, session.user.id],
    )

    return { data: result.rows }
  } catch (error) {
    return { error: `Gagal memuat kelas Anda: ${getErrorMessage(error)}` }
  }
}
