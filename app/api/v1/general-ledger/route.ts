/**
 * app/api/v1/general-ledger/route.ts
 *
 * Open API endpoint untuk buku besar umum.
 * GET /api/v1/general-ledger → daftar jurnal posted beserta baris akun (scope: ledger:read)
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

type GeneralLedgerEntryRow = {
  id: string
  entry_number: string | null
  entry_date: string
  description: string | null
  reference_type: string | null
  reference_id: string | null
  status: string | null
  notes: string | null
  posted_at: string | null
  created_at: string
  branch_id: string | null
  total_debit: number | string | null
  total_credit: number | string | null
}

type GeneralLedgerLineRow = {
  id: string
  entry_id: string
  account_id: string | null
  account_code: string | null
  account_name: string | null
  account_type: string | null
  debit: number | string | null
  credit: number | string | null
  memo: string | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

function normalizeLimit(rawLimit: string | null) {
  const parsed = Number.parseInt(rawLimit ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 50
  return Math.min(parsed, 200)
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

function normalizeReferenceType(rawValue: string | null) {
  if (!rawValue) return null
  const normalized = rawValue.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

function normalizeAccountCode(rawValue: string | null) {
  if (!rawValue) return null
  const normalized = rawValue.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
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

  if (!requireScope(validation.key, 'ledger:read')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: ledger:read', 403))
  }

  const { orgId, branchId } = validation.key

  const response = await (async () => {
    const { searchParams } = new URL(request.url)
    const limitParam = normalizeLimit(searchParams.get('limit'))
    const search = searchParams.get('search')?.trim() ?? ''
    const dateFrom = normalizeDateParam(searchParams.get('date_from'))
    const dateTo = normalizeDateParam(searchParams.get('date_to'))
    const accountId = normalizeUuidParam(searchParams.get('account_id'))
    const accountCode = normalizeAccountCode(searchParams.get('account_code'))
    const referenceType = normalizeReferenceType(searchParams.get('reference_type'))

    if (dateFrom === 'invalid') {
      return withNoStore(apiError('Parameter "date_from" harus berformat YYYY-MM-DD.', 400, { errorCode: 'date_from_invalid' }))
    }
    if (dateTo === 'invalid') {
      return withNoStore(apiError('Parameter "date_to" harus berformat YYYY-MM-DD.', 400, { errorCode: 'date_to_invalid' }))
    }
    if (accountId === 'invalid') {
      return withNoStore(apiError('Parameter "account_id" harus berupa UUID valid.', 400, { errorCode: 'account_id_invalid' }))
    }

    let entries: GeneralLedgerEntryRow[]
    try {
      const result = await queryPostgres<GeneralLedgerEntryRow>(
        `
          SELECT
            je.id::text AS id,
            je.entry_number,
            je.entry_date::text AS entry_date,
            je.description,
            je.reference_type::text AS reference_type,
            je.reference_id::text AS reference_id,
            je.status::text AS status,
            je.notes,
            je.posted_at::text AS posted_at,
            je.created_at::text AS created_at,
            je.branch_id::text AS branch_id,
            COALESCE(SUM(jl.debit), 0) AS total_debit,
            COALESCE(SUM(jl.credit), 0) AS total_credit
          FROM public.journal_entries je
          JOIN public.journal_lines jl
            ON jl.entry_id = je.id
          WHERE je.org_id = $1::uuid
            AND je.status = 'POSTED'
            AND ($2::uuid IS NULL OR je.branch_id = $2::uuid)
            AND ($3::date IS NULL OR je.entry_date >= $3::date)
            AND ($4::date IS NULL OR je.entry_date <= $4::date)
            AND ($5::text IS NULL OR UPPER(COALESCE(je.reference_type::text, '')) = $5::text)
            AND (
              $6::text = ''
              OR COALESCE(je.entry_number, '') ILIKE '%' || $6::text || '%'
              OR COALESCE(je.description, '') ILIKE '%' || $6::text || '%'
              OR COALESCE(je.notes, '') ILIKE '%' || $6::text || '%'
            )
            AND (
              ($7::uuid IS NULL AND $8::text IS NULL)
              OR EXISTS (
                SELECT 1
                FROM public.journal_lines fl
                LEFT JOIN public.accounts fa
                  ON fa.id = fl.account_id
                WHERE fl.entry_id = je.id
                  AND (
                    ($7::uuid IS NOT NULL AND fl.account_id = $7::uuid)
                    OR ($8::text IS NOT NULL AND UPPER(COALESCE(fa.code, '')) = $8::text)
                  )
              )
            )
          GROUP BY
            je.id,
            je.entry_number,
            je.entry_date,
            je.description,
            je.reference_type,
            je.reference_id,
            je.status,
            je.notes,
            je.posted_at,
            je.created_at,
            je.branch_id
          ORDER BY je.entry_date DESC, je.created_at DESC
          LIMIT $9::int
        `,
        [orgId, branchId, dateFrom, dateTo, referenceType, search, accountId, accountCode, limitParam]
      )

      entries = result.rows
    } catch {
      return withNoStore(apiError('Gagal mengambil data buku besar.', 500, { errorCode: 'general_ledger_fetch_failed' }))
    }

    if (entries.length === 0) {
      return withNoStore(apiSuccess([], {
        org_id: orgId,
        branch_scope: branchId ?? 'all',
        count: 0,
      }))
    }

    let lines: GeneralLedgerLineRow[] = []
    try {
      const result = await queryPostgres<GeneralLedgerLineRow>(
        `
          SELECT
            jl.id::text AS id,
            jl.entry_id::text AS entry_id,
            jl.account_id::text AS account_id,
            a.code AS account_code,
            a.name AS account_name,
            a.type::text AS account_type,
            jl.debit,
            jl.credit,
            jl.memo
          FROM public.journal_lines jl
          LEFT JOIN public.accounts a
            ON a.id = jl.account_id
          WHERE jl.entry_id = ANY($1::uuid[])
          ORDER BY a.code ASC NULLS LAST, jl.id ASC
        `,
        [entries.map((entry) => entry.id)]
      )

      lines = result.rows
    } catch {
      return withNoStore(apiError('Gagal mengambil data buku besar.', 500, { errorCode: 'general_ledger_fetch_failed' }))
    }

    const linesByEntryId = new Map<string, Array<Record<string, unknown>>>()
    for (const line of lines) {
      const bucket = linesByEntryId.get(line.entry_id) ?? []
      bucket.push({
        id: line.id,
        account_id: line.account_id,
        account_code: line.account_code,
        account_name: line.account_name,
        account_type: line.account_type,
        debit: toSafeNumber(line.debit),
        credit: toSafeNumber(line.credit),
        memo: line.memo,
      })
      linesByEntryId.set(line.entry_id, bucket)
    }

    return withNoStore(apiSuccess(entries.map((entry) => ({
      id: entry.id,
      entry_number: entry.entry_number,
      entry_date: entry.entry_date,
      description: entry.description,
      reference_type: entry.reference_type ? String(entry.reference_type).trim().toUpperCase() : null,
      reference_id: entry.reference_id,
      status: entry.status,
      notes: entry.notes,
      posted_at: entry.posted_at,
      created_at: entry.created_at,
      branch_id: entry.branch_id,
      total_debit: toSafeNumber(entry.total_debit),
      total_credit: toSafeNumber(entry.total_credit),
      journal_lines: linesByEntryId.get(entry.id) ?? [],
    })), {
      org_id: orgId,
      branch_scope: branchId ?? 'all',
      count: entries.length,
    }))
  })()

  void logApiCall({
    orgId: validation.key.orgId,
    apiKeyId: validation.key.keyId,
    method: 'GET',
    endpoint: '/api/v1/general-ledger',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
