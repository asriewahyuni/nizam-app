/**
 * app/api/v1/cash/route.ts
 *
 * Open API endpoint untuk kas & bank.
 *
 * GET  /api/v1/cash → daftar rekening kas/bank aktif beserta saldo posted
 * POST /api/v1/cash → catat kas masuk/keluar ke bank_transactions
 *
 * POST mendukung pemetaan akun lawan transaksi secara fleksibel agar
 * settlement bisa diarahkan ke pendapatan, beban, piutang, hutang,
 * pajak, diskon, atau biaya lain melalui configuration params maupun
 * override langsung di body request.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { type NextRequest } from 'next/server'
import type { PoolClient } from 'pg'
import {
  validateApiKey,
  requireScope,
  apiError,
  apiSuccess,
  extractApiKeyFromRequest,
  logApiCall,
  extractIpFromRequest,
} from '@/lib/api/validate-key'
import { getPostgresPool, queryPostgres } from '@/lib/db/postgres'
import { deliverWebhook } from '@/lib/api/webhook'

type JsonObject = Record<string, unknown>

type CashAccountApiRow = {
  id: string
  bank_account_id: string | null
  source: 'bank_account' | 'gl_account'
  name: string | null
  account_number: string | null
  bank_name: string | null
  balance: number | string | null
  currency: string | null
  branch_id: string | null
  is_active: boolean
  account_id: string
  account_code: string | null
  account_name: string | null
}

type ApiConfigurationRow = {
  id: string
  branch_id: string | null
  cash_in_account_id: string | null
  cash_out_account_id: string | null
  cash_in_params: JsonObject | null
  cash_out_params: JsonObject | null
}

type BankAccountLookupRow = {
  id: string
  branch_id: string | null
  account_id: string
  bank_name: string | null
  account_number: string | null
  currency: string | null
  is_active: boolean
}

type LiquidAccountLookupRow = {
  id: string
  code: string | null
  name: string | null
  type: string | null
  is_active: boolean
}

type AccountLookupRow = {
  id: string
}

type CashTransactionRow = {
  id: string
  reference_number: string | null
  amount: number | string | null
  description: string
  status: string
  created_at: string
  journal_entry_id: string | null
}

type ManualCashJournalLine = {
  accountId: string
  debit: number
  credit: number
  memo: string | null
  settlementType: SettlementType
}

type CashType = 'in' | 'out'
type SettlementType =
  | 'general'
  | 'revenue'
  | 'expense'
  | 'receivable'
  | 'payable'
  | 'tax'
  | 'discount'
  | 'other_charge'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

function pickString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function pickUuid(value: unknown): string | null {
  return isUuid(value) ? value.trim() : null
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

function toSafeNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function toPositiveNumber(value: unknown) {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0
}

function normalizeDateInput(value: unknown) {
  const raw = pickString(value)
  if (!raw) return new Date().toISOString().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function resolveSettlementType(value: unknown): SettlementType | null {
  const raw = pickString(value)?.toLowerCase()
  if (!raw) return null

  const normalized = raw.replace(/[-\s]+/g, '_')
  if (
    normalized === 'general' ||
    normalized === 'revenue' ||
    normalized === 'expense' ||
    normalized === 'receivable' ||
    normalized === 'payable' ||
    normalized === 'tax' ||
    normalized === 'discount' ||
    normalized === 'other_charge'
  ) {
    return normalized
  }

  if (normalized === 'other' || normalized === 'fee' || normalized === 'other_fee') {
    return 'other_charge'
  }

  return null
}

function resolveRequestBranchId(keyBranchId: string | null, rawBranchId: unknown): RequestBranchResolution {
  const bodyBranchId = pickUuid(rawBranchId)

  if (keyBranchId && bodyBranchId && bodyBranchId !== keyBranchId) {
    return {
      error: 'API key ini dibatasi ke cabang tertentu. branch_id pada body tidak boleh berbeda.',
    }
  }

  const branchId = keyBranchId ?? bodyBranchId
  if (!branchId) {
    return {
      error: 'branch_id diperlukan jika API key tidak di-scope ke cabang tertentu.',
    }
  }

  return { branchId }
}

type RequestBranchResolution =
  | { branchId: string }
  | { error: string }

function resolveAutoPostFlag(params: JsonObject) {
  if (typeof params.auto_post === 'boolean') return params.auto_post
  return true
}

async function loadApiConfiguration(orgId: string, branchId: string | null) {
  const result = await queryPostgres<ApiConfigurationRow>(
    `
      SELECT
        id,
        branch_id,
        cash_in_account_id,
        cash_out_account_id,
        cash_in_params,
        cash_out_params
      FROM public.api_configurations
      WHERE org_id = $1::uuid
        AND (($2::uuid IS NOT NULL AND branch_id = $2::uuid) OR branch_id IS NULL)
      ORDER BY
        CASE WHEN branch_id = $2::uuid THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at DESC
      LIMIT 1
    `,
    [orgId, branchId]
  )

  return result.rows[0] ?? null
}

async function findBankAccountByIdentifier(
  orgId: string,
  branchId: string,
  identifier: string | null
) {
  if (!identifier || !isUuid(identifier)) return null

  const result = await queryPostgres<BankAccountLookupRow>(
    `
      SELECT
        id,
        branch_id,
        account_id,
        bank_name,
        account_number,
        currency,
        is_active
      FROM public.bank_accounts
      WHERE org_id = $1::uuid
        AND branch_id = $2::uuid
        AND is_active = TRUE
        AND (id = $3::uuid OR account_id = $3::uuid)
      ORDER BY CASE WHEN id = $3::uuid THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [orgId, branchId, identifier]
  )

  return result.rows[0] ?? null
}

async function findSingleActiveBankAccount(orgId: string, branchId: string) {
  const result = await queryPostgres<BankAccountLookupRow>(
    `
      SELECT
        id,
        branch_id,
        account_id,
        bank_name,
        account_number,
        currency,
        is_active
      FROM public.bank_accounts
      WHERE org_id = $1::uuid
        AND branch_id = $2::uuid
        AND is_active = TRUE
      ORDER BY bank_name ASC, account_number ASC NULLS LAST
      LIMIT 2
    `,
    [orgId, branchId]
  )

  return result.rows.length === 1 ? result.rows[0] : null
}

async function findLiquidAccountByIdentifier(
  orgId: string,
  identifier: string | null
) {
  if (!identifier || !isUuid(identifier)) return null

  const result = await queryPostgres<LiquidAccountLookupRow>(
    `
      SELECT
        id,
        code,
        name,
        type,
        is_active
      FROM public.accounts
      WHERE org_id = $1::uuid
        AND id = $2::uuid
        AND is_active = TRUE
        AND type = 'ASSET'
        AND code LIKE '11%'
      LIMIT 1
    `,
    [orgId, identifier]
  )

  return result.rows[0] ?? null
}

async function ensureBankAccountBridge(
  orgId: string,
  branchId: string,
  accountId: string | null
) {
  if (!accountId || !isUuid(accountId)) return null

  const existingBridge = await queryPostgres<BankAccountLookupRow>(
    `
      SELECT
        id,
        branch_id,
        account_id,
        bank_name,
        account_number,
        currency,
        is_active
      FROM public.bank_accounts
      WHERE org_id = $1::uuid
        AND account_id = $2::uuid
        AND is_active = TRUE
        AND (branch_id = $3::uuid OR branch_id IS NULL)
      ORDER BY CASE WHEN branch_id = $3::uuid THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [orgId, accountId, branchId]
  )

  if (existingBridge.rows[0]) {
    return existingBridge.rows[0]
  }

  const liquidAccount = await findLiquidAccountByIdentifier(orgId, accountId)
  if (!liquidAccount) return null

  const inserted = await queryPostgres<BankAccountLookupRow>(
    `
      INSERT INTO public.bank_accounts (
        org_id,
        branch_id,
        account_id,
        bank_name,
        account_number,
        account_holder,
        currency,
        is_active
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::text,
        NULL,
        NULL,
        'IDR',
        TRUE
      )
      RETURNING
        id,
        branch_id,
        account_id,
        bank_name,
        account_number,
        currency,
        is_active
    `,
    [
      orgId,
      branchId,
      liquidAccount.id,
      liquidAccount.name ?? liquidAccount.code ?? 'Kas/Bank API',
    ]
  )

  return inserted.rows[0] ?? null
}

async function resolveWriteBankAccount(
  orgId: string,
  branchId: string,
  identifiers: Array<string | null>
) {
  for (const identifier of identifiers) {
    const resolved = await findBankAccountByIdentifier(orgId, branchId, identifier)
    if (resolved) return resolved
  }

  for (const identifier of identifiers) {
    const bridged = await ensureBankAccountBridge(orgId, branchId, identifier)
    if (bridged) return bridged
  }

  return findSingleActiveBankAccount(orgId, branchId)
}

async function assertAccountsExist(orgId: string, accountIds: string[]) {
  if (accountIds.length === 0) return true

  const result = await queryPostgres<AccountLookupRow>(
    `
      SELECT id
      FROM public.accounts
      WHERE org_id = $1::uuid
        AND id = ANY($2::uuid[])
    `,
    [orgId, accountIds]
  )

  return result.rows.length === new Set(accountIds).size
}

async function getPostedAccountBalance(
  orgId: string,
  branchId: string | null,
  accountId: string
) {
  const result = await queryPostgres<{ balance: number | string | null }>(
    `
      SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
      FROM public.journal_entries je
      JOIN public.journal_lines jl
        ON jl.entry_id = je.id
      WHERE je.org_id = $1::uuid
        AND je.status = 'POSTED'
        AND jl.account_id = $2::uuid
        AND ($3::uuid IS NULL OR je.branch_id = $3::uuid)
    `,
    [orgId, accountId, branchId]
  )

  return toSafeNumber(result.rows[0]?.balance)
}

function resolveCounterAccountId(
  type: CashType,
  body: JsonObject,
  params: JsonObject
) {
  const directOverride = [
    pickUuid(body.counter_account_id),
    pickUuid(body.category_id),
    pickUuid(body.settlement_account_id),
  ].find(Boolean) ?? null

  if (directOverride) {
    return {
      accountId: directOverride,
      settlementType: resolveSettlementType(body.settlement_type) ?? 'general',
    }
  }

  const settlementType = resolveSettlementType(body.settlement_type) ?? 'general'

  const bodyBySettlementType: Record<SettlementType, string | null> = {
    general: null,
    revenue: pickUuid(body.revenue_account_id),
    expense: pickUuid(body.expense_account_id),
    receivable: pickUuid(body.receivable_account_id),
    payable: pickUuid(body.payable_account_id),
    tax: pickUuid(body.tax_account_id),
    discount: pickUuid(body.discount_account_id),
    other_charge: pickUuid(body.other_charge_account_id) ?? pickUuid(body.other_fee_account_id),
  }

  const configBySettlementType: Record<SettlementType, string | null> = {
    general: pickUuid(params.counter_account_id),
    revenue: pickUuid(params.revenue_account_id),
    expense: pickUuid(params.expense_account_id),
    receivable: pickUuid(params.receivable_account_id),
    payable: pickUuid(params.payable_account_id),
    tax: pickUuid(params.tax_account_id),
    discount: pickUuid(params.discount_account_id),
    other_charge: pickUuid(params.other_charge_account_id) ?? pickUuid(params.other_fee_account_id),
  }

  const legacyDefault = type === 'in'
    ? pickUuid(params.revenue_account_id)
    : pickUuid(params.expense_account_id)

  const accountId =
    bodyBySettlementType[settlementType] ??
    configBySettlementType[settlementType] ??
    pickUuid(params.counter_account_id) ??
    legacyDefault

  return { accountId, settlementType }
}

function buildMissingCounterAccountMessage(type: CashType, settlementType: SettlementType) {
  const actionLabel = type === 'in' ? 'kas masuk' : 'kas keluar'

  switch (settlementType) {
    case 'receivable':
      return `Akun piutang untuk ${actionLabel} belum dikonfigurasi. Kirim \`receivable_account_id\`, \`category_id\`, atau set \`receivable_account_id\` di konfigurasi API.`
    case 'payable':
      return `Akun hutang untuk ${actionLabel} belum dikonfigurasi. Kirim \`payable_account_id\`, \`category_id\`, atau set \`payable_account_id\` di konfigurasi API.`
    case 'tax':
      return `Akun pajak untuk ${actionLabel} belum dikonfigurasi. Kirim \`tax_account_id\`, \`category_id\`, atau set \`tax_account_id\` di konfigurasi API.`
    case 'discount':
      return `Akun diskon untuk ${actionLabel} belum dikonfigurasi. Kirim \`discount_account_id\`, \`category_id\`, atau set \`discount_account_id\` di konfigurasi API.`
    case 'other_charge':
      return `Akun biaya lain-lain untuk ${actionLabel} belum dikonfigurasi. Kirim \`other_charge_account_id\`, \`category_id\`, atau set \`other_charge_account_id\` di konfigurasi API.`
    default:
      return type === 'in'
        ? 'Akun lawan kas masuk belum dikonfigurasi. Kirim `category_id`/`counter_account_id` atau set `counter_account_id`/`revenue_account_id` di konfigurasi API.'
        : 'Akun lawan kas keluar belum dikonfigurasi. Kirim `category_id`/`counter_account_id` atau set `counter_account_id`/`expense_account_id` di konfigurasi API.'
  }
}

function parseManualJournalLines(
  type: CashType,
  body: JsonObject,
  params: JsonObject
): { lines: ManualCashJournalLine[] } | { error: string } {
  const rawLines = Array.isArray(body.journal_lines) ? body.journal_lines : []
  if (rawLines.length === 0) return { lines: [] }

  const lines: ManualCashJournalLine[] = []

  for (const rawLine of rawLines) {
    const line = asObject(rawLine)
    const explicitAccountId = [
      pickUuid(line.account_id),
      pickUuid(line.counter_account_id),
      pickUuid(line.category_id),
      pickUuid(line.settlement_account_id),
    ].find(Boolean) ?? null
    const counterResolution = resolveCounterAccountId(type, line, params)
    const accountId = explicitAccountId ?? counterResolution.accountId

    if (!accountId) {
      return {
        error: buildMissingCounterAccountMessage(type, counterResolution.settlementType),
      }
    }

    let debit = toPositiveNumber(line.debit)
    let credit = toPositiveNumber(line.credit)

    if (debit === 0 && credit === 0) {
      const amount = toPositiveNumber(line.amount)
      const entry = pickString(line.entry)?.toLowerCase()

      if (amount > 0 && entry === 'debit') {
        debit = amount
      } else if (amount > 0 && entry === 'credit') {
        credit = amount
      }
    }

    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      return {
        error: 'Setiap `journal_lines` wajib memiliki tepat satu sisi: `debit` atau `credit`.',
      }
    }

    lines.push({
      accountId,
      debit,
      credit,
      memo: pickString(line.memo) ?? pickString(line.description),
      settlementType: counterResolution.settlementType,
    })
  }

  return { lines }
}

async function insertCashTransaction(payload: {
  orgId: string
  branchId: string
  bankAccountId: string
  transactionDate: string
  description: string
  amount: number
  type: 'IN' | 'OUT'
  referenceNumber: string | null
  categoryId: string | null
  status: 'POSTED' | 'DRAFT'
}) {
  const result = await queryPostgres<CashTransactionRow>(
    `
      INSERT INTO public.bank_transactions (
        org_id,
        branch_id,
        bank_account_id,
        transaction_date,
        description,
        amount,
        type,
        reference_number,
        category_id,
        status
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::date,
        $5::text,
        $6::numeric,
        $7::text,
        $8::text,
        $9::uuid,
        $10::text
      )
      RETURNING
        id,
        reference_number,
        amount,
        description,
        status,
        created_at,
        journal_entry_id
    `,
    [
      payload.orgId,
      payload.branchId,
      payload.bankAccountId,
      payload.transactionDate,
      payload.description,
      payload.amount,
      payload.type,
      payload.referenceNumber,
      payload.categoryId,
      payload.status,
    ]
  )

  return result.rows[0] ?? null
}

async function insertCashTransactionWithClient(
  client: PoolClient,
  payload: {
    orgId: string
    branchId: string
    bankAccountId: string
    transactionDate: string
    description: string
    amount: number
    type: 'IN' | 'OUT'
    referenceNumber: string | null
    categoryId: string | null
    status: 'POSTED' | 'DRAFT'
  }
) {
  const result = await client.query<CashTransactionRow>(
    `
      INSERT INTO public.bank_transactions (
        org_id,
        branch_id,
        bank_account_id,
        transaction_date,
        description,
        amount,
        type,
        reference_number,
        category_id,
        status
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::date,
        $5::text,
        $6::numeric,
        $7::text,
        $8::text,
        $9::uuid,
        $10::text
      )
      RETURNING
        id,
        reference_number,
        amount,
        description,
        status,
        created_at,
        journal_entry_id
    `,
    [
      payload.orgId,
      payload.branchId,
      payload.bankAccountId,
      payload.transactionDate,
      payload.description,
      payload.amount,
      payload.type,
      payload.referenceNumber,
      payload.categoryId,
      payload.status,
    ]
  )

  return result.rows[0] ?? null
}

async function createManualJournalForCashTransaction(
  client: PoolClient,
  payload: {
    orgId: string
    branchId: string
    transactionDate: string
    description: string
    cashTransactionId: string
    type: 'IN' | 'OUT'
    lines: ManualCashJournalLine[]
    primaryCounterAccountId: string | null
  }
) {
  const referenceType = payload.type === 'IN' ? 'CASH_IN' : 'CASH_OUT'

  const entryResult = await client.query<{ id: string }>(
    `
      INSERT INTO public.journal_entries (
        org_id,
        branch_id,
        entry_date,
        description,
        reference_type,
        reference_id,
        status,
        is_auto
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::date,
        $4::text,
        $5::journal_reference_type,
        $6::uuid,
        'POSTED',
        TRUE
      )
      RETURNING id
    `,
    [
      payload.orgId,
      payload.branchId,
      payload.transactionDate,
      payload.description,
      referenceType,
      payload.cashTransactionId,
    ]
  )

  const journalEntryId = entryResult.rows[0]?.id
  if (!journalEntryId) {
    throw new Error('Gagal membuat jurnal kas manual.')
  }

  for (const line of payload.lines) {
    await client.query(
      `
        INSERT INTO public.journal_lines (
          entry_id,
          account_id,
          debit,
          credit,
          memo
        ) VALUES (
          $1::uuid,
          $2::uuid,
          $3::numeric,
          $4::numeric,
          $5::text
        )
      `,
      [
        journalEntryId,
        line.accountId,
        line.debit,
        line.credit,
        line.memo,
      ]
    )
  }

  await client.query(
    `
      UPDATE public.bank_transactions
      SET journal_entry_id = $2::uuid,
          category_id = $3::uuid
      WHERE id = $1::uuid
    `,
    [payload.cashTransactionId, journalEntryId, payload.primaryCounterAccountId]
  )

  return journalEntryId
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/cash — daftar rekening kas/bank aktif + saldo posted
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return withNoStore(apiError('API key diperlukan. Sertakan header x-api-key.', 401))

  const validation = await validateApiKey(rawKey)
  if (!validation.success) return withNoStore(apiError(validation.error, validation.statusCode))

  if (!requireScope(validation.key, 'cash:read')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: cash:read', 403))
  }

  const { orgId, branchId } = validation.key

  const response = await (async () => {
  let rows: CashAccountApiRow[]
  try {
    const result = await queryPostgres<CashAccountApiRow>(
      `
        WITH posted_balances AS (
          SELECT
            jl.account_id::text AS account_id,
            COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
          FROM public.journal_entries je
          JOIN public.journal_lines jl
            ON jl.entry_id = je.id
          WHERE je.org_id = $1::uuid
            AND je.status = 'POSTED'
            AND ($2::uuid IS NULL OR je.branch_id = $2::uuid)
          GROUP BY jl.account_id
        ),
        bank_rows AS (
          SELECT
            ba.id::text AS id,
            ba.id::text AS bank_account_id,
            'bank_account'::text AS source,
            COALESCE(acc.name, ba.bank_name) AS name,
            ba.account_number,
            ba.bank_name,
            COALESCE(pb.balance, 0) AS balance,
            ba.currency,
            ba.branch_id::text AS branch_id,
            ba.is_active,
            ba.account_id::text AS account_id,
            acc.code AS account_code,
            acc.name AS account_name
          FROM public.bank_accounts ba
          LEFT JOIN public.accounts acc
            ON acc.id = ba.account_id
           AND acc.org_id = ba.org_id
          LEFT JOIN posted_balances pb
            ON pb.account_id = ba.account_id::text
          WHERE ba.org_id = $1::uuid
            AND ba.is_active = TRUE
            AND ($2::uuid IS NULL OR ba.branch_id = $2::uuid)
        ),
        gl_rows AS (
          SELECT
            acc.id::text AS id,
            NULL::text AS bank_account_id,
            'gl_account'::text AS source,
            acc.name AS name,
            NULL::text AS account_number,
            acc.name AS bank_name,
            COALESCE(pb.balance, 0) AS balance,
            'IDR'::text AS currency,
            $2::text AS branch_id,
            acc.is_active,
            acc.id::text AS account_id,
            acc.code AS account_code,
            acc.name AS account_name
          FROM public.accounts acc
          LEFT JOIN posted_balances pb
            ON pb.account_id = acc.id::text
          WHERE acc.org_id = $1::uuid
            AND acc.is_active = TRUE
            AND acc.type = 'ASSET'
            AND acc.code LIKE '11%'
            AND NOT EXISTS (
              SELECT 1
              FROM public.bank_accounts ba
              WHERE ba.org_id = acc.org_id
                AND ba.account_id = acc.id
                AND ba.is_active = TRUE
                AND ($2::uuid IS NULL OR ba.branch_id = $2::uuid)
            )
        )
        SELECT * FROM bank_rows
        UNION ALL
        SELECT * FROM gl_rows
        ORDER BY
          name ASC,
          bank_name ASC NULLS LAST,
          account_number ASC NULLS LAST
      `,
      [orgId, branchId]
    )

    rows = result.rows
  } catch {
    return withNoStore(apiError('Gagal mengambil data rekening.', 500))
  }

  const data = rows.map((row) => ({
    id: row.id,
    bank_account_id: row.bank_account_id,
    source: row.source,
    name: row.name ?? row.bank_name ?? row.account_name ?? 'Rekening Kas/Bank',
    account_number: row.account_number,
    bank_name: row.bank_name,
    balance: toSafeNumber(row.balance),
    currency: row.currency ?? 'IDR',
    branch_id: row.branch_id,
    is_active: row.is_active,
    account_id: row.account_id,
    account_code: row.account_code,
    account_name: row.account_name,
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
    endpoint: '/api/v1/cash',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/cash — catat kas masuk/keluar ke bank_transactions
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return withNoStore(apiError('API key diperlukan.', 401))

  const validation = await validateApiKey(rawKey)
  if (!validation.success) return withNoStore(apiError(validation.error, validation.statusCode))

  if (!requireScope(validation.key, 'cash:write')) {
    return withNoStore(apiError('Scope tidak mencukupi. Diperlukan: cash:write', 403))
  }

  const response = await (async () => {
  let body: JsonObject
  try {
    body = asObject(await request.json())
  } catch {
    return withNoStore(apiError('Request body harus berformat JSON valid.', 400))
  }

  const type = pickString(body.type)?.toLowerCase()
  if (type !== 'in' && type !== 'out') {
    return withNoStore(apiError('Field "type" harus berisi "in" atau "out".', 400))
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return withNoStore(apiError('Field "amount" harus angka positif.', 400))
  }

  const branchResolution = resolveRequestBranchId(validation.key.branchId, body.branch_id)
  if ('error' in branchResolution) return withNoStore(apiError(branchResolution.error, 400))

  const branchId = branchResolution.branchId
  const config = await loadApiConfiguration(validation.key.orgId, branchId)
  const params = asObject(type === 'in' ? config?.cash_in_params : config?.cash_out_params)

  const description = pickString(body.description) ?? pickString(params.default_description)
  if (!description) {
    return withNoStore(apiError('Field "description" wajib diisi.', 400))
  }

  const transactionDate = normalizeDateInput(body.transaction_date)
  if (!transactionDate) {
    return withNoStore(apiError('Field "transaction_date" tidak valid. Gunakan format YYYY-MM-DD atau ISO date.', 400))
  }

  const autoPost = resolveAutoPostFlag(params)
  const defaultCashAccountId = type === 'in'
    ? pickUuid(config?.cash_in_account_id)
    : pickUuid(config?.cash_out_account_id)

  const manualJournalLinesResolution = parseManualJournalLines(type, body, params)
  if ('error' in manualJournalLinesResolution) {
    return withNoStore(apiError(manualJournalLinesResolution.error, 422))
  }

  const manualJournalLines = manualJournalLinesResolution.lines
  const usesManualJournalLines = manualJournalLines.length > 0

  if (usesManualJournalLines && !autoPost) {
    return withNoStore(apiError(
      'Field `journal_lines` hanya didukung ketika `auto_post` aktif.',
      422
    ))
  }

  const bankAccount = await resolveWriteBankAccount(
    validation.key.orgId,
    branchId,
    [
      pickUuid(body.bank_account_id),
      pickUuid(body.account_id),
      defaultCashAccountId,
    ]
  )

  if (!bankAccount) {
    return withNoStore(apiError(
      type === 'in'
        ? 'Rekening kas/bank tujuan tidak ditemukan. Kirim `bank_account_id`, `account_id` akun kas/bank (11xx), atau set `cash_in_account_id` pada konfigurasi API.'
        : 'Rekening kas/bank sumber tidak ditemukan. Kirim `bank_account_id`, `account_id` akun kas/bank (11xx), atau set `cash_out_account_id` pada konfigurasi API.',
      422
    ))
  }

  const counterResolution = resolveCounterAccountId(type, body, params)
  const simpleCounterAccountId = counterResolution.accountId

  if (autoPost && !usesManualJournalLines && !simpleCounterAccountId) {
    return withNoStore(apiError(
      buildMissingCounterAccountMessage(type, counterResolution.settlementType),
      422
    ))
  }

  const manualCounterAccountIds = manualJournalLines.map((line) => line.accountId)
  const allCounterAccountIds = usesManualJournalLines
    ? Array.from(new Set(manualCounterAccountIds))
    : (simpleCounterAccountId ? [simpleCounterAccountId] : [])

  if (allCounterAccountIds.some((accountId) => accountId === bankAccount.account_id)) {
    return withNoStore(apiError('Akun lawan transaksi tidak boleh sama dengan akun kas/bank.', 400))
  }

  if (allCounterAccountIds.length > 0) {
    const accountExists = await assertAccountsExist(validation.key.orgId, allCounterAccountIds)
    if (!accountExists) {
      return withNoStore(apiError('Salah satu akun lawan transaksi tidak ditemukan pada organisasi ini.', 422))
    }
  }

  if (usesManualJournalLines && type === 'out') {
    const availableBalance = await getPostedAccountBalance(
      validation.key.orgId,
      branchId,
      bankAccount.account_id
    )

    if (availableBalance + 0.0001 < amount) {
      return withNoStore(apiError(
        `Saldo kas tidak mencukupi. Saldo posted ${availableBalance} lebih kecil dari transaksi ${amount}.`,
        422
      ))
    }
  }

  const reference = pickString(body.reference)
  const transactionType = type === 'in' ? 'IN' : 'OUT'
  const status = autoPost ? 'POSTED' : 'DRAFT'
  const primaryCounterAccountId = usesManualJournalLines
    ? manualJournalLines.find((line) => line.accountId !== bankAccount.account_id)?.accountId ?? null
    : simpleCounterAccountId

  let cashTransaction: CashTransactionRow | null = null

  if (usesManualJournalLines) {
    const bankJournalLine: ManualCashJournalLine = {
      accountId: bankAccount.account_id,
      debit: type === 'in' ? amount : 0,
      credit: type === 'out' ? amount : 0,
      memo: description,
      settlementType: 'general',
    }

    const journalLines = [bankJournalLine, ...manualJournalLines]
    const totalDebit = journalLines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = journalLines.reduce((sum, line) => sum + line.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return withNoStore(apiError(
        '`journal_lines` + akun kas/bank harus balance pada debit/kredit.',
        422
      ))
    }

    const client = await getPostgresPool().connect()
    try {
      await client.query('BEGIN')

      cashTransaction = await insertCashTransactionWithClient(client, {
        orgId: validation.key.orgId,
        branchId,
        bankAccountId: bankAccount.id,
        transactionDate,
        description,
        amount,
        type: transactionType,
        referenceNumber: reference,
        categoryId: null,
        status,
      })

      if (!cashTransaction) {
        throw new Error(
          type === 'in'
            ? 'Gagal mencatat transaksi kas masuk.'
            : 'Gagal mencatat transaksi kas keluar.'
        )
      }

      const journalEntryId = await createManualJournalForCashTransaction(client, {
        orgId: validation.key.orgId,
        branchId,
        transactionDate,
        description,
        cashTransactionId: cashTransaction.id,
        type: transactionType,
        lines: journalLines,
        primaryCounterAccountId,
      })

      await client.query('COMMIT')
      cashTransaction = {
        ...cashTransaction,
        journal_entry_id: journalEntryId,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      const message = error instanceof Error ? error.message : String(error)
      const detail = (error as any)?.detail ?? ''
      const hint = (error as any)?.hint ?? ''
      console.error('[POST /api/v1/cash] manual journal error:', message, detail, hint)
      if (message.toLowerCase().includes('saldo kas tidak mencukupi')) {
        return withNoStore(apiError(message, 422))
      }
      const isDev = process.env.NODE_ENV !== 'production'
      return withNoStore(apiError(
        type === 'in'
          ? 'Gagal mencatat transaksi kas masuk.'
          : 'Gagal mencatat transaksi kas keluar.',
        500,
        isDev ? { debug: message, detail, hint } : undefined
      ))
    } finally {
      client.release()
    }
  } else {
    try {
      cashTransaction = await insertCashTransaction({
        orgId: validation.key.orgId,
        branchId,
        bankAccountId: bankAccount.id,
        transactionDate,
        description,
        amount,
        type: transactionType,
        referenceNumber: reference,
        categoryId: primaryCounterAccountId,
        status,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const detail = (error as any)?.detail ?? ''
      console.error('[POST /api/v1/cash] simple insert error:', message, detail)
      if (message.toLowerCase().includes('saldo kas tidak mencukupi')) {
        return withNoStore(apiError(message, 422))
      }
      const isDev = process.env.NODE_ENV !== 'production'
      return withNoStore(apiError(
        type === 'in'
          ? 'Gagal mencatat transaksi kas masuk.'
          : 'Gagal mencatat transaksi kas keluar.',
        500,
        isDev ? { debug: message, detail } : undefined
      ))
    }
  }

  if (!cashTransaction) {
    return withNoStore(apiError(
      type === 'in'
        ? 'Gagal mencatat transaksi kas masuk.'
        : 'Gagal mencatat transaksi kas keluar.',
      500
    ))
  }

  void deliverWebhook(validation.key.orgId, branchId, type === 'in' ? 'cash_in' : 'cash_out', {
    transaction_id: cashTransaction.id,
    bank_account_id: bankAccount.id,
    bank_gl_account_id: bankAccount.account_id,
    counter_account_id: primaryCounterAccountId,
    settlement_type: counterResolution.settlementType,
    amount,
    description,
    reference,
    status: cashTransaction.status,
    transaction_date: transactionDate,
  })

  return withNoStore(apiSuccess({
    id: cashTransaction.id,
    reference_number: cashTransaction.reference_number,
    amount: toSafeNumber(cashTransaction.amount),
    description: cashTransaction.description,
    status: cashTransaction.status,
    created_at: cashTransaction.created_at,
    journal_entry_id: cashTransaction.journal_entry_id,
    bank_account_id: bankAccount.id,
    category_id: primaryCounterAccountId,
    transaction_date: transactionDate,
  }, {
    type: type === 'in' ? 'cash_in' : 'cash_out',
    auto_post: autoPost,
    settlement_type: counterResolution.settlementType,
  }))
  })()

  void logApiCall({
    orgId: validation.key.orgId,
    apiKeyId: validation.key.keyId,
    method: 'POST',
    endpoint: '/api/v1/cash',
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    ipAddress: extractIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
  })

  return response
}
