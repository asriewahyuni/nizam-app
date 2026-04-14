'use server'

import { createClient } from '@/lib/supabase/server'
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

function applyWarehouseBranchFilter(query: any, branchId: string | null) {
  if (!branchId) return query
  return query.eq('branch_id', branchId)
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
  const { queryPostgres } = await import('@/lib/db/postgres')

  let sql = `
    SELECT wb.id, wb.warehouse_id, w.branch_id as warehouse_branch_id
    FROM public.warehouse_bins wb
    JOIN public.warehouses w ON w.id = wb.warehouse_id
    WHERE wb.id = $1 AND wb.org_id = $2
  `
  const params: unknown[] = [binId, orgId]

  if (branchId) {
    params.push(branchId)
    sql += ` AND (w.branch_id = $${params.length} OR w.branch_id IS NULL)`
  }

  try {
    const { rows } = await queryPostgres<any>(sql, params)
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id,
      warehouse_id: r.warehouse_id,
      warehouses: { branch_id: r.warehouse_branch_id }
    } as any
  } catch {
    return null
  }
}

export async function getWarehouses(orgId: string, branchId?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

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
  const branchSelection = await resolveActiveBranchId(orgId, branchId)
  if ('error' in branchSelection) return []
  const effectiveBranchId = branchSelection.branchId

  const { queryPostgres } = await import('@/lib/db/postgres')

  let sql = `
    SELECT wb.*, 
           w.name as warehouse_name, 
           w.code as warehouse_code, 
           w.branch_id as warehouse_branch_id
    FROM public.warehouse_bins wb
    JOIN public.warehouses w ON w.id = wb.warehouse_id
    WHERE wb.org_id = $1
  `
  const params: unknown[] = [orgId]

  if (warehouseId) {
    params.push(warehouseId)
    sql += ` AND wb.warehouse_id = $${params.length}`
  }

  if (effectiveBranchId) {
    params.push(effectiveBranchId)
    sql += ` AND (w.branch_id = $${params.length} OR w.branch_id IS NULL)`
  }

  sql += ` ORDER BY wb.warehouse_id ASC`

  try {
    const { rows } = await queryPostgres<Record<string, unknown>>(sql, params)
    return rows.map((r: any) => ({
      ...r,
      warehouses: {
        name: r.warehouse_name,
        code: r.warehouse_code,
        branch_id: r.warehouse_branch_id
      }
    }))
  } catch(err) {
    console.error(err)
    return []
  }
}

export async function createWarehouseBin(orgId: string, payload: { warehouse_id: string; code: string; description?: string }) {
  const supabase = await createClient()
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola bin gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
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
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId

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
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
  const targetWarehouse = await getAccessibleWarehouse(supabase as any, orgId, id, activeBranchId)

  if (!targetWarehouse) {
    return { error: 'Gudang tidak tersedia pada unit aktif.' }
  }

  const { data, error } = await (supabase as any)
    .from('warehouses')
    .update({
      ...normalized,
      branch_id: activeBranchId,
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
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
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
  const activeBranchResult = await requireActiveBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk mengelola bin gudang.'
  )
  if ('error' in activeBranchResult) return { error: activeBranchResult.error }
  const activeBranchId = activeBranchResult.branchId
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
