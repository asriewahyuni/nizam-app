/**
 * lib/api/webhook.ts
 *
 * Utilitas pengiriman webhook dari Nizam ke URL eksternal.
 *
 * Setiap event (cash_in, cash_out, sale, purchase, inventory_movement) akan memicu
 * HTTP POST ke webhook_url yang dikonfigurasi di api_configurations.
 *
 * Payload disertai HMAC-SHA256 signature menggunakan webhook_secret
 * agar pengirim bisa diverifikasi di sisi penerima.
 *
 * Header yang dikirim:
 *   X-Nizam-Webhook-Event: cash_in
 *   X-Nizam-Webhook-Signature: sha256=<hex>
 *   X-Nizam-Webhook-Timestamp: <unix-ms>
 *   Content-Type: application/json
 */

import { createAdminClient } from '@/lib/supabase/server'
import { INVENTORY_WEBHOOK_DIRECTIONS, type InventoryWebhookDirection, type WebhookEventType } from '@/lib/api/webhook-events'

export type WebhookPayload = {
  event: WebhookEventType
  org_id: string
  branch_id?: string | null
  timestamp: string
  data: Record<string, unknown>
}

type QueryError = { message?: string | null } | null

type MaybeSingleResult<T> = Promise<{ data: T | null; error: QueryError }>
type MutationResult = PromiseLike<{ error: QueryError }>

type ApiWebhookConfigurationRecord = {
  id: string
  webhook_url: string | null
  webhook_secret: string | null
  webhook_events: unknown
  webhook_is_active: boolean
  webhook_inventory_directions: unknown
  webhook_inventory_reference_types: unknown
}

type WebhookDeliveryRecord = {
  id: string
}

type WebhookConfigQueryBuilder = {
  eq(column: string, value: unknown): WebhookConfigQueryBuilder
  or(filter: string): WebhookConfigQueryBuilder
  order(column: string, options: { ascending: boolean }): WebhookConfigQueryBuilder
  limit(value: number): WebhookConfigQueryBuilder
  maybeSingle(): MaybeSingleResult<ApiWebhookConfigurationRecord>
}

type WebhookDeliveryInsertBuilder = {
  select(columns: string): {
    maybeSingle(): MaybeSingleResult<WebhookDeliveryRecord>
  }
}

type WebhookDeliveryUpdateBuilder = MutationResult & {
  eq(column: string, value: unknown): WebhookDeliveryUpdateBuilder
}

type WebhookAdminClient = {
  from(table: 'api_configurations'): {
    select(columns: string): WebhookConfigQueryBuilder
  }
  from(table: 'api_webhook_deliveries'): {
    insert(values: Record<string, unknown>): WebhookDeliveryInsertBuilder
    update(values: Record<string, unknown>): WebhookDeliveryUpdateBuilder
  }
}

export type DeliverWebhookResult =
  | { status: 'delivered'; deliveryId?: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string; deliveryId?: string }

function normalizeStringArray(values: unknown) {
  if (!Array.isArray(values)) return []

  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
    )
  )
}

function normalizeReferenceTypes(values: unknown) {
  return normalizeStringArray(values).map((value) => value.toUpperCase())
}

function resolveInventoryDirection(data: Record<string, unknown>): InventoryWebhookDirection | null {
  const rawDirection = String(data.direction ?? '').trim().toLowerCase()
  if ((INVENTORY_WEBHOOK_DIRECTIONS as readonly string[]).includes(rawDirection)) {
    return rawDirection as InventoryWebhookDirection
  }

  const quantity = Number(data.quantity ?? NaN)
  if (!Number.isFinite(quantity) || quantity === 0) return null
  return quantity > 0 ? 'in' : 'out'
}

function resolveInventoryReferenceType(data: Record<string, unknown>) {
  const referenceType = String(data.reference_type ?? '').trim().toUpperCase()
  return referenceType || null
}

function shouldDeliverInventoryWebhook(
  config: ApiWebhookConfigurationRecord,
  data: Record<string, unknown>
): DeliverWebhookResult | null {
  const allowedDirections = normalizeStringArray(config.webhook_inventory_directions)
  const allowedReferenceTypes = normalizeReferenceTypes(config.webhook_inventory_reference_types)
  const direction = resolveInventoryDirection(data)
  const referenceType = resolveInventoryReferenceType(data)

  if (allowedDirections.length > 0 && (!direction || !allowedDirections.includes(direction))) {
    return { status: 'skipped', reason: 'inventory_direction_filtered' }
  }

  if (allowedReferenceTypes.length > 0 && (!referenceType || !allowedReferenceTypes.includes(referenceType))) {
    return { status: 'skipped', reason: 'inventory_reference_type_filtered' }
  }

  return null
}

/**
 * Compute HMAC-SHA256 signature.
 * Returns "sha256=<hex>"
 */
async function computeHmacSignature(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(body)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha256=${hex}`
}

/**
 * Deliver a webhook event to configured URL.
 * Logs delivery status to api_webhook_deliveries table.
 *
 * @param orgId - Organization ID
 * @param branchId - Branch ID (nullable)
 * @param event - Event type
 * @param data - Payload data
 */
export async function deliverWebhook(
  orgId: string,
  branchId: string | null,
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<DeliverWebhookResult> {
  let admin: WebhookAdminClient
  try {
    admin = await createAdminClient() as unknown as WebhookAdminClient
  } catch {
    return { status: 'failed', error: 'admin_client_unavailable' }
  }

  // Fetch api_configuration for this org/branch
  const { data: config } = await admin
    .from('api_configurations')
    .select('id, webhook_url, webhook_secret, webhook_events, webhook_is_active, webhook_inventory_directions, webhook_inventory_reference_types')
    .eq('org_id', orgId)
    .eq('webhook_is_active', true)
    .or(`branch_id.eq.${branchId ?? 'null'},branch_id.is.null`)
    .order('branch_id', { ascending: false }) // prefer branch-specific config
    .limit(1)
    .maybeSingle()

  if (!config?.webhook_url || !config?.webhook_is_active) {
    return { status: 'skipped', reason: 'webhook_config_inactive' }
  }

  const webhookEvents = normalizeStringArray(config.webhook_events)
  if (webhookEvents.length > 0 && !webhookEvents.includes(event)) {
    return { status: 'skipped', reason: 'webhook_event_not_subscribed' }
  }

  if (event === 'inventory_movement') {
    const filterResult = shouldDeliverInventoryWebhook(config, data)
    if (filterResult) return filterResult
  }

  const timestamp = Date.now().toString()
  const payload: WebhookPayload = {
    event,
    org_id: orgId,
    branch_id: branchId,
    timestamp: new Date().toISOString(),
    data,
  }
  const bodyStr = JSON.stringify(payload)

  let signature = ''
  if (config.webhook_secret) {
    signature = await computeHmacSignature(config.webhook_secret, bodyStr)
  }

  // Create delivery log record first
  const { data: deliveryLog } = await admin
    .from('api_webhook_deliveries')
    .insert({
      org_id: orgId,
      config_id: config.id,
      event_type: event,
      payload,
      target_url: config.webhook_url,
      status: 'pending',
    })
    .select('id')
    .maybeSingle()

  const deliveryId = deliveryLog?.id

  // Attempt delivery (fire-and-forget but log result)
  try {
    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Nizam-Webhook-Event': event,
        'X-Nizam-Webhook-Signature': signature,
        'X-Nizam-Webhook-Timestamp': timestamp,
        'User-Agent': 'Nizam-Webhook/1.0',
      },
      body: bodyStr,
      // 10 second timeout
      signal: AbortSignal.timeout(10_000),
    })

    const responseBody = await response.text().catch(() => '')

    if (deliveryId) {
      await admin
        .from('api_webhook_deliveries')
        .update({
          status: response.ok ? 'delivered' : 'failed',
          http_status: response.status,
          response_body: responseBody.slice(0, 1000),
          attempt_count: 1,
          delivered_at: response.ok ? new Date().toISOString() : null,
        })
        .eq('id', deliveryId)
    }

    if (!response.ok) {
      return {
        status: 'failed',
        error: `webhook_http_${response.status}`,
        deliveryId,
      }
    }

    return { status: 'delivered', deliveryId }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Network error'
    if (deliveryId) {
      await admin
        .from('api_webhook_deliveries')
        .update({
          status: 'failed',
          response_body: errMsg.slice(0, 500),
          attempt_count: 1,
        })
        .eq('id', deliveryId)
    }

    return {
      status: 'failed',
      error: errMsg,
      deliveryId,
    }
  }
}
