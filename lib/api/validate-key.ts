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
  | { success: false; error: string; statusCode: number }

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
    return { success: false, error: 'API key tidak valid.', statusCode: 401 }
  }

  const secret = rawKey.slice(API_KEY_PREFIX.length)
  if (secret.length < 16) {
    return { success: false, error: 'API key tidak valid.', statusCode: 401 }
  }

  // 2. Hash the secret
  const keyHash = await hashApiKeySecret(secret)

  // 3. Look up in DB (use admin client — rate limit log is not RLS-protected)
  let admin: Awaited<ReturnType<typeof createAdminClient>>
  try {
    admin = await createAdminClient()
  } catch {
    return { success: false, error: 'Server error.', statusCode: 500 }
  }

  const { data: keyRow, error: keyError } = await (admin as any)
    .from('api_keys')
    .select('id, org_id, branch_id, scopes, is_active, expires_at, rate_limit_rpm')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (keyError || !keyRow) {
    return { success: false, error: 'API key tidak ditemukan.', statusCode: 401 }
  }

  // 4. Active check
  if (!keyRow.is_active) {
    return { success: false, error: 'API key sudah dinonaktifkan.', statusCode: 401 }
  }

  // 5. Expiry check
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return { success: false, error: 'API key sudah kadaluarsa.', statusCode: 401 }
  }

  // 6. Rate limit check (sliding window per minute)
  const rateLimitRpm: number = keyRow.rate_limit_rpm ?? 60
  const windowStart = new Date()
  windowStart.setSeconds(0, 0)

  const { data: rateLimitRow } = await (admin as any)
    .from('api_rate_limit_log')
    .select('request_count')
    .eq('api_key_id', keyRow.id)
    .eq('window_start', windowStart.toISOString())
    .maybeSingle()

  const currentCount: number = rateLimitRow?.request_count ?? 0
  if (currentCount >= rateLimitRpm) {
    return {
      success: false,
      error: `Rate limit tercapai (${rateLimitRpm} req/menit). Coba lagi nanti.`,
      statusCode: 429,
    }
  }

  // 7. Increment rate limit counter (upsert)
  await (admin as any)
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
  void (admin as any)
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
export function apiError(message: string, statusCode: number, extra?: Record<string, unknown>) {
  return Response.json(
    { success: false, error: message, ...extra },
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Nizam-API': '1.0',
      },
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
