import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryPostgres: vi.fn(),
  getPostgresPool: vi.fn(),
  getInternalAuthSession: vi.fn(),
}))

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
  getPostgresPool: mocks.getPostgresPool,
}))

vi.mock('@/lib/auth/internal-auth.server', () => ({
  getInternalAuthSession: mocks.getInternalAuthSession,
}))

import { createPostgresNativeClient } from '@/lib/db/postgres-client'

describe('postgres native rpc auth claims', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets request jwt claims on the same connection before executing RPC', async () => {
    const release = vi.fn()
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ process_sales_delivery_atomic: null }] })
      .mockResolvedValueOnce({ rows: [] })

    mocks.getInternalAuthSession.mockResolvedValue({
      sessionId: 'session-1',
      user: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        email: 'kasir@example.com',
        user_metadata: {},
        app_metadata: {},
      },
    })
    mocks.getPostgresPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({
        query: clientQuery,
        release,
      }),
    })

    const db = createPostgresNativeClient()
    const result = await db.rpc('process_sales_delivery_atomic', {
      p_org_id: '11111111-1111-4111-8111-111111111111',
      p_sale_id: '22222222-2222-4222-8222-222222222222',
      p_warehouse_id: '33333333-3333-4333-8333-333333333333',
    })

    expect(clientQuery).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(clientQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("set_config('request.jwt.claim.sub'"),
      [
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'authenticated',
        JSON.stringify({
          sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          role: 'authenticated',
          email: 'kasir@example.com',
        }),
      ]
    )
    expect(clientQuery).toHaveBeenNthCalledWith(
      3,
      'SELECT * FROM public."process_sales_delivery_atomic"(p_org_id => $1, p_sale_id => $2, p_warehouse_id => $3)',
      [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
      ]
    )
    expect(clientQuery).toHaveBeenNthCalledWith(4, 'COMMIT')
    expect(release).toHaveBeenCalledTimes(1)
    expect(mocks.queryPostgres).not.toHaveBeenCalled()
    expect(result).toEqual({ data: null, error: null })
  })

  it('falls back to direct query execution when there is no internal auth session', async () => {
    mocks.getInternalAuthSession.mockResolvedValue(null)
    mocks.queryPostgres.mockResolvedValue({
      rows: [{ nizam_has_permission: true }],
    })

    const db = createPostgresNativeClient()
    const result = await db.rpc('nizam_has_permission', {
      p_permission: 'pos:write',
      p_org_id: '11111111-1111-4111-8111-111111111111',
    })

    expect(mocks.queryPostgres).toHaveBeenCalledWith(
      'SELECT * FROM public."nizam_has_permission"(p_permission => $1, p_org_id => $2)',
      ['pos:write', '11111111-1111-4111-8111-111111111111']
    )
    expect(mocks.getPostgresPool).not.toHaveBeenCalled()
    expect(result).toEqual({ data: true, error: null })
  })
})
