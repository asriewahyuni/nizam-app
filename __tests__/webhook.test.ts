import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: mocks.createAdminClient,
}))

import { deliverWebhook } from '@/lib/api/webhook'

describe('Open API webhook delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips delivery when there is no active webhook config', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_configurations: [{ maybeSingleResult: success(null) }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await deliverWebhook('org-1', 'branch-1', 'cash_in', { amount: 1000 })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(supabase.calls.find((call) => call.table === 'api_webhook_deliveries')).toBeUndefined()
  })

  it('skips events that are not subscribed by the webhook config', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_configurations: [{
          maybeSingleResult: success({
            id: 'cfg-1',
            webhook_url: 'https://example.com/webhook',
            webhook_secret: 'top-secret',
            webhook_events: ['cash_out'],
            webhook_is_active: true,
          }),
        }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await deliverWebhook('org-1', 'branch-1', 'cash_in', { amount: 1000 })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('delivers signed webhook payloads and records successful delivery metadata', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_configurations: [{
          maybeSingleResult: success({
            id: 'cfg-1',
            webhook_url: 'https://example.com/webhook',
            webhook_secret: 'top-secret',
            webhook_events: ['cash_in'],
            webhook_is_active: true,
          }),
        }],
        api_webhook_deliveries: [
          { maybeSingleResult: success({ id: 'delivery-1' }) },
          { result: success([]) },
        ],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('ok'),
    })
    vi.stubGlobal('fetch', fetchMock)

    await deliverWebhook('org-1', 'branch-1', 'cash_in', { amount: 150000 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [targetUrl, options] = fetchMock.mock.calls[0]
    expect(targetUrl).toBe('https://example.com/webhook')
    expect(options?.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Nizam-Webhook-Event': 'cash_in',
        'User-Agent': 'Nizam-Webhook/1.0',
      })
    )
    expect(String((options?.headers as Record<string, string>)['X-Nizam-Webhook-Signature'])).toMatch(/^sha256=/)

    const insertCall = supabase.calls.find(
      (call) => call.table === 'api_webhook_deliveries' && call.operations.some((op) => op.method === 'insert')
    )
    const updateCall = supabase.calls.find(
      (call) => call.table === 'api_webhook_deliveries' && call.operations.some((op) => op.method === 'update')
    )

    expect(insertCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'insert',
          args: [
            expect.objectContaining({
              org_id: 'org-1',
              config_id: 'cfg-1',
              event_type: 'cash_in',
              target_url: 'https://example.com/webhook',
              status: 'pending',
            }),
          ],
        }),
      ])
    )
    expect(updateCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'update',
          args: [
            expect.objectContaining({
              status: 'delivered',
              http_status: 200,
              attempt_count: 1,
            }),
          ],
        }),
      ])
    )
  })

  it('records failed deliveries when the network request throws', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_configurations: [{
          maybeSingleResult: success({
            id: 'cfg-1',
            webhook_url: 'https://example.com/webhook',
            webhook_secret: null,
            webhook_events: ['purchase'],
            webhook_is_active: true,
          }),
        }],
        api_webhook_deliveries: [
          { maybeSingleResult: success({ id: 'delivery-2' }) },
          { result: success([]) },
        ],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))

    await deliverWebhook('org-1', null, 'purchase', { purchase_id: 'po-1' })

    const updateCall = supabase.calls.find(
      (call) => call.table === 'api_webhook_deliveries' && call.operations.some((op) => op.method === 'update')
    )

    expect(updateCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'update',
          args: [
            expect.objectContaining({
              status: 'failed',
              attempt_count: 1,
              response_body: 'timeout',
            }),
          ],
        }),
      ])
    )
  })
})
