/**
 * Quick stock safeguard for open sales orders.
 * Computes sellable quantity as on-hand branch stock minus other ORDERED SOs.
 */

import {
  getScopedSalesWarehouses,
  isWarehousesBranchSchemaMissing,
} from '@/modules/sales/lib/warehouse-branch-compat.server'

const STOCK_EPSILON = 0.000001

type GuardLineInput = {
  product_id?: string | null
  product_name?: string | null
  quantity?: number
}

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  if (Math.abs(rounded) < STOCK_EPSILON) return '0'
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(6).replace(/\.?0+$/, '')
}

function normalizeShariahMode(value?: string | null): 'CASH' | 'SALAM' | 'ISTISHNA' {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()

  if (normalized === 'SALAM' || normalized === 'ISTISHNA') {
    return normalized
  }

  return 'CASH'
}

export function shouldGuardOrderedSaleStock(value?: string | null): boolean {
  const mode = normalizeShariahMode(value)
  return mode !== 'SALAM' && mode !== 'ISTISHNA'
}

export async function ensureSellableBranchStockAvailability(
  supabase: any,
  params: {
    orgId: string
    branchId: string
    lines: GuardLineInput[]
    excludeSaleId?: string | null
  }
): Promise<{ success: true } | { error: string }> {
  const normalizedLines = (params.lines || []).map((line) => ({
    productId: String(line?.product_id || ''),
    productName: String(line?.product_name || ''),
    quantity: Number(line?.quantity || 0),
  }))

  const requestedProductIds = [...new Set(normalizedLines.map((line) => line.productId).filter(Boolean))]
  if (requestedProductIds.length === 0) return { success: true }

  const { data: productRows, error: productError } = await (supabase as any)
    .from('products')
    .select('id, name, type')
    .eq('org_id', params.orgId)
    .in('id', requestedProductIds)

  if (productError) {
    return { error: 'Gagal memvalidasi stok penjualan: ' + productError.message }
  }

  const productById = new Map<string, { name: string; type: string }>()
  for (const product of (productRows as any[]) || []) {
    const id = String(product?.id || '')
    if (!id) continue
    productById.set(id, {
      name: String(product?.name || id),
      type: String(product?.type || 'INVENTORY').toUpperCase(),
    })
  }

  const requirementByProduct = new Map<string, { name: string; requiredQty: number }>()
  for (const line of normalizedLines) {
    if (!line.productId || !Number.isFinite(line.quantity) || line.quantity <= 0) continue
    const productMeta = productById.get(line.productId)
    if (!productMeta || productMeta.type !== 'INVENTORY') continue

    const current = requirementByProduct.get(line.productId)
    if (current) {
      current.requiredQty += line.quantity
      continue
    }

    requirementByProduct.set(line.productId, {
      name: productMeta.name || line.productName || line.productId,
      requiredQty: line.quantity,
    })
  }

  if (requirementByProduct.size === 0) return { success: true }

  const guardedProductIds = Array.from(requirementByProduct.keys())

  const stockQuery = (supabase as any)
    .from('inventory_stocks')
    .select('product_id, quantity, warehouses!inner(branch_id)')
    .eq('org_id', params.orgId)
    .eq('warehouses.branch_id', params.branchId)

  const { data: stockRows, error: stockError } = await stockQuery.in('product_id', guardedProductIds)

  let currentStockRows = (stockRows as any[]) || []
  let currentStockError = stockError

  if (currentStockError && isWarehousesBranchSchemaMissing(currentStockError)) {
    const { data: legacyStockRows, error: legacyStockError } = await (supabase as any)
      .from('inventory_stocks')
      .select('product_id, quantity, warehouse_id')
      .eq('org_id', params.orgId)
      .in('product_id', guardedProductIds)

    if (legacyStockError) {
      return { error: 'Gagal membaca stok saat validasi penjualan: ' + legacyStockError.message }
    }

    const scopedWarehouses = await getScopedSalesWarehouses(
      supabase,
      params.orgId,
      ((legacyStockRows as any[]) || []).map((row) => String(row?.warehouse_id || '')).filter(Boolean),
      params.branchId
    )

    if ('error' in scopedWarehouses) {
      return { error: 'Gagal membaca gudang saat validasi penjualan: ' + scopedWarehouses.error }
    }

    const allowedWarehouseIds = new Set(scopedWarehouses.warehouses.map((warehouse) => warehouse.id))
    currentStockRows = ((legacyStockRows as any[]) || []).filter((row) =>
      allowedWarehouseIds.has(String(row?.warehouse_id || ''))
    )
    currentStockError = null
  }

  if (currentStockError) {
    return { error: 'Gagal membaca stok saat validasi penjualan: ' + currentStockError.message }
  }

  const onHandByProduct: Record<string, number> = {}
  for (const row of currentStockRows) {
    const productId = String((row as any).product_id || '')
    if (!productId) continue
    onHandByProduct[productId] = (onHandByProduct[productId] || 0) + Number((row as any).quantity || 0)
  }

  let orderedSalesQuery = (supabase as any)
    .from('sales')
    .select('id, sales_items(product_id, quantity)')
    .eq('org_id', params.orgId)
    .eq('branch_id', params.branchId)
    .eq('status', 'ORDERED')

  if (params.excludeSaleId) {
    orderedSalesQuery = orderedSalesQuery.neq('id', params.excludeSaleId)
  }

  const { data: orderedSales, error: orderedSalesError } = await orderedSalesQuery
  if (orderedSalesError) {
    return { error: 'Gagal membaca alokasi SO berjalan: ' + orderedSalesError.message }
  }

  const reservedByProduct: Record<string, number> = {}
  const guardedProductIdSet = new Set(guardedProductIds)
  for (const sale of (orderedSales as any[]) || []) {
    for (const item of Array.isArray((sale as any)?.sales_items) ? (sale as any).sales_items : []) {
      const productId = String(item?.product_id || '')
      if (!guardedProductIdSet.has(productId)) continue

      const qty = Number(item?.quantity || 0)
      if (!Number.isFinite(qty) || qty <= 0) continue

      reservedByProduct[productId] = (reservedByProduct[productId] || 0) + qty
    }
  }

  const firstShortage = Array.from(requirementByProduct.entries())
    .map(([productId, requirement]) => {
      const onHandQty = Number(onHandByProduct[productId] || 0)
      const reservedQty = Number(reservedByProduct[productId] || 0)
      const sellableQty = onHandQty - reservedQty
      return {
        name: requirement.name,
        requiredQty: requirement.requiredQty,
        onHandQty,
        reservedQty,
        sellableQty,
        shortage: requirement.requiredQty - sellableQty,
      }
    })
    .find((entry) => entry.shortage > STOCK_EPSILON)

  if (!firstShortage) return { success: true }

  if (firstShortage.reservedQty <= STOCK_EPSILON) {
    return {
      error: `Stok produk "${firstShortage.name}" tidak mencukupi untuk invoice biasa. Dibutuhkan ${formatQuantity(
        firstShortage.requiredQty
      )}, tersedia ${formatQuantity(Math.max(0, firstShortage.onHandQty))}. Ubah transaksi ke akad SALAM agar pesanan tetap bisa dicatat tanpa mengurangi stok saat ini.`,
    }
  }

  return {
    error: `Stok produk "${firstShortage.name}" tidak cukup. Stok fisik ${formatQuantity(
      firstShortage.onHandQty
    )}, sudah dialokasikan ke SO lain ${formatQuantity(
      firstShortage.reservedQty
    )}, tersedia dijual ${formatQuantity(Math.max(
      0,
      firstShortage.sellableQty
    ))}, permintaan ${formatQuantity(firstShortage.requiredQty)}.`,
  }
}
