'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { createJournalEntry, postJournalEntry } from '@/modules/accounting/actions/journal.actions'
import {
  buildPurchaseLedgerTransparency,
  formatPurchaseLedgerTransparencyNote,
} from '@/modules/accounting/lib/purchase-ledger-transparency'
import { getBranchAccessScope, resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { nudgeEduModeValidation } from '@/modules/edu/lib/progress-hooks.server'
import { getDocumentHeaderDiscountAmount, getDocumentLineDiscountTotal, roundMoney } from '@/lib/commerce/discounts'
import { getDateInTimeZone } from '@/lib/utils'

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type BranchSelectionResult =
  | { branchId: string | null; error?: undefined }
  | { branchId?: undefined; error: string }

async function resolvePurchasingBranchId(orgId: string, branchId?: string | null): Promise<BranchSelectionResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function ensurePurchaseDocumentAccess(orgId: string, branchId: string | null | undefined) {
  const scope = await getBranchAccessScope(orgId)
  if (!scope.role) {
    return { error: 'Akses organisasi tidak ditemukan.' as const }
  }

  if (scope.accessibleBranches.length === 0) {
    return { error: 'Anda belum memiliki akses ke unit mana pun pada organisasi ini.' as const }
  }

  if (!branchId) {
    if (!scope.canAccessAllBranches) {
      return { error: 'Pilih unit aktif terlebih dahulu untuk mengakses pembelian ini.' as const }
    }
    return { success: true as const }
  }

  if (!scope.accessibleBranchIds.includes(String(branchId))) {
    return { error: 'Pembelian ini tidak tersedia pada unit akses Anda.' as const }
  }

  return { success: true as const }
}

type InventorySyncParams = {
  orgId: string
  productId: string
  warehouseId: string
  diff: number
}

function getInventoryAssetFallbackCode(category?: string | null) {
  if (category === 'Setengah Jadi') return '1302'
  if (category === 'Bahan' || category === 'Pelengkap') return '1303'
  if (category === 'Siap Jual') return '1304'
  return '1301'
}

function normalizePurchaseShariahMode(value?: string | null): 'CASH' | 'SALAM' | 'ISTISHNA' {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()

  if (normalized === 'SALAM' || normalized === 'ISTISHNA') {
    return normalized
  }

  return 'CASH'
}

function normalizeJournalEntryDate(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (DATE_ONLY_PATTERN.test(trimmed)) return trimmed

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return getDateInTimeZone('Asia/Jakarta', parsed)
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return getDateInTimeZone('Asia/Jakarta', value)
  }

  return getDateInTimeZone('Asia/Jakarta')
}

function allocateRoundedAmounts(totalAmount: number, rawWeights: number[]): number[] {
  const total = roundMoney(totalAmount)
  const weights = rawWeights.map((weight) => Math.max(0, Number(weight || 0)))

  if (weights.length === 0) return []
  if (Math.abs(total) <= 0.0001) return weights.map(() => 0)

  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  const allocations = weights.map(() => 0)

  if (weightTotal <= 0) {
    allocations[allocations.length - 1] = total
    return allocations
  }

  let remainderIndex = allocations.length - 1
  for (let index = allocations.length - 1; index >= 0; index -= 1) {
    if (weights[index] > 0) {
      remainderIndex = index
      break
    }
  }

  let allocated = 0
  for (let index = 0; index < weights.length; index += 1) {
    if (index === remainderIndex) continue
    const amount = roundMoney((weights[index] / weightTotal) * total)
    allocations[index] = amount
    allocated = roundMoney(allocated + amount)
  }

  allocations[remainderIndex] = roundMoney(total - allocated)
  return allocations
}

function hydratePurchaseDiscountAmount<T extends Record<string, unknown>>(purchase: T, items: Array<Record<string, unknown>> = []) {
  const storedDiscount = Math.max(0, roundMoney(purchase?.discount_amount))
  const lineDiscountTotal = getDocumentLineDiscountTotal(items)
  const headerDiscountAmount = getDocumentHeaderDiscountAmount({
    ...purchase,
    purchase_items: items,
  }, lineDiscountTotal)
  const effectiveDiscountAmount = roundMoney(Math.max(storedDiscount, lineDiscountTotal + headerDiscountAmount))

  return {
    ...purchase,
    discount_amount: effectiveDiscountAmount,
  }
}

function isAdjustInventoryStockUnavailable(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false

  const message = String(error.message || '').toLowerCase()

  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P10') {
    return true
  }

  if (!message.includes('adjust_inventory_stock')) {
    return false
  }

  return (
    message.includes('schema cache')
    || message.includes('does not exist')
    || message.includes('undefined function')
    || message.includes('no unique or exclusion constraint matching the on conflict specification')
  )
}

function isPurchaseWarehouseColumnSchemaCacheMiss(
  error: { code?: string | null; message?: string | null } | null | undefined
) {
  if (!error) return false
  const message = String(error.message || '')
  return (
    error.code === 'PGRST204' ||
    (message.includes("Could not find the 'warehouse_id' column of 'purchases'") &&
      message.includes('schema cache'))
  )
}

async function insertPurchaseRecord(
  supabase: any,
  payload: Record<string, unknown>,
  selectColumns: string = 'id'
) {
  return (supabase as any)
    .from('purchases')
    .insert({
      ...payload,
      insurance_amount: roundMoney(payload.insurance_amount || 0),
    })
    .select(selectColumns)
    .single()
}

async function updatePurchaseRecord(
  supabase: any,
  payload: Record<string, unknown>,
  filters: Array<[string, unknown]>
) {
  let query = (supabase as any).from('purchases').update({
    ...payload,
    insurance_amount: roundMoney(payload.insurance_amount || 0),
  })

  for (const [column, value] of filters) {
    query = query.eq(column, value)
  }

  return query
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

async function markPurchaseAsReceived(
  supabase: any,
  {
    orgId,
    purchaseId,
    warehouseId,
  }: {
    orgId: string
    purchaseId: string
    warehouseId: string
  }
) {
  const basePayload = {
    status: 'RECEIVED',
    updated_at: new Date().toISOString(),
  }

  const { error: updateError } = await (supabase as any)
    .from('purchases')
    .update({
      ...basePayload,
      warehouse_id: warehouseId,
    })
    .eq('id', purchaseId)
    .eq('org_id', orgId)

  if (!updateError) {
    return { success: true as const }
  }

  if (!isPurchaseWarehouseColumnSchemaCacheMiss(updateError)) {
    return { error: updateError.message }
  }

  const { error: fallbackError } = await (supabase as any)
    .from('purchases')
    .update(basePayload)
    .eq('id', purchaseId)
    .eq('org_id', orgId)

  if (fallbackError) {
    return { error: fallbackError.message }
  }

  return { success: true as const }
}

async function fallbackInventoryStockSync({ orgId, productId, warehouseId, diff }: InventorySyncParams) {
  const adminClient = await createAdminClient()
  const { data: stockRows, error: lookupError } = await (adminClient as any)
    .from('inventory_stocks')
    .select('*')
    .eq('org_id', orgId)
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .is('batch_number', null)
    .order('created_at', { ascending: true })

  if (lookupError) {
    return { error: 'Gagal sinkron stok fisik gudang: ' + lookupError.message }
  }

  const existingStock = ((stockRows as any[]) || []).find((row: any) => row?.bin_id == null) || stockRows?.[0]

  if (existingStock?.id) {
    const { error: updateError } = await (adminClient as any)
      .from('inventory_stocks')
      .update({ quantity: Number(existingStock.quantity || 0) + diff })
      .eq('id', existingStock.id)

    if (updateError) {
      return { error: 'Gagal sinkron stok fisik gudang: ' + updateError.message }
    }

    return { success: true as const }
  }

  const { error: insertError } = await (adminClient as any)
    .from('inventory_stocks')
    .insert({
      org_id: orgId,
      product_id: productId,
      warehouse_id: warehouseId,
      quantity: diff,
      batch_number: null,
    })

  if (insertError) {
    return { error: 'Gagal sinkron stok fisik gudang: ' + insertError.message }
  }

  return { success: true as const }
}

async function syncInventoryStock(supabase: any, params: InventorySyncParams) {
  const { error: inventorySyncError } = await (supabase as any).rpc('adjust_inventory_stock', {
    p_org_id: params.orgId,
    p_product_id: params.productId,
    p_warehouse_id: params.warehouseId,
    p_diff: params.diff,
    p_batch_number: null,
    p_bin_id: null,
  })

  if (!inventorySyncError) {
    return { success: true as const }
  }

  if (!isAdjustInventoryStockUnavailable(inventorySyncError)) {
    return { error: 'Gagal sinkron stok fisik gudang: ' + inventorySyncError.message }
  }

  return fallbackInventoryStockSync(params)
}

export async function getPurchases(orgId: string, branchId?: string | null) {
  noStore()
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()

  if (!user) return []

  // Create admin client once — used for all DB queries below.
  const adminClient = await createAdminClient()

  // Check membership role first (owner/admin always have purchasing:read access).
  // This is more reliable than nizam_has_permission RPC which may deny access
  // when plan permissions aren't configured on the org.
  const { data: membership } = await (adminClient as any)
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const memberRole = String(membership?.role || '').toLowerCase()
  const isPrivileged = memberRole === 'owner' || memberRole === 'admin'

  if (!isPrivileged) {
    // Non-privileged roles still need explicit purchasing:read permission
    const { data: canReadPurchasing, error: permissionError } = await (supabase as any).rpc('nizam_has_permission', {
      p_permission: 'purchasing:read',
      p_org_id: orgId,
    })
    if (permissionError || !canReadPurchasing) return []
  }

  const branchSelection = await resolvePurchasingBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  // Build org_ids array for the query
  let orgIds: string[] = [orgId]
  if (!branchSelection.branchId) {
    // Parent/holding view: include purchases from all active child orgs
    const { data: childOrgs } = await (adminClient as any)
      .from('organizations')
      .select('id')
      .eq('parent_org_id', orgId)
      .eq('is_active', true)
    orgIds = [orgId, ...(childOrgs?.map((o: any) => o.id) || [])]
  }

  // Use direct SQL JOIN to reliably get vendor name, branch, and purchase_items.
  // The postgres-client nested resolver does not work for purchases due to
  // non-standard FK column naming (vendor_id → contacts) and deep sub-nesting.
  const { queryPostgres } = await import('@/lib/db/postgres')

  const baseParams: unknown[] = []

  let whereClause: string
  if (branchSelection.branchId) {
    baseParams.push(orgId, branchSelection.branchId)
    whereClause = `p.org_id = $1 AND p.branch_id = $2`
  } else {
    baseParams.push(orgIds)
    whereClause = `p.org_id = ANY($1::uuid[])`
  }

  const purchaseSql = `
    SELECT
      p.*,
      c.name  AS vendor_name,
      b.name  AS branch_name,
      b.code  AS branch_code
    FROM   public.purchases p
    LEFT JOIN public.contacts c ON c.id = p.vendor_id
    LEFT JOIN public.branches  b ON b.id = p.branch_id
    WHERE  ${whereClause}
    ORDER  BY p.purchase_date DESC, p.created_at DESC
  `

  let purchaseRows: any[] = []
  try {
    const purchaseResult = await queryPostgres<Record<string, unknown>>(purchaseSql, baseParams)
    purchaseRows = purchaseResult.rows
  } catch (err) {
    ; (console as any).error('[getPurchases] raw SQL error:', err)
    return []
  }

  if (purchaseRows.length === 0) return []

  // Fetch purchase_items for all purchases in one query
  const purchaseIds = purchaseRows.map((r) => r.id)
  let itemsByPurchaseId: Record<string, any[]> = {}
  try {
    const itemsResult = await queryPostgres<Record<string, unknown>>(`
      SELECT
        pi.id,
        pi.purchase_id,
        pi.product_id,
        pi.description,
        pi.quantity,
        pi.unit_price,
        pi.discount_amount,
        pi.tax_amount,
        pi.total_amount,
        pr.name  AS product_name,
        pr.sku   AS product_sku,
        pr.unit  AS product_unit
      FROM   public.purchase_items pi
      LEFT JOIN public.products pr ON pr.id = pi.product_id
      WHERE  pi.purchase_id = ANY($1::uuid[])
    `, [purchaseIds])

    for (const item of itemsResult.rows) {
      const pid = String(item.purchase_id ?? '')
      if (!itemsByPurchaseId[pid]) itemsByPurchaseId[pid] = []
      itemsByPurchaseId[pid].push({
        ...item,
        products: item.product_name ? {
          name: item.product_name,
          sku: item.product_sku,
          unit: item.product_unit,
        } : null,
      })
    }
  } catch (err) {
    ; (console as any).warn('[getPurchases] purchase_items fetch failed:', err)
    // Continue without items rather than failing entirely
  }

  // Fetch purchase_payments for debt calculation
  let paymentsByPurchaseId: Record<string, any[]> = {}
  try {
    const paymentsResult = await queryPostgres<Record<string, unknown>>(`
      SELECT purchase_id, amount, discount_amount
      FROM   public.purchase_payments
      WHERE  purchase_id = ANY($1::uuid[])
    `, [purchaseIds])
    for (const pay of paymentsResult.rows) {
      const pid = String(pay.purchase_id ?? '')
      if (!paymentsByPurchaseId[pid]) paymentsByPurchaseId[pid] = []
      paymentsByPurchaseId[pid].push(pay)
    }
  } catch { /* ignore — payments optional */ }

  // Fetch purchase_returns for debt calculation
  let returnsByPurchaseId: Record<string, any[]> = {}
  try {
    const returnsResult = await queryPostgres<Record<string, unknown>>(`
      SELECT purchase_id, total_amount
      FROM   public.purchase_returns
      WHERE  purchase_id = ANY($1::uuid[])
    `, [purchaseIds])
    for (const ret of returnsResult.rows) {
      const pid = String(ret.purchase_id ?? '')
      if (!returnsByPurchaseId[pid]) returnsByPurchaseId[pid] = []
      returnsByPurchaseId[pid].push(ret)
    }
  } catch { /* ignore — returns optional */ }

  // Assemble final rows in the shape the UI expects
  return purchaseRows.map((row) => {
    const pid = String(row.id ?? '')
    const purchaseItems = itemsByPurchaseId[pid] ?? []
    const hydratedRow = hydratePurchaseDiscountAmount(row, purchaseItems)
    return {
      ...hydratedRow,
      // UI expects p.contacts?.name for the vendor
      contacts: hydratedRow.vendor_name ? { name: hydratedRow.vendor_name } : null,
      branches: (hydratedRow.branch_name || hydratedRow.branch_code)
        ? { name: hydratedRow.branch_name, code: hydratedRow.branch_code }
        : null,
      purchase_items: purchaseItems,
      purchase_payments: paymentsByPurchaseId[pid] ?? [],
      purchase_returns: returnsByPurchaseId[pid] ?? [],
    }
  })
}

export async function getPurchaseById(orgId: string, purchaseId: string) {
  noStore()
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()

  if (!user) return null

  const adminClient = await createAdminClient()

  const { data: canReadPurchasing, error: permissionError } = await (supabase as any).rpc('nizam_has_permission', {
    p_permission: 'purchasing:read',
    p_org_id: orgId,
  })

  if (permissionError) return null

  // Owner/admin fallback when RPC denies access
  if (!canReadPurchasing) {
    const { data: membership } = await (adminClient as any)
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    const memberRole = String(membership?.role || '').toLowerCase()
    if (memberRole !== 'owner' && memberRole !== 'admin') return null
  }

  const { queryPostgres } = await import('@/lib/db/postgres')

  try {
    const result = await queryPostgres<Record<string, unknown>>(`
      SELECT
        p.*,
        c.name  AS vendor_name,
        b.name  AS branch_name,
        b.code  AS branch_code
      FROM   public.purchases p
      LEFT JOIN public.contacts c ON c.id = p.vendor_id
      LEFT JOIN public.branches  b ON b.id = p.branch_id
      WHERE  p.org_id = $1 AND p.id = $2
      LIMIT  1
    `, [orgId, purchaseId])

    if (result.rows.length === 0) return null
    const row = result.rows[0]

    // Fetch related sub-tables
    const [itemsResult, paymentsResult, returnsResult] = await Promise.all([
      queryPostgres<Record<string, unknown>>(`
        SELECT
          pi.id, pi.purchase_id, pi.product_id, pi.description,
          pi.quantity, pi.unit_price, pi.discount_amount, pi.tax_amount, pi.total_amount,
          pr.name AS product_name, pr.sku AS product_sku,
          pr.unit AS product_unit, pr.category, pr.selling_price
        FROM   public.purchase_items pi
        LEFT JOIN public.products pr ON pr.id = pi.product_id
        WHERE  pi.purchase_id = $1
      `, [purchaseId]),
      queryPostgres<Record<string, unknown>>(`
        SELECT id, purchase_id, account_id, payment_date, amount, discount_amount, payment_number, notes, created_at
        FROM   public.purchase_payments
        WHERE  purchase_id = $1
      `, [purchaseId]),
      queryPostgres<Record<string, unknown>>(`
        SELECT id, purchase_id, return_number, return_date, total_amount, notes
        FROM   public.purchase_returns
        WHERE  purchase_id = $1
      `, [purchaseId]),
    ])

    const purchaseItems = itemsResult.rows.map((item) => ({
      ...item,
      products: item.product_name ? {
        name: item.product_name,
        sku: item.product_sku,
        unit: item.product_unit,
        category: item.category,
        selling_price: item.selling_price,
      } : null,
    }))
    const hydratedRow = hydratePurchaseDiscountAmount(row, purchaseItems)

    return {
      ...hydratedRow,
      contacts: hydratedRow.vendor_name ? { name: hydratedRow.vendor_name } : null,
      branches: (hydratedRow.branch_name || hydratedRow.branch_code)
        ? { name: hydratedRow.branch_name, code: hydratedRow.branch_code }
        : null,
      purchase_items: purchaseItems,
      purchase_payments: paymentsResult.rows,
      purchase_returns: returnsResult.rows,
    }
  } catch (err) {
    ; (console as any).error('[getPurchaseById] raw SQL error:', err)
    return null
  }
}


export interface PurchaseLineData {
  product_id?: string
  product_name: string
  quantity: number
  unit?: string
  unit_price: number
  discount_amount?: number
  tax_amount?: number
  selling_price?: number
  category?: string
}

export interface CreatePurchaseData {
  vendor_id: string
  branch_id?: string | null
  purchase_date: string
  due_date?: string
  notes?: string
  discount_amount?: number
  tax_amount?: number
  shipping_amount?: number
  insurance_amount?: number
  payment_term: 'LUNAS' | 'TEMPO'
  payment_account_id?: string
  shariah_mode?: 'CASH' | 'SALAM' | 'ISTISHNA'
  mode?: 'DRAFT' | 'PUBLISH'
  draft_id?: string
  currency_code?: string
  exchange_rate?: number | null
  base_currency_amount?: number | null
  lines: PurchaseLineData[]
}

export async function createPurchaseEntry(orgId: string, payload: CreatePurchaseData) {
  const supabase = await createClient()

  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const createMode: 'DRAFT' | 'PUBLISH' =
    String(payload.mode || 'PUBLISH').toUpperCase() === 'DRAFT'
      ? 'DRAFT'
      : 'PUBLISH'

  const normalizedLines = (payload.lines || []).filter((line) => String(line?.product_name || '').trim().length > 0)
  if (!payload.vendor_id || normalizedLines.length === 0) {
    return { error: 'Vendor dan baris produk wajib diisi.' }
  }

  const branchSelection = await resolvePurchasingBranchId(orgId, payload.branch_id)
  if ('error' in branchSelection) {
    return { error: 'Unit aktif tidak valid untuk organisasi ini.' }
  }

  if (!branchSelection.branchId) {
    return { error: 'Pilih unit aktif terlebih dahulu untuk membuat purchase order.' }
  }
  const purchaseBranchId = branchSelection.branchId
  const shariahMode = normalizePurchaseShariahMode(payload.shariah_mode)
  const isSalamPurchase = shariahMode === 'SALAM'

  if (isSalamPurchase && !payload.due_date) {
    return { error: 'Akad SALAM pembelian wajib menetapkan tanggal barang disediakan.' }
  }

  const resolvedPaymentTerm: 'LUNAS' | 'TEMPO' = isSalamPurchase ? 'LUNAS' : payload.payment_term
  const resolvedDueDate = resolvedPaymentTerm === 'TEMPO' || isSalamPurchase
    ? (payload.due_date || null)
    : null

  // 1. Calculate Subtotals to perform Value-Based Allocation for Landed Costs
  const totalOverhead = (payload.shipping_amount || 0) + (payload.insurance_amount || 0)
  const grossSubTotal = normalizedLines.reduce((acc: any, l: any) => acc + (l.quantity * l.unit_price) - (l.discount_amount || 0), 0)

  // 2. Pre-process Products
  const processedLines: any[] = []
  for (const line of normalizedLines) {
    let finalProductId = line.product_id

    // Accurate true Landed Cost HPP per Unit
    const itemValue = (line.quantity * line.unit_price) - (line.discount_amount || 0)
    const allocatedOverhead = grossSubTotal > 0 ? (itemValue / grossSubTotal * totalOverhead) : 0
    const trueHpp = line.quantity > 0 ? line.unit_price + (allocatedOverhead / line.quantity) : line.unit_price

    if (!finalProductId && line.product_name) {
      const { data: newProd, error: prodErr } = await (supabase as any)
        .from('products' as any)
        .insert({
          org_id: orgId,
          name: line.product_name,
          type: 'INVENTORY',
          category: line.category || 'Bahan',
          unit: line.unit || 'Pcs',
          purchase_price: trueHpp,
          selling_price: line.selling_price || trueHpp * 1.25
        })
        .select('id')
        .single()

      if (!prodErr && newProd) finalProductId = newProd.id
    } else if (finalProductId) {
      // Update EXISTING products master data directly using Landed Cost HPP!
      await (supabase as any).from('products' as any)
        .update({
          purchase_price: trueHpp,
          selling_price: line.selling_price || trueHpp * 1.25,
          category: line.category,
          unit: line.unit // Sync unit from PO to master product
        })
        .eq('id', finalProductId)
        .eq('org_id', orgId)
    }

    processedLines.push({
      product_id: finalProductId,
      description: line.product_name,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_amount: line.discount_amount || 0,
      tax_amount: line.tax_amount || 0
    })
  }

  // 2. ATOMIC TRANSACTION
  const headerSubtotal = processedLines.reduce((acc: any, l: any) => acc + (l.quantity * l.unit_price), 0)
  const headerDiscount = payload.discount_amount || processedLines.reduce((acc: any, l: any) => acc + l.discount_amount, 0)
  const headerTax = payload.tax_amount || processedLines.reduce((acc: any, l: any) => acc + l.tax_amount, 0)
  const headerShipping = payload.shipping_amount || 0
  const headerInsurance = payload.insurance_amount || 0
  const headerGrand = headerSubtotal - headerDiscount + headerTax + headerShipping + headerInsurance

  // Simpan info termin di metadata/notes sementara atau via RPC (Saya asumsikan RPC sudah diupdate atau kita pakai p_notes)
  const notesWithTerm = `[TERMIN: ${resolvedPaymentTerm}] ${payload.payment_account_id ? `[ACC: ${payload.payment_account_id}] ` : ''}${payload.notes || ''}`

  const approvalReason = `Purchase Order Baru (${shariahMode})`

  if (payload.draft_id) {
    const { data: existingPurchase, error: existingPurchaseError } = await (supabase as any)
      .from('purchases')
      .select('id, status, branch_id')
      .eq('id', payload.draft_id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (existingPurchaseError || !existingPurchase) {
      return { error: 'Draft PO tidak ditemukan.' }
    }

    const purchaseAccess = await ensurePurchaseDocumentAccess(orgId, existingPurchase.branch_id)
    if ('error' in purchaseAccess) return { error: purchaseAccess.error }

    if (existingPurchase.status !== 'DRAFT') {
      return { error: 'Hanya dokumen PO berstatus DRAFT yang bisa diedit atau diterbitkan ulang.' }
    }

    const { error: updatePurchaseError } = await updatePurchaseRecord(
      supabase,
      {
        vendor_id: payload.vendor_id,
        branch_id: purchaseBranchId,
        purchase_date: payload.purchase_date,
        due_date: resolvedDueDate,
        total_amount: headerSubtotal,
        tax_amount: headerTax,
        discount_amount: headerDiscount,
        shipping_amount: Number(payload.shipping_amount || 0),
        insurance_amount: Number(payload.insurance_amount || 0),
        grand_total: headerGrand,
        notes: notesWithTerm,
        shariah_mode: shariahMode,
        status: createMode === 'DRAFT' ? 'DRAFT' : 'ORDERED',
        updated_at: new Date().toISOString(),
      },
      [
        ['id', payload.draft_id],
        ['org_id', orgId],
      ]
    )

    if (updatePurchaseError) {
      return { error: 'Gagal memperbarui draft PO: ' + updatePurchaseError.message }
    }

    const { error: deleteItemsError } = await (supabase as any)
      .from('purchase_items')
      .delete()
      .eq('org_id', orgId)
      .eq('purchase_id', payload.draft_id)

    if (deleteItemsError) {
      return { error: 'Gagal memperbarui baris item draft PO: ' + deleteItemsError.message }
    }

    const { error: insertItemsError } = await (supabase as any)
      .from('purchase_items')
      .insert(
        processedLines.map((line) => ({
          org_id: orgId,
          purchase_id: payload.draft_id,
          product_id: line.product_id || null,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_amount: line.discount_amount || 0,
          tax_amount: line.tax_amount || 0,
        }))
      )

    if (insertItemsError) {
      return { error: 'Gagal menyimpan item draft PO: ' + insertItemsError.message }
    }

    if (createMode === 'PUBLISH') {
      await (supabase as any)
        .from('approval_requests')
        .update({
          status: 'VOIDED',
          reason: 'Approval PO lama diganti oleh versi draft terbaru',
          decided_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('source_type', 'PURCHASE_ORDER')
        .eq('source_id', payload.draft_id)
        .eq('status', 'PENDING')

      const { error: approvalError } = await (supabase as any)
        .from('approval_requests')
        .insert({
          org_id: orgId,
          branch_id: purchaseBranchId,
          requester_id: user.id,
          source_type: 'PURCHASE_ORDER',
          source_id: payload.draft_id,
          status: 'PENDING',
          reason: approvalReason,
        })

      if (approvalError) {
        return { error: 'Draft PO tersimpan, tapi gagal kirim approval: ' + approvalError.message }
      }
    } else {
      await (supabase as any)
        .from('approval_requests')
        .update({
          status: 'VOIDED',
          reason: 'Draft PO diperbarui sebelum diterbitkan',
          decided_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('source_type', 'PURCHASE_ORDER')
        .eq('source_id', payload.draft_id)
        .eq('status', 'PENDING')
    }

    revalidatePath('/purchasing')
    if (createMode === 'PUBLISH') {
      await nudgeEduModeValidation('purchasing.publish.purchase-from-draft')
    }
    return { success: true, purchaseId: payload.draft_id }
  }

  if (createMode === 'DRAFT') {
    const { data: draftPurchase, error: draftInsertError } = await insertPurchaseRecord(
      supabase,
      {
        org_id: orgId,
        branch_id: purchaseBranchId,
        vendor_id: payload.vendor_id,
        purchase_date: payload.purchase_date,
        due_date: resolvedDueDate,
        total_amount: headerSubtotal,
        tax_amount: headerTax,
        discount_amount: headerDiscount,
        shipping_amount: Number(payload.shipping_amount || 0),
        insurance_amount: Number(payload.insurance_amount || 0),
        grand_total: headerGrand,
        notes: notesWithTerm,
        shariah_mode: shariahMode,
        currency_code: payload.currency_code || 'IDR',
        exchange_rate: payload.exchange_rate || null,
        status: 'DRAFT',
        created_by: user.id,
      },
      'id'
    )

    if (draftInsertError || !draftPurchase?.id) {
      return { error: 'Gagal menyimpan draft PO: ' + (draftInsertError?.message || 'Unknown error') }
    }

    const { error: draftItemsError } = await (supabase as any)
      .from('purchase_items')
      .insert(
        processedLines.map((line) => ({
          org_id: orgId,
          purchase_id: draftPurchase.id,
          product_id: line.product_id || null,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_amount: line.discount_amount || 0,
          tax_amount: line.tax_amount || 0,
        }))
      )

    if (draftItemsError) {
      await (supabase as any).from('purchases').delete().eq('id', draftPurchase.id).eq('org_id', orgId)
      return { error: 'Gagal menyimpan item draft PO: ' + draftItemsError.message }
    }

    revalidatePath('/purchasing')
    return { success: true, purchaseId: draftPurchase.id }
  }

  const { data: rpcRes, error: rpcError } = await (supabase as any).rpc('process_purchase_atomic', {
    p_org_id: orgId,
    p_vendor_id: payload.vendor_id,
    p_date: payload.purchase_date || new Date().toISOString(),
    p_due_date: resolvedDueDate,
    p_total: headerSubtotal,
    p_tax: headerTax,
    p_shipping: headerShipping,
    p_grand_total: headerGrand,
    p_notes: notesWithTerm,
    p_shariah_mode: shariahMode,
    p_lines: JSON.stringify(processedLines),
    p_user_id: user.id,
    p_branch_id: purchaseBranchId,
  })

  if (rpcError || !rpcRes?.success) {
    return { error: 'Atomic Execution Failed: ' + String(rpcRes?.error || rpcError?.message || 'RPC returned no data') }
  }

  // Legacy RPC header insert still omits some header pricing fields such as
  // discount_amount and insurance_amount. Sync them here so PO detail, AP, and
  // receipt landed-cost calculations stay consistent with the submitted form.
  if (Math.abs(headerDiscount) > 0.0001 || Math.abs(headerInsurance) > 0.0001) {
    const { error: headerSyncError } = await updatePurchaseRecord(
      supabase,
      {
        vendor_id: payload.vendor_id,
        branch_id: purchaseBranchId,
        purchase_date: payload.purchase_date,
        due_date: resolvedDueDate,
        total_amount: headerSubtotal,
        tax_amount: headerTax,
        discount_amount: headerDiscount,
        shipping_amount: headerShipping,
        insurance_amount: headerInsurance,
        grand_total: headerGrand,
        notes: notesWithTerm,
        shariah_mode: shariahMode,
      },
      [
        ['id', rpcRes.purchase_id],
        ['org_id', orgId],
      ]
    )

    if (headerSyncError) {
      return {
        error:
          'PO berhasil dibuat, tetapi sinkronisasi diskon/biaya header gagal: ' +
          String(headerSyncError.message || 'unknown error'),
      }
    }
  }

  // Sync currency fields (process_purchase_atomic doesn't handle multi-currency)
  if (payload.currency_code && payload.currency_code !== 'IDR') {
    const { error: currencySyncError } = await updatePurchaseRecord(
      supabase,
      {
        currency_code: payload.currency_code,
        exchange_rate: payload.exchange_rate || null,
      },
      [
        ['id', rpcRes.purchase_id],
        ['org_id', orgId],
      ]
    )
    if (currencySyncError) {
      return {
        error:
          'PO berhasil, tetapi sinkronisasi mata uang gagal: ' +
          String(currencySyncError.message || 'unknown error'),
      }
    }
  }

  revalidatePath('/purchasing')
  await nudgeEduModeValidation('purchasing.create.purchase')
  return { success: true, purchaseId: rpcRes.purchase_id }
}

export async function receivePurchase(orgId: string, purchaseId: string) {
  const supabase = await createClient()
  const { queryPostgres } = await import('@/lib/db/postgres')

  // Fetch purchase with items and products via raw SQL to avoid deep-nesting resolver failure
  let purchase: any = null
  try {
    const poResult = await queryPostgres<Record<string, unknown>>(`
      SELECT * FROM public.purchases WHERE id = $1 AND org_id = $2 LIMIT 1
    `, [purchaseId, orgId])
    if (poResult.rows.length === 0) return { error: 'PO tidak ditemukan.' }
    purchase = poResult.rows[0]

    // Fetch items with product data
    const itemsResult = await queryPostgres<Record<string, unknown>>(`
      SELECT pi.*, p.asset_account_id AS product_asset_account_id, p.category AS product_category
      FROM   public.purchase_items pi
      LEFT JOIN public.products p ON p.id = pi.product_id
      WHERE  pi.purchase_id = $1
    `, [purchaseId])
    purchase.purchase_items = itemsResult.rows.map((item) => ({
      ...item,
      products: item.product_id ? {
        asset_account_id: item.product_asset_account_id,
        category: item.product_category,
      } : null,
    }))
  } catch (err: any) {
    return { error: 'Gagal membaca data PO: ' + (err?.message || 'unknown error') }
  }


  const purchaseAccess = await ensurePurchaseDocumentAccess(orgId, purchase.branch_id)
  if ('error' in purchaseAccess) return { error: purchaseAccess.error }
  const wasAlreadyReceived = purchase.status === 'RECEIVED'
  if (String(purchase.shariah_mode || '').toUpperCase() === 'SALAM' && purchase.payment_status !== 'PAID') {
    return { error: 'Akad SALAM pembelian wajib lunas terlebih dahulu sebelum penerimaan barang.' }
  }

  const shipping = roundMoney(purchase.shipping_amount || 0)
  const insurance = roundMoney(purchase.insurance_amount || 0)
  const totalLandedOverhead = roundMoney(shipping + insurance)
  const totalLineDiscount = roundMoney((purchase.purchase_items || []).reduce(
    (sum: number, item: any) => sum + Number(item.discount_amount || 0),
    0
  ))
  const headerDiscountAdjustment = roundMoney(Number(purchase.discount_amount || 0) - totalLineDiscount)
  const totalNetItemValue = Math.max(
    (purchase.purchase_items || []).reduce((sum: number, item: any) => {
      if (!item?.product_id) return sum
      const grossValue = roundMoney(Number(item.quantity || 0) * Number(item.unit_price || 0))
      return sum + Math.max(grossValue - Number(item.discount_amount || 0), 0)
    }, 0),
    1
  )
  let receiptWarehouse: { id: string; branch_id: string | null } | null = null

  if (purchase.warehouse_id) {
    const { data: explicitWarehouse, error: warehouseError } = await (supabase as any)
      .from('warehouses')
      .select('id, branch_id')
      .eq('id', purchase.warehouse_id)
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle()

    if (warehouseError || !explicitWarehouse) {
      return { error: 'Gudang penerimaan untuk PO ini tidak ditemukan atau tidak aktif.' }
    }

    if (purchase.branch_id && explicitWarehouse.branch_id && explicitWarehouse.branch_id !== purchase.branch_id) {
      return { error: 'Gudang penerimaan tidak berada pada unit yang sama dengan PO.' }
    }

    receiptWarehouse = explicitWarehouse
  }

  if (!receiptWarehouse) {
    let warehouseQuery = (supabase as any)
      .from('warehouses')
      .select('id, branch_id')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(1)

    if (purchase.branch_id) {
      warehouseQuery = warehouseQuery.eq('branch_id', purchase.branch_id)
    }

    const { data } = await warehouseQuery.maybeSingle()
    receiptWarehouse = data || null
  }

  if (!receiptWarehouse) {
    return {
      error: purchase.branch_id
        ? 'Tidak ada gudang aktif untuk unit PO ini. Buat atau pilih gudang unit terlebih dahulu.'
        : 'Tidak ada gudang aktif untuk menerima pembelian ini.',
    }
  }

  const movementBranchId = purchase.branch_id || receiptWarehouse.branch_id || null
  const expectedInventoryDebitTotal = roundMoney(Math.max(
    Number(purchase.grand_total || 0) - Number(purchase.tax_amount || 0),
    0
  ))
  let receiptJournal: { id: string; status: string } | null = null
  const { data: existingReceiptJournal } = await (supabase as any)
    .from('journal_entries')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('reference_type', 'PURCHASE')
    .eq('reference_id', purchase.id)
    .neq('status', 'VOIDED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingReceiptJournal?.id) {
    receiptJournal = {
      id: String(existingReceiptJournal.id),
      status: String(existingReceiptJournal.status || ''),
    }
  }

  // Idempotency guard:
  // If stock movement already exists for this PO but status is not yet RECEIVED
  // (e.g. previous run failed after stock posting), avoid double-posting.
  const stockMovementTable = (supabase as any).from('stock_movements')
  let hasExistingStockMovements = false
  if (typeof stockMovementTable?.select === 'function') {
    const { count: existingMovementCount } = await stockMovementTable
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('reference_type', 'PURCHASE')
      .eq('reference_id', purchase.id)
    hasExistingStockMovements = (existingMovementCount || 0) > 0
  }

  const stockMovements: any[] = []
  const inventoryDebitAllocations: Array<{ assetAccountId: string | null; assetFallbackCode: string; amount: number }> = []
  const inventoryReceiptItems: Array<{
    item: any
    assetAccountId: string | null
    assetFallbackCode: string
    rawLandedTotal: number
  }> = []

  // 3. Process Items for WAC & Stock Card
  const totalPurchaseItems = (purchase.purchase_items || []).length
  let skippedItemCount = 0

  for (const item of purchase.purchase_items) {
    if (!item.product_id) {
      // Item tanpa product_id tidak bisa disinkronkan ke inventaris.
      // Ini terjadi jika produk baru gagal dibuat saat PO atau item diisi tanpa memilih produk dari master.
      skippedItemCount++
        ; (console as any).warn(
          `[receivePurchase] purchase_item ${item.id} pada PO ${purchaseId} tidak memiliki product_id — dilewati dari sinkronisasi stok.`
        )
      continue
    }

    // Landed Cost Calculation (Allocated based on Value)
    const itemGrossValue = roundMoney(Number(item.quantity || 0) * Number(item.unit_price || 0))
    const itemLineDiscount = roundMoney(item.discount_amount || 0)
    const itemNetValue = Math.max(itemGrossValue - itemLineDiscount, 0)
    const allocatedDiscountAdjustment = totalNetItemValue > 0
      ? (itemNetValue / totalNetItemValue) * headerDiscountAdjustment
      : 0
    const allocatedOverhead = totalNetItemValue > 0
      ? (itemNetValue / totalNetItemValue) * totalLandedOverhead
      : 0
    const rawLandedTotal = Math.max(itemNetValue - allocatedDiscountAdjustment + allocatedOverhead, 0)

    const productRel = Array.isArray((item as any).products) ? (item as any).products[0] : (item as any).products
    const rawAssetAccountId = productRel?.asset_account_id
    const assetFallbackCode = getInventoryAssetFallbackCode(productRel?.category)
    inventoryReceiptItems.push({
      item,
      assetAccountId: typeof rawAssetAccountId === 'string' ? rawAssetAccountId : null,
      assetFallbackCode,
      rawLandedTotal,
    })
  }

  // Guard: item tanpa product_id tidak bisa diterima parsial, karena akan
  // membuat stok dan jurnal berbeda dengan nilai PO.
  if (skippedItemCount > 0) {
    return {
      error:
        (skippedItemCount === totalPurchaseItems
          ? 'Semua item pada PO ini tidak terhubung ke produk master. '
          : `${skippedItemCount} item pada PO ini tidak terhubung ke produk master. `) +
        'Buka form edit PO dan pastikan setiap baris produk dipilih dari daftar (bukan diketik manual tanpa memilih). ' +
        'Atau buka Inventaris → Produk dan buat produk terlebih dahulu.'
    }
  }

  const landedTotals = allocateRoundedAmounts(
    expectedInventoryDebitTotal,
    inventoryReceiptItems.map((entry) => entry.rawLandedTotal)
  )

  for (let index = 0; index < inventoryReceiptItems.length; index += 1) {
    const entry = inventoryReceiptItems[index]
    const item = entry.item
    const landedTotal = roundMoney(landedTotals[index] || 0)
    const landedUnitPrice = Number(item.quantity || 0) > 0
      ? landedTotal / Number(item.quantity)
      : Number(item.unit_price || 0)

    if (!hasExistingStockMovements) {
      // Average cost is recalculated by the stock movement trigger after insert.
      stockMovements.push({
        org_id: orgId,
        branch_id: movementBranchId,
        warehouse_id: receiptWarehouse.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: landedUnitPrice,
        reference_type: 'PURCHASE',
        reference_id: purchase.id,
        notes: 'Penerimaan PO ' + (purchase.purchase_number || '')
      })
    }

    inventoryDebitAllocations.push({
      assetAccountId: entry.assetAccountId,
      assetFallbackCode: entry.assetFallbackCode,
      amount: landedTotal,
    })
  }

  // 4. Persistence: Stock Movements (Sub-Ledger) & WMS Sync (Physical Stock)
  if (stockMovements.length > 0) {
    const stockMovementInsert = await insertStockMovementsCompat(supabase, stockMovements)
    if ('error' in stockMovementInsert) {
      return { error: 'Gagal mencatat kartu stok pembelian: ' + stockMovementInsert.error }
    }

    // CRITICAL: Sync with physical inventory (inventory_stocks)
    const whId = receiptWarehouse.id

    for (const m of stockMovements) {
      const inventorySyncResult = await syncInventoryStock(supabase, {
        orgId,
        productId: m.product_id,
        warehouseId: whId,
        diff: m.quantity,
      })

      if ('error' in inventorySyncResult) {
        return inventorySyncResult
      }
    }
  }

  const isLunas = purchase.notes?.includes('[TERMIN: LUNAS]')

  // 5. GL Synchronization (Journal)
  if (!receiptJournal || receiptJournal.status !== 'POSTED') {
    if (receiptJournal?.id && receiptJournal.status === 'DRAFT') {
      const postResult = await postJournalEntry(receiptJournal.id, orgId)
      if ((postResult as any).error) {
        return { error: 'Gagal memposting jurnal penerimaan yang sudah ada: ' + String((postResult as any).error) }
      }
    } else {
      const { data: accounts } = await (supabase as any)
        .from('accounts' as any)
        .select('id, code, type')
        .eq('org_id', orgId)
        .in('code', ['1205', '1301', '1302', '1303', '1304', '1401', '1403', '1404', '2101'])

      const inventoryAccountByCode = Object.fromEntries(
        ((accounts || []) as any[]).map((account: any) => [account.code, account.id])
      ) as Record<string, string | undefined>
      const accPersediaan = inventoryAccountByCode['1301']
      const accPpnMasukan = accounts?.find((a: any) => a.code === '1401')?.id
      const accUangMuka = accounts?.find((a: any) => a.code === '1403')?.id
      const accIstishnaAsset = accounts?.find((a: any) => a.code === '1205')?.id
      const accPiutangSalamVendor = accounts?.find((a: any) => a.code === '1404')?.id
      const defaultAccHutang = accounts?.find((a: any) => a.code === '2101')?.id

      let finalAccCredit = defaultAccHutang
      let LunasAccountId: string | null = null
      if (isLunas) {
        const match = purchase.notes.match(/\[ACC: ([a-f0-9-]+)\]/)
        if (match && match[1]) LunasAccountId = match[1]
      }

      let validatedLunasAccountId: string | null = null
      if (isLunas) {
        if (!LunasAccountId) {
          return { error: 'Pembelian LUNAS wajib memilih akun kas/bank pada form pembelian.' }
        }

        const { data: lunasAccount, error: lunasAccountError } = await (supabase as any)
          .from('accounts')
          .select('id, code, type')
          .eq('id', LunasAccountId)
          .eq('org_id', orgId)
          .maybeSingle()

        if (lunasAccountError || !lunasAccount?.id) {
          return { error: 'Akun kas/bank untuk pembayaran lunas tidak ditemukan.' }
        }

        if (lunasAccount.type !== 'ASSET' || !String(lunasAccount.code || '').startsWith('11')) {
          return { error: 'Akun pembayaran lunas harus akun kas/bank (kelompok 11xx).' }
        }

        validatedLunasAccountId = lunasAccount.id
      }

      // Syariah Mod:
      // - SALAM: clear Piutang Salam Vendor (1404) on goods receipt
      // - ISTISHNA: clear Uang Muka Pembelian (1403)
      if (String(purchase.shariah_mode || '').toUpperCase() === 'SALAM') {
        if (!accPiutangSalamVendor) {
          return { error: 'Akun Piutang Salam Vendor (1404) belum tersedia di CoA. Jalankan migrasi terbaru / aktifkan akun syariah.' }
        }
        finalAccCredit = accPiutangSalamVendor
      } else if (String(purchase.shariah_mode || '').toUpperCase() === 'ISTISHNA') {
        // Gunakan akun 1205 (Piutang Barang Istishna) jika ada, fallback ke 1403 (Uang Muka)
        if (accIstishnaAsset) {
          finalAccCredit = accIstishnaAsset
        } else if (accUangMuka) {
          finalAccCredit = accUangMuka
        }
      } else if (isLunas && validatedLunasAccountId) {
        finalAccCredit = validatedLunasAccountId
      }

      if (!finalAccCredit) {
        return {
          error: isLunas
            ? 'Akun kredit pembelian lunas tidak ditemukan. Pastikan akun kas/bank aktif.'
            : 'Akun Hutang Usaha (2101) tidak ditemukan untuk mencatat penerimaan pembelian.',
        }
      }

      const pajakVal = roundMoney(purchase.tax_amount || 0)
      const grandVal = roundMoney(purchase.grand_total || 0)

      // Check if overhead was paid separately in cash!
      let vendorApAmount = grandVal
      let overheadCashAmount = 0
      let overheadAccId = null

      const overheadMatch = purchase.notes?.match(/\[OVERHEAD_ACC: ([a-f0-9-]+)\]/)
      if (overheadMatch && overheadMatch[1] && (shipping > 0 || insurance > 0)) {
        overheadCashAmount = roundMoney(shipping + insurance)
        vendorApAmount = roundMoney(grandVal - overheadCashAmount)
        overheadAccId = overheadMatch[1]
      }

      const inventoryDebitByAccount: Record<string, number> = {}
      for (const allocation of inventoryDebitAllocations) {
        const accountId =
          allocation.assetAccountId
          || inventoryAccountByCode[allocation.assetFallbackCode]
          || accPersediaan
          || null
        if (!accountId) continue
        inventoryDebitByAccount[accountId] = roundMoney((inventoryDebitByAccount[accountId] || 0) + Number(allocation.amount || 0))
      }

      if (Object.keys(inventoryDebitByAccount).length === 0 && inventoryDebitAllocations.length > 0) {
        return { error: 'Akun persediaan produk belum lengkap. Set asset account produk atau siapkan akun 1301.' }
      }

      const journalLines: any[] = Object.entries(inventoryDebitByAccount).map(([accountId, amount]) => ({
        account_id: accountId,
        debit: amount,
        credit: 0,
        memo: 'Persediaan (Landed) ' + (purchase.purchase_number || '')
      }))

      // PPN
      if (pajakVal > 0 && accPpnMasukan) {
        journalLines.push({ account_id: accPpnMasukan, debit: pajakVal, credit: 0, memo: 'PPN Masukan PO' })
      }

      // Hutang Vendor / Lunas Pembayaran Barang Utama
      if (vendorApAmount > 0) {
        journalLines.push({ account_id: finalAccCredit, debit: 0, credit: vendorApAmount, memo: isLunas ? 'Pembayaran Lunas Barang PO' : 'Hutang Vendor PO' })
      }

      // Kas/Bank untuk Ongkir & Asuransi (Landed Cost Provider 3rd Party)
      if (overheadCashAmount > 0 && overheadAccId) {
        journalLines.push({ account_id: overheadAccId, debit: 0, credit: overheadCashAmount, memo: 'Pembayaran Tunai Freight/Logistics' })
      }

      // Balancer untuk Diskon Global dan Pembulatan (Round-off)
      const totalDebit = roundMoney(journalLines.reduce((acc: any, l: any) => acc + l.debit, 0))
      const totalCredit = roundMoney(journalLines.reduce((acc: any, l: any) => acc + l.credit, 0))

      const diff = roundMoney(totalDebit - totalCredit)
      if (Math.abs(diff) > 0.05) {
        return { error: `Jurnal pembelian tidak balance setelah alokasi diskon/biaya. Selisih ${diff.toFixed(2)}.` }
      }
      if (Math.abs(diff) > 0.001) {
        journalLines.push({
          account_id: finalAccCredit,
          debit: diff < 0 ? Math.abs(diff) : 0,
          credit: diff > 0 ? diff : 0,
          memo: 'Penyesuaian Pembulatan PO'
        })
      }

      const purchaseTransparency = buildPurchaseLedgerTransparency(
        purchase,
        Array.isArray(purchase.purchase_items) ? purchase.purchase_items : []
      )

      const journalResult = await createJournalEntry({
        org_id: orgId,
        branch_id: purchase.branch_id || undefined,
        entry_date: normalizeJournalEntryDate(purchase.purchase_date),
        description: 'Penerimaan Pembelian & Stok ' + (purchase.purchase_number || ''),
        notes: formatPurchaseLedgerTransparencyNote(purchaseTransparency),
        reference_type: 'PURCHASE',
        reference_id: purchase.id,
        lines: journalLines,
        auto_post: true,
        allow_org_scope: true
      })

      const jErr = (journalResult as any).error
      if (jErr) {
        return { error: 'Gagal menjurnal bukti penerimaan: ' + String(jErr) }
      }
    }
  }

  if (!wasAlreadyReceived) {
    const statusResult = await markPurchaseAsReceived(supabase as any, {
      orgId,
      purchaseId,
      warehouseId: purchase.warehouse_id || receiptWarehouse.id,
    })

    if ('error' in statusResult) return { error: 'Gagal memperbarui status PO: ' + statusResult.error }
  }

  if (isLunas) {
    const { error: paymentStatusError } = await (supabase as any)
      .from('purchases')
      .update({
        payment_status: 'PAID',
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchaseId)
      .eq('org_id', orgId)

    if (paymentStatusError) {
      return { error: 'Jurnal pembelian berhasil, tetapi gagal menyinkronkan status pembayaran PO: ' + paymentStatusError.message }
    }
  }

  revalidatePath('/purchasing')
  revalidatePath('/inventory')
  await nudgeEduModeValidation(
    hasExistingStockMovements
      ? 'purchasing.receive.purchase-idempotent'
      : 'purchasing.receive.purchase'
  )
  return { success: true }
}

export async function voidPurchase(orgId: string, purchaseId: string) {
  const supabase = await createClient()

  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }
  const { data: purchase } = await (supabase as any)
    .from('purchases')
    .select('branch_id')
    .eq('id', purchaseId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!purchase) return { error: 'PO tidak ditemukan.' }
  const purchaseAccess = await ensurePurchaseDocumentAccess(orgId, purchase.branch_id)
  if ('error' in purchaseAccess) return { error: purchaseAccess.error }

  // Gunakan RPC agar berjalan di level DB dengan security definer (admin) 
  // Melewati pembatasan RLS agar Ledger & Sub-Ledger sinkron
  const { data: rpcRes, error: rpcError } = await (supabase as any).rpc('void_purchase_atomic', {
    p_org_id: orgId,
    p_purchase_id: purchaseId,
    p_user_id: user.id,
    p_reason: 'Pembatalan Manual via Dashboard'
  })

  if (rpcError || !rpcRes?.success) {
    return { error: 'Gagal membatalkan PO secara atomik: ' + (rpcRes?.error || rpcError?.message) }
  }

  revalidatePath('/purchasing')
  revalidatePath('/inventory')
  revalidatePath('/accounting/ledgers')

  return { success: true }
}

export async function createPurchasePayment(orgId: string, payload: {
  purchase_id: string,
  account_id: string,
  amount: number,
  discount: number,
  payment_date: string,
  notes: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: purchase } = await (supabase as any)
    .from('purchases')
    .select('branch_id')
    .eq('id', payload.purchase_id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!purchase) return { error: 'PO tidak ditemukan.' }
  const purchaseAccess = await ensurePurchaseDocumentAccess(orgId, purchase.branch_id)
  if ('error' in purchaseAccess) return { error: purchaseAccess.error }

  const { data, error } = await (supabase as any).rpc('process_purchase_payment_atomic', {
    p_org_id: orgId,
    p_purchase_id: payload.purchase_id,
    p_account_id: payload.account_id,
    p_amount: payload.amount,
    p_discount: payload.discount,
    p_payment_date: payload.payment_date,
    p_notes: payload.notes,
    p_user_id: user.id
  })

  if (error || !data?.success) {
    return { error: data?.error || error?.message || 'Gagal memproses pembayaran.' }
  }

  revalidatePath('/purchasing')
  return { success: true }
}

export async function createPurchaseReturn(orgId: string, payload: {
  purchase_id: string,
  return_number: string,
  return_date: string,
  notes: string,
  items: any[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: purchase } = await (supabase as any)
    .from('purchases')
    .select('branch_id')
    .eq('id', payload.purchase_id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!purchase) return { error: 'PO tidak ditemukan.' }
  const purchaseAccess = await ensurePurchaseDocumentAccess(orgId, purchase.branch_id)
  if ('error' in purchaseAccess) return { error: purchaseAccess.error }

  const { data, error } = await (supabase as any).rpc('process_purchase_return_atomic', {
    p_org_id: orgId,
    p_purchase_id: payload.purchase_id,
    p_return_number: payload.return_number,
    p_return_date: payload.return_date,
    p_notes: payload.notes,
    p_items: payload.items,
    p_user_id: user.id
  })

  if (error || !data?.success) {
    return { error: data?.error || error?.message || 'Gagal memproses retur.' }
  }

  revalidatePath('/purchasing')
  revalidatePath('/inventory')
  return { success: true }
}

export async function getPurchaseRequests(orgId: string, branchId?: string | null) {
  noStore()
  const supabase = await createClient()
  const branchSelection = await resolvePurchasingBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = (supabase as any)
    .from('purchase_requests')
    .select(`
      *,
      branch:branches(name, code),
      product:products(name, sku, unit)
    `)
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    (console as any).error('DEBUG: getPurchaseRequests fail:', error.message, error.code, error.details)
    let fallbackQuery = (supabase as any)
      .from('purchase_requests')
      .select(`
        *,
        product:products(name, sku, unit)
      `)
      .eq('org_id', orgId)

    if (branchSelection.branchId) {
      fallbackQuery = fallbackQuery.eq('branch_id', branchSelection.branchId)
    }

    const { data: fallback, error: fallbackError } = await fallbackQuery.order('created_at', { ascending: false })
    if (fallbackError) return []
    return fallback
  }
  return data
}

export async function updatePurchaseRequestStatus(orgId: string, requestId: string, status: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolvePurchasingBranchId(orgId, branchId)
  if ('error' in branchSelection) return { error: branchSelection.error }
  let query = (supabase as any)
    .from('purchase_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { error } = await query

  if (error) return { error: error.message }
  revalidatePath('/purchasing')
  revalidatePath('/factory')
  return { success: true }
}

export async function getPendingPurchaseRequestsCount(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolvePurchasingBranchId(orgId, branchId)
  if ('error' in branchSelection) return 0
  let query = (supabase as any)
    .from('purchase_requests')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'PENDING')

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { count, error } = await query

  if (error) return 0
  return count || 0
}

export async function repairReceivedPurchaseStock(orgId: string): Promise<{
  fixed: number
  skipped: number
  errors: string[]
  details: string[]
}> {
  const supabase = await createClient()
  const adminClient = await createAdminClient()
  const { queryPostgres } = await import('@/lib/db/postgres')

  const { data: { user } } = await (supabase as any).auth.getUser()
  if (!user) return { fixed: 0, skipped: 0, errors: ['Tidak terautentikasi.'], details: [] }

  // Hanya owner/admin yang boleh menjalankan repair ini
  const { data: membership } = await (adminClient as any)
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const memberRole = String(membership?.role || '').toLowerCase()
  if (memberRole !== 'owner' && memberRole !== 'admin') {
    return { fixed: 0, skipped: 0, errors: ['Hanya owner/admin yang dapat menjalankan repair stok.'], details: [] }
  }

  let fixedCount = 0
  let skippedCount = 0
  const errors: string[] = []
  const details: string[] = []

  // 1. Ambil semua PO berstatus RECEIVED untuk org ini
  let receivedPurchases: any[] = []
  try {
    const result = await queryPostgres<Record<string, unknown>>(`
      SELECT p.id, p.purchase_number, p.branch_id, p.warehouse_id,
             p.total_amount, p.shipping_amount, p.insurance_amount
      FROM   public.purchases p
      WHERE  p.org_id = $1 AND p.status = 'RECEIVED'
      ORDER  BY p.updated_at DESC
    `, [orgId])
    receivedPurchases = result.rows
  } catch (err: any) {
    return { fixed: 0, skipped: 0, errors: ['Gagal membaca daftar PO: ' + err?.message], details: [] }
  }

  if (receivedPurchases.length === 0) {
    return { fixed: 0, skipped: 0, errors: [], details: ['Tidak ada PO berstatus RECEIVED.'] }
  }

  // 2. Ambil PO yang sudah memiliki stock_movements agar tidak double-post
  const poWithMovements = new Set<string>()
  try {
    const movResult = await queryPostgres<{ reference_id: string }>(`
      SELECT DISTINCT reference_id::text
      FROM   public.stock_movements
      WHERE  org_id = $1 AND reference_type = 'PURCHASE'
    `, [orgId])
    movResult.rows.forEach((r) => poWithMovements.add(String(r.reference_id)))
  } catch { /* jika tabel tidak ada, lanjutkan */ }

  // 3. Proses tiap PO yang belum punya stock_movements
  for (const po of receivedPurchases) {
    const poId = String(po.id)
    const poNum = String(po.purchase_number || poId)

    if (poWithMovements.has(poId)) {
      skippedCount++
      details.push(`[SKIP] ${poNum} — sudah memiliki stock_movements.`)
      continue
    }

    // Ambil items untuk PO ini
    let items: any[] = []
    try {
      const itemsResult = await queryPostgres<Record<string, unknown>>(`
        SELECT pi.id, pi.product_id, pi.quantity, pi.unit_price, pi.discount_amount,
               p.category AS product_category, p.asset_account_id AS product_asset_account_id
        FROM   public.purchase_items pi
        LEFT JOIN public.products p ON p.id = pi.product_id
        WHERE  pi.purchase_id = $1
      `, [poId])
      items = itemsResult.rows
    } catch (err: any) {
      errors.push(`[ERROR] ${poNum}: Gagal baca items — ${err?.message}`)
      continue
    }

    const validItems = items.filter((i) => Boolean(i.product_id))
    if (validItems.length === 0) {
      skippedCount++
      details.push(`[SKIP] ${poNum} — tidak ada item dengan product_id valid (${items.length} item tanpa produk master).`)
      continue
    }

    // Tentukan warehouse untuk PO ini
    let warehouseId: string | null = po.warehouse_id || null
    if (!warehouseId) {
      try {
        let wQuery = (supabase as any)
          .from('warehouses')
          .select('id')
          .eq('org_id', orgId)
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(1)
        if (po.branch_id) wQuery = wQuery.eq('branch_id', po.branch_id)
        const { data: wData } = await wQuery.maybeSingle()
        warehouseId = wData?.id || null
      } catch { /* ignore */ }
    }

    if (!warehouseId) {
      skippedCount++
      details.push(`[SKIP] ${poNum} — tidak ada gudang aktif untuk PO ini.`)
      continue
    }

    // Sync inventory_stocks untuk setiap item valid
    const totalItemsValue = Number(po.total_amount) || 1
    const totalLandedOverhead = (Number(po.shipping_amount) || 0) + (Number(po.insurance_amount) || 0)
    let poHasError = false

    const movementsToInsert: any[] = []

    for (const item of validItems) {
      const itemSubtotal = (Number(item.quantity) * Number(item.unit_price)) - (Number(item.discount_amount) || 0)
      const allocatedOverhead = (itemSubtotal / totalItemsValue) * totalLandedOverhead
      const landedTotal = itemSubtotal + allocatedOverhead
      const landedUnitPrice = item.quantity > 0 ? landedTotal / Number(item.quantity) : Number(item.unit_price)

      movementsToInsert.push({
        org_id: orgId,
        branch_id: po.branch_id || null,
        warehouse_id: warehouseId,
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_price: landedUnitPrice,
        reference_type: 'PURCHASE',
        reference_id: poId,
        notes: `[REPAIR] Penerimaan ${poNum}`,
      })

      // Sync physical inventory_stocks
      const syncResult = await syncInventoryStock(supabase, {
        orgId,
        productId: String(item.product_id),
        warehouseId: String(warehouseId),
        diff: Number(item.quantity),
      })

      if ('error' in syncResult) {
        errors.push(`[ERROR] ${poNum} item ${item.product_id}: ${syncResult.error}`)
        poHasError = true
        break
      }
    }

    if (poHasError) continue

    // Insert stock_movements agar idempotency guard berjalan benar di masa depan
    if (movementsToInsert.length > 0) {
      const stockMovementInsert = await insertStockMovementsCompat(supabase, movementsToInsert)
      if ('error' in stockMovementInsert) {
        // Jika gagal insert movement (misalnya sudah ada), tetap anggap sukses karena inventory_stocks sudah diupdate
        ; (console as any).warn(
          `[repairReceivedPurchaseStock] Gagal insert stock_movements untuk ${poNum}:`,
          stockMovementInsert.error
        )
      }
    }

    fixedCount++
    details.push(`[FIXED] ${poNum} — ${validItems.length} item berhasil disinkronkan ke gudang.`)
  }

  revalidatePath('/purchasing')
  revalidatePath('/inventory')

  return { fixed: fixedCount, skipped: skippedCount, errors, details }
}
