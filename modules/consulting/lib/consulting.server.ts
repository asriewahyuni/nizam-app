/**
 * Mesin utama Consulting 360: katalog publik, ketersediaan, hold jadwal,
 * aktivasi setelah pembayaran, portal, penyelesaian, badge, dan refund.
 */
import 'server-only'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import type {
  ConsultingAdminOffering,
  ConsultingAdminOverview,
  ConsultingAvailabilitySlot,
  ConsultingHoldResult,
  ConsultingPortalEngagement,
  PublicBadgeVerification,
  PublicConsultingOffering,
} from './consulting'

type PublicOfferingRow = {
  id: string
  store_product_id: string
  commercial_name: string
  session_count: number
  duration_minutes: number
  timezone: string
  booking_horizon_days: number
  minimum_notice_hours: number
  reschedule_limit: number
  reschedule_cutoff_hours: number
  no_show_consumes_session: boolean
  delivery_mode: 'ONLINE' | 'OFFLINE' | 'HYBRID'
  location_name: string | null
  intake_form_schema: unknown
  badge_title: string | null
  badge_description: string | null
  badge_primary_color: string | null
  badge_accent_color: string | null
  consultant_id: string | null
  consultant_display_name: string | null
  consultant_headline: string | null
  consultant_biography: string | null
  consultant_avatar_url: string | null
  consultant_expertise: string[] | null
}

type AvailabilityContext = {
  org_id: string
  store_id: string
  store_product_id: string
  offering_id: string
  consultant_id: string
  session_count: number
  duration_minutes: number
  timezone: string
  booking_horizon_days: number
  minimum_notice_hours: number
  intake_form_schema: unknown
}

type AvailabilityRuleRow = {
  weekday: number
  start_local: string
  end_local: string
  valid_from: string | null
  valid_until: string | null
}

type AvailabilityExceptionRow = {
  exception_type: 'AVAILABLE' | 'BLOCKED'
  starts_at: string
  ends_at: string
}

type BusySlotRow = {
  starts_at: string
  ends_at: string
}

function cleanText(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function cleanHexColor(value: unknown, fallback: string) {
  const color = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback
}

function parseIntakeFields(value: unknown): PublicConsultingOffering['intakeFields'] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => ({
      key: cleanText(item.key, 80) || `field_${index + 1}`,
      label: cleanText(item.label, 160) || `Pertanyaan ${index + 1}`,
      required: Boolean(item.required),
      placeholder: cleanText(item.placeholder, 240),
    }))
}

function hashHoldToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function enforceConsultingPublicRateLimit(input: {
  orgSlug: string
  storeSlug: string
  actionType: 'CONSULTING_AVAILABILITY' | 'CONSULTING_HOLD'
  scopeKey: string
  ipAddress?: string | null
  limit: number
}) {
  const context = await queryPostgres<{ org_id: string; store_id: string }>(
    `SELECT organization.id::text AS org_id, store.id::text AS store_id
     FROM public.organizations organization
     JOIN public.stores store
       ON store.org_id = organization.id
      AND store.slug = $2
      AND store.is_active = TRUE
      AND store.is_published = TRUE
     WHERE organization.slug = $1
       AND organization.is_active = TRUE
     LIMIT 1`,
    [cleanText(input.orgSlug, 120), cleanText(input.storeSlug, 120)],
  )
  const row = context.rows[0]
  if (!row) throw new Error('Store tidak ditemukan.')
  const safeScope = cleanText(input.scopeKey, 180)
  const safeIp = cleanText(input.ipAddress, 100).split(',')[0]?.trim() || null
  const count = await queryPostgres<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM public.ecommerce_public_request_logs
     WHERE action_type = $1
       AND scope_key = $2
       AND created_at >= NOW() - INTERVAL '10 minutes'
       AND ($3::text IS NULL OR ip_address = $3::text)`,
    [input.actionType, safeScope, safeIp],
  )
  if (Number(count.rows[0]?.total || 0) >= input.limit) {
    throw new Error('Terlalu banyak permintaan jadwal. Tunggu sebentar lalu coba lagi.')
  }
  await queryPostgres(
     `INSERT INTO public.ecommerce_public_request_logs (
       org_id, store_id, action_type, scope_key, ip_address
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
    [row.org_id, row.store_id, input.actionType, safeScope, safeIp],
  )
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function localPartsAt(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/**
 * Mengubah tanggal/jam lokal organisasi menjadi UTC tanpa dependensi tambahan.
 * Dua iterasi menjaga hasil tetap benar pada zona waktu dengan DST.
 */
function zonedLocalToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute, second] = time.split(':').map((item) => Number(item || 0))
  const desired = Date.UTC(year, month - 1, day, hour, minute, second)
  let candidate = new Date(desired)
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const actual = localPartsAt(candidate, timeZone)
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    )
    candidate = new Date(candidate.getTime() + (desired - actualAsUtc))
  }
  return candidate
}

function overlaps(
  start: Date,
  end: Date,
  busyStart: string | Date,
  busyEnd: string | Date,
) {
  return start.getTime() < new Date(busyEnd).getTime()
    && end.getTime() > new Date(busyStart).getTime()
}

function formatSlot(start: Date, end: Date, timeZone: string): ConsultingAvailabilitySlot {
  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    dateLabel: new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone,
    }).format(start),
    timeLabel: new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(start),
  }
}

async function resolveAvailabilityContext(input: {
  orgSlug: string
  storeSlug: string
  storeProductId: string
  consultantId: string
}): Promise<AvailabilityContext> {
  if (!isUuid(input.storeProductId) || !isUuid(input.consultantId)) {
    throw new Error('Produk atau konsultan tidak valid.')
  }
  const result = await queryPostgres<AvailabilityContext>(
    `SELECT
       organization.id::text AS org_id,
       store.id::text AS store_id,
       store_product.id::text AS store_product_id,
       offering.id::text AS offering_id,
       offering_consultant.consultant_id::text,
       offering.session_count,
       offering.duration_minutes,
       offering.timezone,
       offering.booking_horizon_days,
       offering.minimum_notice_hours,
       offering.intake_form_schema
     FROM public.organizations organization
     JOIN public.stores store
       ON store.org_id = organization.id
      AND store.slug = $2
      AND store.is_active = TRUE
      AND store.is_published = TRUE
     JOIN public.store_products store_product
       ON store_product.org_id = organization.id
      AND store_product.store_id = store.id
      AND store_product.id = $3::uuid
      AND store_product.is_published = TRUE
      AND store_product.offering_type = 'CONSULTING_1_ON_1'
     JOIN public.products product
       ON product.org_id = store_product.org_id
      AND product.id = store_product.product_id
      AND product.type = 'SERVICE'
      AND product.is_active = TRUE
     JOIN public.consulting_offerings offering
       ON offering.org_id = store_product.org_id
      AND offering.store_product_id = store_product.id
      AND offering.is_active = TRUE
     JOIN public.consulting_offering_consultants offering_consultant
       ON offering_consultant.org_id = offering.org_id
      AND offering_consultant.offering_id = offering.id
      AND offering_consultant.consultant_id = $4::uuid
      AND offering_consultant.is_active = TRUE
     JOIN public.learning_instructor_profiles instructor
       ON instructor.org_id = offering_consultant.org_id
      AND instructor.id = offering_consultant.consultant_id
      AND instructor.is_active = TRUE
     WHERE organization.slug = $1
       AND organization.is_active = TRUE
     LIMIT 1`,
    [input.orgSlug, input.storeSlug, input.storeProductId, input.consultantId],
  )
  const row = result.rows[0]
  if (!row) throw new Error('Paket atau konsultan Consulting 360 tidak ditemukan.')
  return row
}

async function loadAvailabilityRows(context: AvailabilityContext) {
  const [rules, exceptions, busy] = await Promise.all([
    queryPostgres<AvailabilityRuleRow>(
      `SELECT
         weekday,
         start_local::text,
         end_local::text,
         valid_from::text,
         valid_until::text
       FROM public.consulting_availability_rules
       WHERE org_id = $1::uuid
         AND offering_id = $2::uuid
         AND consultant_id = $3::uuid
         AND is_active = TRUE
       ORDER BY weekday, start_local`,
      [context.org_id, context.offering_id, context.consultant_id],
    ),
    queryPostgres<AvailabilityExceptionRow>(
      `SELECT exception_type, starts_at::text, ends_at::text
       FROM public.consulting_availability_exceptions
       WHERE org_id = $1::uuid
         AND consultant_id = $2::uuid
         AND (offering_id IS NULL OR offering_id = $3::uuid)
         AND ends_at >= NOW()
       ORDER BY starts_at`,
      [context.org_id, context.consultant_id, context.offering_id],
    ),
    queryPostgres<BusySlotRow>(
      `SELECT starts_at::text, ends_at::text
       FROM public.consulting_slot_holds
       WHERE org_id = $1::uuid
         AND consultant_id = $2::uuid
         AND status IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED')
         AND (
           status = 'CONFIRMED'
           OR held_until > NOW()
         )
         AND ends_at >= NOW()
       ORDER BY starts_at`,
      [context.org_id, context.consultant_id],
    ),
  ])
  return {
    rules: rules.rows,
    exceptions: exceptions.rows,
    busy: busy.rows,
  }
}

export async function getPublicConsultingAvailability(input: {
  orgSlug: string
  storeSlug: string
  storeProductId: string
  consultantId: string
  fromDate?: string
  toDate?: string
}) {
  const context = await resolveAvailabilityContext(input)
  const rows = await loadAvailabilityRows(context)
  const now = new Date()
  const noticeAt = new Date(now.getTime() + context.minimum_notice_hours * 60 * 60 * 1000)
  const todayLocal = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: context.timezone,
  }).format(now)
  const todayDate = new Date(`${todayLocal}T00:00:00.000Z`)
  const requestedStart = /^\d{4}-\d{2}-\d{2}$/.test(input.fromDate || '')
    ? new Date(`${input.fromDate}T00:00:00.000Z`)
    : todayDate
  const startDate = requestedStart < todayDate ? todayDate : requestedStart
  const startKey = dateKey(startDate)
  const maximumEnd = addDays(todayDate, context.booking_horizon_days)
  const requestedEnd = /^\d{4}-\d{2}-\d{2}$/.test(input.toDate || '')
    ? new Date(`${input.toDate}T00:00:00.000Z`)
    : maximumEnd
  const endDate = requestedEnd < maximumEnd ? requestedEnd : maximumEnd
  const segments: Array<{ start: Date; end: Date }> = []

  for (
    let cursor = startDate;
    cursor <= endDate;
    cursor = addDays(cursor, 1)
  ) {
    const dayKey = dateKey(cursor)
    const weekday = cursor.getUTCDay()
    for (const rule of rows.rules) {
      if (rule.weekday !== weekday) continue
      if (rule.valid_from && dayKey < rule.valid_from) continue
      if (rule.valid_until && dayKey > rule.valid_until) continue
      segments.push({
        start: zonedLocalToUtc(dayKey, rule.start_local, context.timezone),
        end: zonedLocalToUtc(dayKey, rule.end_local, context.timezone),
      })
    }
  }

  for (const exception of rows.exceptions) {
    if (exception.exception_type !== 'AVAILABLE') continue
    const exceptionDay = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: context.timezone,
    }).format(new Date(exception.starts_at))
    if (exceptionDay < startKey || exceptionDay > dateKey(endDate)) continue
    segments.push({
      start: new Date(exception.starts_at),
      end: new Date(exception.ends_at),
    })
  }

  const blocked = rows.exceptions.filter((item) => item.exception_type === 'BLOCKED')
  const durationMs = context.duration_minutes * 60 * 1000
  const slots: ConsultingAvailabilitySlot[] = []
  const seen = new Set<string>()
  for (const segment of segments) {
    for (
      let start = new Date(segment.start);
      start.getTime() + durationMs <= segment.end.getTime();
      start = new Date(start.getTime() + durationMs)
    ) {
      const end = new Date(start.getTime() + durationMs)
      if (start < noticeAt || end <= now) continue
      if (blocked.some((item) => overlaps(start, end, item.starts_at, item.ends_at))) continue
      if (rows.busy.some((item) => overlaps(start, end, item.starts_at, item.ends_at))) continue
      const key = start.toISOString()
      if (seen.has(key)) continue
      seen.add(key)
      slots.push(formatSlot(start, end, context.timezone))
    }
  }

  return {
    offeringId: context.offering_id,
    consultantId: context.consultant_id,
    sessionCount: context.session_count,
    durationMinutes: context.duration_minutes,
    timezone: context.timezone,
    slots: slots.sort((left, right) => left.startsAt.localeCompare(right.startsAt)).slice(0, 180),
  }
}

export async function getPublicConsultingOfferings(
  orgId: string,
  storeProductIds: string[],
): Promise<Map<string, PublicConsultingOffering>> {
  if (storeProductIds.length === 0) return new Map()
  const result = await queryPostgres<PublicOfferingRow>(
    `SELECT
       offering.id::text,
       offering.store_product_id::text,
       offering.commercial_name,
       offering.session_count,
       offering.duration_minutes,
       offering.timezone,
       offering.booking_horizon_days,
       offering.minimum_notice_hours,
       offering.reschedule_limit,
       offering.reschedule_cutoff_hours,
       offering.no_show_consumes_session,
       offering.delivery_mode,
       offering.location_name,
       offering.intake_form_schema,
       badge.title AS badge_title,
       badge.description AS badge_description,
       badge.primary_color AS badge_primary_color,
       badge.accent_color AS badge_accent_color,
       instructor.id::text AS consultant_id,
       instructor.display_name AS consultant_display_name,
       instructor.headline AS consultant_headline,
       instructor.biography AS consultant_biography,
       instructor.avatar_url AS consultant_avatar_url,
       instructor.expertise AS consultant_expertise
     FROM public.consulting_offerings offering
     LEFT JOIN public.learning_badge_templates badge
       ON badge.id = offering.badge_template_id
      AND badge.org_id = offering.org_id
      AND badge.is_active = TRUE
     LEFT JOIN public.consulting_offering_consultants offering_consultant
       ON offering_consultant.org_id = offering.org_id
      AND offering_consultant.offering_id = offering.id
      AND offering_consultant.is_active = TRUE
     LEFT JOIN public.learning_instructor_profiles instructor
       ON instructor.org_id = offering_consultant.org_id
      AND instructor.id = offering_consultant.consultant_id
      AND instructor.is_active = TRUE
     WHERE offering.org_id = $1::uuid
       AND offering.store_product_id = ANY($2::uuid[])
       AND offering.is_active = TRUE
     ORDER BY offering.store_product_id, offering_consultant.sort_order, instructor.display_name`,
    [orgId, storeProductIds],
  )
  const byProduct = new Map<string, PublicConsultingOffering>()
  for (const row of result.rows) {
    let offering = byProduct.get(row.store_product_id)
    if (!offering) {
      offering = {
        id: row.id,
        commercialName: row.commercial_name,
        sessionCount: Number(row.session_count),
        durationMinutes: Number(row.duration_minutes),
        timezone: row.timezone,
        bookingHorizonDays: Number(row.booking_horizon_days),
        minimumNoticeHours: Number(row.minimum_notice_hours),
        rescheduleLimit: Number(row.reschedule_limit),
        rescheduleCutoffHours: Number(row.reschedule_cutoff_hours),
        noShowConsumesSession: Boolean(row.no_show_consumes_session),
        deliveryMode: row.delivery_mode,
        locationName: cleanText(row.location_name),
        intakeFields: parseIntakeFields(row.intake_form_schema),
        badge: row.badge_title
          ? {
              title: row.badge_title,
              description: cleanText(row.badge_description, 1000),
              primaryColor: row.badge_primary_color || '#0F766E',
              accentColor: row.badge_accent_color || '#CA8A04',
            }
          : null,
        consultants: [],
      }
      byProduct.set(row.store_product_id, offering)
    }
    if (row.consultant_id) {
      offering.consultants.push({
        id: row.consultant_id,
        displayName: cleanText(row.consultant_display_name, 160),
        headline: cleanText(row.consultant_headline, 200),
        biography: cleanText(row.consultant_biography, 3000),
        avatarUrl: cleanText(row.consultant_avatar_url, 500),
        expertise: row.consultant_expertise || [],
      })
    }
  }
  return byProduct
}

export async function createConsultingSlotHold(input: {
  orgSlug: string
  storeSlug: string
  storeProductId: string
  consultantId: string
  startsAt: string[]
  intakeAnswers?: Record<string, unknown>
  goals?: string | null
}): Promise<ConsultingHoldResult> {
  const context = await resolveAvailabilityContext(input)
  const selectedStarts = [...new Set(input.startsAt.map((value) => new Date(value).toISOString()))]
  if (selectedStarts.length !== context.session_count) {
    throw new Error(`Pilih tepat ${context.session_count} jadwal konsultasi.`)
  }
  const availability = await getPublicConsultingAvailability(input)
  const availableByStart = new Map(availability.slots.map((slot) => [slot.startsAt, slot]))
  const selectedSlots = selectedStarts.map((startsAt) => {
    const slot = availableByStart.get(startsAt)
    if (!slot) throw new Error('Ada jadwal yang sudah tidak tersedia. Silakan pilih ulang.')
    return slot
  })
  const intakeFields = parseIntakeFields(context.intake_form_schema)
  const intakeAnswers = Object.fromEntries(
    intakeFields.map((field) => [
      field.key,
      cleanText(input.intakeAnswers?.[field.key], 2000),
    ]),
  )
  const missingRequired = intakeFields.find(
    (field) => field.required && !intakeAnswers[field.key],
  )
  if (missingRequired) {
    throw new Error(`Isi dahulu: ${missingRequired.label}.`)
  }

  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashHoldToken(token)
  const groupId = randomUUID()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`consulting:${context.org_id}:${context.consultant_id}`],
    )
    await client.query(
      `UPDATE public.consulting_slot_holds
       SET status = 'EXPIRED', updated_at = NOW()
       WHERE org_id = $1::uuid
         AND consultant_id = $2::uuid
         AND status = 'HELD'
         AND held_until <= NOW()`,
      [context.org_id, context.consultant_id],
    )
    for (const slot of selectedSlots) {
      await client.query(
        `INSERT INTO public.consulting_slot_holds (
           org_id, offering_id, consultant_id, hold_group_id, token_hash,
           starts_at, ends_at, status, held_until, intake_answers, goals
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
           $6::timestamptz, $7::timestamptz, 'HELD', $8::timestamptz,
           $9::jsonb, $10
         )`,
        [
          context.org_id,
          context.offering_id,
          context.consultant_id,
          groupId,
          tokenHash,
          slot.startsAt,
          slot.endsAt,
          expiresAt,
          JSON.stringify(intakeAnswers),
          input.goals?.trim() || null,
        ],
      )
    }
    await client.query('COMMIT')
    return {
      holdToken: token,
      expiresAt,
      offeringId: context.offering_id,
      consultantId: context.consultant_id,
      slots: selectedSlots,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    if ((error as { code?: string }).code === '23P01') {
      throw new Error('Salah satu jadwal baru saja dipilih orang lain. Silakan pilih ulang.')
    }
    throw error
  } finally {
    client.release()
  }
}

export async function validateConsultingHoldsForCheckout(
  client: PoolClient,
  input: {
    orgId: string
    storeId: string
    storeProductIds: string[]
    holdTokens: string[]
  },
) {
  const consultingProducts = await client.query<{
    store_product_id: string
    offering_id: string
    session_count: number
  }>(
    `SELECT
       store_product.id::text AS store_product_id,
       offering.id::text AS offering_id,
       offering.session_count
     FROM public.store_products store_product
     JOIN public.consulting_offerings offering
       ON offering.org_id = store_product.org_id
      AND offering.store_product_id = store_product.id
      AND offering.is_active = TRUE
     WHERE store_product.org_id = $1::uuid
       AND store_product.store_id = $2::uuid
       AND store_product.id = ANY($3::uuid[])
       AND store_product.offering_type = 'CONSULTING_1_ON_1'`,
    [input.orgId, input.storeId, input.storeProductIds],
  )
  if (consultingProducts.rows.length === 0) return []
  if (input.holdTokens.length !== consultingProducts.rows.length) {
    throw new Error('Pilih konsultan dan seluruh jadwal Consulting 360 sebelum checkout.')
  }
  const tokenHashes = input.holdTokens.map(hashHoldToken)
  await client.query(
    `SELECT id
     FROM public.consulting_slot_holds
     WHERE org_id = $1::uuid
       AND token_hash = ANY($2::text[])
     FOR UPDATE`,
    [input.orgId, tokenHashes],
  )
  const holds = await client.query<{
    hold_group_id: string
    token_hash: string
    offering_id: string
    store_product_id: string
    slot_count: number
  }>(
    `SELECT
       hold.hold_group_id::text,
       hold.token_hash,
       hold.offering_id::text,
       offering.store_product_id::text,
       COUNT(*)::int AS slot_count
     FROM public.consulting_slot_holds hold
     JOIN public.consulting_offerings offering
       ON offering.org_id = hold.org_id
      AND offering.id = hold.offering_id
     WHERE hold.org_id = $1::uuid
       AND hold.token_hash = ANY($2::text[])
       AND hold.status = 'HELD'
       AND hold.held_until > NOW()
     GROUP BY hold.hold_group_id, hold.token_hash, hold.offering_id, offering.store_product_id`,
    [input.orgId, tokenHashes],
  )
  for (const product of consultingProducts.rows) {
    const group = holds.rows.find((row) => row.store_product_id === product.store_product_id)
    if (!group || Number(group.slot_count) !== Number(product.session_count)) {
      throw new Error('Penahanan jadwal Consulting 360 sudah kedaluwarsa. Silakan pilih ulang.')
    }
  }
  return holds.rows
}

export async function attachConsultingHoldsToOrder(
  client: PoolClient,
  input: {
    orgId: string
    orderId: string
    paymentDueAt: string | null
    holdTokens: string[]
  },
) {
  if (input.holdTokens.length === 0) return
  const tokenHashes = input.holdTokens.map(hashHoldToken)
  const result = await client.query(
    `UPDATE public.consulting_slot_holds hold
     SET
       status = 'PENDING_PAYMENT',
       order_id = $2::uuid,
       order_item_id = order_item.id,
       held_until = COALESCE($3::timestamptz, NOW() + INTERVAL '10 minutes'),
       updated_at = NOW()
     FROM public.consulting_offerings offering
     JOIN public.store_products store_product
       ON store_product.org_id = offering.org_id
      AND store_product.id = offering.store_product_id
     JOIN public.stores store
       ON store.org_id = store_product.org_id
      AND store.id = store_product.store_id
     JOIN public.ecommerce_order_items order_item
       ON order_item.org_id = store_product.org_id
      AND order_item.order_id = $2::uuid
      AND order_item.store_id = store_product.store_id
      AND order_item.product_id = store_product.product_id
     WHERE hold.org_id = $1::uuid
       AND hold.offering_id = offering.id
       AND hold.token_hash = ANY($4::text[])
       AND hold.status = 'HELD'`,
    [input.orgId, input.orderId, input.paymentDueAt, tokenHashes],
  )
  if ((result.rowCount || 0) === 0) {
    throw new Error('Jadwal Consulting 360 gagal ditautkan ke pesanan.')
  }
}

async function enqueueConsultingConfirmation(
  client: PoolClient,
  input: {
    orgId: string
    userId: string
    orderId: string
    orderNumber: string
    programName: string
    sessionCount: number
  },
) {
  const identity = await client.query<{
    email: string | null
    phone: string | null
  }>(
    `SELECT
       COALESCE(internal_user.login_email, ecommerce_order.customer_email) AS email,
       ecommerce_order.customer_phone AS phone
     FROM public.ecommerce_orders ecommerce_order
     LEFT JOIN LATERAL (
       SELECT auth_user.login_email
       FROM public.internal_auth_users auth_user
       WHERE auth_user.id = $1::uuid
          OR auth_user.legacy_user_id = $1::uuid
       ORDER BY CASE WHEN auth_user.id = $1::uuid THEN 0 ELSE 1 END
       LIMIT 1
     ) internal_user ON TRUE
     WHERE ecommerce_order.org_id = $2::uuid
       AND ecommerce_order.id = $3::uuid
     LIMIT 1`,
    [input.userId, input.orgId, input.orderId],
  )
  const recipients = [
    identity.rows[0]?.email
      ? { channel: 'EMAIL', value: identity.rows[0].email, provider: 'MAILKETING' }
      : null,
    identity.rows[0]?.phone
      ? { channel: 'WHATSAPP', value: identity.rows[0].phone, provider: 'FONNTE' }
      : null,
  ].filter((item): item is { channel: string; value: string; provider: string } => Boolean(item))
  for (const recipient of recipients) {
    await client.query(
      `INSERT INTO public.notification_outbox (
         org_id, user_id, event_type, channel, provider_code,
         recipient, subject, body, payload, idempotency_key
       ) VALUES (
         $1::uuid, $2::uuid, 'CONSULTING_CONFIRMED', $3, $4,
         $5, $6, $7, $8::jsonb, $9
       )
       ON CONFLICT (org_id, idempotency_key) DO NOTHING`,
      [
        input.orgId,
        input.userId,
        recipient.channel,
        recipient.provider,
        recipient.value,
        `Jadwal ${input.programName} terkonfirmasi`,
        `${input.sessionCount} sesi Consulting 360 Anda sudah terkonfirmasi. Buka portal member untuk melihat jadwal.`,
        JSON.stringify({
          orderId: input.orderId,
          orderNumber: input.orderNumber,
          programName: input.programName,
          sessionCount: input.sessionCount,
        }),
        `consulting-confirmed:${input.orderId}:${recipient.channel}`,
      ],
    )
  }
}

export async function activateConsultingOrder(
  client: PoolClient,
  input: { orgId: string; orderId: string },
) {
  const groups = await client.query<{
    offering_id: string
    order_item_id: string
    user_id: string
    consultant_id: string
    session_count: number
    duration_minutes: number
    delivery_mode: 'ONLINE' | 'OFFLINE' | 'HYBRID'
    location_name: string | null
    default_meeting_url: string | null
    meeting_provider: string | null
    program_name: string
    order_number: string
    intake_answers: Record<string, unknown> | null
    goals: string | null
  }>(
    `SELECT DISTINCT
       offering.id::text AS offering_id,
       hold.order_item_id::text,
       ecommerce_order.user_id::text,
       hold.consultant_id::text,
       offering.session_count,
       offering.duration_minutes,
       offering.delivery_mode,
       offering.location_name,
       offering.default_meeting_url,
       offering.meeting_provider,
       store_product.public_name AS program_name,
       ecommerce_order.order_number,
       (
         SELECT first_hold.intake_answers
         FROM public.consulting_slot_holds first_hold
         WHERE first_hold.org_id = hold.org_id
           AND first_hold.order_id = hold.order_id
           AND first_hold.offering_id = hold.offering_id
         ORDER BY first_hold.starts_at
         LIMIT 1
       ) AS intake_answers,
       (
         SELECT first_hold.goals
         FROM public.consulting_slot_holds first_hold
         WHERE first_hold.org_id = hold.org_id
           AND first_hold.order_id = hold.order_id
           AND first_hold.offering_id = hold.offering_id
         ORDER BY first_hold.starts_at
         LIMIT 1
       ) AS goals
     FROM public.consulting_slot_holds hold
     JOIN public.consulting_offerings offering
       ON offering.org_id = hold.org_id
      AND offering.id = hold.offering_id
     JOIN public.store_products store_product
       ON store_product.org_id = offering.org_id
      AND store_product.id = offering.store_product_id
     JOIN public.ecommerce_orders ecommerce_order
       ON ecommerce_order.org_id = hold.org_id
      AND ecommerce_order.id = hold.order_id
     WHERE hold.org_id = $1::uuid
       AND hold.order_id = $2::uuid
       AND hold.status IN ('PENDING_PAYMENT', 'CONFIRMED')`,
    [input.orgId, input.orderId],
  )
  const engagementIds: string[] = []
  for (const group of groups.rows) {
    if (!group.user_id || !group.order_item_id) {
      throw new Error('Identitas member atau item Consulting 360 belum terhubung.')
    }
    const engagementResult = await client.query<{ id: string }>(
      `INSERT INTO public.consulting_engagements (
         org_id, offering_id, order_id, order_item_id, user_id, consultant_id,
         status, session_count, duration_minutes, intake_answers, goals
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
         'ACTIVE', $7, $8, $9::jsonb, $10
       )
       ON CONFLICT (org_id, order_item_id) DO UPDATE
       SET updated_at = NOW()
       RETURNING id::text`,
      [
        input.orgId,
        group.offering_id,
        input.orderId,
        group.order_item_id,
        group.user_id,
        group.consultant_id,
        group.session_count,
        group.duration_minutes,
        JSON.stringify(group.intake_answers ?? {}),
        group.goals,
      ],
    )
    const engagementId = engagementResult.rows[0].id
    engagementIds.push(engagementId)
    const holds = await client.query<{
      id: string
      starts_at: string
      ends_at: string
      employee_id: string | null
    }>(
      `SELECT
         hold.id::text,
         hold.starts_at::text,
         hold.ends_at::text,
         instructor.employee_id::text
       FROM public.consulting_slot_holds hold
       JOIN public.learning_instructor_profiles instructor
         ON instructor.org_id = hold.org_id
        AND instructor.id = hold.consultant_id
       WHERE hold.org_id = $1::uuid
         AND hold.order_id = $2::uuid
         AND hold.order_item_id = $3::uuid
       ORDER BY hold.starts_at
       FOR UPDATE OF hold`,
      [input.orgId, input.orderId, group.order_item_id],
    )
    for (const [index, hold] of holds.rows.entries()) {
      const session = await client.query<{ id: string }>(
        `INSERT INTO public.consulting_sessions (
           org_id, engagement_id, slot_hold_id, sequence_number,
           user_id, consultant_id, employee_id, starts_at, ends_at,
           delivery_mode, location_name, meeting_url, meeting_provider
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4,
           $5::uuid, $6::uuid, $7::uuid, $8::timestamptz, $9::timestamptz,
           $10, $11, $12, $13
         )
         ON CONFLICT (org_id, slot_hold_id) DO UPDATE
         SET updated_at = NOW()
         RETURNING id::text`,
        [
          input.orgId,
          engagementId,
          hold.id,
          index + 1,
          group.user_id,
          group.consultant_id,
          hold.employee_id,
          hold.starts_at,
          hold.ends_at,
          group.delivery_mode,
          group.location_name,
          group.default_meeting_url,
          group.meeting_provider,
        ],
      )
      await client.query(
        `INSERT INTO public.consulting_session_history (
           org_id, session_id, action, new_starts_at, new_ends_at,
           idempotency_key, metadata
         ) VALUES (
           $1::uuid, $2::uuid, 'CREATED', $3::timestamptz, $4::timestamptz,
           $5, $6::jsonb
         )
         ON CONFLICT (org_id, idempotency_key)
           WHERE idempotency_key IS NOT NULL
         DO NOTHING`,
        [
          input.orgId,
          session.rows[0].id,
          hold.starts_at,
          hold.ends_at,
          `consulting-session-created:${session.rows[0].id}`,
          JSON.stringify({ orderId: input.orderId }),
        ],
      )
    }
    await client.query(
      `UPDATE public.consulting_slot_holds
       SET status = 'CONFIRMED', held_until = GREATEST(held_until, ends_at),
           updated_at = NOW()
       WHERE org_id = $1::uuid
         AND order_id = $2::uuid
         AND order_item_id = $3::uuid`,
      [input.orgId, input.orderId, group.order_item_id],
    )
    await enqueueConsultingConfirmation(client, {
      orgId: input.orgId,
      userId: group.user_id,
      orderId: input.orderId,
      orderNumber: group.order_number,
      programName: group.program_name,
      sessionCount: group.session_count,
    })
  }
  return engagementIds
}

export async function cancelConsultingOrderForRefund(
  client: PoolClient,
  input: {
    orgId: string
    orderId: string
    actorUserId: string
    reason: string
  },
) {
  const engagements = await client.query<{ id: string; badge_award_id: string | null }>(
    `SELECT id::text, badge_award_id::text
     FROM public.consulting_engagements
     WHERE org_id = $1::uuid
       AND order_id = $2::uuid
     FOR UPDATE`,
    [input.orgId, input.orderId],
  )
  if (engagements.rows.length === 0) {
    await client.query(
      `UPDATE public.consulting_slot_holds
       SET status = 'RELEASED', updated_at = NOW()
       WHERE org_id = $1::uuid
         AND order_id = $2::uuid
         AND status IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED')`,
      [input.orgId, input.orderId],
    )
    return
  }
  const engagementIds = engagements.rows.map((row) => row.id)
  await client.query(
    `INSERT INTO public.consulting_session_history (
       org_id, session_id, action, actor_user_id, reason,
       idempotency_key, metadata
     )
     SELECT
       session.org_id,
       session.id,
       'CANCELLED',
       $3::uuid,
       $4,
       'consulting-refund-cancel:' || session.id::text,
       jsonb_build_object('orderId', $5::text)
     FROM public.consulting_sessions session
     WHERE session.org_id = $1::uuid
       AND session.engagement_id = ANY($2::uuid[])
       AND session.status = 'SCHEDULED'
     ON CONFLICT (org_id, idempotency_key)
       WHERE idempotency_key IS NOT NULL
     DO NOTHING`,
    [input.orgId, engagementIds, input.actorUserId, input.reason, input.orderId],
  )
  await client.query(
    `UPDATE public.consulting_sessions
     SET status = 'CANCELLED', updated_at = NOW()
     WHERE org_id = $1::uuid
       AND engagement_id = ANY($2::uuid[])
       AND status = 'SCHEDULED'`,
    [input.orgId, engagementIds],
  )
  await client.query(
    `UPDATE public.consulting_slot_holds
     SET status = 'RELEASED', updated_at = NOW()
     WHERE org_id = $1::uuid
       AND order_id = $2::uuid
       AND status IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED')`,
    [input.orgId, input.orderId],
  )
  await client.query(
    `UPDATE public.consulting_engagements
     SET status = 'REFUNDED', cancelled_at = NOW(), updated_at = NOW()
     WHERE org_id = $1::uuid
       AND id = ANY($2::uuid[])`,
    [input.orgId, engagementIds],
  )
  const badgeIds = engagements.rows
    .map((row) => row.badge_award_id)
    .filter((id): id is string => Boolean(id))
  if (badgeIds.length > 0) {
    await client.query(
      `UPDATE public.learning_badge_awards
       SET
         status = 'REVOKED',
         revoked_at = NOW(),
         revoked_by = $3::uuid,
         revoked_reason = $4,
         updated_at = NOW()
       WHERE org_id = $1::uuid
         AND id = ANY($2::uuid[])
         AND status = 'ACTIVE'`,
      [input.orgId, badgeIds, input.actorUserId, input.reason],
    )
  }
}

export async function expireConsultingHoldsAndOrders() {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    const expiredHolds = await client.query(
      `UPDATE public.consulting_slot_holds
       SET status = CASE WHEN status = 'HELD' THEN 'EXPIRED' ELSE 'RELEASED' END,
           updated_at = NOW()
       WHERE status IN ('HELD', 'PENDING_PAYMENT')
         AND held_until <= NOW()`,
    )
    const expiredOrders = await client.query<{ id: string; org_id: string }>(
      `UPDATE public.ecommerce_orders ecommerce_order
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE ecommerce_order.status = 'AWAITING_PAYMENT'
         AND ecommerce_order.payment_due_at IS NOT NULL
         AND ecommerce_order.payment_due_at <= NOW()
         AND EXISTS (
           SELECT 1
           FROM public.consulting_slot_holds hold
           WHERE hold.org_id = ecommerce_order.org_id
             AND hold.order_id = ecommerce_order.id
             AND hold.status IN ('RELEASED', 'EXPIRED')
         )
       RETURNING ecommerce_order.id::text, ecommerce_order.org_id::text`,
    )
    for (const order of expiredOrders.rows) {
      await client.query(
        `INSERT INTO public.ecommerce_order_events (
           org_id, order_id, actor_label, event_type, message, payload
         ) VALUES (
           $1::uuid, $2::uuid, 'SYSTEM', 'ORDER_EXPIRED',
           'Pesanan Consulting 360 kedaluwarsa dan seluruh jadwal dilepas.',
           '{}'::jsonb
         )`,
        [order.org_id, order.id],
      )
    }
    await client.query('COMMIT')
    return {
      expiredHolds: expiredHolds.rowCount || 0,
      expiredOrders: expiredOrders.rowCount || 0,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function releaseConsultingOrderHolds(input: {
  orgId: string
  orderId: string
  reason: string
}) {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    const released = await client.query(
      `UPDATE public.consulting_slot_holds
       SET status = 'RELEASED', updated_at = NOW()
       WHERE org_id = $1::uuid
         AND order_id = $2::uuid
         AND status IN ('HELD', 'PENDING_PAYMENT')`,
      [input.orgId, input.orderId],
    )
    if ((released.rowCount || 0) > 0) {
      await client.query(
        `UPDATE public.ecommerce_orders
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE org_id = $1::uuid
           AND id = $2::uuid
           AND status = 'AWAITING_PAYMENT'`,
        [input.orgId, input.orderId],
      )
      await client.query(
        `INSERT INTO public.ecommerce_order_events (
           org_id, order_id, actor_label, event_type, message, payload
         ) VALUES (
           $1::uuid, $2::uuid, 'SYSTEM', 'CONSULTING_SLOTS_RELEASED',
           $3, $4::jsonb
         )`,
        [
          input.orgId,
          input.orderId,
          input.reason,
          JSON.stringify({ releasedSlots: released.rowCount }),
        ],
      )
    }
    await client.query('COMMIT')
    return released.rowCount || 0
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function queryPortalEngagements(
  orgId: string,
  options: {
    userId?: string
    consultantId?: string
    includeAll?: boolean
    includeInternalNotes?: boolean
  },
): Promise<ConsultingPortalEngagement[]> {
  const engagementResult = await queryPostgres<{
    id: string
    offering_id: string
    store_product_id: string
    store_slug: string
    product_name: string
    product_slug: string
    order_number: string
    member_name: string
    member_email: string
    user_id: string
    consultant_id: string
    consultant_name: string
    consultant_headline: string | null
    consultant_avatar_url: string | null
    status: ConsultingPortalEngagement['status']
    session_count: number
    completed_session_count: number
    duration_minutes: number
    timezone: string
    goals: string | null
    action_plan: string | null
    progress_summary: string | null
    final_summary: string | null
    reschedule_limit: number
    reschedule_cutoff_hours: number
    no_show_consumes_session: boolean
    completion_approved_at: string | null
    badge_title: string | null
    badge_number: string | null
    verification_token: string | null
    badge_status: string | null
    badge_awarded_at: string | null
    badge_primary_color: string | null
    badge_accent_color: string | null
  }>(
    `SELECT
       engagement.id::text,
       engagement.offering_id::text,
       offering.store_product_id::text,
       store.slug AS store_slug,
       store_product.public_name AS product_name,
       store_product.public_slug AS product_slug,
       ecommerce_order.order_number,
       ecommerce_order.customer_name AS member_name,
       COALESCE(ecommerce_order.customer_email, internal_user.login_email, '') AS member_email,
       engagement.user_id::text,
       engagement.consultant_id::text,
       instructor.display_name AS consultant_name,
       instructor.headline AS consultant_headline,
       instructor.avatar_url AS consultant_avatar_url,
       engagement.status,
       engagement.session_count,
       (
         SELECT COUNT(*)::int
         FROM public.consulting_sessions completed_session
         WHERE completed_session.org_id = engagement.org_id
           AND completed_session.engagement_id = engagement.id
           AND (
             completed_session.status = 'COMPLETED'
             OR (
               completed_session.status = 'NO_SHOW'
               AND offering.no_show_consumes_session = TRUE
             )
           )
       ) AS completed_session_count,
       engagement.duration_minutes,
       offering.timezone,
       engagement.goals,
       engagement.action_plan,
       engagement.progress_summary,
       engagement.final_summary,
       offering.reschedule_limit,
       offering.reschedule_cutoff_hours,
       offering.no_show_consumes_session,
       engagement.completion_approved_at::text,
       badge_template.title AS badge_title,
       badge_award.badge_number,
       badge_award.verification_token,
       badge_award.status AS badge_status,
       badge_award.awarded_at::text AS badge_awarded_at,
       badge_template.primary_color AS badge_primary_color,
       badge_template.accent_color AS badge_accent_color
     FROM public.consulting_engagements engagement
     JOIN public.consulting_offerings offering
       ON offering.org_id = engagement.org_id
      AND offering.id = engagement.offering_id
     JOIN public.store_products store_product
       ON store_product.org_id = offering.org_id
      AND store_product.id = offering.store_product_id
     JOIN public.stores store
       ON store.org_id = store_product.org_id
      AND store.id = store_product.store_id
     JOIN public.ecommerce_orders ecommerce_order
       ON ecommerce_order.org_id = engagement.org_id
      AND ecommerce_order.id = engagement.order_id
     JOIN public.learning_instructor_profiles instructor
       ON instructor.org_id = engagement.org_id
      AND instructor.id = engagement.consultant_id
     LEFT JOIN public.internal_auth_users internal_user
       ON internal_user.id = engagement.user_id
       OR internal_user.legacy_user_id = engagement.user_id
     LEFT JOIN public.learning_badge_awards badge_award
       ON badge_award.org_id = engagement.org_id
      AND badge_award.id = engagement.badge_award_id
     LEFT JOIN public.learning_badge_templates badge_template
       ON badge_template.org_id = engagement.org_id
      AND badge_template.id = badge_award.template_id
     WHERE engagement.org_id = $1::uuid
       AND (
         $2::uuid IS NULL
         OR engagement.user_id = $2::uuid
         OR engagement.user_id = (
           SELECT legacy_user_id
           FROM public.internal_auth_users
           WHERE id = $2::uuid
           LIMIT 1
         )
       )
       AND ($3::uuid IS NULL OR engagement.consultant_id = $3::uuid)
     ORDER BY engagement.created_at DESC`,
    [orgId, options.userId || null, options.consultantId || null],
  )
  const engagementIds = engagementResult.rows.map((row) => row.id)
  const sessions = engagementIds.length
    ? await queryPostgres<{
        id: string
        engagement_id: string
        sequence_number: number
        starts_at: string
        ends_at: string
        status: ConsultingPortalEngagement['sessions'][number]['status']
        attendance_status: string
        delivery_mode: ConsultingPortalEngagement['sessions'][number]['deliveryMode']
        location_name: string | null
        meeting_url: string | null
        meeting_provider: string | null
        reschedule_count: number
        internal_notes: string | null
        member_summary: string | null
      }>(
        `SELECT
           id::text,
           engagement_id::text,
           sequence_number,
           starts_at::text,
           ends_at::text,
           status,
           attendance_status,
           delivery_mode,
           location_name,
           meeting_url,
           meeting_provider,
           reschedule_count,
           internal_notes,
           member_summary
         FROM public.consulting_sessions
         WHERE org_id = $1::uuid
           AND engagement_id = ANY($2::uuid[])
         ORDER BY engagement_id, sequence_number`,
        [orgId, engagementIds],
      )
    : { rows: [] }
  return engagementResult.rows.map((row) => ({
    id: row.id,
    offeringId: row.offering_id,
    storeProductId: row.store_product_id,
    storeSlug: row.store_slug,
    productName: row.product_name,
    productSlug: row.product_slug,
    orderNumber: row.order_number,
    memberName: row.member_name,
    memberEmail: row.member_email,
    userId: row.user_id,
    consultantId: row.consultant_id,
    consultantName: row.consultant_name,
    consultantHeadline: cleanText(row.consultant_headline, 200),
    consultantAvatarUrl: cleanText(row.consultant_avatar_url, 500),
    status: row.status,
    sessionCount: Number(row.session_count),
    completedSessionCount: Number(row.completed_session_count),
    durationMinutes: Number(row.duration_minutes),
    timezone: row.timezone,
    goals: cleanText(row.goals, 5000),
    actionPlan: cleanText(row.action_plan, 10000),
    progressSummary: cleanText(row.progress_summary, 10000),
    finalSummary: cleanText(row.final_summary, 10000),
    rescheduleLimit: Number(row.reschedule_limit),
    rescheduleCutoffHours: Number(row.reschedule_cutoff_hours),
    noShowConsumesSession: Boolean(row.no_show_consumes_session),
    completionApprovedAt: row.completion_approved_at,
    badge: row.badge_number && row.verification_token && row.badge_title
      ? {
          title: row.badge_title,
          badgeNumber: row.badge_number,
          verificationToken: row.verification_token,
          status: row.badge_status || 'ACTIVE',
          awardedAt: row.badge_awarded_at || '',
          primaryColor: row.badge_primary_color || '#0F766E',
          accentColor: row.badge_accent_color || '#CA8A04',
        }
      : null,
    sessions: sessions.rows
      .filter((session) => session.engagement_id === row.id)
      .map((session) => ({
        id: session.id,
        sequenceNumber: Number(session.sequence_number),
        startsAt: session.starts_at,
        endsAt: session.ends_at,
        status: session.status,
        attendanceStatus: session.attendance_status,
        deliveryMode: session.delivery_mode,
        locationName: cleanText(session.location_name, 500),
        meetingUrl: cleanText(session.meeting_url, 1000),
        meetingProvider: cleanText(session.meeting_provider, 80),
        rescheduleCount: Number(session.reschedule_count),
        internalNotes: options.includeInternalNotes
          ? cleanText(session.internal_notes, 5000)
          : '',
        memberSummary: cleanText(session.member_summary, 5000),
      })),
  }))
}

export async function getMemberConsultingEngagements(orgId: string, userId: string) {
  return queryPortalEngagements(orgId, { userId })
}

export async function getConsultantEngagements(
  orgId: string,
  consultantId: string | null,
  includeAll: boolean,
) {
  if (!includeAll && !consultantId) return []
  return queryPortalEngagements(orgId, {
    consultantId: includeAll ? undefined : consultantId || undefined,
    includeAll,
    includeInternalNotes: true,
  })
}

export async function getConsultingAdminOverview(orgId: string): Promise<ConsultingAdminOverview> {
  const [offeringRows, consultantRows, badgeRows, engagements] = await Promise.all([
    queryPostgres<{
      id: string
      store_id: string
      store_product_id: string
      product_id: string
      public_name: string
      public_slug: string
      short_description: string | null
      public_description: string | null
      price: number
      is_published: boolean
      session_count: number
      duration_minutes: number
      timezone: string
      booking_horizon_days: number
      minimum_notice_hours: number
      reschedule_limit: number
      reschedule_cutoff_hours: number
      no_show_consumes_session: boolean
      delivery_mode: ConsultingAdminOffering['deliveryMode']
      location_name: string | null
      default_meeting_url: string | null
      meeting_provider: string | null
      badge_template_id: string | null
      consultant_ids: string[]
      weekdays: number[]
      start_local: string | null
      end_local: string | null
      course_ids: string[]
      package_ids: string[]
      intake_form_schema: unknown
      active_engagements: number
    }>(
      `SELECT
         offering.id::text,
         store_product.store_id::text,
         offering.store_product_id::text,
         store_product.product_id::text,
         store_product.public_name,
         store_product.public_slug,
         store_product.short_description,
         store_product.public_description,
         COALESCE(store_product.price_override, product.selling_price, 0)::float8 AS price,
         store_product.is_published,
         offering.session_count,
         offering.duration_minutes,
         offering.timezone,
         offering.booking_horizon_days,
         offering.minimum_notice_hours,
         offering.reschedule_limit,
         offering.reschedule_cutoff_hours,
         offering.no_show_consumes_session,
         offering.delivery_mode,
         offering.location_name,
         offering.default_meeting_url,
         offering.meeting_provider,
         offering.badge_template_id::text,
         offering.intake_form_schema,
         ARRAY(
           SELECT consultant.consultant_id::text
           FROM public.consulting_offering_consultants consultant
           WHERE consultant.org_id = offering.org_id
             AND consultant.offering_id = offering.id
             AND consultant.is_active = TRUE
           ORDER BY consultant.sort_order
         ) AS consultant_ids,
         ARRAY(
           SELECT DISTINCT rule.weekday
           FROM public.consulting_availability_rules rule
           WHERE rule.org_id = offering.org_id
             AND rule.offering_id = offering.id
             AND rule.is_active = TRUE
           ORDER BY rule.weekday
         ) AS weekdays,
         (
           SELECT MIN(rule.start_local)::text
           FROM public.consulting_availability_rules rule
           WHERE rule.org_id = offering.org_id
             AND rule.offering_id = offering.id
             AND rule.is_active = TRUE
         ) AS start_local,
         (
           SELECT MAX(rule.end_local)::text
           FROM public.consulting_availability_rules rule
           WHERE rule.org_id = offering.org_id
             AND rule.offering_id = offering.id
             AND rule.is_active = TRUE
         ) AS end_local,
         ARRAY(
           SELECT product_course.course_id::text
           FROM public.commerce_product_courses product_course
           WHERE product_course.org_id = offering.org_id
             AND product_course.store_product_id = offering.store_product_id
         ) AS course_ids,
         ARRAY(
           SELECT product_package.package_id::text
           FROM public.commerce_product_access_packages product_package
           WHERE product_package.org_id = offering.org_id
             AND product_package.store_product_id = offering.store_product_id
         ) AS package_ids,
         (
           SELECT COUNT(*)::int
           FROM public.consulting_engagements engagement
           WHERE engagement.org_id = offering.org_id
             AND engagement.offering_id = offering.id
             AND engagement.status IN ('ACTIVE', 'IN_PROGRESS', 'COMPLETION_PENDING')
         ) AS active_engagements
       FROM public.consulting_offerings offering
       JOIN public.store_products store_product
         ON store_product.org_id = offering.org_id
        AND store_product.id = offering.store_product_id
       JOIN public.products product
         ON product.org_id = store_product.org_id
        AND product.id = store_product.product_id
       WHERE offering.org_id = $1::uuid
       ORDER BY offering.created_at DESC`,
      [orgId],
    ),
    queryPostgres<{
      id: string
      user_id: string
      employee_id: string | null
      display_name: string
      headline: string | null
      biography: string | null
      avatar_url: string | null
      expertise: string[]
      employee_name: string | null
    }>(
      `SELECT
         instructor.id::text,
         instructor.user_id::text,
         instructor.employee_id::text,
         instructor.display_name,
         instructor.headline,
         instructor.biography,
         instructor.avatar_url,
         instructor.expertise,
         TRIM(CONCAT(employee.first_name, ' ', COALESCE(employee.last_name, ''))) AS employee_name
       FROM public.learning_instructor_profiles instructor
       LEFT JOIN public.employees employee
         ON employee.org_id = instructor.org_id
        AND employee.id = instructor.employee_id
       WHERE instructor.org_id = $1::uuid
         AND instructor.is_active = TRUE
       ORDER BY instructor.display_name`,
      [orgId],
    ),
    queryPostgres<{
      id: string
      name: string
      title: string
      description: string | null
      primary_color: string
      accent_color: string
    }>(
      `SELECT id::text, name, title, description, primary_color, accent_color
       FROM public.learning_badge_templates
       WHERE org_id = $1::uuid
         AND is_active = TRUE
       ORDER BY name`,
      [orgId],
    ),
    getConsultantEngagements(orgId, null, true),
  ])
  return {
    offerings: offeringRows.rows.map((row) => ({
      id: row.id,
      storeId: row.store_id,
      storeProductId: row.store_product_id,
      productId: row.product_id,
      publicName: row.public_name,
      publicSlug: row.public_slug,
      shortDescription: cleanText(row.short_description, 300),
      publicDescription: cleanText(row.public_description, 5000),
      price: Number(row.price),
      isPublished: Boolean(row.is_published),
      sessionCount: Number(row.session_count),
      durationMinutes: Number(row.duration_minutes),
      timezone: row.timezone,
      bookingHorizonDays: Number(row.booking_horizon_days),
      minimumNoticeHours: Number(row.minimum_notice_hours),
      rescheduleLimit: Number(row.reschedule_limit),
      rescheduleCutoffHours: Number(row.reschedule_cutoff_hours),
      noShowConsumesSession: Boolean(row.no_show_consumes_session),
      deliveryMode: row.delivery_mode,
      locationName: cleanText(row.location_name),
      defaultMeetingUrl: cleanText(row.default_meeting_url, 1000),
      meetingProvider: cleanText(row.meeting_provider, 80),
      badgeTemplateId: row.badge_template_id,
      consultantIds: row.consultant_ids || [],
      weekdays: (row.weekdays || []).map(Number),
      startLocal: cleanText(row.start_local, 8).slice(0, 5) || '09:00',
      endLocal: cleanText(row.end_local, 8).slice(0, 5) || '10:00',
      courseIds: row.course_ids || [],
      packageIds: row.package_ids || [],
      intakeFields: parseIntakeFields(row.intake_form_schema),
      activeEngagements: Number(row.active_engagements),
    })),
    consultants: consultantRows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      employeeId: row.employee_id,
      employeeName: cleanText(row.employee_name, 160),
      displayName: row.display_name,
      headline: cleanText(row.headline, 200),
      biography: cleanText(row.biography, 3000),
      avatarUrl: cleanText(row.avatar_url, 500),
      expertise: row.expertise || [],
    })),
    badgeTemplates: badgeRows.rows.map((row) => ({
      id: row.id,
      name: row.name,
      title: row.title,
      description: cleanText(row.description, 1000),
      primaryColor: row.primary_color,
      accentColor: row.accent_color,
    })),
    engagements,
  }
}

export async function getPublicBadgeVerification(token: string): Promise<PublicBadgeVerification | null> {
  if (!/^[a-f0-9]{48}$/i.test(token)) return null
  const result = await queryPostgres<{
    holder_name: string
    badge_title: string
    badge_description: string | null
    badge_number: string
    awarded_at: string
    status: 'ACTIVE' | 'REVOKED'
    program_name: string
    consultant_name: string
    primary_color: string
    accent_color: string
  }>(
    `SELECT
       COALESCE(internal_user.display_name, internal_user.login_email, 'Member') AS holder_name,
       template.title AS badge_title,
       template.description AS badge_description,
       award.badge_number,
       award.awarded_at::text,
       award.status,
       store_product.public_name AS program_name,
       instructor.display_name AS consultant_name,
       template.primary_color,
       template.accent_color
     FROM public.learning_badge_awards award
     JOIN public.learning_badge_templates template
       ON template.org_id = award.org_id
      AND template.id = award.template_id
     JOIN public.consulting_engagements engagement
       ON engagement.org_id = award.org_id
      AND engagement.id = award.source_id
      AND award.source_type = 'CONSULTING_ENGAGEMENT'
     JOIN public.consulting_offerings offering
       ON offering.org_id = engagement.org_id
      AND offering.id = engagement.offering_id
     JOIN public.store_products store_product
       ON store_product.org_id = offering.org_id
      AND store_product.id = offering.store_product_id
     JOIN public.learning_instructor_profiles instructor
       ON instructor.org_id = engagement.org_id
      AND instructor.id = engagement.consultant_id
     LEFT JOIN public.internal_auth_users internal_user
       ON internal_user.id = award.user_id
       OR internal_user.legacy_user_id = award.user_id
     WHERE award.verification_token = $1
     LIMIT 1`,
    [token],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    holderName: row.holder_name,
    badgeTitle: row.badge_title,
    badgeDescription: cleanText(row.badge_description, 1000),
    badgeNumber: row.badge_number,
    awardedAt: row.awarded_at,
    status: row.status,
    programName: row.program_name,
    consultantName: row.consultant_name,
    primaryColor: cleanHexColor(row.primary_color, '#0F766E'),
    accentColor: cleanHexColor(row.accent_color, '#CA8A04'),
  }
}
