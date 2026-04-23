/**
 * app/api/v1/sales/route.ts
 *
 * Open API endpoint untuk data penjualan.
 * GET /api/v1/sales  → daftar invoice/sales order (scope: sales:read)
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

type SalesApiRow = {
  id: string
  sale_number: string | null
  customer_name: string | null
  total_amount: number | string | null
  tax_breakdown: unknown | null
  other_charge_breakdown: unknown | null
  other_charge_amount: number | string | null
  status: string | null
  branch_id: string | null
  order_date: string | null
  created_at: string
}

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

function normalizeLimit(rawLimit: string | null) {
  const parsed = Number.parseInt(rawLimit ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 50
  return Math.min(parsed, 200)
}

function toSafeNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function isSalesAdjustmentColumnMissingError(error: unknown) {
  const message = String((error as { message?: string } | null | undefined)?.message || '').toLowerCase()
  return (
    (
      message.includes('tax_breakdown')
      || message.includes('other_charge_breakdown')
      || message.includes('other_charge_amount')
    ) &&
    (message.includes('column') || message.includes('does not exist'))
  )
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return withNoStore(apiError('API key diperlukan. Sertakan header x-api-key.', 401))

  const validation = await validateApiKey(rawKey, request)
  if (!validation.success) {
    return withNoStore(apiError(validation.error, validation.statusCode, { errorCode: validation.errorCode }))
  }

  if (!requireScope(validation.key, 'sales:read')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: sales:read', 403))
  }

  const { orgId, branchId } = validation.key

  const response = await (async () => {
    const { searchParams } = new URL(request.url)
    const limitParam = normalizeLimit(searchParams.get('limit'))
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let rows: SalesApiRow[]
    try {
      const result = await queryPostgres<SalesApiRow>(
        `
          SELECT
            s.id::text AS id,
            s.sale_number,
            c.name AS customer_name,
            COALESCE(s.grand_total, s.total_amount, 0) AS total_amount,
            s.tax_breakdown,
            s.other_charge_breakdown,
            s.other_charge_amount,
            s.status::text AS status,
            s.branch_id::text AS branch_id,
            s.sale_date::text AS order_date,
            s.created_at
          FROM public.sales s
          LEFT JOIN public.contacts c
            ON c.id = s.customer_id
          WHERE s.org_id = $1::uuid
            AND ($2::uuid IS NULL OR s.branch_id = $2::uuid)
            AND ($3::text IS NULL OR s.status::text = $3::text)
            AND ($4::date IS NULL OR s.sale_date >= $4::date)
            AND ($5::date IS NULL OR s.sale_date <= $5::date)
          ORDER BY s.created_at DESC
          LIMIT $6::int
        `,
        [orgId, branchId, status, dateFrom, dateTo, limitParam]
      )

      rows = result.rows
    } catch (error) {
      if (!isSalesAdjustmentColumnMissingError(error)) {
        return withNoStore(apiError('Gagal mengambil data penjualan.', 500))
      }

      try {
        const fallbackResult = await queryPostgres<
          Omit<SalesApiRow, 'tax_breakdown' | 'other_charge_breakdown' | 'other_charge_amount'>
          & { tax_breakdown?: unknown; other_charge_breakdown?: unknown; other_charge_amount?: unknown }
        >(
          `
            SELECT
              s.id::text AS id,
              s.sale_number,
              c.name AS customer_name,
              COALESCE(s.grand_total, s.total_amount, 0) AS total_amount,
              s.status::text AS status,
              s.branch_id::text AS branch_id,
              s.sale_date::text AS order_date,
              s.created_at
            FROM public.sales s
            LEFT JOIN public.contacts c
              ON c.id = s.customer_id
            WHERE s.org_id = $1::uuid
              AND ($2::uuid IS NULL OR s.branch_id = $2::uuid)
              AND ($3::text IS NULL OR s.status::text = $3::text)
              AND ($4::date IS NULL OR s.sale_date >= $4::date)
              AND ($5::date IS NULL OR s.sale_date <= $5::date)
            ORDER BY s.created_at DESC
            LIMIT $6::int
          `,
          [orgId, branchId, status, dateFrom, dateTo, limitParam]
        )

        rows = fallbackResult.rows.map((row) => ({
          ...row,
          tax_breakdown: null,
          other_charge_breakdown: null,
          other_charge_amount: 0,
        }))
      } catch {
        return withNoStore(apiError('Gagal mengambil data penjualan.', 500))
      }
    }

    const data = rows.map((row) => ({
      id: row.id,
      so_number: row.sale_number,
      customer_name: row.customer_name,
      total_amount: toSafeNumber(row.total_amount),
      tax_breakdown: row.tax_breakdown,
      other_charge_breakdown: row.other_charge_breakdown,
      other_charge_amount: toSafeNumber(row.other_charge_amount),
      status: row.status,
      branch_id: row.branch_id,
      order_date: row.order_date,
      created_at: row.created_at,
    }))

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
    endpoint: '/api/v1/sales',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
