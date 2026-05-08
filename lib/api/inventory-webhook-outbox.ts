/**
 * lib/api/inventory-webhook-outbox.ts
 *
 * Worker internal untuk memproses webhook inventory dari outbox database.
 * Queue ini diisi trigger `stock_movements` agar semua sumber mutasi stok
 * tercakup, termasuk flow yang dibuat di fungsi SQL.
 */

import { queryPostgres } from '@/lib/db/postgres'
import { deliverWebhook } from '@/lib/api/webhook'
import type { WebhookEventType } from '@/lib/api/webhook-events'

type ClaimedOutboxRow = {
  id: string
  org_id: string
  branch_id: string | null
  event_type: WebhookEventType
  source_id: string
  payload: unknown
  attempt_count: number | string | null
}

export type InventoryWebhookOutboxResult = {
  claimed: number
  delivered: number
  skipped: number
  failed: number
}

const OUTBOX_EVENT: WebhookEventType = 'inventory_movement'
const MAX_ATTEMPTS = 8

function toSafeAttemptCount(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) && numeric >= 0 ? Math.trunc(numeric) : 0
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function buildRetryDelaySeconds(attemptCount: number) {
  return Math.min(30 * 2 ** Math.max(0, attemptCount - 1), 15 * 60)
}

async function claimOutboxBatch(limit: number, workerId: string) {
  const result = await queryPostgres<ClaimedOutboxRow>(
    `
      WITH claimed AS (
        SELECT id
        FROM public.api_webhook_outbox
        WHERE event_type = $1::text
          AND next_attempt_at <= NOW()
          AND (
            status = 'pending'
            OR (
              status = 'processing'
              AND (
                locked_at IS NULL
                OR locked_at < NOW() - INTERVAL '5 minutes'
              )
            )
          )
        ORDER BY created_at ASC
        LIMIT $2::int
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public.api_webhook_outbox outbox
      SET status = 'processing',
          locked_at = NOW(),
          locked_by = $3::text,
          attempt_count = outbox.attempt_count + 1,
          updated_at = NOW()
      FROM claimed
      WHERE outbox.id = claimed.id
      RETURNING
        outbox.id::text AS id,
        outbox.org_id::text AS org_id,
        outbox.branch_id::text AS branch_id,
        outbox.event_type::text AS event_type,
        outbox.source_id::text AS source_id,
        outbox.payload,
        outbox.attempt_count
    `,
    [OUTBOX_EVENT, limit, workerId]
  )

  return result.rows
}

async function markCompleted(id: string, lastError: string | null) {
  await queryPostgres(
    `
      UPDATE public.api_webhook_outbox
      SET status = 'completed',
          processed_at = NOW(),
          locked_at = NULL,
          locked_by = NULL,
          last_error = $2::text,
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [id, lastError]
  )
}

async function markFailed(id: string, attemptCount: number, error: string) {
  const terminalFailure = attemptCount >= MAX_ATTEMPTS
  const retryDelaySeconds = buildRetryDelaySeconds(attemptCount)

  await queryPostgres(
    `
      UPDATE public.api_webhook_outbox
      SET status = $2::text,
          next_attempt_at = CASE
            WHEN $2::text = 'pending' THEN NOW() + ($3::int * INTERVAL '1 second')
            ELSE next_attempt_at
          END,
          locked_at = NULL,
          locked_by = NULL,
          processed_at = CASE WHEN $2::text = 'failed' THEN NOW() ELSE NULL END,
          last_error = $4::text,
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [id, terminalFailure ? 'failed' : 'pending', retryDelaySeconds, error]
  )
}

export async function processInventoryWebhookOutboxBatch(
  limit = 25,
  workerId = `inventory-webhook-worker:${process.pid}`
): Promise<InventoryWebhookOutboxResult> {
  const claimedRows = await claimOutboxBatch(Math.max(1, Math.min(limit, 100)), workerId)
  const result: InventoryWebhookOutboxResult = {
    claimed: claimedRows.length,
    delivered: 0,
    skipped: 0,
    failed: 0,
  }

  for (const row of claimedRows) {
    const payload = asRecord(row.payload)
    const attemptCount = toSafeAttemptCount(row.attempt_count)

    if (!payload) {
      result.failed += 1
      await markFailed(row.id, attemptCount, 'invalid_inventory_webhook_payload')
      continue
    }

    const delivery = await deliverWebhook(row.org_id, row.branch_id, row.event_type, payload)

    if (delivery.status === 'delivered') {
      result.delivered += 1
      await markCompleted(row.id, null)
      continue
    }

    if (delivery.status === 'skipped') {
      result.skipped += 1
      await markCompleted(row.id, delivery.reason)
      continue
    }

    result.failed += 1
    await markFailed(row.id, attemptCount, delivery.error)
  }

  return result
}
