/**
 * app/api/internal/open-api/process-webhook-outbox/route.ts
 *
 * Route internal untuk memproses outbox webhook inventory. Dipanggil
 * oleh worker lokal dari runtime Next standalone, bukan untuk publik.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { type NextRequest } from 'next/server'
import { processInventoryWebhookOutboxBatch } from '@/lib/api/inventory-webhook-outbox'

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

function normalizeLimit(rawValue: string | null) {
  const parsed = Number.parseInt(rawValue ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 25
  return Math.min(parsed, 100)
}

function isAuthorized(request: NextRequest) {
  const token = String(process.env.INTERNAL_WEBHOOK_WORKER_TOKEN ?? '').trim()
  if (!token) return false
  return request.headers.get('x-internal-worker-token') === token
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return json({
      success: false,
      error: 'Unauthorized',
    }, 401)
  }

  const { searchParams } = new URL(request.url)
  const limit = normalizeLimit(searchParams.get('limit'))
  const result = await processInventoryWebhookOutboxBatch(limit)

  return json({
    success: true,
    ...result,
  })
}
