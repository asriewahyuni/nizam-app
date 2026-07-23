/**
 * Mengubah event mentah bridge WordPress menjadi kontrak importer Nizam.
 * Event diproses berurutan, idempoten, dan source delete selalu ditahan untuk
 * review agar konten/data Nizam tidak terhapus otomatis.
 */
import { createHash } from 'node:crypto'
import { connectPostgresClient, closePostgresPool } from '../../lib/db/postgres'
import {
  canonicalJson,
  isCoreisecEntityType,
  isRecord,
  type CoreisecEntityType,
  type MigrationEnvelope,
} from './migration-types'
import {
  getExistingChecksum,
  importEnvelope,
  upsertEntityMapping,
  type ImportContext,
} from './import-handlers'

type BridgeRow = {
  id: string
  source_event_id: number
  entity_type: string
  external_id: string
  operation: 'UPSERT' | 'DELETE'
  payload: Record<string, unknown>
  source_updated_at: string | null
}

function argValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3).trim()
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : ''
}

function text(value: unknown) {
  if (value == null) return ''
  return String(value).trim()
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function bool(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  const normalized = text(value).toLowerCase()
  if (['1', 'true', 'yes', 'publish', 'active'].includes(normalized)) return true
  if (['0', 'false', 'no', 'draft', 'inactive'].includes(normalized)) return false
  return fallback
}

function firstValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value) && value.length > 0) return value[0]
    if (value != null && text(value)) return value
  }
  return null
}

function sourceRow(payload: Record<string, unknown>) {
  return isRecord(payload.row) ? payload.row : payload
}

function metadata(payload: Record<string, unknown>) {
  return isRecord(payload.metadata) ? payload.metadata : {}
}

function wpStatus(value: unknown): 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' {
  const status = text(value).toLowerCase()
  if (status === 'publish' || status === 'published') return 'PUBLISHED'
  if (['trash', 'archived'].includes(status)) return 'ARCHIVED'
  return 'DRAFT'
}

function normalizePostEvent(event: BridgeRow): {
  entityType: CoreisecEntityType
  externalId: string
  payload: Record<string, unknown>
} {
  const payload = event.payload
  const meta = metadata(payload)
  const postType = text(payload.postType)
  const status = wpStatus(payload.status)
  const commonSnapshot = { ...payload, bridgeEventId: event.source_event_id }

  if (event.entity_type === 'cms_content') {
    return {
      entityType: 'cms_content',
      externalId: event.external_id,
      payload: {
        contentType: postType === 'post' ? 'ARTICLE' : 'PAGE',
        slug: text(payload.slug) || `wordpress-${event.external_id}`,
        title: text(payload.title) || `Konten ${event.external_id}`,
        excerpt: text(payload.excerpt) || null,
        contentHtml: text(payload.contentHtml),
        featuredImageStorageKey: null,
        seoTitle: text(firstValue(meta, ['_yoast_wpseo_title', 'rank_math_title'])) || null,
        seoDescription: text(firstValue(meta, [
          '_yoast_wpseo_metadesc',
          'rank_math_description',
        ])) || null,
        canonicalUrl: text(payload.url) || null,
        status,
        publishedAt: null,
        analyticsConfig: {},
        sourceSnapshot: commonSnapshot,
      },
    }
  }

  if (event.entity_type === 'media') {
    return {
      entityType: 'media',
      externalId: event.external_id,
      payload: {
        sourceUrl: text(payload.url),
        fileName: text(firstValue(meta, ['_wp_attached_file']))
          || text(payload.slug)
          || `media-${event.external_id}`,
        mimeType: text(payload.mimeType) || null,
        fileSizeBytes: number(firstValue(meta, ['_wp_attachment_metadata_filesize'])) || null,
        checksumSha256: null,
        storageKey: null,
        parentExternalId: text(payload.parentId) || null,
        altText: text(firstValue(meta, ['_wp_attachment_image_alt'])) || null,
        sourceSnapshot: commonSnapshot,
      },
    }
  }

  if (event.entity_type === 'course') {
    return {
      entityType: 'course',
      externalId: event.external_id,
      payload: {
        slug: text(payload.slug) || `course-${event.external_id}`,
        title: text(payload.title) || `Course ${event.external_id}`,
        descriptionHtml: text(payload.contentHtml),
        status,
        level: text(firstValue(meta, ['level', '_lp_level'])) || null,
        featured: bool(firstValue(meta, ['featured', '_lp_featured'])),
        listed: status !== 'ARCHIVED',
        previewVideoUrl: text(firstValue(meta, [
          'preview_video_url',
          '_lp_preview_video',
          'video_url',
        ])) || null,
        durationMinutes: number(firstValue(meta, ['duration_minutes', '_lp_duration'])) || null,
        outcomes: [],
        accessDurationValue: number(firstValue(meta, ['access_duration_value'])) || null,
        accessDurationUnit: text(firstValue(meta, ['access_duration_unit'])) || null,
        closedAccessMessage: text(firstValue(meta, ['closed_access_message'])) || null,
        seoTitle: text(firstValue(meta, ['_yoast_wpseo_title', 'rank_math_title'])) || null,
        seoDescription: text(firstValue(meta, [
          '_yoast_wpseo_metadesc',
          'rank_math_description',
        ])) || null,
        sourceSnapshot: commonSnapshot,
      },
    }
  }

  if (event.entity_type === 'product') {
    const regularPrice = number(firstValue(meta, [
      'regular_price',
      '_regular_price',
      'price',
      '_price',
    ]))
    const salePriceRaw = firstValue(meta, ['sale_price', '_sale_price'])
    const type = text(firstValue(meta, ['type', 'product_type', '_virtual'])).toLowerCase()
    return {
      entityType: 'product',
      externalId: event.external_id,
      payload: {
        slug: text(payload.slug) || `product-${event.external_id}`,
        name: text(payload.title) || `Produk ${event.external_id}`,
        descriptionHtml: text(payload.contentHtml),
        sku: text(firstValue(meta, ['sku', '_sku'])) || null,
        physical: !['digital', 'virtual', '1'].includes(type),
        regularPrice,
        salePrice: text(salePriceRaw) ? number(salePriceRaw) : null,
        published: status === 'PUBLISHED',
        featured: bool(firstValue(meta, ['featured', '_featured'])),
        quantityEnabled: bool(firstValue(meta, ['quantity_enabled']), true),
        purchaseLimitPerUser: number(firstValue(meta, ['purchase_limit'])) || null,
        saleStartsAt: null,
        saleEndsAt: null,
        followUpContent: [],
        analyticsConfig: {},
        sourceSnapshot: commonSnapshot,
      },
    }
  }

  if (event.entity_type === 'lesson') {
    const courseExternalId = text(firstValue(meta, [
      'course_id',
      '_course_id',
      '_lp_course',
      'sejoli_course_id',
    ])) || (text(payload.parentId) !== '0' ? text(payload.parentId) : '')
    if (!courseExternalId) throw new Error('Relasi course lesson tidak ditemukan pada event WordPress.')
    return {
      entityType: 'lesson',
      externalId: event.external_id,
      payload: {
        courseExternalId,
        sectionExternalId: text(firstValue(meta, ['section_id', '_section_id'])) || null,
        slug: text(payload.slug) || `lesson-${event.external_id}`,
        title: text(payload.title) || `Lesson ${event.external_id}`,
        lessonType: postType === 'lp_quiz' ? 'QUIZ' : 'TEXT',
        contentHtml: text(payload.contentHtml),
        sortOrder: number(firstValue(meta, ['order', '_lp_order'])),
        required: !bool(firstValue(meta, ['optional'])),
        preview: bool(firstValue(meta, ['preview', '_lp_preview'])),
        durationSeconds: number(firstValue(meta, ['duration_seconds'])) || null,
        dripValue: number(firstValue(meta, ['drip_value'])) || null,
        dripUnit: text(firstValue(meta, ['drip_unit'])) || null,
        embedProvider: null,
        embedUrl: text(firstValue(meta, ['video_url', 'embed_url'])) || null,
        mediaItems: [],
        sourceSnapshot: commonSnapshot,
      },
    }
  }

  if (event.entity_type === 'quiz') {
    const courseExternalId = text(firstValue(meta, ['course_id', '_course_id', '_lp_course']))
    if (!courseExternalId) throw new Error('Relasi course kuis tidak ditemukan pada event WordPress.')
    return {
      entityType: 'quiz',
      externalId: event.external_id,
      payload: {
        courseExternalId,
        lessonExternalId: null,
        title: text(payload.title) || `Kuis ${event.external_id}`,
        description: text(payload.contentHtml),
        status,
        timeLimitMinutes: number(firstValue(meta, ['duration', '_lp_duration'])) || null,
        maxAttempts: number(firstValue(meta, ['retake_count', '_lp_retake_count'])) || null,
        passingScore: number(firstValue(meta, ['passing_grade', '_lp_passing_grade']), 70),
        randomizeQuestions: bool(firstValue(meta, ['random_question', '_lp_random_mode'])),
        randomizeOptions: bool(firstValue(meta, ['random_answers'])),
        showExplanations: true,
        sourceSnapshot: commonSnapshot,
      },
    }
  }

  if (event.entity_type === 'question') {
    const quizExternalId = text(firstValue(meta, ['quiz_id', '_quiz_id', '_lp_quiz']))
    if (!quizExternalId) throw new Error('Relasi kuis untuk soal tidak ditemukan pada event WordPress.')
    return {
      entityType: 'question',
      externalId: event.external_id,
      payload: {
        quizExternalId,
        questionBankKey: null,
        questionType: 'SINGLE_CHOICE',
        promptHtml: text(payload.contentHtml) || text(payload.title),
        explanationHtml: null,
        points: number(firstValue(meta, ['mark', '_lp_mark']), 1),
        sortOrder: number(firstValue(meta, ['order', '_lp_order'])),
        active: status !== 'ARCHIVED',
        options: [],
        sourceSnapshot: commonSnapshot,
      },
    }
  }

  throw new Error(`Adapter event post ${event.entity_type} belum tersedia.`)
}

function normalizeTableEvent(event: BridgeRow): {
  entityType: CoreisecEntityType
  externalId: string
  payload: Record<string, unknown>
} {
  const row = sourceRow(event.payload)
  const key = (...keys: string[]) => firstValue(row, keys)
  const snapshot = { ...event.payload, bridgeEventId: event.source_event_id }

  if (event.entity_type === 'order_archive') {
    const status = text(key('status', 'order_status')) || 'unknown'
    return {
      entityType: 'order_archive',
      externalId: event.external_id,
      payload: {
        userExternalId: text(key('user_id', 'userId', 'customer_id')) || null,
        orderNumber: text(key('order_number', 'invoice', 'order_id', 'ID')) || event.external_id,
        customerEmail: text(key('email', 'customer_email', 'billing_email')) || null,
        status,
        currency: text(key('currency')) || 'IDR',
        totalAmount: number(key('total', 'grand_total', 'total_amount')),
        orderedAt: text(key('created_at', 'created', 'order_date')) || null,
        completedAt: text(key('completed_at', 'paid_at')) || null,
        grantsAccess: ['completed', 'paid', 'success'].includes(status.toLowerCase()),
        needsReview: !['completed', 'paid', 'success', 'cancelled', 'expired', 'refunded']
          .includes(status.toLowerCase()),
        sourceSnapshot: snapshot,
      },
    }
  }

  if (event.entity_type === 'subscription') {
    return {
      entityType: 'subscription',
      externalId: event.external_id,
      payload: {
        userExternalId: text(key('user_id', 'customer_id')),
        productExternalId: text(key('product_id')),
        planExternalId: text(key('product_id')) || event.external_id,
        planName: text(key('name', 'product_name')) || 'Paket Berlangganan',
        billingInterval: text(key('period', 'billing_interval')) || 'MONTH',
        billingIntervalCount: number(key('period_count', 'billing_interval_count'), 1),
        price: number(key('recurring_total', 'price', 'amount')),
        trialDays: number(key('trial_days')),
        signupFee: number(key('signup_fee')),
        gracePeriodDays: number(key('grace_period_days'), 7),
        maxCycles: number(key('max_cycles')) || null,
        status: text(key('status')) || 'ACTIVE',
        currentPeriodStart: text(key('start_date', 'current_period_start')) || null,
        currentPeriodEnd: text(key('end_date', 'current_period_end')) || null,
        trialEndsAt: text(key('trial_ends_at')) || null,
        graceEndsAt: text(key('grace_ends_at')) || null,
        nextRenewalAt: text(key('next_payment_date', 'next_renewal_at')) || null,
        cancelledAt: text(key('cancelled_at')) || null,
        providerReference: text(key('payment_id', 'provider_reference')) || null,
        sourceSnapshot: snapshot,
      },
    }
  }

  if (event.entity_type === 'coupon') {
    return {
      entityType: 'coupon',
      externalId: event.external_id,
      payload: {
        code: text(key('code', 'coupon_code')) || `WP-${event.external_id}`,
        discountType: text(key('type', 'discount_type')).includes('percent')
          ? 'PERCENT'
          : 'FIXED',
        discountValue: number(key('amount', 'discount_value')),
        minimumAmount: number(key('minimum_amount', 'min_purchase')),
        startsAt: text(key('start_date', 'starts_at')) || null,
        expiresAt: text(key('expired_at', 'end_date', 'expires_at')) || null,
        usageLimit: number(key('limit', 'usage_limit')) || null,
        perUserLimit: number(key('limit_per_user', 'per_user_limit'), 1),
        allowedProductExternalIds: [],
        active: bool(key('status', 'active'), true),
        sourceSnapshot: snapshot,
      },
    }
  }

  if (event.entity_type === 'commission') {
    return {
      entityType: 'commission',
      externalId: event.external_id,
      payload: {
        affiliateExternalId: text(key('affiliate_id', 'user_id')),
        commissionType: text(key('type')).toLowerCase().includes('renewal')
          ? 'RENEWAL'
          : 'INITIAL',
        basisAmount: number(key('order_total', 'basis_amount', 'base_amount')),
        commissionAmount: number(key('commission', 'commission_amount', 'amount')),
        status: text(key('status')) || 'PENDING',
        payableAt: text(key('payable_at', 'created_at')) || null,
        sourceSnapshot: snapshot,
      },
    }
  }

  if (event.entity_type === 'learnpress_user_item') {
    const itemType = text(key('item_type')).toLowerCase()
    if (itemType.includes('course')) {
      return {
        entityType: 'enrollment',
        externalId: event.external_id,
        payload: {
          userExternalId: text(key('user_id')),
          courseExternalId: text(key('item_id')),
          batchExternalId: null,
          status: text(key('status')).includes('finish') ? 'COMPLETED' : 'IN_PROGRESS',
          startedAt: text(key('start_time')) || null,
          completedAt: text(key('end_time')) || null,
          finalScore: number(key('graduation')) || null,
          sourceSnapshot: snapshot,
        },
      }
    }
    if (itemType.includes('lesson')) {
      return {
        entityType: 'progress',
        externalId: event.external_id,
        payload: {
          enrollmentExternalId: text(key('parent_id')),
          lessonExternalId: text(key('item_id')),
          status: text(key('status')).includes('complete') ? 'COMPLETED' : 'VIEWED',
          viewedAt: text(key('start_time')) || null,
          completedAt: text(key('end_time')) || null,
          lastPositionSeconds: 0,
          sourceSnapshot: snapshot,
        },
      }
    }
    throw new Error(`Jenis LearnPress ${itemType || '(kosong)'} belum didukung.`)
  }

  if (event.entity_type === 'progress') {
    throw new Error(
      'Event penyelesaian course Sejoli harus direkonsiliasi ke enrollment; '
      + 'payload tabel tidak menyediakan lesson secara pasti.',
    )
  }

  if (isCoreisecEntityType(event.entity_type)) {
    return {
      entityType: event.entity_type,
      externalId: event.external_id,
      payload: row,
    }
  }
  throw new Error(`Jenis event ${event.entity_type} belum dikenal.`)
}

function normalizeEvent(event: BridgeRow): MigrationEnvelope {
  const normalized = event.payload.postType
    ? normalizePostEvent(event)
    : normalizeTableEvent(event)
  const checksum = createHash('sha256')
    .update(canonicalJson(normalized.payload))
    .digest('hex')
  return {
    entityType: normalized.entityType,
    externalId: normalized.externalId,
    updatedAt: event.source_updated_at,
    checksum,
    payload: normalized.payload,
  }
}

async function createRun(orgId: string, client: Awaited<ReturnType<typeof connectPostgresClient>>) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO public.migration_runs (
       org_id, source_system, source_snapshot_id, mode, status, started_at
     ) VALUES (
       $1::uuid, 'WORDPRESS_COREISEC', 'wordpress-bridge-live', 'DELTA',
       'RUNNING', NOW()
     )
     ON CONFLICT (org_id, source_system, source_snapshot_id, mode) DO UPDATE SET
       status = 'RUNNING', error_message = NULL, completed_at = NULL,
       updated_at = NOW()
     RETURNING id::text`,
    [orgId],
  )
  return result.rows[0].id
}

async function recordConflict(
  context: ImportContext,
  event: BridgeRow,
  error: unknown,
  conflictType = 'DELTA_IMPORT_ERROR',
) {
  const message = error instanceof Error ? error.message : String(error)
  await context.client.query(
    `INSERT INTO public.migration_conflicts (
       org_id, run_id, entity_type, external_id, conflict_type, severity,
       source_value, target_value
     ) VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, 'BLOCKER', $6::jsonb, $7::jsonb
     )
     ON CONFLICT (run_id, entity_type, external_id, conflict_type) DO UPDATE SET
       source_value = EXCLUDED.source_value,
       target_value = EXCLUDED.target_value,
       resolution = NULL, resolved_at = NULL, created_at = NOW()`,
    [
      context.orgId,
      context.runId,
      event.entity_type,
      event.external_id,
      conflictType,
      JSON.stringify(event.payload),
      JSON.stringify({ error: message, sourceEventId: event.source_event_id }),
    ],
  )
  await context.client.query(
    `UPDATE public.migration_bridge_events
     SET status = 'CONFLICT', migration_run_id = $2::uuid,
         error_message = $3, processed_at = NOW()
     WHERE id = $1::uuid`,
    [event.id, context.runId, message],
  )
}

async function processEvent(context: ImportContext, event: BridgeRow) {
  if (event.operation === 'DELETE') {
    await recordConflict(
      context,
      event,
      new Error('Penghapusan sumber memerlukan persetujuan manual. Data Nizam tidak dihapus.'),
      'SOURCE_DELETE_REQUIRES_REVIEW',
    )
    return 'conflict'
  }
  const envelope = normalizeEvent(event)
  await context.client.query(
    `INSERT INTO public.migration_source_payloads (
       org_id, run_id, source_system, entity_type, external_id, payload,
       payload_sha256, source_updated_at
     ) VALUES (
       $1::uuid, $2::uuid, 'WORDPRESS_COREISEC', $3, $4, $5::jsonb, $6,
       $7::timestamptz
     )
     ON CONFLICT (run_id, entity_type, external_id) DO UPDATE SET
       payload = EXCLUDED.payload, payload_sha256 = EXCLUDED.payload_sha256,
       source_updated_at = EXCLUDED.source_updated_at, received_at = NOW()`,
    [
      context.orgId,
      context.runId,
      envelope.entityType,
      envelope.externalId,
      JSON.stringify(envelope.payload),
      envelope.checksum,
      envelope.updatedAt,
    ],
  )
  if (await getExistingChecksum(context, envelope) !== envelope.checksum) {
    const result = await importEnvelope(context, envelope)
    await upsertEntityMapping(context, envelope, result)
  }
  await context.client.query(
    `UPDATE public.migration_conflicts
     SET resolution = 'Delta berikutnya berhasil diproses', resolved_at = NOW()
     WHERE run_id = $1::uuid
       AND entity_type = $2
       AND external_id = $3
       AND conflict_type = 'DELTA_IMPORT_ERROR'
       AND resolved_at IS NULL`,
    [context.runId, event.entity_type, event.external_id],
  )
  await context.client.query(
    `UPDATE public.migration_bridge_events
     SET status = 'PROCESSED', migration_run_id = $2::uuid,
         error_message = NULL, processed_at = NOW()
     WHERE id = $1::uuid`,
    [event.id, context.runId],
  )
  return 'processed'
}

async function main() {
  const orgId = argValue('org-id')
  const storeId = argValue('store-id')
  const limit = Math.max(1, Math.min(number(argValue('limit'), 250), 1000))
  if (!orgId || !storeId) {
    throw new Error('Gunakan --org-id <uuid> --store-id <uuid>.')
  }
  const client = await connectPostgresClient()
  const totals = { selected: 0, processed: 0, conflicts: 0 }
  try {
    const runId = await createRun(orgId, client)
    const context: ImportContext = { client, orgId, storeId, runId }
    while (totals.selected < limit) {
      await client.query('BEGIN')
      let event: BridgeRow | null = null
      try {
        const result = await client.query<BridgeRow>(
          `SELECT
             id::text, source_event_id, entity_type, external_id, operation,
             payload, source_updated_at::text
           FROM public.migration_bridge_events
           WHERE org_id = $1::uuid AND status = 'PENDING'
           ORDER BY source_event_id
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [orgId],
        )
        event = result.rows[0] || null
        if (!event) {
          await client.query('COMMIT')
          break
        }
        totals.selected += 1
        await client.query(
          `UPDATE public.migration_bridge_events
           SET status = 'PROCESSING', migration_run_id = $2::uuid
           WHERE id = $1::uuid`,
          [event.id, runId],
        )
        try {
          const status = await processEvent(context, event)
          if (status === 'processed') totals.processed += 1
          else totals.conflicts += 1
        } catch (error) {
          await recordConflict(context, event, error)
          totals.conflicts += 1
        }
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
    await client.query(
      `UPDATE public.migration_runs
       SET status = CASE WHEN EXISTS (
         SELECT 1 FROM public.migration_bridge_events
         WHERE org_id = $2::uuid AND status = 'CONFLICT'
       ) THEN 'FAILED' ELSE 'SUCCEEDED' END,
       result_counts = $3::jsonb, completed_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid`,
      [runId, orgId, JSON.stringify(totals)],
    )
    console.log(JSON.stringify({ runId, ...totals }, null, 2))
  } finally {
    client.release()
    await closePostgresPool()
  }
}

main().catch((error: unknown) => {
  console.error(
    `[coreisec:bridge:process] ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exitCode = 1
})
