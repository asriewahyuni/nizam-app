'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

type WarehousePayload = {
  code: string
  name: string
  address?: string | null
  is_active?: boolean
}
type NormalizedWarehousePayload = {
  code: string
  name: string
  address: string | null
  is_active: boolean
}

type WarehouseMutationResult =
  | { success: true; data: any; error?: undefined }
  | { success?: false; error: string; data?: undefined }

type DeleteWarehouseResult =
  | { success: true; error?: undefined }
  | { success?: false; error: string }

type WarehouseAccessRecord = {
  id: string
  org_id: string
  branch_id: string | null
  is_active: boolean
}

type WarehouseBinAccessRecord = {
  id: string
  warehouse_id: string
  warehouses: {
    branch_id: string | null
  } | null
}

type ActiveBranchResult =
  | { branchId: string }
  | { error: string }

function normalizeWarehousePayload(payload: WarehousePayload): NormalizedWarehousePayload | { error: string } {
  const code = payload.code?.trim().toUpperCase() || ''
  const name = payload.name?.trim() || ''
  const address = payload.address?.trim() || null

  if (!code || !name) {
    return { error: 'Kode dan nama gudang wajib diisi.' as const }
  }

  return {
    code,
    name,
    address,
    is_active: payload.is_active ?? true,
  }
}

function revalidateWarehousePages(warehouseId?: string) {
  revalidatePath('/inventory')
  revalidatePath('/inventory/warehouses')
  revalidatePath('/factory')
  if (warehouseId) {
    revalidatePath(`/inventory/warehouses/${warehouseId}`)
  }
}

async function resolveActiveBranchId(orgId: string, branchId?: string | null) {
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

async function getAccessibleWarehouse(
  orgId: string,
  warehouseId: string,
  branchId: string | null
): Promise<WarehouseAccessRecord | null> {
  const whereInfo: any = {
    id: warehouseId,
    org_id: orgId,
    is_active: true,
  }

  if (branchId) {
    whereInfo.branch_id = branchId
  }

  return prisma.warehouses.findFirst({
    select: { id: true, org_id: true, branch_id: true, is_active: true },
    where: whereInfo,
  }) as unknown as WarehouseAccessRecord | null
}

async function getAccessibleWarehouseBin(
  orgId: string,
  binId: string,
  branchId: string | null
): Promise<WarehouseBinAccessRecord | null> {
  const whereInfo: any = {
    id: binId,
    org_id: orgId,
  }

  if (branchId) {
    whereInfo.warehouses = { branch_id: branchId }
  }

  return prisma.warehouse_bins.findFirst({
    select: { id: true, warehouse_id: true, warehouses: { select: { branch_id: true } } },
    where: whereInfo,
  }) as unknown as WarehouseBinAccessRecord | null
}

export async function getWarehouses(orgId: string, branchId?: string | null) {
  const authSession = await auth()
  if (!authSession?.user) return []
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  const whereInfo: any = {
    org_id: orgId,
    is_active: true,
  }

  if (effectiveBranchId) {
    whereInfo.branch_id = effectiveBranchId
  }

  const data = await prisma.warehouses.findMany({
    where: whereInfo,
    include: {
      branches: {
        select: { id: true, name: true, code: true }
      }
    },
    orderBy: { name: 'asc' }
  })

  return data.map(d => ({ ...d, branch: d.branches }))
}

export async function getWarehouseBins(orgId: string, warehouseId?: string, branchId?: string | null) {
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  const whereInfo: any = {
    org_id: orgId,
  }
  if (warehouseId) {
    whereInfo.warehouse_id = warehouseId
  }
  if (effectiveBranchId) {
    whereInfo.warehouses = { branch_id: effectiveBranchId }
  }

  const data = await prisma.warehouse_bins.findMany({
    where: whereInfo,
    include: {
      warehouses: {
        select: { name: true, code: true, branch_id: true }
      }
    },
    orderBy: { warehouse_id: 'asc' }
  })
  
  return data
}

export async function createWarehouseBin(orgId: string, payload: { warehouse_id: string; code: string; description?: string }) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola bin gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const warehouse = await getAccessibleWarehouse(orgId, payload.warehouse_id, activeBranchId)

  if (!warehouse) {
    return { error: 'Gudang tidak tersedia pada unit aktif.' }
  }

  try {
    const data = await prisma.warehouse_bins.create({
      data: { ...payload, org_id: orgId }
    })
    revalidateWarehousePages(payload.warehouse_id)
    return { success: true, data }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function createWarehouse(orgId: string, payload: WarehousePayload): Promise<WarehouseMutationResult> {
  const authSession = await auth()
  if (!authSession?.user) return { error: 'Unauthorized' }

  const normalized = normalizeWarehousePayload(payload)
  if ('error' in normalized) return normalized
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

  try {
    const data = await prisma.warehouses.create({
      data: { ...normalized, org_id: orgId, branch_id: activeBranchId }
    })
    revalidateWarehousePages(data.id)
    return { success: true, data }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function updateWarehouse(orgId: string, id: string, payload: WarehousePayload): Promise<WarehouseMutationResult> {
  const authSession = await auth()
  if (!authSession?.user) return { error: 'Unauthorized' }

  const normalized = normalizeWarehousePayload(payload)
  if ('error' in normalized) return normalized
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const targetWarehouse = await getAccessibleWarehouse(orgId, id, activeBranchId)

  if (!targetWarehouse) {
    return { error: 'Gudang tidak tersedia pada unit aktif.' }
  }

  try {
    const data = await prisma.warehouses.update({
      where: { id },
      data: {
        ...normalized,
        branch_id: activeBranchId,
        updated_at: new Date(),
      }
    })
    revalidateWarehousePages(id)
    return { success: true, data }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function deleteWarehouse(orgId: string, id: string): Promise<DeleteWarehouseResult> {
  const authSession = await auth()
  if (!authSession?.user) return { error: 'Unauthorized' }

  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const targetWarehouse = await getAccessibleWarehouse(orgId, id, activeBranchId)

  if (!targetWarehouse) {
    return { error: 'Gudang tidak tersedia pada unit aktif.' }
  }

  try {
    await prisma.warehouses.update({
      where: { id },
      data: {
        is_active: false,
        updated_at: new Date(),
      }
    })
    revalidateWarehousePages(id)
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function deleteWarehouseBin(orgId: string, id: string) {
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola bin gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const targetBin = await getAccessibleWarehouseBin(orgId, id, activeBranchId)

  if (!targetBin) {
    return { error: 'Bin tidak tersedia pada unit aktif.' }
  }

  try {
    await prisma.warehouse_bins.delete({
      where: { id }
    })
    revalidateWarehousePages(targetBin.warehouse_id)
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
