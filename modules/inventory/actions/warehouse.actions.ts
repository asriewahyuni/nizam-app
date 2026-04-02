'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

function revalidateWarehousePages() {
  revalidatePath('/inventory')
  revalidatePath('/inventory/warehouses')
  revalidatePath('/factory')
}

export async function getWarehouses(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await (supabase as any)
    .from('warehouses')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return []
  return data
}

export async function getWarehouseBins(orgId: string, warehouseId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('warehouse_bins')
    .select('*, warehouses(name)')
    .eq('org_id', orgId)
  
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }

  const { data, error } = await query.order('warehouse_id', { ascending: true })
  if (error) return []
  return data
}

export async function createWarehouseBin(orgId: string, payload: { warehouse_id: string; code: string; description?: string }) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('warehouse_bins')
    .insert([{ ...payload, org_id: orgId }])
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/inventory')
  return { success: true, data }
}

export async function createWarehouse(orgId: string, payload: WarehousePayload): Promise<WarehouseMutationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const normalized = normalizeWarehousePayload(payload)
  if ('error' in normalized) return normalized

  const { data, error } = await (supabase as any)
    .from('warehouses')
    .insert([{ ...normalized, org_id: orgId }])
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateWarehousePages()
  return { success: true, data }
}

export async function updateWarehouse(orgId: string, id: string, payload: WarehousePayload): Promise<WarehouseMutationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const normalized = normalizeWarehousePayload(payload)
  if ('error' in normalized) return normalized

  const { data, error } = await (supabase as any)
    .from('warehouses')
    .update({
      ...normalized,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('is_active', true)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateWarehousePages()
  return { success: true, data }
}

export async function deleteWarehouse(orgId: string, id: string): Promise<DeleteWarehouseResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

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
  revalidateWarehousePages()
  return { success: true }
}

export async function deleteWarehouseBin(orgId: string, id: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('warehouse_bins')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/inventory')
  return { success: true }
}
