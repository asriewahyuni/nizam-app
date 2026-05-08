/**
 * app/api/v1/inventory/movements/route.ts
 *
 * Open API endpoint untuk kartu stok / inventory movements.
 * GET /api/v1/inventory/movements → daftar mutasi stok (scope: inventory:read)
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
import { queryPostgres } from '@/lib/db/postgres'

type InventoryMovementApiRow = {
  id: string
  product_id: string
  product_code: string | null
  product_name: string | null
  product_unit: string | null
  product_category: string | null
  movement_date: string
  quantity: number | string | null
  unit_price: number | string | null
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  branch_id: string | null
  created_at: string
}

type InventoryDirection = 'in' | 'out' | 'neutral'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

function normalizeLimit(rawLimit: string | null) {
  const parsed = Number.parseInt(rawLimit ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 100
  return Math.min(parsed, 500)
}

function normalizeDirectionFilter(rawDirection: string | null) {
  if (!rawDirection) return null

  const normalized = rawDirection.trim().toLowerCase()
  if (normalized === 'in' || normalized === 'masuk' || normalized === 'positive') return 'in'
  if (normalized === 'out' || normalized === 'keluar' || normalized === 'negative') return 'out'
  return 'invalid'
}

function normalizeReferenceTypeFilter(rawReferenceType: string | null) {
  if (!rawReferenceType) return null
  const normalized = rawReferenceType.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

function normalizeUuidParam(rawValue: string | null) {
  if (!rawValue) return null
  const normalized = rawValue.trim()
  if (!normalized) return null
  return UUID_PATTERN.test(normalized) ? normalized : 'invalid'
}

function normalizeDateParam(rawValue: string | null) {
  if (!rawValue) return null
  const normalized = rawValue.trim()
  if (!normalized) return null
  return DATE_PATTERN.test(normalized) ? normalized : 'invalid'
}

function toSafeNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function resolveDirection(quantity: number): InventoryDirection {
  if (quantity > 0) return 'in'
  if (quantity < 0) return 'out'
  return 'neutral'
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return withNoStore(apiError('API key diperlukan. Sertakan header x-api-key.', 401))

  const validation = await validateApiKey(rawKey, request)
  if (!validation.success) {
    return withNoStore(apiError(validation.error, validation.statusCode, { errorCode: validation.errorCode }))
  }

  if (!requireScope(validation.key, 'inventory:read')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: inventory:read', 403))
  }

  const { orgId, branchId } = validation.key

  const response = await (async () => {
    const { searchParams } = new URL(request.url)
    const limitParam = normalizeLimit(searchParams.get('limit'))
    const search = searchParams.get('search')?.trim() ?? ''
    const productId = normalizeUuidParam(searchParams.get('product_id'))
    const referenceType = normalizeReferenceTypeFilter(searchParams.get('reference_type'))
    const direction = normalizeDirectionFilter(searchParams.get('direction'))
    const dateFrom = normalizeDateParam(searchParams.get('date_from'))
    const dateTo = normalizeDateParam(searchParams.get('date_to'))

    if (productId === 'invalid') {
      return withNoStore(apiError('Parameter "product_id" harus berupa UUID valid.', 400, { errorCode: 'product_id_invalid' }))
    }
    if (dateFrom === 'invalid') {
      return withNoStore(apiError('Parameter "date_from" harus berformat YYYY-MM-DD.', 400, { errorCode: 'date_from_invalid' }))
    }
    if (dateTo === 'invalid') {
      return withNoStore(apiError('Parameter "date_to" harus berformat YYYY-MM-DD.', 400, { errorCode: 'date_to_invalid' }))
    }
    if (direction === 'invalid') {
      return withNoStore(apiError('Parameter "direction" harus berisi in atau out.', 400, { errorCode: 'inventory_direction_invalid' }))
    }

    let rows: InventoryMovementApiRow[]
    try {
      const result = await queryPostgres<InventoryMovementApiRow>(
        `
          SELECT
            sm.id::text AS id,
            sm.product_id::text AS product_id,
            p.sku AS product_code,
            p.name AS product_name,
            p.unit AS product_unit,
            p.category AS product_category,
            sm.movement_date::text AS movement_date,
            sm.quantity,
            sm.unit_price,
            sm.reference_type,
            sm.reference_id::text AS reference_id,
            sm.notes,
            sm.branch_id::text AS branch_id,
            sm.created_at::text AS created_at
          FROM public.stock_movements sm
          LEFT JOIN public.products p
            ON p.id = sm.product_id
           AND p.org_id = sm.org_id
          WHERE sm.org_id = $1::uuid
            AND ($2::uuid IS NULL OR sm.branch_id = $2::uuid)
            AND ($3::uuid IS NULL OR sm.product_id = $3::uuid)
            AND ($4::text IS NULL OR UPPER(COALESCE(sm.reference_type, '')) = $4::text)
            AND ($5::date IS NULL OR sm.movement_date::date >= $5::date)
            AND ($6::date IS NULL OR sm.movement_date::date <= $6::date)
            AND (
              $7::text = ''
              OR COALESCE(p.name, '') ILIKE '%' || $7::text || '%'
              OR COALESCE(p.sku, '') ILIKE '%' || $7::text || '%'
              OR COALESCE(sm.notes, '') ILIKE '%' || $7::text || '%'
            )
            AND (
              $8::text IS NULL
              OR ($8::text = 'in' AND sm.quantity > 0)
              OR ($8::text = 'out' AND sm.quantity < 0)
            )
          ORDER BY sm.movement_date DESC, sm.created_at DESC
          LIMIT $9::int
        `,
        [orgId, branchId, productId, referenceType, dateFrom, dateTo, search, direction, limitParam]
      )

      rows = result.rows
    } catch {
      return withNoStore(apiError('Gagal mengambil data mutasi inventori.', 500, { errorCode: 'inventory_movements_fetch_failed' }))
    }

    const data = rows.map((row) => {
      const quantity = toSafeNumber(row.quantity)
      return {
        id: row.id,
        product_id: row.product_id,
        product_code: row.product_code,
        product_name: row.product_name ?? 'Tanpa Nama Produk',
        product_unit: row.product_unit,
        product_category: row.product_category,
        movement_date: row.movement_date,
        quantity,
        direction: resolveDirection(quantity),
        unit_price: toSafeNumber(row.unit_price),
        reference_type: row.reference_type ? String(row.reference_type).trim().toUpperCase() : null,
        reference_id: row.reference_id,
        notes: row.notes,
        branch_id: row.branch_id,
        created_at: row.created_at,
      }
    })

    return withNoStore(apiSuccess(data, {
      org_id: orgId,
      branch_scope: branchId ?? 'all',
      count: data.length,
    }))
  })()

  void logApiCall({
    orgId: validation.key.orgId,
    apiKeyId: validation.key.keyId,
    method: 'GET',
    endpoint: '/api/v1/inventory/movements',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
