/**
 * app/api/v1/inventory/reconciliation/route.ts
 *
 * Open API endpoint untuk rekonsiliasi sub-ledger inventory vs buku besar.
 * GET /api/v1/inventory/reconciliation → valuasi on-hand dan variance GL inventory (scope: ledger:read)
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

type ProductValuationRow = {
  id: string
  product_code: string | null
  product_name: string | null
  product_unit: string | null
  product_category: string | null
  average_cost: number | string | null
}

type ProductStockRow = {
  product_id: string
  stock_qty: number | string | null
}

type LedgerInventoryBalanceRow = {
  gl_inventory_balance: number | string | null
}

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

function normalizeBooleanParam(rawValue: string | null) {
  if (!rawValue) return false
  const normalized = rawValue.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function toSafeNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return withNoStore(apiError('API key diperlukan. Sertakan header x-api-key.', 401))

  const validation = await validateApiKey(rawKey)
  if (!validation.success) {
    return withNoStore(apiError(validation.error, validation.statusCode, { errorCode: validation.errorCode }))
  }

  if (!requireScope(validation.key, 'ledger:read')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: ledger:read', 403))
  }

  const { orgId, branchId } = validation.key

  const response = await (async () => {
    const { searchParams } = new URL(request.url)
    const limitParam = normalizeLimit(searchParams.get('limit'))
    const search = searchParams.get('search')?.trim() ?? ''
    const productId = normalizeUuidParam(searchParams.get('product_id'))
    const asOfDate = normalizeDateParam(searchParams.get('as_of_date'))
    const varianceOnly = normalizeBooleanParam(searchParams.get('variance_only'))

    if (productId === 'invalid') {
      return withNoStore(apiError('Parameter "product_id" harus berupa UUID valid.', 400, { errorCode: 'product_id_invalid' }))
    }
    if (asOfDate === 'invalid') {
      return withNoStore(apiError('Parameter "as_of_date" harus berformat YYYY-MM-DD.', 400, { errorCode: 'as_of_date_invalid' }))
    }

    let productRows: ProductValuationRow[]
    try {
      const result = await queryPostgres<ProductValuationRow>(
        `
          SELECT
            p.id::text AS id,
            p.sku AS product_code,
            p.name AS product_name,
            p.unit AS product_unit,
            p.category AS product_category,
            p.average_cost
          FROM public.products p
          WHERE p.org_id = $1::uuid
            AND p.is_active = TRUE
            AND ($2::uuid IS NULL OR p.id = $2::uuid)
            AND (
              $3::text = ''
              OR COALESCE(p.name, '') ILIKE '%' || $3::text || '%'
              OR COALESCE(p.sku, '') ILIKE '%' || $3::text || '%'
            )
          ORDER BY p.name ASC
          LIMIT $4::int
        `,
        [orgId, productId, search, limitParam]
      )

      productRows = result.rows
    } catch {
      return withNoStore(apiError('Gagal mengambil data rekonsiliasi inventory.', 500, { errorCode: 'inventory_reconciliation_fetch_failed' }))
    }

    if (productRows.length === 0) {
      return withNoStore(apiSuccess([], {
        org_id: orgId,
        branch_scope: branchId ?? 'all',
        count: 0,
        as_of_date: asOfDate,
        on_hand_value: 0,
        gl_inventory_balance: 0,
        inventory_variance: 0,
        valuation_method: 'average_cost',
        gl_account_range: '1301-1399',
      }))
    }

    const productIds = productRows.map((product) => product.id)

    let stockRows: ProductStockRow[]
    try {
      const result = await queryPostgres<ProductStockRow>(
        `
          SELECT
            sm.product_id::text AS product_id,
            COALESCE(SUM(sm.quantity), 0) AS stock_qty
          FROM public.stock_movements sm
          WHERE sm.org_id = $1::uuid
            AND sm.product_id = ANY($2::uuid[])
            AND ($3::uuid IS NULL OR sm.branch_id = $3::uuid)
            AND ($4::date IS NULL OR sm.movement_date::date <= $4::date)
          GROUP BY sm.product_id
        `,
        [orgId, productIds, branchId, asOfDate]
      )

      stockRows = result.rows
    } catch {
      return withNoStore(apiError('Gagal mengambil data rekonsiliasi inventory.', 500, { errorCode: 'inventory_reconciliation_fetch_failed' }))
    }

    let ledgerBalance = 0
    try {
      const result = await queryPostgres<LedgerInventoryBalanceRow>(
        `
          SELECT
            COALESCE(SUM(jl.debit - jl.credit), 0) AS gl_inventory_balance
          FROM public.journal_lines jl
          JOIN public.journal_entries je
            ON je.id = jl.entry_id
          JOIN public.accounts a
            ON a.id = jl.account_id
          WHERE je.org_id = $1::uuid
            AND je.status = 'POSTED'
            AND ($2::uuid IS NULL OR je.branch_id = $2::uuid)
            AND ($3::date IS NULL OR je.entry_date <= $3::date)
            AND a.org_id = $1::uuid
            AND a.code >= '1301'
            AND a.code <= '1399'
        `,
        [orgId, branchId, asOfDate]
      )

      ledgerBalance = toSafeNumber(result.rows[0]?.gl_inventory_balance)
    } catch {
      return withNoStore(apiError('Gagal mengambil data rekonsiliasi inventory.', 500, { errorCode: 'inventory_reconciliation_fetch_failed' }))
    }

    const stockByProductId = new Map(stockRows.map((row) => [row.product_id, toSafeNumber(row.stock_qty)]))

    const draftRows = productRows.map((product) => {
      const stockQty = stockByProductId.get(product.id) ?? 0
      const avgCost = toSafeNumber(product.average_cost)
      const onHandValue = stockQty * avgCost
      return {
        product_id: product.id,
        product_code: product.product_code,
        product_name: product.product_name ?? 'Tanpa Nama Produk',
        product_unit: product.product_unit,
        product_category: product.product_category,
        stock_qty: stockQty,
        avg_cost: avgCost,
        on_hand_value: onHandValue,
      }
    })

    const totalOnHandValue = draftRows.reduce((sum, row) => sum + row.on_hand_value, 0)
    const rowsWithLedger = draftRows.map((row) => {
      const allocationRatio = totalOnHandValue > 0 ? row.on_hand_value / totalOnHandValue : 0
      const ledgerValue = ledgerBalance * allocationRatio
      return {
        ...row,
        ledger_value: ledgerValue,
        variance: row.on_hand_value - ledgerValue,
      }
    })

    const filteredRows = varianceOnly
      ? rowsWithLedger.filter((row) => Math.abs(row.variance) > 0.01)
      : rowsWithLedger

    const totalFilteredOnHandValue = filteredRows.reduce((sum, row) => sum + row.on_hand_value, 0)
    const totalFilteredLedgerValue = filteredRows.reduce((sum, row) => sum + row.ledger_value, 0)
    const totalFilteredVariance = filteredRows.reduce((sum, row) => sum + row.variance, 0)

    return withNoStore(apiSuccess(filteredRows.map((row) => ({
      product_id: row.product_id,
      product_code: row.product_code,
      product_name: row.product_name,
      product_unit: row.product_unit,
      product_category: row.product_category,
      stock_qty: row.stock_qty,
      avg_cost: row.avg_cost,
      on_hand_value: row.on_hand_value,
      ledger_value: row.ledger_value,
      variance: row.variance,
    })), {
      org_id: orgId,
      branch_scope: branchId ?? 'all',
      count: filteredRows.length,
      as_of_date: asOfDate,
      on_hand_value: totalFilteredOnHandValue,
      gl_inventory_balance: totalFilteredLedgerValue,
      inventory_variance: totalFilteredVariance,
      valuation_method: 'average_cost',
      gl_account_range: '1301-1399',
    }))
  })()

  void logApiCall({
    orgId: validation.key.orgId,
    apiKeyId: validation.key.keyId,
    method: 'GET',
    endpoint: '/api/v1/inventory/reconciliation',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
