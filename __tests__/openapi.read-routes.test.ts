import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  validateApiKey: vi.fn(),
  requireScope: vi.fn(),
  logApiCall: vi.fn(),
  extractIpFromRequest: vi.fn(),
  queryPostgres: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/api/validate-key', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/validate-key')>('@/lib/api/validate-key')
  return {
    ...actual,
    validateApiKey: mocks.validateApiKey,
    requireScope: mocks.requireScope,
    logApiCall: mocks.logApiCall,
    extractIpFromRequest: mocks.extractIpFromRequest,
  }
})

vi.mock('@/lib/db/postgres', () => ({
  queryPostgres: mocks.queryPostgres,
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: mocks.createAdminClient,
}))

import { GET as getInventory } from '@/app/api/v1/inventory/route'
import { GET as getContacts } from '@/app/api/v1/contacts/route'
import { GET as getSales } from '@/app/api/v1/sales/route'

describe('Open API read routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.validateApiKey.mockResolvedValue({
      success: true,
      key: {
        keyId: 'key-1',
        orgId: '11111111-1111-4111-8111-111111111111',
        branchId: '22222222-2222-4222-8222-222222222222',
        scopes: ['inventory:read', 'contacts:read', 'sales:read'],
        rateLimitRpm: 60,
      },
    })
    mocks.requireScope.mockReturnValue(true)
    mocks.logApiCall.mockResolvedValue(undefined)
    mocks.extractIpFromRequest.mockReturnValue('198.51.100.15')
  })

  it('requires an API key for inventory reads', async () => {
    const response = await getInventory(new NextRequest('http://localhost/api/v1/inventory'))

    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'API key diperlukan. Sertakan header x-api-key.',
        error_code: 'api_key_missing',
        request_id: expect.any(String),
      })
    )
    expect(mocks.validateApiKey).not.toHaveBeenCalled()
  })

  it('returns normalized inventory rows and logs the request', async () => {
    mocks.queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          id: 'product-1',
          code: 'BMS3',
          name: 'BUKU MATEMATIKA',
          unit: null,
          category: 'Books',
          selling_price: '13333.33',
          cost_price: '9600',
          stock_quantity: '7',
          is_active: true,
        },
      ],
    })

    const response = await getInventory(new NextRequest('http://localhost/api/v1/inventory?limit=20&search=buku', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'product-1',
          code: 'BMS3',
          name: 'BUKU MATEMATIKA',
          unit: '',
          category: 'Books',
          selling_price: 13333.33,
          cost_price: 9600,
          stock_quantity: 7,
          branch_id: '22222222-2222-4222-8222-222222222222',
          is_active: true,
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        branch_scope: '22222222-2222-4222-8222-222222222222',
        count: 1,
      },
    })
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/inventory',
        statusCode: 200,
        ipAddress: '198.51.100.15',
      })
    )
  })

  it('filters contacts by type and search and keeps responses uncacheable', async () => {
    const supabase = createSupabaseMock({
      tables: {
        contacts: [{
          result: success([
            {
              id: 'contact-1',
              name: 'Andi Supplier',
              email: 'andi@example.com',
              phone: '08123',
              type: 'supplier',
              company: 'PT Supplier',
              is_active: true,
              created_at: '2026-04-18T00:00:00.000Z',
            },
          ]),
        }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const response = await getContacts(new NextRequest('http://localhost/api/v1/contacts?type=supplier&search=andi', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'contact-1',
          name: 'Andi Supplier',
          email: 'andi@example.com',
          phone: '08123',
          type: 'supplier',
          company: 'PT Supplier',
          is_active: true,
          created_at: '2026-04-18T00:00:00.000Z',
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        count: 1,
      },
    })

    const contactCall = supabase.calls.find((call) => call.table === 'contacts')
    expect(contactCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', '11111111-1111-4111-8111-111111111111'] }),
        expect.objectContaining({ method: 'eq', args: ['type', 'supplier'] }),
        expect.objectContaining({ method: 'ilike', args: ['name', '%andi%'] }),
      ])
    )
  })

  it('reads sales from the actual sales schema and normalizes the response', async () => {
    mocks.queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          id: 'sale-1',
          sale_number: 'SO-2026-000001',
          customer_name: 'CV Maju',
          total_amount: '250000',
          status: 'ORDERED',
          branch_id: '22222222-2222-4222-8222-222222222222',
          order_date: '2026-04-18',
          created_at: '2026-04-18T00:00:00.000Z',
        },
      ],
    })

    const response = await getSales(new NextRequest('http://localhost/api/v1/sales?status=ORDERED&limit=10', {
      headers: {
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: 'sale-1',
          so_number: 'SO-2026-000001',
          customer_name: 'CV Maju',
          total_amount: 250000,
          status: 'ORDERED',
          branch_id: '22222222-2222-4222-8222-222222222222',
          order_date: '2026-04-18',
          created_at: '2026-04-18T00:00:00.000Z',
        },
      ],
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        branch_scope: '22222222-2222-4222-8222-222222222222',
        count: 1,
      },
    })
    expect(String(mocks.queryPostgres.mock.calls[0]?.[0])).toContain('FROM public.sales')
  })

  it('blocks sales reads when the key scope is missing', async () => {
    mocks.requireScope.mockReturnValue(false)

    const response = await getSales(new NextRequest('http://localhost/api/v1/sales', {
      headers: { 'x-api-key': 'nzm_live_test' },
    }))

    expect(response.status).toBe(403)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'Scope tidak mencukupi. Diperlukan: sales:read',
        error_code: 'scope_missing',
        request_id: expect.any(String),
      })
    )
  })
})
