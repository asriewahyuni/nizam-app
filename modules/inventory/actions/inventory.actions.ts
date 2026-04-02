'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Product } from '@/types/database.types'
import { getActiveBranch } from '@/modules/organization/actions/org.actions'

export interface ProductWithStock extends Product {
  stock_in: number
  stock_value: number
  stock_out: number
  stock_available: number
}

type WarehouseScopeRecord = {
  id: string
  branch_id: string | null
  is_active: boolean
}

async function resolveActiveBranchId(orgId: string, branchId?: string | null) {
  if (branchId !== undefined) {
    return branchId ?? null
  }

  const activeBranch = await getActiveBranch(orgId)
  return activeBranch?.id ?? null
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
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }

  const { data, error } = await query
  if (error) return []
  return (data as WarehouseScopeRecord[]) || []
}

export async function getProducts(orgId: string, branchId?: string | null): Promise<ProductWithStock[]> {
  const supabase = await createClient()
  const effectiveBranchId = await resolveActiveBranchId(orgId, branchId)

  const { data: productsData } = await supabase.from('products').select('*').eq('org_id', orgId).order('name', { ascending: true })
  let movementsQuery = supabase
    .from('stock_movements')
    .select('product_id, quantity, unit_price')
    .eq('org_id', orgId)

  if (effectiveBranchId) {
    movementsQuery = (movementsQuery as any).or(`branch_id.eq.${effectiveBranchId},branch_id.is.null`)
  }

  const { data: movementsData } = await movementsQuery

  let stockQuery = (supabase as any)
    .from('inventory_stocks')
    .select('product_id, quantity, warehouses!inner(branch_id)')
    .eq('org_id', orgId)

  if (effectiveBranchId) {
    stockQuery = stockQuery.or(`branch_id.eq.${effectiveBranchId},branch_id.is.null`, { foreignTable: 'warehouses' })
  }

  const { data: stockRows } = await stockQuery

  const products = productsData || []
  const movements = movementsData || []
  const currentStocks = stockRows || []

  // Aggregate Movements per Product (Sub-Ledger Logic)
  const aggregation: Record<string, { in: number, out: number, value: number }> = {}
  const stockByProduct: Record<string, number> = {}
  
  movements.forEach((m: any) => {
    if (!aggregation[m.product_id]) aggregation[m.product_id] = { in: 0, out: 0, value: 0 }
    
    const qty = Number(m.quantity || 0)
    const price = Number(m.unit_price || 0)

    if (qty > 0) {
      aggregation[m.product_id].in += qty
    } else if (qty < 0) {
      aggregation[m.product_id].out += Math.abs(qty)
    }
    
    // Total Value strictly from Sub-ledger records
    aggregation[m.product_id].value += (qty * price)
  })

  currentStocks.forEach((stock: any) => {
    stockByProduct[stock.product_id] = (stockByProduct[stock.product_id] || 0) + Number(stock.quantity || 0)
  })

  return products.map((p: any) => {
    const stats = aggregation[p.id] || { in: 0, out: 0, value: 0 }
    const available = effectiveBranchId ? (stockByProduct[p.id] || 0) : (stats.in - stats.out)
    const stockValue = effectiveBranchId
      ? Math.max(0, available * Number(p.purchase_price || 0))
      : Math.max(0, stats.value)

    return {
      ...p,
      stock_in: stats.in,
      stock_out: stats.out,
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
  const activeBranchId = await resolveActiveBranchId(orgId)
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
  const activeBranchId = await resolveActiveBranchId(orgId)
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

  const { data: products } = await (supabase as any).from('products').select('id, purchase_price').eq('org_id', orgId)
  
  if (!products) return { error: 'Gagal memvalidasi data produk.' }
  
  const productsWithCosts = (products as any[]).map((p: any) => ({
    id: p.id,
    cost: Number(p.purchase_price) || 0
  }))
  
  const itemsToInsert: any[] = []
  
  for (const it of payload.items) {
    const product = products.find((p: any) => p.id === it.product_id)
    const cost = Number(product?.purchase_price || 1) // Must be > 0 for DB constraint

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
  const effectiveBranchId = await resolveActiveBranchId(orgId, branchId)
  
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
    movementsQuery = (movementsQuery as any).or(`branch_id.eq.${effectiveBranchId},branch_id.is.null`)
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
  const effectiveBranchId = await resolveActiveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('inventory_stocks')
    .select('warehouse_id, quantity, warehouses!inner(name, branch_id)')
    .eq('org_id', orgId)
    .eq('product_id', productId)

  if (effectiveBranchId) {
    query = query.or(`branch_id.eq.${effectiveBranchId},branch_id.is.null`, { foreignTable: 'warehouses' })
  }

  const { data, error } = await query

  if (error) return []
  return data.map((s: any) => ({
    warehouse_id: s.warehouse_id,
    warehouse_name: (s.warehouses as any)?.name || 'Unknown',
    quantity: Number(s.quantity || 0)
  }))
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
