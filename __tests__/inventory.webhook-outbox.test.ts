import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  queryPostgres: vi.fn(),
  deliverWebhook: vi.fn(),
}))

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
}))

vi.mock('@/lib/api/webhook', () => ({
  deliverWebhook: mocks.deliverWebhook,
}))

import { processInventoryWebhookOutboxBatch } from '@/lib/api/inventory-webhook-outbox'
import { POST } from '@/app/api/internal/open-api/process-webhook-outbox/route'

describe('Inventory webhook outbox worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.INTERNAL_WEBHOOK_WORKER_TOKEN
  })

  it('claims outbox rows and marks successful plus failed deliveries correctly', async () => {
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'outbox-1',
            org_id: 'org-1',
            branch_id: 'branch-1',
            event_type: 'inventory_movement',
            source_id: 'move-1',
            payload: {
              movement_id: 'move-1',
              quantity: 5,
              direction: 'in',
              reference_type: 'PURCHASE',
            },
            attempt_count: 1,
          },
          {
            id: 'outbox-2',
            org_id: 'org-1',
            branch_id: 'branch-1',
            event_type: 'inventory_movement',
            source_id: 'move-2',
            payload: {
              movement_id: 'move-2',
              quantity: -2,
              direction: 'out',
              reference_type: 'SALE',
            },
            attempt_count: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    mocks.deliverWebhook
      .mockResolvedValueOnce({ status: 'delivered', deliveryId: 'delivery-1' })
      .mockResolvedValueOnce({ status: 'failed', error: 'timeout' })

    const result = await processInventoryWebhookOutboxBatch(10, 'worker-1')

    expect(result).toEqual({
      claimed: 2,
      delivered: 1,
      skipped: 0,
      failed: 1,
    })
    expect(mocks.deliverWebhook).toHaveBeenNthCalledWith(
      1,
      'org-1',
      'branch-1',
      'inventory_movement',
      expect.objectContaining({
        movement_id: 'move-1',
        direction: 'in',
      })
    )
    expect(mocks.queryPostgres.mock.calls[2]?.[1]).toEqual([
      'outbox-2',
      'pending',
      30,
      'timeout',
    ])
  })

  it('protects the internal processing route with a shared secret', async () => {
    process.env.INTERNAL_WEBHOOK_WORKER_TOKEN = 'worker-secret'

    const unauthorized = await POST(new NextRequest('http://localhost/api/internal/open-api/process-webhook-outbox', {
      method: 'POST',
    }))

    expect(unauthorized.status).toBe(401)
    await expect(unauthorized.json()).resolves.toEqual({
      success: false,
      error: 'Unauthorized',
    })
  })

  it('processes the outbox through the internal route when authorized', async () => {
    process.env.INTERNAL_WEBHOOK_WORKER_TOKEN = 'worker-secret'
    mocks.queryPostgres.mockResolvedValueOnce({ rows: [] })

    const response = await POST(new NextRequest('http://localhost/api/internal/open-api/process-webhook-outbox?limit=15', {
      method: 'POST',
      headers: {
        'x-internal-worker-token': 'worker-secret',
      },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      claimed: 0,
      delivered: 0,
      skipped: 0,
      failed: 0,
    })
    expect(String(mocks.queryPostgres.mock.calls[0]?.[0])).toContain('FROM public.api_webhook_outbox')
  })
})
