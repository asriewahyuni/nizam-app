/**
 * app/api/v1/sales/[saleId]/route.ts
 *
 * Open API endpoint untuk detail penjualan.
 * GET /api/v1/sales/:saleId → detail penjualan + line items + payment/return summary (scope: sales:read)
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

type RouteContext = {
  params: Promise<{ saleId: string }> | { saleId: string }
}

type SaleHeaderRow = {
  id: string
  sale_number: string | null
  customer_id: string | null
  customer_name: string | null
  total_amount: number | string | null
  tax_amount: number | string | null
  discount_amount: number | string | null
  grand_total: number | string | null
  status: string | null
  payment_status: string | null
  branch_id: string | null
  branch_name: string | null
  warehouse_id: string | null
  warehouse_name: string | null
  sale_date: string | null
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type SaleItemRow = {
  id: string
  product_id: string | null
  description: string | null
  quantity: number | string | null
  unit_price: number | string | null
  discount_amount: number | string | null
  tax_amount: number | string | null
  total_amount: number | string | null
  branch_id: string | null
  product_name: string | null
  sku: string | null
  unit: string | null
  product_type: string | null
}

type SalePaymentRow = {
  id: string
  account_id: string | null
  account_code: string | null
  account_name: string | null
  payment_date: string | null
  amount: number | string | null
  discount_amount: number | string | null
  payment_number: string | null
  notes: string | null
  created_at: string
}

type SaleReturnRow = {
  id: string
  return_number: string | null
  return_date: string | null
  total_amount: number | string | null
  tax_amount: number | string | null
  grand_total: number | string | null
  status: string | null
  notes: string | null
  created_at: string
}

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

function toSafeNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export async function GET(request: NextRequest, context: RouteContext) {
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

  const { saleId } = await Promise.resolve(context.params)
  if (!saleId?.trim()) {
    return withNoStore(apiError('Parameter saleId wajib diisi.', 400, { errorCode: 'sale_id_missing' }))
  }

  const { orgId, branchId } = validation.key

  const response = await (async () => {
    let sale: SaleHeaderRow | null = null
    try {
      const saleResult = await queryPostgres<SaleHeaderRow>(
        `
          SELECT
            s.id::text AS id,
            s.sale_number,
            s.customer_id::text AS customer_id,
            c.name AS customer_name,
            s.total_amount,
            s.tax_amount,
            s.discount_amount,
            s.grand_total,
            s.status::text AS status,
            s.payment_status::text AS payment_status,
            s.branch_id::text AS branch_id,
            b.name AS branch_name,
            s.warehouse_id::text AS warehouse_id,
            w.name AS warehouse_name,
            s.sale_date::text AS sale_date,
            s.due_date::text AS due_date,
            s.notes,
            s.created_at,
            s.updated_at
          FROM public.sales s
          LEFT JOIN public.contacts c
            ON c.id = s.customer_id
          LEFT JOIN public.branches b
            ON b.id = s.branch_id
          LEFT JOIN public.warehouses w
            ON w.id = s.warehouse_id
          WHERE s.org_id = $1::uuid
            AND s.id = $2::uuid
            AND ($3::uuid IS NULL OR s.branch_id = $3::uuid)
          LIMIT 1
        `,
        [orgId, saleId, branchId]
      )

      sale = saleResult.rows[0] ?? null
    } catch {
      return withNoStore(apiError('Gagal mengambil data penjualan.', 500))
    }

    if (!sale) {
      return withNoStore(apiError('Data penjualan tidak ditemukan.', 404, { errorCode: 'sales_not_found' }))
    }

    try {
      const [itemsResult, paymentsResult, returnsResult] = await Promise.all([
        queryPostgres<SaleItemRow>(
          `
            SELECT
              si.id::text AS id,
              si.product_id::text AS product_id,
              si.description,
              si.quantity,
              si.unit_price,
              si.discount_amount,
              si.tax_amount,
              si.total_amount,
              si.branch_id::text AS branch_id,
              p.name AS product_name,
              p.sku,
              p.unit,
              p.type::text AS product_type
            FROM public.sales_items si
            LEFT JOIN public.products p
              ON p.id = si.product_id
            WHERE si.org_id = $1::uuid
              AND si.sale_id = $2::uuid
            ORDER BY si.created_at ASC, si.id ASC
          `,
          [orgId, saleId]
        ),
        queryPostgres<SalePaymentRow>(
          `
            SELECT
              sp.id::text AS id,
              sp.account_id::text AS account_id,
              a.code AS account_code,
              a.name AS account_name,
              sp.payment_date::text AS payment_date,
              sp.amount,
              sp.discount_amount,
              sp.payment_number,
              sp.notes,
              sp.created_at
            FROM public.sales_payments sp
            LEFT JOIN public.accounts a
              ON a.id = sp.account_id
            WHERE sp.org_id = $1::uuid
              AND sp.sale_id = $2::uuid
            ORDER BY sp.payment_date DESC NULLS LAST, sp.created_at DESC
          `,
          [orgId, saleId]
        ),
        queryPostgres<SaleReturnRow>(
          `
            SELECT
              sr.id::text AS id,
              sr.return_number,
              sr.return_date::text AS return_date,
              sr.total_amount,
              sr.tax_amount,
              sr.grand_total,
              sr.status::text AS status,
              sr.notes,
              sr.created_at
            FROM public.sales_returns sr
            WHERE sr.org_id = $1::uuid
              AND sr.sale_id = $2::uuid
            ORDER BY sr.return_date DESC NULLS LAST, sr.created_at DESC
          `,
          [orgId, saleId]
        ),
      ])

      const data = {
        id: sale.id,
        so_number: sale.sale_number,
        customer_id: sale.customer_id,
        customer_name: sale.customer_name,
        total_amount: toSafeNumber(sale.total_amount),
        tax_amount: toSafeNumber(sale.tax_amount),
        discount_amount: toSafeNumber(sale.discount_amount),
        grand_total: toSafeNumber(sale.grand_total),
        status: sale.status,
        payment_status: sale.payment_status,
        branch_id: sale.branch_id,
        branch_name: sale.branch_name,
        warehouse_id: sale.warehouse_id,
        warehouse_name: sale.warehouse_name,
        order_date: sale.sale_date,
        due_date: sale.due_date,
        notes: sale.notes,
        created_at: sale.created_at,
        updated_at: sale.updated_at,
        items: itemsResult.rows.map((row) => ({
          id: row.id,
          product_id: row.product_id,
          description: row.description,
          quantity: toSafeNumber(row.quantity),
          unit_price: toSafeNumber(row.unit_price),
          discount_amount: toSafeNumber(row.discount_amount),
          tax_amount: toSafeNumber(row.tax_amount),
          total_amount: toSafeNumber(row.total_amount),
          branch_id: row.branch_id,
          product_name: row.product_name,
          sku: row.sku,
          unit: row.unit,
          product_type: row.product_type,
        })),
        payments: paymentsResult.rows.map((row) => ({
          id: row.id,
          account_id: row.account_id,
          account_code: row.account_code,
          account_name: row.account_name,
          payment_date: row.payment_date,
          amount: toSafeNumber(row.amount),
          discount_amount: toSafeNumber(row.discount_amount),
          payment_number: row.payment_number,
          notes: row.notes,
          created_at: row.created_at,
        })),
        returns: returnsResult.rows.map((row) => ({
          id: row.id,
          return_number: row.return_number,
          return_date: row.return_date,
          total_amount: toSafeNumber(row.total_amount),
          tax_amount: toSafeNumber(row.tax_amount),
          grand_total: toSafeNumber(row.grand_total),
          status: row.status,
          notes: row.notes,
          created_at: row.created_at,
        })),
      }

      return withNoStore(apiSuccess(data, {
        org_id: orgId,
        branch_scope: branchId ?? 'all',
      }))
    } catch {
      return withNoStore(apiError('Gagal mengambil data penjualan.', 500))
    }
  })()

  void logApiCall({
    orgId: validation.key.orgId,
    apiKeyId: validation.key.keyId,
    method: 'GET',
    endpoint: '/api/v1/sales/:saleId',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
