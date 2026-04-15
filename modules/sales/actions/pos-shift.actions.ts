'use server'

/**
 * Server-side POS shift workflow:
 * open shift, close shift, summarize sales by shift, and post settlement journals.
 */

import { revalidatePath } from 'next/cache'

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

type PosShiftSaleRow = {
  grand_total?: number | string | null
  total_amount?: number | string | null
  discount_amount?: number | string | null
  tax_amount?: number | string | null
  pos_payment_method?: string | null
  pos_change_amount?: number | string | null
}

type PosShiftSettlementRow = {
  settlement_method?: string | null
  gross_amount?: number | string | null
}

export type PosShiftSummary = {
  id: string
  status: 'OPEN' | 'CLOSED'
  registerCode: string
  branchId: string
  branchName: string | null
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

function parseNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
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
    .select(`
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
    `)
    .eq('org_id', orgId)
    .eq('id', sessionId)
    .maybeSingle()

  return {
    session: (data as PosShiftSessionRow | null) ?? null,
    error,
  }
}

async function buildPosShiftSummary(
  db: any,
  orgId: string,
  sessionRow: PosShiftSessionRow,
  branchName?: string | null
): Promise<PosShiftSummary> {
  const sessionId = String(sessionRow.id || '')
  const openingCash = parseNumber(sessionRow.opening_cash)

  let saleRows: PosShiftSaleRow[] = []
  const { data: salesData, error: salesError } = await db
    .from('sales')
    .select('grand_total, total_amount, discount_amount, tax_amount, pos_payment_method, pos_change_amount')
    .eq('org_id', orgId)
    .eq('pos_session_id', sessionId)

  if (!salesError && Array.isArray(salesData)) {
    saleRows = salesData as PosShiftSaleRow[]
  }

  let settlementRows: PosShiftSettlementRow[] = []
  const { data: settlementsData, error: settlementsError } = await db
    .from('pos_shift_settlements')
    .select('settlement_method, gross_amount')
    .eq('org_id', orgId)
    .eq('session_id', sessionId)

  if (!settlementsError && Array.isArray(settlementsData)) {
    settlementRows = settlementsData as PosShiftSettlementRow[]
  }

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

  for (const row of settlementRows) {
    const method = normalizeMethod(row.settlement_method)
    settledByMethod[method] += parseNumber(row.gross_amount)
  }

  const computedExpectedCash = openingCash + byMethod.CASH - totalChange
  const expectedCash = parseNumber(sessionRow.expected_cash) || computedExpectedCash
  const closingCash = sessionRow.closing_cash == null ? null : parseNumber(sessionRow.closing_cash)
  const cashBase = closingCash ?? expectedCash

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
    .select(`
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
    `)
    .eq('org_id', orgId)
    .eq('branch_id', context.branchId)
    .eq('cashier_user_id', context.userId)
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
    .select(`
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
    `)
    .eq('org_id', orgId)
    .eq('branch_id', context.branchId)
    .eq('cashier_user_id', context.userId)
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

export async function openPosShift(
  orgId: string,
  payload: {
    openingCash: number
    registerCode?: string
    openingNotes?: string
    cashAccountId?: string | null
    transferAccountId?: string | null
    qrisAccountId?: string | null
  }
) {
  const context = await getPosShiftContext(orgId)
  if ('error' in context) return { error: context.error }

  if (!isPosShiftFeatureEnabled(context.config)) {
    return { error: 'Fitur shift POS belum diaktifkan di Pengaturan Bisnis.' }
  }

  const db = await getPosShiftDbClient()
  const { data: existingSession, error: existingError } = await db
    .from('pos_shift_sessions')
    .select('id')
    .eq('org_id', orgId)
    .eq('branch_id', context.branchId)
    .eq('cashier_user_id', context.userId)
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
      return {
        success: true,
        session: await buildPosShiftSummary(db, orgId, currentSession.session, context.branchName),
      }
    }
  }

  const openingCash = Math.max(0, parseNumber(payload.openingCash))
  const registerCode = String(payload.registerCode || context.config.defaultRegisterCode || 'REG-1').trim() || 'REG-1'

  const { data: insertedRow, error: insertError } = await db
    .from('pos_shift_sessions')
    .insert({
      org_id: orgId,
      branch_id: context.branchId,
      cashier_user_id: context.userId,
      opened_by: context.userId,
      register_code: registerCode,
      opening_cash: openingCash,
      expected_cash: openingCash,
      opening_notes: payload.openingNotes ? String(payload.openingNotes).trim() : null,
      cash_account_id: payload.cashAccountId ? String(payload.cashAccountId).trim() : null,
      transfer_account_id: payload.transferAccountId ? String(payload.transferAccountId).trim() : null,
      qris_account_id: payload.qrisAccountId ? String(payload.qrisAccountId).trim() : null,
      status: 'OPEN',
    })
    .select(`
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
    `)
    .maybeSingle()

  if (insertError) {
    return { error: `Gagal membuka shift POS: ${String(insertError.message || 'unknown error')}` }
  }

  revalidatePath('/pos')
  return {
    success: true,
    session: await buildPosShiftSummary(db, orgId, (insertedRow as PosShiftSessionRow) || {}, context.branchName),
  }
}

export async function closePosShift(
  orgId: string,
  payload: {
    sessionId?: string | null
    closingCash: number
    closingNotes?: string
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
        .select(`
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
        `)
        .eq('org_id', orgId)
        .eq('branch_id', context.branchId)
        .eq('cashier_user_id', context.userId)
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

  if (String(currentSession.cashier_user_id || '') !== context.userId) {
    return { error: 'Shift POS ini bukan milik user aktif.' }
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
      closed_by: context.userId,
      closed_at: new Date().toISOString(),
    })
    .eq('id', currentSession.id)
    .eq('org_id', orgId)
    .select(`
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
    `)
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
      settled_by: context.userId,
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

