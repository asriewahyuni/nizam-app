import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const BRANCH_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_BRANCH_ID = '33333333-3333-4333-8333-333333333333'
const BANK_ACCOUNT_ID = '44444444-4444-4444-8444-444444444444'
const CASH_ACCOUNT_ID = '55555555-5555-4555-8555-555555555555'
const COUNTER_ACCOUNT_ID = '66666666-6666-4666-8666-666666666666'

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
    .join(',')}}`
}

function buildRequestHash(value: Record<string, unknown>) {
  return createHash('sha256').update(stableSerialize(value)).digest('hex')
}

const mocks = vi.hoisted(() => ({
  validateApiKey: vi.fn(),
  requireScope: vi.fn(),
  logApiCall: vi.fn(),
  extractIpFromRequest: vi.fn(),
  queryPostgres: vi.fn(),
  getPostgresPool: vi.fn(),
  deliverWebhook: vi.fn(),
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
  getPostgresPool: mocks.getPostgresPool,
}))

vi.mock('@/lib/api/webhook', () => ({
  deliverWebhook: mocks.deliverWebhook,
}))

import { GET, POST } from '@/app/api/v1/cash/route'

describe('Open API cash route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.validateApiKey.mockResolvedValue({
      success: true,
      key: {
        keyId: 'key-1',
        orgId: ORG_ID,
        branchId: BRANCH_ID,
        scopes: ['cash:read', 'cash:write'],
        rateLimitRpm: 60,
      },
    })
    mocks.requireScope.mockReturnValue(true)
    mocks.logApiCall.mockResolvedValue(undefined)
    mocks.extractIpFromRequest.mockReturnValue('198.51.100.9')
    mocks.getPostgresPool.mockReturnValue({
      connect: vi.fn(),
    })
    mocks.deliverWebhook.mockResolvedValue(undefined)
  })

  it('requires an API key for cash reads', async () => {
    const response = await GET(new NextRequest('http://localhost/api/v1/cash'))

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
  })

  it('returns cash and bank accounts with normalized balances', async () => {
    mocks.queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          id: BANK_ACCOUNT_ID,
          bank_account_id: BANK_ACCOUNT_ID,
          source: 'bank_account',
          name: 'Bank Operasional',
          account_number: '12345',
          bank_name: 'BCA',
          balance: '1500000',
          currency: 'IDR',
          branch_id: BRANCH_ID,
          is_active: true,
          account_id: CASH_ACCOUNT_ID,
          account_code: '1101',
          account_name: 'Bank Operasional',
        },
        {
          id: CASH_ACCOUNT_ID,
          bank_account_id: null,
          source: 'gl_account',
          name: 'Kas Kecil',
          account_number: null,
          bank_name: 'Kas Kecil',
          balance: '250000',
          currency: 'IDR',
          branch_id: BRANCH_ID,
          is_active: true,
          account_id: CASH_ACCOUNT_ID,
          account_code: '1102',
          account_name: 'Kas Kecil',
        },
      ],
    })

    const response = await GET(new NextRequest('http://localhost/api/v1/cash', {
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
          id: BANK_ACCOUNT_ID,
          bank_account_id: BANK_ACCOUNT_ID,
          source: 'bank_account',
          name: 'Bank Operasional',
          account_number: '12345',
          bank_name: 'BCA',
          balance: 1500000,
          currency: 'IDR',
          branch_id: BRANCH_ID,
          is_active: true,
          account_id: CASH_ACCOUNT_ID,
          account_code: '1101',
          account_name: 'Bank Operasional',
        },
        {
          id: CASH_ACCOUNT_ID,
          bank_account_id: null,
          source: 'gl_account',
          name: 'Kas Kecil',
          account_number: null,
          bank_name: 'Kas Kecil',
          balance: 250000,
          currency: 'IDR',
          branch_id: BRANCH_ID,
          is_active: true,
          account_id: CASH_ACCOUNT_ID,
          account_code: '1102',
          account_name: 'Kas Kecil',
        },
      ],
      meta: {
        org_id: ORG_ID,
        branch_scope: BRANCH_ID,
        count: 2,
      },
    })
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/cash',
        method: 'GET',
        statusCode: 200,
      })
    )
  })

  it('rejects writes that override a branch-scoped key', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/cash', {
      method: 'POST',
      headers: {
        'x-api-key': 'nzm_live_test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'in',
        amount: 100000,
        description: 'Test',
        branch_id: OTHER_BRANCH_ID,
      }),
    }))

    expect(response.status).toBe(400)
    expect(mocks.queryPostgres).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'API key ini dibatasi ke cabang tertentu. branch_id pada body tidak boleh berbeda.',
        error_code: 'branch_scope_mismatch',
      })
    )
  })

  it('returns a configuration error when no counter account is available', async () => {
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [{
          id: 'cfg-1',
          branch_id: BRANCH_ID,
          cash_in_account_id: null,
          cash_out_account_id: null,
          cash_in_params: {},
          cash_out_params: {},
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: BANK_ACCOUNT_ID,
          branch_id: BRANCH_ID,
          account_id: CASH_ACCOUNT_ID,
          bank_name: 'Bank Operasional',
          account_number: '12345',
          currency: 'IDR',
          is_active: true,
        }],
      })

    const response = await POST(new NextRequest('http://localhost/api/v1/cash', {
      method: 'POST',
      headers: {
        'x-api-key': 'nzm_live_test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'in',
        amount: 100000,
        description: 'Setoran',
        branch_id: BRANCH_ID,
        bank_account_id: BANK_ACCOUNT_ID,
      }),
    }))

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'Akun lawan kas masuk belum dikonfigurasi. Kirim `category_id`/`counter_account_id` atau set `counter_account_id`/`revenue_account_id` di konfigurasi API.',
      })
    )
  })

  it('creates a simple cash-in transaction and dispatches the matching webhook', async () => {
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [{
          id: 'cfg-1',
          branch_id: BRANCH_ID,
          cash_in_account_id: null,
          cash_out_account_id: null,
          cash_in_params: { counter_account_id: COUNTER_ACCOUNT_ID, auto_post: true },
          cash_out_params: {},
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: BANK_ACCOUNT_ID,
          branch_id: BRANCH_ID,
          account_id: CASH_ACCOUNT_ID,
          bank_name: 'Bank Operasional',
          account_number: '12345',
          currency: 'IDR',
          is_active: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: COUNTER_ACCOUNT_ID }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: '77777777-7777-4777-8777-777777777777',
          reference_number: 'INV-2026-001',
          amount: '250000',
          description: 'Pelunasan invoice',
          status: 'POSTED',
          created_at: '2026-04-18T10:20:00.000Z',
          journal_entry_id: '88888888-8888-4888-8888-888888888888',
        }],
      })

    const response = await POST(new NextRequest('http://localhost/api/v1/cash', {
      method: 'POST',
      headers: {
        'x-api-key': 'nzm_live_test',
        'content-type': 'application/json',
        'user-agent': 'Vitest',
      },
      body: JSON.stringify({
        type: 'in',
        amount: 250000,
        description: 'Pelunasan invoice',
        reference: 'INV-2026-001',
        branch_id: BRANCH_ID,
        bank_account_id: BANK_ACCOUNT_ID,
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: '77777777-7777-4777-8777-777777777777',
        reference_number: 'INV-2026-001',
        amount: 250000,
        description: 'Pelunasan invoice',
        status: 'POSTED',
        created_at: '2026-04-18T10:20:00.000Z',
        journal_entry_id: '88888888-8888-4888-8888-888888888888',
        bank_account_id: BANK_ACCOUNT_ID,
        category_id: COUNTER_ACCOUNT_ID,
        transaction_date: expect.any(String),
      },
      meta: {
        type: 'cash_in',
        auto_post: true,
        settlement_type: 'general',
      },
    })
    expect(mocks.deliverWebhook).toHaveBeenCalledWith(
      ORG_ID,
      BRANCH_ID,
      'cash_in',
      expect.objectContaining({
        transaction_id: '77777777-7777-4777-8777-777777777777',
        bank_account_id: BANK_ACCOUNT_ID,
        counter_account_id: COUNTER_ACCOUNT_ID,
        amount: 250000,
        reference: 'INV-2026-001',
      })
    )
    expect(mocks.logApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/cash',
        method: 'POST',
        statusCode: 200,
        ipAddress: '198.51.100.9',
      })
    )
  })

  it('replays a previously completed idempotent cash write without inserting again', async () => {
    const requestBody = {
      type: 'in',
      amount: 250000,
      description: 'Pelunasan invoice',
      reference: 'INV-2026-001',
      branch_id: BRANCH_ID,
      bank_account_id: BANK_ACCOUNT_ID,
    }

    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [{
          id: 'cfg-1',
          branch_id: BRANCH_ID,
          cash_in_account_id: null,
          cash_out_account_id: null,
          cash_in_params: { counter_account_id: COUNTER_ACCOUNT_ID, auto_post: true },
          cash_out_params: {},
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: BANK_ACCOUNT_ID,
          branch_id: BRANCH_ID,
          account_id: CASH_ACCOUNT_ID,
          bank_name: 'Bank Operasional',
          account_number: '12345',
          currency: 'IDR',
          is_active: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: COUNTER_ACCOUNT_ID }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'idem-1',
          request_hash: buildRequestHash(requestBody),
          status: 'completed',
          response_status: 200,
          response_body: {
            success: true,
            data: {
              id: '77777777-7777-4777-8777-777777777777',
              reference_number: 'INV-2026-001',
              amount: 250000,
              description: 'Pelunasan invoice',
              status: 'POSTED',
              created_at: '2026-04-18T10:20:00.000Z',
              journal_entry_id: '88888888-8888-4888-8888-888888888888',
              bank_account_id: BANK_ACCOUNT_ID,
              category_id: COUNTER_ACCOUNT_ID,
              transaction_date: '2026-04-18',
            },
            meta: {
              type: 'cash_in',
              auto_post: true,
              settlement_type: 'general',
            },
          },
          resource_type: 'bank_transaction',
          resource_id: '77777777-7777-4777-8777-777777777777',
        }],
      })

    const response = await POST(new NextRequest('http://localhost/api/v1/cash', {
      method: 'POST',
      headers: {
        'x-api-key': 'nzm_live_test',
        'content-type': 'application/json',
        'Idempotency-Key': 'cash-inv-2026-001',
      },
      body: JSON.stringify(requestBody),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Idempotency-Key')).toBe('cash-inv-2026-001')
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: '77777777-7777-4777-8777-777777777777',
        reference_number: 'INV-2026-001',
        amount: 250000,
        description: 'Pelunasan invoice',
        status: 'POSTED',
        created_at: '2026-04-18T10:20:00.000Z',
        journal_entry_id: '88888888-8888-4888-8888-888888888888',
        bank_account_id: BANK_ACCOUNT_ID,
        category_id: COUNTER_ACCOUNT_ID,
        transaction_date: '2026-04-18',
      },
      meta: {
        type: 'cash_in',
        auto_post: true,
        settlement_type: 'general',
      },
    })
    expect(mocks.getPostgresPool).not.toHaveBeenCalled()
    expect(mocks.deliverWebhook).not.toHaveBeenCalled()
  })

  it('rejects reused idempotency keys when the payload changes', async () => {
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [{
          id: 'cfg-1',
          branch_id: BRANCH_ID,
          cash_in_account_id: null,
          cash_out_account_id: null,
          cash_in_params: { counter_account_id: COUNTER_ACCOUNT_ID, auto_post: true },
          cash_out_params: {},
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: BANK_ACCOUNT_ID,
          branch_id: BRANCH_ID,
          account_id: CASH_ACCOUNT_ID,
          bank_name: 'Bank Operasional',
          account_number: '12345',
          currency: 'IDR',
          is_active: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: COUNTER_ACCOUNT_ID }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'idem-1',
          request_hash: 'different-hash',
          status: 'completed',
          response_status: 200,
          response_body: { success: true },
          resource_type: 'bank_transaction',
          resource_id: '77777777-7777-4777-8777-777777777777',
        }],
      })

    const response = await POST(new NextRequest('http://localhost/api/v1/cash', {
      method: 'POST',
      headers: {
        'x-api-key': 'nzm_live_test',
        'content-type': 'application/json',
        'Idempotency-Key': 'cash-inv-2026-001',
      },
      body: JSON.stringify({
        type: 'in',
        amount: 275000,
        description: 'Pelunasan invoice',
        reference: 'INV-2026-001',
        branch_id: BRANCH_ID,
        bank_account_id: BANK_ACCOUNT_ID,
      }),
    }))

    expect(response.status).toBe(409)
    expect(response.headers.get('Idempotency-Key')).toBe('cash-inv-2026-001')
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: 'Idempotency key ini sudah dipakai untuk payload berbeda.',
        error_code: 'idempotency_key_conflict',
      })
    )
    expect(mocks.getPostgresPool).not.toHaveBeenCalled()
    expect(mocks.deliverWebhook).not.toHaveBeenCalled()
  })

  it('stores idempotent cash writes inside a transaction and returns the same payload shape', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [] }
        }
        if (sql.includes('INSERT INTO public.api_idempotency_keys')) {
          return { rows: [{ id: 'idem-1' }] }
        }
        if (sql.includes('INSERT INTO public.bank_transactions')) {
          return {
            rows: [{
              id: '77777777-7777-4777-8777-777777777777',
              reference_number: 'INV-2026-001',
              amount: '250000',
              description: 'Pelunasan invoice',
              status: 'POSTED',
              created_at: '2026-04-18T10:20:00.000Z',
              journal_entry_id: '88888888-8888-4888-8888-888888888888',
            }],
          }
        }
        if (sql.includes('UPDATE public.api_idempotency_keys')) {
          return { rows: [] }
        }

        throw new Error(`Unexpected SQL in test: ${sql}`)
      }),
      release: vi.fn(),
    }

    mocks.getPostgresPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
    })
    mocks.queryPostgres
      .mockResolvedValueOnce({
        rows: [{
          id: 'cfg-1',
          branch_id: BRANCH_ID,
          cash_in_account_id: null,
          cash_out_account_id: null,
          cash_in_params: { counter_account_id: COUNTER_ACCOUNT_ID, auto_post: true },
          cash_out_params: {},
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: BANK_ACCOUNT_ID,
          branch_id: BRANCH_ID,
          account_id: CASH_ACCOUNT_ID,
          bank_name: 'Bank Operasional',
          account_number: '12345',
          currency: 'IDR',
          is_active: true,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: COUNTER_ACCOUNT_ID }],
      })
      .mockResolvedValueOnce({
        rows: [],
      })

    const response = await POST(new NextRequest('http://localhost/api/v1/cash', {
      method: 'POST',
      headers: {
        'x-api-key': 'nzm_live_test',
        'content-type': 'application/json',
        'Idempotency-Key': 'cash-inv-2026-001',
      },
      body: JSON.stringify({
        type: 'in',
        amount: 250000,
        description: 'Pelunasan invoice',
        reference: 'INV-2026-001',
        branch_id: BRANCH_ID,
        bank_account_id: BANK_ACCOUNT_ID,
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Idempotency-Key')).toBe('cash-inv-2026-001')
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: '77777777-7777-4777-8777-777777777777',
        reference_number: 'INV-2026-001',
        amount: 250000,
        description: 'Pelunasan invoice',
        status: 'POSTED',
        created_at: '2026-04-18T10:20:00.000Z',
        journal_entry_id: '88888888-8888-4888-8888-888888888888',
        bank_account_id: BANK_ACCOUNT_ID,
        category_id: COUNTER_ACCOUNT_ID,
        transaction_date: expect.any(String),
      },
      meta: {
        type: 'cash_in',
        auto_post: true,
        settlement_type: 'general',
      },
    })
    expect(client.query).toHaveBeenCalledWith('BEGIN')
    expect(client.query).toHaveBeenCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalled()
  })
})
