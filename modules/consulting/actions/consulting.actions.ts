'use server'

/**
 * Aksi aman untuk administrasi, operasional sesi, perubahan jadwal, dan
 * penerbitan lencana Consulting 360.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { generateSlug } from '@/lib/utils'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getPublicConsultingAvailability } from '@/modules/consulting/lib/consulting.server'
import {
  finalizeCommerceRefund,
  requestCommerceRefund,
} from '@/modules/ecommerce/payments/refund.service'
import {
  getPortalMemberContext,
  getPortalTenant,
} from '@/modules/member/lib/portal.server'

const MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager'])

function cleanText(value: FormDataEntryValue | null | undefined, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function parseUuidList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return [...new Set(
      parsed
        .map((item) => String(item || '').trim())
        .filter((item) => /^[0-9a-f-]{36}$/i.test(item)),
    )]
  } catch {
    return []
  }
}

function parseNumberList(value: FormDataEntryValue | null): number[] {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return [...new Set(
      parsed
        .map(Number)
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6),
    )].sort()
  } catch {
    return []
  }
}

function parseIntakeSchema(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, 20).map((item, index) => {
      const row = (
        item && typeof item === 'object' && !Array.isArray(item)
          ? item
          : {}
      ) as Record<string, unknown>
      return {
        key: String(row.key || `field_${index + 1}`).trim().slice(0, 80),
        label: String(row.label || `Pertanyaan ${index + 1}`).trim().slice(0, 160),
        required: Boolean(row.required),
        placeholder: String(row.placeholder || '').trim().slice(0, 240),
      }
    })
  } catch {
    throw new Error('Formulir kebutuhan awal tidak valid.')
  }
}

function parseJakartaDateTime(value: FormDataEntryValue | null) {
  const raw = cleanText(value, 80)
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)
    ? `${raw}:00+07:00`
    : raw
  return new Date(normalized)
}

function cleanWebUrl(value: FormDataEntryValue | null) {
  const url = cleanText(value, 1000)
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('protocol')
    }
    return parsed.toString()
  } catch {
    throw new Error('Tautan pertemuan harus berupa URL http/https yang valid.')
  }
}

async function requireOrgContext(options?: {
  managementOnly?: boolean
  orgSlug?: string
}) {
  const orgData = await getActiveOrg()
  let context = orgData?.user?.id
    ? {
        orgId: orgData.org.id,
        orgSlug: orgData.org.slug,
        userId: orgData.user.id,
        role: String(orgData.role || '').toLowerCase(),
      }
    : null
  if (options?.orgSlug && context?.orgSlug !== options.orgSlug) {
    const tenant = await getPortalTenant(options.orgSlug)
    const member = tenant ? await getPortalMemberContext(tenant) : null
    context = tenant && member
      ? {
          orgId: tenant.id,
          orgSlug: tenant.slug,
          userId: member.userId,
          role: String(member.role || '').toLowerCase(),
        }
      : null
  }
  if (!context) throw new Error('Sesi Anda sudah berakhir. Silakan masuk lagi.')
  const role = context.role
  if (options?.managementOnly && !MANAGEMENT_ROLES.has(role)) {
    throw new Error('Hanya owner, admin, atau manager yang dapat mengelola Consulting 360.')
  }
  return context
}

function revalidateConsultingPaths(orgSlug?: string) {
  revalidatePath('/lms/admin/penjualan')
  revalidatePath('/lms/admin/penjualan/consulting-360')
  revalidatePath('/lms/admin/penjualan/ringkasan')
  revalidatePath('/lms/admin/konsultasi')
  revalidatePath('/ecommerce')
  if (orgSlug) {
    revalidatePath(`/member/${orgSlug}/konsultasi`)
    revalidatePath(`/member/${orgSlug}/tutor/konsultasi`)
  }
}

export async function saveConsultingOfferingAction(formData: FormData) {
  try {
    const context = await requireOrgContext({ managementOnly: true })
    const offeringId = cleanText(formData.get('offering_id'), 80)
    const productIdInput = cleanText(formData.get('product_id'), 80)
    const storeId = cleanText(formData.get('store_id'), 80)
    const name = cleanText(formData.get('name'), 180)
    const shortDescription = cleanText(formData.get('short_description'), 300)
    const publicDescription = cleanText(formData.get('public_description'), 5000)
    const price = Number(formData.get('price') || 0)
    const sessionCount = Math.trunc(Number(formData.get('session_count') || 1))
    const durationMinutes = Math.trunc(Number(formData.get('duration_minutes') || 60))
    const bookingHorizonDays = Math.trunc(Number(formData.get('booking_horizon_days') || 90))
    const minimumNoticeHours = Math.trunc(Number(formData.get('minimum_notice_hours') || 24))
    const rescheduleLimit = Math.trunc(Number(formData.get('reschedule_limit') || 2))
    const rescheduleCutoffHours = Math.trunc(Number(formData.get('reschedule_cutoff_hours') || 24))
    const noShowConsumesSession = formData.get('no_show_consumes_session') !== 'false'
    const deliveryMode = cleanText(formData.get('delivery_mode'), 20).toUpperCase()
    const locationName = cleanText(formData.get('location_name'), 300)
    const defaultMeetingUrl = cleanWebUrl(formData.get('default_meeting_url'))
    const meetingProvider = cleanText(formData.get('meeting_provider'), 80)
    const isPublished = formData.get('is_published') === 'true'
    const consultantIds = parseUuidList(formData.get('consultant_ids'))
    const courseIds = parseUuidList(formData.get('course_ids'))
    const packageIds = parseUuidList(formData.get('package_ids'))
    const weekdays = parseNumberList(formData.get('weekdays'))
    const startLocal = cleanText(formData.get('start_local'), 8)
    const endLocal = cleanText(formData.get('end_local'), 8)
    const badgeTemplateIdInput = cleanText(formData.get('badge_template_id'), 80)
    const intakeSchema = parseIntakeSchema(formData.get('intake_form_schema'))

    if (!storeId || !name) throw new Error('Store dan nama paket wajib diisi.')
    if (!Number.isFinite(price) || price < 0) throw new Error('Harga paket tidak valid.')
    if (sessionCount < 1 || sessionCount > 100) throw new Error('Jumlah sesi harus 1–100.')
    if (durationMinutes < 15 || durationMinutes > 480) throw new Error('Durasi sesi harus 15–480 menit.')
    if (!['ONLINE', 'OFFLINE', 'HYBRID'].includes(deliveryMode)) {
      throw new Error('Mode konsultasi tidak valid.')
    }
    if (consultantIds.length === 0) throw new Error('Pilih minimal satu konsultan.')
    if (weekdays.length === 0) throw new Error('Pilih minimal satu hari konsultasi.')
    if (!/^\d{2}:\d{2}$/.test(startLocal) || !/^\d{2}:\d{2}$/.test(endLocal) || startLocal >= endLocal) {
      throw new Error('Jam mulai dan selesai tidak valid.')
    }

    const client = await connectPostgresClient()
    try {
      await client.query('BEGIN')
      const store = await client.query<{ id: string }>(
        `SELECT id::text
         FROM public.stores
         WHERE id = $1::uuid AND org_id = $2::uuid
         LIMIT 1
         FOR UPDATE`,
        [storeId, context.orgId],
      )
      if (!store.rows[0]) throw new Error('Store tidak ditemukan pada organisasi aktif.')

      const consultants = await client.query<{ id: string; employee_id: string }>(
        `SELECT instructor.id::text, instructor.employee_id::text
         FROM public.learning_instructor_profiles instructor
         JOIN public.employees employee
           ON employee.org_id = instructor.org_id
          AND employee.id = instructor.employee_id
         WHERE instructor.org_id = $1::uuid
           AND instructor.id = ANY($2::uuid[])
           AND instructor.is_active = TRUE`,
        [context.orgId, consultantIds],
      )
      if (consultants.rows.length !== consultantIds.length) {
        throw new Error('Ada konsultan yang tidak ditemukan atau sudah tidak aktif.')
      }

      let badgeTemplateId = badgeTemplateIdInput || null
      if (badgeTemplateId) {
        const selectedBadge = await client.query(
          `SELECT 1
           FROM public.learning_badge_templates
           WHERE org_id = $1::uuid
             AND id = $2::uuid
             AND is_active = TRUE
           LIMIT 1`,
          [context.orgId, badgeTemplateId],
        )
        if (!selectedBadge.rows[0]) {
          throw new Error('Template lencana tidak ditemukan pada organisasi aktif.')
        }
      } else {
        const badge = await client.query<{ id: string }>(
          `INSERT INTO public.learning_badge_templates (
             org_id, name, title, description, criteria, created_by
           ) VALUES (
             $1::uuid, 'Consulting 360', 'Lencana Consulting 360',
             'Diberikan setelah seluruh sesi selesai dan hasil akhir disetujui konsultan.',
             $2::jsonb, $3::uuid
           )
           ON CONFLICT (org_id, name) DO UPDATE
           SET is_active = TRUE, updated_at = NOW()
           RETURNING id::text`,
          [
            context.orgId,
            JSON.stringify({ allSessionsRequired: true, consultantApprovalRequired: true }),
            context.userId,
          ],
        )
        badgeTemplateId = badge.rows[0].id
      }

      let productId = productIdInput
      if (productId) {
        const updated = await client.query(
          `UPDATE public.products
           SET name = $1, description = $2, type = 'SERVICE',
               selling_price = $3, unit = 'Paket', is_active = TRUE, updated_at = NOW()
           WHERE id = $4::uuid AND org_id = $5::uuid`,
          [name, publicDescription || shortDescription || null, price, productId, context.orgId],
        )
        if (!updated.rowCount) throw new Error('Produk Consulting 360 tidak ditemukan.')
      } else {
        const product = await client.query<{ id: string }>(
          `INSERT INTO public.products (
             org_id, sku, name, type, description, unit, selling_price, is_active
           ) VALUES (
             $1::uuid, $2, $3, 'SERVICE', $4, 'Paket', $5, TRUE
           )
           RETURNING id::text`,
          [
            context.orgId,
            `C360-${randomBytes(4).toString('hex').toUpperCase()}`,
            name,
            publicDescription || shortDescription || null,
            price,
          ],
        )
        productId = product.rows[0].id
      }

      const publicSlug = `${generateSlug(name) || 'consulting-360'}-${randomBytes(3).toString('hex')}`
      const storeProduct = await client.query<{ id: string }>(
        `INSERT INTO public.store_products (
           org_id, store_id, product_id, public_slug, public_name,
           short_description, public_description, price_override,
           badge_text, is_featured, is_published, product_type,
           quantity_enabled, offering_type
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4, $5,
           $6, $7, $8, 'Consulting 360', TRUE, $9, 'DIGITAL',
           FALSE, 'CONSULTING_1_ON_1'
         )
         ON CONFLICT (store_id, product_id) DO UPDATE
         SET public_name = EXCLUDED.public_name,
             short_description = EXCLUDED.short_description,
             public_description = EXCLUDED.public_description,
             price_override = EXCLUDED.price_override,
             badge_text = 'Consulting 360',
             is_featured = TRUE,
             is_published = EXCLUDED.is_published,
             product_type = 'DIGITAL',
             quantity_enabled = FALSE,
             offering_type = 'CONSULTING_1_ON_1',
             updated_at = NOW()
         RETURNING id::text`,
        [
          context.orgId,
          storeId,
          productId,
          publicSlug,
          name,
          shortDescription || null,
          publicDescription || null,
          price,
          isPublished,
        ],
      )
      const storeProductId = storeProduct.rows[0].id
      const offering = await client.query<{ id: string }>(
        `INSERT INTO public.consulting_offerings (
           org_id, store_product_id, commercial_name, session_count,
           duration_minutes, timezone, booking_horizon_days, minimum_notice_hours,
           reschedule_limit, reschedule_cutoff_hours, no_show_consumes_session,
           delivery_mode, location_name, default_meeting_url, meeting_provider,
           intake_form_schema, badge_template_id, is_active, created_by
         ) VALUES (
           $1::uuid, $2::uuid, 'Consulting 360', $3,
           $4, 'Asia/Jakarta', $5, $6,
           $7, $8, $9,
           $10, $11, $12, $13,
           $14::jsonb, $15::uuid, TRUE, $16::uuid
         )
         ON CONFLICT (org_id, store_product_id) DO UPDATE
         SET session_count = EXCLUDED.session_count,
             duration_minutes = EXCLUDED.duration_minutes,
             booking_horizon_days = EXCLUDED.booking_horizon_days,
             minimum_notice_hours = EXCLUDED.minimum_notice_hours,
             reschedule_limit = EXCLUDED.reschedule_limit,
             reschedule_cutoff_hours = EXCLUDED.reschedule_cutoff_hours,
             no_show_consumes_session = EXCLUDED.no_show_consumes_session,
             delivery_mode = EXCLUDED.delivery_mode,
             location_name = EXCLUDED.location_name,
             default_meeting_url = EXCLUDED.default_meeting_url,
             meeting_provider = EXCLUDED.meeting_provider,
             intake_form_schema = EXCLUDED.intake_form_schema,
             badge_template_id = EXCLUDED.badge_template_id,
             is_active = TRUE,
             updated_at = NOW()
         RETURNING id::text`,
        [
          context.orgId,
          storeProductId,
          sessionCount,
          durationMinutes,
          Math.max(1, Math.min(365, bookingHorizonDays)),
          Math.max(0, Math.min(8760, minimumNoticeHours)),
          Math.max(0, Math.min(20, rescheduleLimit)),
          Math.max(0, Math.min(720, rescheduleCutoffHours)),
          noShowConsumesSession,
          deliveryMode,
          locationName || null,
          defaultMeetingUrl || null,
          meetingProvider || null,
          JSON.stringify(intakeSchema),
          badgeTemplateId,
          context.userId,
        ],
      )
      const finalOfferingId = offering.rows[0].id
      if (offeringId && offeringId !== finalOfferingId) {
        throw new Error('Paket Consulting 360 tidak cocok dengan produk yang dipilih.')
      }

      await client.query(
        `DELETE FROM public.consulting_offering_consultants
         WHERE org_id = $1::uuid AND offering_id = $2::uuid`,
        [context.orgId, finalOfferingId],
      )
      await client.query(
        `DELETE FROM public.consulting_availability_rules
         WHERE org_id = $1::uuid AND offering_id = $2::uuid`,
        [context.orgId, finalOfferingId],
      )
      for (const [consultantIndex, consultantId] of consultantIds.entries()) {
        await client.query(
          `INSERT INTO public.consulting_offering_consultants (
             org_id, offering_id, consultant_id, sort_order, is_active
           ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, TRUE)`,
          [context.orgId, finalOfferingId, consultantId, consultantIndex],
        )
        for (const weekday of weekdays) {
          await client.query(
            `INSERT INTO public.consulting_availability_rules (
               org_id, offering_id, consultant_id, weekday,
               start_local, end_local, is_active
             ) VALUES (
               $1::uuid, $2::uuid, $3::uuid, $4,
               $5::time, $6::time, TRUE
             )`,
            [context.orgId, finalOfferingId, consultantId, weekday, startLocal, endLocal],
          )
        }
      }

      await client.query(
        `DELETE FROM public.commerce_product_courses
         WHERE org_id = $1::uuid AND store_product_id = $2::uuid`,
        [context.orgId, storeProductId],
      )
      for (const courseId of courseIds) {
        await client.query(
          `INSERT INTO public.commerce_product_courses (
             org_id, store_product_id, course_id
           )
           SELECT $1::uuid, $2::uuid, course.id
           FROM public.learning_courses course
           WHERE course.org_id = $1::uuid AND course.id = $3::uuid
           ON CONFLICT (org_id, store_product_id, course_id) DO NOTHING`,
          [context.orgId, storeProductId, courseId],
        )
      }
      await client.query(
        `DELETE FROM public.commerce_product_access_packages
         WHERE org_id = $1::uuid AND store_product_id = $2::uuid`,
        [context.orgId, storeProductId],
      )
      for (const packageId of packageIds) {
        await client.query(
          `INSERT INTO public.commerce_product_access_packages (
             org_id, store_product_id, package_id
           )
           SELECT $1::uuid, $2::uuid, access_package.id
           FROM public.commerce_access_packages access_package
           WHERE access_package.org_id = $1::uuid
             AND access_package.id = $3::uuid
             AND access_package.is_active = TRUE
           ON CONFLICT (org_id, store_product_id, package_id) DO NOTHING`,
          [context.orgId, storeProductId, packageId],
        )
      }
      await client.query(
        `UPDATE public.commerce_subscription_plans
         SET is_active = FALSE, updated_at = NOW()
         WHERE org_id = $1::uuid AND store_product_id = $2::uuid`,
        [context.orgId, storeProductId],
      )

      await client.query('COMMIT')
      revalidateConsultingPaths(context.orgSlug)
      return { success: true, offeringId: finalOfferingId, storeProductId }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Paket Consulting 360 gagal disimpan.',
    }
  }
}

export async function saveConsultingAvailabilityExceptionAction(formData: FormData) {
  try {
    const context = await requireOrgContext({ managementOnly: true })
    const consultantId = cleanText(formData.get('consultant_id'), 80)
    const offeringId = cleanText(formData.get('offering_id'), 80) || null
    const exceptionType = cleanText(formData.get('exception_type'), 20).toUpperCase()
    const startsAt = parseJakartaDateTime(formData.get('starts_at'))
    const endsAt = parseJakartaDateTime(formData.get('ends_at'))
    const reason = cleanText(formData.get('reason'), 300)
    if (!consultantId || !['AVAILABLE', 'BLOCKED'].includes(exceptionType)) {
      throw new Error('Konsultan dan jenis tanggal khusus wajib dipilih.')
    }
    if (
      Number.isNaN(startsAt.getTime())
      || Number.isNaN(endsAt.getTime())
      || endsAt <= startsAt
    ) {
      throw new Error('Rentang tanggal khusus tidak valid.')
    }
    const inserted = await queryPostgres(
      `INSERT INTO public.consulting_availability_exceptions (
         org_id, offering_id, consultant_id, exception_type,
         starts_at, ends_at, reason, created_by
       )
       SELECT
         $1::uuid, $2::uuid, instructor.id, $3,
         $4::timestamptz, $5::timestamptz, $6, $7::uuid
       FROM public.learning_instructor_profiles instructor
       WHERE instructor.org_id = $1::uuid
         AND instructor.id = $8::uuid
         AND instructor.is_active = TRUE
         AND (
           $2::uuid IS NULL
           OR EXISTS (
             SELECT 1
             FROM public.consulting_offerings offering
             JOIN public.consulting_offering_consultants assignment
               ON assignment.org_id = offering.org_id
              AND assignment.offering_id = offering.id
              AND assignment.consultant_id = instructor.id
              AND assignment.is_active = TRUE
             WHERE offering.org_id = $1::uuid
               AND offering.id = $2::uuid
           )
         )`,
      [
        context.orgId,
        offeringId,
        exceptionType,
        startsAt.toISOString(),
        endsAt.toISOString(),
        reason || null,
        context.userId,
        consultantId,
      ],
    )
    if (!inserted.rowCount) {
      throw new Error('Konsultan atau paket Consulting 360 tidak ditemukan pada organisasi aktif.')
    }
    revalidateConsultingPaths(context.orgSlug)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tanggal khusus gagal disimpan.',
    }
  }
}

async function assertConsultantOrManager(
  client: Awaited<ReturnType<typeof connectPostgresClient>>,
  context: Awaited<ReturnType<typeof requireOrgContext>>,
  consultantId: string,
) {
  if (MANAGEMENT_ROLES.has(context.role)) return
  const result = await client.query(
    `SELECT 1
     FROM public.learning_instructor_profiles instructor
     WHERE instructor.org_id = $1::uuid
       AND instructor.id = $2::uuid
       AND (
         instructor.user_id = $3::uuid
         OR instructor.user_id = (
           SELECT legacy_user_id
           FROM public.internal_auth_users
           WHERE id = $3::uuid
           LIMIT 1
         )
       )
     LIMIT 1`,
    [context.orgId, consultantId, context.userId],
  )
  if (!result.rows[0]) throw new Error('Anda bukan konsultan untuk engagement ini.')
}

export async function updateConsultingSessionAction(formData: FormData) {
  try {
    const context = await requireOrgContext({
      orgSlug: cleanText(formData.get('org_slug'), 120) || undefined,
    })
    const sessionId = cleanText(formData.get('session_id'), 80)
    const status = cleanText(formData.get('status'), 20).toUpperCase()
    const attendanceStatus = cleanText(formData.get('attendance_status'), 20).toUpperCase()
    const internalNotes = cleanText(formData.get('internal_notes'), 5000)
    const memberSummary = cleanText(formData.get('member_summary'), 5000)
    if (!sessionId || !['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(status)) {
      throw new Error('Status sesi tidak valid.')
    }
    if (!['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].includes(attendanceStatus)) {
      throw new Error('Kehadiran sesi tidak valid.')
    }

    const client = await connectPostgresClient()
    try {
      await client.query('BEGIN')
      const sessionResult = await client.query<{
        id: string
        engagement_id: string
        consultant_id: string
        current_status: string
        no_show_consumes_session: boolean
        session_count: number
      }>(
        `SELECT
           session.id::text,
           session.engagement_id::text,
           session.consultant_id::text,
           session.status AS current_status,
           offering.no_show_consumes_session,
           engagement.session_count
         FROM public.consulting_sessions session
         JOIN public.consulting_engagements engagement
           ON engagement.org_id = session.org_id
          AND engagement.id = session.engagement_id
         JOIN public.consulting_offerings offering
           ON offering.org_id = engagement.org_id
          AND offering.id = engagement.offering_id
         WHERE session.org_id = $1::uuid AND session.id = $2::uuid
         FOR UPDATE OF session, engagement`,
        [context.orgId, sessionId],
      )
      const session = sessionResult.rows[0]
      if (!session) throw new Error('Sesi Consulting 360 tidak ditemukan.')
      await assertConsultantOrManager(client, context, session.consultant_id)

      await client.query(
        `UPDATE public.consulting_sessions
         SET status = $3,
             attendance_status = $4,
             internal_notes = NULLIF($5, ''),
             member_summary = NULLIF($6, ''),
             completed_at = CASE WHEN $3 IN ('COMPLETED', 'NO_SHOW') THEN NOW() ELSE completed_at END,
             completed_by = CASE WHEN $3 IN ('COMPLETED', 'NO_SHOW') THEN $7::uuid ELSE completed_by END,
             updated_at = NOW()
         WHERE org_id = $1::uuid AND id = $2::uuid`,
        [
          context.orgId,
          sessionId,
          status,
          attendanceStatus,
          internalNotes,
          memberSummary,
          context.userId,
        ],
      )
      await client.query(
        `INSERT INTO public.consulting_session_history (
           org_id, session_id, action, actor_user_id, reason, metadata
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4::uuid, $5, $6::jsonb
         )`,
        [
          context.orgId,
          sessionId,
          status,
          context.userId,
          internalNotes || null,
          JSON.stringify({
            previousStatus: session.current_status,
            attendanceStatus,
          }),
        ],
      )
      if (status === 'CANCELLED') {
        await client.query(
          `UPDATE public.consulting_slot_holds hold
           SET status = 'RELEASED', updated_at = NOW()
           FROM public.consulting_sessions consulting_session
           WHERE consulting_session.org_id = hold.org_id
             AND consulting_session.slot_hold_id = hold.id
             AND consulting_session.id = $2::uuid
             AND hold.org_id = $1::uuid`,
          [context.orgId, sessionId],
        )
      }
      const progress = await client.query<{ fulfilled: number }>(
        `SELECT COUNT(*)::int AS fulfilled
         FROM public.consulting_sessions
         WHERE org_id = $1::uuid
           AND engagement_id = $2::uuid
           AND (
             status = 'COMPLETED'
             OR (status = 'NO_SHOW' AND $3::boolean)
           )`,
        [context.orgId, session.engagement_id, session.no_show_consumes_session],
      )
      const fulfilled = Number(progress.rows[0]?.fulfilled || 0)
      await client.query(
        `UPDATE public.consulting_engagements
         SET status = CASE
               WHEN $4 = 'CANCELLED' THEN status
               WHEN $3 >= session_count THEN 'COMPLETION_PENDING'
               ELSE 'IN_PROGRESS'
             END,
             started_at = CASE
               WHEN $4 = 'CANCELLED' THEN started_at
               ELSE COALESCE(started_at, NOW())
             END,
             updated_at = NOW()
         WHERE org_id = $1::uuid AND id = $2::uuid`,
        [context.orgId, session.engagement_id, fulfilled, status],
      )
      await client.query('COMMIT')
      revalidateConsultingPaths(context.orgSlug)
      return { success: true }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sesi gagal diperbarui.',
    }
  }
}

export async function updateConsultingEngagementAction(formData: FormData) {
  try {
    const context = await requireOrgContext({
      orgSlug: cleanText(formData.get('org_slug'), 120) || undefined,
    })
    const engagementId = cleanText(formData.get('engagement_id'), 80)
    const actionPlan = cleanText(formData.get('action_plan'), 10000)
    const progressSummary = cleanText(formData.get('progress_summary'), 10000)
    const finalSummary = cleanText(formData.get('final_summary'), 10000)
    const client = await connectPostgresClient()
    try {
      await client.query('BEGIN')
      const engagement = await client.query<{ consultant_id: string }>(
        `SELECT consultant_id::text
         FROM public.consulting_engagements
         WHERE org_id = $1::uuid AND id = $2::uuid
         FOR UPDATE`,
        [context.orgId, engagementId],
      )
      if (!engagement.rows[0]) throw new Error('Engagement tidak ditemukan.')
      await assertConsultantOrManager(client, context, engagement.rows[0].consultant_id)
      await client.query(
        `UPDATE public.consulting_engagements
         SET action_plan = NULLIF($3, ''),
             progress_summary = NULLIF($4, ''),
             final_summary = NULLIF($5, ''),
             updated_at = NOW()
         WHERE org_id = $1::uuid AND id = $2::uuid`,
        [context.orgId, engagementId, actionPlan, progressSummary, finalSummary],
      )
      await client.query('COMMIT')
      revalidateConsultingPaths(context.orgSlug)
      return { success: true }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Rencana konsultasi gagal disimpan.',
    }
  }
}

export async function approveConsultingCompletionAction(formData: FormData) {
  try {
    const context = await requireOrgContext({
      orgSlug: cleanText(formData.get('org_slug'), 120) || undefined,
    })
    const engagementId = cleanText(formData.get('engagement_id'), 80)
    const client = await connectPostgresClient()
    try {
      await client.query('BEGIN')
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`consulting-completion:${context.orgId}:${engagementId}`],
      )
      const engagementResult = await client.query<{
        id: string
        user_id: string
        consultant_id: string
        badge_template_id: string | null
        session_count: number
        no_show_consumes_session: boolean
        program_name: string
        engagement_status: string
        order_status: string
        final_summary: string | null
      }>(
        `SELECT
           engagement.id::text,
           engagement.user_id::text,
           engagement.consultant_id::text,
           offering.badge_template_id::text,
           engagement.session_count,
           offering.no_show_consumes_session,
           store_product.public_name AS program_name,
           engagement.status AS engagement_status,
           ecommerce_order.status::text AS order_status,
           engagement.final_summary
         FROM public.consulting_engagements engagement
         JOIN public.consulting_offerings offering
           ON offering.org_id = engagement.org_id
          AND offering.id = engagement.offering_id
         JOIN public.store_products store_product
           ON store_product.org_id = offering.org_id
          AND store_product.id = offering.store_product_id
         JOIN public.ecommerce_orders ecommerce_order
           ON ecommerce_order.org_id = engagement.org_id
          AND ecommerce_order.id = engagement.order_id
         WHERE engagement.org_id = $1::uuid AND engagement.id = $2::uuid
         FOR UPDATE OF engagement`,
        [context.orgId, engagementId],
      )
      const engagement = engagementResult.rows[0]
      if (!engagement) throw new Error('Engagement tidak ditemukan.')
      await assertConsultantOrManager(client, context, engagement.consultant_id)
      if (
        ['CANCELLED', 'REFUNDED'].includes(engagement.engagement_status)
        || ['CANCELLED', 'REFUNDED'].includes(engagement.order_status)
      ) {
        throw new Error('Lencana tidak dapat diterbitkan untuk pesanan yang dibatalkan atau direfund.')
      }
      if (!engagement.badge_template_id) {
        throw new Error('Template lencana belum dipilih pada paket Consulting 360.')
      }
      if (!cleanText(engagement.final_summary, 10000)) {
        throw new Error('Ringkasan akhir wajib diisi sebelum menerbitkan lencana.')
      }
      const fulfilledResult = await client.query<{ fulfilled: number }>(
        `SELECT COUNT(*)::int AS fulfilled
         FROM public.consulting_sessions
         WHERE org_id = $1::uuid
           AND engagement_id = $2::uuid
           AND (
             status = 'COMPLETED'
             OR (status = 'NO_SHOW' AND $3::boolean)
           )`,
        [context.orgId, engagementId, engagement.no_show_consumes_session],
      )
      if (Number(fulfilledResult.rows[0]?.fulfilled || 0) < Number(engagement.session_count)) {
        throw new Error('Seluruh kewajiban sesi harus diselesaikan sebelum persetujuan akhir.')
      }
      const badgeNumber = `C360-${new Date().getUTCFullYear()}-${engagementId.replaceAll('-', '').slice(0, 10).toUpperCase()}`
      const award = await client.query<{ id: string; verification_token: string }>(
        `INSERT INTO public.learning_badge_awards (
           org_id, template_id, user_id, source_type, source_id,
           badge_number, awarded_by, metadata
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, 'CONSULTING_ENGAGEMENT', $4::uuid,
           $5, $6::uuid, $7::jsonb
         )
         ON CONFLICT (org_id, template_id, user_id, source_type, source_id)
         DO UPDATE SET
           status = 'ACTIVE',
           revoked_at = NULL,
           revoked_by = NULL,
           revoked_reason = NULL,
           updated_at = NOW()
         RETURNING id::text, verification_token`,
        [
          context.orgId,
          engagement.badge_template_id,
          engagement.user_id,
          engagementId,
          badgeNumber,
          context.userId,
          JSON.stringify({ programName: engagement.program_name }),
        ],
      )
      await client.query(
        `UPDATE public.consulting_engagements
         SET status = 'COMPLETED',
             completion_approved_at = COALESCE(completion_approved_at, NOW()),
             completion_approved_by = $3::uuid,
             badge_award_id = $4::uuid,
             completed_at = COALESCE(completed_at, NOW()),
             updated_at = NOW()
         WHERE org_id = $1::uuid AND id = $2::uuid`,
        [context.orgId, engagementId, context.userId, award.rows[0].id],
      )
      const recipient = await client.query<{ email: string | null }>(
        `SELECT login_email AS email
         FROM public.internal_auth_users
         WHERE id = $1::uuid OR legacy_user_id = $1::uuid
         ORDER BY CASE WHEN id = $1::uuid THEN 0 ELSE 1 END
         LIMIT 1`,
        [engagement.user_id],
      )
      if (recipient.rows[0]?.email) {
        await client.query(
          `INSERT INTO public.notification_outbox (
             org_id, user_id, event_type, channel, provider_code,
             recipient, subject, body, payload, idempotency_key
           ) VALUES (
             $1::uuid, $2::uuid, 'CONSULTING_BADGE_AWARDED', 'EMAIL', 'MAILKETING',
             $3, $4, $5, $6::jsonb, $7
           )
           ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
          [
            context.orgId,
            engagement.user_id,
            recipient.rows[0].email,
            `Lencana ${engagement.program_name} telah terbit`,
            'Selamat, lencana Consulting 360 Anda sudah aktif dan dapat diverifikasi publik.',
            JSON.stringify({
              engagementId,
              verificationToken: award.rows[0].verification_token,
            }),
            `consulting-badge:${engagementId}:EMAIL`,
          ],
        )
      }
      await client.query('COMMIT')
      revalidateConsultingPaths(context.orgSlug)
      revalidatePath(`/verifikasi/lencana/${award.rows[0].verification_token}`)
      return {
        success: true,
        verificationToken: award.rows[0].verification_token,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Persetujuan akhir gagal diproses.',
    }
  }
}

export async function rescheduleConsultingSessionAction(formData: FormData) {
  try {
    const context = await requireOrgContext({
      orgSlug: cleanText(formData.get('org_slug'), 120) || undefined,
    })
    const sessionId = cleanText(formData.get('session_id'), 80)
    const requestedStartsAt = cleanText(formData.get('starts_at'), 80)
    const reason = cleanText(formData.get('reason'), 500)
    const sessionContext = await queryPostgres<{
      id: string
      offering_id: string
      store_product_id: string
      store_slug: string
      consultant_id: string
      user_id: string
      order_id: string
      order_item_id: string
      slot_hold_id: string
      starts_at: string
      ends_at: string
      reschedule_count: number
      reschedule_limit: number
      reschedule_cutoff_hours: number
      current_status: string
      no_show_consumes_session: boolean
    }>(
      `SELECT
         session.id::text,
         engagement.offering_id::text,
         offering.store_product_id::text,
         store.slug AS store_slug,
         session.consultant_id::text,
         session.user_id::text,
         engagement.order_id::text,
         engagement.order_item_id::text,
         session.slot_hold_id::text,
         session.starts_at::text,
         session.ends_at::text,
         session.reschedule_count,
         offering.reschedule_limit,
         offering.reschedule_cutoff_hours,
         session.status AS current_status,
         offering.no_show_consumes_session
       FROM public.consulting_sessions session
       JOIN public.consulting_engagements engagement
         ON engagement.org_id = session.org_id
        AND engagement.id = session.engagement_id
       JOIN public.consulting_offerings offering
         ON offering.org_id = engagement.org_id
        AND offering.id = engagement.offering_id
       JOIN public.store_products store_product
         ON store_product.org_id = offering.org_id
        AND store_product.id = offering.store_product_id
       JOIN public.stores store
         ON store.org_id = store_product.org_id
        AND store.id = store_product.store_id
       WHERE session.org_id = $1::uuid
         AND session.id = $2::uuid
         AND (
           session.status = 'SCHEDULED'
           OR (
             session.status = 'NO_SHOW'
             AND offering.no_show_consumes_session = FALSE
           )
         )
         AND (
           session.user_id = $3::uuid
           OR session.user_id = (
             SELECT legacy_user_id
             FROM public.internal_auth_users
             WHERE id = $3::uuid
             LIMIT 1
           )
         )
       LIMIT 1`,
      [context.orgId, sessionId, context.userId],
    )
    const session = sessionContext.rows[0]
    if (!session) throw new Error('Sesi yang dapat dijadwal ulang tidak ditemukan.')
    if (Number(session.reschedule_count) >= Number(session.reschedule_limit)) {
      throw new Error('Batas perubahan jadwal untuk sesi ini sudah habis.')
    }
    const cutoffAt = new Date(session.starts_at).getTime()
      - Number(session.reschedule_cutoff_hours) * 60 * 60 * 1000
    if (session.current_status === 'SCHEDULED' && Date.now() >= cutoffAt) {
      throw new Error(`Jadwal hanya dapat diubah minimal ${session.reschedule_cutoff_hours} jam sebelumnya.`)
    }
    const availability = await getPublicConsultingAvailability({
      orgSlug: context.orgSlug,
      storeSlug: session.store_slug,
      storeProductId: session.store_product_id,
      consultantId: session.consultant_id,
    })
    const selected = availability.slots.find((slot) => slot.startsAt === requestedStartsAt)
    if (!selected) throw new Error('Jadwal baru sudah tidak tersedia.')

    const client = await connectPostgresClient()
    try {
      await client.query('BEGIN')
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`consulting:${context.orgId}:${session.consultant_id}`],
      )
      await client.query(
        `UPDATE public.consulting_slot_holds
         SET status = 'RELEASED', updated_at = NOW()
         WHERE org_id = $1::uuid AND id = $2::uuid`,
        [context.orgId, session.slot_hold_id],
      )
      const tokenHash = randomBytes(32).toString('hex')
      const hold = await client.query<{ id: string }>(
        `INSERT INTO public.consulting_slot_holds (
           org_id, offering_id, consultant_id, hold_group_id, token_hash,
           starts_at, ends_at, status, held_until, order_id, order_item_id
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
           $6::timestamptz, $7::timestamptz, 'CONFIRMED', $7::timestamptz,
           $8::uuid, $9::uuid
         )
         RETURNING id::text`,
        [
          context.orgId,
          session.offering_id,
          session.consultant_id,
          randomUUID(),
          tokenHash,
          selected.startsAt,
          selected.endsAt,
          session.order_id,
          session.order_item_id,
        ],
      )
      await client.query(
        `UPDATE public.consulting_sessions
         SET slot_hold_id = $3::uuid,
             starts_at = $4::timestamptz,
             ends_at = $5::timestamptz,
             status = 'SCHEDULED',
             attendance_status = 'PENDING',
             completed_at = NULL,
             completed_by = NULL,
             reschedule_count = reschedule_count + 1,
             updated_at = NOW()
         WHERE org_id = $1::uuid AND id = $2::uuid`,
        [context.orgId, sessionId, hold.rows[0].id, selected.startsAt, selected.endsAt],
      )
      await client.query(
        `INSERT INTO public.consulting_session_history (
           org_id, session_id, action, actor_user_id, reason,
           previous_starts_at, previous_ends_at, new_starts_at, new_ends_at
         ) VALUES (
           $1::uuid, $2::uuid, 'RESCHEDULED', $3::uuid, $4,
           $5::timestamptz, $6::timestamptz, $7::timestamptz, $8::timestamptz
         )`,
        [
          context.orgId,
          sessionId,
          context.userId,
          reason || null,
          session.starts_at,
          session.ends_at,
          selected.startsAt,
          selected.endsAt,
        ],
      )
      await client.query(
        `INSERT INTO public.notification_outbox (
           org_id, user_id, event_type, channel, provider_code,
           recipient, subject, body, payload, idempotency_key
         )
         SELECT
           $1::uuid,
           $2::uuid,
           'CONSULTING_RESCHEDULED',
           destination.channel,
           destination.provider_code,
           destination.recipient,
           'Jadwal Consulting 360 berubah',
           $3,
           $4::jsonb,
           'consulting-rescheduled:' || $5::text || ':' || destination.channel
         FROM public.internal_auth_users internal_user
         CROSS JOIN LATERAL (
           VALUES
             (
               'EMAIL',
               'MAILKETING',
               COALESCE(
                 internal_user.login_email,
                 (
                   SELECT ecommerce_order.customer_email
                   FROM public.ecommerce_orders ecommerce_order
                   WHERE ecommerce_order.org_id = $1::uuid
                     AND ecommerce_order.id = $6::uuid
                 )
               )
             ),
             (
               'WHATSAPP',
               'FONNTE',
               (
                 SELECT ecommerce_order.customer_phone
                 FROM public.ecommerce_orders ecommerce_order
                 WHERE ecommerce_order.org_id = $1::uuid
                   AND ecommerce_order.id = $6::uuid
               )
             )
         ) AS destination(channel, provider_code, recipient)
         WHERE (
             internal_user.id = $2::uuid
             OR internal_user.legacy_user_id = $2::uuid
           )
           AND NULLIF(destination.recipient, '') IS NOT NULL
         ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
        [
          context.orgId,
          session.user_id,
          `Jadwal sesi Consulting 360 Anda telah diubah menjadi ${selected.dateLabel} pukul ${selected.timeLabel}.`,
          JSON.stringify({
            sessionId,
            previousStartsAt: session.starts_at,
            startsAt: selected.startsAt,
            endsAt: selected.endsAt,
          }),
          hold.rows[0].id,
          session.order_id,
        ],
      )
      await client.query('COMMIT')
      revalidateConsultingPaths(context.orgSlug)
      return { success: true }
    } catch (error) {
      await client.query('ROLLBACK')
      if ((error as { code?: string }).code === '23P01') {
        throw new Error('Jadwal baru saja dipilih member lain. Silakan pilih ulang.')
      }
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Perubahan jadwal gagal.',
    }
  }
}

export async function requestConsultingRefundAction(formData: FormData) {
  try {
    const context = await requireOrgContext({
      managementOnly: true,
      orgSlug: cleanText(formData.get('org_slug'), 120) || undefined,
    })
    const engagementId = cleanText(formData.get('engagement_id'), 80)
    const reason = cleanText(formData.get('reason'), 1000)
    const allowOverride = formData.get('allow_started_override') === 'true'
    const overrideReason = cleanText(formData.get('override_reason'), 1000)
    if (!engagementId || !reason) throw new Error('Alasan refund wajib diisi.')

    const engagement = await queryPostgres<{ order_id: string }>(
      `SELECT order_id::text
       FROM public.consulting_engagements
       WHERE org_id = $1::uuid
         AND id = $2::uuid
         AND status NOT IN ('CANCELLED', 'REFUNDED')
       LIMIT 1`,
      [context.orgId, engagementId],
    )
    const orderId = engagement.rows[0]?.order_id
    if (!orderId) throw new Error('Engagement aktif yang dapat direfund tidak ditemukan.')

    const result = await requestCommerceRefund({
      orgId: context.orgId,
      orderId,
      reason,
      requestedBy: context.userId,
      idempotencyKey: `consulting-refund-request:${orderId}`,
      allowStartedConsultingOverride: allowOverride,
      overrideReason,
    })
    revalidateConsultingPaths(context.orgSlug)
    return {
      success: true,
      refundId: 'refundId' in result && typeof result.refundId === 'string'
        ? result.refundId
        : null,
      status: 'status' in result ? String(result.status) : 'SUCCEEDED',
      requiresConfirmation: 'requiresConfirmation' in result
        ? Boolean(result.requiresConfirmation)
        : false,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Permintaan refund gagal.',
    }
  }
}

export async function finalizeConsultingRefundAction(formData: FormData) {
  try {
    const context = await requireOrgContext({
      managementOnly: true,
      orgSlug: cleanText(formData.get('org_slug'), 120) || undefined,
    })
    if (!['owner', 'admin'].includes(context.role)) {
      throw new Error('Hanya owner atau admin yang dapat mengonfirmasi penyelesaian refund.')
    }
    if (formData.get('confirm_refund') !== 'true') {
      throw new Error('Konfirmasi bahwa dana sudah dikembalikan sebelum menyelesaikan refund.')
    }
    const engagementId = cleanText(formData.get('engagement_id'), 80)
    const refund = await queryPostgres<{ id: string }>(
      `SELECT refund.id::text
       FROM public.consulting_engagements engagement
       JOIN public.commerce_refunds refund
         ON refund.org_id = engagement.org_id
        AND refund.order_id = engagement.order_id
       WHERE engagement.org_id = $1::uuid
         AND engagement.id = $2::uuid
         AND refund.status IN ('PENDING', 'PROCESSING')
       ORDER BY refund.created_at DESC
       LIMIT 1`,
      [context.orgId, engagementId],
    )
    const refundId = refund.rows[0]?.id
    if (!refundId) throw new Error('Refund yang menunggu konfirmasi tidak ditemukan.')

    await finalizeCommerceRefund({
      orgId: context.orgId,
      refundId,
      actorUserId: context.userId,
      idempotencyKey: `finalize-refund:${refundId}`,
    })
    revalidateConsultingPaths(context.orgSlug)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Penyelesaian refund gagal.',
    }
  }
}
