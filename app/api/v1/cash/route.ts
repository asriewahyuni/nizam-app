/**
 * app/api/v1/cash/route.ts
 *
 * Open API endpoint untuk kas & bank.
 *
 * GET  /api/v1/cash            → daftar rekening + saldo (scope: cash:read)
 * POST /api/v1/cash/in         → catat penerimaan kas (scope: cash:write)
 * POST /api/v1/cash/out        → catat pengeluaran kas (scope: cash:write)
 *
 * Semua request memerlukan header:
 *   x-api-key: nzm_live_xxxxxxxxxxxxxxxxxxxxxxxx
 */

import { type NextRequest } from 'next/server'
import {
  validateApiKey,
  requireScope,
  apiError,
  apiSuccess,
  extractApiKeyFromRequest,
} from '@/lib/api/validate-key'
import { createAdminClient } from '@/lib/supabase/server'
import { deliverWebhook } from '@/lib/api/webhook'

// ─────────────────────────────────────────────────────────────
// GET /api/v1/cash — Daftar rekening + saldo
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return apiError('API key diperlukan. Sertakan header x-api-key.', 401)

  const validation = await validateApiKey(rawKey)
  if (!validation.success) return apiError(validation.error, validation.statusCode)

  if (!requireScope(validation.key, 'cash:read')) {
    return apiError('Scope tidak mencukupi. Diperlukan: cash:read', 403)
  }

  const { orgId, branchId } = validation.key

  let admin: Awaited<ReturnType<typeof createAdminClient>>
  try {
    admin = await createAdminClient()
  } catch {
    return apiError('Server error.', 500)
  }

  // Fetch bank accounts with balances
  const { data: accounts, error } = await (admin as any)
    .from('bank_accounts')
    .select('id, name, account_number, bank_name, balance, currency, branch_id, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return apiError('Gagal mengambil data rekening.', 500)

  // Filter by branch if key is scoped
  const filteredAccounts = branchId
    ? (accounts || []).filter((a: any) => a.branch_id === branchId || a.branch_id === null)
    : (accounts || [])

  return apiSuccess(filteredAccounts, { 
    org_id: orgId,
    branch_scope: branchId ?? 'all',
    count: filteredAccounts.length 
  })
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/cash — Route ke cash-in atau cash-out
// Body harus ada: { "type": "in" | "out", ... }
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) return apiError('API key diperlukan.', 401)

  const validation = await validateApiKey(rawKey)
  if (!validation.success) return apiError(validation.error, validation.statusCode)

  if (!requireScope(validation.key, 'cash:write')) {
    return apiError('Scope tidak mencukupi. Diperlukan: cash:write', 403)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return apiError('Request body harus berformat JSON valid.', 400)
  }

  const type = body.type as string
  if (type === 'in') return handleCashIn(validation.key, body)
  if (type === 'out') return handleCashOut(validation.key, body)

  return apiError('Field "type" harus berisi "in" atau "out".', 400)
}

// ─────────────────────────────────────────────────────────────
// Handler: cash-in
// ─────────────────────────────────────────────────────────────
async function handleCashIn(
  key: { orgId: string; branchId: string | null },
  body: Record<string, unknown>
): Promise<Response> {
  const amount = Number(body.amount)
  if (!amount || amount <= 0) return apiError('Field "amount" harus angka positif.', 400)
  if (!body.description) return apiError('Field "description" wajib diisi.', 400)

  let admin: Awaited<ReturnType<typeof createAdminClient>>
  try {
    admin = await createAdminClient()
  } catch {
    return apiError('Server error.', 500)
  }

  // Load api_configuration for account mapping
  const { data: config } = await (admin as any)
    .from('api_configurations')
    .select('cash_in_account_id, cash_in_params')
    .eq('org_id', key.orgId)
    .or(`branch_id.eq.${key.branchId ?? 'null'},branch_id.is.null`)
    .order('branch_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  const cashInAccountId = (body.account_id as string) || config?.cash_in_account_id
  if (!cashInAccountId) {
    return apiError('Akun kas penerima belum dikonfigurasi. Set cash_in_account_id di pengaturan API.', 422)
  }

  const params = config?.cash_in_params ?? {}
  const autoPost = Boolean(params.auto_post ?? false)
  const description = String(body.description)
  const reference = body.reference as string | undefined
  const branchId = (body.branch_id as string) || key.branchId

  // Determine which branch to use for the cash transaction
  if (!branchId) {
    return apiError('branch_id diperlukan jika API key tidak di-scope ke cabang tertentu.', 400)
  }

  // Insert cash_transactions record
  const cashInsert: Record<string, unknown> = {
    org_id: key.orgId,
    branch_id: branchId,
    type: 'in',
    amount,
    description,
    account_id: cashInAccountId,
    status: autoPost ? 'posted' : 'draft',
    source: 'api',
  }
  if (reference) cashInsert.reference = reference

  const { data: cashTx, error: cashError } = await (admin as any)
    .from('cash_transactions')
    .insert(cashInsert)
    .select('id, reference_number, amount, description, status, created_at')
    .maybeSingle()

  if (cashError || !cashTx) {
    return apiError(cashError?.message || 'Gagal mencatat transaksi kas masuk.', 500)
  }

  // Fire webhook (non-blocking)
  void deliverWebhook(key.orgId, branchId, 'cash_in', {
    transaction_id: cashTx.id,
    amount,
    description,
    reference,
    status: cashTx.status,
  })

  return apiSuccess(cashTx, { type: 'cash_in' })
}

// ─────────────────────────────────────────────────────────────
// Handler: cash-out
// ─────────────────────────────────────────────────────────────
async function handleCashOut(
  key: { orgId: string; branchId: string | null },
  body: Record<string, unknown>
): Promise<Response> {
  const amount = Number(body.amount)
  if (!amount || amount <= 0) return apiError('Field "amount" harus angka positif.', 400)
  if (!body.description) return apiError('Field "description" wajib diisi.', 400)

  let admin: Awaited<ReturnType<typeof createAdminClient>>
  try {
    admin = await createAdminClient()
  } catch {
    return apiError('Server error.', 500)
  }

  // Load api_configuration
  const { data: config } = await (admin as any)
    .from('api_configurations')
    .select('cash_out_account_id, cash_out_params')
    .eq('org_id', key.orgId)
    .or(`branch_id.eq.${key.branchId ?? 'null'},branch_id.is.null`)
    .order('branch_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  const cashOutAccountId = (body.account_id as string) || config?.cash_out_account_id
  if (!cashOutAccountId) {
    return apiError('Akun kas sumber belum dikonfigurasi. Set cash_out_account_id di pengaturan API.', 422)
  }

  const params = config?.cash_out_params ?? {}
  const autoPost = Boolean(params.auto_post ?? false)
  const description = String(body.description)
  const reference = body.reference as string | undefined
  const branchId = (body.branch_id as string) || key.branchId

  if (!branchId) {
    return apiError('branch_id diperlukan jika API key tidak di-scope ke cabang tertentu.', 400)
  }

  const cashInsert: Record<string, unknown> = {
    org_id: key.orgId,
    branch_id: branchId,
    type: 'out',
    amount,
    description,
    account_id: cashOutAccountId,
    status: autoPost ? 'posted' : 'draft',
    source: 'api',
  }
  if (reference) cashInsert.reference = reference

  const { data: cashTx, error: cashError } = await (admin as any)
    .from('cash_transactions')
    .insert(cashInsert)
    .select('id, reference_number, amount, description, status, created_at')
    .maybeSingle()

  if (cashError || !cashTx) {
    return apiError(cashError?.message || 'Gagal mencatat transaksi kas keluar.', 500)
  }

  // Fire webhook (non-blocking)
  void deliverWebhook(key.orgId, branchId, 'cash_out', {
    transaction_id: cashTx.id,
    amount,
    description,
    reference,
    status: cashTx.status,
  })

  return apiSuccess(cashTx, { type: 'cash_out' })
}
