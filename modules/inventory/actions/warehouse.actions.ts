'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getWarehouses(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('org_id', orgId)
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
  const { data, error } = await supabase
    .from('warehouse_bins')
    .insert([{ ...payload, org_id: orgId }])
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/inventory')
  return { success: true, data }
}

export async function createWarehouse(orgId: string, payload: { name: string; code: string; is_active?: boolean }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('warehouses')
    .insert([{ ...payload, org_id: orgId }])
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/inventory/warehouses')
  return { success: true, data }
}

export async function deleteWarehouse(orgId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('warehouses')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/inventory/warehouses')
  return { success: true }
}

export async function deleteWarehouseBin(orgId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('warehouse_bins')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/inventory')
  return { success: true }
}
