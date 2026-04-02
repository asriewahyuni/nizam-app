'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getActiveBranch } from '@/modules/organization/actions/org.actions'

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
  if (branchId !== undefined) {
    return branchId ?? null
  }

  const activeBranch = await getActiveBranch(orgId)
  return activeBranch?.id ?? null
}

function applyWarehouseBranchFilter(query: any, branchId: string | null) {
  if (!branchId) return query
  return query.or(`branch_id.eq.${branchId},branch_id.is.null`)
}

async function getAccessibleWarehouse(
  supabase: any,
  orgId: string,
  warehouseId: string,
  branchId: string | null
): Promise<WarehouseAccessRecord | null> {
  let query = supabase
    .from('warehouses')
    .select('id, org_id, branch_id, is_active')
    .eq('id', warehouseId)
    .eq('org_id', orgId)
    .eq('is_active', true)

  query = applyWarehouseBranchFilter(query, branchId)

  const { data, error } = await query.maybeSingle()
  if (error) return null
  return (data as WarehouseAccessRecord | null) ?? null
}

async function getAccessibleWarehouseBin(
  supabase: any,
  orgId: string,
  binId: string,
  branchId: string | null
): Promise<WarehouseBinAccessRecord | null> {
  let query = (supabase as any)
    .from('warehouse_bins')
    .select('id, warehouse_id, warehouses!inner(branch_id)')
    .eq('id', binId)
    .eq('org_id', orgId)

  if (branchId) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`, { foreignTable: 'warehouses' })
  }

  const { data, error } = await query.maybeSingle()
  if (error) return null
  return (data as WarehouseBinAccessRecord | null) ?? null
}

export async function getWarehouses(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []
  const effectiveBranchId = await resolveActiveBranchId(orgId, branchId)

  let query = (supabase as any)
    .from('warehouses')
    .select('*, branch:branches(id, name, code)')
    .eq('org_id', orgId)
    .eq('is_active', true)

  query = applyWarehouseBranchFilter(query, effectiveBranchId)

  const { data, error } = await query.order('name', { ascending: true })

  if (error) return []
  return data
}

export async function getWarehouseBins(orgId: string, warehouseId?: string, branchId?: string | null) {
  const supabase = await createClient()
  const effectiveBranchId = await resolveActiveBranchId(orgId, branchId)
  let query = supabase
    .from('warehouse_bins')
    .select('*, warehouses!inner(name, code, branch_id)')
    .eq('org_id', orgId)
  
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }

  if (effectiveBranchId) {
    query = (query as any).or(`branch_id.eq.${effectiveBranchId},branch_id.is.null`, { foreignTable: 'warehouses' })
  }

  const { data, error } = await query.order('warehouse_id', { ascending: true })
  if (error) return []
  return data
}

export async function createWarehouseBin(orgId: string, payload: { warehouse_id: string; code: string; description?: string }) {
  const supabase = await createClient()
  const activeBranchId = await resolveActiveBranchId(orgId)
  const warehouse = await getAccessibleWarehouse(supabase as any, orgId, payload.warehouse_id, activeBranchId)

  if (!warehouse) {
    return { error: 'Gudang tidak tersedia pada unit aktif.' }
  }

  const { data, error } = await (supabase as any)
    .from('warehouse_bins')
    .insert([{ ...payload, org_id: orgId }])
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateWarehousePages(payload.warehouse_id)
  return { success: true, data }
}

export async function createWarehouse(orgId: string, payload: WarehousePayload): Promise<WarehouseMutationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const normalized = normalizeWarehousePayload(payload)
  if ('error' in normalized) return normalized
  const activeBranchId = await resolveActiveBranchId(orgId)

  const { data, error } = await (supabase as any)
    .from('warehouses')
    .insert([{ ...normalized, org_id: orgId, branch_id: activeBranchId }])
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateWarehousePages(data?.id)
  return { success: true, data }
}

export async function updateWarehouse(orgId: string, id: string, payload: WarehousePayload): Promise<WarehouseMutationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const normalized = normalizeWarehousePayload(payload)
  if ('error' in normalized) return normalized
  const activeBranchId = await resolveActiveBranchId(orgId)
  const targetWarehouse = await getAccessibleWarehouse(supabase as any, orgId, id, activeBranchId)

  if (!targetWarehouse) {
    return { error: 'Gudang tidak tersedia pada unit aktif.' }
  }

  const { data, error } = await (supabase as any)
    .from('warehouses')
    .update({
      ...normalized,
      branch_id: activeBranchId ?? targetWarehouse.branch_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateWarehousePages(id)
  return { success: true, data }
}

export async function deleteWarehouse(orgId: string, id: string): Promise<DeleteWarehouseResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }
  const activeBranchId = await resolveActiveBranchId(orgId)
  const targetWarehouse = await getAccessibleWarehouse(supabase as any, orgId, id, activeBranchId)

  if (!targetWarehouse) {
    return { error: 'Gudang tidak tersedia pada unit aktif.' }
  }

  const { error } = await (supabase as any)
    .from('warehouses')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (error) return { error: error.message }
  revalidateWarehousePages(id)
  return { success: true }
}

export async function deleteWarehouseBin(orgId: string, id: string) {
  const supabase = await createClient()
  const activeBranchId = await resolveActiveBranchId(orgId)
  const targetBin = await getAccessibleWarehouseBin(supabase as any, orgId, id, activeBranchId)

  if (!targetBin) {
    return { error: 'Bin tidak tersedia pada unit aktif.' }
  }

  const { error } = await (supabase as any)
    .from('warehouse_bins')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidateWarehousePages(targetBin.warehouse_id)
  return { success: true }
}
