'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
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

async function getAccessibleBom(
  orgId: string,
  bomId: string,
  branchId: string
): Promise<FactoryBomAccessRecord | null> {
  const data = await prisma.production_boms.findFirst({
    where: {
      id: bomId,
      org_id: orgId,
    },
    select: {
      id: true,
      org_id: true,
      branch_id: true,
    },
  })

  if (!data) return null
  if (data.branch_id && data.branch_id !== branchId) return null
  return data as FactoryBomAccessRecord
}

async function getAccessibleWorkOrder(
  orgId: string,
  woId: string,
  branchId: string
): Promise<FactoryWorkOrderAccessRecord | null> {
  const data = await prisma.production_work_orders.findFirst({
    where: {
      id: woId,
      org_id: orgId,
      branch_id: branchId,
    },
    select: {
      id: true,
      org_id: true,
      branch_id: true,
      bom_id: true,
      status: true,
    },
  })

  return (data as FactoryWorkOrderAccessRecord | null) ?? null
}

async function getAccessibleWarehouse(
  orgId: string,
  warehouseId: string,
  branchId: string
): Promise<FactoryWarehouseAccessRecord | null> {
  const data = await prisma.warehouses.findFirst({
    where: {
      id: warehouseId,
      org_id: orgId,
      branch_id: branchId,
      is_active: true,
    },
    select: {
      id: true,
      org_id: true,
      branch_id: true,
      is_active: true,
    },
  })

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
  const branchSelection = await resolveFactoryBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  try {
    const data = await prisma.production_boms.findMany({
      where: {
        org_id: orgId,
        ...(branchSelection.branchId
          ? {
              OR: [
                { branch_id: null },
                { branch_id: branchSelection.branchId },
              ],
            }
          : {}),
      },
      include: {
        branches: { select: { id: true, name: true, code: true } },
        products: { select: { id: true, name: true, sku: true, average_cost: true, purchase_price: true, unit: true } },
        production_bom_items: {
          select: {
            id: true,
            quantity: true,
            unit: true,
            products: { select: { id: true, name: true, sku: true, average_cost: true, purchase_price: true, unit: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    return data.map(normalizeBom)
  } catch (error) {
    console.error('Error fetching BoM:', error)
    return []
  }
}

export async function getBomItems(bomId: string) {
  try {
    const data = await prisma.production_bom_items.findMany({
      where: {
        bom_id: bomId,
      },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    })

    return data.map((item) => ({
      ...item,
      quantity: Number(item.quantity || 0),
      product: item.products,
    }))
  } catch (error) {
    console.error('Error fetching BoM items:', error)
    return []
  }
}

export async function createBom(orgId: string, payload: { productId: string; code: string; description: string; items: Array<{ productId: string; quantity: number; unit?: string }> }) {
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
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memperbarui resep produksi.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleBom = await getAccessibleBom(orgId, bomId, activeBranchResult.branchId)
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

    return data.map(normalizeWorkOrder)
  } catch (error) {
    console.error('Error fetching Work Orders:', error)
    return []
  }
}

export async function createWorkOrder(orgId: string, formData: FormData) {
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

  const accessibleBom = await getAccessibleBom(orgId, bom_id, activeBranchResult.branchId)
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
  } catch (error: any) {
    return { error: error.message }
  }

  revalidatePath('/factory')
  return { success: true, message: 'Work Order created successfully' }
}

export async function getWorkOrderCosts(woId: string) {
  try {
    const data = await prisma.production_wo_costs.findMany({
      where: {
        wo_id: woId,
      },
      orderBy: {
        created_at: 'asc',
      },
    })

    return data.map((row) => ({
      ...row,
      amount: Number(row.amount || 0),
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    }))
  } catch {
    return []
  }
}

export async function addWorkOrderCost(orgId: string, woId: string, payload: { description: string; amount: number; cost_type: string }) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mencatat biaya produksi.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleWorkOrder = await getAccessibleWorkOrder(orgId, woId, activeBranchResult.branchId)
  if (!accessibleWorkOrder) {
    return { error: 'SPK tidak ditemukan pada unit aktif.' }
  }

  try {
    await prisma.production_wo_costs.create({
      data: {
        description: payload.description,
        amount: payload.amount,
        cost_type: payload.cost_type,
        wo_id: accessibleWorkOrder.id,
      },
    })
  } catch (error: any) {
    return { error: error.message }
  }

  revalidatePath('/factory')
  return { success: true }
}

export async function getFGBins(orgId: string, warehouseId: string) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memilih gudang hasil produksi.'
  )
  if ('error' in activeBranchResult) return []

  const accessibleWarehouse = await getAccessibleWarehouse(
    orgId,
    warehouseId,
    activeBranchResult.branchId
  )
  if (!accessibleWarehouse) return []

  try {
    const data = await prisma.warehouse_bins.findMany({
      where: {
        org_id: orgId,
        warehouse_id: accessibleWarehouse.id,
      },
      select: {
        id: true,
        code: true,
      },
    })

    return data
  } catch {
    return []
  }
}

export async function updateWorkOrderStatus(orgId: string, woId: string, status: string, options?: { warehouseId?: string; binId?: string }) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk memproses SPK.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleWorkOrder = await getAccessibleWorkOrder(
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
      orgId,
      options.warehouseId,
      activeBranchResult.branchId
    )
    if (!accessibleWarehouse) {
      return { error: 'Gudang hasil produksi tidak berada pada unit aktif.' }
    }

    if (options?.binId) {
      const binData = await prisma.warehouse_bins.findFirst({
        where: {
          id: options.binId,
          org_id: orgId,
          warehouse_id: accessibleWarehouse.id,
        },
        select: {
          id: true,
          warehouse_id: true,
        },
      })

      if (!binData?.id) {
        return { error: 'Rak hasil produksi tidak valid untuk gudang terpilih.' }
      }
    }

    try {
      const data: any = await withDbUserContext(userId, async (tx) => {
        try {
          const result = await tx.$queryRaw`
            SELECT process_work_order_completion_v2(
              ${woId}::uuid,
              ${userId}::uuid,
              ${options?.warehouseId || null}::uuid,
              ${options?.binId || null}::uuid
            ) as result
          `
          return (result as any[])[0]?.result
        } catch (error) {
          console.warn('RPC V2 not found, falling back to V1')
          const fallback = await tx.$queryRaw`
            SELECT process_work_order_completion(
              ${accessibleWorkOrder.id}::uuid,
              ${userId}::uuid,
              ${accessibleWarehouse.id}::uuid
            ) as result
          `
          return (fallback as any[])[0]?.result
        }
      })

      if (!data?.success) {
        return { error: data?.error || 'Failed to complete Work Order' }
      }

      revalidatePath('/factory')
      return { success: true, data }
    } catch (error: any) {
      return { error: error?.message || 'Failed to complete Work Order' }
    }
  }

  const payload: any = { status }
  if (status === 'RELEASED') payload.released_at = new Date()

  try {
    await prisma.production_work_orders.updateMany({
      where: {
        id: accessibleWorkOrder.id,
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
      },
      data: payload,
    })
  } catch (error: any) {
    return { error: error.message }
  }

  revalidatePath('/factory')
  return { success: true }
}

export async function deleteBom(orgId: string, bomId: string) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menghapus resep produksi.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const accessibleBom = await getAccessibleBom(orgId, bomId, activeBranchResult.branchId)
  if (!accessibleBom) {
    return { error: 'Resep produksi tidak ditemukan pada unit aktif.' }
  }

  try {
    await prisma.production_boms.delete({
      where: {
        id: accessibleBom.id,
      },
    })
  } catch (error: any) {
    return { error: error.message }
  }

  revalidatePath('/factory')
  return { success: true }
}

export async function deleteWorkOrder(orgId: string, woId: string) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menghapus SPK.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  try {
    await prisma.production_work_orders.deleteMany({
      where: {
        id: woId,
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
      },
    })
  } catch (error: any) {
    return { error: error.message }
  }

  revalidatePath('/factory')
  return { success: true }
}

export async function createPurchaseRequests(orgId: string, requests: any[]) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Unauthorized' }

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat permintaan pembelian produksi.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }

  const payload = requests.map((req: any) => ({
    org_id: orgId,
    branch_id: activeBranchResult.branchId,
    requester_id: userId,
    product_id: req.productId,
    product_name: req.productName,
    quantity: req.quantity,
    unit: req.unit,
    notes: req.notes,
    status: 'PENDING' as any,
    source_type: 'MANUFACTURING',
    source_id: req.sourceId,
  }))

  try {
    await prisma.purchase_requests.createMany({
      data: payload as any,
    })
  } catch (error: any) {
    return { error: error.message }
  }

  revalidatePath('/factory')
  revalidatePath('/purchasing')
  return { success: true, count: payload.length }
}
