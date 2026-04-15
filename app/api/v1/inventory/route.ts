/**
 * app/api/v1/inventory/route.ts
 *
 * Open API endpoint untuk data inventori.
 * GET /api/v1/inventory  → daftar produk + stok (scope: inventory:read)
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { type NextRequest } from 'next/server'
import {
  validateApiKey, requireScope, apiError, apiSuccess, extractApiKeyFromRequest,
} from '@/lib/api/validate-key'
import { queryPostgres } from '@/lib/db/postgres'

type InventoryApiRow = {
  id: string
  code: string | null
  name: string
  unit: string | null
  category: string | null
  selling_price: number | string | null
  cost_price: number | string | null
  stock_quantity: number | string | null
  is_active: boolean
}

function normalizeLimit(rawLimit: string | null) {
  const parsed = Number.parseInt(rawLimit ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 100
  return Math.min(parsed, 500)
}

function toSafeNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

export async function GET(request: NextRequest) {
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return withNoStore(apiError('API key diperlukan. Sertakan header x-api-key.', 401))

  const validation = await validateApiKey(rawKey)
  if (!validation.success) return withNoStore(apiError(validation.error, validation.statusCode))

  if (!requireScope(validation.key, 'inventory:read')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: inventory:read', 403))
  }

  const { orgId, branchId } = validation.key
  const { searchParams } = new URL(request.url)
  const limitParam = normalizeLimit(searchParams.get('limit'))
  const search = searchParams.get('search')?.trim() ?? ''

  let rows: InventoryApiRow[]
  try {
    const result = await queryPostgres<InventoryApiRow>(
      `
        SELECT
          p.id,
          p.sku AS code,
          p.name,
          p.unit,
          p.category,
          p.selling_price,
          p.purchase_price AS cost_price,
          COALESCE(
            SUM(
              CASE
                WHEN w.id IS NOT NULL THEN s.quantity
                ELSE 0
              END
            ),
            0
          ) AS stock_quantity,
          p.is_active
        FROM public.products p
        LEFT JOIN public.inventory_stocks s
          ON s.org_id = p.org_id
         AND s.product_id = p.id
        LEFT JOIN public.warehouses w
          ON w.id = s.warehouse_id
         AND w.org_id = p.org_id
         AND w.is_active = TRUE
         AND ($2::uuid IS NULL OR w.branch_id = $2::uuid)
        WHERE p.org_id = $1::uuid
          AND p.is_active = TRUE
          AND ($3::text = '' OR p.name ILIKE '%' || $3::text || '%')
        GROUP BY
          p.id,
          p.sku,
          p.name,
          p.unit,
          p.category,
          p.selling_price,
          p.purchase_price,
          p.is_active
        ORDER BY p.name ASC
        LIMIT $4::int
      `,
      [orgId, branchId, search, limitParam]
    )

    rows = result.rows
  } catch {
    return withNoStore(apiError('Gagal mengambil data inventori.', 500))
  }

  const data = rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    unit: row.unit ?? '',
    category: row.category,
    selling_price: toSafeNumber(row.selling_price),
    cost_price: toSafeNumber(row.cost_price),
    stock_quantity: toSafeNumber(row.stock_quantity),
    branch_id: branchId,
    is_active: row.is_active,
  }))

  return withNoStore(apiSuccess(data, {
    org_id: orgId,
    branch_scope: branchId ?? 'all',
    count: data.length,
  }))
}
