import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryPostgres: vi.fn(),
  connectPostgresClient: vi.fn(),
  getInternalAuthSession: vi.fn(),
}))

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
  connectPostgresClient: mocks.connectPostgresClient,
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
    mocks.connectPostgresClient.mockResolvedValue({
      query: clientQuery,
      release,
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
    expect(mocks.connectPostgresClient).not.toHaveBeenCalled()
    expect(result).toEqual({ data: true, error: null })
  })

  it('preserves primitive arrays for PostgreSQL array params and JSON-encodes structured arrays', async () => {
    mocks.getInternalAuthSession.mockResolvedValue(null)
    mocks.queryPostgres.mockResolvedValue({
      rows: [],
    })

    const pItems = [
      { product_id: 'prod-1', quantity: 2 },
      { product_id: 'prod-2', quantity: 1 },
    ]

    const db = createPostgresNativeClient()
    const result = await db.rpc('mixed_array_rpc', {
      p_account_ids: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
      p_items: pItems,
      p_effective_dates: ['2026-04-01', '2026-04-02'],
    })

    expect(mocks.queryPostgres).toHaveBeenCalledWith(
      'SELECT * FROM public."mixed_array_rpc"(p_account_ids => $1, p_items => $2, p_effective_dates => $3)',
      [
        [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
        JSON.stringify(pItems),
        ['2026-04-01', '2026-04-02'],
      ]
    )
    expect(result).toEqual({ data: [], error: null })
  })

  it('keeps child foreign keys available for nested backref relations', async () => {
    mocks.getInternalAuthSession.mockResolvedValue(null)
    mocks.queryPostgres.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM information_schema.table_constraints')) {
        return {
          rows: [
            { table_name: 'production_bom_items', column_name: 'bom_id', ref_table: 'production_boms' },
            { table_name: 'production_bom_items', column_name: 'product_id', ref_table: 'products' },
          ],
        }
      }

      if (sql.includes('FROM public."production_boms"')) {
        return {
          rows: [{ id: 'bom-1', code: 'BOM-001' }],
        }
      }

      if (sql.includes('FROM public."production_bom_items"')) {
        return {
          rows: [
            sql.includes('product_id')
              ? { id: 'item-1', bom_id: 'bom-1', product_id: 'prod-1', quantity: 1, unit: 'Kg' }
              : { id: 'item-1', bom_id: 'bom-1', quantity: 1, unit: 'Kg' },
          ],
        }
      }

      if (sql.includes('FROM public."products"')) {
        return {
          rows: [{ id: 'prod-1', name: 'Beras' }],
        }
      }

      return { rows: [] }
    })

    const db = createPostgresNativeClient()
    const result = await db
      .from('production_boms')
      .select('id, code, items:production_bom_items(id, quantity, unit, product:products(id, name))')
    expect(result).toEqual({
      data: [
        {
          id: 'bom-1',
          code: 'BOM-001',
          items: [
            {
              id: 'item-1',
              bom_id: 'bom-1',
              product_id: 'prod-1',
              quantity: 1,
              unit: 'Kg',
              product: { id: 'prod-1', name: 'Beras' },
            },
          ],
        },
      ],
      error: null,
    })
  })
})
