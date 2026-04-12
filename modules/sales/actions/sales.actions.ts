'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { getResellerCommissionSnapshot } from '@/modules/sales/actions/commission.actions'
import { ensureSellableBranchStockAvailability, shouldGuardOrderedSaleStock } from '@/modules/sales/lib/stock-guard.server'

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
}

const STOCK_EPSILON = 0.000001

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  if (Math.abs(rounded) < STOCK_EPSILON) return '0'
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(6).replace(/\.?0+$/, '')
}

function normalizeShariahMode(value?: string | null): string {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
  if (normalized === 'SALAM' || normalized === 'ISTISHNA') return normalized
  return 'CASH'
}

function isSalamMode(value?: string | null): boolean {
  return normalizeShariahMode(value) === 'SALAM'
}

async function ensureCreateSaleStockAvailability(
  supabase: any,
  orgId: string,
  branchId: string,
  lines: Array<{ product_id?: string | null; product_name?: string | null; quantity?: number }>
): Promise<{ success: true } | { error: string }> {
  return ensureSellableBranchStockAvailability(supabase, {
    orgId,
    branchId,
    lines,
  })
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null
  return (value as T | null) ?? null
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
  const query = (supabase as any)
    .from('warehouses')
    .select('id, name, branch_id')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .eq('branch_id', branchId)

  if (explicitWarehouseId) {
    const { data, error } = await query.eq('id', explicitWarehouseId).maybeSingle()
    if (error || !data) {
      return { error: 'Gudang pengiriman tidak tersedia pada unit aktif.' }
    }

    return { warehouseId: data.id }
  }

  const { data, error } = await query.order('name', { ascending: true }).limit(2)
  if (error) {
    return { error: 'Gagal memuat gudang pengiriman.' }
  }

  const warehouses = (data as Array<{ id: string }>) || []
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
    .select('product_id, quantity, products(name, type)')
    .eq('org_id', orgId)
    .eq('sale_id', saleId)

  if (error) {
    return { error: 'Gagal memvalidasi stok penjualan: ' + error.message }
  }

  const requirementMap = new Map<string, InventoryRequirement>()
  for (const row of (rows as any[]) || []) {
    const product = normalizeRelation<{ name?: string | null; type?: string | null }>((row as any).products)
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
    })
  }

  return { requirements: Array.from(requirementMap.values()) }
}

async function ensureDeliveryStockAvailability(
  supabase: any,
  orgId: string,
  warehouseId: string,
  requirements: InventoryRequirement[]
): Promise<{ success: true } | { error: string }> {
  if (!requirements.length) return { success: true }

  const productIds = requirements.map((item) => item.productId)
  const { data: stockRows, error } = await (supabase as any)
    .from('inventory_stocks')
    .select('product_id, quantity')
    .eq('org_id', orgId)
    .eq('warehouse_id', warehouseId)
    .in('product_id', productIds)

  if (error) {
    return { error: 'Gagal memvalidasi stok gudang: ' + error.message }
  }

  const availableByProduct: Record<string, number> = {}
  for (const row of (stockRows as any[]) || []) {
    const productId = String((row as any).product_id || '')
    if (!productId) continue
    availableByProduct[productId] = (availableByProduct[productId] || 0) + Number((row as any).quantity || 0)
  }

  const shortages = requirements
    .map((item) => {
      const availableQty = Number(availableByProduct[item.productId] || 0)
      return {
        ...item,
        availableQty,
        shortage: item.requiredQty - availableQty,
      }
    })
    .filter((item) => item.shortage > STOCK_EPSILON)

  if (!shortages.length) return { success: true }

  const first = shortages[0]
  return {
    error: `Stok tidak cukup untuk produk "${first.productName}". Dibutuhkan ${formatQuantity(
      first.requiredQty
    )}, tersedia ${formatQuantity(Math.max(
      0,
      first.availableQty
    ))}. Penjualan tidak boleh melebihi stok (kecuali akad SALAM).`,
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
    .select('product_id, quantity')
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
      // UI expects sale.contacts?.name for the customer
      contacts: row.customer_name ? { name: row.customer_name } : null,
      branches: (row.branch_name || row.branch_code)
        ? { name: row.branch_name, code: row.branch_code }
        : null,
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

  const shariahMode = normalizeShariahMode(payload.shariah_mode)
  const salamMode = isSalamMode(shariahMode)
  const paymentTerm = salamMode ? 'LUNAS' : (String(payload.payment_term || 'TEMPO').toUpperCase() === 'LUNAS' ? 'LUNAS' : 'TEMPO')
  const dueDate = (paymentTerm === 'TEMPO' || salamMode) ? (payload.due_date || null) : null

  if (createMode === 'PUBLISH' && (paymentTerm === 'TEMPO' || salamMode) && !dueDate) {
    return { error: 'Tanggal jatuh tempo pengiriman wajib diisi.' }
  }

  if (createMode === 'PUBLISH' && salamMode && paymentTerm !== 'LUNAS') {
    return { error: 'Akad SALAM wajib dibayar lunas (tunai) di awal.' }
  }

  if (createMode === 'PUBLISH' && shouldGuardOrderedSaleStock(shariahMode)) {
    const createStockCheck = await ensureCreateSaleStockAvailability(
      supabase as any,
      orgId,
      activeBranchId,
      normalizedLines
    )
    if ('error' in createStockCheck) return { error: createStockCheck.error }
  }

  const totalAmount = normalizedLines.reduce((acc: number, l: any) => acc + (l.quantity * l.unit_price), 0)
  const computedTotal = totalAmount - (payload.discount_amount || 0) + (payload.tax_amount || 0)
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
    total_amount: totalAmount,
    tax_amount: payload.tax_amount || 0,
    discount_amount: payload.discount_amount || 0,
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

    if (updateSaleError && isSalesCommissionColumnSchemaCacheMiss(updateSaleError)) {
      if (resellerSnapshot.resellerId) {
        return { error: getLegacySalesCommissionMigrationMessage() }
      }

      const { error: fallbackUpdateError } = await (supabase as any)
        .from('sales')
        .update(omitSalesCommissionColumns(draftPayload))
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

    if (saleErr && isSalesCommissionColumnSchemaCacheMiss(saleErr)) {
      if (resellerSnapshot.resellerId) {
        return { error: getLegacySalesCommissionMigrationMessage() }
      }

      const fallbackInsertResult = await (supabase as any)
        .from('sales')
        .insert(omitSalesCommissionColumns(draftInsertPayload))
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
  if (hasInventoryItems && !isSalam && !resolvedWarehouseId) {
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

  if (hasInventoryItems && !isSalam) {
    if (!resolvedWarehouseId) {
      return { error: 'Gudang pengiriman wajib dipilih untuk memvalidasi stok.' }
    }
    const stockCheck = await ensureDeliveryStockAvailability(
      supabase as any,
      orgId,
      resolvedWarehouseId,
      inventoryRequirementResult.requirements
    )
    if ('error' in stockCheck) return { error: stockCheck.error }
  }

  const { error } = await (supabase as any).rpc('process_sales_delivery_atomic', {
    p_org_id: orgId,
    p_sale_id: saleId,
    p_warehouse_id: resolvedWarehouseId,
  })

  if (error) {
    (console as any).error('Failed to deliver sale via atomic engine:', error)
    return { error: `[RPC ERROR]: ${error.message} (Code: ${error.code})` }
  }

  revalidatePath('/sales')
  revalidatePath('/inventory')
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
    .select('status, warehouse_id')
    .eq('id', saleId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchId)
    .single()

  if (!sale) return { error: 'Order tidak ditemukan.' }
  if (sale.status === 'VOIDED') return { success: true }

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

  let itemsBySaleId: Record<string, any[]> = {}
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
  const headerDiscount = Number(payload.discount_amount || 0)
  const taxAmount = Number(payload.tax_amount || 0)
  const grandTotal = total - lineDiscountTotal - headerDiscount + taxAmount
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
    shariah_mode: payload.shariah_mode || 'CASH',
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
