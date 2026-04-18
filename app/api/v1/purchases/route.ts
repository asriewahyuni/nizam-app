/**
 * app/api/v1/purchases/route.ts
 *
 * Open API endpoint untuk data pembelian.
 * GET /api/v1/purchases → daftar purchase order / pembelian (scope: purchases:read)
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

type PurchaseApiRow = {
  id: string
  purchase_number: string | null
  vendor_name: string | null
  total_amount: number | string | null
  status: string | null
  payment_status: string | null
  branch_id: string | null
  purchase_date: string | null
  due_date: string | null
  created_at: string
  item_count: number | string | null
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

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return withNoStore(apiError('API key diperlukan. Sertakan header x-api-key.', 401))

  const validation = await validateApiKey(rawKey, request)
  if (!validation.success) {
    return withNoStore(apiError(validation.error, validation.statusCode, { errorCode: validation.errorCode }))
  }

  if (!requireScope(validation.key, 'purchases:read')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: purchases:read', 403))
  }

  const { orgId, branchId } = validation.key

  const response = await (async () => {
    const { searchParams } = new URL(request.url)
    const limitParam = normalizeLimit(searchParams.get('limit'))
    const status = searchParams.get('status')
    const paymentStatus = searchParams.get('payment_status')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let rows: PurchaseApiRow[]
    try {
      const result = await queryPostgres<PurchaseApiRow>(
        `
          SELECT
            p.id::text AS id,
            p.purchase_number,
            c.name AS vendor_name,
            COALESCE(p.grand_total, p.total_amount, 0) AS total_amount,
            p.status::text AS status,
            p.payment_status::text AS payment_status,
            p.branch_id::text AS branch_id,
            p.purchase_date::text AS purchase_date,
            p.due_date::text AS due_date,
            p.created_at,
            COUNT(pi.id)::int AS item_count
          FROM public.purchases p
          LEFT JOIN public.contacts c
            ON c.id = p.vendor_id
          LEFT JOIN public.purchase_items pi
            ON pi.purchase_id = p.id
          WHERE p.org_id = $1::uuid
            AND ($2::uuid IS NULL OR p.branch_id = $2::uuid)
            AND ($3::text IS NULL OR p.status::text = $3::text)
            AND ($4::text IS NULL OR p.payment_status::text = $4::text)
            AND ($5::date IS NULL OR p.purchase_date >= $5::date)
            AND ($6::date IS NULL OR p.purchase_date <= $6::date)
          GROUP BY
            p.id,
            p.purchase_number,
            c.name,
            p.grand_total,
            p.total_amount,
            p.status,
            p.payment_status,
            p.branch_id,
            p.purchase_date,
            p.due_date,
            p.created_at
          ORDER BY p.purchase_date DESC NULLS LAST, p.created_at DESC
          LIMIT $7::int
        `,
        [orgId, branchId, status, paymentStatus, dateFrom, dateTo, limitParam]
      )

      rows = result.rows
    } catch {
      return withNoStore(apiError('Gagal mengambil data pembelian.', 500))
    }

    const data = rows.map((row) => ({
      id: row.id,
      po_number: row.purchase_number,
      vendor_name: row.vendor_name,
      total_amount: toSafeNumber(row.total_amount),
      status: row.status,
      payment_status: row.payment_status,
      branch_id: row.branch_id,
      purchase_date: row.purchase_date,
      due_date: row.due_date,
      item_count: toSafeNumber(row.item_count),
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
    endpoint: '/api/v1/purchases',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
