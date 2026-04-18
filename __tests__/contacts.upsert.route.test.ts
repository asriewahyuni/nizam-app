import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  validateApiKey: vi.fn(),
  requireScope: vi.fn(),
  logApiCall: vi.fn(),
  extractIpFromRequest: vi.fn(),
  queryPostgres: vi.fn(),
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

import { POST } from '@/app/api/v1/contacts/upsert/route'

describe('Open API contacts upsert route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.validateApiKey.mockResolvedValue({
      success: true,
      key: {
        keyId: 'key-1',
        orgId: '11111111-1111-4111-8111-111111111111',
        branchId: null,
        scopes: ['contacts:write'],
        rateLimitRpm: 60,
      },
    })
    mocks.requireScope.mockReturnValue(true)
    mocks.logApiCall.mockResolvedValue(undefined)
    mocks.extractIpFromRequest.mockReturnValue('198.51.100.15')
  })

  it('creates a new contact when no match exists', async () => {
    mocks.queryPostgres
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'contact-1',
            name: 'Andi Supplier',
            email: 'andi@example.com',
            phone: '08123',
            phone_wa: '628123',
            instagram: '@andisupplier',
            address: 'Jl. Supplier No. 1',
            type: 'SUPPLIER',
            is_active: true,
            created_at: '2026-04-18T00:00:00.000Z',
            updated_at: '2026-04-18T00:00:00.000Z',
          },
        ],
      })

    const response = await POST(new NextRequest('http://localhost/api/v1/contacts/upsert', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'nzm_live_test',
        'user-agent': 'Vitest',
      },
      body: JSON.stringify({
        name: 'Andi Supplier',
        type: 'SUPPLIER',
        email: 'andi@example.com',
        phone: '08123',
        phone_wa: '628123',
        instagram: '@andisupplier',
        address: 'Jl. Supplier No. 1',
      }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: 'contact-1',
        name: 'Andi Supplier',
        email: 'andi@example.com',
        phone: '08123',
        phone_wa: '628123',
        instagram: '@andisupplier',
        address: 'Jl. Supplier No. 1',
        type: 'SUPPLIER',
        is_active: true,
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-18T00:00:00.000Z',
      },
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        action: 'created',
        matched_by: 'insert',
      },
    })
    expect(String(mocks.queryPostgres.mock.calls[1]?.[0])).toContain('INSERT INTO public.contacts')
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/contacts/upsert',
        method: 'POST',
        statusCode: 200,
      })
    )
  })

  it('updates an existing contact matched by email', async () => {
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'contact-1',
            name: 'Andi Supplier',
            type: 'SUPPLIER',
            email: 'andi@example.com',
            phone: '08123',
            phone_wa: '628123',
            instagram: '@andisupplier',
            address: 'Jl. Supplier No. 1',
            is_active: true,
            created_at: '2026-04-18T00:00:00.000Z',
            updated_at: '2026-04-18T00:00:00.000Z',
            matched_by: 'email',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'contact-1',
            name: 'Andi Supplier Update',
            email: 'andi@example.com',
            phone: '08123',
            phone_wa: '628123',
            instagram: '@andisupplier',
            address: 'Jl. Supplier No. 2',
            type: 'SUPPLIER',
            is_active: true,
            created_at: '2026-04-18T00:00:00.000Z',
            updated_at: '2026-04-18T01:00:00.000Z',
          },
        ],
      })

    const response = await POST(new NextRequest('http://localhost/api/v1/contacts/upsert', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'nzm_live_test',
      },
      body: JSON.stringify({
        name: 'Andi Supplier Update',
        type: 'SUPPLIER',
        email: 'andi@example.com',
        address: 'Jl. Supplier No. 2',
      }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: 'contact-1',
        name: 'Andi Supplier Update',
        email: 'andi@example.com',
        phone: '08123',
        phone_wa: '628123',
        instagram: '@andisupplier',
        address: 'Jl. Supplier No. 2',
        type: 'SUPPLIER',
        is_active: true,
        created_at: '2026-04-18T00:00:00.000Z',
        updated_at: '2026-04-18T01:00:00.000Z',
      },
      meta: {
        org_id: '11111111-1111-4111-8111-111111111111',
        action: 'updated',
        matched_by: 'email',
      },
    })
    expect(String(mocks.queryPostgres.mock.calls[1]?.[0])).toContain('UPDATE public.contacts')
  })

  it('rejects invalid contact types', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/contacts/upsert', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'nzm_live_test',
      },
      body: JSON.stringify({
        name: 'Andi',
        type: 'partner',
      }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'Field "type" harus berisi CUSTOMER atau SUPPLIER.',
        error_code: 'contact_type_invalid',
      })
    )
    expect(mocks.queryPostgres).not.toHaveBeenCalled()
  })

  it('blocks contact upsert when the key scope is missing', async () => {
    mocks.requireScope.mockReturnValue(false)

    const response = await POST(new NextRequest('http://localhost/api/v1/contacts/upsert', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'nzm_live_test',
      },
      body: JSON.stringify({
        name: 'Andi',
        type: 'SUPPLIER',
      }),
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'Scope tidak mencukupi. Diperlukan: contacts:write',
        error_code: 'scope_missing',
      })
    )
  })
})
