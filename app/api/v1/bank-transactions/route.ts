/**
 * app/api/v1/bank-transactions/route.ts
 *
 * Open API endpoint untuk mutasi kas/bank.
 * GET /api/v1/bank-transactions → daftar transaksi kas/bank (scope: bank_transactions:read)
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

type BankTransactionApiRow = {
  id: string
  bank_account_id: string | null
  cash_account_id: string | null
  cash_account_code: string | null
  cash_account_name: string | null
  bank_name: string | null
  account_number: string | null
  transaction_date: string | null
  description: string | null
  amount: number | string | null
  type: string | null
  reference_number: string | null
  status: string | null
  category_id: string | null
  category_code: string | null
  category_name: string | null
  journal_entry_id: string | null
  branch_id: string | null
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

function normalizeTypeFilter(rawType: string | null) {
  if (!rawType) return null
  const normalized = rawType.trim().toUpperCase()
  if (normalized === 'IN' || normalized === 'OUT') return normalized
  if (normalized === 'INCOME') return 'IN'
  if (normalized === 'EXPENSE') return 'OUT'
  if (normalized === 'MASUK') return 'IN'
  if (normalized === 'KELUAR') return 'OUT'
  return normalized
}

function normalizeTransactionType(value: string | null) {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'IN') return 'in'
  if (normalized === 'OUT') return 'out'
  return normalized.toLowerCase()
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

  if (!requireScope(validation.key, 'bank_transactions:read')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: bank_transactions:read', 403))
  }

  const { orgId, branchId } = validation.key

  const response = await (async () => {
    const { searchParams } = new URL(request.url)
    const limitParam = normalizeLimit(searchParams.get('limit'))
    const type = normalizeTypeFilter(searchParams.get('type'))
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const search = searchParams.get('search')?.trim() ?? ''

    let rows: BankTransactionApiRow[]
    try {
      const result = await queryPostgres<BankTransactionApiRow>(
        `
          SELECT
            bt.id::text AS id,
            bt.bank_account_id::text AS bank_account_id,
            ba.account_id::text AS cash_account_id,
            cash_account.code AS cash_account_code,
            cash_account.name AS cash_account_name,
            ba.bank_name,
            ba.account_number,
            bt.transaction_date::text AS transaction_date,
            bt.description,
            bt.amount,
            bt.type::text AS type,
            bt.reference_number,
            bt.status::text AS status,
            bt.category_id::text AS category_id,
            category_account.code AS category_code,
            category_account.name AS category_name,
            bt.journal_entry_id::text AS journal_entry_id,
            bt.branch_id::text AS branch_id,
            bt.created_at
          FROM public.bank_transactions bt
          LEFT JOIN public.bank_accounts ba
            ON ba.id = bt.bank_account_id
          LEFT JOIN public.accounts cash_account
            ON cash_account.id = ba.account_id
          LEFT JOIN public.accounts category_account
            ON category_account.id = bt.category_id
          WHERE bt.org_id = $1::uuid
            AND ($2::uuid IS NULL OR bt.branch_id = $2::uuid)
            AND ($3::text IS NULL OR bt.type::text = $3::text)
            AND ($4::text IS NULL OR bt.status::text = $4::text)
            AND ($5::date IS NULL OR bt.transaction_date >= $5::date)
            AND ($6::date IS NULL OR bt.transaction_date <= $6::date)
            AND (
              $7::text = ''
              OR COALESCE(bt.description, '') ILIKE '%' || $7::text || '%'
              OR COALESCE(bt.reference_number, '') ILIKE '%' || $7::text || '%'
            )
          ORDER BY bt.transaction_date DESC NULLS LAST, bt.created_at DESC
          LIMIT $8::int
        `,
        [orgId, branchId, type, status, dateFrom, dateTo, search, limitParam]
      )

      rows = result.rows
    } catch {
      return withNoStore(apiError('Gagal mengambil data transaksi bank.', 500))
    }

    const data = rows.map((row) => ({
      id: row.id,
      bank_account_id: row.bank_account_id,
      cash_account_id: row.cash_account_id,
      cash_account_code: row.cash_account_code,
      cash_account_name: row.cash_account_name,
      bank_name: row.bank_name,
      account_number: row.account_number,
      description: row.description,
      amount: toSafeNumber(row.amount),
      type: normalizeTransactionType(row.type),
      reference_number: row.reference_number,
      status: row.status,
      category_id: row.category_id,
      category_code: row.category_code,
      category_name: row.category_name,
      journal_entry_id: row.journal_entry_id,
      branch_id: row.branch_id,
      transaction_date: row.transaction_date,
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
    endpoint: '/api/v1/bank-transactions',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
