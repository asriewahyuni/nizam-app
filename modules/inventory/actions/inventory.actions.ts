'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Product } from '@/types/database.types'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

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
  orgId: string,
  warehouseIds: string[],
  branchId: string | null
): Promise<WarehouseScopeRecord[]> {
  const uniqueIds = [...new Set(warehouseIds.filter(Boolean))]
  if (uniqueIds.length === 0) return []

  const whereInfo: any = {
    org_id: orgId,
    is_active: true,
    id: { in: uniqueIds }
  }

  if (branchId) {
    whereInfo.branch_id = branchId
  }

  const data = await prisma.warehouses.findMany({
    where: whereInfo,
    select: { id: true, branch_id: true, is_active: true }
  })
  
  return data as unknown as WarehouseScopeRecord[]
}

export async function getProducts(orgId: string, branchId?: string | null): Promise<ProductWithStock[]> {
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  const productsData = await prisma.products.findMany({
    where: { org_id: orgId },
    orderBy: { name: 'asc' }
  })

  const movementsWhere: any = { org_id: orgId }
  if (effectiveBranchId) {
    movementsWhere.branch_id = effectiveBranchId
  }

  const movementsData = await prisma.stock_movements.findMany({
    where: movementsWhere,
    select: { product_id: true, quantity: true, unit_price: true }
  })

  const stockWhere: any = { org_id: orgId }
  if (effectiveBranchId) {
    stockWhere.warehouses = { branch_id: effectiveBranchId }
  }

  const stockRows = await prisma.inventory_stocks.findMany({
    where: stockWhere,
    select: { product_id: true, quantity: true, warehouses: { select: { branch_id: true } } }
  })

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
    const weightedUnitCost = Number((p as any).average_cost ?? p.purchase_price ?? 0)
    const stockValue = effectiveBranchId
      ? Math.max(0, available * weightedUnitCost)
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
  try {
    const data = await prisma.products.create({
      data: productData as any
    })
    revalidatePath('/inventory')
    return { data: data as unknown as Product }
  } catch (error: any) {
    console.error('Error creating product:', error.message)
    return { error: error.message }
  }
}

export async function updateProduct(id: string, orgId: string, productData: Partial<Product>) {
  try {
    await prisma.products.updateMany({
      where: { id, org_id: orgId },
      data: productData as any
    })
    const data = await prisma.products.findFirst({ where: { id } })
    revalidatePath('/inventory')
    return { data: data as unknown as Product }
  } catch (error: any) {
    console.error('Error updating product:', error.message)
    return { error: error.message }
  }
}

export async function deleteProduct(id: string, orgId: string) {
  try {
    await prisma.products.deleteMany({
      where: { id, org_id: orgId }
    })
    revalidatePath('/inventory')
    return { success: true }
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * COLLISION-PROOF INSERT HELPER
 */
async function insertAdjustmentWithRetry(
  insertData: Record<string, any>,
  maxRetries = 5
): Promise<{ data: any; error: any }> {
  const orgId = insertData.org_id

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Step 1: Count existing records to predict what the trigger will generate
    const count = await prisma.inventory_adjustments.count({
      where: { org_id: orgId }
    })

    const predictedSeq = String((count || 0) + 1).padStart(4, '0')

    // Step 2: Find any existing record whose adj_number contains this sequence 
    const conflicts = await prisma.inventory_adjustments.findMany({
      where: {
        org_id: orgId,
        adj_number: { contains: `-${predictedSeq}-` }
      },
      select: { id: true, adj_number: true }
    })

    // Step 3: Rename all conflicting records to clear the way
    for (const conflict of conflicts) {
        if (conflict.adj_number) {
            await prisma.inventory_adjustments.update({
                where: { id: conflict.id },
                data: { adj_number: conflict.adj_number + '-R' + Date.now() }
            })
        }
    }

    // Step 4: Attempt the insert (trigger will generate the number)
    try {
      const data = await prisma.inventory_adjustments.create({
        data: insertData as any
      })
      return { data, error: null }
    } catch(error: any) {
        // If it's NOT a duplicate key error, don't retry
        if (error.code !== 'P2002' && !error.message?.includes('duplicate key') && !error.message?.includes('unique constraint')) {
            return { data: null, error }
        }
        console.warn(`[ADJ] Attempt ${attempt + 1} failed (collision). Retrying.`)
    }
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
  const authSession = await auth()
  const user = authSession?.user
  if (!user) return { error: 'Unauthorized' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk melakukan stok opname atau write-off.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const scopedWarehouses = await getScopedWarehouses(
    orgId,
    payload.items.map((item) => item.warehouse_id),
    activeBranchId
  )

  if (scopedWarehouses.length !== [...new Set(payload.items.map((item) => item.warehouse_id))].length) {
    return { error: 'Gudang opname tidak tersedia pada unit aktif.' }
  }

  const { data: adj, error: adjErr } = await insertAdjustmentWithRetry({
    org_id: orgId,
    adj_date: new Date(payload.adj_date),
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
  
  try {
    await prisma.inventory_adjustment_items.createMany({
      data: itemsToInsert as any
    })
    
    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${user.id}, true)`
        await tx.$executeRaw`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`
        await tx.$executeRaw`SELECT process_inventory_adjustment(${adj.id}::uuid, ${user.id}::uuid)`
    })

    revalidatePath('/inventory')
    return { success: true, adj_id: adj.id }
  } catch(error: any) {
    return { error: 'Gagal memproses penyesuaian: ' + error.message }
  }
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
  const authSession = await auth()
  const user = authSession?.user
  if (!user) return { error: 'Unauthorized' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk melakukan transfer stok.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const scopedWarehouses = await getScopedWarehouses(
    orgId,
    [payload.source_wh_id, payload.target_wh_id],
    activeBranchId
  )

  if (scopedWarehouses.length !== 2) {
    return { error: 'Gudang transfer tidak tersedia pada unit aktif.' }
  }

  // Modeling Transfer as a 2-line adjustment: -Qty (Source) and +Qty (Target)
  const { data: adj, error: adjErr } = await insertAdjustmentWithRetry({
    org_id: orgId,
    adj_date: new Date(payload.transfer_date),
    type: 'STOCK_COUNT', // Use existing enum type
    status: 'DRAFT',
    total_value: 0, // Zero sum movement
    notes: `[TRANSFER] ${payload.notes}`,
    created_by: user.id
  })

  if (adjErr) return { error: 'Transfer Header Error: ' + adjErr.message }

  const products = await prisma.products.findMany({
    where: { org_id: orgId },
    select: { id: true, purchase_price: true, average_cost: true }
  })
  
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

  try {
      await prisma.inventory_adjustment_items.createMany({ data: itemsToInsert as any })

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${user.id}, true)`
        await tx.$executeRaw`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`
        await tx.$executeRaw`SELECT process_inventory_adjustment(${adj.id}::uuid, ${user.id}::uuid)`
      })

      revalidatePath('/inventory')
      return { success: true, transfer_id: adj.id }
  } catch(error: any) {
      return { error: 'Gagal memproses mutasi: ' + error.message }
  }
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
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return { error: branchSelection.error }
  const effectiveBranchId = branchSelection.branchId
  
  const product = await prisma.products.findFirst({
    where: { id: productId },
    select: { name: true, sku: true, unit: true }
  })

  const movementsWhere: any = {
    org_id: orgId,
    product_id: productId
  }

  if (effectiveBranchId) {
    movementsWhere.branch_id = effectiveBranchId
  }

  try {
      const movements = await prisma.stock_movements.findMany({
        where: movementsWhere,
        orderBy: { created_at: 'asc' }
      })
      
      return {
        product,
        movements: movements || []
      }
  } catch(error: any) {
      return { error: error.message }
  }
}

export async function getWarehouseStocks(orgId: string, productId: string, branchId?: string | null) {
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  const whereInfo: any = {
    org_id: orgId,
    product_id: productId
  }

  if (effectiveBranchId) {
    whereInfo.warehouses = { branch_id: effectiveBranchId }
  }

  try {
      const data = await prisma.inventory_stocks.findMany({
          where: whereInfo,
          select: { warehouse_id: true, quantity: true, warehouses: { select: { name: true, branch_id: true } } }
      })
    
      return data.map((s: any) => ({
        warehouse_id: s.warehouse_id,
        warehouse_name: s.warehouses?.name || 'Unknown',
        quantity: Number(s.quantity || 0)
      }))
  } catch(error) {
      return []
  }
}

export async function getProductByBarcode(orgId: string, barcode: string) {
  try {
      const data = await prisma.products.findFirst({
        where: { org_id: orgId, barcode }
      })
      return data as Product | null
  } catch(error) {
      return null
  }
}
