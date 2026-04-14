/**
 * app/api/v1/contacts/route.ts
 *
 * Open API endpoint untuk data kontak (customer/supplier).
 * GET /api/v1/contacts  → daftar kontak (scope: contacts:read)
 */

import { type NextRequest } from 'next/server'
import {
  validateApiKey, requireScope, apiError, apiSuccess, extractApiKeyFromRequest,
} from '@/lib/api/validate-key'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return apiError('API key diperlukan. Sertakan header x-api-key.', 401)

  const validation = await validateApiKey(rawKey)
  if (!validation.success) return apiError(validation.error, validation.statusCode)

  if (!requireScope(validation.key, 'contacts:read')) {
    return apiError('Scope tidak mencukupi. Diperlukan: contacts:read', 403)
  }

  const { orgId } = validation.key
  const { searchParams } = new URL(request.url)
  const limitParam = Math.min(Number(searchParams.get('limit') ?? '100'), 500)
  const type = searchParams.get('type') // 'customer' | 'supplier' | null
  const search = searchParams.get('search') ?? ''

  let admin: Awaited<ReturnType<typeof createAdminClient>>
  try { admin = await createAdminClient() } catch { return apiError('Server error.', 500) }

  let query = (admin as any)
    .from('contacts')
    .select('id, name, email, phone, type, company, is_active, created_at')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limitParam)

  if (type) query = query.eq('type', type)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) return apiError('Gagal mengambil data kontak.', 500)

  return apiSuccess(data ?? [], { org_id: orgId, count: (data ?? []).length })
}
