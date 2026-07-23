/**
 * Handler importer Coreisec. Semua pencarian tenant selalu membawa org_id dan
 * semua hubungan sumber diselesaikan lewat migration_entity_map, bukan judul.
 */
import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import type { CoreisecEntityType, MigrationEnvelope } from './migration-types'
import {
  sanitizeLearningHtml,
  sanitizeQuizOptionHtml,
} from '../../modules/lms/lib/content-sanitizer'

const SOURCE_SYSTEM = 'WORDPRESS_COREISEC'

export type ImportContext = {
  client: PoolClient
  orgId: string
  storeId: string
  runId: string
}

export type ImportResult = {
  targetTable: string
  targetId: string
  metadata?: Record<string, unknown>
}

type MappingRow = {
  target_table: string
  target_id: string
  source_checksum: string | null
}

function stringValue(value: unknown, field: string, required = false) {
  const result = typeof value === 'string'
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : typeof value === 'bigint'
        ? String(value)
        : ''
  if (required && !result) throw new Error(`Field ${field} wajib diisi.`)
  return result || null
}

function numberValue(value: unknown, fallback = 0) {
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : fallback
}

function integerValue(value: unknown, fallback = 0) {
  return Math.trunc(numberValue(value, fallback))
}

function booleanValue(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return fallback
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function dateValue(value: unknown) {
  const raw = stringValue(value, 'date')
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) throw new Error(`Tanggal tidak valid: ${raw}`)
  return date.toISOString()
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
) {
  const normalized = String(value || '').trim().toUpperCase() as T
  return allowed.includes(normalized) ? normalized : fallback
}

function normalizedEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Email pengguna tidak valid.')
  }
  return email
}

function normalizeSlug(value: unknown, field = 'slug') {
  const slug = stringValue(value, field, true)!
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) throw new Error(`${field} tidak menghasilkan slug yang valid.`)
  return slug
}

async function findMapping(
  context: ImportContext,
  entityType: CoreisecEntityType,
  externalId: string,
) {
  const result = await context.client.query<MappingRow>(
    `SELECT target_table, target_id::text, source_checksum
     FROM public.migration_entity_map
     WHERE org_id = $1::uuid
       AND source_system = $2
       AND entity_type = $3
       AND external_id = $4
     LIMIT 1`,
    [context.orgId, SOURCE_SYSTEM, entityType, externalId],
  )
  return result.rows[0] || null
}

async function requireMappedId(
  context: ImportContext,
  entityType: CoreisecEntityType,
  externalIdValue: unknown,
) {
  const externalId = stringValue(externalIdValue, `${entityType}ExternalId`, true)!
  const mapping = await findMapping(context, entityType, externalId)
  if (!mapping) {
    throw new Error(`Mapping ${entityType}:${externalId} belum tersedia. Urutan snapshot tidak valid.`)
  }
  return mapping.target_id
}

async function existingExternalId(
  context: ImportContext,
  table: string,
  externalId: string,
) {
  const allowedTables = new Set([
    'learning_courses',
    'learning_course_sections',
    'learning_lessons',
    'learning_lesson_assets',
    'learning_instructor_profiles',
    'lms_course_batches',
    'lms_batch_sessions',
    'learning_enrollments',
    'learning_lesson_progress',
    'learning_quizzes',
    'learning_questions',
    'learning_assignments',
    'store_products',
    'product_variants',
    'commerce_order_bumps',
    'commerce_access_packages',
    'commerce_memberships',
    'commerce_subscriptions',
    'commerce_coupons',
    'commerce_affiliate_profiles',
    'commerce_affiliate_rules',
    'commerce_affiliate_commissions',
    'lms_certificates',
    'cms_content_entries',
    'cms_redirects',
    'migration_media_assets',
  ])
  if (!allowedTables.has(table)) throw new Error(`Tabel importer tidak diizinkan: ${table}`)
  const result = await context.client.query<{ id: string }>(
    `SELECT id::text
     FROM public.${table}
     WHERE org_id = $1::uuid
       AND external_source = $2
       AND external_id = $3
     LIMIT 1`,
    [context.orgId, SOURCE_SYSTEM, externalId],
  )
  return result.rows[0]?.id || null
}

async function importUser(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const email = normalizedEmail(payload.email)
  const username = stringValue(payload.username, 'username') || email
  const displayName = stringValue(payload.displayName, 'displayName') || username
  const passwordHash = stringValue(payload.passwordHash, 'passwordHash', true)!
  const roles = stringArray(payload.roles).map((role) => role.toLowerCase())
  const isAdmin = roles.some((role) => ['administrator', 'editor', 'shop_manager'].includes(role))
  const sourceDeleted = booleanValue(payload.sourceDeleted)
  const loginDisabled = booleanValue(payload.loginDisabled)
  const shouldBeActive = !sourceDeleted && !loginDisabled

  const existing = await context.client.query<{
    id: string
    legacy_user_id: string | null
    display_name: string | null
    user_type: string
  }>(
    `SELECT id::text, legacy_user_id::text, display_name, user_type
     FROM public.internal_auth_users
     WHERE lower(login_email) = $1
     ORDER BY created_at
     LIMIT 1
     FOR UPDATE`,
    [email],
  )

  let internalUserId = existing.rows[0]?.id || null
  let identityUserId = existing.rows[0]?.legacy_user_id || internalUserId
  if (!internalUserId) {
    const authMatch = await context.client.query<{ id: string }>(
      `SELECT id::text FROM auth.users WHERE lower(email) = $1 ORDER BY created_at LIMIT 1`,
      [email],
    )
    identityUserId = authMatch.rows[0]?.id || randomUUID()
    internalUserId = randomUUID()

    await context.client.query(
      `INSERT INTO auth.users (id, email, aud, role, created_at, updated_at)
       VALUES ($1::uuid, $2, 'authenticated', 'authenticated', COALESCE($3::timestamptz, NOW()), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [identityUserId, email, dateValue(payload.registeredAt)],
    )
    await context.client.query(
      `INSERT INTO public.internal_auth_users (
         id, legacy_user_id, login_email, password_hash, display_name, user_type,
         is_active, created_at, updated_at
       )
       VALUES (
         $1::uuid, $2::uuid, $3, '[WORDPRESS_PENDING_UPGRADE]', $4, $5,
         $6, COALESCE($7::timestamptz, NOW()), NOW()
       )`,
      [
        internalUserId,
        identityUserId,
        email,
        displayName,
        isAdmin ? 'admin' : 'member',
        shouldBeActive,
        dateValue(payload.registeredAt),
      ],
    )
  } else {
    await context.client.query(
      `UPDATE public.internal_auth_users
       SET
         display_name = COALESCE(NULLIF(display_name, ''), $2),
         user_type = CASE
           WHEN user_type IN ('owner', 'admin', 'staff', 'anggota', 'tutor', 'affiliate') THEN user_type
           ELSE $3
         END,
         is_active = $4,
         updated_at = NOW()
       WHERE id = $1::uuid`,
      [internalUserId, displayName, isAdmin ? 'admin' : 'member', shouldBeActive],
    )
  }

  if (!identityUserId) throw new Error(`Identity pengguna ${email} tidak tersedia.`)
  const authIdentity = await context.client.query<{ id: string }>(
    `SELECT id::text
     FROM auth.users
     WHERE id = $1::uuid OR lower(email) = $2
     ORDER BY CASE WHEN id = $1::uuid THEN 0 ELSE 1 END
     LIMIT 1`,
    [identityUserId, email],
  )
  if (authIdentity.rows[0]?.id) {
    identityUserId = authIdentity.rows[0].id
  } else {
    await context.client.query(
      `INSERT INTO auth.users (id, email, aud, role, created_at, updated_at)
       VALUES ($1::uuid, $2, 'authenticated', 'authenticated',
               COALESCE($3::timestamptz, NOW()), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [identityUserId, email, dateValue(payload.registeredAt)],
    )
  }
  await context.client.query(
    `UPDATE public.internal_auth_users
     SET legacy_user_id = $2::uuid, updated_at = NOW()
     WHERE id = $1::uuid
       AND legacy_user_id IS DISTINCT FROM $2::uuid`,
    [internalUserId, identityUserId],
  )

  const passwordScheme = passwordHash.startsWith('$wp$')
    ? 'WORDPRESS_BCRYPT'
    : passwordHash.startsWith('$P$') || passwordHash.startsWith('$H$')
      ? 'WORDPRESS_PHPASS'
      : 'WORDPRESS_UNKNOWN'
  await context.client.query(
    `INSERT INTO public.internal_auth_legacy_credentials (
       internal_user_id, source_system, source_user_id, username,
       password_hash, password_scheme, source_snapshot
     )
     VALUES ($1::uuid, 'WORDPRESS', $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (source_system, source_user_id) DO UPDATE
     SET
       internal_user_id = EXCLUDED.internal_user_id,
       username = EXCLUDED.username,
       password_hash = CASE
         WHEN public.internal_auth_legacy_credentials.upgraded_at IS NULL
           THEN EXCLUDED.password_hash
         ELSE public.internal_auth_legacy_credentials.password_hash
       END,
       password_scheme = CASE
         WHEN public.internal_auth_legacy_credentials.upgraded_at IS NULL
           THEN EXCLUDED.password_scheme
         ELSE public.internal_auth_legacy_credentials.password_scheme
       END,
       source_snapshot = EXCLUDED.source_snapshot,
       updated_at = NOW()`,
    [
      internalUserId,
      envelope.externalId,
      username,
      passwordHash,
      passwordScheme,
      JSON.stringify(payload),
    ],
  )

  await context.client.query(
    `INSERT INTO public.org_members (org_id, user_id, role, is_active, joined_at)
     VALUES ($1::uuid, $2::uuid, $3::public.member_role, $4, COALESCE($5::timestamptz, NOW()))
     ON CONFLICT (org_id, user_id) DO UPDATE
     SET
       role = CASE
         WHEN public.org_members.role = 'owner' THEN 'owner'::public.member_role
         ELSE EXCLUDED.role
       END,
       is_active = EXCLUDED.is_active`,
    [
      context.orgId,
      identityUserId,
      isAdmin ? 'admin' : 'viewer',
      shouldBeActive,
      dateValue(payload.registeredAt),
    ],
  )

  return {
    targetTable: 'internal_auth_users',
    targetId: internalUserId,
    metadata: { identityUserId, email, roles, sourceDeleted, loginDisabled },
  }
}

async function importCourse(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const targetHint = stringValue(payload.targetId, 'targetId')
  let id = await existingExternalId(context, 'learning_courses', envelope.externalId)
  if (!id) {
    const lockedMapping = await findMapping(context, 'course', envelope.externalId)
    if (lockedMapping?.target_table === 'learning_courses') {
      id = lockedMapping.target_id
    }
  }
  if (!id && targetHint) {
    const target = await context.client.query<{ id: string }>(
      `SELECT id::text FROM public.learning_courses
       WHERE id = $1::uuid AND org_id = $2::uuid
       FOR UPDATE`,
      [targetHint, context.orgId],
    )
    id = target.rows[0]?.id || null
    if (!id) throw new Error(`Course targetId ${targetHint} bukan milik organisasi target.`)
  }

  const values = [
    normalizeSlug(payload.slug),
    stringValue(payload.title, 'title', true),
    sanitizeLearningHtml(payload.descriptionHtml),
    enumValue(payload.status, ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const, 'DRAFT'),
    stringValue(payload.level, 'level'),
    booleanValue(payload.featured),
    booleanValue(payload.listed, true),
    stringValue(payload.previewVideoUrl, 'previewVideoUrl'),
    integerValue(payload.durationMinutes) || null,
    JSON.stringify(Array.isArray(payload.outcomes) ? payload.outcomes : []),
    integerValue(payload.accessDurationValue) || null,
    stringValue(payload.accessDurationUnit, 'accessDurationUnit'),
    stringValue(payload.closedAccessMessage, 'closedAccessMessage'),
    stringValue(payload.seoTitle, 'seoTitle'),
    stringValue(payload.seoDescription, 'seoDescription'),
    JSON.stringify(payload),
  ]

  if (id) {
    await context.client.query(
      `UPDATE public.learning_courses SET
         slug = $3, title = $4, description = $5, status = $6,
         level_code = $7, is_featured = $8, is_active = $9,
         preview_video_url = $10, duration_minutes = $11, outcomes = $12::jsonb,
         access_duration_value = $13, access_duration_unit = $14,
         closed_access_message = $15, seo_title = $16, seo_description = $17,
         external_source = $18, external_id = $19, source_snapshot = $20::jsonb,
         published_at = CASE WHEN $6 = 'PUBLISHED' THEN COALESCE(published_at, NOW()) ELSE published_at END,
         updated_at = NOW()
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [id, context.orgId, ...values.slice(0, -1), SOURCE_SYSTEM, envelope.externalId, values.at(-1)],
    )
  } else {
    const inserted = await context.client.query<{ id: string }>(
      `INSERT INTO public.learning_courses (
         org_id, slug, title, description, status, level_code, is_featured,
         is_active, preview_video_url, duration_minutes, outcomes,
         access_duration_value, access_duration_unit, closed_access_message,
         seo_title, seo_description, external_source, external_id,
         source_snapshot, published_at
       )
       VALUES (
         $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
         $12, $13, $14, $15, $16, $17, $18, $19::jsonb,
         CASE WHEN $5 = 'PUBLISHED' THEN NOW() ELSE NULL END
       )
       RETURNING id::text`,
      [context.orgId, ...values.slice(0, -1), SOURCE_SYSTEM, envelope.externalId, values.at(-1)],
    )
    id = inserted.rows[0].id
  }
  return { targetTable: 'learning_courses', targetId: id }
}

async function importSection(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const courseId = await requireMappedId(context, 'course', payload.courseExternalId)
  const id = await existingExternalId(context, 'learning_course_sections', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    id
      ? `UPDATE public.learning_course_sections SET
           course_id = $3::uuid, title = $4, description = $5, sort_order = $6,
           source_snapshot = $7::jsonb, updated_at = NOW()
         WHERE id = $1::uuid AND org_id = $2::uuid RETURNING id::text`
      : `INSERT INTO public.learning_course_sections (
           id, org_id, course_id, title, description, sort_order,
           external_source, external_id, source_snapshot
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid,
           $4, $5, $6, $8, $9, $7::jsonb
         )
         RETURNING id::text`,
    [
      id,
      context.orgId,
      courseId,
      stringValue(payload.title, 'title', true),
      stringValue(payload.description, 'description'),
      integerValue(payload.sortOrder),
      JSON.stringify(payload),
      SOURCE_SYSTEM,
      envelope.externalId,
    ],
  )
  return { targetTable: 'learning_course_sections', targetId: result.rows[0].id }
}

async function importLesson(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const courseId = await requireMappedId(context, 'course', payload.courseExternalId)
  const sectionExternalId = stringValue(payload.sectionExternalId, 'sectionExternalId')
  const sectionId = sectionExternalId
    ? await requireMappedId(context, 'section', sectionExternalId)
    : null
  const targetHint = stringValue(payload.targetId, 'targetId')
  let id = await existingExternalId(context, 'learning_lessons', envelope.externalId)
  if (!id) {
    const lockedMapping = await findMapping(context, 'lesson', envelope.externalId)
    if (lockedMapping?.target_table === 'learning_lessons') {
      id = lockedMapping.target_id
    }
  }
  if (!id && targetHint) {
    const target = await context.client.query<{ id: string }>(
      `SELECT id::text FROM public.learning_lessons
       WHERE id = $1::uuid AND org_id = $2::uuid AND course_id = $3::uuid
       FOR UPDATE`,
      [targetHint, context.orgId, courseId],
    )
    id = target.rows[0]?.id || null
    if (!id) throw new Error(`Lesson targetId ${targetHint} tidak cocok dengan course target.`)
  }
  const values = [
    courseId,
    sectionId,
    normalizeSlug(payload.slug),
    stringValue(payload.title, 'title', true),
    enumValue(payload.lessonType, ['TEXT', 'VIDEO', 'QUIZ', 'PRACTICE', 'DOCUMENT', 'AUDIO', 'EMBED'] as const, 'TEXT'),
    sanitizeLearningHtml(payload.contentHtml),
    integerValue(payload.sortOrder),
    booleanValue(payload.required, true),
    booleanValue(payload.preview),
    integerValue(payload.durationSeconds) || null,
    integerValue(payload.dripValue) || null,
    stringValue(payload.dripUnit, 'dripUnit'),
    stringValue(payload.embedProvider, 'embedProvider'),
    stringValue(payload.embedUrl, 'embedUrl'),
    JSON.stringify(Array.isArray(payload.mediaItems) ? payload.mediaItems : []),
    JSON.stringify(payload),
  ]
  const result = await context.client.query<{ id: string }>(
    id
      ? `UPDATE public.learning_lessons SET
           course_id = $3::uuid, section_id = $4::uuid, slug = $5, title = $6,
           lesson_type = $7, content_html = $8, content_md = $8, sort_order = $9,
           is_required = $10, is_preview = $11, duration_seconds = $12,
           drip_value = $13, drip_unit = $14, embed_provider = $15,
           embed_url = $16, media_items = $17::jsonb, source_snapshot = $18::jsonb,
           external_source = $19, external_id = $20, updated_at = NOW()
         WHERE id = $1::uuid AND org_id = $2::uuid RETURNING id::text`
      : `INSERT INTO public.learning_lessons (
           id, org_id, course_id, section_id, slug, title, lesson_type,
           content_html, content_md, sort_order, is_required, is_preview,
           duration_seconds, drip_value, drip_unit, embed_provider, embed_url,
           media_items, source_snapshot, external_source, external_id
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid,
           $4::uuid, $5, $6, $7, $8, $8, $9, $10, $11,
           $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, $19, $20
         ) RETURNING id::text`,
    [id, context.orgId, ...values, SOURCE_SYSTEM, envelope.externalId],
  )
  return { targetTable: 'learning_lessons', targetId: result.rows[0].id }
}

async function importLessonAsset(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const lessonId = await requireMappedId(context, 'lesson', payload.lessonExternalId)
  const id = await existingExternalId(context, 'learning_lesson_assets', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    id
      ? `UPDATE public.learning_lesson_assets SET
           lesson_id = $3::uuid, asset_type = $4, title = $5, source_url = $6,
           storage_key = $7, mime_type = $8, file_size_bytes = $9,
           checksum_sha256 = $10, is_downloadable = $11, sort_order = $12,
           availability_status = CASE
             WHEN $6::text IS NULL AND $7::text IS NULL THEN 'MISSING_SOURCE'
             ELSE 'AVAILABLE'
           END,
           source_snapshot = $13::jsonb, updated_at = NOW()
         WHERE id = $1::uuid AND org_id = $2::uuid RETURNING id::text`
      : `INSERT INTO public.learning_lesson_assets (
           id, org_id, lesson_id, asset_type, title, source_url, storage_key,
           mime_type, file_size_bytes, checksum_sha256, is_downloadable,
           sort_order, availability_status, source_snapshot, external_source, external_id
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid,
           $4, $5, $6, $7, $8, $9, $10, $11, $12,
           CASE
             WHEN $6::text IS NULL AND $7::text IS NULL THEN 'MISSING_SOURCE'
             ELSE 'AVAILABLE'
           END,
           $13::jsonb, $14, $15
         ) RETURNING id::text`,
    [
      id,
      context.orgId,
      lessonId,
      enumValue(payload.assetType, ['VIDEO', 'DOCUMENT', 'IMAGE', 'AUDIO', 'LINK', 'EMBED', 'OTHER'] as const, 'OTHER'),
      stringValue(payload.title, 'title') || `Aset warisan ${envelope.externalId}`,
      stringValue(payload.sourceUrl, 'sourceUrl'),
      stringValue(payload.storageKey, 'storageKey'),
      stringValue(payload.mimeType, 'mimeType'),
      integerValue(payload.fileSizeBytes) || null,
      stringValue(payload.checksumSha256, 'checksumSha256'),
      booleanValue(payload.downloadable, true),
      integerValue(payload.sortOrder),
      JSON.stringify(payload),
      SOURCE_SYSTEM,
      envelope.externalId,
    ],
  )
  return { targetTable: 'learning_lesson_assets', targetId: result.rows[0].id }
}

async function resolveIdentityUserId(context: ImportContext, externalId: unknown) {
  const internalId = await requireMappedId(context, 'user', externalId)
  const result = await context.client.query<{ user_id: string }>(
    `SELECT COALESCE(legacy_user_id, id)::text AS user_id
     FROM public.internal_auth_users
     WHERE id = $1::uuid`,
    [internalId],
  )
  if (!result.rows[0]) throw new Error(`Pengguna internal ${internalId} tidak ditemukan.`)
  return result.rows[0].user_id
}

async function importInstructor(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const userId = await resolveIdentityUserId(context, payload.userExternalId)
  const id = await existingExternalId(context, 'learning_instructor_profiles', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.learning_instructor_profiles (
       id, org_id, user_id, display_name, headline, biography, avatar_url,
       expertise, social_links, is_active, external_source, external_id
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4, $5, $6,
       $7, $8::text[], $9::jsonb, $10, $11, $12
     )
     ON CONFLICT (org_id, user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       headline = EXCLUDED.headline,
       biography = EXCLUDED.biography,
       avatar_url = EXCLUDED.avatar_url,
       expertise = EXCLUDED.expertise,
       social_links = EXCLUDED.social_links,
       is_active = EXCLUDED.is_active,
       external_source = EXCLUDED.external_source,
       external_id = EXCLUDED.external_id,
       updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      userId,
      stringValue(payload.displayName, 'displayName', true),
      stringValue(payload.headline, 'headline'),
      stringValue(payload.biography, 'biography'),
      stringValue(payload.avatarUrl, 'avatarUrl'),
      stringArray(payload.expertise),
      JSON.stringify(recordValue(payload.socialLinks)),
      booleanValue(payload.active, true),
      SOURCE_SYSTEM,
      envelope.externalId,
    ],
  )
  return { targetTable: 'learning_instructor_profiles', targetId: result.rows[0].id }
}

async function importCourseInstructor(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const courseId = await requireMappedId(context, 'course', payload.courseExternalId)
  const instructorId = await requireMappedId(context, 'instructor', payload.instructorExternalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.learning_course_instructors (
       org_id, course_id, instructor_id, role, sort_order
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5)
     ON CONFLICT (org_id, course_id, instructor_id) DO UPDATE
     SET role = EXCLUDED.role, sort_order = EXCLUDED.sort_order
     RETURNING id::text`,
    [
      context.orgId,
      courseId,
      instructorId,
      enumValue(payload.role, ['LEAD', 'TUTOR', 'REVIEWER', 'ASSISTANT'] as const, 'TUTOR'),
      integerValue(payload.sortOrder),
    ],
  )
  return { targetTable: 'learning_course_instructors', targetId: result.rows[0].id }
}

async function importBatch(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const courseId = await requireMappedId(context, 'course', payload.courseExternalId)
  const id = await existingExternalId(context, 'lms_course_batches', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    id
      ? `UPDATE public.lms_course_batches SET
           course_id = $3::uuid, name = $4, start_date = $5::date, end_date = $6::date,
           quota = $7, price = $8, status = $9, mode = $10, delivery_mode = $10,
           timezone = $11, enrollment_opens_at = $12::timestamptz,
           enrollment_closes_at = $13::timestamptz, waitlist_enabled = $14,
           location_name = $15, location_address = $16, source_snapshot = $17::jsonb,
           updated_at = NOW()
         WHERE id = $1::uuid AND org_id = $2::uuid RETURNING id::text`
      : `INSERT INTO public.lms_course_batches (
           org_id, course_id, name, start_date, end_date, quota, price, status,
           mode, delivery_mode, timezone, enrollment_opens_at, enrollment_closes_at,
           waitlist_enabled, location_name, location_address, source_snapshot,
           external_source, external_id
         ) VALUES (
           $2::uuid, $3::uuid, $4, $5::date, $6::date, $7, $8, $9, $10, $10,
           $11, $12::timestamptz, $13::timestamptz, $14, $15, $16, $17::jsonb,
           $18, $19
         ) RETURNING id::text`,
    [
      id,
      context.orgId,
      courseId,
      stringValue(payload.name, 'name', true),
      stringValue(payload.startDate, 'startDate'),
      stringValue(payload.endDate, 'endDate'),
      integerValue(payload.quota) || null,
      numberValue(payload.price),
      enumValue(payload.status, ['OPEN', 'CLOSED', 'ONGOING', 'COMPLETED'] as const, 'OPEN'),
      enumValue(payload.mode, ['ONLINE', 'OFFLINE', 'HYBRID'] as const, 'ONLINE'),
      stringValue(payload.timezone, 'timezone') || 'Asia/Jakarta',
      dateValue(payload.enrollmentOpensAt),
      dateValue(payload.enrollmentClosesAt),
      booleanValue(payload.waitlistEnabled, true),
      stringValue(payload.locationName, 'locationName'),
      stringValue(payload.locationAddress, 'locationAddress'),
      JSON.stringify(payload),
      SOURCE_SYSTEM,
      envelope.externalId,
    ],
  )
  return { targetTable: 'lms_course_batches', targetId: result.rows[0].id }
}

async function importSession(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const batchId = await requireMappedId(context, 'batch', payload.batchExternalId)
  const instructorExternalId = stringValue(payload.instructorExternalId, 'instructorExternalId')
  const instructorId = instructorExternalId
    ? await requireMappedId(context, 'instructor', instructorExternalId)
    : null
  const id = await existingExternalId(context, 'lms_batch_sessions', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    id
      ? `UPDATE public.lms_batch_sessions SET
           batch_id = $3::uuid, title = $4, start_time = $5::timestamptz,
           end_time = $6::timestamptz, instructor_name = $7, instructor_id = $8::uuid,
           location_url = $9, location_name = $10, meeting_provider = $11,
           is_mandatory = $12, reminder_offsets_minutes = $13::integer[],
           source_snapshot = $14::jsonb, updated_at = NOW()
         WHERE id = $1::uuid AND org_id = $2::uuid RETURNING id::text`
      : `INSERT INTO public.lms_batch_sessions (
           org_id, batch_id, title, start_time, end_time, instructor_name,
           instructor_id, location_url, location_name, meeting_provider,
           is_mandatory, reminder_offsets_minutes, source_snapshot,
           external_source, external_id
         ) VALUES (
           $2::uuid, $3::uuid, $4, $5::timestamptz, $6::timestamptz, $7,
           $8::uuid, $9, $10, $11, $12, $13::integer[], $14::jsonb, $15, $16
         ) RETURNING id::text`,
    [
      id,
      context.orgId,
      batchId,
      stringValue(payload.title, 'title', true),
      dateValue(payload.startTime),
      dateValue(payload.endTime),
      stringValue(payload.instructorName, 'instructorName'),
      instructorId,
      stringValue(payload.locationUrl, 'locationUrl'),
      stringValue(payload.locationName, 'locationName'),
      stringValue(payload.meetingProvider, 'meetingProvider'),
      booleanValue(payload.mandatory, true),
      Array.isArray(payload.reminderOffsetsMinutes)
        ? payload.reminderOffsetsMinutes.map((item) => integerValue(item))
        : [1440, 60],
      JSON.stringify(payload),
      SOURCE_SYSTEM,
      envelope.externalId,
    ],
  )
  return { targetTable: 'lms_batch_sessions', targetId: result.rows[0].id }
}

async function importEnrollment(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const userId = await resolveIdentityUserId(context, payload.userExternalId)
  const courseId = await requireMappedId(context, 'course', payload.courseExternalId)
  const batchExternalId = stringValue(payload.batchExternalId, 'batchExternalId')
  const batchId = batchExternalId ? await requireMappedId(context, 'batch', batchExternalId) : null
  const grantKey = `migration:${envelope.externalId}`
  const grant = await context.client.query<{ id: string }>(
    `INSERT INTO public.learning_access_grants (
       org_id, user_id, course_id, batch_id, source_type, source_reference,
       status, starts_at, idempotency_key, external_source, external_id, metadata
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, 'MIGRATION', $5,
       'ACTIVE', COALESCE($6::timestamptz, NOW()), $7, $8, $5, $9::jsonb
     )
     ON CONFLICT (org_id, idempotency_key) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       course_id = EXCLUDED.course_id,
       batch_id = EXCLUDED.batch_id,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING id::text`,
    [
      context.orgId,
      userId,
      courseId,
      batchId,
      envelope.externalId,
      dateValue(payload.startedAt),
      grantKey,
      SOURCE_SYSTEM,
      JSON.stringify({ migrationRunId: context.runId, sourceStatus: payload.status }),
    ],
  )
  const id = await existingExternalId(context, 'learning_enrollments', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    id
      ? `UPDATE public.learning_enrollments SET
           user_id = $3::uuid, course_id = $4::uuid, batch_id = $5::uuid,
           access_grant_id = $6::uuid, status = $7, started_at = $8::timestamptz,
           completed_at = $9::timestamptz, final_score = $10,
           source_snapshot = $11::jsonb, updated_at = NOW()
         WHERE id = $1::uuid AND org_id = $2::uuid RETURNING id::text`
      : `INSERT INTO public.learning_enrollments (
           id, org_id, user_id, course_id, batch_id, access_grant_id, status,
           started_at, completed_at, final_score, source_snapshot,
           external_source, external_id
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid,
           $4::uuid, $5::uuid, $6::uuid, $7,
           COALESCE($8::timestamptz, NOW()), $9::timestamptz, $10,
           $11::jsonb, $12, $13
         )
         ON CONFLICT (org_id, user_id, course_id) DO UPDATE SET
           batch_id = EXCLUDED.batch_id,
           access_grant_id = EXCLUDED.access_grant_id,
           status = EXCLUDED.status,
           started_at = LEAST(public.learning_enrollments.started_at, EXCLUDED.started_at),
           completed_at = COALESCE(public.learning_enrollments.completed_at, EXCLUDED.completed_at),
           final_score = COALESCE(public.learning_enrollments.final_score, EXCLUDED.final_score),
           external_source = EXCLUDED.external_source,
           external_id = EXCLUDED.external_id,
           source_snapshot = EXCLUDED.source_snapshot,
           updated_at = NOW()
         RETURNING id::text`,
    [
      id,
      context.orgId,
      userId,
      courseId,
      batchId,
      grant.rows[0].id,
      enumValue(payload.status, ['IN_PROGRESS', 'COMPLETED', 'FAILED'] as const, 'IN_PROGRESS'),
      dateValue(payload.startedAt),
      dateValue(payload.completedAt),
      payload.finalScore == null ? null : numberValue(payload.finalScore),
      JSON.stringify(payload),
      SOURCE_SYSTEM,
      envelope.externalId,
    ],
  )
  return {
    targetTable: 'learning_enrollments',
    targetId: result.rows[0].id,
    metadata: { accessGrantId: grant.rows[0].id },
  }
}

async function importProgress(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const enrollmentId = await requireMappedId(context, 'enrollment', payload.enrollmentExternalId)
  const lessonId = await requireMappedId(context, 'lesson', payload.lessonExternalId)
  const id = await existingExternalId(context, 'learning_lesson_progress', envelope.externalId)
  const status = enumValue(payload.status, ['VIEWED', 'COMPLETED'] as const, 'VIEWED')
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.learning_lesson_progress (
       id, org_id, enrollment_id, lesson_id, status, viewed_at, completed_at,
       first_viewed_at, last_position_seconds, external_source, external_id,
       source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4::uuid, $5,
       COALESCE($6::timestamptz, NOW()), $7::timestamptz,
       COALESCE($6::timestamptz, NOW()), $8, $9, $10, $11::jsonb
     )
     ON CONFLICT (org_id, enrollment_id, lesson_id) DO UPDATE SET
       status = CASE
         WHEN public.learning_lesson_progress.status = 'COMPLETED' THEN 'COMPLETED'
         ELSE EXCLUDED.status
       END,
       viewed_at = LEAST(public.learning_lesson_progress.viewed_at, EXCLUDED.viewed_at),
       completed_at = COALESCE(public.learning_lesson_progress.completed_at, EXCLUDED.completed_at),
       last_position_seconds = GREATEST(
         public.learning_lesson_progress.last_position_seconds,
         EXCLUDED.last_position_seconds
       ),
       external_source = EXCLUDED.external_source,
       external_id = EXCLUDED.external_id,
       source_snapshot = EXCLUDED.source_snapshot,
       updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      enrollmentId,
      lessonId,
      status,
      dateValue(payload.viewedAt),
      dateValue(payload.completedAt),
      integerValue(payload.lastPositionSeconds),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'learning_lesson_progress', targetId: result.rows[0].id }
}

async function importQuiz(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const courseId = await requireMappedId(context, 'course', payload.courseExternalId)
  const lessonExternalId = stringValue(payload.lessonExternalId, 'lessonExternalId')
  const lessonId = lessonExternalId ? await requireMappedId(context, 'lesson', lessonExternalId) : null
  const id = await existingExternalId(context, 'learning_quizzes', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.learning_quizzes (
       id, org_id, course_id, lesson_id, title, description, status,
       time_limit_minutes, max_attempts, passing_score, randomize_questions,
       randomize_options, show_explanations, external_source, external_id,
       source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4::uuid,
       $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       course_id = EXCLUDED.course_id, lesson_id = EXCLUDED.lesson_id,
       title = EXCLUDED.title, description = EXCLUDED.description,
       status = EXCLUDED.status, time_limit_minutes = EXCLUDED.time_limit_minutes,
       max_attempts = EXCLUDED.max_attempts, passing_score = EXCLUDED.passing_score,
       randomize_questions = EXCLUDED.randomize_questions,
       randomize_options = EXCLUDED.randomize_options,
       show_explanations = EXCLUDED.show_explanations,
       source_snapshot = EXCLUDED.source_snapshot, updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      courseId,
      lessonId,
      stringValue(payload.title, 'title', true),
      sanitizeLearningHtml(payload.description),
      enumValue(payload.status, ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const, 'DRAFT'),
      integerValue(payload.timeLimitMinutes) || null,
      integerValue(payload.maxAttempts) || null,
      numberValue(payload.passingScore, 70),
      booleanValue(payload.randomizeQuestions),
      booleanValue(payload.randomizeOptions),
      booleanValue(payload.showExplanations, true),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'learning_quizzes', targetId: result.rows[0].id }
}

async function importQuestion(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const quizId = await requireMappedId(context, 'quiz', payload.quizExternalId)
  const id = await existingExternalId(context, 'learning_questions', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.learning_questions (
       id, org_id, quiz_id, question_bank_key, question_type, prompt_html,
       explanation_html, points, sort_order, is_active, external_source,
       external_id, source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4, $5, $6,
       $7, $8, $9, $10, $11, $12, $13::jsonb
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       quiz_id = EXCLUDED.quiz_id, question_bank_key = EXCLUDED.question_bank_key,
       question_type = EXCLUDED.question_type, prompt_html = EXCLUDED.prompt_html,
       explanation_html = EXCLUDED.explanation_html, points = EXCLUDED.points,
       sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
       source_snapshot = EXCLUDED.source_snapshot, updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      quizId,
      stringValue(payload.questionBankKey, 'questionBankKey'),
      enumValue(payload.questionType, [
        'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE',
        'SHORT_TEXT', 'ORDERING', 'ESSAY',
      ] as const, 'SINGLE_CHOICE'),
      sanitizeLearningHtml(stringValue(payload.promptHtml, 'promptHtml', true)),
      sanitizeLearningHtml(payload.explanationHtml) || null,
      numberValue(payload.points, 1),
      integerValue(payload.sortOrder),
      booleanValue(payload.active, true),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  const questionId = result.rows[0].id
  const options = Array.isArray(payload.options) ? payload.options : []
  for (let index = 0; index < options.length; index += 1) {
    const option = recordValue(options[index])
    const optionExternalId = stringValue(option.externalId, 'option.externalId') || `${envelope.externalId}:${index + 1}`
    await context.client.query(
      `INSERT INTO public.learning_question_options (
         org_id, question_id, option_html, is_correct, sort_order, match_key,
         external_source, external_id
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (org_id, external_source, external_id)
         WHERE external_source IS NOT NULL AND external_id IS NOT NULL
       DO UPDATE SET
         question_id = EXCLUDED.question_id, option_html = EXCLUDED.option_html,
         is_correct = EXCLUDED.is_correct, sort_order = EXCLUDED.sort_order,
         match_key = EXCLUDED.match_key`,
      [
        context.orgId,
        questionId,
        sanitizeQuizOptionHtml(stringValue(option.html, 'option.html', true)),
        booleanValue(option.correct),
        integerValue(option.sortOrder, index),
        stringValue(option.matchKey, 'option.matchKey'),
        SOURCE_SYSTEM,
        optionExternalId,
      ],
    )
  }
  return { targetTable: 'learning_questions', targetId: questionId, metadata: { optionCount: options.length } }
}

async function importAssignment(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const courseId = await requireMappedId(context, 'course', payload.courseExternalId)
  const lessonExternalId = stringValue(payload.lessonExternalId, 'lessonExternalId')
  const lessonId = lessonExternalId ? await requireMappedId(context, 'lesson', lessonExternalId) : null
  const id = await existingExternalId(context, 'learning_assignments', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.learning_assignments (
       id, org_id, course_id, lesson_id, title, instructions_html, due_at,
       max_score, passing_score, max_attempts, allowed_mime_types, rubric,
       status, external_source, external_id
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4::uuid,
       $5, $6, $7::timestamptz, $8, $9, $10, $11::text[], $12::jsonb,
       $13, $14, $15
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       course_id = EXCLUDED.course_id, lesson_id = EXCLUDED.lesson_id,
       title = EXCLUDED.title, instructions_html = EXCLUDED.instructions_html,
       due_at = EXCLUDED.due_at, max_score = EXCLUDED.max_score,
       passing_score = EXCLUDED.passing_score, max_attempts = EXCLUDED.max_attempts,
       allowed_mime_types = EXCLUDED.allowed_mime_types, rubric = EXCLUDED.rubric,
       status = EXCLUDED.status, updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      courseId,
      lessonId,
      stringValue(payload.title, 'title', true),
      sanitizeLearningHtml(payload.instructionsHtml) || null,
      dateValue(payload.dueAt),
      numberValue(payload.maxScore, 100),
      payload.passingScore == null ? null : numberValue(payload.passingScore),
      Math.max(1, integerValue(payload.maxAttempts, 1)),
      stringArray(payload.allowedMimeTypes),
      JSON.stringify(Array.isArray(payload.rubric) ? payload.rubric : []),
      enumValue(payload.status, ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const, 'DRAFT'),
      SOURCE_SYSTEM,
      envelope.externalId,
    ],
  )
  return { targetTable: 'learning_assignments', targetId: result.rows[0].id }
}

async function importProduct(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const existingStoreProductId = await existingExternalId(context, 'store_products', envelope.externalId)
  let productId: string
  if (existingStoreProductId) {
    const existing = await context.client.query<{ product_id: string }>(
      `SELECT product_id::text FROM public.store_products
       WHERE id = $1::uuid AND org_id = $2::uuid`,
      [existingStoreProductId, context.orgId],
    )
    productId = existing.rows[0].product_id
  } else {
    const product = await context.client.query<{ id: string }>(
      `INSERT INTO public.products (
         org_id, sku, name, type, description, unit, selling_price,
         is_active, external_source, external_id, source_snapshot
       ) VALUES (
         $1::uuid, $2, $3, $4::public.product_type, $5, 'Pcs', $6,
         $7, $8, $9, $10::jsonb
       ) RETURNING id::text`,
      [
        context.orgId,
        stringValue(payload.sku, 'sku'),
        stringValue(payload.name, 'name', true),
        booleanValue(payload.physical) ? 'INVENTORY' : 'SERVICE',
        sanitizeLearningHtml(payload.descriptionHtml),
        numberValue(payload.salePrice ?? payload.regularPrice),
        booleanValue(payload.published),
        SOURCE_SYSTEM,
        envelope.externalId,
        JSON.stringify(payload),
      ],
    )
    productId = product.rows[0].id
  }

  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.store_products (
       id, org_id, store_id, product_id, public_slug, public_name,
       public_description, price_override, compare_price, is_featured,
       is_published, product_type, sale_starts_at, sale_ends_at,
       purchase_limit_per_user, quantity_enabled, follow_up_content,
       analytics_config, external_source, external_id, source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4::uuid,
       $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz,
       $14::timestamptz, $15, $16, $17::jsonb, $18::jsonb, $19, $20, $21::jsonb
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       public_slug = EXCLUDED.public_slug, public_name = EXCLUDED.public_name,
       public_description = EXCLUDED.public_description,
       price_override = EXCLUDED.price_override, compare_price = EXCLUDED.compare_price,
       is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published,
       product_type = EXCLUDED.product_type, sale_starts_at = EXCLUDED.sale_starts_at,
       sale_ends_at = EXCLUDED.sale_ends_at,
       purchase_limit_per_user = EXCLUDED.purchase_limit_per_user,
       quantity_enabled = EXCLUDED.quantity_enabled,
       follow_up_content = EXCLUDED.follow_up_content,
       analytics_config = EXCLUDED.analytics_config,
       source_snapshot = EXCLUDED.source_snapshot, updated_at = NOW()
     RETURNING id::text`,
    [
      existingStoreProductId,
      context.orgId,
      context.storeId,
      productId,
      normalizeSlug(payload.slug),
      stringValue(payload.name, 'name', true),
      sanitizeLearningHtml(payload.descriptionHtml),
      numberValue(payload.salePrice ?? payload.regularPrice),
      payload.salePrice == null ? null : numberValue(payload.regularPrice),
      booleanValue(payload.featured),
      booleanValue(payload.published, true),
      booleanValue(payload.physical) ? 'PHYSICAL' : 'DIGITAL',
      dateValue(payload.saleStartsAt),
      dateValue(payload.saleEndsAt),
      integerValue(payload.purchaseLimitPerUser) || null,
      booleanValue(payload.quantityEnabled, true),
      JSON.stringify(Array.isArray(payload.followUpContent) ? payload.followUpContent : []),
      JSON.stringify(recordValue(payload.analyticsConfig)),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  await context.client.query(
    `UPDATE public.products SET
       name = $3, description = $4, selling_price = $5,
       is_active = $6, source_snapshot = $7::jsonb, updated_at = NOW()
     WHERE id = $1::uuid AND org_id = $2::uuid`,
    [
      productId,
      context.orgId,
      stringValue(payload.name, 'name', true),
      sanitizeLearningHtml(payload.descriptionHtml),
      numberValue(payload.salePrice ?? payload.regularPrice),
      booleanValue(payload.published),
      JSON.stringify(payload),
    ],
  )
  return {
    targetTable: 'store_products',
    targetId: result.rows[0].id,
    metadata: { productId },
  }
}

async function importProductVariant(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const storeProductId = await requireMappedId(context, 'product', payload.productExternalId)
  const product = await context.client.query<{ product_id: string }>(
    `SELECT product_id::text FROM public.store_products
     WHERE id = $1::uuid AND org_id = $2::uuid`,
    [storeProductId, context.orgId],
  )
  const productId = product.rows[0]?.product_id
  if (!productId) throw new Error('Produk induk varian tidak ditemukan.')
  const id = await existingExternalId(context, 'product_variants', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.product_variants (
       id, org_id, product_id, inventory_product_id, sku, name, weight,
       length_cm, width_cm, height_cm, sort_order, is_active, is_default,
       external_source, external_id, source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $3::uuid,
       $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       sku = EXCLUDED.sku, name = EXCLUDED.name, weight = EXCLUDED.weight,
       length_cm = EXCLUDED.length_cm, width_cm = EXCLUDED.width_cm,
       height_cm = EXCLUDED.height_cm, sort_order = EXCLUDED.sort_order,
       is_active = EXCLUDED.is_active, is_default = EXCLUDED.is_default,
       source_snapshot = EXCLUDED.source_snapshot, updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      productId,
      stringValue(payload.sku, 'sku'),
      stringValue(payload.name, 'name', true),
      numberValue(payload.weight),
      numberValue(payload.lengthCm),
      numberValue(payload.widthCm),
      numberValue(payload.heightCm),
      integerValue(payload.sortOrder),
      booleanValue(payload.active, true),
      booleanValue(payload.default),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'product_variants', targetId: result.rows[0].id }
}

async function importProductCourse(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const productId = await requireMappedId(context, 'product', payload.productExternalId)
  const courseId = await requireMappedId(context, 'course', payload.courseExternalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_product_courses (
       org_id, store_product_id, course_id, access_duration_value,
       access_duration_unit, external_source, external_id
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)
     ON CONFLICT (org_id, store_product_id, course_id) DO UPDATE SET
       access_duration_value = EXCLUDED.access_duration_value,
       access_duration_unit = EXCLUDED.access_duration_unit,
       external_source = EXCLUDED.external_source,
       external_id = EXCLUDED.external_id
     RETURNING id::text`,
    [
      context.orgId,
      productId,
      courseId,
      integerValue(payload.accessDurationValue) || null,
      stringValue(payload.accessDurationUnit, 'accessDurationUnit'),
      SOURCE_SYSTEM,
      envelope.externalId,
    ],
  )
  return { targetTable: 'commerce_product_courses', targetId: result.rows[0].id }
}

async function importOrderBump(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const triggerProductId = await requireMappedId(context, 'product', payload.triggerProductExternalId)
  const offeredProductId = await requireMappedId(context, 'product', payload.offeredProductExternalId)
  const id = await existingExternalId(context, 'commerce_order_bumps', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_order_bumps (
       id, org_id, trigger_product_id, offered_product_id, title, description,
       price_override, is_active, sort_order, external_source, external_id,
       source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4::uuid,
       $5, $6, $7, $8, $9, $10, $11, $12::jsonb
     )
     ON CONFLICT (org_id, trigger_product_id, offered_product_id) DO UPDATE SET
       title = EXCLUDED.title, description = EXCLUDED.description,
       price_override = EXCLUDED.price_override, is_active = EXCLUDED.is_active,
       sort_order = EXCLUDED.sort_order, external_source = EXCLUDED.external_source,
       external_id = EXCLUDED.external_id, source_snapshot = EXCLUDED.source_snapshot,
       updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      triggerProductId,
      offeredProductId,
      stringValue(payload.title, 'title', true),
      stringValue(payload.description, 'description'),
      payload.priceOverride == null ? null : numberValue(payload.priceOverride),
      booleanValue(payload.active, true),
      integerValue(payload.sortOrder),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'commerce_order_bumps', targetId: result.rows[0].id }
}

async function importAccessPackage(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const id = await existingExternalId(context, 'commerce_access_packages', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_access_packages (
       id, org_id, name, slug, description, is_active, external_source, external_id
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, $4, $5, $6, $7, $8
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description,
       is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      stringValue(payload.name, 'name', true),
      normalizeSlug(payload.slug),
      stringValue(payload.description, 'description'),
      booleanValue(payload.active, true),
      SOURCE_SYSTEM,
      envelope.externalId,
    ],
  )
  const packageId = result.rows[0].id
  for (const courseExternalId of stringArray(payload.courseExternalIds)) {
    const courseId = await requireMappedId(context, 'course', courseExternalId)
    await context.client.query(
      `INSERT INTO public.commerce_access_package_courses (org_id, package_id, course_id)
       VALUES ($1::uuid, $2::uuid, $3::uuid)
       ON CONFLICT (package_id, course_id) DO NOTHING`,
      [context.orgId, packageId, courseId],
    )
  }
  return { targetTable: 'commerce_access_packages', targetId: packageId }
}

async function importMembership(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const userId = await resolveIdentityUserId(context, payload.userExternalId)
  const packageId = await requireMappedId(context, 'access_package', payload.packageExternalId)
  const id = await existingExternalId(context, 'commerce_memberships', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_memberships (
       id, org_id, user_id, package_id, source_type, status, starts_at,
       expires_at, idempotency_key, external_source, external_id, source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4::uuid,
       'MIGRATION', $5, COALESCE($6::timestamptz, NOW()), $7::timestamptz,
       $8, $9, $10, $11::jsonb
     )
     ON CONFLICT (org_id, idempotency_key) DO UPDATE SET
       status = EXCLUDED.status, starts_at = EXCLUDED.starts_at,
       expires_at = EXCLUDED.expires_at, source_snapshot = EXCLUDED.source_snapshot,
       updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      userId,
      packageId,
      enumValue(payload.status, ['PENDING', 'ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELLED'] as const, 'ACTIVE'),
      dateValue(payload.startsAt),
      dateValue(payload.expiresAt),
      `migration:membership:${envelope.externalId}`,
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'commerce_memberships', targetId: result.rows[0].id }
}

async function importOrderArchive(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const userExternalId = stringValue(payload.userExternalId, 'userExternalId')
  const userId = userExternalId ? await resolveIdentityUserId(context, userExternalId) : null
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_historical_order_archives (
       org_id, user_id, external_source, external_id, order_number,
       customer_email_normalized, status, currency, total_amount, ordered_at,
       completed_at, payload, payload_sha256, reconciliation_status, grants_access
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, lower($6), $7, $8, $9,
       $10::timestamptz, $11::timestamptz, $12::jsonb, $13, $14, $15
     )
     ON CONFLICT (org_id, external_source, external_id) DO UPDATE SET
       user_id = EXCLUDED.user_id, order_number = EXCLUDED.order_number,
       customer_email_normalized = EXCLUDED.customer_email_normalized,
       status = EXCLUDED.status, currency = EXCLUDED.currency,
       total_amount = EXCLUDED.total_amount, ordered_at = EXCLUDED.ordered_at,
       completed_at = EXCLUDED.completed_at, payload = EXCLUDED.payload,
       payload_sha256 = EXCLUDED.payload_sha256,
       reconciliation_status = EXCLUDED.reconciliation_status,
       grants_access = EXCLUDED.grants_access, updated_at = NOW()
     RETURNING id::text`,
    [
      context.orgId,
      userId,
      SOURCE_SYSTEM,
      envelope.externalId,
      stringValue(payload.orderNumber, 'orderNumber'),
      stringValue(payload.customerEmail, 'customerEmail'),
      stringValue(payload.status, 'status', true),
      stringValue(payload.currency, 'currency') || 'IDR',
      numberValue(payload.totalAmount),
      dateValue(payload.orderedAt),
      dateValue(payload.completedAt),
      JSON.stringify(recordValue(payload.sourceSnapshot)),
      envelope.checksum,
      booleanValue(payload.needsReview) ? 'NEEDS_REVIEW' : 'RECONCILED',
      booleanValue(payload.grantsAccess),
    ],
  )
  return { targetTable: 'commerce_historical_order_archives', targetId: result.rows[0].id }
}

async function importSubscription(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const userId = await resolveIdentityUserId(context, payload.userExternalId)
  const productId = await requireMappedId(context, 'product', payload.productExternalId)
  const planExternalId = stringValue(payload.planExternalId, 'planExternalId') || envelope.externalId
  const plan = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_subscription_plans (
       org_id, store_product_id, name, billing_interval, billing_interval_count,
       price, trial_days, signup_fee, grace_period_days, max_cycles, is_active,
       external_source, external_id
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $12
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       name = EXCLUDED.name, billing_interval = EXCLUDED.billing_interval,
       billing_interval_count = EXCLUDED.billing_interval_count,
       price = EXCLUDED.price, trial_days = EXCLUDED.trial_days,
       signup_fee = EXCLUDED.signup_fee,
       grace_period_days = EXCLUDED.grace_period_days,
       max_cycles = EXCLUDED.max_cycles, is_active = TRUE, updated_at = NOW()
     RETURNING id::text`,
    [
      context.orgId,
      productId,
      stringValue(payload.planName, 'planName') || 'Paket Berlangganan',
      enumValue(payload.billingInterval, ['DAY', 'WEEK', 'MONTH', 'YEAR'] as const, 'MONTH'),
      Math.max(1, integerValue(payload.billingIntervalCount, 1)),
      numberValue(payload.price),
      Math.max(0, integerValue(payload.trialDays)),
      Math.max(0, numberValue(payload.signupFee)),
      Math.max(0, integerValue(payload.gracePeriodDays)),
      integerValue(payload.maxCycles) || null,
      SOURCE_SYSTEM,
      planExternalId,
    ],
  )
  const id = await existingExternalId(context, 'commerce_subscriptions', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_subscriptions (
       id, org_id, user_id, plan_id, status, current_period_start,
       current_period_end, trial_ends_at, grace_ends_at, next_renewal_at,
       cancelled_at, provider_reference, idempotency_key, external_source,
       external_id, source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4::uuid,
       $5, $6::timestamptz, $7::timestamptz, $8::timestamptz,
       $9::timestamptz, $10::timestamptz, $11::timestamptz, $12,
       $13, $14, $15, $16::jsonb
     )
     ON CONFLICT (org_id, idempotency_key) DO UPDATE SET
       status = EXCLUDED.status, current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       trial_ends_at = EXCLUDED.trial_ends_at, grace_ends_at = EXCLUDED.grace_ends_at,
       next_renewal_at = EXCLUDED.next_renewal_at,
       cancelled_at = EXCLUDED.cancelled_at,
       provider_reference = EXCLUDED.provider_reference,
       source_snapshot = EXCLUDED.source_snapshot, updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      userId,
      plan.rows[0].id,
      enumValue(payload.status, [
        'PENDING', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE', 'PAUSED', 'CANCELLED', 'EXPIRED',
      ] as const, 'ACTIVE'),
      dateValue(payload.currentPeriodStart),
      dateValue(payload.currentPeriodEnd),
      dateValue(payload.trialEndsAt),
      dateValue(payload.graceEndsAt),
      dateValue(payload.nextRenewalAt),
      dateValue(payload.cancelledAt),
      stringValue(payload.providerReference, 'providerReference'),
      `migration:subscription:${envelope.externalId}`,
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'commerce_subscriptions', targetId: result.rows[0].id, metadata: { planId: plan.rows[0].id } }
}

async function importCoupon(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const allowedProductIds: string[] = []
  for (const productExternalId of stringArray(payload.allowedProductExternalIds)) {
    allowedProductIds.push(await requireMappedId(context, 'product', productExternalId))
  }
  const id = await existingExternalId(context, 'commerce_coupons', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_coupons (
       id, org_id, code, discount_type, discount_value, minimum_amount,
       starts_at, expires_at, usage_limit, per_user_limit,
       allowed_store_product_ids, is_active, external_source, external_id,
       source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, upper($3), $4, $5,
       $6, $7::timestamptz, $8::timestamptz, $9, $10, $11::uuid[], $12,
       $13, $14, $15::jsonb
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       code = EXCLUDED.code, discount_type = EXCLUDED.discount_type,
       discount_value = EXCLUDED.discount_value,
       minimum_amount = EXCLUDED.minimum_amount, starts_at = EXCLUDED.starts_at,
       expires_at = EXCLUDED.expires_at, usage_limit = EXCLUDED.usage_limit,
       per_user_limit = EXCLUDED.per_user_limit,
       allowed_store_product_ids = EXCLUDED.allowed_store_product_ids,
       is_active = EXCLUDED.is_active, source_snapshot = EXCLUDED.source_snapshot,
       updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      stringValue(payload.code, 'code', true),
      enumValue(payload.discountType, ['FIXED', 'PERCENT'] as const, 'FIXED'),
      numberValue(payload.discountValue),
      numberValue(payload.minimumAmount),
      dateValue(payload.startsAt),
      dateValue(payload.expiresAt),
      integerValue(payload.usageLimit) || null,
      Math.max(1, integerValue(payload.perUserLimit, 1)),
      allowedProductIds,
      booleanValue(payload.active, true),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'commerce_coupons', targetId: result.rows[0].id }
}

async function importAffiliate(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const userId = await resolveIdentityUserId(context, payload.userExternalId)
  const id = await existingExternalId(context, 'commerce_affiliate_profiles', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_affiliate_profiles (
       id, org_id, user_id, referral_code, status, payout_details,
       default_commission_type, default_commission_value, cookie_days,
       external_source, external_id, source_snapshot, approved_at
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4, $5,
       $6::jsonb, $7, $8, $9, $10, $11, $12::jsonb,
       CASE WHEN $5 = 'ACTIVE' THEN NOW() ELSE NULL END
     )
     ON CONFLICT (org_id, user_id) DO UPDATE SET
       referral_code = EXCLUDED.referral_code, status = EXCLUDED.status,
       payout_details = EXCLUDED.payout_details,
       default_commission_type = EXCLUDED.default_commission_type,
       default_commission_value = EXCLUDED.default_commission_value,
       cookie_days = EXCLUDED.cookie_days, external_source = EXCLUDED.external_source,
       external_id = EXCLUDED.external_id, source_snapshot = EXCLUDED.source_snapshot,
       approved_at = COALESCE(public.commerce_affiliate_profiles.approved_at, EXCLUDED.approved_at),
       updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      userId,
      stringValue(payload.referralCode, 'referralCode', true),
      enumValue(payload.status, ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const, 'PENDING'),
      JSON.stringify(recordValue(payload.payoutDetails)),
      enumValue(payload.commissionType, ['FIXED', 'PERCENT'] as const, 'PERCENT'),
      numberValue(payload.commissionValue),
      Math.max(1, integerValue(payload.cookieDays, 30)),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'commerce_affiliate_profiles', targetId: result.rows[0].id }
}

async function importAffiliateRule(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const affiliateExternalId = stringValue(payload.affiliateExternalId, 'affiliateExternalId')
  const productExternalId = stringValue(payload.productExternalId, 'productExternalId')
  const affiliateId = affiliateExternalId
    ? await requireMappedId(context, 'affiliate', affiliateExternalId)
    : null
  const productId = productExternalId
    ? await requireMappedId(context, 'product', productExternalId)
    : null
  const id = await existingExternalId(context, 'commerce_affiliate_rules', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_affiliate_rules (
       id, org_id, affiliate_profile_id, store_product_id, commission_type,
       initial_value, renewal_value, tier, is_active, external_source,
       external_id, source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4::uuid,
       $5, $6, $7, $8, $9, $10, $11, $12::jsonb
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       affiliate_profile_id = EXCLUDED.affiliate_profile_id,
       store_product_id = EXCLUDED.store_product_id,
       commission_type = EXCLUDED.commission_type,
       initial_value = EXCLUDED.initial_value,
       renewal_value = EXCLUDED.renewal_value, tier = EXCLUDED.tier,
       is_active = EXCLUDED.is_active, source_snapshot = EXCLUDED.source_snapshot,
       updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      affiliateId,
      productId,
      enumValue(payload.commissionType, ['FIXED', 'PERCENT'] as const, 'PERCENT'),
      numberValue(payload.initialValue),
      payload.renewalValue == null ? null : numberValue(payload.renewalValue),
      Math.max(1, integerValue(payload.tier, 1)),
      booleanValue(payload.active, true),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'commerce_affiliate_rules', targetId: result.rows[0].id }
}

async function importCommission(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const affiliateId = await requireMappedId(context, 'affiliate', payload.affiliateExternalId)
  const id = await existingExternalId(context, 'commerce_affiliate_commissions', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.commerce_affiliate_commissions (
       id, org_id, affiliate_profile_id, commission_type, base_amount,
       commission_amount, status, payable_at, idempotency_key, external_source,
       external_id, source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4, $5,
       $6, $7, $8::timestamptz, $9, $10, $11, $12::jsonb
     )
     ON CONFLICT (org_id, idempotency_key) DO UPDATE SET
       status = EXCLUDED.status, base_amount = EXCLUDED.base_amount,
       commission_amount = EXCLUDED.commission_amount,
       payable_at = EXCLUDED.payable_at, source_snapshot = EXCLUDED.source_snapshot,
       updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      affiliateId,
      enumValue(payload.commissionType, ['INITIAL', 'RENEWAL'] as const, 'INITIAL'),
      numberValue(payload.basisAmount),
      numberValue(payload.commissionAmount),
      enumValue(payload.status, ['PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELLED'] as const, 'PENDING'),
      dateValue(payload.payableAt),
      `migration:commission:${envelope.externalId}`,
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify({ ...payload, openingLiability: true }),
    ],
  )
  return {
    targetTable: 'commerce_affiliate_commissions',
    targetId: result.rows[0].id,
    metadata: { journalCreated: false, openingLiability: true },
  }
}

async function importCertificate(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const userId = await resolveIdentityUserId(context, payload.userExternalId)
  const courseId = await requireMappedId(context, 'course', payload.courseExternalId)
  const enrollmentExternalId = stringValue(payload.enrollmentExternalId, 'enrollmentExternalId')
  const enrollmentId = enrollmentExternalId
    ? await requireMappedId(context, 'enrollment', enrollmentExternalId)
    : null
  const id = await existingExternalId(context, 'lms_certificates', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.lms_certificates (
       id, org_id, registration_id, user_id, enrollment_id, course_id,
       certificate_number, issue_date, file_url, storage_key,
       verification_token, status, expires_at, external_source, external_id,
       source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, NULL, $3::uuid,
       $4::uuid, $5::uuid, $6, COALESCE($7::date, CURRENT_DATE), $8, $9,
       $10, $11, $12::timestamptz, $13, $14, $15::jsonb
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       user_id = EXCLUDED.user_id, enrollment_id = EXCLUDED.enrollment_id,
       course_id = EXCLUDED.course_id,
       certificate_number = EXCLUDED.certificate_number,
       issue_date = EXCLUDED.issue_date, file_url = EXCLUDED.file_url,
       storage_key = EXCLUDED.storage_key,
       verification_token = EXCLUDED.verification_token,
       status = EXCLUDED.status, expires_at = EXCLUDED.expires_at,
       source_snapshot = EXCLUDED.source_snapshot, updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      userId,
      enrollmentId,
      courseId,
      stringValue(payload.certificateNumber, 'certificateNumber', true),
      stringValue(payload.issueDate, 'issueDate'),
      stringValue(payload.fileUrl, 'fileUrl'),
      stringValue(payload.storageKey, 'storageKey'),
      stringValue(payload.verificationToken, 'verificationToken') || randomUUID(),
      enumValue(payload.status, ['ACTIVE', 'EXPIRED', 'REVOKED'] as const, 'ACTIVE'),
      dateValue(payload.expiresAt),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'lms_certificates', targetId: result.rows[0].id }
}

async function importCmsContent(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const id = await existingExternalId(context, 'cms_content_entries', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.cms_content_entries (
       id, org_id, content_type, slug, title, excerpt, content_html,
       featured_image_storage_key, seo_title, seo_description,
       seo_canonical_url, analytics_config, status, published_at,
       external_source, external_id, source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12::jsonb, $13, $14::timestamptz, $15, $16,
       $17::jsonb
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       content_type = EXCLUDED.content_type, slug = EXCLUDED.slug,
       title = EXCLUDED.title, excerpt = EXCLUDED.excerpt,
       content_html = EXCLUDED.content_html,
       featured_image_storage_key = EXCLUDED.featured_image_storage_key,
       seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description,
       seo_canonical_url = EXCLUDED.seo_canonical_url,
       analytics_config = EXCLUDED.analytics_config, status = EXCLUDED.status,
       published_at = EXCLUDED.published_at,
       source_snapshot = EXCLUDED.source_snapshot, updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      enumValue(payload.contentType, ['PAGE', 'ARTICLE'] as const, 'PAGE'),
      normalizeSlug(payload.slug),
      stringValue(payload.title, 'title', true),
      stringValue(payload.excerpt, 'excerpt'),
      sanitizeLearningHtml(payload.contentHtml),
      stringValue(payload.featuredImageStorageKey, 'featuredImageStorageKey'),
      stringValue(payload.seoTitle, 'seoTitle'),
      stringValue(payload.seoDescription, 'seoDescription'),
      stringValue(payload.canonicalUrl, 'canonicalUrl'),
      JSON.stringify(recordValue(payload.analyticsConfig)),
      enumValue(payload.status, ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const, 'DRAFT'),
      dateValue(payload.publishedAt),
      SOURCE_SYSTEM,
      envelope.externalId,
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'cms_content_entries', targetId: result.rows[0].id }
}

async function importCmsRedirect(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const id = await existingExternalId(context, 'cms_redirects', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.cms_redirects (
       id, org_id, source_path, destination_url, status_code, is_active,
       external_source, external_id
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, $4, $5, $6, $7, $8
     )
     ON CONFLICT (org_id, external_source, external_id)
       WHERE external_source IS NOT NULL AND external_id IS NOT NULL
     DO UPDATE SET
       source_path = EXCLUDED.source_path,
       destination_url = EXCLUDED.destination_url,
       status_code = EXCLUDED.status_code, is_active = EXCLUDED.is_active,
       updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      stringValue(payload.sourcePath, 'sourcePath', true),
      stringValue(payload.destinationUrl, 'destinationUrl', true),
      [301, 302, 307, 308].includes(integerValue(payload.statusCode))
        ? integerValue(payload.statusCode)
        : 301,
      booleanValue(payload.active, true),
      SOURCE_SYSTEM,
      envelope.externalId,
    ],
  )
  return { targetTable: 'cms_redirects', targetId: result.rows[0].id }
}

async function importMedia(context: ImportContext, envelope: MigrationEnvelope): Promise<ImportResult> {
  const payload = envelope.payload
  const sourceUrl = stringValue(payload.sourceUrl ?? payload.url, 'sourceUrl', true)!
  let fileName = stringValue(payload.fileName, 'fileName')
  if (!fileName) {
    try {
      fileName = decodeURIComponent(new URL(sourceUrl).pathname.split('/').pop() || '')
    } catch {
      fileName = ''
    }
  }
  if (!fileName) fileName = `media-${envelope.externalId}`
  const id = await existingExternalId(context, 'migration_media_assets', envelope.externalId)
  const result = await context.client.query<{ id: string }>(
    `INSERT INTO public.migration_media_assets (
       id, org_id, external_source, external_id, source_url, file_name,
       mime_type, file_size_bytes, expected_checksum_sha256, storage_key,
       parent_external_id, alt_text, source_snapshot
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, $4, $5, $6,
       $7, $8, $9, $10, $11, $12, $13::jsonb
     )
     ON CONFLICT (org_id, external_source, external_id) DO UPDATE SET
       source_url = EXCLUDED.source_url,
       file_name = EXCLUDED.file_name,
       mime_type = EXCLUDED.mime_type,
       file_size_bytes = EXCLUDED.file_size_bytes,
       expected_checksum_sha256 = EXCLUDED.expected_checksum_sha256,
       storage_key = COALESCE(public.migration_media_assets.storage_key, EXCLUDED.storage_key),
       parent_external_id = EXCLUDED.parent_external_id,
       alt_text = EXCLUDED.alt_text,
       source_snapshot = EXCLUDED.source_snapshot,
       copy_status = CASE
         WHEN public.migration_media_assets.actual_checksum_sha256 IS DISTINCT FROM
              EXCLUDED.expected_checksum_sha256
           THEN 'PENDING'
         ELSE public.migration_media_assets.copy_status
       END,
       updated_at = NOW()
     RETURNING id::text`,
    [
      id,
      context.orgId,
      SOURCE_SYSTEM,
      envelope.externalId,
      sourceUrl,
      fileName,
      stringValue(payload.mimeType, 'mimeType'),
      integerValue(payload.fileSizeBytes) || null,
      stringValue(payload.checksumSha256, 'checksumSha256'),
      stringValue(payload.storageKey, 'storageKey'),
      stringValue(payload.parentExternalId ?? payload.parentId, 'parentExternalId'),
      stringValue(payload.altText, 'altText'),
      JSON.stringify(payload),
    ],
  )
  return { targetTable: 'migration_media_assets', targetId: result.rows[0].id }
}

export async function importEnvelope(
  context: ImportContext,
  envelope: MigrationEnvelope,
): Promise<ImportResult> {
  switch (envelope.entityType) {
    case 'user': return importUser(context, envelope)
    case 'course': return importCourse(context, envelope)
    case 'section': return importSection(context, envelope)
    case 'lesson': return importLesson(context, envelope)
    case 'lesson_asset': return importLessonAsset(context, envelope)
    case 'instructor': return importInstructor(context, envelope)
    case 'course_instructor': return importCourseInstructor(context, envelope)
    case 'batch': return importBatch(context, envelope)
    case 'session': return importSession(context, envelope)
    case 'enrollment': return importEnrollment(context, envelope)
    case 'progress': return importProgress(context, envelope)
    case 'quiz': return importQuiz(context, envelope)
    case 'question': return importQuestion(context, envelope)
    case 'assignment': return importAssignment(context, envelope)
    case 'product': return importProduct(context, envelope)
    case 'product_variant': return importProductVariant(context, envelope)
    case 'product_course': return importProductCourse(context, envelope)
    case 'order_bump': return importOrderBump(context, envelope)
    case 'access_package': return importAccessPackage(context, envelope)
    case 'membership': return importMembership(context, envelope)
    case 'order_archive': return importOrderArchive(context, envelope)
    case 'subscription': return importSubscription(context, envelope)
    case 'coupon': return importCoupon(context, envelope)
    case 'affiliate': return importAffiliate(context, envelope)
    case 'affiliate_rule': return importAffiliateRule(context, envelope)
    case 'commission': return importCommission(context, envelope)
    case 'certificate': return importCertificate(context, envelope)
    case 'cms_content': return importCmsContent(context, envelope)
    case 'cms_redirect': return importCmsRedirect(context, envelope)
    case 'media': return importMedia(context, envelope)
  }
}

export async function upsertEntityMapping(
  context: ImportContext,
  envelope: MigrationEnvelope,
  result: ImportResult,
) {
  await context.client.query(
    `INSERT INTO public.migration_entity_map (
       org_id, run_id, source_system, entity_type, external_id, target_table,
       target_id, source_checksum, source_updated_at, migrated_at, metadata
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8,
       $9::timestamptz, NOW(), $10::jsonb
     )
     ON CONFLICT (org_id, source_system, entity_type, external_id) DO UPDATE
     SET
       run_id = EXCLUDED.run_id,
       target_table = EXCLUDED.target_table,
       target_id = EXCLUDED.target_id,
       source_checksum = EXCLUDED.source_checksum,
       source_updated_at = EXCLUDED.source_updated_at,
       migrated_at = NOW(),
       metadata = EXCLUDED.metadata`,
    [
      context.orgId,
      context.runId,
      SOURCE_SYSTEM,
      envelope.entityType,
      envelope.externalId,
      result.targetTable,
      result.targetId,
      envelope.checksum,
      envelope.updatedAt,
      JSON.stringify(result.metadata || {}),
    ],
  )
}

export async function getExistingChecksum(
  context: ImportContext,
  envelope: MigrationEnvelope,
) {
  const mapping = await findMapping(context, envelope.entityType, envelope.externalId)
  return mapping?.source_checksum || null
}
