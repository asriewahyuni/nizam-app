'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { hydratePurchaseTransparencyForEntries } from '@/modules/accounting/lib/purchase-ledger-transparency'
import type { JournalReferenceType } from '@/types/database.types'

export interface JournalLineInput {
  account_id: string
  debit: number
  credit: number
  memo?: string
}

export interface CreateJournalEntryInput {
  org_id: string
  branch_id?: string // Added for multi-branch support
  entry_date: string
  description: string
  reference_type?: JournalReferenceType
  reference_id?: string
  notes?: string
  lines: JournalLineInput[]
  auto_post?: boolean // if true, immediately post after creation
  allow_org_scope?: boolean
  skipRevalidate?: boolean
}

const JOURNAL_ENTRY_MAX_INSERT_RETRIES = 5

function isJournalEntryNumberCollision(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false

  const message = String(error.message || '').toLowerCase()
  const code = String(error.code || '')

  return code === '23505' && (
    message.includes('journal_entries_org_id_entry_number_key')
    || (message.includes('duplicate key') && message.includes('entry_number'))
  )
}

function getJournalInsertErrorMessage(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || '').trim()
  if (!message) return 'Gagal membuat jurnal.'

  if (isJournalEntryNumberCollision(error)) {
    return 'Nomor jurnal bentrok saat disimpan. Sistem sudah mencoba ulang, silakan coba lagi beberapa saat lagi.'
  }

  return message
}

async function getNextJournalEntryNumber(supabase: any, orgId: string) {
  const year = String(new Date().getFullYear())
  const prefix = `JE-${year}-`

  const { data, error } = await (supabase as any)
    .from('journal_entries')
    .select('entry_number')
    .eq('org_id', orgId)
    .like('entry_number', `${prefix}%`)
    .order('entry_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { error: error.message || 'Gagal membaca nomor jurnal terakhir.' }
  }

  const lastEntryNumber = String(data?.entry_number || '')
  const lastSequence = lastEntryNumber.startsWith(prefix)
    ? Number.parseInt(lastEntryNumber.slice(prefix.length), 10)
    : 0
  const nextSequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1

  return {
    entryNumber: `${prefix}${String(nextSequence).padStart(6, '0')}`,
  }
}

async function insertJournalEntryHeaderWithRetry(
  supabase: any,
  input: CreateJournalEntryInput,
  branchId: string | null,
  userId: string
) {
  let lastError: { message?: string; code?: string } | null = null

  for (let attempt = 0; attempt < JOURNAL_ENTRY_MAX_INSERT_RETRIES; attempt += 1) {
    const nextEntryNumberResult = await getNextJournalEntryNumber(supabase, input.org_id)
    if ('error' in nextEntryNumberResult) {
      return {
        data: null,
        error: { message: nextEntryNumberResult.error },
      }
    }

    const { data, error } = await (supabase as any)
      .from('journal_entries')
      .insert({
        org_id: input.org_id,
        branch_id: branchId,
        entry_number: nextEntryNumberResult.entryNumber,
        entry_date: input.entry_date,
        description: input.description,
        reference_type: input.reference_type || 'MANUAL',
        reference_id: input.reference_id || null,
        notes: input.notes || null,
        status: 'DRAFT',
        created_by: userId,
      })
      .select()
      .single()

    if (!error && data) {
      return { data, error: null }
    }

    if (!isJournalEntryNumberCollision(error)) {
      return { data: null, error }
    }

    lastError = error
  }

  return {
    data: null,
    error: lastError || { message: 'Gagal membuat jurnal setelah beberapa percobaan.' },
  }
}

async function resolveJournalBranchId(input: CreateJournalEntryInput) {
  if (input.branch_id) {
    const branchSelection = await resolveAccessibleBranchSelection(input.org_id, input.branch_id)
    if ('error' in branchSelection) return { error: branchSelection.error }
    return { branchId: branchSelection.branchId }
  }

  if (input.allow_org_scope) {
    return { branchId: null as string | null }
  }

  const branchSelection = await resolveAccessibleBranchSelection(input.org_id)
  if ('error' in branchSelection) return { error: branchSelection.error }
  if (!branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk membuat jurnal manual.' }
  }

  return { branchId: branchSelection.branchId }
}

async function getClosedFiscalPeriodName(
  supabase: any,
  orgId: string,
  entryDate?: string | null
): Promise<string | null> {
  const normalizedEntryDate = String(entryDate || '').trim()
  if (!normalizedEntryDate) return null

  const { data, error } = await (supabase as any)
    .from('fiscal_periods')
    .select('name')
    .eq('org_id', orgId)
    .eq('is_closed', true)
    .lte('start_date', normalizedEntryDate)
    .gte('end_date', normalizedEntryDate)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return String(data.name || '').trim() || null
}

function buildClosedPeriodMessage(entryDate: string, actionLabel: string, fiscalPeriodName?: string | null) {
  if (fiscalPeriodName) {
    return `Jurnal tanggal ${entryDate} berada pada periode fiskal "${fiscalPeriodName}" yang sudah ditutup. Jurnal tidak dapat ${actionLabel}.`
  }

  return `Jurnal tanggal ${entryDate} berada pada periode fiskal yang sudah ditutup. Jurnal tidak dapat ${actionLabel}.`
}

async function getClosedPeriodMessageForJournalDate(
  supabase: any,
  orgId: string,
  entryDate?: string | null,
  actionLabel = 'diubah'
) {
  const normalizedEntryDate = String(entryDate || '').trim()
  if (!normalizedEntryDate) return null

  const fiscalPeriodName = await getClosedFiscalPeriodName(supabase, orgId, normalizedEntryDate)
  if (!fiscalPeriodName) return null

  return buildClosedPeriodMessage(normalizedEntryDate, actionLabel, fiscalPeriodName)
}

async function getClosedPeriodMessageForJournalEntry(
  supabase: any,
  orgId: string,
  entryId: string,
  actionLabel = 'diubah'
) {
  const { data: entry, error } = await (supabase as any)
    .from('journal_entries')
    .select('entry_date')
    .eq('id', entryId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error || !entry?.entry_date) return null

  return getClosedPeriodMessageForJournalDate(supabase, orgId, String(entry.entry_date), actionLabel)
}

type JournalActionResult =
  | { success: true }
  | { error: string }

type VoidAuditParams = {
  orgId: string
  userId: string
  reason: string
}

function isRpcFunctionNotFound(
  error: { code?: string | null; message?: string | null } | null | undefined,
  functionName: string
) {
  if (!error) return false
  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  const fn = functionName.toLowerCase()

  if (code === 'PGRST202' || code === '42883') {
    return message.includes(fn) || message.includes('schema cache') || message.includes('does not exist')
  }

  return (
    message.includes(fn)
    && (
      message.includes('schema cache')
      || message.includes('does not exist')
      || message.includes('undefined function')
    )
  )
}

function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  columnName: string
) {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  const normalizedColumn = columnName.toLowerCase()

  if (code === 'PGRST204' || code === '42703') {
    return message.includes(normalizedColumn) || message.includes('schema cache')
  }

  return message.includes(normalizedColumn) && message.includes('column')
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function appendVoidNote(notes: unknown, reason: string) {
  const trimmedReason = String(reason || '').trim()
  const marker = trimmedReason
    ? `[VOIDED via Jurnal: ${trimmedReason}]`
    : '[VOIDED via Jurnal]'
  const currentNotes = String(notes || '').trim()

  if (!currentNotes) return marker
  if (currentNotes.includes(marker)) return currentNotes
  return `${currentNotes}\n${marker}`
}

async function adjustInventoryStockCompat(
  supabase: any,
  payload: { orgId: string; productId: string; warehouseId: string; diff: number }
): Promise<JournalActionResult> {
  const baseArgs = {
    p_org_id: payload.orgId,
    p_product_id: payload.productId,
    p_warehouse_id: payload.warehouseId,
    p_diff: payload.diff,
  }

  const { error: sixArgsError } = await (supabase as any).rpc('adjust_inventory_stock', {
    ...baseArgs,
    p_batch_number: null,
    p_bin_id: null,
  })

  if (!sixArgsError) return { success: true }

  if (!isRpcFunctionNotFound(sixArgsError, 'adjust_inventory_stock')) {
    return { error: sixArgsError.message || 'Gagal menyesuaikan stok.' }
  }

  const { error: fourArgsError } = await (supabase as any).rpc('adjust_inventory_stock', baseArgs)
  if (fourArgsError) {
    return { error: fourArgsError.message || 'Gagal menyesuaikan stok.' }
  }

  return { success: true }
}

async function reverseInventoryFromStockMovementsCompat(
  supabase: any,
  params: {
    orgId: string
    referenceType: string
    referenceId: string
    warehouseId?: string | null
    errorLabel: string
  }
): Promise<JournalActionResult> {
  const { data: stockMovements, error: movementError } = await (supabase as any)
    .from('stock_movements')
    .select('product_id, quantity')
    .eq('org_id', params.orgId)
    .eq('reference_type', params.referenceType)
    .eq('reference_id', params.referenceId)

  if (movementError) {
    return { error: `${params.errorLabel}: ${movementError.message}` }
  }

  const movementByProduct: Record<string, number> = {}
  for (const row of (stockMovements as Array<Record<string, unknown>> | null) || []) {
    const productId = String(row.product_id || '').trim()
    if (!productId) continue
    movementByProduct[productId] = toNumber(movementByProduct[productId]) + toNumber(row.quantity)
  }

  const productIds = Object.keys(movementByProduct)
  if (productIds.length === 0) return { success: true }

  if (!params.warehouseId) {
    return { error: `${params.errorLabel}: konteks gudang transaksi tidak ditemukan.` }
  }

  for (const productId of productIds) {
    const quantity = toNumber(movementByProduct[productId])
    if (Math.abs(quantity) <= 0.000001) continue

    const reverseResult = await adjustInventoryStockCompat(supabase, {
      orgId: params.orgId,
      productId,
      warehouseId: params.warehouseId,
      diff: -quantity,
    })

    if ('error' in reverseResult) {
      return { error: `${params.errorLabel}: ${reverseResult.error}` }
    }
  }

  return { success: true }
}

async function reverseInventoryAdjustmentItemsCompat(
  supabase: any,
  params: {
    orgId: string
    adjustmentId: string
  }
): Promise<JournalActionResult> {
  const { data: adjustmentItems, error } = await (supabase as any)
    .from('inventory_adjustment_items')
    .select('product_id, warehouse_id, diff_quantity')
    .eq('org_id', params.orgId)
    .eq('adjustment_id', params.adjustmentId)

  if (error) {
    return { error: 'Gagal membaca item adjustment untuk pembalikan stok: ' + error.message }
  }

  for (const item of (adjustmentItems as Array<Record<string, unknown>> | null) || []) {
    const productId = String(item.product_id || '').trim()
    const warehouseId = String(item.warehouse_id || '').trim()
    const diffQuantity = toNumber(item.diff_quantity)

    if (!productId || Math.abs(diffQuantity) <= 0.000001 || !warehouseId) continue

    const reverseResult = await adjustInventoryStockCompat(supabase, {
      orgId: params.orgId,
      productId,
      warehouseId,
      diff: -diffQuantity,
    })

    if ('error' in reverseResult) {
      return { error: 'Gagal membalik stok adjustment: ' + reverseResult.error }
    }
  }

  return { success: true }
}

async function deleteStockMovementsByReference(
  supabase: any,
  orgId: string,
  referenceType: string,
  referenceId: string
): Promise<JournalActionResult> {
  const { error } = await (supabase as any)
    .from('stock_movements')
    .delete()
    .eq('org_id', orgId)
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)

  if (error) {
    return { error: 'Gagal menghapus kartu stok: ' + error.message }
  }

  return { success: true }
}

async function voidJournalEntriesByReference(
  supabase: any,
  audit: VoidAuditParams,
  referenceType: string,
  referenceId: string
): Promise<JournalActionResult> {
  const { error } = await (supabase as any)
    .from('journal_entries')
    .update({
      status: 'VOIDED',
      voided_at: new Date().toISOString(),
      voided_by: audit.userId,
      void_reason: audit.reason,
    })
    .eq('org_id', audit.orgId)
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .eq('status', 'POSTED')

  if (error) {
    return { error: error.message || 'Gagal membatalkan jurnal referensi.' }
  }

  return { success: true }
}

async function voidSingleJournalEntry(
  supabase: any,
  audit: VoidAuditParams,
  entryId: string
): Promise<JournalActionResult> {
  const { data, error } = await (supabase as any)
    .from('journal_entries')
    .update({
      status: 'VOIDED',
      voided_at: new Date().toISOString(),
      voided_by: audit.userId,
      void_reason: audit.reason,
    })
    .eq('id', entryId)
    .eq('org_id', audit.orgId)
    .eq('status', 'POSTED')
    .select('id')
    .maybeSingle()

  if (error) {
    return { error: error.message || 'Gagal membatalkan jurnal.' }
  }

  if (!data?.id) {
    return { error: 'Jurnal tidak ditemukan atau statusnya sudah berubah.' }
  }

  return { success: true }
}

async function syncSalePaymentStatus(
  supabase: any,
  orgId: string,
  saleId: string
): Promise<JournalActionResult> {
  const { data: sale, error: saleError } = await (supabase as any)
    .from('sales')
    .select('grand_total')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (saleError) {
    return { error: 'Gagal membaca invoice penjualan: ' + saleError.message }
  }

  if (!sale) return { success: true }

  const { data: payments, error: paymentError } = await (supabase as any)
    .from('sales_payments')
    .select('amount, discount_amount')
    .eq('org_id', orgId)
    .eq('sale_id', saleId)

  if (paymentError) {
    return { error: 'Gagal membaca pembayaran penjualan: ' + paymentError.message }
  }

  const { data: returns, error: returnError } = await (supabase as any)
    .from('sales_returns')
    .select('grand_total, status')
    .eq('org_id', orgId)
    .eq('sale_id', saleId)

  if (returnError) {
    return { error: 'Gagal membaca retur penjualan: ' + returnError.message }
  }

  const totalPaid = ((payments as Array<Record<string, unknown>> | null) || []).reduce(
    (sum, payment) => sum + toNumber(payment.amount) + toNumber(payment.discount_amount),
    0
  )
  const totalReturned = ((returns as Array<Record<string, unknown>> | null) || []).reduce(
    (sum, salesReturn) => {
      if (String(salesReturn.status || '').toUpperCase() === 'VOIDED') return sum
      return sum + toNumber(salesReturn.grand_total)
    },
    0
  )

  const remaining = toNumber(sale.grand_total) - totalPaid - totalReturned
  const nextPaymentStatus =
    totalPaid <= 0.01
      ? 'UNPAID'
      : remaining <= 0.01
        ? 'PAID'
        : 'PARTIAL'

  const { error: syncError } = await (supabase as any)
    .from('sales')
    .update({ payment_status: nextPaymentStatus })
    .eq('id', saleId)
    .eq('org_id', orgId)

  if (syncError) {
    return { error: 'Gagal menyinkronkan status pembayaran penjualan: ' + syncError.message }
  }

  return { success: true }
}

async function syncPurchasePaymentStatus(
  supabase: any,
  orgId: string,
  purchaseId: string
): Promise<JournalActionResult> {
  const { data: purchase, error: purchaseError } = await (supabase as any)
    .from('purchases')
    .select('grand_total')
    .eq('id', purchaseId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (purchaseError) {
    return { error: 'Gagal membaca purchase order: ' + purchaseError.message }
  }

  if (!purchase) return { success: true }

  const { data: payments, error: paymentError } = await (supabase as any)
    .from('purchase_payments')
    .select('amount, discount_amount')
    .eq('org_id', orgId)
    .eq('purchase_id', purchaseId)

  if (paymentError) {
    return { error: 'Gagal membaca pembayaran pembelian: ' + paymentError.message }
  }

  const { data: returns, error: returnError } = await (supabase as any)
    .from('purchase_returns')
    .select('total_amount')
    .eq('org_id', orgId)
    .eq('purchase_id', purchaseId)

  if (returnError) {
    return { error: 'Gagal membaca retur pembelian: ' + returnError.message }
  }

  const totalPaid = ((payments as Array<Record<string, unknown>> | null) || []).reduce(
    (sum, payment) => sum + toNumber(payment.amount) + toNumber(payment.discount_amount),
    0
  )
  const totalReturned = ((returns as Array<Record<string, unknown>> | null) || []).reduce(
    (sum, purchaseReturn) => sum + toNumber(purchaseReturn.total_amount),
    0
  )

  const remaining = toNumber(purchase.grand_total) - totalPaid - totalReturned
  const nextPaymentStatus =
    totalPaid <= 0.01
      ? 'UNPAID'
      : remaining <= 0.01
        ? 'PAID'
        : 'PARTIAL'

  const { error: syncError } = await (supabase as any)
    .from('purchases')
    .update({ payment_status: nextPaymentStatus })
    .eq('id', purchaseId)
    .eq('org_id', orgId)

  if (syncError) {
    return { error: 'Gagal menyinkronkan status pembayaran pembelian: ' + syncError.message }
  }

  return { success: true }
}

async function fallbackVoidSaleReference(
  supabase: any,
  audit: VoidAuditParams,
  saleId: string
): Promise<JournalActionResult> {
  const { data: sale, error: saleError } = await (supabase as any)
    .from('sales')
    .select('id, status, warehouse_id')
    .eq('id', saleId)
    .eq('org_id', audit.orgId)
    .maybeSingle()

  if (saleError) return { error: 'Gagal membaca sales order: ' + saleError.message }
  if (!sale?.id) return { error: 'Sales order tidak ditemukan.' }

  const reverseResult = await reverseInventoryFromStockMovementsCompat(supabase, {
    orgId: audit.orgId,
    referenceType: 'SALE',
    referenceId: saleId,
    warehouseId: String(sale.warehouse_id || '').trim() || null,
    errorLabel: 'Gagal membalik stok sales order',
  })
  if ('error' in reverseResult) return reverseResult

  const deleteMovementResult = await deleteStockMovementsByReference(
    supabase,
    audit.orgId,
    'SALE',
    saleId
  )
  if ('error' in deleteMovementResult) return deleteMovementResult

  if (String(sale.status || '').toUpperCase() !== 'VOIDED') {
    const { error: saleUpdateError } = await (supabase as any)
      .from('sales')
      .update({ status: 'VOIDED' })
      .eq('id', saleId)
      .eq('org_id', audit.orgId)

    if (saleUpdateError) {
      return { error: 'Gagal membatalkan sales order: ' + saleUpdateError.message }
    }
  }

  return voidJournalEntriesByReference(supabase, audit, 'SALE', saleId)
}

async function fallbackVoidPurchaseReference(
  supabase: any,
  audit: VoidAuditParams,
  purchaseId: string
): Promise<JournalActionResult> {
  const { data: purchase, error: purchaseError } = await (supabase as any)
    .from('purchases')
    .select('id, status, warehouse_id')
    .eq('id', purchaseId)
    .eq('org_id', audit.orgId)
    .maybeSingle()

  if (purchaseError) return { error: 'Gagal membaca purchase order: ' + purchaseError.message }
  if (!purchase?.id) return { error: 'PO tidak ditemukan.' }

  const reverseResult = await reverseInventoryFromStockMovementsCompat(supabase, {
    orgId: audit.orgId,
    referenceType: 'PURCHASE',
    referenceId: purchaseId,
    warehouseId: String(purchase.warehouse_id || '').trim() || null,
    errorLabel: 'Gagal membalik stok pembelian',
  })
  if ('error' in reverseResult) return reverseResult

  const deleteMovementResult = await deleteStockMovementsByReference(
    supabase,
    audit.orgId,
    'PURCHASE',
    purchaseId
  )
  if ('error' in deleteMovementResult) return deleteMovementResult

  if (String(purchase.status || '').toUpperCase() !== 'VOIDED') {
    const { error: purchaseUpdateError } = await (supabase as any)
      .from('purchases')
      .update({ status: 'VOIDED' })
      .eq('id', purchaseId)
      .eq('org_id', audit.orgId)

    if (purchaseUpdateError) {
      return { error: 'Gagal membatalkan purchase order: ' + purchaseUpdateError.message }
    }
  }

  return voidJournalEntriesByReference(supabase, audit, 'PURCHASE', purchaseId)
}

async function voidSaleReference(
  supabase: any,
  audit: VoidAuditParams,
  saleId: string
): Promise<JournalActionResult> {
  const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc('void_sale_atomic', {
    p_org_id: audit.orgId,
    p_sale_id: saleId,
    p_user_id: audit.userId,
    p_reason: audit.reason,
  })

  if (!rpcErr && rpcRes?.success) {
    return { success: true }
  }

  const rpcErrorMessage = String(rpcRes?.error || rpcErr?.message || 'Unknown error')
  if (!isRpcFunctionNotFound({ code: rpcErr?.code || null, message: rpcErrorMessage }, 'void_sale_atomic')) {
    return { error: `Gagal membatalkan sales order secara atomik: ${rpcErrorMessage}` }
  }

  return fallbackVoidSaleReference(supabase, audit, saleId)
}

async function voidPurchaseReference(
  supabase: any,
  audit: VoidAuditParams,
  purchaseId: string
): Promise<JournalActionResult> {
  const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc('void_purchase_atomic', {
    p_org_id: audit.orgId,
    p_purchase_id: purchaseId,
    p_user_id: audit.userId,
    p_reason: audit.reason,
  })

  if (!rpcErr && rpcRes?.success) {
    return { success: true }
  }

  const rpcErrorMessage = String(rpcRes?.error || rpcErr?.message || 'Unknown error')
  if (!isRpcFunctionNotFound({ code: rpcErr?.code || null, message: rpcErrorMessage }, 'void_purchase_atomic')) {
    return { error: `Gagal membatalkan purchase order secara atomik: ${rpcErrorMessage}` }
  }

  return fallbackVoidPurchaseReference(supabase, audit, purchaseId)
}

async function voidSalesReturnReference(
  supabase: any,
  audit: VoidAuditParams,
  returnId: string
): Promise<JournalActionResult> {
  const { data: salesReturn, error: returnError } = await (supabase as any)
    .from('sales_returns')
    .select('id, sale_id, notes')
    .eq('id', returnId)
    .eq('org_id', audit.orgId)
    .maybeSingle()

  if (returnError) return { error: 'Gagal membaca retur penjualan: ' + returnError.message }
  if (!salesReturn?.id) return { error: 'Retur penjualan tidak ditemukan.' }

  let warehouseId: string | null = null
  if (salesReturn.sale_id) {
    const { data: sale, error: saleError } = await (supabase as any)
      .from('sales')
      .select('warehouse_id')
      .eq('id', salesReturn.sale_id)
      .eq('org_id', audit.orgId)
      .maybeSingle()

    if (saleError) return { error: 'Gagal membaca gudang sales return: ' + saleError.message }
    warehouseId = String(sale?.warehouse_id || '').trim() || null
  }

  const reverseResult = await reverseInventoryFromStockMovementsCompat(supabase, {
    orgId: audit.orgId,
    referenceType: 'SALES_RETURN',
    referenceId: returnId,
    warehouseId,
    errorLabel: 'Gagal membalik stok retur penjualan',
  })
  if ('error' in reverseResult) return reverseResult

  const deleteMovementResult = await deleteStockMovementsByReference(
    supabase,
    audit.orgId,
    'SALES_RETURN',
    returnId
  )
  if ('error' in deleteMovementResult) return deleteMovementResult

  const { error: itemDeleteError } = await (supabase as any)
    .from('sales_return_items')
    .delete()
    .eq('return_id', returnId)

  if (itemDeleteError) {
    return { error: 'Gagal menghapus item retur penjualan: ' + itemDeleteError.message }
  }

  const { error: returnUpdateError } = await (supabase as any)
    .from('sales_returns')
    .update({
      status: 'VOIDED',
      total_amount: 0,
      tax_amount: 0,
      grand_total: 0,
      notes: appendVoidNote(salesReturn.notes, audit.reason),
    })
    .eq('id', returnId)
    .eq('org_id', audit.orgId)

  if (returnUpdateError) {
    return { error: 'Gagal memperbarui retur penjualan: ' + returnUpdateError.message }
  }

  if (salesReturn.sale_id) {
    const syncResult = await syncSalePaymentStatus(supabase, audit.orgId, salesReturn.sale_id)
    if ('error' in syncResult) return syncResult
  }

  return voidJournalEntriesByReference(supabase, audit, 'SALES_RETURN', returnId)
}

async function voidPurchaseReturnReference(
  supabase: any,
  audit: VoidAuditParams,
  returnId: string
): Promise<JournalActionResult> {
  const { data: purchaseReturn, error: returnError } = await (supabase as any)
    .from('purchase_returns')
    .select('id, purchase_id, notes')
    .eq('id', returnId)
    .eq('org_id', audit.orgId)
    .maybeSingle()

  if (returnError) return { error: 'Gagal membaca retur pembelian: ' + returnError.message }
  if (!purchaseReturn?.id) return { error: 'Retur pembelian tidak ditemukan.' }

  let warehouseId: string | null = null
  if (purchaseReturn.purchase_id) {
    const { data: purchase, error: purchaseError } = await (supabase as any)
      .from('purchases')
      .select('warehouse_id')
      .eq('id', purchaseReturn.purchase_id)
      .eq('org_id', audit.orgId)
      .maybeSingle()

    if (purchaseError) return { error: 'Gagal membaca gudang purchase return: ' + purchaseError.message }
    warehouseId = String(purchase?.warehouse_id || '').trim() || null
  }

  const reverseResult = await reverseInventoryFromStockMovementsCompat(supabase, {
    orgId: audit.orgId,
    referenceType: 'PURCHASE_RETURN',
    referenceId: returnId,
    warehouseId,
    errorLabel: 'Gagal membalik stok retur pembelian',
  })
  if ('error' in reverseResult) return reverseResult

  const deleteMovementResult = await deleteStockMovementsByReference(
    supabase,
    audit.orgId,
    'PURCHASE_RETURN',
    returnId
  )
  if ('error' in deleteMovementResult) return deleteMovementResult

  const { error: itemDeleteError } = await (supabase as any)
    .from('purchase_return_items')
    .delete()
    .eq('return_id', returnId)

  if (itemDeleteError) {
    return { error: 'Gagal menghapus item retur pembelian: ' + itemDeleteError.message }
  }

  const updatePayload = {
    status: 'VOIDED',
    total_amount: 0,
    tax_amount: 0,
    notes: appendVoidNote(purchaseReturn.notes, audit.reason),
  }

  const { error: purchaseReturnUpdateError } = await (supabase as any)
    .from('purchase_returns')
    .update(updatePayload)
    .eq('id', returnId)
    .eq('org_id', audit.orgId)

  if (purchaseReturnUpdateError) {
    if (!isMissingColumnError(purchaseReturnUpdateError, 'status')) {
      return { error: 'Gagal memperbarui retur pembelian: ' + purchaseReturnUpdateError.message }
    }

    const { error: fallbackUpdateError } = await (supabase as any)
      .from('purchase_returns')
      .update({
        total_amount: 0,
        tax_amount: 0,
        notes: appendVoidNote(purchaseReturn.notes, audit.reason),
      })
      .eq('id', returnId)
      .eq('org_id', audit.orgId)

    if (fallbackUpdateError) {
      return { error: 'Gagal memperbarui retur pembelian: ' + fallbackUpdateError.message }
    }
  }

  if (purchaseReturn.purchase_id) {
    const syncResult = await syncPurchasePaymentStatus(supabase, audit.orgId, purchaseReturn.purchase_id)
    if ('error' in syncResult) return syncResult
  }

  return voidJournalEntriesByReference(supabase, audit, 'PURCHASE_RETURN', returnId)
}

async function voidInventoryAdjustmentReference(
  supabase: any,
  audit: VoidAuditParams,
  entryId: string,
  refType: string,
  referenceId: string
): Promise<JournalActionResult> {
  const { data: adjustment, error: adjustmentError } = await (supabase as any)
    .from('inventory_adjustments')
    .select('id, notes')
    .eq('id', referenceId)
    .eq('org_id', audit.orgId)
    .maybeSingle()

  if (adjustmentError) {
    return { error: 'Gagal membaca inventory adjustment: ' + adjustmentError.message }
  }

  if (adjustment?.id) {
    const reverseResult = await reverseInventoryAdjustmentItemsCompat(supabase, {
      orgId: audit.orgId,
      adjustmentId: referenceId,
    })
    if ('error' in reverseResult) return reverseResult

    const deleteMovementResult = await deleteStockMovementsByReference(
      supabase,
      audit.orgId,
      'ADJUSTMENT',
      referenceId
    )
    if ('error' in deleteMovementResult) return deleteMovementResult

    const { error: adjustmentUpdateError } = await (supabase as any)
      .from('inventory_adjustments')
      .update({
        status: 'VOIDED',
        notes: appendVoidNote(adjustment.notes, audit.reason),
      })
      .eq('id', referenceId)
      .eq('org_id', audit.orgId)

    if (adjustmentUpdateError) {
      return { error: 'Gagal memperbarui inventory adjustment: ' + adjustmentUpdateError.message }
    }

    return refType === 'INVENTORY_ADJ'
      ? voidJournalEntriesByReference(supabase, audit, 'INVENTORY_ADJ', referenceId)
      : voidSingleJournalEntry(supabase, audit, entryId)
  }

  const { data: asset, error: assetError } = await (supabase as any)
    .from('fixed_assets')
    .select('id')
    .eq('id', referenceId)
    .eq('org_id', audit.orgId)
    .maybeSingle()

  if (assetError) {
    return { error: 'Gagal membaca aset tetap: ' + assetError.message }
  }

  if (asset?.id) {
    const { error: assetUpdateError } = await (supabase as any)
      .from('fixed_assets')
      .update({ status: 'VOIDED' })
      .eq('id', referenceId)
      .eq('org_id', audit.orgId)

    if (assetUpdateError) {
      return { error: 'Gagal memperbarui aset tetap: ' + assetUpdateError.message }
    }
  }

  return voidSingleJournalEntry(supabase, audit, entryId)
}

async function voidSalesPaymentReference(
  supabase: any,
  audit: VoidAuditParams,
  paymentRefType: string,
  paymentId: string
): Promise<JournalActionResult> {
  const { data: payment, error: paymentError } = await (supabase as any)
    .from('sales_payments')
    .select('id, sale_id')
    .eq('id', paymentId)
    .eq('org_id', audit.orgId)
    .maybeSingle()

  if (paymentError) return { error: 'Gagal membaca pembayaran penjualan: ' + paymentError.message }

  if (payment?.id) {
    const { error: deleteError } = await (supabase as any)
      .from('sales_payments')
      .delete()
      .eq('id', paymentId)
      .eq('org_id', audit.orgId)

    if (deleteError) {
      return { error: 'Gagal membatalkan pembayaran penjualan: ' + deleteError.message }
    }

    if (payment.sale_id) {
      const syncResult = await syncSalePaymentStatus(supabase, audit.orgId, payment.sale_id)
      if ('error' in syncResult) return syncResult
    }
  }

  return voidJournalEntriesByReference(supabase, audit, paymentRefType, paymentId)
}

async function voidPurchasePaymentReference(
  supabase: any,
  audit: VoidAuditParams,
  paymentRefType: string,
  paymentId: string
): Promise<JournalActionResult> {
  const { data: payment, error: paymentError } = await (supabase as any)
    .from('purchase_payments')
    .select('id, purchase_id')
    .eq('id', paymentId)
    .eq('org_id', audit.orgId)
    .maybeSingle()

  if (paymentError) return { error: 'Gagal membaca pembayaran pembelian: ' + paymentError.message }

  if (payment?.id) {
    const { error: deleteError } = await (supabase as any)
      .from('purchase_payments')
      .delete()
      .eq('id', paymentId)
      .eq('org_id', audit.orgId)

    if (deleteError) {
      return { error: 'Gagal membatalkan pembayaran pembelian: ' + deleteError.message }
    }

    if (payment.purchase_id) {
      const syncResult = await syncPurchasePaymentStatus(supabase, audit.orgId, payment.purchase_id)
      if ('error' in syncResult) return syncResult
    }
  }

  return voidJournalEntriesByReference(supabase, audit, paymentRefType, paymentId)
}

async function voidCashReference(
  supabase: any,
  audit: VoidAuditParams,
  refType: string,
  referenceId: string
): Promise<JournalActionResult> {
  const { data: bankTransaction, error: bankTransactionError } = await (supabase as any)
    .from('bank_transactions')
    .select('id')
    .eq('id', referenceId)
    .eq('org_id', audit.orgId)
    .maybeSingle()

  if (bankTransactionError) {
    return { error: 'Gagal membaca transaksi kas/bank: ' + bankTransactionError.message }
  }

  if (bankTransaction?.id) {
    const { error: bankUpdateError } = await (supabase as any)
      .from('bank_transactions')
      .update({ status: 'VOIDED' })
      .eq('id', referenceId)
      .eq('org_id', audit.orgId)

    if (bankUpdateError) {
      return { error: 'Gagal memperbarui transaksi kas/bank: ' + bankUpdateError.message }
    }

    return voidJournalEntriesByReference(supabase, audit, refType, referenceId)
  }

  if (refType === 'CASH_OUT') {
    const { data: reimbursement, error: reimbursementError } = await (supabase as any)
      .from('reimbursements')
      .select('id')
      .eq('id', referenceId)
      .eq('org_id', audit.orgId)
      .maybeSingle()

    if (reimbursementError) {
      return { error: 'Gagal membaca reimbursement: ' + reimbursementError.message }
    }

    if (reimbursement?.id) {
      const { error: reimbursementUpdateError } = await (supabase as any)
        .from('reimbursements')
        .update({
          status: 'APPROVED',
          journal_id: null,
        })
        .eq('id', referenceId)
        .eq('org_id', audit.orgId)

      if (reimbursementUpdateError) {
        return { error: 'Gagal memperbarui reimbursement: ' + reimbursementUpdateError.message }
      }
    }
  }

  return voidJournalEntriesByReference(supabase, audit, refType, referenceId)
}

function revalidateAfterJournalMutation() {
  revalidatePath('/accounting/journal')
  revalidatePath('/accounting/assets')
  revalidatePath('/sales')
  revalidatePath('/purchasing')
  revalidatePath('/purchase')
  revalidatePath('/inventory')
  revalidatePath('/cash')
  revalidatePath('/reports')
}

export async function getUnpostedJournalsCount(orgId: string, branchId?: string | null): Promise<number> {
  const supabase = await createClient()
  let query = (supabase as any)
    .from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { count, error } = await query

  if (error) {
    (console as any).error('Error fetching unposted journals count:', error)
    return 0
  }
  return count || 0
}

// ─────────────────────────────────────────────────────────────
// createJournalEntry — Core accounting engine
// Creates header + lines, optionally posts immediately
// ─────────────────────────────────────────────────────────────
export async function createJournalEntry(input: CreateJournalEntryInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  // Validate: minimum 2 lines
  if (input.lines.length < 2) {
    return { error: 'Minimal 2 baris jurnal diperlukan.' }
  }

  // Validate: balanced entry
  const totalDebit = input.lines.reduce((s: any, l: any) => s + (l.debit || 0), 0)
  const totalCredit = input.lines.reduce((s: any, l: any) => s + (l.credit || 0), 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: `Jurnal tidak balance: debit ${totalDebit} ≠ credit ${totalCredit}` }
  }

  const resolvedBranch = await resolveJournalBranchId(input)
  if ('error' in resolvedBranch) return resolvedBranch

  const closedPeriodMessage = await getClosedPeriodMessageForJournalDate(
    supabase,
    input.org_id,
    input.entry_date,
    'dibuat'
  )
  if (closedPeriodMessage) {
    return { error: closedPeriodMessage }
  }

  // Insert header with explicit entry number so PO receipt is not blocked by
  // trigger collisions from COUNT(*)-based numbering.
  const { data: entry, error: entryError } = await insertJournalEntryHeaderWithRetry(
    supabase,
    input,
    resolvedBranch.branchId,
    user.id
  )

  if (entryError || !entry) {
    return { error: getJournalInsertErrorMessage(entryError) }
  }

  // Insert lines
  const { error: linesError } = await (supabase as any)
    .from('journal_lines')
    .insert(
      input.lines.map((line) => ({
        entry_id: entry.id,
        account_id: line.account_id,
        debit: line.debit || 0,
        credit: line.credit || 0,
        memo: line.memo || null,
      }))
    )

  if (linesError) {
    // Clean up orphaned header
    await (supabase as any).from('journal_entries').delete().eq('id', entry.id)
    return { error: 'Gagal menyimpan baris jurnal.' }
  }

  // Auto-post if requested
  if (input.auto_post) {
    const result = await postJournalEntry(entry.id, input.org_id, {
      skipRevalidate: input.skipRevalidate,
    })
    if ((result as any).error) return result
  }

  if (!input.skipRevalidate) {
    revalidatePath('/accounting/journal')
  }
  return { success: true, entryId: entry.id, entryNumber: entry.entry_number }
}

// ─────────────────────────────────────────────────────────────
// postJournalEntry — Post (finalize) a DRAFT entry
// DB trigger validates balance before allowing this
// ─────────────────────────────────────────────────────────────
export async function postJournalEntry(
  entryId: string,
  orgId: string,
  options?: { skipRevalidate?: boolean }
) {
  const supabase = await createClient()

  const closedPeriodMessage = await getClosedPeriodMessageForJournalEntry(
    supabase,
    orgId,
    entryId,
    'diposting'
  )
  if (closedPeriodMessage) {
    return { error: closedPeriodMessage }
  }

  const { error } = await (supabase as any)
    .from('journal_entries')
    .update({ status: 'POSTED' })
    .eq('id', entryId)
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')

  if (error) {
    return { error: error.message || 'Gagal memposting jurnal.' }
  }

  if (!options?.skipRevalidate) {
    revalidatePath('/accounting/journal')
  }
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// voidJournalEntry — Void a POSTED entry (with reason)
// ─────────────────────────────────────────────────────────────
export async function voidJournalEntry(
  entryId: string,
  orgId: string,
  reason: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const { data: entry, error: entryError } = await (supabase as any)
    .from('journal_entries')
    .select('entry_date, status, reference_type, reference_id')
    .eq('id', entryId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (entryError) return { error: entryError.message || 'Gagal membaca jurnal.' }
  if (!entry) return { error: 'Jurnal tidak ditemukan.' }
  if (String(entry.status || '').toUpperCase() === 'VOIDED') return { success: true }
  if (String(entry.status || '').toUpperCase() !== 'POSTED') {
    return { error: 'Hanya jurnal POSTED yang dapat di-void.' }
  }

  const closedPeriodMessage = await getClosedPeriodMessageForJournalDate(
    supabase,
    orgId,
    String(entry.entry_date || ''),
    'di-void'
  )
  if (closedPeriodMessage) {
    return { error: closedPeriodMessage }
  }

  const audit = {
    orgId,
    userId: user.id,
    reason,
  } satisfies VoidAuditParams

  const refId = String(entry.reference_id || '').trim()
  const refType = String(entry.reference_type || '').trim().toUpperCase()

  let result: JournalActionResult
  if (!refId) {
    result = await voidSingleJournalEntry(supabase, audit, entryId)
  } else {
    switch (refType) {
      case 'SALE':
        result = await voidSaleReference(supabase, audit, refId)
        break
      case 'PURCHASE':
        result = await voidPurchaseReference(supabase, audit, refId)
        break
      case 'SALES_RETURN':
        result = await voidSalesReturnReference(supabase, audit, refId)
        break
      case 'PURCHASE_RETURN':
        result = await voidPurchaseReturnReference(supabase, audit, refId)
        break
      case 'INVENTORY_ADJ':
      case 'ADJUSTMENT':
        result = await voidInventoryAdjustmentReference(supabase, audit, entryId, refType, refId)
        break
      case 'PAYMENT_IN':
        result = await voidSalesPaymentReference(supabase, audit, refType, refId)
        break
      case 'PAYMENT_OUT':
      case 'PURCHASE_PAYMENT':
        result = await voidPurchasePaymentReference(supabase, audit, refType, refId)
        break
      case 'CASH_IN':
      case 'CASH_OUT':
      case 'BANK_TRANSFER':
        result = await voidCashReference(supabase, audit, refType, refId)
        break
      default:
        result = await voidSingleJournalEntry(supabase, audit, entryId)
        break
    }
  }

  if ('error' in result) return result

  revalidateAfterJournalMutation()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// unvoidJournalEntry — Kembalikan jurnal VOIDED ke POSTED
// ─────────────────────────────────────────────────────────────
export async function unvoidJournalEntry(entryId: string, orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const { data: entry, error: entryError } = await (supabase as any)
    .from('journal_entries')
    .select('status, entry_number')
    .eq('id', entryId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (entryError) return { error: entryError.message || 'Gagal membaca jurnal.' }
  if (!entry) return { error: 'Jurnal tidak ditemukan.' }
  if (String(entry.status || '').toUpperCase() !== 'VOIDED') {
    return { error: 'Hanya jurnal VOIDED yang dapat dikembalikan.' }
  }

  const { error } = await (supabase as any)
    .from('journal_entries')
    .update({
      status: 'POSTED',
      voided_at: null,
      voided_by: null,
      void_reason: null,
    })
    .eq('id', entryId)
    .eq('org_id', orgId)

  if (error) return { error: error.message || 'Gagal mengembalikan jurnal dari void.' }

  revalidateAfterJournalMutation()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// deleteJournalEntry — Soft-delete (Hidden from UI)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// deleteJournalEntry — Soft-delete (Hidden from UI) for Posted/Reference
// ─────────────────────────────────────────────────────────────
export async function deleteJournalEntry(entryId: string, orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const closedPeriodMessage = await getClosedPeriodMessageForJournalEntry(
    supabase,
    orgId,
    entryId,
    'disembunyikan'
  )
  if (closedPeriodMessage) {
    return { error: closedPeriodMessage }
  }

  const { error } = await (supabase as any)
    .from('journal_entries')
    .update({ 
      status: 'VOIDED', 
      void_reason: 'HARD_DELETE_HIDDEN',
      voided_at: new Date().toISOString(),
      voided_by: user.id
    })
    .eq('id', entryId)
    .eq('org_id', orgId)

  if (error) return { error: 'Gagal memperbarui jurnal: ' + error.message }

  revalidatePath('/accounting/journal')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// hardDeleteDraftJournal — Actual delete for DRAFT status
// ─────────────────────────────────────────────────────────────
export async function hardDeleteDraftJournal(entryId: string, orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const closedPeriodMessage = await getClosedPeriodMessageForJournalEntry(
    supabase,
    orgId,
    entryId,
    'dihapus'
  )
  if (closedPeriodMessage) {
    return { error: closedPeriodMessage }
  }

  // We explicitly check for DRAFT status to prevent deleting posted data
  // Using .select() to verify if any rows were actually affected (RLS check)
  const { data, error } = await (supabase as any)
    .from('journal_entries')
    .delete()
    .eq('id', entryId)
    .eq('org_id', orgId)
    .eq('status', 'DRAFT')
    .select('id')

  if (error) return { error: 'Gagal menghapus draft: ' + error.message }
  if (!data || data.length === 0) {
    return { error: 'Gagal menghapus draft. Mungkin Anda tidak memiliki izin atau data sudah terhapus/berubah status.' }
  }

  revalidatePath('/accounting/journal')
  revalidatePath('/settings/accounts') 
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// getJournalEntries — List with filters
// ─────────────────────────────────────────────────────────────
export async function getJournalEntries(
  orgId: string,
  filters?: {
    status?: string
    branch_id?: string
    fromDate?: string
    toDate?: string
    limit?: number
  }
) {
  const { queryPostgres } = await import('@/lib/db/postgres')
  const toNumber = (value: unknown) => {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  // Build parameterized query dynamically
  const params: unknown[] = [orgId]
  const whereClauses: string[] = [
    `je.org_id = $1`,
    `(je.void_reason IS NULL OR je.void_reason <> 'HARD_DELETE_HIDDEN')`,
  ]

  if (filters?.status) {
    whereClauses.push(`je.status = $${params.push(filters.status)}`)
  }
  if (filters?.branch_id) {
    whereClauses.push(`je.branch_id = $${params.push(filters.branch_id)}`)
  }
  if (filters?.fromDate) {
    whereClauses.push(`je.entry_date >= $${params.push(filters.fromDate)}`)
  }
  if (filters?.toDate) {
    whereClauses.push(`je.entry_date <= $${params.push(filters.toDate)}`)
  }

  const limit = filters?.limit || 50
  params.push(limit)

  let entryRows: any[] = []
  try {
    const result = await queryPostgres<Record<string, unknown>>(`
      SELECT je.*
      FROM   public.journal_entries je
      WHERE  ${whereClauses.join(' AND ')}
      ORDER  BY je.entry_date DESC, je.created_at DESC
      LIMIT  $${params.length}
    `, params)
    entryRows = result.rows
  } catch (err) {
    ;(console as any).error('[getJournalEntries] raw SQL error:', err)
    return []
  }

  if (entryRows.length === 0) return []

  // Fetch journal lines with account info in one query
  const entryIds = entryRows.map((r) => r.id)
  const linesByEntryId: Record<string, any[]> = {}
  try {
    const linesResult = await queryPostgres<Record<string, unknown>>(`
      SELECT
        jl.*,
        a.code AS account_code,
        a.name AS account_name,
        a.type AS account_type
      FROM   public.journal_lines jl
      LEFT JOIN public.accounts a ON a.id = jl.account_id
      WHERE  jl.entry_id = ANY($1::uuid[])
    `, [entryIds])

    for (const line of linesResult.rows) {
      const eid = String(line.entry_id ?? '')
      if (!linesByEntryId[eid]) linesByEntryId[eid] = []
      linesByEntryId[eid].push({
        ...line,
        debit: toNumber(line.debit),
        credit: toNumber(line.credit),
        // UI expects line.accounts?.code, line.accounts?.name, line.accounts?.type
        accounts: line.account_name
          ? { code: line.account_code, name: line.account_name, type: line.account_type }
          : null,
      })
    }
  } catch (err) {
    ;(console as any).error('[getJournalEntries] lines SQL error:', err)
  }

  const entries = entryRows.map((row) => {
    const eid = String(row.id ?? '')
    const lines = (linesByEntryId[eid] ?? [])
      .sort((a: any, b: any) => (Number(b.debit) || 0) - (Number(a.debit) || 0))
    return { ...row, journal_lines: lines }
  })

  try {
    return await hydratePurchaseTransparencyForEntries(entries, queryPostgres)
  } catch (err) {
    ;(console as any).error('[getJournalEntries] purchase transparency hydrate error:', err)
    return entries.map((entry) => ({ ...entry, purchase_transparency: null }))
  }
}
