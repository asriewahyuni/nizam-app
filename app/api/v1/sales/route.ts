/**
 * app/api/v1/sales/route.ts
 *
 * Open API endpoint untuk data penjualan.
 * GET /api/v1/sales  → daftar invoice/sales order (scope: sales:read)
 */

import { type NextRequest } from 'next/server'
import {
  validateApiKey,
  requireScope,
  apiError,
  apiSuccess,
  extractApiKeyFromRequest,
  logApiCall,
  extractIpFromRequest,
} from '@/lib/api/validate-key'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return apiError('API key diperlukan. Sertakan header x-api-key.', 401)

  const validation = await validateApiKey(rawKey)
  if (!validation.success) return apiError(validation.error, validation.statusCode)

  if (!requireScope(validation.key, 'sales:read')) {
    return apiError('Scope tidak mencukupi. Diperlukan: sales:read', 403)
  }

  const { orgId, branchId } = validation.key

  const response = await (async () => {
  const { searchParams } = new URL(request.url)
  const limitParam = Math.min(Number(searchParams.get('limit') ?? '50'), 200)
  const status = searchParams.get('status')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  let admin: Awaited<ReturnType<typeof createAdminClient>>
  try {
    admin = await createAdminClient()
  } catch {
    return apiError('Server error.', 500)
  }

  let query = (admin as any)
    .from('sales_orders')
    .select('id, so_number, customer_name, total_amount, status, branch_id, order_date, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limitParam)

  if (branchId) query = query.eq('branch_id', branchId)
  if (status) query = query.eq('status', status)
  if (dateFrom) query = query.gte('order_date', dateFrom)
  if (dateTo) query = query.lte('order_date', dateTo)

  const { data, error } = await query

  if (error) return apiError('Gagal mengambil data penjualan.', 500)

  return apiSuccess(data ?? [], {
    org_id: orgId,
    branch_scope: branchId ?? 'all',
    count: (data ?? []).length,
  })
  })()

  void logApiCall({
    orgId: validation.key.orgId,
    apiKeyId: validation.key.keyId,
    method: 'GET',
    endpoint: '/api/v1/sales',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
