/**
 * lib/api/webhook.ts
 *
 * Utilitas pengiriman webhook dari Nizam ke URL eksternal.
 *
 * Setiap event (cash_in, cash_out, sale, purchase) akan memicu
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

export type WebhookEventType = 'cash_in' | 'cash_out' | 'sale' | 'purchase'

export type WebhookPayload = {
  event: WebhookEventType
  org_id: string
  branch_id?: string | null
  timestamp: string
  data: Record<string, unknown>
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
): Promise<void> {
  let admin: Awaited<ReturnType<typeof createAdminClient>>
  try {
    admin = await createAdminClient()
  } catch {
    return
  }

  // Fetch api_configuration for this org/branch
  const { data: config } = await (admin as any)
    .from('api_configurations')
    .select('id, webhook_url, webhook_secret, webhook_events, webhook_is_active')
    .eq('org_id', orgId)
    .eq('webhook_is_active', true)
    .or(`branch_id.eq.${branchId ?? 'null'},branch_id.is.null`)
    .order('branch_id', { ascending: false }) // prefer branch-specific config
    .limit(1)
    .maybeSingle()

  if (!config?.webhook_url || !config?.webhook_is_active) return

  const webhookEvents: string[] = Array.isArray(config.webhook_events) ? config.webhook_events : []
  if (webhookEvents.length > 0 && !webhookEvents.includes(event)) return

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
  const { data: deliveryLog } = await (admin as any)
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
      await (admin as any)
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
  } catch (err: unknown) {
    if (deliveryId) {
      const errMsg = err instanceof Error ? err.message : 'Network error'
      await (admin as any)
        .from('api_webhook_deliveries')
        .update({
          status: 'failed',
          response_body: errMsg.slice(0, 500),
          attempt_count: 1,
        })
        .eq('id', deliveryId)
    }
  }
}
