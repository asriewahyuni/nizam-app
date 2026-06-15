'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { ERPBridge } from '@/lib/erp-bridge/finances'
import { queryPostgres } from '@/lib/db/postgres'
import { getResellerCommissionSnapshot } from '@/modules/sales/actions/commission.actions'
import {
  calculateSalesPromoDiscount,
  getUsableSalesPromoByCodeWithDb,
  incrementSalesPromoUsage,
} from '@/modules/sales/actions/promo.actions'
import {
  getSellableBranchStockShortages,
} from '@/modules/sales/lib/stock-guard.server'
import { listActiveSalesWarehouses } from '@/modules/sales/lib/warehouse-branch-compat.server'
import { checkClosedFiscalPeriod, buildClosedPeriodError } from '@/lib/erp-bridge/fiscal-period'
import { getDateInTimeZone } from '@/lib/utils'

type ActiveBranchResult =
  | { branchId: string }
  | { error: string }

type DeliveryWarehouseResult =
  | { warehouseId: string }
  | { error: string }

type InventoryRequirement = {
  productId: string
  productName: string
  requiredQty: number
  unit: string | null
}

type DeliveryShortageResolution = 'PRODUCTION' | 'PURCHASING'

type DeliveryShortage = {
  productId: string
  productName: string
  requiredQty: number
  availableQty: number
  shortageQty: number
  unit: string | null
  bomId: string | null
  resolution: DeliveryShortageResolution
}

type DeliveryStockCheckResult =
  | { success: true }
  | { error: string; shortages: DeliveryShortage[] }

type AutoSaleShariahResolutionResult =
  | { mode: 'SALAM' | 'ISTISHNA' | null }
  | { error: string }

const STOCK_EPSILON = 0.000001
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Normalize low-level delivery RPC failures into user-facing sales messages.
 * This prevents duplicate delivery journals from surfacing as raw SQL errors.
 */
function getSalesDeliveryRpcErrorMessage(error: { message?: string | null; code?: string | null } | null | undefined) {
  const code = String(error?.code || '').trim()
  const rawMessage = String(error?.message || '').trim()
  const normalizedMessage = rawMessage.toLowerCase()

  if (
    code === '23505'
    && (
      normalizedMessage.includes('uq_journal_ref_per_org')
      || (normalizedMessage.includes('duplicate key') && normalizedMessage.includes('journal'))
    )
  ) {
    return 'Sales ini sudah memiliki jurnal delivery. Sistem menolak membuat jurnal SALE ganda. Muat ulang data; jika status sales masih belum selesai, rekonsiliasi jurnal delivery lama terlebih dahulu.'
  }

  if (!rawMessage) {
    return 'Gagal memproses delivery sales.'
  }

  return `Gagal memproses delivery sales: ${rawMessage}`
}

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  if (Math.abs(rounded) < STOCK_EPSILON) return '0'
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(6).replace(/\.?0+$/, '')
}

function buildSaleShortageMarker(saleId: string, productId: string) {
  return `[AUTO_SO_SHORTAGE:${saleId}:${productId}]`
}

async function reserveUniqueWorkOrderNumber(
  supabase: any,
  orgId: string,
  baseNumber: string
) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? baseNumber : `${baseNumber}-${attempt + 1}`
    const { data, error } = await (supabase as any)
      .from('production_work_orders')
      .select('id')
      .eq('org_id', orgId)
      .eq('wo_number', candidate)
      .limit(1)
      .maybeSingle()

    if (error) {
      return { error: 'Gagal menyiapkan nomor SPK otomatis: ' + error.message }
    }

    if (!data?.id) {
      return { woNumber: candidate }
    }
  }

  return { woNumber: `${baseNumber}-${Date.now().toString().slice(-4)}` }
}

/**
 * Convert DB date values into stable YYYY-MM-DD strings for client components.
 * Raw postgres results may surface `date` columns as `Date` objects.
 */
function normalizeDateOnlyValue(value: unknown): string | null {
  if (!value) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (DATE_ONLY_PATTERN.test(trimmed)) return trimmed

    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return null
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }

  const normalized = String(value).trim()
  if (!normalized) return null
  if (DATE_ONLY_PATTERN.test(normalized)) return normalized

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

/**
 * Convert timestamp-like values into ISO strings that are safe to pass to client components.
 */
function normalizeDateTimeValue(value: unknown): string | null {
  if (!value) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toISOString()
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString()
  }

  const normalized = String(value).trim()
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function normalizeShariahMode(value?: string | null): string {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
  if (normalized === 'SALAM' || normalized === 'ISTISHNA') return normalized
  return 'CASH'
}

type SalesAdjustmentMode = 'FIXED' | 'PERCENT'
type NormalizedSalesTaxBreakdown = Record<'PPN' | 'PPH_21' | 'PPH_23' | 'PAJAK_DAERAH', {
  mode: SalesAdjustmentMode
  value: number
  amount: number
}>
type NormalizedSalesOtherChargeLine = {
  label: string
  mode: SalesAdjustmentMode
  value: number
  amount: number
}
const DEFAULT_SALES_ADJUSTMENT_MODE: SalesAdjustmentMode = 'PERCENT'

function roundSalesTaxValue(value: unknown): number {
  const normalized = Number(value || 0)
  if (!Number.isFinite(normalized)) return 0
  return Number(Math.max(0, normalized).toFixed(2))
}

function normalizeSalesAdjustmentMode(value: unknown): SalesAdjustmentMode {
  return String(value || '').trim().toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENT'
}

function normalizeSalesTaxPercent(value: unknown): number {
  const normalized = Number(value || 0)
  if (!Number.isFinite(normalized) || normalized <= 0) return 0
  return Number(Math.min(100, Math.max(0, normalized)).toFixed(2))
}

function normalizeSalesAdjustmentValue(mode: SalesAdjustmentMode, value: unknown): number {
  return mode === 'PERCENT' ? normalizeSalesTaxPercent(value) : roundSalesTaxValue(value)
}

function calculateSalesAdjustmentAmount(baseAmount: number, mode: SalesAdjustmentMode, value: unknown): number {
  const normalizedValue = normalizeSalesAdjustmentValue(mode, value)
  if (normalizedValue <= 0) return 0
  if (mode === 'PERCENT') {
    return roundSalesTaxValue((Math.max(0, baseAmount) * normalizedValue) / 100)
  }
  return roundSalesTaxValue(normalizedValue)
}

function createEmptySalesTaxBreakdown(): NormalizedSalesTaxBreakdown {
  return {
    PPN: { mode: DEFAULT_SALES_ADJUSTMENT_MODE, value: 0, amount: 0 },
    PPH_21: { mode: DEFAULT_SALES_ADJUSTMENT_MODE, value: 0, amount: 0 },
    PPH_23: { mode: DEFAULT_SALES_ADJUSTMENT_MODE, value: 0, amount: 0 },
    PAJAK_DAERAH: { mode: DEFAULT_SALES_ADJUSTMENT_MODE, value: 0, amount: 0 },
  }
}

function getSalesTaxBreakdownTotal(taxBreakdown: NormalizedSalesTaxBreakdown): number {
  return roundSalesTaxValue(
    taxBreakdown.PPN.amount +
    taxBreakdown.PPH_21.amount +
    taxBreakdown.PPH_23.amount +
    taxBreakdown.PAJAK_DAERAH.amount
  )
}

function normalizeSalesTaxBreakdown(
  value: unknown,
  taxableAmount: number,
  fallbackTaxAmount?: unknown
): NormalizedSalesTaxBreakdown {
  const safeTaxableAmount = roundSalesTaxValue(taxableAmount)
  const normalizedBreakdown = createEmptySalesTaxBreakdown()

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const source = value as Record<string, unknown>
    let hasActiveTax = false

    for (const taxType of ['PPN', 'PPH_21', 'PPH_23', 'PAJAK_DAERAH'] as const) {
      const rawEntry = source[taxType]
      if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue

      const entry = rawEntry as Record<string, unknown>
      const mode = normalizeSalesAdjustmentMode(
        entry.mode ?? (Number(entry.percent || 0) > 0 ? 'PERCENT' : 'FIXED')
      )
      const normalizedValue = normalizeSalesAdjustmentValue(
        mode,
        entry.value ?? (mode === 'PERCENT' ? entry.percent : entry.amount)
      )
      const amount = roundSalesTaxValue(
        entry.amount ?? calculateSalesAdjustmentAmount(safeTaxableAmount, mode, normalizedValue)
      )

      normalizedBreakdown[taxType] = { mode, value: normalizedValue, amount }
      if (normalizedValue > 0 || amount > 0) {
        hasActiveTax = true
      }
    }

    if (hasActiveTax) {
      return normalizedBreakdown
    }
  }

  const safeFallbackTaxAmount = roundSalesTaxValue(fallbackTaxAmount)
  if (safeFallbackTaxAmount > 0) {
    normalizedBreakdown.PPN = {
      mode: safeTaxableAmount > 0 ? 'PERCENT' : 'FIXED',
      value: safeTaxableAmount > 0 ? roundSalesTaxValue((safeFallbackTaxAmount / safeTaxableAmount) * 100) : safeFallbackTaxAmount,
      amount: safeFallbackTaxAmount,
    }
  }

  return normalizedBreakdown
}

function getSalesOtherChargeTotal(lines: NormalizedSalesOtherChargeLine[]): number {
  return roundSalesTaxValue(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0))
}

function normalizeSalesOtherChargeBreakdown(
  value: unknown,
  baseAmount: number,
  fallbackOtherChargeAmount?: unknown
): NormalizedSalesOtherChargeLine[] {
  if (Array.isArray(value)) {
    const normalizedLines = value.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []

      const rawEntry = entry as Record<string, unknown>
      const mode = normalizeSalesAdjustmentMode(rawEntry.mode)
      const normalizedValue = normalizeSalesAdjustmentValue(
        mode,
        rawEntry.value ?? (mode === 'PERCENT' ? rawEntry.percent : rawEntry.amount)
      )
      const amount = roundSalesTaxValue(
        rawEntry.amount ?? calculateSalesAdjustmentAmount(baseAmount, mode, normalizedValue)
      )

      if (normalizedValue <= 0 && amount <= 0) return []

      return [{
        label: String(rawEntry.label || '').trim() || 'Biaya Lain',
        mode,
        value: normalizedValue,
        amount,
      }]
    })

    if (normalizedLines.length > 0) {
      return normalizedLines
    }
  }

  const safeFallbackOtherChargeAmount = roundSalesTaxValue(fallbackOtherChargeAmount)
  if (safeFallbackOtherChargeAmount > 0) {
    return [{
      label: 'Biaya Lain',
      mode: 'FIXED',
      value: safeFallbackOtherChargeAmount,
      amount: safeFallbackOtherChargeAmount,
    }]
  }

  return []
}

function calculateConfiguredHeaderDiscount(baseAmount: number, mode: unknown, value: unknown): number {
  const normalizedBase = Math.max(0, Number(baseAmount || 0))
  const normalizedValue = Math.max(0, Number(value || 0))
  if (!Number.isFinite(normalizedBase) || !Number.isFinite(normalizedValue) || normalizedBase <= 0 || normalizedValue <= 0) {
    return 0
  }

  const normalizedMode = String(mode || '').trim().toUpperCase() === 'PERCENT' ? 'PERCENT' : 'FIXED'
  if (normalizedMode === 'PERCENT') {
    return Math.min(
      normalizedBase,
      Math.round(normalizedBase * (Math.min(100, normalizedValue) / 100))
    )
  }

  return Math.min(normalizedBase, Math.round(normalizedValue))
}

function isSalamMode(value?: string | null): boolean {
  return normalizeShariahMode(value) === 'SALAM'
}

async function ensureCreateSaleStockAvailability(
  supabase: any,
  orgId: string,
  branchId: string,
  lines: Array<{ product_id?: string | null; product_name?: string | null; quantity?: number }>
): Promise<{ shortages: Array<{
  productId: string
  productName: string
  requiredQty: number
  onHandQty: number
  reservedQty: number
  sellableQty: number
  shortageQty: number
}> } | { error: string }> {
  return getSellableBranchStockShortages(supabase, {
    orgId,
    branchId,
    lines,
  })
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null
  return (value as T | null) ?? null
}

async function getPreferredProductionBomByProduct(
  supabase: any,
  orgId: string,
  branchId: string,
  productIds: string[]
): Promise<{ bomByProduct: Map<string, { id: string; branchId: string | null }> } | { error: string }> {
  const normalizedProductIds = [...new Set(productIds.map((productId) => String(productId || '').trim()).filter(Boolean))]
  if (!normalizedProductIds.length) {
    return { bomByProduct: new Map() }
  }

  const { data: bomRows, error: bomError } = await (supabase as any)
    .from('production_boms')
    .select('id, product_id, branch_id')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('product_id', normalizedProductIds)
    .or(`branch_id.is.null,branch_id.eq.${branchId}`)

  if (bomError) {
    return { error: 'Gagal membaca BoM aktif: ' + bomError.message }
  }

  const preferredBomByProduct = new Map<string, { id: string; branchId: string | null }>()
  for (const row of (bomRows as any[]) || []) {
    const productId = String((row as any).product_id || '').trim()
    if (!productId) continue

    const branchSpecificBom = String((row as any).branch_id || '').trim() || null
    const existing = preferredBomByProduct.get(productId)
    if (!existing || (!existing.branchId && branchSpecificBom === branchId)) {
      preferredBomByProduct.set(productId, {
        id: String((row as any).id || ''),
        branchId: branchSpecificBom,
      })
    }
  }

  return { bomByProduct: preferredBomByProduct }
}

async function ensureIstishnaLinesHaveActiveBom(
  supabase: any,
  orgId: string,
  branchId: string,
  lines: Array<{ product_id?: string | null; product_name?: string | null; quantity?: number }>
): Promise<{ success: true } | { error: string }> {
  const normalizedProductIds = [...new Set(
    (lines || [])
      .map((line) => String(line?.product_id || '').trim())
      .filter(Boolean)
  )]

  if (!normalizedProductIds.length) {
    return { error: 'Akad ISTISHNA hanya bisa dipakai untuk produk master yang punya BoM aktif.' }
  }

  const { data: productRows, error: productError } = await (supabase as any)
    .from('products')
    .select('id, name, type')
    .eq('org_id', orgId)
    .in('id', normalizedProductIds)

  if (productError) {
    return { error: 'Gagal memvalidasi produk ISTISHNA: ' + productError.message }
  }

  const inventoryProducts = ((productRows as any[]) || []).filter(
    (product) => String((product as any).type || 'INVENTORY').toUpperCase() === 'INVENTORY'
  )

  if (!inventoryProducts.length) {
    return { error: 'Akad ISTISHNA hanya berlaku untuk produk inventori yang diproduksi melalui BoM.' }
  }

  const bomLookup = await getPreferredProductionBomByProduct(
    supabase,
    orgId,
    branchId,
    inventoryProducts.map((product) => String((product as any).id || ''))
  )
  if ('error' in bomLookup) return bomLookup

  const missingBomProducts = inventoryProducts.filter(
    (product) => !bomLookup.bomByProduct.has(String((product as any).id || ''))
  )

  if (!missingBomProducts.length) {
    return { success: true }
  }

  const firstMissing = String((missingBomProducts[0] as any).name || 'produk').trim() || 'produk'
  const extraCount = missingBomProducts.length - 1
  const extraInfo = extraCount > 0 ? ` Ada ${extraCount} produk lain yang juga belum punya BoM aktif.` : ''

  return {
    error: `Akad ISTISHNA hanya bisa dipakai untuk produk dengan BoM aktif. Lengkapi BoM untuk "${firstMissing}" terlebih dahulu.${extraInfo}`,
  }
}

async function resolveAutomaticSaleShariahModeForShortage(
  supabase: any,
  orgId: string,
  branchId: string,
  lines: Array<{ product_id?: string | null; product_name?: string | null; quantity?: number }>
): Promise<AutoSaleShariahResolutionResult> {
  const stockCheck = await ensureCreateSaleStockAvailability(supabase, orgId, branchId, lines)
  if ('error' in stockCheck) return stockCheck

  if (!stockCheck.shortages.length) {
    return { mode: null }
  }

  const reservedShortage = stockCheck.shortages.find((shortage) => shortage.reservedQty > STOCK_EPSILON)
  if (reservedShortage) {
    return {
      error: `Stok produk "${reservedShortage.productName}" tidak cukup. Stok fisik ${formatQuantity(
        reservedShortage.onHandQty
      )}, sudah dialokasikan ke SO lain ${formatQuantity(
        reservedShortage.reservedQty
      )}, tersedia dijual ${formatQuantity(Math.max(
        0,
        reservedShortage.sellableQty
      ))}, permintaan ${formatQuantity(reservedShortage.requiredQty)}.`,
    }
  }

  const bomLookup = await getPreferredProductionBomByProduct(
    supabase,
    orgId,
    branchId,
    stockCheck.shortages.map((shortage) => shortage.productId)
  )
  if ('error' in bomLookup) return bomLookup

  const shortagesWithBom = stockCheck.shortages.filter((shortage) => bomLookup.bomByProduct.has(shortage.productId))
  const shortagesWithoutBom = stockCheck.shortages.filter((shortage) => !bomLookup.bomByProduct.has(shortage.productId))

  if (shortagesWithBom.length && shortagesWithoutBom.length) {
    const productionProduct = shortagesWithBom[0]
    const salamProduct = shortagesWithoutBom[0]
    return {
      error: `SO ini mencampur produk yang harus diproduksi dan yang harus dipesan tanpa produksi. Produk "${productionProduct.productName}" harus memakai akad ISTISHNA karena punya BoM aktif, sedangkan "${salamProduct.productName}" harus memakai akad SALAM karena tidak punya BoM. Pisahkan ke SO terpisah.`,
    }
  }

  return {
    mode: shortagesWithBom.length ? 'ISTISHNA' : 'SALAM',
  }
}

function isRpcFunctionNotFound(
  error: { code?: string | null; message?: string | null } | null | undefined,
  functionName: string
): boolean {
  if (!error) return false
  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  const fn = functionName.toLowerCase()

  if (code === 'PGRST202' || code === '42883') {
    return message.includes(fn) || message.includes('schema cache') || message.includes('does not exist')
  }

  return (
    message.includes(fn) &&
    (message.includes('schema cache') || message.includes('does not exist') || message.includes('undefined function'))
  )
}

function isSalesCommissionColumnSchemaCacheMiss(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  const targets = ['reseller_id', 'commission_type', 'commission_value']
  const touchesCommissionColumn = targets.some(
    (column) => message.includes(`'${column}'`) || message.includes(column)
  )

  if (code === 'PGRST204' || code === '42703') {
    return touchesCommissionColumn || message.includes('schema cache')
  }

  return (
    touchesCommissionColumn &&
    (
      message.includes('schema cache')
      || message.includes('column')
      || message.includes('undefined column')
    )
  )
}

function omitSalesCommissionColumns<T extends Record<string, unknown>>(
  payload: T
): Omit<T, 'reseller_id' | 'commission_type' | 'commission_value'> {
  const {
    reseller_id: _resellerId,
    commission_type: _commissionType,
    commission_value: _commissionValue,
    ...rest
  } = payload

  return rest
}

function isSalesTaxBreakdownColumnSchemaCacheMiss(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  const touchesTaxBreakdownColumn = message.includes(`'tax_breakdown'`) || message.includes('tax_breakdown')

  if (code === 'PGRST204' || code === '42703') {
    return touchesTaxBreakdownColumn || message.includes('schema cache')
  }

  return (
    touchesTaxBreakdownColumn &&
    (
      message.includes('schema cache')
      || message.includes('column')
      || message.includes('undefined column')
    )
  )
}

function isSalesOtherChargeColumnSchemaCacheMiss(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false

  const code = String(error.code || '')
  const message = String(error.message || '').toLowerCase()
  const touchesOtherChargeColumn =
    message.includes(`'other_charge_breakdown'`)
    || message.includes('other_charge_breakdown')
    || message.includes(`'other_charge_amount'`)
    || message.includes('other_charge_amount')

  if (code === 'PGRST204' || code === '42703') {
    return touchesOtherChargeColumn || message.includes('schema cache')
  }

  return (
    touchesOtherChargeColumn &&
    (
      message.includes('schema cache')
      || message.includes('column')
      || message.includes('undefined column')
    )
  )
}

function omitSalesTaxBreakdownColumn<T extends Record<string, unknown>>(
  payload: T
): Omit<T, 'tax_breakdown'> {
  const {
    tax_breakdown: _taxBreakdown,
    ...rest
  } = payload

  return rest
}

function omitSalesOtherChargeColumns<T extends Record<string, unknown>>(
  payload: T
): Omit<T, 'other_charge_breakdown' | 'other_charge_amount'> {
  const {
    other_charge_breakdown: _otherChargeBreakdown,
    other_charge_amount: _otherChargeAmount,
    ...rest
  } = payload

  return rest
}

function getLegacySalesCommissionMigrationMessage() {
  return 'Database penjualan belum sinkron untuk fitur komisi reseller. Jalankan migration 1157_reseller_commission_off_invoice.sql lalu reload schema Supabase.'
}

async function requireActiveBranchId(orgId: string, errorMessage: string): Promise<ActiveBranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: errorMessage }
  }

  return { branchId: branchSelection.branchId }
}

async function resolveActiveBranchId(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return branchSelection
  }

  return { branchId: branchSelection.branchId }
}

async function resolveDeliveryWarehouseId(
  supabase: any,
  orgId: string,
  branchId: string,
  explicitWarehouseId?: string | null
): Promise<DeliveryWarehouseResult> {
  const warehousesResult = await listActiveSalesWarehouses(supabase, orgId, branchId, {
    warehouseId: explicitWarehouseId,
    limit: explicitWarehouseId ? undefined : 2,
  })

  if ('error' in warehousesResult) {
    return { error: 'Gagal memuat gudang pengiriman.' }
  }

  const warehouses = warehousesResult.warehouses

  if (explicitWarehouseId) {
    if (!warehouses[0]?.id) {
      return { error: 'Gudang pengiriman tidak tersedia pada unit aktif.' }
    }

    return { warehouseId: warehouses[0].id }
  }

  if (warehouses.length === 0) {
    return { error: 'Belum ada gudang aktif di unit ini. Tambahkan gudang terlebih dahulu.' }
  }

  if (warehouses.length > 1) {
    return { error: 'Pilih gudang pengiriman terlebih dahulu karena unit ini memiliki lebih dari satu gudang aktif.' }
  }

  return { warehouseId: warehouses[0].id }
}

async function getSaleInventoryRequirements(
  supabase: any,
  orgId: string,
  saleId: string
): Promise<{ requirements: InventoryRequirement[] } | { error: string }> {
  const { data: rows, error } = await (supabase as any)
    .from('sales_items')
    .select('product_id, quantity, products(name, type, unit)')
    .eq('org_id', orgId)
    .eq('sale_id', saleId)

  if (error) {
    return { error: 'Gagal memvalidasi stok penjualan: ' + error.message }
  }

  const requirementMap = new Map<string, InventoryRequirement>()
  for (const row of (rows as any[]) || []) {
    const product = normalizeRelation<{ name?: string | null; type?: string | null; unit?: string | null }>((row as any).products)
    const productType = String(product?.type || 'INVENTORY').toUpperCase()
    if (productType !== 'INVENTORY') continue

    const productId = String((row as any).product_id || '')
    if (!productId) continue

    const qty = Number((row as any).quantity || 0)
    if (!Number.isFinite(qty) || qty <= 0) continue

    const current = requirementMap.get(productId)
    if (current) {
      current.requiredQty += qty
      continue
    }

    requirementMap.set(productId, {
      productId,
      productName: String(product?.name || productId),
      requiredQty: qty,
      unit: String(product?.unit || '').trim() || null,
    })
  }

  return { requirements: Array.from(requirementMap.values()) }
}

async function ensureDeliveryStockAvailability(
  supabase: any,
  orgId: string,
  branchId: string,
  warehouseId: string,
  requirements: InventoryRequirement[]
): Promise<DeliveryStockCheckResult> {
  if (!requirements.length) return { success: true }

  const productIds = requirements.map((item) => item.productId)
  const { data: stockRows, error } = await (supabase as any)
    .from('inventory_stocks')
    .select('product_id, quantity')
    .eq('org_id', orgId)
    .eq('warehouse_id', warehouseId)
    .in('product_id', productIds)

  if (error) {
    return { error: 'Gagal memvalidasi stok gudang: ' + error.message, shortages: [] }
  }

  const availableByProduct: Record<string, number> = {}
  for (const row of (stockRows as any[]) || []) {
    const productId = String((row as any).product_id || '')
    if (!productId) continue
    availableByProduct[productId] = (availableByProduct[productId] || 0) + Number((row as any).quantity || 0)
  }

  const shortageCandidates = requirements
    .map((item) => {
      const availableQty = Number(availableByProduct[item.productId] || 0)
      return {
        ...item,
        availableQty,
        shortageQty: item.requiredQty - availableQty,
      }
    })
    .filter((item) => item.shortageQty > STOCK_EPSILON)

  if (!shortageCandidates.length) return { success: true }

  const { data: bomRows, error: bomError } = await (supabase as any)
    .from('production_boms')
    .select('id, product_id, branch_id')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('product_id', shortageCandidates.map((item) => item.productId))
    .or(`branch_id.is.null,branch_id.eq.${branchId}`)

  if (bomError) {
    return { error: 'Gagal menentukan tindak lanjut stok kurang: ' + bomError.message, shortages: [] }
  }

  const preferredBomByProduct = new Map<string, { id: string; branchId: string | null }>()
  for (const row of (bomRows as any[]) || []) {
    const productId = String((row as any).product_id || '')
    if (!productId) continue

    const branchSpecificBom = String((row as any).branch_id || '') || null
    const existing = preferredBomByProduct.get(productId)
    if (!existing || (!existing.branchId && branchSpecificBom === branchId)) {
      preferredBomByProduct.set(productId, {
        id: String((row as any).id || ''),
        branchId: branchSpecificBom,
      })
    }
  }

  const shortages: DeliveryShortage[] = shortageCandidates.map((item) => {
    const preferredBom = preferredBomByProduct.get(item.productId)
    return {
      productId: item.productId,
      productName: item.productName,
      requiredQty: item.requiredQty,
      availableQty: item.availableQty,
      shortageQty: item.shortageQty,
      unit: item.unit,
      bomId: preferredBom?.id || null,
      resolution: preferredBom?.id ? 'PRODUCTION' : 'PURCHASING',
    }
  })

  const first = shortages[0]
  const quantitySuffix = first.unit ? ` ${first.unit}` : ''
  const guidance =
    first.resolution === 'PRODUCTION'
      ? ' Produk ini punya BoM aktif. Buat SPK produksi terlebih dahulu sebelum pengiriman.'
      : ' Produk ini tidak punya BoM aktif. Ajukan purchase request terlebih dahulu sebelum pengiriman.'
  const additionalShortageInfo =
    shortages.length > 1 ? ` Ada ${shortages.length - 1} produk lain yang juga kurang stok.` : ''

  return {
    error: `Stok tidak cukup untuk produk "${first.productName}". Dibutuhkan ${formatQuantity(
      first.requiredQty
    )}, tersedia ${formatQuantity(Math.max(
      0,
      first.availableQty
    ))}, kurang ${formatQuantity(first.shortageQty)}${quantitySuffix}.${guidance}${additionalShortageInfo}`,
    shortages,
  }
}

async function adjustInventoryStockCompat(
  supabase: any,
  payload: { orgId: string; productId: string; warehouseId: string; diff: number }
) {
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
  if (!sixArgsError) return { success: true as const }

  if (!isRpcFunctionNotFound(sixArgsError, 'adjust_inventory_stock')) {
    return { error: sixArgsError.message }
  }

  const { error: fourArgsError } = await (supabase as any).rpc('adjust_inventory_stock', baseArgs)
  if (fourArgsError) {
    return { error: fourArgsError.message }
  }

  return { success: true as const }
}

function isStockMovementsWarehouseColumnMissing(
  error: { code?: string | null; message?: string | null } | null | undefined
) {
  if (!error) return false

  const message = String(error.message || '')
  const normalized = message.toLowerCase()

  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (
      normalized.includes('stock_movements') &&
      normalized.includes('warehouse_id') &&
      (
        normalized.includes('does not exist') ||
        normalized.includes('could not find')
      )
    )
  )
}

async function insertStockMovementsCompat(supabase: any, movements: any[]) {
  if (!Array.isArray(movements) || movements.length === 0) {
    return { success: true as const }
  }

  const { error: insertError } = await (supabase as any).from('stock_movements').insert(movements)
  if (!insertError) {
    return { success: true as const }
  }

  if (!isStockMovementsWarehouseColumnMissing(insertError)) {
    return { error: insertError.message }
  }

  const legacyCompatibleMovements = movements.map(({ warehouse_id: _warehouseId, ...movement }) => movement)
  const { error: fallbackError } = await (supabase as any).from('stock_movements').insert(legacyCompatibleMovements)

  if (fallbackError) {
    return { error: fallbackError.message }
  }

  return { success: true as const }
}

async function fallbackVoidSaleWithoutRpc(
  supabase: any,
  args: {
    orgId: string
    saleId: string
    userId: string
    branchId: string
    saleWarehouseId?: string | null
  }
) {
  const { data: stockMovements, error: movementError } = await (supabase as any)
    .from('stock_movements')
    .select('branch_id, warehouse_id, product_id, quantity, unit_price, notes')
    .eq('org_id', args.orgId)
    .eq('reference_type', 'SALE')
    .eq('reference_id', args.saleId)

  if (movementError) {
    return { error: 'Gagal membaca pergerakan stok sales: ' + movementError.message }
  }

  const movementByProduct: Record<string, number> = {}
  for (const row of (stockMovements as any[]) || []) {
    const productId = String((row as any).product_id || '')
    if (!productId) continue
    movementByProduct[productId] = (movementByProduct[productId] || 0) + Number((row as any).quantity || 0)
  }

  const hasStockMovements = Object.keys(movementByProduct).length > 0
  let resolvedWarehouseId = args.saleWarehouseId || null
  if (hasStockMovements && !resolvedWarehouseId) {
    const resolvedWarehouse = await resolveDeliveryWarehouseId(
      supabase as any,
      args.orgId,
      args.branchId,
      null
    )
    if ('error' in resolvedWarehouse) {
      return { error: 'Gagal membatalkan sales order: gudang asal transaksi tidak dapat ditentukan.' }
    }
    resolvedWarehouseId = resolvedWarehouse.warehouseId
  }

  if (hasStockMovements && resolvedWarehouseId) {
    for (const [productId, movedQty] of Object.entries(movementByProduct)) {
      const reverseResult = await adjustInventoryStockCompat(supabase as any, {
        orgId: args.orgId,
        productId,
        warehouseId: resolvedWarehouseId,
        diff: -Number(movedQty || 0),
      })
      if ('error' in reverseResult) {
        return { error: 'Gagal sinkronisasi stok saat membatalkan sales order: ' + reverseResult.error }
      }
    }

    const reversalMovements = ((stockMovements as any[]) || []).map((row) => ({
      org_id: args.orgId,
      branch_id: String((row as any).branch_id || '').trim() || args.branchId,
      warehouse_id: String((row as any).warehouse_id || '').trim() || resolvedWarehouseId,
      product_id: String((row as any).product_id || ''),
      quantity: -Number((row as any).quantity || 0),
      unit_price: Number((row as any).unit_price || 0),
      reference_type: 'SALE_VOID',
      reference_id: args.saleId,
      notes: String((row as any).notes || '').trim()
        ? `Reversal SALE ${args.saleId} | ${String((row as any).notes).trim()}`
        : `Reversal SALE ${args.saleId}`,
    })).filter((row) => row.product_id && Number.isFinite(row.quantity) && row.quantity !== 0)

    const reversalInsert = await insertStockMovementsCompat(supabase as any, reversalMovements)
    if ('error' in reversalInsert) {
      return { error: 'Gagal mencatat kartu stok reversal sales: ' + reversalInsert.error }
    }
  }

  const { error: deleteMovementError } = await (supabase as any)
    .from('stock_movements')
    .delete()
    .eq('org_id', args.orgId)
    .eq('reference_type', 'SALE')
    .eq('reference_id', args.saleId)

  if (deleteMovementError) {
    return { error: 'Gagal menghapus kartu stok sales: ' + deleteMovementError.message }
  }

  const { error: voidJournalError } = await (supabase as any)
    .from('journal_entries')
    .update({
      status: 'VOIDED',
      void_reason: 'Pembatalan Sales Order',
      voided_by: args.userId,
      voided_at: new Date().toISOString(),
    })
    .eq('reference_id', args.saleId)
    .eq('reference_type', 'SALE')
    .eq('org_id', args.orgId)
    .eq('status', 'POSTED')

  if (voidJournalError) {
    return { error: 'Gagal void jurnal penjualan: ' + voidJournalError.message }
  }

  const { error: voidSaleError } = await (supabase as any)
    .from('sales')
    .update({
      status: 'VOIDED',
      warehouse_id: resolvedWarehouseId || args.saleWarehouseId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.saleId)
    .eq('org_id', args.orgId)
    .eq('branch_id', args.branchId)

  if (voidSaleError) {
    return { error: 'Gagal memperbarui status sales order: ' + voidSaleError.message }
  }

  return { success: true as const }
}

export async function getSales(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  // Use direct SQL JOIN to reliably resolve customer name, branch, reseller, and sub-tables.
  // The postgres-client nested resolver fails for non-standard FK names (customer_id → contacts).
  const { queryPostgres } = await import('@/lib/db/postgres')

  const baseParams: unknown[] = [orgId]
  const branchFilter = effectiveBranchId ? ` AND s.branch_id = $2` : ''
  if (effectiveBranchId) baseParams.push(effectiveBranchId)

  let saleRows: any[] = []
  try {
    const result = await queryPostgres<Record<string, unknown>>(`
      SELECT
        s.*,
        c.name           AS customer_name,
        c.address        AS customer_address,
        COALESCE(
          NULLIF(trim(c.phone_wa), ''),
          NULLIF(trim(c.phone), ''),
          NULL
        )                AS customer_phone,
        b.name           AS branch_name,
        b.code           AS branch_code,
        COALESCE(
          NULLIF(trim(concat_ws(' ', emp.first_name, emp.last_name)), ''),
          NULLIF(trim(proc_auth.display_name), ''),
          NULL
        )                AS processor_name,
        sr.id            AS reseller_id_val,
        sr.name          AS reseller_name,
        sr.reseller_type AS reseller_type,
        sr.company_name  AS reseller_company_name,
        sr.contact_person AS reseller_contact_person
      FROM   public.sales s
      LEFT JOIN public.contacts       c  ON c.id  = s.customer_id
      LEFT JOIN public.branches       b  ON b.id  = s.branch_id
      LEFT JOIN public.employees      emp ON emp.org_id = s.org_id AND emp.user_id = s.created_by
      LEFT JOIN LATERAL (
        SELECT u.display_name
        FROM   public.internal_auth_users u
        WHERE  u.legacy_user_id = s.created_by OR u.id = s.created_by
        ORDER  BY CASE WHEN u.legacy_user_id = s.created_by THEN 0 ELSE 1 END, u.updated_at DESC
        LIMIT 1
      ) proc_auth ON TRUE
      LEFT JOIN public.sales_resellers sr ON sr.id = s.reseller_id
      WHERE  s.org_id = $1${branchFilter}
      ORDER  BY s.created_at DESC
    `, baseParams)
    saleRows = result.rows
  } catch (err) {
    ;(console as any).error('[getSales] raw SQL error:', err)
    return []
  }

  if (saleRows.length === 0) return []

  const saleIds = saleRows.map((r) => r.id)

  // Fetch related sub-tables in parallel
  const [itemsResult, returnsResult, paymentsResult] = await Promise.allSettled([
    queryPostgres<Record<string, unknown>>(`
      SELECT si.*, p.name AS product_name, p.sku, p.unit, p.type AS product_type
      FROM   public.sales_items si
      LEFT JOIN public.products p ON p.id = si.product_id
      WHERE  si.sale_id = ANY($1::uuid[])
    `, [saleIds]),
    queryPostgres<Record<string, unknown>>(`
      SELECT sale_id, status, grand_total, return_number
      FROM   public.sales_returns
      WHERE  sale_id = ANY($1::uuid[])
    `, [saleIds]),
    queryPostgres<Record<string, unknown>>(`
      SELECT sale_id, amount, discount_amount
      FROM   public.sales_payments
      WHERE  sale_id = ANY($1::uuid[])
    `, [saleIds]),
  ])

  // Group sub-table rows by sale_id
  const itemsBySaleId: Record<string, any[]> = {}
  if (itemsResult.status === 'fulfilled') {
    for (const item of itemsResult.value.rows) {
      const sid = String(item.sale_id ?? '')
      if (!itemsBySaleId[sid]) itemsBySaleId[sid] = []
      itemsBySaleId[sid].push({
        ...item,
        products: item.product_name ? { name: item.product_name, sku: item.sku, unit: item.unit, type: item.product_type } : null,
      })
    }
  }
  const returnsBySaleId: Record<string, any[]> = {}
  if (returnsResult.status === 'fulfilled') {
    for (const ret of returnsResult.value.rows) {
      const sid = String(ret.sale_id ?? '')
      if (!returnsBySaleId[sid]) returnsBySaleId[sid] = []
      returnsBySaleId[sid].push(ret)
    }
  }
  const paymentsBySaleId: Record<string, any[]> = {}
  if (paymentsResult.status === 'fulfilled') {
    for (const pay of paymentsResult.value.rows) {
      const sid = String(pay.sale_id ?? '')
      if (!paymentsBySaleId[sid]) paymentsBySaleId[sid] = []
      paymentsBySaleId[sid].push(pay)
    }
  }

  return saleRows.map((row) => {
    const sid = String(row.id ?? '')
    return {
      ...row,
      sale_date: normalizeDateOnlyValue(row.sale_date),
      due_date: normalizeDateOnlyValue(row.due_date),
      delivered_at: normalizeDateTimeValue(row.delivered_at),
      // UI expects sale.contacts?.name for the customer
      contacts: row.customer_name ? {
        name: row.customer_name,
        address: String(row.customer_address || '').trim() || null,
        phone: String(row.customer_phone || '').trim() || null,
      } : null,
      branches: (row.branch_name || row.branch_code)
        ? { name: row.branch_name, code: row.branch_code }
        : null,
      processor_name: String(row.processor_name || '').trim() || null,
      sales_resellers: row.reseller_name ? {
        id: row.reseller_id_val,
        name: row.reseller_name,
        reseller_type: row.reseller_type,
        company_name: row.reseller_company_name,
        contact_person: row.reseller_contact_person,
      } : null,
      sales_items: itemsBySaleId[sid] ?? [],
      sales_returns: returnsBySaleId[sid] ?? [],
      sales_payments: paymentsBySaleId[sid] ?? [],
    }
  })
}


export async function createSaleEntry(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat sales order.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  const createMode: 'DRAFT' | 'PUBLISH' =
    String(payload.mode || 'PUBLISH').toUpperCase() === 'DRAFT'
      ? 'DRAFT'
      : 'PUBLISH'

  const normalizedLines = (payload.lines || []).filter((line: any) => String(line?.product_name || '').trim().length > 0)
  if (!payload.customer_id || normalizedLines.length === 0) {
    return { error: 'Customer dan minimal satu baris item wajib diisi.' }
  }

  const saleDateNormalized = String(payload.sale_date || '').trim().split('T')[0]
  const closedPeriodForCreate = await checkClosedFiscalPeriod(orgId, saleDateNormalized)
  if (closedPeriodForCreate) {
    return { error: buildClosedPeriodError('Penjualan', saleDateNormalized, closedPeriodForCreate) }
  }

  let shariahMode = normalizeShariahMode(payload.shariah_mode)

  if (createMode === 'PUBLISH' && shariahMode === 'CASH') {
    const autoShariahMode = await resolveAutomaticSaleShariahModeForShortage(
      supabase as any,
      orgId,
      activeBranchId,
      normalizedLines
    )
    if ('error' in autoShariahMode) return autoShariahMode

    if (autoShariahMode.mode) {
      shariahMode = autoShariahMode.mode
    }
  }

  if (createMode === 'PUBLISH' && shariahMode === 'ISTISHNA') {
    const istishnaValidation = await ensureIstishnaLinesHaveActiveBom(
      supabase as any,
      orgId,
      activeBranchId,
      normalizedLines
    )
    if ('error' in istishnaValidation) return istishnaValidation
  }

  const salamMode = isSalamMode(shariahMode)
  const istishnaMode = normalizeShariahMode(shariahMode) === 'ISTISHNA'
  const paymentTerm = salamMode ? 'LUNAS' : (String(payload.payment_term || 'TEMPO').toUpperCase() === 'LUNAS' ? 'LUNAS' : 'TEMPO')
  const dueDate = (paymentTerm === 'TEMPO' || salamMode || istishnaMode) ? (payload.due_date || null) : null

  if (createMode === 'PUBLISH' && (paymentTerm === 'TEMPO' || salamMode || istishnaMode) && !dueDate) {
    return { error: 'Tanggal jatuh tempo pengiriman wajib diisi.' }
  }

  if (createMode === 'PUBLISH' && salamMode && paymentTerm !== 'LUNAS') {
    return { error: 'Akad SALAM wajib dibayar lunas (tunai) di awal.' }
  }

  const totalAmount = normalizedLines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0)
  const normalizedDiscountAmount = roundSalesTaxValue(payload.discount_amount)
  const taxableAmount = Math.max(0, totalAmount - normalizedDiscountAmount)
  const normalizedTaxBreakdown = normalizeSalesTaxBreakdown(
    payload.tax_breakdown,
    taxableAmount,
    payload.tax_amount
  )
  const normalizedTaxAmount = getSalesTaxBreakdownTotal(normalizedTaxBreakdown)
  const normalizedOtherChargeBreakdown = normalizeSalesOtherChargeBreakdown(
    payload.other_charge_breakdown,
    taxableAmount,
    payload.other_charge_amount
  )
  const normalizedOtherChargeAmount = getSalesOtherChargeTotal(normalizedOtherChargeBreakdown)
  const computedTotal = totalAmount - normalizedDiscountAmount + normalizedTaxAmount + normalizedOtherChargeAmount
  const resellerSnapshot = await getResellerCommissionSnapshot(orgId, payload.reseller_id)

  if (resellerSnapshot?.error) {
    return { error: resellerSnapshot.error }
  }

  const salePayload = {
    customer_id: payload.customer_id,
    reseller_id: resellerSnapshot.resellerId,
    commission_type: resellerSnapshot.commissionType,
    commission_value: resellerSnapshot.commissionValue,
    sale_date: payload.sale_date,
    due_date: dueDate,
    payment_term: paymentTerm,
    total_amount: totalAmount + normalizedOtherChargeAmount,
    tax_breakdown: normalizedTaxBreakdown,
    tax_amount: normalizedTaxAmount,
    other_charge_breakdown: normalizedOtherChargeBreakdown,
    other_charge_amount: normalizedOtherChargeAmount,
    discount_amount: normalizedDiscountAmount,
    grand_total: computedTotal,
    shariah_mode: shariahMode,
    notes: payload.notes,
    updated_at: new Date().toISOString(),
  }

  let saleId: string | null = null

  if (payload.draft_id) {
    const { data: existingSale, error: existingSaleError } = await (supabase as any)
      .from('sales')
      .select('id, status')
      .eq('id', payload.draft_id)
      .eq('org_id', orgId)
      .eq('branch_id', activeBranchId)
      .maybeSingle()

    if (existingSaleError || !existingSale) {
      return { error: 'Draft SO tidak ditemukan pada unit aktif.' }
    }

    if (existingSale.status !== 'DRAFT') {
      return { error: 'Hanya dokumen SO berstatus DRAFT yang bisa diedit atau diterbitkan ulang.' }
    }

    const draftPayload = {
      ...salePayload,
      status: 'DRAFT',
    }
    let { error: updateSaleError } = await (supabase as any)
      .from('sales')
      .update(draftPayload)
      .eq('id', payload.draft_id)
      .eq('org_id', orgId)
      .eq('branch_id', activeBranchId)

    if (updateSaleError && (
      isSalesCommissionColumnSchemaCacheMiss(updateSaleError)
      || isSalesTaxBreakdownColumnSchemaCacheMiss(updateSaleError)
      || isSalesOtherChargeColumnSchemaCacheMiss(updateSaleError)
    )) {
      if (resellerSnapshot.resellerId && isSalesCommissionColumnSchemaCacheMiss(updateSaleError)) {
        return { error: getLegacySalesCommissionMigrationMessage() }
      }

      let fallbackDraftPayload: Record<string, unknown> = draftPayload
      if (isSalesCommissionColumnSchemaCacheMiss(updateSaleError)) {
        fallbackDraftPayload = omitSalesCommissionColumns(fallbackDraftPayload)
      }
      if (isSalesTaxBreakdownColumnSchemaCacheMiss(updateSaleError)) {
        fallbackDraftPayload = omitSalesTaxBreakdownColumn(fallbackDraftPayload)
      }
      if (isSalesOtherChargeColumnSchemaCacheMiss(updateSaleError)) {
        fallbackDraftPayload = omitSalesOtherChargeColumns(fallbackDraftPayload)
      }

      const { error: fallbackUpdateError } = await (supabase as any)
        .from('sales')
        .update(fallbackDraftPayload)
        .eq('id', payload.draft_id)
        .eq('org_id', orgId)
        .eq('branch_id', activeBranchId)

      updateSaleError = fallbackUpdateError
    }

    if (updateSaleError) return { error: updateSaleError.message }
    saleId = payload.draft_id

    const { error: deleteLinesError } = await (supabase as any)
      .from('sales_items')
      .delete()
      .eq('org_id', orgId)
      .eq('branch_id', activeBranchId)
      .eq('sale_id', saleId)

    if (deleteLinesError) return { error: deleteLinesError.message }
  } else {
    const draftInsertPayload = {
      org_id: orgId,
      branch_id: activeBranchId,
      ...salePayload,
      created_by: user.id,
      status: 'DRAFT',
    }
    let { data: sale, error: saleErr } = await (supabase as any)
      .from('sales')
      .insert(draftInsertPayload)
      .select('id')
      .single()

    if (saleErr && (
      isSalesCommissionColumnSchemaCacheMiss(saleErr)
      || isSalesTaxBreakdownColumnSchemaCacheMiss(saleErr)
      || isSalesOtherChargeColumnSchemaCacheMiss(saleErr)
    )) {
      if (resellerSnapshot.resellerId && isSalesCommissionColumnSchemaCacheMiss(saleErr)) {
        return { error: getLegacySalesCommissionMigrationMessage() }
      }

      let fallbackInsertPayload: Record<string, unknown> = draftInsertPayload
      if (isSalesCommissionColumnSchemaCacheMiss(saleErr)) {
        fallbackInsertPayload = omitSalesCommissionColumns(fallbackInsertPayload)
      }
      if (isSalesTaxBreakdownColumnSchemaCacheMiss(saleErr)) {
        fallbackInsertPayload = omitSalesTaxBreakdownColumn(fallbackInsertPayload)
      }
      if (isSalesOtherChargeColumnSchemaCacheMiss(saleErr)) {
        fallbackInsertPayload = omitSalesOtherChargeColumns(fallbackInsertPayload)
      }

      const fallbackInsertResult = await (supabase as any)
        .from('sales')
        .insert(fallbackInsertPayload)
        .select('id')
        .single()

      sale = fallbackInsertResult.data
      saleErr = fallbackInsertResult.error
    }

    if (saleErr || !sale?.id) return { error: saleErr?.message || 'Gagal membuat draft SO.' }
    saleId = sale.id
  }

  const { error: linesErr } = await (supabase as any)
    .from('sales_items')
    .insert(normalizedLines.map((l: any) => ({
      org_id: orgId,
      branch_id: activeBranchId,
      sale_id: saleId,
      product_id: l.product_id,
      description: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_amount: l.discount_amount || 0,
      tax_amount: l.tax_amount || 0
    })))

  if (linesErr) {
    // Cleanup if lines fail
    if (!payload.draft_id && saleId) {
      await (supabase as any).from('sales').delete().eq('id', saleId)
    }
    return { error: linesErr.message }
  }

  if (createMode === 'PUBLISH') {
    const approvalTable = (supabase as any).from('approval_requests')
    if (typeof approvalTable?.update === 'function') {
      await approvalTable
        .update({
          status: 'VOIDED',
          reason: 'Approval SO lama diganti oleh versi draft terbaru',
          decided_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('source_type', 'SALES_ORDER')
        .eq('source_id', saleId)
        .eq('status', 'PENDING')
    }

    await (supabase as any).from('approval_requests' as any).insert({
      org_id: orgId,
      branch_id: activeBranchId,
      requester_id: user.id,
      source_type: 'SALES_ORDER',
      source_id: saleId,
      status: 'PENDING',
      reason: `Sales Order Baru (${shariahMode}) - Customer: ${payload.customer_name || ''} - ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(computedTotal)}`
    })
  } else {
    const approvalTable = (supabase as any).from('approval_requests')
    if (typeof approvalTable?.update === 'function') {
      await approvalTable
        .update({
          status: 'VOIDED',
          reason: 'Draft SO diperbarui sebelum diterbitkan',
          decided_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('branch_id', activeBranchId)
        .eq('source_type', 'SALES_ORDER')
        .eq('source_id', saleId)
        .eq('status', 'PENDING')
    }
  }

  revalidatePath('/sales')
  return { success: true, saleId }
}

export async function createSaleFulfillmentDrafts(
  orgId: string,
  saleId: string,
  warehouseId?: string | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menyiapkan tindak lanjut kekurangan stok.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { data: sale, error: saleError } = await (supabase as any)
    .from('sales')
    .select('id, sale_number, due_date, warehouse_id, status')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
    .single()

  if (saleError || !sale) {
    return { error: 'Sales order tidak ditemukan pada unit aktif.' }
  }

  if ((sale as any).status === 'FINISHED') {
    return { error: 'Sales order ini sudah selesai dikirim.' }
  }

  if ((sale as any).status === 'VOIDED') {
    return { error: 'Sales order yang sudah dibatalkan tidak bisa dibuatkan tindak lanjut stok.' }
  }

  const inventoryRequirementResult = await getSaleInventoryRequirements(supabase as any, orgId, saleId)
  if ('error' in inventoryRequirementResult) return { error: inventoryRequirementResult.error }
  if (!inventoryRequirementResult.requirements.length) {
    return { error: 'SO ini tidak memiliki item persediaan yang perlu ditindaklanjuti.' }
  }

  let resolvedWarehouseId: string | null = warehouseId || (sale as any).warehouse_id || null
  const resolvedWarehouse = await resolveDeliveryWarehouseId(
    supabase as any,
    orgId,
    activeBranchResult.branchId,
    resolvedWarehouseId
  )

  if ('error' in resolvedWarehouse) {
    return { error: resolvedWarehouse.error }
  }

  resolvedWarehouseId = resolvedWarehouse.warehouseId

  const stockCheck = await ensureDeliveryStockAvailability(
    supabase as any,
    orgId,
    activeBranchResult.branchId,
    resolvedWarehouseId,
    inventoryRequirementResult.requirements
  )

  if (!('error' in stockCheck)) {
    return { error: 'Stok saat ini sudah cukup. Coba kirim ulang barang.' }
  }

  if (!stockCheck.shortages.length) {
    return { error: stockCheck.error }
  }

  const saleNumber = String((sale as any).sale_number || saleId)
  const dueDate = normalizeDateOnlyValue((sale as any).due_date)
  let workOrdersCreated = 0
  let workOrdersSkipped = 0
  let purchaseRequestsCreated = 0
  let purchaseRequestsSkipped = 0

  for (const shortage of stockCheck.shortages) {
    const marker = buildSaleShortageMarker(saleId, shortage.productId)
    const baseNote = `${marker} Otomatis dari kekurangan stok SO ${saleNumber} untuk produk ${shortage.productName}.`

    if (shortage.resolution === 'PRODUCTION' && shortage.bomId) {
      const { data: existingWorkOrder, error: existingWorkOrderError } = await (supabase as any)
        .from('production_work_orders')
        .select('id')
        .eq('org_id', orgId)
        .eq('branch_id', activeBranchResult.branchId)
        .eq('bom_id', shortage.bomId)
        .in('status', ['DRAFT', 'RELEASED'])
        .ilike('notes', `%${marker}%`)
        .limit(1)
        .maybeSingle()

      if (existingWorkOrderError) {
        return { error: 'Gagal memeriksa draft SPK otomatis: ' + existingWorkOrderError.message }
      }

      if (existingWorkOrder?.id) {
        workOrdersSkipped += 1
        continue
      }

      const workOrderBaseNumber = [
        'SPK',
        saleNumber.replace(/[^A-Za-z0-9-]/g, '').slice(0, 30) || 'SO',
        shortage.productId.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'AUTO',
      ].join('-')
      const reservedNumber = await reserveUniqueWorkOrderNumber(
        supabase as any,
        orgId,
        workOrderBaseNumber
      )
      if ('error' in reservedNumber) {
        return { error: reservedNumber.error }
      }

      const { error: workOrderInsertError } = await (supabase as any)
        .from('production_work_orders')
        .insert({
          org_id: orgId,
          branch_id: activeBranchResult.branchId,
          bom_id: shortage.bomId,
          wo_number: reservedNumber.woNumber,
          quantity_planned: shortage.shortageQty,
          status: 'DRAFT',
          notes: baseNote,
          deadline_date: dueDate,
        })

      if (workOrderInsertError) {
        return { error: 'Gagal membuat draft SPK otomatis: ' + workOrderInsertError.message }
      }

      workOrdersCreated += 1
      continue
    }

    const { data: existingPurchaseRequest, error: existingPurchaseRequestError } = await (supabase as any)
      .from('purchase_requests')
      .select('id')
      .eq('org_id', orgId)
      .eq('branch_id', activeBranchResult.branchId)
      .eq('source_type', 'SALES_DELIVERY_SHORTAGE')
      .eq('source_id', saleId)
      .eq('product_id', shortage.productId)
      .in('status', ['PENDING', 'ORDERED', 'RECEIVED'])
      .limit(1)
      .maybeSingle()

    if (existingPurchaseRequestError) {
      return { error: 'Gagal memeriksa purchase request otomatis: ' + existingPurchaseRequestError.message }
    }

    if (existingPurchaseRequest?.id) {
      purchaseRequestsSkipped += 1
      continue
    }

    const { error: purchaseRequestInsertError } = await (supabase as any)
      .from('purchase_requests')
      .insert({
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
        requester_id: user.id,
        product_id: shortage.productId,
        product_name: shortage.productName,
        quantity: shortage.shortageQty,
        unit: shortage.unit,
        status: 'PENDING',
        priority: 'URGENT',
        notes: baseNote,
        source_type: 'SALES_DELIVERY_SHORTAGE',
        source_id: saleId,
      })

    if (purchaseRequestInsertError) {
      return { error: 'Gagal membuat purchase request otomatis: ' + purchaseRequestInsertError.message }
    }

    purchaseRequestsCreated += 1
  }

  revalidatePath('/sales')
  revalidatePath('/factory')
  revalidatePath('/purchasing')

  const messageParts: string[] = []
  if (workOrdersCreated > 0) messageParts.push(`${workOrdersCreated} draft SPK dibuat`)
  if (workOrdersSkipped > 0) messageParts.push(`${workOrdersSkipped} draft SPK sudah ada`)
  if (purchaseRequestsCreated > 0) messageParts.push(`${purchaseRequestsCreated} purchase request dibuat`)
  if (purchaseRequestsSkipped > 0) messageParts.push(`${purchaseRequestsSkipped} purchase request sudah ada`)

  return {
    success: true,
    message:
      messageParts.join('. ') ||
      'Tindak lanjut kekurangan stok sudah tersedia. Cek modul Factory atau Purchasing.',
    workOrdersCreated,
    workOrdersSkipped,
    purchaseRequestsCreated,
    purchaseRequestsSkipped,
    routes: [
      ...(workOrdersCreated + workOrdersSkipped > 0 ? ['/factory'] : []),
      ...(purchaseRequestsCreated + purchaseRequestsSkipped > 0 ? ['/purchasing'] : []),
    ],
  }
}

export async function deliverSale(orgId: string, saleId: string, warehouseId?: string | null) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengirim sales order.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { data: sale } = await (supabase as any)
    .from('sales' as any)
    .select('status, warehouse_id, shariah_mode, payment_status')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
    .single()
  if (!sale) return { error: 'Order tidak ditemukan.' }
  if (sale.status === 'FINISHED') return { success: true }
  const isSalam = isSalamMode((sale as any).shariah_mode)
  if (isSalam && (sale as any).payment_status !== 'PAID') {
    return { error: 'Akad SALAM wajib lunas terlebih dahulu sebelum pengiriman barang.' }
  }

  const deliverDate = getDateInTimeZone('Asia/Jakarta')
  const closedPeriodForDeliver = await checkClosedFiscalPeriod(orgId, deliverDate)
  if (closedPeriodForDeliver) {
    return { error: buildClosedPeriodError('Pengiriman Penjualan', deliverDate, closedPeriodForDeliver) }
  }

  let resolvedWarehouseId: string | null = null
  if (warehouseId || sale.warehouse_id) {
    const resolvedWarehouse = await resolveDeliveryWarehouseId(
      supabase as any,
      orgId,
      activeBranchResult.branchId,
      warehouseId || sale.warehouse_id || null
    )

    if ('error' in resolvedWarehouse) {
      return { error: resolvedWarehouse.error }
    }

    resolvedWarehouseId = resolvedWarehouse.warehouseId
  }

  const inventoryRequirementResult = await getSaleInventoryRequirements(supabase as any, orgId, saleId)
  if ('error' in inventoryRequirementResult) return { error: inventoryRequirementResult.error }

  const hasInventoryItems = inventoryRequirementResult.requirements.length > 0
  if (hasInventoryItems && !resolvedWarehouseId) {
    const resolvedWarehouse = await resolveDeliveryWarehouseId(
      supabase as any,
      orgId,
      activeBranchResult.branchId,
      null
    )

    if ('error' in resolvedWarehouse) {
      return { error: resolvedWarehouse.error }
    }

    resolvedWarehouseId = resolvedWarehouse.warehouseId
  }

  if (hasInventoryItems) {
    if (!resolvedWarehouseId) {
      return { error: 'Gudang pengiriman wajib dipilih untuk memvalidasi stok.' }
    }
    const stockCheck = await ensureDeliveryStockAvailability(
      supabase as any,
      orgId,
      activeBranchResult.branchId,
      resolvedWarehouseId,
      inventoryRequirementResult.requirements
    )
    if ('error' in stockCheck) {
      if (!stockCheck.shortages.length) {
        return { error: stockCheck.error }
      }

      return {
        error: stockCheck.error,
        code: 'DELIVERY_STOCK_SHORTAGE',
        shortages: stockCheck.shortages,
      }
    }
  }

  const { error } = await (supabase as any).rpc('process_sales_delivery_atomic', {
    p_org_id: orgId,
    p_sale_id: saleId,
    p_warehouse_id: resolvedWarehouseId,
  })

  if (error) {
    (console as any).error('Failed to deliver sale via atomic engine:', error)
    return { error: getSalesDeliveryRpcErrorMessage(error) }
  }

  const { error: markDeliveredError } = await (supabase as any)
    .from('sales')
    .update({
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (markDeliveredError) {
    const markDeliveredMessage = String(markDeliveredError.message || '')
    if (!markDeliveredMessage.toLowerCase().includes('delivered_at')) {
      return { error: 'Pengiriman berhasil, tetapi tanggal kirim gagal disimpan: ' + markDeliveredMessage }
    }

    ;(console as any).warn('[deliverSale] delivered_at belum tersedia, tanggal kirim dilewati:', markDeliveredMessage)
  }

  // Catat HPP ke jurnal: DR HPP (5021) / CR Persediaan (1301)
  // Fire-and-forget — jangan gagalkan delivery hanya karena jurnal HPP gagal
  void (async () => {
    try {
      const { rows: saleRows } = await queryPostgres(
        `SELECT s.sale_date::text AS sale_date, s.sale_number,
                si.product_id::text, si.quantity::float,
                p.name AS product_name,
                COALESCE(p.average_cost, p.purchase_price, 0)::float AS avg_cost
         FROM sales s
         JOIN sales_items si ON si.sale_id = s.id
         JOIN products p ON p.id = si.product_id
         WHERE s.id = $1 AND s.org_id = $2 AND p.type = 'INVENTORY'`,
        [saleId, orgId]
      )
      if (saleRows.length === 0) return

      const saleDate = String(saleRows[0].sale_date)
      const saleNumber = String(saleRows[0].sale_number)
      const cogsLines = saleRows.map(r => ({
        productId: String(r.product_id),
        productName: String(r.product_name),
        quantity: Number(r.quantity),
        avgCost: Number(r.avg_cost),
      }))

      const cogsResult = await ERPBridge.recordCOGS({
        orgId,
        branchId: activeBranchResult.branchId,
        saleId,
        saleDate,
        saleNumber,
        lines: cogsLines,
      })

      if ('error' in cogsResult) {
        ;(console as any).warn('[deliverSale] recordCOGS warning:', cogsResult.error, { saleId })
      }
    } catch (cogsErr) {
      ;(console as any).warn('[deliverSale] recordCOGS exception:', cogsErr, { saleId })
    }
  })()

  revalidatePath('/sales')
  revalidatePath('/inventory')
  revalidatePath('/accounting')
  return { success: true }
}

export async function voidSale(orgId: string, saleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membatalkan sales order.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  // 1. Check current status — only existing documents can be voided
  const { data: sale } = await (supabase as any)
    .from('sales')
    .select('status, warehouse_id, sale_date')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchId)
    .single()

  if (!sale) return { error: 'Order tidak ditemukan.' }
  if (sale.status === 'VOIDED') return { success: true }

  const voidSaleDate = normalizeDateOnlyValue((sale as any).sale_date) || getDateInTimeZone('Asia/Jakarta')
  const closedPeriodForVoid = await checkClosedFiscalPeriod(orgId, voidSaleDate)
  if (closedPeriodForVoid) {
    return { error: buildClosedPeriodError('Pembatalan Penjualan', voidSaleDate, closedPeriodForVoid) }
  }

  // 2. Atomic void to keep journal, stock_movements, and inventory_stocks in sync.
  const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc('void_sale_atomic', {
    p_org_id: orgId,
    p_sale_id: saleId,
    p_user_id: user.id,
    p_reason: 'Pembatalan Sales Order',
  })

  if (rpcErr || !rpcRes?.success) {
    const rpcErrorMessage = String(rpcRes?.error || rpcErr?.message || 'Unknown error')
    const shouldUseFallback = isRpcFunctionNotFound(
      { code: rpcErr?.code || null, message: rpcErrorMessage },
      'void_sale_atomic'
    )

    if (!shouldUseFallback) {
      return { error: `Gagal membatalkan sales order secara atomik: ${rpcErrorMessage}` }
    }

    const fallbackResult = await fallbackVoidSaleWithoutRpc(supabase as any, {
      orgId,
      saleId,
      userId: user.id,
      branchId: activeBranchId,
      saleWarehouseId: (sale as any).warehouse_id || null,
    })

    if ('error' in fallbackResult) {
      return { error: `Gagal membatalkan sales order secara atomik: ${fallbackResult.error}` }
    }
  }

  // 5. Cancel any pending approval requests for this order
  await (supabase as any)
    .from('approval_requests')
    .update({ status: 'VOIDED', reason: 'Sales Order Dibatalkan', decided_at: new Date().toISOString() })
    .eq('source_type', 'SALES_ORDER')
    .eq('source_id', saleId)
    .eq('branch_id', activeBranchId)
    .eq('status', 'PENDING')

  revalidatePath('/sales')
  revalidatePath('/inventory')
  revalidatePath('/accounting/journal')
  return { success: true }
}

export async function paySale(orgId: string, saleId: string) {
  // ⚠️ Deprecated: gunakan processSalesPayment() untuk mencatat pembayaran dengan jurnal yang benar.
  // Fungsi ini hanya update flag dan TIDAK membuat jurnal penerimaan kas.
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menerima pembayaran.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  await (supabase as any)
    .from('sales' as any)
    .update({ payment_status: 'PAID' })
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
  revalidatePath('/sales')
  return { success: true }
}


export async function processSalesReturn(orgId: string, payload: {
  sale_id: string, return_number: string, nota_retur: string,
  items: Array<{ product_id: string, quantity: number, unit_price: number, sale_item_id: string }>,
  refund_account_id?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memproses retur penjualan.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { data: sale } = await (supabase as any)
    .from('sales')
    .select('id')
    .eq('id', payload.sale_id)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
    .maybeSingle()

  if (!sale) return { error: 'Transaksi penjualan tidak tersedia pada unit aktif.' }

  const returnDate = getDateInTimeZone('Asia/Jakarta')
  const closedPeriodForReturn = await checkClosedFiscalPeriod(orgId, returnDate)
  if (closedPeriodForReturn) {
    return { error: buildClosedPeriodError('Retur Penjualan', returnDate, closedPeriodForReturn) }
  }

  const { data, error } = await (supabase as any).rpc('process_sales_return_atomic', {
    p_org_id: orgId, p_sale_id: payload.sale_id, p_return_number: payload.return_number,
    p_nota_retur: payload.nota_retur, p_items: payload.items, p_user_id: user.id,
    p_refund_account_id: payload.refund_account_id || null
  })

  if (error || !data?.success) return { error: 'Gagal memproses retur: ' + (data?.error || error?.message) }

  revalidatePath('/sales')
  revalidatePath('/inventory')
  revalidatePath('/accounting/ledgers')
  revalidatePath('/accounting/reports')
  return { success: true, returnId: data.return_id }
}

export async function processSalesPayment(orgId: string, payload: {
  sale_id: string, account_id: string, amount: number, payment_date: string, notes?: string, discount_amount?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memproses pembayaran penjualan.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { data: sale } = await (supabase as any)
    .from('sales')
    .select('id')
    .eq('id', payload.sale_id)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)
    .maybeSingle()

  if (!sale) return { error: 'Transaksi penjualan tidak tersedia pada unit aktif.' }

  const closedPeriodForPayment = await checkClosedFiscalPeriod(orgId, payload.payment_date)
  if (closedPeriodForPayment) {
    return { error: buildClosedPeriodError('Pembayaran Penjualan', payload.payment_date, closedPeriodForPayment) }
  }

  const { data, error } = await (supabase as any).rpc('process_sales_payment_atomic', {
    p_org_id: orgId, p_sale_id: payload.sale_id, p_account_id: payload.account_id,
    p_amount: payload.amount, p_discount: payload.discount_amount || 0,
    p_payment_date: payload.payment_date, p_notes: payload.notes || '',
    p_user_id: user.id
  })

  if (error || !data?.success) return { error: 'Gagal memproses pembayaran: ' + (data?.error || error?.message) }

  revalidatePath('/sales')
  revalidatePath('/accounting/ledgers')
  revalidatePath('/accounting/reports')
  return { success: true, paymentId: data.payment_id }
}

export async function getQuotations(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  const { queryPostgres } = await import('@/lib/db/postgres')

  const baseParams: unknown[] = [orgId]
  let branchFilter = ''
  if (effectiveBranchId) { branchFilter = ` AND s.branch_id = $${baseParams.push(effectiveBranchId)}` }

  let quoteRows: any[] = []
  try {
    const result = await queryPostgres<Record<string, unknown>>(`
      SELECT
        s.*,
        c.name           AS customer_name,
        b.name           AS branch_name,
        b.code           AS branch_code,
        sr.id            AS reseller_id_val,
        sr.name          AS reseller_name,
        sr.reseller_type AS reseller_type,
        sr.company_name  AS reseller_company_name,
        sr.contact_person AS reseller_contact_person
      FROM   public.sales s
      LEFT JOIN public.contacts       c  ON c.id  = s.customer_id
      LEFT JOIN public.branches       b  ON b.id  = s.branch_id
      LEFT JOIN public.sales_resellers sr ON sr.id = s.reseller_id
      WHERE  s.org_id = $1 AND s.status = 'QUOTATION'${branchFilter}
      ORDER  BY s.created_at DESC
    `, baseParams)
    quoteRows = result.rows
  } catch (err) {
    ;(console as any).error('[getQuotations] raw SQL error:', err)
    return []
  }

  if (quoteRows.length === 0) return []
  const saleIds = quoteRows.map((r) => r.id)

  const itemsBySaleId: Record<string, any[]> = {}
  try {
    const itemsResult = await queryPostgres<Record<string, unknown>>(`
      SELECT si.*, p.name AS product_name, p.sku, p.unit, p.type AS product_type
      FROM   public.sales_items si
      LEFT JOIN public.products p ON p.id = si.product_id
      WHERE  si.sale_id = ANY($1::uuid[])
    `, [saleIds])
    for (const item of itemsResult.rows) {
      const sid = String(item.sale_id ?? '')
      if (!itemsBySaleId[sid]) itemsBySaleId[sid] = []
      itemsBySaleId[sid].push({
        ...item,
        products: item.product_name ? { name: item.product_name, sku: item.sku, unit: item.unit, type: item.product_type } : null,
      })
    }
  } catch { /* ignore */ }

  return quoteRows.map((row) => {
    const sid = String(row.id ?? '')
    return {
      ...row,
      contacts: row.customer_name ? { name: row.customer_name } : null,
      branches: row.branch_name ? { name: row.branch_name, code: row.branch_code } : null,
      sales_resellers: row.reseller_name ? {
        id: row.reseller_id_val, name: row.reseller_name,
        reseller_type: row.reseller_type, company_name: row.reseller_company_name,
        contact_person: row.reseller_contact_person,
      } : null,
      sales_items: itemsBySaleId[sid] ?? [],
    }
  })
}


export async function createQuotation(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat quotation.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  const normalizedLines = (payload.lines || []).filter((line: any) => String(line?.product_name || '').trim().length > 0)
  if (!payload.customer_id || normalizedLines.length === 0) {
    return { error: 'Customer dan minimal satu baris item wajib diisi.' }
  }

  const total = normalizedLines.reduce((acc: number, l: any) => acc + (Number(l.quantity || 0) * Number(l.unit_price || 0)), 0)
  const lineDiscountTotal = normalizedLines.reduce(
    (acc: number, l: any) => acc + (Number(l.quantity || 0) * Number(l.discount_amount || 0)),
    0
  )
  const legacyHeaderDiscount = Math.max(0, Number(payload.discount_amount || 0))
  const manualHeaderDiscount = typeof payload.manual_discount_value === 'undefined'
    ? legacyHeaderDiscount
    : calculateConfiguredHeaderDiscount(total, payload.manual_discount_mode, payload.manual_discount_value)
  const taxAmount = Number(payload.tax_amount || 0)
  let appliedPromoId: string | null = null
  let promoDiscount = 0

  const promoCode = String(payload.promo_code || '').trim()
  if (promoCode) {
    const promoResult = await getUsableSalesPromoByCodeWithDb(supabase as any, orgId, promoCode)
    if ('error' in promoResult) {
      return { error: promoResult.error }
    }

    appliedPromoId = promoResult.promo.id
    promoDiscount = calculateSalesPromoDiscount(promoResult.promo, total)
  }

  const maxHeaderDiscount = Math.max(0, total - lineDiscountTotal)
  const headerDiscount = Math.min(maxHeaderDiscount, manualHeaderDiscount + promoDiscount)
  const netSubtotal = Math.max(0, total - lineDiscountTotal - headerDiscount)
  const grandTotal = netSubtotal + taxAmount
  const resellerSnapshot = await getResellerCommissionSnapshot(orgId, payload.reseller_id)

  if (resellerSnapshot?.error) {
    return { error: resellerSnapshot.error }
  }

  const quoteInsertPayload = {
    org_id: orgId,
    branch_id: activeBranchId,
    customer_id: payload.customer_id,
    reseller_id: resellerSnapshot.resellerId,
    commission_type: resellerSnapshot.commissionType,
    commission_value: resellerSnapshot.commissionValue,
    sale_date: payload.sale_date,
    due_date: payload.due_date,
    payment_term: payload.payment_term || 'TEMPO',
    total_amount: total,
    tax_amount: taxAmount,
    discount_amount: headerDiscount,
    grand_total: grandTotal,
    shariah_mode: normalizeShariahMode(payload.shariah_mode),
    notes: payload.notes,
    created_by: user.id,
    status: 'QUOTATION',
  }
  let { data: quote, error: quoteErr } = await (supabase as any)
    .from('sales')
    .insert(quoteInsertPayload)
    .select('id')
    .single()

  if (quoteErr && isSalesCommissionColumnSchemaCacheMiss(quoteErr)) {
    if (resellerSnapshot.resellerId) {
      return { error: getLegacySalesCommissionMigrationMessage() }
    }

    const fallbackQuoteResult = await (supabase as any)
      .from('sales')
      .insert(omitSalesCommissionColumns(quoteInsertPayload))
      .select('id')
      .single()

    quote = fallbackQuoteResult.data
    quoteErr = fallbackQuoteResult.error
  }

  if (quoteErr) return { error: quoteErr.message }

  const { error: linesErr } = await (supabase as any)
    .from('sales_items')
    .insert(normalizedLines.map((l: any) => ({
      org_id: orgId,
      branch_id: activeBranchId,
      sale_id: quote.id,
      product_id: l.product_id,
      description: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_amount: l.discount_amount || 0,
    })))

  if (linesErr) return { error: linesErr.message }

  if (appliedPromoId) {
    const usageResult = await incrementSalesPromoUsage(supabase as any, orgId, appliedPromoId)
    if ('error' in usageResult) {
      ;(console as any).warn('[createQuotation] failed to increment promo usage:', usageResult.error)
    }
  }

  revalidatePath('/sales/quotations')
  return { success: true, quotationId: quote.id }
}

export async function convertQuotationToOrder(orgId: string, quoteId: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengonversi quotation.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const { error } = await (supabase as any)
    .from('sales')
    .update({ status: 'DRAFT', updated_at: new Date().toISOString() })
    .eq('id', quoteId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) return { error: error.message }
  
  revalidatePath('/sales/quotations')
  revalidatePath('/sales')
  return { success: true }
}

export async function updateSaleStatus(orgId: string, saleId: string, status: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengubah status pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const { error } = await (supabase as any)
    .from('sales')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) return { error: error.message }
  
  revalidatePath('/sales/pipeline')
  revalidatePath('/sales')
  return { success: true }
}

export async function createQuickKanbanCard(
  orgId: string, 
  payload: { name: string; phone: string; email: string; amount: number; notes: string; status: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat card pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  // 1. Create a rapid generic contact
  const { data: contact, error: contactErr } = await (supabase as any)
    .from('contacts')
    .insert({
      org_id: orgId,
      name: payload.name || 'Anonymous Lead',
      type: 'CUSTOMER',
      phone: payload.phone || null,
      email: payload.email || null,
    })
    .select('id')
    .single()

  if (contactErr) return { error: 'Gagal membuat kontak: ' + contactErr.message }

  // 2. Create the Sale (Kanban Card)
  const { data: sale, error: saleErr } = await (supabase as any)
    .from('sales')
    .insert({
      org_id: orgId,
      branch_id: activeBranchId,
      customer_id: contact.id,
      sale_date: new Date().toISOString().split('T')[0],
      total_amount: payload.amount,
      tax_amount: 0,
      discount_amount: 0,
      grand_total: payload.amount,
      status: payload.status,
      shariah_mode: 'CASH',
      notes: payload.notes || 'via Kanban Add Card',
      created_by: user.id
    })
    .select('id')
    .single()

  if (saleErr) return { error: 'Gagal membuat card: ' + saleErr.message }

  revalidatePath('/sales/pipeline')
  return { success: true, saleId: sale.id }
}

export async function updateSalesCard(
  orgId: string,
  saleId: string,
  payload: { name: string; phone: string; email: string; amount: number; notes: string; status: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengubah card pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  const { data: sale } = await (supabase as any)
    .from('sales')
    .select('customer_id')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchId)
    .single()

  if (!sale) return { error: 'Card tidak ditemukan' }

  // Update contact
  await (supabase as any)
    .from('contacts')
    .update({
      name: payload.name,
      phone: payload.phone || null,
      email: payload.email || null,
    })
    .eq('id', sale.customer_id)
    .eq('org_id', orgId)

  // Update sale
  const { error: saleErr } = await (supabase as any)
    .from('sales')
    .update({
      total_amount: payload.amount,
      grand_total: payload.amount,
      notes: payload.notes,
      status: payload.status,
    })
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchId)

  if (saleErr) return { error: 'Gagal mengedit card: ' + saleErr.message }

  revalidatePath('/sales/pipeline')
  return { success: true }
}

export async function deleteSalesCard(orgId: string, saleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menghapus card pipeline.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { error } = await (supabase as any)
    .from('sales')
    .delete()
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) return { error: 'Gagal menghapus card: ' + error.message }
  revalidatePath('/sales/pipeline')
  return { success: true }
}
