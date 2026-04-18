/**
 * lib/api/validate-key.ts
 *
 * Utilitas validasi API key untuk endpoint publik Nizam Open API.
 *
 * Format key: nzm_live_[24 karakter random base64url]
 * Contoh:     nzm_live_a1B2c3D4e5F6g7H8i9J0k1L2
 *
 * Hanya prefix "nzm_live_" yang disimpan di DB (plaintext).
 * Bagian secret (24 char) di-hash SHA-256 dan disimpan sebagai hex string.
 */

import { createAdminClient } from '@/lib/supabase/server'

export const API_KEY_PREFIX = 'nzm_live_'
export const VALID_SCOPES = [
  'cash:read',
  'cash:write',
  'sales:read',
  'inventory:read',
  'contacts:read',
] as const

export type ApiScope = (typeof VALID_SCOPES)[number]

export type ValidatedApiKey = {
  keyId: string
  orgId: string
  branchId: string | null
  scopes: string[]
  rateLimitRpm: number
}

export type ApiKeyValidationResult =
  | { success: true; key: ValidatedApiKey }
  | { success: false; error: string; errorCode: string; statusCode: number }

export type ApiErrorOptions = {
  errorCode?: string
  requestId?: string
  headers?: HeadersInit
  extra?: Record<string, unknown>
}

type ApiKeyRow = {
  id: string
  org_id: string
  branch_id: string | null
  scopes: unknown
  is_active: boolean
  expires_at: string | null
  rate_limit_rpm: number | null
  request_count?: number | null
}

type RateLimitRow = {
  request_count: number | null
}

type SupabaseMaybeSingleResult<T> = Promise<{ data: T | null; error: unknown }>
type SupabaseWriteResult = Promise<unknown>

type SupabaseTableBuilder = {
  select(columns: string): SupabaseTableBuilder
  eq(column: string, value: unknown): SupabaseTableBuilder
  maybeSingle<T = unknown>(): SupabaseMaybeSingleResult<T>
  upsert(values: Record<string, unknown>, options?: { onConflict: string }): SupabaseWriteResult
  update(values: Record<string, unknown>): SupabaseTableBuilder
  insert(values: Record<string, unknown>): SupabaseWriteResult
}

type SupabaseAdminClient = {
  from(table: string): SupabaseTableBuilder
}

function inferApiErrorCode(message: string, statusCode: number, fallback?: string) {
  if (fallback) return fallback

  const normalized = String(message || '').toLowerCase()

  if (statusCode === 429) return 'rate_limit_exceeded'

  if (normalized.includes('api key diperlukan')) return 'api_key_missing'
  if (normalized.includes('api key tidak valid')) return 'api_key_invalid'
  if (normalized.includes('api key tidak ditemukan')) return 'api_key_not_found'
  if (normalized.includes('api key sudah dinonaktifkan')) return 'api_key_revoked'
  if (normalized.includes('api key sudah kadaluarsa')) return 'api_key_expired'
  if (normalized.includes('scope tidak mencukupi')) return 'scope_missing'
  if (normalized.includes('request body harus berformat json valid')) return 'request_body_invalid'
  if (normalized.includes('branch_id diperlukan')) return 'branch_id_required'
  if (normalized.includes('branch_id pada body tidak boleh berbeda')) return 'branch_scope_mismatch'
  if (normalized.includes('field "type" harus')) return 'cash_type_invalid'
  if (normalized.includes('field "amount" harus')) return 'amount_invalid'
  if (normalized.includes('field "description" wajib')) return 'description_required'
  if (normalized.includes('field "transaction_date" tidak valid')) return 'transaction_date_invalid'
  if (normalized.includes('akun lawan transaksi tidak boleh sama')) return 'counter_account_conflict'
  if (normalized.includes('salah satu akun lawan transaksi tidak ditemukan')) return 'counter_account_not_found'
  if (normalized.includes('saldo kas tidak mencukupi')) return 'insufficient_balance'
  if (normalized.includes('journal_lines')) return 'journal_lines_invalid'
  if (normalized.includes('rekening kas/bank tujuan tidak ditemukan')) return 'cash_in_account_missing'
  if (normalized.includes('rekening kas/bank sumber tidak ditemukan')) return 'cash_out_account_missing'
  if (normalized.includes('akun lawan kas masuk belum dikonfigurasi')) return 'cash_in_counter_account_missing'
  if (normalized.includes('akun lawan kas keluar belum dikonfigurasi')) return 'cash_out_counter_account_missing'
  if (normalized.includes('akun piutang')) return 'receivable_account_missing'
  if (normalized.includes('akun hutang')) return 'payable_account_missing'
  if (normalized.includes('akun pajak')) return 'tax_account_missing'
  if (normalized.includes('akun diskon')) return 'discount_account_missing'
  if (normalized.includes('akun biaya lain-lain')) return 'other_charge_account_missing'
  if (normalized.includes('gagal mengambil data inventori')) return 'inventory_fetch_failed'
  if (normalized.includes('gagal mengambil data kontak')) return 'contacts_fetch_failed'
  if (normalized.includes('gagal mengambil data penjualan')) return 'sales_fetch_failed'
  if (normalized.includes('gagal mengambil data rekening')) return 'cash_accounts_fetch_failed'
  if (normalized.includes('gagal mencatat transaksi kas masuk')) return 'cash_in_create_failed'
  if (normalized.includes('gagal mencatat transaksi kas keluar')) return 'cash_out_create_failed'
  if (normalized.includes('server error')) return 'server_error'

  if (statusCode >= 500) return 'server_error'
  if (statusCode === 403) return 'forbidden'
  if (statusCode === 404) return 'not_found'
  if (statusCode === 409) return 'conflict'
  if (statusCode === 422) return 'unprocessable_entity'
  if (statusCode === 401) return 'unauthorized'
  if (statusCode === 400) return 'bad_request'

  return 'api_error'
}

function isApiErrorOptions(value: unknown): value is ApiErrorOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return 'errorCode' in value || 'requestId' in value || 'headers' in value || 'extra' in value
}

/**
 * Hash secret portion of an API key with SHA-256.
 * Returns hex string.
 */
export async function hashApiKeySecret(secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(secret)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a new API key.
 * Returns both the full key (to show once to user) and parts for storage.
 */
export function generateRawApiKey(): { fullKey: string; prefix: string; secret: string } {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let secret = ''
  const randomValues = new Uint8Array(24)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < 24; i++) {
    secret += chars[randomValues[i] % chars.length]
  }
  return {
    fullKey: `${API_KEY_PREFIX}${secret}`,
    prefix: API_KEY_PREFIX,
    secret,
  }
}

/**
 * Validate an API key from a request.
 * Checks: format → existence → active → not expired → rate limit → return context.
 */
export async function validateApiKey(rawKey: string): Promise<ApiKeyValidationResult> {
  // 1. Format check
  if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
    return { success: false, error: 'API key tidak valid.', errorCode: 'api_key_invalid', statusCode: 401 }
  }

  const secret = rawKey.slice(API_KEY_PREFIX.length)
  if (secret.length < 16) {
    return { success: false, error: 'API key tidak valid.', errorCode: 'api_key_invalid', statusCode: 401 }
  }

  // 2. Hash the secret
  const keyHash = await hashApiKeySecret(secret)

  // 3. Look up in DB (use admin client — rate limit log is not RLS-protected)
  let admin: Awaited<ReturnType<typeof createAdminClient>>
  try {
    admin = await createAdminClient()
  } catch {
    return { success: false, error: 'Server error.', errorCode: 'server_error', statusCode: 500 }
  }
  const adminClient = admin as unknown as SupabaseAdminClient

  const { data: keyRow, error: keyError } = await adminClient
    .from('api_keys')
    .select('id, org_id, branch_id, scopes, is_active, expires_at, rate_limit_rpm')
    .eq('key_hash', keyHash)
    .maybeSingle<ApiKeyRow>()

  if (keyError || !keyRow) {
    return { success: false, error: 'API key tidak ditemukan.', errorCode: 'api_key_not_found', statusCode: 401 }
  }

  // 4. Active check
  if (!keyRow.is_active) {
    return { success: false, error: 'API key sudah dinonaktifkan.', errorCode: 'api_key_revoked', statusCode: 401 }
  }

  // 5. Expiry check
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return { success: false, error: 'API key sudah kadaluarsa.', errorCode: 'api_key_expired', statusCode: 401 }
  }

  // 6. Rate limit check (sliding window per minute)
  const rateLimitRpm: number = keyRow.rate_limit_rpm ?? 60
  const windowStart = new Date()
  windowStart.setSeconds(0, 0)

  const { data: rateLimitRow } = await adminClient
    .from('api_rate_limit_log')
    .select('request_count')
    .eq('api_key_id', keyRow.id)
    .eq('window_start', windowStart.toISOString())
    .maybeSingle<RateLimitRow>()

  const currentCount: number = rateLimitRow?.request_count ?? 0
  if (currentCount >= rateLimitRpm) {
    return {
      success: false,
      error: `Rate limit tercapai (${rateLimitRpm} req/menit). Coba lagi nanti.`,
      errorCode: 'rate_limit_exceeded',
      statusCode: 429,
    }
  }

  // 7. Increment rate limit counter (upsert)
  await adminClient
    .from('api_rate_limit_log')
    .upsert(
      {
        api_key_id: keyRow.id,
        window_start: windowStart.toISOString(),
        request_count: currentCount + 1,
      },
      { onConflict: 'api_key_id,window_start' }
    )

  // 8. Update last_used_at + request_count (fire-and-forget)
  void adminClient
    .from('api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      request_count: (keyRow.request_count ?? 0) + 1,
    })
    .eq('id', keyRow.id)

  return {
    success: true,
    key: {
      keyId: keyRow.id,
      orgId: keyRow.org_id,
      branchId: keyRow.branch_id ?? null,
      scopes: Array.isArray(keyRow.scopes) ? keyRow.scopes : [],
      rateLimitRpm,
    },
  }
}

/**
 * Check if a validated key has the required scope.
 */
export function requireScope(key: ValidatedApiKey, scope: ApiScope): boolean {
  return key.scopes.includes(scope)
}

/**
 * Standard JSON error response helper for API routes.
 */
export function apiError(
  message: string,
  statusCode: number,
  extraOrOptions?: Record<string, unknown> | ApiErrorOptions
) {
  const options = isApiErrorOptions(extraOrOptions)
    ? extraOrOptions
    : { extra: extraOrOptions }
  const requestId = String(options.requestId || crypto.randomUUID())
  const errorCode = inferApiErrorCode(message, statusCode, options.errorCode)
  const headers = new Headers(options.headers)

  headers.set('Content-Type', 'application/json')
  headers.set('X-Nizam-API', '1.0')
  headers.set('X-Nizam-Request-Id', requestId)

  return Response.json(
    {
      success: false,
      error: message,
      message,
      error_code: errorCode,
      request_id: requestId,
      ...(options.extra || {}),
    },
    {
      status: statusCode,
      headers,
    }
  )
}

/**
 * Standard JSON success response helper.
 */
export function apiSuccess(data: unknown, meta?: Record<string, unknown>) {
  return Response.json(
    { success: true, data, ...(meta ? { meta } : {}) },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Nizam-API': '1.0',
      },
    }
  )
}

/**
 * Extract API key from request headers.
 * Supports: x-api-key header or Authorization: Bearer nzm_live_xxx
 */
export function extractApiKeyFromRequest(request: Request): string | null {
  const headerKey = request.headers.get('x-api-key')
  if (headerKey) return headerKey.trim()

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  return null
}

export type ApiCallLogInput = {
  orgId: string
  apiKeyId: string | null
  method: string
  endpoint: string
  statusCode: number
  durationMs?: number
  ipAddress?: string | null
  userAgent?: string | null
  errorMessage?: string | null
}

/**
 * Log an API call to api_call_logs table (fire-and-forget).
 * Always uses admin client so RLS does not block server-side INSERT.
 */
export async function logApiCall(input: ApiCallLogInput): Promise<void> {
  try {
    const admin = await createAdminClient()
    const adminClient = admin as unknown as SupabaseAdminClient
    await adminClient
      .from('api_call_logs')
      .insert({
        org_id: input.orgId,
        api_key_id: input.apiKeyId ?? null,
        method: input.method,
        endpoint: input.endpoint,
        status_code: input.statusCode,
        duration_ms: input.durationMs ?? null,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        error_message: input.errorMessage ?? null,
      })
  } catch {
    // Non-fatal — logging must never break the API response
  }
}

/**
 * Extract caller IP from request headers.
 */
export function extractIpFromRequest(request: Request): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  )
}
