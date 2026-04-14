/**
 * app/api/v1/inventory/route.ts
 *
 * Open API endpoint untuk data inventori.
 * GET /api/v1/inventory  → daftar produk + stok (scope: inventory:read)
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

  if (!requireScope(validation.key, 'inventory:read')) {
    return apiError('Scope tidak mencukupi. Diperlukan: inventory:read', 403)
  }

  const { orgId, branchId } = validation.key
  const { searchParams } = new URL(request.url)
  const limitParam = Math.min(Number(searchParams.get('limit') ?? '100'), 500)
  const search = searchParams.get('search') ?? ''

  let admin: Awaited<ReturnType<typeof createAdminClient>>
  try { admin = await createAdminClient() } catch { return apiError('Server error.', 500) }

  let query = (admin as any)
    .from('products')
    .select('id, code, name, unit, category, selling_price, cost_price, stock_quantity, branch_id, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limitParam)

  if (branchId) query = query.eq('branch_id', branchId)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) return apiError('Gagal mengambil data inventori.', 500)

  return apiSuccess(data ?? [], {
    org_id: orgId,
    branch_scope: branchId ?? 'all',
    count: (data ?? []).length,
  })
}
