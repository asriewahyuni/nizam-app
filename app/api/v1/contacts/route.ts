/**
 * app/api/v1/contacts/route.ts
 *
 * Open API endpoint untuk data kontak (customer/supplier).
 * GET /api/v1/contacts  → daftar kontak (scope: contacts:read)
 */

import { type NextRequest } from 'next/server'
import {
  validateApiKey, requireScope, apiError, apiSuccess, extractApiKeyFromRequest,
  logApiCall, extractIpFromRequest,
} from '@/lib/api/validate-key'
import { createAdminClient } from '@/lib/supabase/server'

type ContactApiRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  phone_wa: string | null
  instagram: string | null
  address: string | null
  type: string | null
  is_active: boolean
  created_at: string
}

type ContactsQueryResult = {
  data: ContactApiRow[] | null
  error: unknown
}

type ContactsQueryBuilder = PromiseLike<ContactsQueryResult> & {
  eq(column: string, value: unknown): ContactsQueryBuilder
  order(column: string, options: { ascending: boolean }): ContactsQueryBuilder
  limit(value: number): ContactsQueryBuilder
  ilike(column: string, pattern: string): ContactsQueryBuilder
}

type ContactsAdminClient = {
  from(table: string): {
    select(columns: string): ContactsQueryBuilder
  }
}

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

function normalizeContactType(rawType: string | null) {
  if (!rawType) return null

  const normalized = rawType.trim().toUpperCase()
  if (normalized === 'CUSTOMER' || normalized === 'SUPPLIER') return normalized
  return rawType
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return withNoStore(apiError('API key diperlukan. Sertakan header x-api-key.', 401))

  const validation = await validateApiKey(rawKey, request)
  if (!validation.success) {
    return withNoStore(apiError(validation.error, validation.statusCode, { errorCode: validation.errorCode }))
  }

  if (!requireScope(validation.key, 'contacts:read')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: contacts:read', 403))
  }

  const { orgId } = validation.key

  const response = await (async () => {
  const { searchParams } = new URL(request.url)
  const limitParam = Math.min(Number(searchParams.get('limit') ?? '100'), 500)
  const type = normalizeContactType(searchParams.get('type'))
  const search = searchParams.get('search') ?? ''

  let admin: Awaited<ReturnType<typeof createAdminClient>>
  try { admin = await createAdminClient() } catch { return withNoStore(apiError('Server error.', 500)) }
  const adminClient = admin as unknown as ContactsAdminClient

  let query = adminClient
    .from('contacts')
    .select('id, name, email, phone, phone_wa, instagram, address, type, is_active, created_at')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limitParam)

  if (type) query = query.eq('type', type)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) return withNoStore(apiError('Gagal mengambil data kontak.', 500))

  return withNoStore(apiSuccess(data ?? [], { org_id: orgId, count: (data ?? []).length }))
  })()

  void logApiCall({
    orgId: validation.key.orgId,
    apiKeyId: validation.key.keyId,
    method: 'GET',
    endpoint: '/api/v1/contacts',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
