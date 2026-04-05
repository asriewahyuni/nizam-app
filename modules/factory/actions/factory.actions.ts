'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { convertQuantityBetweenUnits } from '@/modules/factory/lib/unit-conversion'

type ActiveBranchResult =
  | { branchId: string }
  | { error: string }

type FactoryBomAccessRecord = {
  id: string
  org_id: string
  branch_id: string | null
}

type FactoryWorkOrderAccessRecord = {
  id: string
  org_id: string
  branch_id: string | null
  bom_id: string
  status: string
}

type FactoryWarehouseAccessRecord = {
  id: string
  org_id: string
  branch_id: string | null
  is_active: boolean
}

type BomPayloadItem = {
  productId: string
  quantity: number
  unit?: string | null
}

type BomItemProductRecord = {
  id: string
  name: string
  unit: string | null
}

async function resolveFactoryBranchId(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return branchSelection
  }

  return { branchId: branchSelection.branchId }
}

async function requireActiveBranchId(orgId: string, errorMessage: string): Promise<ActiveBranchResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: errorMessage }
  }

  return { branchId: branchSelection.branchId }
}

function applyBomBranchFilter(query: any, branchId: string | null) {
  if (!branchId) return query
  return query.or(`branch_id.is.null,branch_id.eq.${branchId}`)
}

async function getAccessibleBom(
  supabase: any,
  orgId: string,
  bomId: string,
  branchId: string
): Promise<FactoryBomAccessRecord | null> {
  const { data, error } = await supabase
    .from('production_boms')
    .select('id, org_id, branch_id')
    .eq('id', bomId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error || !data) return null
  if (data.branch_id && data.branch_id !== branchId) return null
  return data as FactoryBomAccessRecord
}

async function getAccessibleWorkOrder(
  supabase: any,
  orgId: string,
  woId: string,
  branchId: string
): Promise<FactoryWorkOrderAccessRecord | null> {
  const { data, error } = await supabase
    .from('production_work_orders')
    .select('id, org_id, branch_id, bom_id, status')
    .eq('id', woId)
    .eq('org_id', orgId)
    .eq('branch_id', branchId)
    .maybeSingle()

  if (error) return null
  return (data as FactoryWorkOrderAccessRecord | null) ?? null
}

async function getAccessibleWarehouse(
  supabase: any,
  orgId: string,
  warehouseId: string,
  branchId: string
): Promise<FactoryWarehouseAccessRecord | null> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, org_id, branch_id, is_active')
    .eq('id', warehouseId)
    .eq('org_id', orgId)
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return null
  return (data as FactoryWarehouseAccessRecord | null) ?? null
}

async function normalizeBomItemsForPersistence(
  supabase: any,
  orgId: string,
  items: BomPayloadItem[]
): Promise<{ data: Array<{ product_id: string; quantity: number; unit: string | null }> } | { error: string }> {
  if (!items.length) return { data: [] }

  const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))]
  if (productIds.length === 0) {
    return { error: 'Item BoM tidak valid.' }
  }

  const { data: productRows, error: productError } = await (supabase as any)
    .from('products')
    .select('id, name, unit')
    .eq('org_id', orgId)
    .in('id', productIds)

  if (productError) {
    return { error: `Gagal membaca data produk BoM: ${productError.message}` }
  }

  const productMap = new Map<string, BomItemProductRecord>(
    ((productRows as BomItemProductRecord[] | null) || []).map((row) => [row.id, row])
  )

  const normalizedItems: Array<{ product_id: string; quantity: number; unit: string | null }> = []

  for (const item of items) {
    const qty = Number(item.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      return { error: 'Qty bahan baku harus lebih besar dari nol.' }
    }

    const product = productMap.get(item.productId)
    if (!product) {
      return { error: `Produk bahan baku tidak ditemukan: ${item.productId}` }
    }

    const productUnit = product.unit || item.unit || null

    let convertedQty = qty
    try {
      convertedQty = convertQuantityBetweenUnits(qty, item.unit || productUnit, productUnit)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Konversi satuan gagal.'
      return { error: `Bahan "${product.name}": ${reason}` }
    }

    normalizedItems.push({
      product_id: item.productId,
      quantity: convertedQty,
      unit: productUnit,
    })
  }

  return { data: normalizedItems }
}

export async function getBoms(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveFactoryBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = (supabase as any)
    .from('production_boms')
    .select(`
      *,
      branch:branches(id, name, code),
      product:products(id, name, sku, average_cost, purchase_price, unit),
      items:production_bom_items(
        id,
        quantity,
        unit,
        product:products(id, name, sku, average_cost, purchase_price, unit)
      )
    `)
    .eq('org_id', orgId)

  query = applyBomBranchFilter(query, branchSelection.branchId)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    (console as any).error('Error fetching BoM:', error)
    return []
  }

  return data
}

export async function getBomItems(bomId: string) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('production_bom_items')
    .select(`
      *,
      product:products(id, name, code)
    `)
    .eq('bom_id', bomId)

  if (error) {
    (console as any).error('Error fetching BoM items:', error)
    return []
  }

  return data
}

export async function createBom(orgId: string, payload: { productId: string; code: string; description: string; items: Array<{ productId: string; quantity: number; unit?: string }> }) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat resep produksi.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  // Start Transaction (via manual check or RPC)
  // For simplicity using sequential inserts (but in real production we use RPC)
  const { data: bom, error: bomError } = await (supabase as any)
    .from('production_boms')
    .insert({
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
      product_id: payload.productId,
      code: payload.code,
      description: payload.description
    })
    .select()
    .single()

  if (bomError) return { error: bomError.message }

  const normalizedItemsResult = await normalizeBomItemsForPersistence(
    supabase as any,
    orgId,
    payload.items
  )
  if ('error' in normalizedItemsResult) return { error: normalizedItemsResult.error }

  const bomItems = normalizedItemsResult.data.map((item) => ({
    bom_id: bom.id,
    ...item,
  }))

  if (bomItems.length > 0) {
    const { error: itemsError } = await (supabase as any)
      .from('production_bom_items')
      .insert(bomItems)

    if (itemsError) return { error: itemsError.message }
  }

  revalidatePath('/factory')
  return { success: true }
}

export async function updateBom(orgId: string, bomId: string, payload: { productId: string; code: string; description: string; items: Array<{ productId: string; quantity: number; unit?: string }> }) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memperbarui resep produksi.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleBom = await getAccessibleBom(supabase as any, orgId, bomId, activeBranchResult.branchId)
  if (!accessibleBom) {
    return { error: 'Resep produksi tidak ditemukan pada unit aktif.' }
  }

  // 1. Update BoM Header
  const { error: bomError } = await (supabase as any)
    .from('production_boms')
    .update({
      product_id: payload.productId,
      code: payload.code,
      description: payload.description,
      updated_at: new Date().toISOString()
    })
    .eq('id', accessibleBom.id)
    .eq('org_id', orgId)

  if (bomError) return { error: bomError.message }

  // 2. Refresh Items: Delete and Re-insert
  const { error: deleteError } = await (supabase as any)
    .from('production_bom_items')
    .delete()
    .eq('bom_id', accessibleBom.id)

  if (deleteError) return { error: deleteError.message }

  const normalizedItemsResult = await normalizeBomItemsForPersistence(
    supabase as any,
    orgId,
    payload.items
  )
  if ('error' in normalizedItemsResult) return { error: normalizedItemsResult.error }

  const bomItems = normalizedItemsResult.data.map((item) => ({
    bom_id: accessibleBom.id,
    ...item,
  }))

  if (bomItems.length > 0) {
    const { error: itemsError } = await (supabase as any)
      .from('production_bom_items')
      .insert(bomItems)

    if (itemsError) return { error: itemsError.message }
  }

  revalidatePath('/factory')
  return { success: true }
}


export async function getWorkOrders(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const branchSelection = await resolveFactoryBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = (supabase as any)
    .from('production_work_orders')
    .select(`
      *,
      branch:branches(id, name, code),
      bom:production_boms(
        id, code, branch_id,
        branch:branches(id, name, code),
        product:products(id, name, sku),
        items:production_bom_items(
          product_id,
          quantity,
          unit,
          product:products(id, name, average_cost, purchase_price, sku, unit)
        )
      )
    `)
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    (console as any).error('Error fetching Work Orders:', error)
    return []
  }

  return data
}

export async function createWorkOrder(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat SPK.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const bom_id = formData.get('bom_id') as string
  const wo_number = formData.get('wo_number') as string
  const quantity_planned = Number(formData.get('quantity_planned'))
  const notes = formData.get('notes') as string
  const deadline_date = formData.get('deadline_date') as string

  const accessibleBom = await getAccessibleBom(supabase as any, orgId, bom_id, activeBranchResult.branchId)
  if (!accessibleBom) {
    return { error: 'Resep produksi tidak tersedia untuk unit aktif.' }
  }

  const { error } = await (supabase as any)
    .from('production_work_orders')
    .insert({
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
      bom_id: accessibleBom.id,
      wo_number,
      quantity_planned,
      status: 'DRAFT',
      notes,
      deadline_date: deadline_date || null
    })

  if (error) return { error: error.message }

  revalidatePath('/factory')
  return { success: true, message: 'Work Order created successfully' }
}

export async function getWorkOrderCosts(woId: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('production_wo_costs')
    .select('*')
    .eq('wo_id', woId)
    .order('created_at', { ascending: true })

  if (error) return []
  return data
}

export async function addWorkOrderCost(orgId: string, woId: string, payload: { description: string; amount: number; cost_type: string }) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mencatat biaya produksi.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleWorkOrder = await getAccessibleWorkOrder(supabase as any, orgId, woId, activeBranchResult.branchId)
  if (!accessibleWorkOrder) {
    return { error: 'SPK tidak ditemukan pada unit aktif.' }
  }

  const { error } = await (supabase as any)
    .from('production_wo_costs')
    .insert([{ ...payload, wo_id: accessibleWorkOrder.id }])

  if (error) return { error: error.message }
  revalidatePath('/factory')
  return { success: true }
}

export async function getFGBins(orgId: string, warehouseId: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memilih gudang hasil produksi.'
  )
  if ('error' in activeBranchResult) return []

  const accessibleWarehouse = await getAccessibleWarehouse(
    supabase as any,
    orgId,
    warehouseId,
    activeBranchResult.branchId
  )
  if (!accessibleWarehouse) return []

  const { data, error } = await (supabase as any)
    .from('warehouse_bins')
    .select('id, code')
    .eq('org_id', orgId)
    .eq('warehouse_id', accessibleWarehouse.id)
  
  if (error) return []
  return data
}

export async function updateWorkOrderStatus(orgId: string, woId: string, status: string, options?: { warehouseId?: string; binId?: string }) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memproses SPK.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleWorkOrder = await getAccessibleWorkOrder(
    supabase as any,
    orgId,
    woId,
    activeBranchResult.branchId
  )
  if (!accessibleWorkOrder) {
    return { error: 'SPK tidak ditemukan pada unit aktif.' }
  }

  if (status === 'COMPLETED') {
    if (!options?.warehouseId) {
      return { error: 'Pilih gudang hasil produksi terlebih dahulu.' }
    }

    const accessibleWarehouse = await getAccessibleWarehouse(
      supabase as any,
      orgId,
      options.warehouseId,
      activeBranchResult.branchId
    )
    if (!accessibleWarehouse) {
      return { error: 'Gudang hasil produksi tidak berada pada unit aktif.' }
    }

    if (options?.binId) {
      const { data: binData, error: binError } = await (supabase as any)
        .from('warehouse_bins')
        .select('id, warehouse_id')
        .eq('id', options.binId)
        .eq('org_id', orgId)
        .eq('warehouse_id', accessibleWarehouse.id)
        .maybeSingle()

      if (binError || !binData?.id) {
        return { error: 'Rak hasil produksi tidak valid untuk gudang terpilih.' }
      }
    }

    const { data: userData } = await (supabase as any).auth.getUser()
    
    // Use V2 (with overhead support)
    const { data, error } = await (supabase as any).rpc('process_work_order_completion_v2', {
      p_wo_id: woId,
      p_user_id: userData.user?.id,
      p_warehouse_id: options?.warehouseId,
      p_bin_id: options?.binId
    })

    if (error) {
      // Fallback to V1 if RPC V2 is not found/active
      console.warn('RPC V2 not found, falling back to V1')
      const { data: v1Data, error: v1Err } = await (supabase as any).rpc('process_work_order_completion', {
        p_wo_id: accessibleWorkOrder.id,
        p_user_id: userData.user?.id,
        p_warehouse_id: accessibleWarehouse.id,
      })
      if (v1Err) return { error: v1Err.message }
      if (!v1Data?.success) return { error: v1Data?.error || 'Failed to complete Work Order' }
    } else if (!data?.success) {
      return { error: data?.error || 'Failed to complete Work Order' }
    }

    revalidatePath('/factory')
    return { success: true, data }
  }

  const payload: any = { status }
  if (status === 'RELEASED') payload.released_at = new Date().toISOString()

  const { error } = await (supabase as any)
    .from('production_work_orders')
    .update(payload)
    .eq('id', accessibleWorkOrder.id)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) return { error: error.message }

  revalidatePath('/factory')
  return { success: true }
}

export async function deleteBom(orgId: string, bomId: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menghapus resep produksi.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleBom = await getAccessibleBom(supabase as any, orgId, bomId, activeBranchResult.branchId)
  if (!accessibleBom) {
    return { error: 'Resep produksi tidak ditemukan pada unit aktif.' }
  }

  const { error } = await (supabase as any)
    .from('production_boms')
    .delete()
    .eq('id', accessibleBom.id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/factory')
  return { success: true }
}

export async function deleteWorkOrder(orgId: string, woId: string) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menghapus SPK.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const { error } = await (supabase as any)
    .from('production_work_orders')
    .delete()
    .eq('id', woId)
    .eq('org_id', orgId)
    .eq('branch_id', activeBranchResult.branchId)

  if (error) return { error: error.message }
  revalidatePath('/factory')
  return { success: true }
}

export async function createPurchaseRequests(orgId: string, requests: any[]) {
  const supabase = await createClient()
  const { data: { user } } = await (supabase as any).auth.getUser()

  if (!user) return { error: 'Unauthorized' }
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat permintaan pembelian produksi.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const payload = requests.map((req: any) => ({
    org_id: orgId,
    branch_id: activeBranchResult.branchId,
    requester_id: user.id,
    product_id: req.productId,
    product_name: req.productName,
    quantity: req.quantity,
    unit: req.unit,
    notes: req.notes,
    status: 'PENDING',
    source_type: 'MANUFACTURING',
    source_id: req.sourceId
  }))

  const { error } = await (supabase as any)
    .from('purchase_requests')
    .insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/factory')
  revalidatePath('/purchasing')
  return { success: true, count: payload.length }
}
