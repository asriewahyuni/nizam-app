'use server'

import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { convertQuantityBetweenUnits } from '@/modules/factory/lib/unit-conversion'
import { withDbUserContext } from '@/modules/sales/lib/sales-write.server'

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
  orgId: string,
  items: BomPayloadItem[]
): Promise<{ data: Array<{ product_id: string; quantity: number; unit: string | null }> } | { error: string }> {
  if (!items.length) return { data: [] }

  const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))]
  if (productIds.length === 0) {
    return { error: 'Item BoM tidak valid.' }
  }

  const productRows = await prisma.products.findMany({
    where: {
      org_id: orgId,
      id: { in: productIds },
    },
    select: {
      id: true,
      name: true,
      unit: true,
    },
  })

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

function normalizeBom(row: any) {
  return {
    ...row,
    branch: row.branches ?? null,
    product: row.products ?? null,
    items: Array.isArray(row.production_bom_items)
      ? row.production_bom_items.map((item: any) => ({
          ...item,
          quantity: Number(item.quantity || 0),
          product: item.products ?? null,
        }))
      : [],
  }
}

function normalizeWorkOrder(row: any) {
  return {
    ...row,
    quantity_planned: Number(row.quantity_planned || 0),
    quantity_completed: Number(row.quantity_completed || 0),
    branch: row.branches ?? null,
    bom: row.production_boms
      ? {
          ...row.production_boms,
          branch: row.production_boms.branches ?? null,
          product: row.production_boms.products ?? null,
          items: Array.isArray(row.production_boms.production_bom_items)
            ? row.production_boms.production_bom_items.map((item: any) => ({
                ...item,
                quantity: Number(item.quantity || 0),
                product: item.products ?? null,
              }))
            : [],
        }
      : null,
  }
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
  const bom = await prisma.production_boms.create({
    data: {
      org_id: orgId,
      branch_id: activeBranchResult.branchId,
      product_id: payload.productId,
      code: payload.code,
      description: payload.description,
    },
    select: { id: true },
  })

  const normalizedItemsResult = await normalizeBomItemsForPersistence(
    orgId,
    payload.items
  )
  if ('error' in normalizedItemsResult) return { error: normalizedItemsResult.error }

  const bomItems = normalizedItemsResult.data.map((item) => ({
    bom_id: bom.id,
    ...item,
  }))

  if (bomItems.length > 0) {
    await prisma.production_bom_items.createMany({ data: bomItems })
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
  await prisma.production_boms.update({
    where: { id: accessibleBom.id },
    data: {
      product_id: payload.productId,
      code: payload.code,
      description: payload.description,
      updated_at: new Date(),
    },
  })

  // 2. Refresh Items: Delete and Re-insert
  await prisma.production_bom_items.deleteMany({ where: { bom_id: accessibleBom.id } })

  const normalizedItemsResult = await normalizeBomItemsForPersistence(
    orgId,
    payload.items
  )
  if ('error' in normalizedItemsResult) return { error: normalizedItemsResult.error }

  const bomItems = normalizedItemsResult.data.map((item) => ({
    bom_id: accessibleBom.id,
    ...item,
  }))

  if (bomItems.length > 0) {
    await prisma.production_bom_items.createMany({ data: bomItems })
  }

  revalidatePath('/factory')
  return { success: true }
}

export async function getWorkOrders(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveFactoryBranchId(orgId, branchId)
  if ('error' in branchSelection) return []

  try {
    const workOrders = await prisma.production_work_orders.findMany({
      where: {
        org_id: orgId,
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      include: {
        branches: { select: { id: true, name: true, code: true } },
        production_boms: {
          include: {
            branches: { select: { id: true, name: true, code: true } },
            products: {
              select: {
                id: true,
                name: true,
                sku: true,
                average_cost: true,
                purchase_price: true,
                unit: true,
              },
            },
            production_bom_items: {
              include: {
                products: {
                  select: {
                    id: true,
                    name: true,
                    average_cost: true,
                    purchase_price: true,
                    sku: true,
                    unit: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    return workOrders.map(normalizeWorkOrder)
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

  const bom_id = String(formData.get('bom_id') || '').trim()
  const wo_number = String(formData.get('wo_number') || '').trim()
  const quantity_planned = Number(formData.get('quantity_planned'))
  const notesValue = formData.get('notes')
  const notes = typeof notesValue === 'string' ? notesValue.trim() : ''
  const deadlineInput = String(formData.get('deadline_date') || '').trim()

  if (!bom_id) {
    return { error: 'Resep produksi wajib dipilih.' }
  }

  if (!wo_number) {
    return { error: 'Nomor SPK wajib diisi.' }
  }

  if (!Number.isFinite(quantity_planned) || quantity_planned <= 0) {
    return { error: 'Jumlah target produksi harus lebih besar dari nol.' }
  }

  const deadline_date = deadlineInput ? new Date(`${deadlineInput}T00:00:00.000Z`) : null
  if (deadline_date && Number.isNaN(deadline_date.getTime())) {
    return { error: 'Tanggal batas selesai tidak valid.' }
  }

  const accessibleBom = await getAccessibleBom(orgId, bom_id, activeBranchResult.branchId)
  if (!accessibleBom) {
    return { error: 'Resep produksi tidak tersedia untuk unit aktif.' }
  }

  try {
    await prisma.production_work_orders.create({
      data: {
        org_id: orgId,
        branch_id: activeBranchResult.branchId,
        bom_id: accessibleBom.id,
        wo_number,
        quantity_planned,
        status: 'DRAFT',
        ...(notes ? { notes } : {}),
        ...(deadline_date ? { deadline_date } : {}),
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: 'Nomor SPK sudah digunakan. Gunakan nomor lain.' }
    }

    return {
      error: error instanceof Error ? error.message : 'Gagal membuat SPK.',
    }
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
  const data: any = await withDbUserContext(userId, async (tx: Prisma.TransactionClient) => {
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
