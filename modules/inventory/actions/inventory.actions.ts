'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Product } from '@/types/database.types'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type ProductInventoryFields = Pick<
  Product,
  'id' | 'name' | 'sku' | 'type' | 'unit' | 'purchase_price' | 'selling_price' | 'category' | 'is_active'
> & {
  barcode?: string | null
  average_cost?: number | null
}

export interface ProductWithStock extends ProductInventoryFields {
  stock_in: number
  stock_value: number
  stock_out: number
  stock_available: number
}

export type InventoryWarehouseStockRow = {
  product_id: string
  product_name: string
  product_sku: string | null
  product_unit: string | null
  product_category: string | null
  warehouse_id: string
  warehouse_name: string
  warehouse_code: string | null
  quantity: number
  unit_cost: number
  stock_value: number
}

export type InventoryMutationRow = {
  id: string
  product_id: string
  product_name: string
  product_sku: string | null
  product_unit: string | null
  product_category: string | null
  movement_date: string
  quantity: number
  unit_price: number
  reference_type: string
  reference_id: string
  notes: string | null
  warehouse_id: string | null
  warehouse_name: string | null
  warehouse_code: string | null
}

type WarehouseScopeRecord = {
  id: string
  branch_id: string | null
  is_active: boolean
}

type ActiveBranchResult =
  | { branchId: string }
  | { error: string }

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

async function getScopedWarehouses(
  supabase: any,
  orgId: string,
  warehouseIds: string[],
  branchId: string | null
): Promise<WarehouseScopeRecord[]> {
  const uniqueIds = [...new Set(warehouseIds.filter(Boolean))]
  if (uniqueIds.length === 0) return []

  let query = supabase
    .from('warehouses')
    .select('id, branch_id, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('id', uniqueIds)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query
  if (error) return []
  return (data as WarehouseScopeRecord[]) || []
}

export async function getProducts(orgId: string, branchId?: string | null): Promise<ProductWithStock[]> {
  const supabase = await createClient()
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  const { data: productsData } = await supabase
    .from('products')
    .select('id, name, sku, barcode, type, unit, purchase_price, selling_price, category, average_cost, is_active')
    .eq('org_id', orgId)
    .order('name', { ascending: true })

  let stockQuery = (supabase as any)
    .from('inventory_stocks')
    .select('product_id, quantity, warehouses!inner(branch_id, is_active)')
    .eq('org_id', orgId)
    .eq('warehouses.is_active', true)

  if (effectiveBranchId) {
    stockQuery = stockQuery.eq('warehouses.branch_id', effectiveBranchId)
  }

  const { data: stockRows } = await stockQuery

  const products = (productsData as ProductInventoryFields[]) || []
  const currentStocks = stockRows || []

  const stockByProduct: Record<string, number> = {}

  currentStocks.forEach((stock: any) => {
    stockByProduct[stock.product_id] = (stockByProduct[stock.product_id] || 0) + Number(stock.quantity || 0)
  })

  return products.map((product) => {
    const available = stockByProduct[product.id] || 0
    const weightedUnitCost = Number(product.average_cost ?? product.purchase_price ?? 0)
    const stockValue = Math.max(0, available * weightedUnitCost)

    return {
      ...product,
      stock_in: 0,
      stock_out: 0,
      stock_available: available,
      stock_value: stockValue,
    }
  })
}



export async function createProduct(productData: Partial<Product>) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('products')
    .insert([productData])
    .select()
    .single()

  if (error) {
    (console as any).error('Error creating product:', error.message)
    return { error: error.message }
  }

  revalidatePath('/inventory')
  return { data: data as Product }
}

export async function updateProduct(id: string, orgId: string, productData: Partial<Product>) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('products')
    .update(productData)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    (console as any).error('Error updating product:', error.message)
    return { error: error.message }
  }

  revalidatePath('/inventory')
  return { data: data as Product }
}

export async function deleteProduct(id: string, orgId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/inventory')
  return { success: true }
}
/**
 * COLLISION-PROOF INSERT HELPER
 * The DB trigger `set_adj_number()` ALWAYS overwrites adj_number using COUNT(*)+1.
 * If old records exist with matching numbers (e.g. ADJ-2026-000003), it causes a 
 * permanent unique constraint violation. This helper:
 * 1. Predicts what the trigger will generate
 * 2. Renames any conflicting old record
 * 3. Retries up to 5 times on failure
 */
async function insertAdjustmentWithRetry(
  supabase: any, 
  insertData: Record<string, any>,
  maxRetries = 5
): Promise<{ data: any; error: any }> {
  const orgId = insertData.org_id

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Step 1: Count existing records to predict what the trigger will generate
    const { count } = await supabase
      .from('inventory_adjustments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)

    const predictedSeq = String((count || 0) + 1).padStart(4, '0')

    // Step 2: Find any existing record whose adj_number contains this sequence 
    // (the trigger format is ADJ-YYMMDD-XXXX-RANDOM)
    const { data: conflicts } = await supabase
      .from('inventory_adjustments')
      .select('id, adj_number')
      .eq('org_id', orgId)
      .like('adj_number', `%-${predictedSeq}%`)

    // Step 3: Rename all conflicting records to clear the way
    for (const conflict of (conflicts || [])) {
      await supabase
        .from('inventory_adjustments')
        .update({ adj_number: conflict.adj_number + '-R' + Date.now() } as any)
        .eq('id', conflict.id)
    }

    // Step 4: Attempt the insert (trigger will generate the number)
    const { data, error } = await supabase
      .from('inventory_adjustments')
      .insert(insertData)
      .select()
      .single()

    if (!error) return { data, error: null }

    // If it's NOT a duplicate key error, don't retry
    if (!error.message?.includes('duplicate key') && !error.message?.includes('unique constraint')) {
      return { data: null, error }
    }

    console.warn(`[ADJ] Attempt ${attempt + 1} failed (collision). Retrying.`)
  }

  return { data: null, error: { message: 'Gagal membuat adjustment setelah ' + maxRetries + ' percobaan. Silakan hubungi admin.' } }
}

// Generalized Adjustment (Opname / Write-off)
export async function createInventoryAdjustment(
  orgId: string, 
  payload: {
    adj_date: string;
    type: 'STOCK_COUNT' | 'WRITE_OFF';
    notes: string;
    items: {
      product_id: string;
      warehouse_id: string;
      actual_quantity: number; 
      diff_quantity: number;
      unit_cost: number;
      notes: string;
    }[]
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk melakukan stok opname atau write-off.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const scopedWarehouses = await getScopedWarehouses(
    supabase as any,
    orgId,
    payload.items.map((item) => item.warehouse_id),
    activeBranchId
  )

  if (scopedWarehouses.length !== [...new Set(payload.items.map((item) => item.warehouse_id))].length) {
    return { error: 'Gudang opname tidak tersedia pada unit aktif.' }
  }

  const { data: adj, error: adjErr } = await insertAdjustmentWithRetry(supabase, {
    org_id: orgId,
    adj_date: payload.adj_date,
    type: payload.type,
    status: 'DRAFT',
    total_value: payload.items.reduce((sum: any, it: any) => sum + (Math.abs(it.diff_quantity) * it.unit_cost), 0),
    notes: payload.notes,
    created_by: user.id
  })

  if (adjErr) return { error: adjErr.message }

  const itemsToInsert = payload.items.map((it: any) => ({
    org_id: orgId, 
    adjustment_id: adj.id,
    product_id: it.product_id,
    warehouse_id: it.warehouse_id,
    actual_quantity: it.actual_quantity,
    diff_quantity: it.diff_quantity,
    unit_cost: it.unit_cost,
    total_value: Math.abs(it.diff_quantity) * it.unit_cost,
    notes: it.notes
  }))

  const { error: itemsErr } = await supabase
    .from('inventory_adjustment_items')
    .insert(itemsToInsert as any)

  if (itemsErr) return { error: itemsErr.message }

  const { error: procErr } = await (supabase as any).rpc('process_inventory_adjustment', {
    p_adj_id: adj.id,
    p_user_id: user.id
  })

  if (procErr) return { error: 'Gagal memproses penyesuaian: ' + procErr.message }

  revalidatePath('/inventory')
  return { success: true, adj_id: adj.id }
}

export async function createInventoryTransfer(
  orgId: string,
  payload: {
    transfer_date: string;
    source_wh_id: string;
    target_wh_id: string;
    notes: string;
    items: {
      product_id: string;
      quantity: number;
      notes: string;
    }[]
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk melakukan transfer stok.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const scopedWarehouses = await getScopedWarehouses(
    supabase as any,
    orgId,
    [payload.source_wh_id, payload.target_wh_id],
    activeBranchId
  )

  if (scopedWarehouses.length !== 2) {
    return { error: 'Gudang transfer tidak tersedia pada unit aktif.' }
  }

  // 🔴 RESILIENCY FIX: Use existing 'inventory_adjustments' table (MIGRATION 031 compatible)
  // Modeling Transfer as a 2-line adjustment: -Qty (Source) and +Qty (Target)
  const { data: adj, error: adjErr } = await insertAdjustmentWithRetry(supabase, {
    org_id: orgId,
    adj_date: payload.transfer_date,
    type: 'STOCK_COUNT', // Use existing enum type
    status: 'DRAFT',
    total_value: 0, // Zero sum movement
    notes: `[TRANSFER] ${payload.notes}`,
    created_by: user.id
  })

  if (adjErr) return { error: 'Transfer Header Error: ' + adjErr.message }

  const { data: products } = await (supabase as any)
    .from('products')
    .select('id, purchase_price, average_cost')
    .eq('org_id', orgId)
  
  if (!products) return { error: 'Gagal memvalidasi data produk.' }

  const itemsToInsert: any[] = []
  
  for (const it of payload.items) {
    const product = products.find((p: any) => p.id === it.product_id)
    const cost = Number((product as any)?.average_cost ?? product?.purchase_price ?? 1) || 1 // Must be > 0 for DB constraint

    // A. Source Line (-Qty)
    itemsToInsert.push({
      org_id: orgId,
      adjustment_id: adj.id,
      product_id: it.product_id,
      warehouse_id: payload.source_wh_id,
      actual_quantity: 0, 
      diff_quantity: -Math.abs(it.quantity),
      unit_cost: cost,
      total_value: Math.abs(it.quantity) * cost,
      notes: `Transfer Keluar ke Target`
    })

    // B. Target Line (+Qty)
    itemsToInsert.push({
      org_id: orgId,
      adjustment_id: adj.id,
      product_id: it.product_id,
      warehouse_id: payload.target_wh_id,
      actual_quantity: 0,
      diff_quantity: Math.abs(it.quantity),
      unit_cost: cost,
      total_value: Math.abs(it.quantity) * cost,
      notes: `Transfer Masuk dari Source`
    })
  }

  const { error: itemsErr } = await (supabase as any)
    .from('inventory_adjustment_items')
    .insert(itemsToInsert)

  if (itemsErr) return { error: 'Transfer Items Error: ' + itemsErr.message }

  const { error: procErr } = await (supabase as any).rpc('process_inventory_adjustment', {
    p_adj_id: adj.id,
    p_user_id: user.id
  } as any)

  if (procErr) return { error: 'Gagal memproses mutasi: ' + procErr.message }

  revalidatePath('/inventory')
  return { success: true, transfer_id: adj.id }
}

// Keep backward compatibility for Write-off
export async function createInventoryWriteOff(orgId: string, payload: any) {
  return createInventoryAdjustment(orgId, {
    ...payload,
    type: 'WRITE_OFF',
    items: payload.items.map((it: any) => ({
      ...it,
      actual_quantity: 0,
      diff_quantity: -Math.abs(it.quantity)
    }))
  })
}

export async function getStockLedger(orgId: string, productId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return { error: branchSelection.error }
  const effectiveBranchId = branchSelection.branchId
  
  const { data: product } = await supabase
    .from('products')
    .select('name, sku, unit')
    .eq('id', productId)
    .single()

  let movementsQuery = supabase
    .from('stock_movements')
    .select('*')
    .eq('org_id', orgId)
    .eq('product_id', productId)

  if (effectiveBranchId) {
    movementsQuery = movementsQuery.eq('branch_id', effectiveBranchId)
  }

  const { data: movements, error } = await movementsQuery.order('created_at', { ascending: true })
    
  if (error) return { error: error.message }
  
  return {
    product,
    movements: movements || []
  }
}

export async function getWarehouseStocks(orgId: string, productId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  let query = (supabase as any)
    .from('inventory_stocks')
    .select('warehouse_id, quantity, warehouses!inner(name, branch_id)')
    .eq('org_id', orgId)
    .eq('product_id', productId)

  if (effectiveBranchId) {
    query = query.eq('warehouses.branch_id', effectiveBranchId)
  }

  const { data, error } = await query

  if (error || !Array.isArray(data)) return []

  const stocksByWarehouse = new Map<string, { warehouse_id: string; warehouse_name?: string; quantity: number }>()

  data.forEach((stock: any) => {
    const warehouseId = String(stock?.warehouse_id || '').trim()
    if (!warehouseId) return

    const quantity = Number(stock?.quantity || 0)
    const warehouseName = (stock?.warehouses as any)?.name || 'Unknown'
    const existing = stocksByWarehouse.get(warehouseId)

    if (existing) {
      existing.quantity += quantity
      return
    }

    stocksByWarehouse.set(warehouseId, {
      warehouse_id: warehouseId,
      warehouse_name: warehouseName,
      quantity,
    })
  })

  return Array.from(stocksByWarehouse.values()).sort((left, right) =>
    String(left.warehouse_name || '').localeCompare(String(right.warehouse_name || ''))
  )
}

export async function getInventoryWarehouseSnapshot(orgId: string, branchId?: string | null): Promise<InventoryWarehouseStockRow[]> {
  const supabase = await createClient()
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  let query = (supabase as any)
    .from('inventory_stocks')
    .select(`
      product_id,
      warehouse_id,
      quantity,
      products!inner(name, sku, unit, category, purchase_price, average_cost),
      warehouses!inner(name, code, branch_id, is_active)
    `)
    .eq('org_id', orgId)
    .eq('warehouses.is_active', true)

  if (effectiveBranchId) {
    query = query.eq('warehouses.branch_id', effectiveBranchId)
  }

  const { data, error } = await query
  if (error || !Array.isArray(data)) return []

  const snapshotByKey = new Map<string, InventoryWarehouseStockRow>()

  data.forEach((row: any) => {
    const product = row?.products
    const warehouse = row?.warehouses
    const productId = String(row?.product_id || '').trim()
    const warehouseId = String(row?.warehouse_id || '').trim()
    if (!productId || !warehouseId || !product || !warehouse) return

    const key = `${productId}:${warehouseId}`
    const existing = snapshotByKey.get(key)
    const quantity = Number(row?.quantity || 0)
    const unitCost = Number(product?.average_cost ?? product?.purchase_price ?? 0)

    if (existing) {
      existing.quantity += quantity
      existing.stock_value = Math.max(0, existing.quantity * existing.unit_cost)
      return
    }

    snapshotByKey.set(key, {
      product_id: productId,
      product_name: String(product?.name || 'Tanpa Nama Produk'),
      product_sku: product?.sku ? String(product.sku) : null,
      product_unit: product?.unit ? String(product.unit) : null,
      product_category: product?.category ? String(product.category) : null,
      warehouse_id: warehouseId,
      warehouse_name: String(warehouse?.name || 'Gudang'),
      warehouse_code: warehouse?.code ? String(warehouse.code) : null,
      quantity,
      unit_cost: unitCost,
      stock_value: Math.max(0, quantity * unitCost),
    })
  })

  return Array.from(snapshotByKey.values())
    .filter((row) => Math.abs(row.quantity) > 0.0001)
    .sort((left, right) => {
      const byWarehouse = left.warehouse_name.localeCompare(right.warehouse_name)
      if (byWarehouse !== 0) return byWarehouse
      return left.product_name.localeCompare(right.product_name)
    })
}

export async function getInventoryMutations(
  orgId: string,
  branchId?: string | null,
  limit: number = 80
): Promise<InventoryMutationRow[]> {
  const supabase = await createClient()
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  let movementsQuery = (supabase as any)
    .from('stock_movements')
    .select(`
      id,
      product_id,
      movement_date,
      quantity,
      unit_price,
      reference_type: referenceType,
      reference_id,
      notes,
      branch_id,
      products(name, sku, unit, category)
    `)
    .eq('org_id', orgId)
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (effectiveBranchId) {
    movementsQuery = movementsQuery.eq('branch_id', effectiveBranchId)
  }

  const { data: movements, error } = await movementsQuery
  if (error || !Array.isArray(movements) || movements.length === 0) return []

  const movementRows = movements as any[]
  const saleIds = [...new Set(movementRows.filter((row) => row.reference_type === 'SALE' || row.reference_type === 'SALES_RETURN').map((row) => row.reference_id).filter(Boolean))]
  const purchaseIds = [...new Set(movementRows.filter((row) => row.reference_type === 'PURCHASE' || row.reference_type === 'PURCHASE_RETURN').map((row) => row.reference_id).filter(Boolean))]
  const adjustmentIds = [...new Set(movementRows.filter((row) => row.reference_type === 'ADJUSTMENT').map((row) => row.reference_id).filter(Boolean))]

  const [salesResult, purchasesResult, adjustmentItemsResult] = await Promise.all([
    saleIds.length > 0
      ? (supabase as any)
          .from('sales')
          .select('id, warehouse_id, warehouses(name, code, branch_id)')
          .eq('org_id', orgId)
          .in('id', saleIds)
      : Promise.resolve({ data: [] }),
    purchaseIds.length > 0
      ? (supabase as any)
          .from('purchases')
          .select('id, warehouse_id, warehouses(name, code, branch_id)')
          .eq('org_id', orgId)
          .in('id', purchaseIds)
      : Promise.resolve({ data: [] }),
    adjustmentIds.length > 0
      ? (supabase as any)
          .from('inventory_adjustment_items')
          .select('adjustment_id, product_id, diff_quantity, warehouse_id, warehouses(name, code, branch_id)')
          .eq('org_id', orgId)
          .in('adjustment_id', adjustmentIds)
      : Promise.resolve({ data: [] }),
  ])

  const saleWarehouseMap = new Map<string, { warehouse_id: string | null; warehouse_name: string | null; warehouse_code: string | null }>()
  ;(Array.isArray(salesResult.data) ? salesResult.data : []).forEach((row: any) => {
    const warehouse = row?.warehouses
    saleWarehouseMap.set(String(row?.id || ''), {
      warehouse_id: row?.warehouse_id ? String(row.warehouse_id) : null,
      warehouse_name: warehouse?.name ? String(warehouse.name) : null,
      warehouse_code: warehouse?.code ? String(warehouse.code) : null,
    })
  })

  const purchaseWarehouseMap = new Map<string, { warehouse_id: string | null; warehouse_name: string | null; warehouse_code: string | null }>()
  ;(Array.isArray(purchasesResult.data) ? purchasesResult.data : []).forEach((row: any) => {
    const warehouse = row?.warehouses
    purchaseWarehouseMap.set(String(row?.id || ''), {
      warehouse_id: row?.warehouse_id ? String(row.warehouse_id) : null,
      warehouse_name: warehouse?.name ? String(warehouse.name) : null,
      warehouse_code: warehouse?.code ? String(warehouse.code) : null,
    })
  })

  const adjustmentWarehouseQueues = new Map<string, Array<{ warehouse_id: string | null; warehouse_name: string | null; warehouse_code: string | null }>>()
  ;(Array.isArray(adjustmentItemsResult.data) ? adjustmentItemsResult.data : []).forEach((row: any) => {
    const warehouse = row?.warehouses
    if (effectiveBranchId && warehouse?.branch_id && String(warehouse.branch_id) !== effectiveBranchId) return

    const sign = Number(row?.diff_quantity || 0) >= 0 ? 'IN' : 'OUT'
    const key = `${String(row?.adjustment_id || '')}:${String(row?.product_id || '')}:${sign}`
    const existing = adjustmentWarehouseQueues.get(key) || []
    existing.push({
      warehouse_id: row?.warehouse_id ? String(row.warehouse_id) : null,
      warehouse_name: warehouse?.name ? String(warehouse.name) : null,
      warehouse_code: warehouse?.code ? String(warehouse.code) : null,
    })
    adjustmentWarehouseQueues.set(key, existing)
  })

  return movementRows.map((row: any) => {
    let resolvedWarehouse: { warehouse_id: string | null; warehouse_name: string | null; warehouse_code: string | null } | null = null
    const referenceType = String(row?.reference_type || '').trim().toUpperCase()

    if (referenceType === 'SALE' || referenceType === 'SALES_RETURN') {
      resolvedWarehouse = saleWarehouseMap.get(String(row?.reference_id || '')) || null
    } else if (referenceType === 'PURCHASE' || referenceType === 'PURCHASE_RETURN') {
      resolvedWarehouse = purchaseWarehouseMap.get(String(row?.reference_id || '')) || null
    } else if (referenceType === 'ADJUSTMENT') {
      const sign = Number(row?.quantity || 0) >= 0 ? 'IN' : 'OUT'
      const key = `${String(row?.reference_id || '')}:${String(row?.product_id || '')}:${sign}`
      const queue = adjustmentWarehouseQueues.get(key) || []
      resolvedWarehouse = queue.shift() || null
      adjustmentWarehouseQueues.set(key, queue)
    }

    const product = row?.products
    return {
      id: String(row?.id || ''),
      product_id: String(row?.product_id || ''),
      product_name: String(product?.name || 'Tanpa Nama Produk'),
      product_sku: product?.sku ? String(product.sku) : null,
      product_unit: product?.unit ? String(product.unit) : null,
      product_category: product?.category ? String(product.category) : null,
      movement_date: String(row?.movement_date || row?.created_at || ''),
      quantity: Number(row?.quantity || 0),
      unit_price: Number(row?.unit_price || 0),
      reference_type: referenceType,
      reference_id: String(row?.reference_id || ''),
      notes: row?.notes ? String(row.notes) : null,
      warehouse_id: resolvedWarehouse?.warehouse_id || null,
      warehouse_name: resolvedWarehouse?.warehouse_name || null,
      warehouse_code: resolvedWarehouse?.warehouse_code || null,
    } satisfies InventoryMutationRow
  })
}

export async function getProductByBarcode(orgId: string, barcode: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('org_id', orgId)
    .eq('barcode', barcode)
    .maybeSingle()

  if (error) return null
  return data as Product | null
}
