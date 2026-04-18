import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: mocks.createAdminClient,
}))

import {
  API_KEY_PREFIX,
  apiError,
  apiSuccess,
  extractApiKeyFromRequest,
  extractIpFromRequest,
  hashApiKeySecret,
  logApiCall,
  requireScope,
  validateApiKey,
} from '@/lib/api/validate-key'

const RAW_KEY = `${API_KEY_PREFIX}ABCDEFGHIJKLMNOPQRSTUVWX`

describe('Open API key validation helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-18T10:15:30.000Z'))
  })

  it('extracts API keys from x-api-key and bearer headers', () => {
    const headerRequest = new Request('http://localhost/api/v1/cash', {
      headers: { 'x-api-key': ` ${RAW_KEY} ` },
    })
    const bearerRequest = new Request('http://localhost/api/v1/cash', {
      headers: { authorization: `Bearer ${RAW_KEY}` },
    })

    expect(extractApiKeyFromRequest(headerRequest)).toBe(RAW_KEY)
    expect(extractApiKeyFromRequest(bearerRequest)).toBe(RAW_KEY)
    expect(extractApiKeyFromRequest(new Request('http://localhost/api/v1/cash'))).toBeNull()
  })

  it('extracts caller IP from proxy headers', () => {
    const forwardedRequest = new Request('http://localhost/api/v1/cash', {
      headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.8' },
    })
    const realIpRequest = new Request('http://localhost/api/v1/cash', {
      headers: { 'x-real-ip': '203.0.113.7' },
    })

    expect(extractIpFromRequest(forwardedRequest)).toBe('198.51.100.1')
    expect(extractIpFromRequest(realIpRequest)).toBe('203.0.113.7')
  })

  it('rejects malformed keys before hitting the database', async () => {
    const result = await validateApiKey('invalid-key')

    expect(result).toEqual({
      success: false,
      error: 'API key tidak valid.',
      errorCode: 'api_key_invalid',
      statusCode: 401,
    })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('rejects unknown API keys', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_keys: [{ maybeSingleResult: success(null) }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const result = await validateApiKey(RAW_KEY)

    expect(result).toEqual({
      success: false,
      error: 'API key tidak ditemukan.',
      errorCode: 'api_key_not_found',
      statusCode: 401,
    })
  })

  it('rejects inactive API keys', async () => {
    const keyHash = await hashApiKeySecret('ABCDEFGHIJKLMNOPQRSTUVWX')
    const supabase = createSupabaseMock({
      tables: {
        api_keys: [{
          maybeSingleResult: success({
            id: 'key-1',
            org_id: 'org-1',
            branch_id: null,
            scopes: ['cash:read'],
            is_active: false,
            expires_at: null,
            rate_limit_rpm: 60,
          }),
        }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const result = await validateApiKey(`${API_KEY_PREFIX}ABCDEFGHIJKLMNOPQRSTUVWX`)

    expect(result).toEqual({
      success: false,
      error: 'API key sudah dinonaktifkan.',
      errorCode: 'api_key_revoked',
      statusCode: 401,
    })

    expect(supabase.calls[0]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['key_hash', keyHash] }),
      ])
    )
  })

  it('rejects expired API keys', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_keys: [{
          maybeSingleResult: success({
            id: 'key-1',
            org_id: 'org-1',
            branch_id: null,
            scopes: ['cash:read'],
            is_active: true,
            expires_at: '2026-04-18T10:15:29.000Z',
            rate_limit_rpm: 60,
          }),
        }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const result = await validateApiKey(RAW_KEY)

    expect(result).toEqual({
      success: false,
      error: 'API key sudah kadaluarsa.',
      errorCode: 'api_key_expired',
      statusCode: 401,
    })
  })

  it('enforces per-minute rate limits', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_keys: [{
          maybeSingleResult: success({
            id: 'key-1',
            org_id: 'org-1',
            branch_id: 'branch-1',
            scopes: ['cash:read'],
            is_active: true,
            expires_at: null,
            rate_limit_rpm: 5,
          }),
        }],
        api_rate_limit_log: [{
          maybeSingleResult: success({ request_count: 5 }),
        }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const result = await validateApiKey(RAW_KEY)

    expect(result).toEqual({
      success: false,
      error: 'Rate limit tercapai (5 req/menit). Coba lagi nanti.',
      errorCode: 'rate_limit_exceeded',
      statusCode: 429,
    })
  })

  it('returns validated key context and increments the minute window', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_keys: [{
          maybeSingleResult: success({
            id: 'key-1',
            org_id: 'org-1',
            branch_id: 'branch-1',
            scopes: ['cash:read', 'inventory:read'],
            is_active: true,
            expires_at: null,
            rate_limit_rpm: 10,
          }),
        }],
        api_rate_limit_log: [
          { maybeSingleResult: success({ request_count: 2 }) },
          { result: success([]) },
        ],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    const result = await validateApiKey(RAW_KEY)

    expect(result).toEqual({
      success: true,
      key: {
        keyId: 'key-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        scopes: ['cash:read', 'inventory:read'],
        rateLimitRpm: 10,
      },
    })

    const upsertCall = supabase.calls.find(
      (call) => call.table === 'api_rate_limit_log' && call.operations.some((op) => op.method === 'upsert')
    )

    expect(upsertCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'upsert',
          args: [
            expect.objectContaining({
              api_key_id: 'key-1',
              request_count: 3,
              window_start: '2026-04-18T10:15:00.000Z',
            }),
            { onConflict: 'api_key_id,window_start' },
          ],
        }),
      ])
    )
    if (!result.success) {
      throw new Error('Expected successful API key validation result.')
    }
    expect(requireScope(result.key, 'inventory:read')).toBe(true)
    expect(requireScope(result.key, 'cash:write')).toBe(false)
  })

  it('builds standard JSON success and error envelopes', async () => {
    const successResponse = apiSuccess({ ok: true }, { count: 1 })
    const errorResponse = apiError('Bad request', 400)

    expect(successResponse.headers.get('X-Nizam-API')).toBe('1.0')
    expect(errorResponse.headers.get('X-Nizam-API')).toBe('1.0')
    expect(errorResponse.headers.get('X-Nizam-Request-Id')).toEqual(expect.any(String))
    await expect(successResponse.json()).resolves.toEqual({
      success: true,
      data: { ok: true },
      meta: { count: 1 },
    })
    await expect(errorResponse.json()).resolves.toEqual({
      success: false,
      error: 'Bad request',
      message: 'Bad request',
      error_code: 'bad_request',
      request_id: expect.any(String),
    })
  })

  it('writes API call logs without throwing', async () => {
    const supabase = createSupabaseMock({
      tables: {
        api_call_logs: [{ result: success([]) }],
      },
    })
    mocks.createAdminClient.mockResolvedValue(supabase.client)

    await expect(logApiCall({
      orgId: 'org-1',
      apiKeyId: 'key-1',
      method: 'GET',
      endpoint: '/api/v1/cash',
      statusCode: 200,
      durationMs: 12,
      ipAddress: '198.51.100.11',
      userAgent: 'Vitest',
      errorMessage: null,
    })).resolves.toBeUndefined()

    const insertCall = supabase.calls.find((call) => call.table === 'api_call_logs')
    expect(insertCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'insert',
          args: [
            expect.objectContaining({
              org_id: 'org-1',
              api_key_id: 'key-1',
              endpoint: '/api/v1/cash',
              status_code: 200,
              duration_ms: 12,
            }),
          ],
        }),
      ])
    )
  })
})
