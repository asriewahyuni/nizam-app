/**
 * Enqueue dan worker outbox notifikasi. Worker memakai SKIP LOCKED agar aman
 * dijalankan oleh beberapa proses tanpa mengirim pesan yang sama bersamaan.
 */
import type { PoolClient } from 'pg'
import { connectPostgresClient, queryPostgres } from '@/lib/db/postgres'
import { getNotificationProvider } from './providers'
import { interpolate } from './interpolate.shared'

type OutboxRow = {
  id: string
  org_id: string
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS' | 'IN_APP'
  provider_code: string | null
  recipient: string
  subject: string | null
  body: string
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
  idempotency_key: string
}

/**
 * Kunci event override per-produk (store_products.notification_overrides),
 * meniru "Notifikasi per produk" di Sejoli (on-hold/payment-confirm/
 * in-progress/shipping/completed/cancelled/refunded).
 */
export type ProductNotificationEventKey =
  | 'on_hold'
  | 'payment_confirm'
  | 'in_progress'
  | 'shipping'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export async function enqueueNotification(
  input: {
    orgId: string
    userId?: string | null
    eventType: string
    channel: 'EMAIL' | 'WHATSAPP' | 'SMS' | 'IN_APP'
    recipient: string
    templateKey?: string
    variables?: Record<string, string | number | null>
    subject?: string | null
    body?: string
    providerCode?: string | null
    idempotencyKey: string
    payload?: Record<string, unknown>
    /** Kalau diisi, coba pakai override konten dari produk ini dulu sebelum jatuh ke template org. */
    storeProductId?: string | null
    overrideEventKey?: ProductNotificationEventKey
  },
  client?: PoolClient,
) {
  // Accepts an optional transaction client so callers already inside a
  // BEGIN/COMMIT block (e.g. order finalization) can enqueue atomically with
  // the business change instead of on a separate pooled connection.
  const exec = client
    ? client.query.bind(client)
    : queryPostgres
  const variables = input.variables || {}

  let overrideSubject: string | null = null
  let overrideBody: string | null = null
  if (input.storeProductId && input.overrideEventKey) {
    const channelKey = input.channel === 'EMAIL' ? 'email' : 'whatsapp'
    const overrideResult = await exec<{ notification_overrides: Record<string, unknown> }>(
      `SELECT notification_overrides
       FROM public.store_products
       WHERE id = $1::uuid AND org_id = $2::uuid
       LIMIT 1`,
      [input.storeProductId, input.orgId],
    )
    const overrides = overrideResult.rows[0]?.notification_overrides
    if (overrides && overrides.enabled === true) {
      const eventOverride = overrides[input.overrideEventKey] as Record<string, unknown> | undefined
      const channelOverride = eventOverride?.[channelKey] as Record<string, unknown> | string | undefined
      const rawBody = typeof channelOverride === 'string' ? channelOverride : String((channelOverride as Record<string, unknown>)?.body || '')
      const rawSubject = typeof channelOverride === 'object' && channelOverride
        ? String((channelOverride as Record<string, unknown>).subject || '')
        : ''
      if (rawBody.trim()) {
        overrideBody = rawBody
        overrideSubject = rawSubject || null
      }
    }
  }

  const template = !overrideBody && input.templateKey
    ? await exec<{
        id: string
        subject_template: string | null
        body_template: string
        provider_code: string | null
      }>(
        `SELECT id::text, subject_template, body_template, provider_code
         FROM public.notification_templates
         WHERE org_id = $1::uuid
           AND template_key = $2
           AND channel = $3
           AND is_active = TRUE
         LIMIT 1`,
        [input.orgId, input.templateKey, input.channel],
      )
    : null
  const selected = template?.rows[0]
  const subject = interpolate(overrideSubject || input.subject || selected?.subject_template || '', variables) || null
  const body = interpolate(overrideBody || input.body || selected?.body_template || '', variables)
  if (!body) throw new Error('Isi notifikasi tidak boleh kosong.')

  const result = await exec<{ id: string }>(
    `INSERT INTO public.notification_outbox (
       org_id, user_id, template_id, event_type, channel, provider_code,
       recipient, subject, body, payload, idempotency_key
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10::jsonb, $11
     )
     ON CONFLICT (org_id, idempotency_key) DO UPDATE
     SET updated_at = NOW()
     RETURNING id::text`,
    [
      input.orgId,
      input.userId || null,
      selected?.id || null,
      input.eventType,
      input.channel,
      input.providerCode || selected?.provider_code || null,
      input.recipient,
      subject,
      body,
      JSON.stringify(input.payload || {}),
      input.idempotencyKey,
    ],
  )
  return result.rows[0].id
}

async function claimNotifications(limit: number) {
  const client = await connectPostgresClient()
  try {
    await client.query('BEGIN')
    const claimed = await client.query<OutboxRow>(
      `WITH candidates AS (
         SELECT id
         FROM public.notification_outbox
         WHERE (
             status IN ('PENDING', 'FAILED')
             OR (status = 'PROCESSING' AND locked_at < NOW() - INTERVAL '15 minutes')
           )
           AND available_at <= NOW()
           AND attempts < max_attempts
         ORDER BY available_at, created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE public.notification_outbox outbox
       SET status = 'PROCESSING', locked_at = NOW(), updated_at = NOW()
       FROM candidates
       WHERE outbox.id = candidates.id
       RETURNING
         outbox.id::text, outbox.org_id::text, outbox.channel,
         outbox.provider_code, outbox.recipient, outbox.subject, outbox.body,
         outbox.payload, outbox.attempts, outbox.max_attempts,
         outbox.idempotency_key`,
      [Math.max(1, Math.min(limit, 100))],
    )
    await client.query('COMMIT')
    return claimed.rows
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function dispatchNotificationOutbox(limit = 25) {
  const rows = await claimNotifications(limit)
  const results = { claimed: rows.length, sent: 0, failed: 0, dead: 0 }
  for (const row of rows) {
    const attempt = row.attempts + 1
    try {
      if (row.channel === 'IN_APP') {
        await queryPostgres(
          `UPDATE public.notification_outbox
           SET status = 'DELIVERED', attempts = $2, sent_at = NOW(),
               delivered_at = NOW(), locked_at = NULL, last_error = NULL,
               updated_at = NOW()
           WHERE id = $1::uuid`,
          [row.id, attempt],
        )
        results.sent += 1
        continue
      }
      const provider = getNotificationProvider(row.channel, row.provider_code)
      const delivered = await provider.send({
        orgId: row.org_id,
        recipient: row.recipient,
        subject: row.subject,
        body: row.body,
        payload: row.payload,
        idempotencyKey: row.idempotency_key,
      })
      await queryPostgres(
        `WITH updated AS (
           UPDATE public.notification_outbox
           SET status = $3, attempts = $2, sent_at = COALESCE(sent_at, NOW()),
               delivered_at = CASE WHEN $3 = 'DELIVERED' THEN NOW() ELSE delivered_at END,
               locked_at = NULL, last_error = NULL, updated_at = NOW()
           WHERE id = $1::uuid
           RETURNING org_id
         )
         INSERT INTO public.notification_delivery_logs (
           org_id, outbox_id, attempt_number, provider_code,
           provider_message_id, status, response_payload
         )
         SELECT org_id, $1::uuid, $2, $4, $5, $3, $6::jsonb FROM updated`,
        [
          row.id,
          attempt,
          delivered.state,
          delivered.providerCode,
          delivered.providerMessageId,
          JSON.stringify(delivered.response),
        ],
      )
      results.sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pengiriman gagal.'
      const isDead = attempt >= row.max_attempts
      const retryMinutes = Math.min(360, 2 ** attempt)
      await queryPostgres(
        `WITH updated AS (
           UPDATE public.notification_outbox
           SET status = $3, attempts = $2,
               available_at = NOW() + make_interval(mins => $4),
               locked_at = NULL, last_error = $5, updated_at = NOW()
           WHERE id = $1::uuid
           RETURNING org_id
         )
         INSERT INTO public.notification_delivery_logs (
           org_id, outbox_id, attempt_number, provider_code,
           status, error_message
         )
         SELECT org_id, $1::uuid, $2, COALESCE($6, 'UNKNOWN'), $3, $5 FROM updated`,
        [
          row.id,
          attempt,
          isDead ? 'DEAD' : 'FAILED',
          retryMinutes,
          message.slice(0, 1_000),
          row.provider_code,
        ],
      )
      if (isDead) results.dead += 1
      else results.failed += 1
    }
  }
  return results
}
