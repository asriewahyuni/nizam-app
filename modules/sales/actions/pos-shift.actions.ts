'use server'

/**
 * Server-side POS shift workflow:
 * open shift, close shift, summarize sales by shift, and post settlement journals.
 */

import { revalidatePath } from 'next/cache'

import { verifyInternalAuthNikForOrg } from '@/lib/auth/internal-auth.server'
import { queryPostgres } from '@/lib/db/postgres'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getDateInTimeZone } from '@/lib/utils'
import { createJournalEntry } from '@/modules/accounting/actions/journal.actions'
import { getActiveBranch } from '@/modules/organization/actions/org.actions'
import {
  getPosShiftConfig,
  isPosShiftFeatureEnabled,
  isPosShiftSchemaMissing,
  type PosShiftConfig,
  type PosShiftMethod,
} from '@/modules/sales/lib/pos-shift'

type ActivePosShiftContext =
  | {
      userId: string
      branchId: string
      branchName: string
      config: PosShiftConfig
    }
  | { error: string }

type PosShiftSessionRow = {
  id?: string | null
  org_id?: string | null
  branch_id?: string | null
  cashier_user_id?: string | null
  register_code?: string | null
  opening_cash?: number | string | null
  expected_cash?: number | string | null
  closing_cash?: number | string | null
  variance_amount?: number | string | null
  cash_account_id?: string | null
  transfer_account_id?: string | null
  qris_account_id?: string | null
  opening_notes?: string | null
  closing_notes?: string | null
  status?: string | null
  opened_at?: string | null
  closed_at?: string | null
}

type PosShiftFundingAccountRow = {
  id?: string | null
  code?: string | null
  name?: string | null
  type?: string | null
  is_active?: boolean | null
}

type PosShiftSaleRow = {
  pos_session_id?: string | null
  grand_total?: number | string | null
  total_amount?: number | string | null
  discount_amount?: number | string | null
  tax_amount?: number | string | null
  pos_payment_method?: string | null
  pos_change_amount?: number | string | null
}

type PosShiftSettlementRow = {
  session_id?: string | null
  settlement_method?: string | null
  source_account_id?: string | null
  target_account_id?: string | null
  gross_amount?: number | string | null
  fee_amount?: number | string | null
  net_amount?: number | string | null
  journal_entry_id?: string | null
  notes?: string | null
  settled_by?: string | null
  created_at?: string | null
}

type PosShiftUserIdentity = {
  displayName: string | null
  nik: string | null
}

const POS_SHIFT_SESSION_SELECT = `
  id,
  org_id,
  branch_id,
  cashier_user_id,
  register_code,
  opening_cash,
  expected_cash,
  closing_cash,
  variance_amount,
  cash_account_id,
  transfer_account_id,
  qris_account_id,
  opening_notes,
  closing_notes,
  status,
  opened_at,
  closed_at
`

export type PosShiftSettlementSummary = {
  method: PosShiftMethod
  sourceAccountId: string | null
  targetAccountId: string | null
  grossAmount: number
  feeAmount: number
  netAmount: number
  journalEntryId: string | null
  notes: string | null
  settledByUserId: string | null
  settledByDisplayName: string | null
  settledByNik: string | null
  createdAt: string | null
}

export type PosShiftSummary = {
  id: string
  status: 'OPEN' | 'CLOSED'
  registerCode: string
  branchId: string
  branchName: string | null
  cashierUserId: string | null
  cashierDisplayName: string | null
  cashierNik: string | null
  openingCash: number
  expectedCash: number
  closingCash: number | null
  varianceAmount: number | null
  cashAccountId: string | null
  transferAccountId: string | null
  qrisAccountId: string | null
  openedAt: string | null
  closedAt: string | null
  openingNotes: string | null
  closingNotes: string | null
  settlements: PosShiftSettlementSummary[]
  totals: {
    transactionCount: number
    grossSales: number
    subtotalSales: number
    discountAmount: number
    taxAmount: number
    totalChange: number
    byMethod: Record<PosShiftMethod, number>
    settledByMethod: Record<PosShiftMethod, number>
    remainingByMethod: Record<PosShiftMethod, number>
  }
}

export type PosShiftSnapshot = {
  enabled: boolean
  schemaReady: boolean
  requireOpenShift: boolean
  enableSettlement: boolean
  config: PosShiftConfig
  openSession: PosShiftSummary | null
  latestClosedSession: PosShiftSummary | null
  message: string | null
}

export type PosShiftHistoryDay = {
  dateKey: string
  totals: {
    shiftCount: number
    transactionCount: number
    grossSales: number
    pendingSettlement: number
  }
  sessions: PosShiftSummary[]
}

export type PosShiftHistoryResponse = {
  schemaReady: boolean
  days: PosShiftHistoryDay[]
  hasMore: boolean
  nextBeforeDateKey: string | null
  message: string | null
}

function parseNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isPosShiftOpeningFundingColumnMissing(
  error: { code?: string | null; message?: string | null } | null | undefined
) {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()

  if (code === '42703' || code === 'PGRST204') {
    return (
      message.includes('opening_source_account_id')
      || message.includes('opening_journal_entry_id')
    )
  }

  return (
    (
      message.includes('opening_source_account_id')
      || message.includes('opening_journal_entry_id')
    ) &&
    (
      message.includes('does not exist')
      || message.includes('could not find')
      || message.includes('schema cache')
      || message.includes('undefined column')
    )
  )
}

function isPosShiftLiquidAccount(account: PosShiftFundingAccountRow | null | undefined) {
  if (!account?.id) return false

  const type = String(account.type || '').trim().toUpperCase()
  const code = String(account.code || '').trim().toUpperCase()

  return type === 'ASSET' && (code.startsWith('11') || code.startsWith('12'))
}

function formatPosShiftAccountLabel(account: PosShiftFundingAccountRow | null | undefined) {
  const code = String(account?.code || '').trim()
  const name = String(account?.name || '').trim()
  return [code, name].filter(Boolean).join(' - ') || 'akun terpilih'
}

async function getPosShiftFundingAccounts(
  db: any,
  orgId: string,
  accountIds: Array<string | null | undefined>
) {
  const normalizedAccountIds = Array.from(new Set(
    accountIds
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ))

  if (normalizedAccountIds.length === 0) {
    return { accountsById: new Map<string, PosShiftFundingAccountRow>() }
  }

  const { data, error } = await db
    .from('accounts')
    .select('id, code, name, type, is_active')
    .eq('org_id', orgId)
    .in('id', normalizedAccountIds)

  if (error) {
    return { error: 'Gagal membaca akun POS shift: ' + String(error.message || 'unknown error') }
  }

  const accountsById = new Map<string, PosShiftFundingAccountRow>()
  for (const account of ((data as PosShiftFundingAccountRow[]) || [])) {
    const accountId = String(account?.id || '').trim()
    if (!accountId) continue
    accountsById.set(accountId, account)
  }

  return { accountsById }
}

function validatePosShiftFundingAccount(
  accountsById: Map<string, PosShiftFundingAccountRow>,
  accountId: string | null | undefined,
  label: string,
  options?: { required?: boolean }
) {
  const normalizedAccountId = String(accountId || '').trim()
  if (!normalizedAccountId) {
    if (options?.required) {
      return { error: `${label} wajib dipilih.` as const }
    }
    return { account: null }
  }

  const account = accountsById.get(normalizedAccountId)
  if (!account?.id) {
    return { error: `${label} tidak ditemukan.` as const }
  }

  if (account.is_active === false) {
    return { error: `${label} tidak aktif.` as const }
  }

  if (!isPosShiftLiquidAccount(account)) {
    return { error: `${label} harus memakai akun ASSET kelompok 11xx/12xx.` as const }
  }

  return { account }
}

function normalizeMethod(value: unknown): PosShiftMethod {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'TRANSFER') return 'TRANSFER'
  if (normalized === 'QRIS') return 'QRIS'
  return 'CASH'
}

function emptyMethodTotals(): Record<PosShiftMethod, number> {
  return {
    CASH: 0,
    TRANSFER: 0,
    QRIS: 0,
  }
}

function getJakartaDateKey(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getJakartaDayStartIso(dateKey?: string | null): string | null {
  const normalized = String(dateKey || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null

  const date = new Date(`${normalized}T00:00:00+07:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

async function resolvePosCashierIdentity(
  orgId: string,
  cashierUserId?: string | null
): Promise<PosShiftUserIdentity> {
  const normalizedCashierUserId = String(cashierUserId || '').trim()
  if (!normalizedCashierUserId) {
    return { displayName: null, nik: null }
  }

  try {
    const result = await queryPostgres<{
      employee_nik: string | null
      employee_first_name: string | null
      employee_last_name: string | null
      internal_display_name: string | null
      internal_login_nik: string | null
      internal_login_email: string | null
    }>(
      `
        select
          emp.employee_nik,
          emp.employee_first_name,
          emp.employee_last_name,
          auth.internal_display_name,
          auth.internal_login_nik,
          auth.internal_login_email
        from (
          select 1
        ) seed
        left join lateral (
          select
            upper(trim(coalesce(e.nik, ''))) as employee_nik,
            e.first_name as employee_first_name,
            e.last_name as employee_last_name
          from public.employees e
          where
            e.org_id = $1::uuid
            and e.user_id = $2::uuid
          order by e.created_at asc nulls last, e.id asc
          limit 1
        ) emp on true
        left join lateral (
          select
            nullif(trim(u.display_name), '') as internal_display_name,
            upper(trim(coalesce(u.login_nik, ''))) as internal_login_nik,
            lower(trim(coalesce(u.login_email, ''))) as internal_login_email
          from public.internal_auth_users u
          where
            u.legacy_user_id = $2::uuid
            or u.id = $2::uuid
          order by
            case when u.legacy_user_id = $2::uuid then 0 else 1 end,
            u.created_at asc
          limit 1
        ) auth on true
      `,
      [orgId, normalizedCashierUserId]
    )

    const row = result.rows[0]
    const employeeName = [
      String(row?.employee_first_name || '').trim(),
      String(row?.employee_last_name || '').trim(),
    ].filter(Boolean).join(' ').trim()
    const emailPrefix = String(row?.internal_login_email || '').split('@')[0]?.trim() || ''

    return {
      displayName: employeeName || String(row?.internal_display_name || '').trim() || emailPrefix || null,
      nik: String(row?.employee_nik || row?.internal_login_nik || '').trim() || null,
    }
  } catch {
    return { displayName: null, nik: null }
  }
}

async function resolvePosUserIdentities(
  orgId: string,
  userIds: Array<string | null | undefined>
): Promise<Map<string, PosShiftUserIdentity>> {
  const uniqueUserIds = Array.from(new Set(
    userIds
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ))

  const resolvedEntries = await Promise.all(
    uniqueUserIds.map(async (userId) => [userId, await resolvePosCashierIdentity(orgId, userId)] as const)
  )

  return new Map<string, PosShiftUserIdentity>(resolvedEntries)
}

async function verifyPosCashierLogin(
  db: any,
  orgId: string,
  branchId: string,
  nik: string,
  password: string
) {
  const verified = await verifyInternalAuthNikForOrg({ orgId, nik, password })
  if ('error' in verified) {
    return verified
  }

  try {
    const { data: employeeRow } = await db
      .from('employees')
      .select('branch_id, first_name, last_name, nik, employment_status')
      .eq('org_id', orgId)
      .eq('user_id', verified.sessionUserId)
      .maybeSingle()

    const employeeBranchId = String(employeeRow?.branch_id || '').trim()
    const employmentStatus = String(employeeRow?.employment_status || '').trim().toUpperCase()
    if (employmentStatus === 'RESIGNED' || employmentStatus === 'TERMINATED') {
      return { error: 'NIK kasir ini sudah tidak aktif sebagai karyawan.' as const }
    }
    if (employeeBranchId && employeeBranchId !== branchId) {
      return { error: 'NIK kasir ini terdaftar pada unit lain. Pindahkan unit aktif atau gunakan NIK kasir unit ini.' as const }
    }

    const employeeName = [
      String(employeeRow?.first_name || '').trim(),
      String(employeeRow?.last_name || '').trim(),
    ].filter(Boolean).join(' ').trim()

    return {
      ...verified,
      displayName: employeeName || verified.displayName,
      nik: String(employeeRow?.nik || verified.nik || '').trim().toUpperCase() || verified.nik,
    }
  } catch {
    return verified
  }
}

async function resolvePosMemberRole(
  db: any,
  orgId: string,
  userId: string,
) {
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedUserId) return null

  const { data: memberRow } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', normalizedUserId)
    .eq('is_active', true)
    .maybeSingle()

  return String(memberRow?.role || '').trim().toLowerCase() || null
}

async function verifyPosCloseShiftAuthorization(
  db: any,
  orgId: string,
  branchId: string,
  currentUserId: string,
  sessionCashierUserId: string | null,
  nik: string,
  password: string
) {
  const normalizedNik = String(nik || '').trim().toUpperCase()
  const normalizedPassword = String(password || '').trim()
  const normalizedCurrentUserId = String(currentUserId || '').trim()
  const normalizedSessionCashierUserId = String(sessionCashierUserId || '').trim()

  const actorRole = await resolvePosMemberRole(db, orgId, normalizedCurrentUserId)
  const canUseSessionOverride = (
    normalizedCurrentUserId.length > 0 &&
    normalizedCurrentUserId === normalizedSessionCashierUserId &&
    ['owner', 'admin', 'manager'].includes(String(actorRole || ''))
  )

  if (!normalizedNik && !normalizedPassword) {
    if (canUseSessionOverride) {
      return {
        sessionUserId: normalizedCurrentUserId,
        displayName: null,
        nik: null,
        authorizationType: 'SELF_SESSION' as const,
        authorizationRole: actorRole as 'owner' | 'admin' | 'manager',
      }
    }

    return {
      error: 'Isi login NIK kasir beserta sandinya untuk menutup shift. Owner/admin yang membuka shift ini sendiri boleh mengosongkan kolom login.',
    } as const
  }

  if (!normalizedNik || !normalizedPassword) {
    return {
      error: canUseSessionOverride
        ? 'Isi login NIK dan sandi kasir secara lengkap, atau kosongkan keduanya untuk memakai sesi owner/admin yang membuka shift ini.'
        : 'Isi login NIK kasir beserta sandinya untuk menutup shift.',
    } as const
  }

  const cashierLogin = await verifyPosCashierLogin(
    db,
    orgId,
    branchId,
    normalizedNik,
    normalizedPassword
  )
  if ('error' in cashierLogin) {
    return cashierLogin
  }

  if (normalizedSessionCashierUserId !== cashierLogin.sessionUserId) {
    return { error: 'Gunakan login NIK kasir yang membuka shift ini untuk menutup shift.' } as const
  }

  return {
    ...cashierLogin,
    authorizationType: 'CASHIER' as const,
    authorizationRole: 'cashier' as const,
  }
}

async function verifyPosSettlementLogin(
  db: any,
  orgId: string,
  branchId: string,
  sessionCashierUserId: string | null,
  nik: string,
  password: string
) {
  const verified = await verifyPosCashierLogin(db, orgId, branchId, nik, password)
  if ('error' in verified) {
    return verified
  }

  if (verified.sessionUserId === String(sessionCashierUserId || '').trim()) {
    return {
      ...verified,
      authorizationType: 'CASHIER' as const,
      authorizationRole: 'cashier' as const,
    }
  }

  const { data: memberRow } = await db
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', verified.sessionUserId)
    .eq('is_active', true)
    .maybeSingle()

  const normalizedRole = String(memberRow?.role || '').trim().toLowerCase()
  if (['owner', 'admin', 'manager'].includes(normalizedRole)) {
    return {
      ...verified,
      authorizationType: 'APPROVER' as const,
      authorizationRole: normalizedRole as 'owner' | 'admin' | 'manager',
    }
  }

  return {
    error: 'Settlement harus memakai login NIK kasir shift ini atau otorisator owner/admin/manager.' as const,
  }
}

async function getPosShiftDbClient() {
  try {
    return (await createAdminClient()) as any
  } catch {
    return (await createClient()) as any
  }
}

async function getPosShiftContext(orgId: string): Promise<ActivePosShiftContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { error: 'Tidak terautentikasi.' }
  }

  const activeBranch = await getActiveBranch(orgId)
  if (!activeBranch?.id) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk memakai POS.' }
  }

  const { data: orgRow } = await (supabase as any)
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle()

  const config = getPosShiftConfig(orgRow?.settings)

  return {
    userId: user.id,
    branchId: activeBranch.id,
    branchName: String(activeBranch.name || '').trim() || 'Unit Aktif',
    config,
  }
}

async function getSingleSession(
  db: any,
  orgId: string,
  sessionId: string
): Promise<{ session: PosShiftSessionRow | null; error: { code?: string | null; message?: string | null } | null }> {
  const { data, error } = await db
    .from('pos_shift_sessions')
    .select(POS_SHIFT_SESSION_SELECT)
    .eq('org_id', orgId)
    .eq('id', sessionId)
    .maybeSingle()

  return {
    session: (data as PosShiftSessionRow | null) ?? null,
    error,
  }
}

function buildPosShiftSummaryFromData(
  sessionRow: PosShiftSessionRow,
  branchName: string | null | undefined,
  saleRows: PosShiftSaleRow[],
  settlementRows: PosShiftSettlementRow[],
  identityByUserId: Map<string, PosShiftUserIdentity>
): PosShiftSummary {
  const sessionId = String(sessionRow.id || '')
  const openingCash = parseNumber(sessionRow.opening_cash)
  const cashierUserId = String(sessionRow.cashier_user_id || '').trim() || null
  const byMethod = emptyMethodTotals()
  const settledByMethod = emptyMethodTotals()

  let grossSales = 0
  let subtotalSales = 0
  let discountAmount = 0
  let taxAmount = 0
  let totalChange = 0

  for (const row of saleRows) {
    const grandTotal = parseNumber(row.grand_total)
    const subtotal = parseNumber(row.total_amount)
    const discount = parseNumber(row.discount_amount)
    const tax = parseNumber(row.tax_amount)
    const change = parseNumber(row.pos_change_amount)
    const method = normalizeMethod(row.pos_payment_method)

    grossSales += grandTotal
    subtotalSales += subtotal
    discountAmount += discount
    taxAmount += tax
    totalChange += change
    byMethod[method] += grandTotal
  }

  const settlementLogs = settlementRows
    .map((row) => {
      const method = normalizeMethod(row.settlement_method)
      const settledByUserId = String(row.settled_by || '').trim() || null
      const settledByIdentity = settledByUserId ? identityByUserId.get(settledByUserId) : null
      const grossAmount = parseNumber(row.gross_amount)

      settledByMethod[method] += grossAmount

      return {
        method,
        sourceAccountId: String(row.source_account_id || '').trim() || null,
        targetAccountId: String(row.target_account_id || '').trim() || null,
        grossAmount,
        feeAmount: parseNumber(row.fee_amount),
        netAmount: parseNumber(row.net_amount),
        journalEntryId: String(row.journal_entry_id || '').trim() || null,
        notes: row.notes ? String(row.notes).trim() : null,
        settledByUserId,
        settledByDisplayName: settledByIdentity?.displayName || null,
        settledByNik: settledByIdentity?.nik || null,
        createdAt: row.created_at ? String(row.created_at) : null,
      } satisfies PosShiftSettlementSummary
    })
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))

  const computedExpectedCash = openingCash + byMethod.CASH - totalChange
  const expectedCash = parseNumber(sessionRow.expected_cash) || computedExpectedCash
  const closingCash = sessionRow.closing_cash == null ? null : parseNumber(sessionRow.closing_cash)
  const cashBase = closingCash ?? expectedCash
  const cashierIdentity = cashierUserId ? identityByUserId.get(cashierUserId) : null

  const remainingByMethod = {
    CASH: Math.max(0, cashBase - settledByMethod.CASH),
    TRANSFER: Math.max(0, byMethod.TRANSFER - settledByMethod.TRANSFER),
    QRIS: Math.max(0, byMethod.QRIS - settledByMethod.QRIS),
  } satisfies Record<PosShiftMethod, number>

  return {
    id: sessionId,
    status: String(sessionRow.status || 'OPEN').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN',
    registerCode: String(sessionRow.register_code || 'REG-1').trim() || 'REG-1',
    branchId: String(sessionRow.branch_id || '').trim(),
    branchName: branchName ? String(branchName).trim() : null,
    cashierUserId,
    cashierDisplayName: cashierIdentity?.displayName || null,
    cashierNik: cashierIdentity?.nik || null,
    openingCash,
    expectedCash,
    closingCash,
    varianceAmount: sessionRow.variance_amount == null ? null : parseNumber(sessionRow.variance_amount),
    cashAccountId: sessionRow.cash_account_id ? String(sessionRow.cash_account_id).trim() : null,
    transferAccountId: sessionRow.transfer_account_id ? String(sessionRow.transfer_account_id).trim() : null,
    qrisAccountId: sessionRow.qris_account_id ? String(sessionRow.qris_account_id).trim() : null,
    openedAt: sessionRow.opened_at ? String(sessionRow.opened_at) : null,
    closedAt: sessionRow.closed_at ? String(sessionRow.closed_at) : null,
    openingNotes: sessionRow.opening_notes ? String(sessionRow.opening_notes) : null,
    closingNotes: sessionRow.closing_notes ? String(sessionRow.closing_notes) : null,
    settlements: settlementLogs,
    totals: {
      transactionCount: saleRows.length,
      grossSales,
      subtotalSales,
      discountAmount,
      taxAmount,
      totalChange,
      byMethod,
      settledByMethod,
      remainingByMethod,
    },
  }
}

async function buildPosShiftSummary(
  db: any,
  orgId: string,
  sessionRow: PosShiftSessionRow,
  branchName?: string | null
): Promise<PosShiftSummary> {
  const sessionId = String(sessionRow.id || '')

  let saleRows: PosShiftSaleRow[] = []
  const { data: salesData, error: salesError } = await db
    .from('sales')
    .select('pos_session_id, grand_total, total_amount, discount_amount, tax_amount, pos_payment_method, pos_change_amount')
    .eq('org_id', orgId)
    .eq('pos_session_id', sessionId)

  if (!salesError && Array.isArray(salesData)) {
    saleRows = salesData as PosShiftSaleRow[]
  }

  let settlementRows: PosShiftSettlementRow[] = []
  const { data: settlementsData, error: settlementsError } = await db
    .from('pos_shift_settlements')
    .select('session_id, settlement_method, source_account_id, target_account_id, gross_amount, fee_amount, net_amount, journal_entry_id, notes, settled_by, created_at')
    .eq('org_id', orgId)
    .eq('session_id', sessionId)

  if (!settlementsError && Array.isArray(settlementsData)) {
    settlementRows = settlementsData as PosShiftSettlementRow[]
  }

  const identityByUserId = await resolvePosUserIdentities(
    orgId,
    [sessionRow.cashier_user_id, ...settlementRows.map((row) => row.settled_by)]
  )

  return buildPosShiftSummaryFromData(sessionRow, branchName, saleRows, settlementRows, identityByUserId)
}

async function buildPosShiftSummaries(
  db: any,
  orgId: string,
  sessionRows: PosShiftSessionRow[],
  branchName?: string | null
): Promise<PosShiftSummary[]> {
  const normalizedRows = sessionRows.filter((row) => String(row.id || '').trim())
  if (normalizedRows.length === 0) return []

  const sessionIds = normalizedRows.map((row) => String(row.id || '').trim())

  const [salesResult, settlementsResult] = await Promise.all([
    db
      .from('sales')
      .select('pos_session_id, grand_total, total_amount, discount_amount, tax_amount, pos_payment_method, pos_change_amount')
      .eq('org_id', orgId)
      .in('pos_session_id', sessionIds),
    db
      .from('pos_shift_settlements')
      .select('session_id, settlement_method, source_account_id, target_account_id, gross_amount, fee_amount, net_amount, journal_entry_id, notes, settled_by, created_at')
      .eq('org_id', orgId)
      .in('session_id', sessionIds),
  ])

  const saleRows = !salesResult.error && Array.isArray(salesResult.data)
    ? salesResult.data as PosShiftSaleRow[]
    : []
  const settlementRows = !settlementsResult.error && Array.isArray(settlementsResult.data)
    ? settlementsResult.data as PosShiftSettlementRow[]
    : []

  const saleRowsBySession = new Map<string, PosShiftSaleRow[]>()
  for (const row of saleRows) {
    const sessionId = String(row.pos_session_id || '').trim()
    if (!sessionId) continue
    const bucket = saleRowsBySession.get(sessionId) || []
    bucket.push(row)
    saleRowsBySession.set(sessionId, bucket)
  }

  const settlementRowsBySession = new Map<string, PosShiftSettlementRow[]>()
  for (const row of settlementRows) {
    const sessionId = String(row.session_id || '').trim()
    if (!sessionId) continue
    const bucket = settlementRowsBySession.get(sessionId) || []
    bucket.push(row)
    settlementRowsBySession.set(sessionId, bucket)
  }

  const identityByUserId = await resolvePosUserIdentities(
    orgId,
    [
      ...normalizedRows.map((row) => row.cashier_user_id),
      ...settlementRows.map((row) => row.settled_by),
    ]
  )

  return normalizedRows.map((row) => (
    buildPosShiftSummaryFromData(
      row,
      branchName,
      saleRowsBySession.get(String(row.id || '').trim()) || [],
      settlementRowsBySession.get(String(row.id || '').trim()) || [],
      identityByUserId
    )
  ))
}

function buildPosShiftHistoryDays(sessions: PosShiftSummary[]): PosShiftHistoryDay[] {
  const days = new Map<string, PosShiftHistoryDay>()

  for (const session of sessions) {
    const dateKey = getJakartaDateKey(session.closedAt || session.openedAt)
    if (!dateKey) continue

    const existingDay = days.get(dateKey)
    const pendingSettlement = (
      session.totals.remainingByMethod.CASH +
      session.totals.remainingByMethod.TRANSFER +
      session.totals.remainingByMethod.QRIS
    )

    if (!existingDay) {
      days.set(dateKey, {
        dateKey,
        totals: {
          shiftCount: 1,
          transactionCount: session.totals.transactionCount,
          grossSales: session.totals.grossSales,
          pendingSettlement,
        },
        sessions: [session],
      })
      continue
    }

    existingDay.totals.shiftCount += 1
    existingDay.totals.transactionCount += session.totals.transactionCount
    existingDay.totals.grossSales += session.totals.grossSales
    existingDay.totals.pendingSettlement += pendingSettlement
    existingDay.sessions.push(session)
  }

  return Array.from(days.values()).sort((left, right) => right.dateKey.localeCompare(left.dateKey))
}

export async function getPosShiftSnapshot(orgId: string): Promise<PosShiftSnapshot> {
  const context = await getPosShiftContext(orgId)
  if ('error' in context) {
    return {
      enabled: false,
      schemaReady: false,
      requireOpenShift: false,
      enableSettlement: false,
      config: getPosShiftConfig(null),
      openSession: null,
      latestClosedSession: null,
      message: context.error,
    }
  }

  const enabled = isPosShiftFeatureEnabled(context.config)
  if (!enabled) {
    return {
      enabled: false,
      schemaReady: true,
      requireOpenShift: context.config.requireOpenShift,
      enableSettlement: context.config.enableSettlement,
      config: context.config,
      openSession: null,
      latestClosedSession: null,
      message: null,
    }
  }

  const db = await getPosShiftDbClient()

  const { data: openRow, error: openError } = await db
    .from('pos_shift_sessions')
    .select(POS_SHIFT_SESSION_SELECT)
    .eq('org_id', orgId)
    .eq('branch_id', context.branchId)
    .eq('status', 'OPEN')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (isPosShiftSchemaMissing(openError)) {
    return {
      enabled: true,
      schemaReady: false,
      requireOpenShift: context.config.requireOpenShift,
      enableSettlement: context.config.enableSettlement,
      config: context.config,
      openSession: null,
      latestClosedSession: null,
      message: 'Schema POS shift belum tersedia. POS tetap memakai alur lama sampai migrasi dijalankan.',
    }
  }

  const { data: latestClosedRow } = await db
    .from('pos_shift_sessions')
    .select(POS_SHIFT_SESSION_SELECT)
    .eq('org_id', orgId)
    .eq('branch_id', context.branchId)
    .eq('status', 'CLOSED')
    .order('closed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    enabled: true,
    schemaReady: true,
    requireOpenShift: context.config.requireOpenShift,
    enableSettlement: context.config.enableSettlement,
    config: context.config,
    openSession: openRow ? await buildPosShiftSummary(db, orgId, openRow as PosShiftSessionRow, context.branchName) : null,
    latestClosedSession: latestClosedRow
      ? await buildPosShiftSummary(db, orgId, latestClosedRow as PosShiftSessionRow, context.branchName)
      : null,
    message: openError ? String(openError.message || 'Gagal memuat snapshot shift POS.') : null,
  }
}

export async function getPosShiftHistory(
  orgId: string,
  payload?: {
    beforeDateKey?: string | null
    dayLimit?: number
  }
): Promise<PosShiftHistoryResponse> {
  const context = await getPosShiftContext(orgId)
  if ('error' in context) {
    return {
      schemaReady: false,
      days: [],
      hasMore: false,
      nextBeforeDateKey: null,
      message: context.error,
    }
  }

  if (!isPosShiftFeatureEnabled(context.config)) {
    return {
      schemaReady: true,
      days: [],
      hasMore: false,
      nextBeforeDateKey: null,
      message: null,
    }
  }

  const dayLimit = Math.max(1, Math.min(31, Math.floor(Number(payload?.dayLimit || 7)) || 7))
  const beforeDayStartIso = getJakartaDayStartIso(payload?.beforeDateKey)
  const db = await getPosShiftDbClient()
  let query = db
    .from('pos_shift_sessions')
    .select(POS_SHIFT_SESSION_SELECT)
    .eq('org_id', orgId)
    .eq('branch_id', context.branchId)
    .eq('status', 'CLOSED')
    .order('closed_at', { ascending: false })
    .limit(Math.max(120, dayLimit * 50))

  if (beforeDayStartIso) {
    query = query.lt('closed_at', beforeDayStartIso)
  }

  const { data, error } = await query

  if (isPosShiftSchemaMissing(error)) {
    return {
      schemaReady: false,
      days: [],
      hasMore: false,
      nextBeforeDateKey: null,
      message: 'Schema POS shift belum tersedia. Histori harian akan aktif setelah migration selesai.',
    }
  }

  const sessionRows = Array.isArray(data) ? data as PosShiftSessionRow[] : []
  const selectedDays: string[] = []

  for (const row of sessionRows) {
    const dateKey = getJakartaDateKey(row.closed_at || row.opened_at)
    if (!dateKey || selectedDays.includes(dateKey)) continue
    selectedDays.push(dateKey)
    if (selectedDays.length >= dayLimit) break
  }

  const includedSessions = sessionRows.filter((row) => {
    const dateKey = getJakartaDateKey(row.closed_at || row.opened_at)
    return Boolean(dateKey && selectedDays.includes(dateKey))
  })

  const oldestDateKey = selectedDays[selectedDays.length - 1] || null
  const olderThanOldestDayIso = getJakartaDayStartIso(oldestDateKey)

  let hasMore = false
  if (olderThanOldestDayIso) {
    const { data: olderRows } = await db
      .from('pos_shift_sessions')
      .select('id')
      .eq('org_id', orgId)
      .eq('branch_id', context.branchId)
      .eq('status', 'CLOSED')
      .lt('closed_at', olderThanOldestDayIso)
      .limit(1)

    hasMore = Array.isArray(olderRows) && olderRows.length > 0
  }

  return {
    schemaReady: true,
    days: buildPosShiftHistoryDays(await buildPosShiftSummaries(db, orgId, includedSessions, context.branchName)),
    hasMore,
    nextBeforeDateKey: hasMore ? oldestDateKey : null,
    message: error ? String(error.message || 'Gagal memuat histori shift harian.') : null,
  }
}

export async function openPosShift(
  orgId: string,
  payload: {
    openingCash: number
    registerCode?: string
    openingNotes?: string
    cashAccountId?: string | null
    transferAccountId?: string | null
    qrisAccountId?: string | null
    openingSourceAccountId?: string | null
    cashierNik: string
    cashierPassword: string
  }
) {
  const context = await getPosShiftContext(orgId)
  if ('error' in context) return { error: context.error }

  if (!isPosShiftFeatureEnabled(context.config)) {
    return { error: 'Fitur shift POS belum diaktifkan di Pengaturan Bisnis.' }
  }

  const db = await getPosShiftDbClient()
  const cashierLogin = await verifyPosCashierLogin(
    db,
    orgId,
    context.branchId,
    payload.cashierNik,
    payload.cashierPassword
  )
  if ('error' in cashierLogin) {
    return cashierLogin
  }

  const { data: existingSession, error: existingError } = await db
    .from('pos_shift_sessions')
    .select('id')
    .eq('org_id', orgId)
    .eq('branch_id', context.branchId)
    .eq('status', 'OPEN')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (isPosShiftSchemaMissing(existingError)) {
    return { error: 'Schema POS shift belum tersedia. Jalankan migration terlebih dahulu sebelum membuka shift.' }
  }

  if (existingSession?.id) {
    const currentSession = await getSingleSession(db, orgId, String(existingSession.id))
    if (currentSession.session) {
      if (String(currentSession.session.cashier_user_id || '') !== cashierLogin.sessionUserId) {
        const existingSummary = await buildPosShiftSummary(db, orgId, currentSession.session, context.branchName)
        const existingCashierLabel = existingSummary.cashierDisplayName || existingSummary.cashierNik || 'kasir lain'
        return {
          error: `Masih ada shift aktif ${existingSummary.registerCode} atas nama ${existingCashierLabel}. Tutup shift tersebut terlebih dahulu.`,
        }
      }

      return {
        success: true,
        session: await buildPosShiftSummary(db, orgId, currentSession.session, context.branchName),
      }
    }
  }

  const openingCash = Math.max(0, parseNumber(payload.openingCash))
  const registerCode = String(payload.registerCode || context.config.defaultRegisterCode || 'REG-1').trim() || 'REG-1'
  const fundingAccountsResult = await getPosShiftFundingAccounts(db, orgId, [
    payload.cashAccountId,
    payload.transferAccountId,
    payload.qrisAccountId,
    payload.openingSourceAccountId,
  ])
  if ('error' in fundingAccountsResult) {
    return { error: fundingAccountsResult.error }
  }

  const cashAccountResult = validatePosShiftFundingAccount(
    fundingAccountsResult.accountsById,
    payload.cashAccountId,
    'Akun kas laci',
    { required: openingCash > 0 }
  )
  if ('error' in cashAccountResult) return cashAccountResult

  const transferAccountResult = validatePosShiftFundingAccount(
    fundingAccountsResult.accountsById,
    payload.transferAccountId,
    'Akun transfer shift'
  )
  if ('error' in transferAccountResult) return transferAccountResult

  const qrisAccountResult = validatePosShiftFundingAccount(
    fundingAccountsResult.accountsById,
    payload.qrisAccountId,
    'Akun QRIS / EDC shift'
  )
  if ('error' in qrisAccountResult) return qrisAccountResult

  const openingSourceAccountResult = validatePosShiftFundingAccount(
    fundingAccountsResult.accountsById,
    payload.openingSourceAccountId,
    'Akun sumber modal awal',
    { required: openingCash > 0 }
  )
  if ('error' in openingSourceAccountResult) return openingSourceAccountResult

  if (
    openingCash > 0 &&
    cashAccountResult.account?.id &&
    openingSourceAccountResult.account?.id &&
    String(cashAccountResult.account.id) === String(openingSourceAccountResult.account.id)
  ) {
    return { error: 'Akun sumber modal awal tidak boleh sama dengan akun kas laci karena jurnal akan bernilai nol.' }
  }

  const sessionInsertPayload = {
    org_id: orgId,
    branch_id: context.branchId,
    cashier_user_id: cashierLogin.sessionUserId,
    opened_by: cashierLogin.sessionUserId,
    register_code: registerCode,
    opening_cash: openingCash,
    expected_cash: openingCash,
    opening_notes: payload.openingNotes ? String(payload.openingNotes).trim() : null,
    cash_account_id: cashAccountResult.account?.id ? String(cashAccountResult.account.id).trim() : null,
    transfer_account_id: transferAccountResult.account?.id ? String(transferAccountResult.account.id).trim() : null,
    qris_account_id: qrisAccountResult.account?.id ? String(qrisAccountResult.account.id).trim() : null,
    status: 'OPEN',
    ...(openingSourceAccountResult.account?.id
      ? { opening_source_account_id: String(openingSourceAccountResult.account.id).trim() }
      : {}),
  }

  const { data: insertedRow, error: insertError } = await db
    .from('pos_shift_sessions')
    .insert(sessionInsertPayload)
    .select(POS_SHIFT_SESSION_SELECT)
    .maybeSingle()

  let finalInsertedRow = insertedRow as PosShiftSessionRow | null
  let finalInsertError = insertError

  if (finalInsertError && isPosShiftOpeningFundingColumnMissing(finalInsertError)) {
    const { opening_source_account_id: _openingSourceAccountId, ...legacyInsertPayload } = sessionInsertPayload
    void _openingSourceAccountId
    const legacyInsertResult = await db
      .from('pos_shift_sessions')
      .insert(legacyInsertPayload)
      .select(POS_SHIFT_SESSION_SELECT)
      .maybeSingle()

    finalInsertedRow = legacyInsertResult.data as PosShiftSessionRow | null
    finalInsertError = legacyInsertResult.error
  }

  if (finalInsertError || !finalInsertedRow?.id) {
    return { error: `Gagal membuka shift POS: ${String(finalInsertError?.message || 'unknown error')}` }
  }

  let warning: string | null = null
  if (openingCash > 0 && cashAccountResult.account?.id && openingSourceAccountResult.account?.id) {
    const sourceAccountLabel = formatPosShiftAccountLabel(openingSourceAccountResult.account)
    const cashAccountLabel = formatPosShiftAccountLabel(cashAccountResult.account)
    const journalResult = await createJournalEntry({
      org_id: orgId,
      branch_id: context.branchId,
      entry_date: getDateInTimeZone('Asia/Jakarta'),
      description: `Modal Awal POS ${registerCode}`,
      reference_type: 'POS_SHIFT_OPENING',
      reference_id: String(finalInsertedRow.id),
      notes: payload.openingNotes
        ? `Modal awal shift ${registerCode}. ${String(payload.openingNotes).trim()}`
        : `Modal awal shift POS ${registerCode}.`,
      lines: [
        {
          account_id: String(cashAccountResult.account.id),
          debit: openingCash,
          credit: 0,
          memo: `Kas laci shift ${registerCode} (${cashAccountLabel})`,
        },
        {
          account_id: String(openingSourceAccountResult.account.id),
          debit: 0,
          credit: openingCash,
          memo: `Sumber modal awal shift ${registerCode} (${sourceAccountLabel})`,
        },
      ],
      auto_post: true,
    })

    if ((journalResult as { error?: string }).error) {
      const cleanupResult = await db
        .from('pos_shift_sessions')
        .delete()
        .eq('id', String(finalInsertedRow.id))
        .eq('org_id', orgId)

      const cleanupFailed = Boolean((cleanupResult as { error?: { message?: string | null } | null })?.error)
      const cleanupHint = cleanupFailed
        ? ' Shift sempat dibuat, tetapi rollback sesi gagal sehingga perlu dicek manual.'
        : ''

      return {
        error: `Gagal membuat jurnal modal awal shift: ${String((journalResult as { error?: string }).error || 'unknown error')}.${cleanupHint}`,
      }
    }

    const openingJournalEntryId = String((journalResult as { entryId?: string }).entryId || '').trim()
    if (openingJournalEntryId) {
      const { error: metadataError } = await db
        .from('pos_shift_sessions')
        .update({
          opening_source_account_id: String(openingSourceAccountResult.account.id),
          opening_journal_entry_id: openingJournalEntryId,
        })
        .eq('id', String(finalInsertedRow.id))
        .eq('org_id', orgId)

      if (metadataError && !isPosShiftOpeningFundingColumnMissing(metadataError)) {
        warning = 'Jurnal modal awal shift berhasil dibuat, tetapi metadata akun sumber belum tersimpan penuh.'
      }
    }
  }

  revalidatePath('/pos')
  if (openingCash > 0) {
    revalidatePath('/accounting/journal')
    revalidatePath('/reports')
    revalidatePath('/cash')
  }
  return {
    success: true,
    session: await buildPosShiftSummary(db, orgId, finalInsertedRow, context.branchName),
    warning,
  }
}

export async function closePosShift(
  orgId: string,
  payload: {
    sessionId?: string | null
    closingCash: number
    closingNotes?: string
    cashierNik: string
    cashierPassword: string
  }
) {
  const context = await getPosShiftContext(orgId)
  if ('error' in context) return { error: context.error }

  if (!isPosShiftFeatureEnabled(context.config)) {
    return { error: 'Fitur shift POS belum diaktifkan di Pengaturan Bisnis.' }
  }

  const db = await getPosShiftDbClient()

  const sessionLookup = payload.sessionId
    ? await getSingleSession(db, orgId, String(payload.sessionId))
    : await db
        .from('pos_shift_sessions')
        .select(POS_SHIFT_SESSION_SELECT)
        .eq('org_id', orgId)
        .eq('branch_id', context.branchId)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

  const currentSession = 'session' in sessionLookup
    ? sessionLookup.session
    : ((sessionLookup.data as PosShiftSessionRow | null) ?? null)
  const currentError = 'error' in sessionLookup ? sessionLookup.error : sessionLookup.error

  if (isPosShiftSchemaMissing(currentError)) {
    return { error: 'Schema POS shift belum tersedia. Jalankan migration terlebih dahulu sebelum menutup shift.' }
  }

  if (!currentSession?.id || String(currentSession.status || '').toUpperCase() !== 'OPEN') {
    return { error: 'Tidak ada shift POS aktif yang bisa ditutup.' }
  }

  const closeAuthorization = await verifyPosCloseShiftAuthorization(
    db,
    orgId,
    context.branchId,
    context.userId,
    String(currentSession.cashier_user_id || '').trim() || null,
    payload.cashierNik,
    payload.cashierPassword
  )
  if ('error' in closeAuthorization) {
    return closeAuthorization
  }

  const summaryBeforeClose = await buildPosShiftSummary(db, orgId, currentSession, context.branchName)
  const closingCash = Math.max(0, parseNumber(payload.closingCash))
  const varianceAmount = closingCash - summaryBeforeClose.expectedCash

  const { data: updatedRow, error: updateError } = await db
    .from('pos_shift_sessions')
    .update({
      status: 'CLOSED',
      expected_cash: summaryBeforeClose.expectedCash,
      closing_cash: closingCash,
      variance_amount: varianceAmount,
      closing_notes: payload.closingNotes ? String(payload.closingNotes).trim() : null,
      closed_by: closeAuthorization.sessionUserId,
      closed_at: new Date().toISOString(),
    })
    .eq('id', currentSession.id)
    .eq('org_id', orgId)
    .select(POS_SHIFT_SESSION_SELECT)
    .maybeSingle()

  if (updateError) {
    return { error: `Gagal menutup shift POS: ${String(updateError.message || 'unknown error')}` }
  }

  const closedSummary = await buildPosShiftSummary(db, orgId, (updatedRow as PosShiftSessionRow) || currentSession, context.branchName)
  const threshold = context.config.varianceApprovalThreshold
  const warning = threshold > 0 && Math.abs(closedSummary.varianceAmount || 0) > threshold
    ? `Selisih kas ${closedSummary.varianceAmount! > 0 ? 'lebih' : 'kurang'} ${Math.abs(closedSummary.varianceAmount || 0)} melebihi ambang ${threshold}.`
    : null

  revalidatePath('/pos')
  return {
    success: true,
    session: closedSummary,
    warning,
  }
}

export async function settlePosShift(
  orgId: string,
  payload: {
    sessionId: string
    settlementMethod: PosShiftMethod
    targetAccountId: string
    amount?: number
    feeAmount?: number
    feeAccountId?: string | null
    notes?: string
    authorizerNik: string
    authorizerPassword: string
  }
) {
  const context = await getPosShiftContext(orgId)
  if ('error' in context) return { error: context.error }

  if (!context.config.enableSettlement) {
    return { error: 'Settlement shift POS belum diaktifkan di Pengaturan Bisnis.' }
  }

  const db = await getPosShiftDbClient()
  const sessionLookup = await getSingleSession(db, orgId, String(payload.sessionId || ''))

  if (isPosShiftSchemaMissing(sessionLookup.error)) {
    return { error: 'Schema settlement POS belum tersedia. Jalankan migration terlebih dahulu.' }
  }

  if (!sessionLookup.session?.id) {
    return { error: 'Shift POS tidak ditemukan.' }
  }

  const session = sessionLookup.session
  if (String(session.branch_id || '') !== context.branchId) {
    return { error: 'Shift POS tersebut tidak berada pada unit aktif.' }
  }
  if (String(session.status || '').toUpperCase() !== 'CLOSED') {
    return { error: 'Settlement hanya bisa dilakukan setelah shift POS ditutup.' }
  }

  const summary = await buildPosShiftSummary(db, orgId, session, context.branchName)
  const settlementAuthorizer = await verifyPosSettlementLogin(
    db,
    orgId,
    context.branchId,
    summary.cashierUserId,
    payload.authorizerNik,
    payload.authorizerPassword
  )
  if ('error' in settlementAuthorizer) {
    return settlementAuthorizer
  }

  const method = normalizeMethod(payload.settlementMethod)
  const sourceAccountId = method === 'CASH'
    ? summary.cashAccountId
    : method === 'TRANSFER'
      ? summary.transferAccountId
      : summary.qrisAccountId

  if (!sourceAccountId) {
    return { error: `Akun sumber ${method} belum direkam saat membuka shift.` }
  }

  const targetAccountId = String(payload.targetAccountId || '').trim()
  if (!targetAccountId) {
    return { error: 'Pilih akun tujuan settlement terlebih dahulu.' }
  }

  if (targetAccountId === sourceAccountId) {
    return { error: 'Akun tujuan settlement harus berbeda dari akun sumber.' }
  }

  const remainingAmount = summary.totals.remainingByMethod[method]
  if (remainingAmount <= 0) {
    return { error: `Tidak ada sisa saldo ${method} yang perlu disettlement.` }
  }

  const grossAmount = payload.amount == null ? remainingAmount : parseNumber(payload.amount)
  const feeAmount = Math.max(0, parseNumber(payload.feeAmount))

  if (grossAmount <= 0) {
    return { error: 'Nominal settlement harus lebih besar dari nol.' }
  }
  if (grossAmount - remainingAmount > 0.000001) {
    return { error: `Nominal settlement ${method} melebihi sisa saldo shift.` }
  }
  if (feeAmount > grossAmount) {
    return { error: 'Biaya settlement tidak boleh melebihi nominal bruto.' }
  }
  if (feeAmount > 0 && !String(payload.feeAccountId || '').trim()) {
    return { error: 'Pilih akun biaya settlement jika fee diisi.' }
  }

  const netAmount = grossAmount - feeAmount
  const journalResult = await createJournalEntry({
    org_id: orgId,
    branch_id: summary.branchId,
    entry_date: getDateInTimeZone('Asia/Jakarta'),
    description: `Settlement POS ${method} ${summary.registerCode}`,
    reference_type: 'TRANSFER',
    notes: payload.notes
      ? `Settlement shift ${summary.registerCode}: ${String(payload.notes).trim()}`
      : `Settlement shift POS ${summary.registerCode} (${method}).`,
    auto_post: true,
    lines: [
      {
        account_id: targetAccountId,
        debit: netAmount,
        credit: 0,
        memo: `Settlement masuk ${method} ${summary.registerCode}`,
      },
      ...(feeAmount > 0
        ? [
            {
              account_id: String(payload.feeAccountId || '').trim(),
              debit: feeAmount,
              credit: 0,
              memo: `Biaya settlement ${method} ${summary.registerCode}`,
            },
          ]
        : []),
      {
        account_id: sourceAccountId,
        debit: 0,
        credit: grossAmount,
        memo: `Settlement keluar ${method} ${summary.registerCode}`,
      },
    ],
  })

  if ((journalResult as { error?: string }).error) {
    return { error: String((journalResult as { error?: string }).error || 'Gagal membuat jurnal settlement.') }
  }

  const journalEntryId = String((journalResult as { entryId?: string }).entryId || '').trim() || null
  const { error: insertError } = await db
    .from('pos_shift_settlements')
    .insert({
      org_id: orgId,
      branch_id: summary.branchId,
      session_id: summary.id,
      settlement_method: method,
      source_account_id: sourceAccountId,
      target_account_id: targetAccountId,
      gross_amount: grossAmount,
      fee_amount: feeAmount,
      net_amount: netAmount,
      journal_entry_id: journalEntryId,
      notes: payload.notes ? String(payload.notes).trim() : null,
      settled_by: settlementAuthorizer.sessionUserId,
    })

  if (insertError) {
    return { error: `Jurnal settlement berhasil dibuat, tetapi log settlement gagal disimpan: ${String(insertError.message || 'unknown error')}` }
  }

  revalidatePath('/pos')
  revalidatePath('/accounting/journal')
  revalidatePath('/reports')

  const refreshed = await getSingleSession(db, orgId, summary.id)
  return {
    success: true,
    entryId: journalEntryId,
    session: refreshed.session
      ? await buildPosShiftSummary(db, orgId, refreshed.session, context.branchName)
      : summary,
  }
}
