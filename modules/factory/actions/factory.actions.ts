'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getBoms(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('production_boms')
    .select(`
      *,
      product:products(id, name, sku, average_cost, purchase_price, unit),
      items:production_bom_items(
        id,
        quantity,
        unit,
        product:products(id, name, sku, average_cost, purchase_price, unit)
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching BoM:', error)
    return []
  }

  return data
}

export async function getBomItems(bomId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('production_bom_items')
    .select(`
      *,
      product:products(id, name, code)
    `)
    .eq('bom_id', bomId)

  if (error) {
    console.error('Error fetching BoM items:', error)
    return []
  }

  return data
}

export async function createBom(orgId: string, payload: { productId: string; code: string; description: string; items: Array<{ productId: string; quantity: number; unit?: string }> }) {
  const supabase = await createClient()

  // Start Transaction (via manual check or RPC)
  // For simplicity using sequential inserts (but in real production we use RPC)
  const { data: bom, error: bomError } = await supabase
    .from('production_boms')
    .insert({
      org_id: orgId,
      product_id: payload.productId,
      code: payload.code,
      description: payload.description
    })
    .select()
    .single()

  if (bomError) return { error: bomError.message }

  const bomItems = payload.items.map(item => ({
    bom_id: bom.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit: item.unit
  }))

  const { error: itemsError } = await supabase
    .from('production_bom_items')
    .insert(bomItems)

  if (itemsError) return { error: itemsError.message }

  revalidatePath('/factory')
  return { success: true }
}

export async function updateBom(orgId: string, bomId: string, payload: { productId: string; code: string; description: string; items: Array<{ productId: string; quantity: number; unit?: string }> }) {
  const supabase = await createClient()

  // 1. Update BoM Header
  const { error: bomError } = await supabase
    .from('production_boms')
    .update({
      product_id: payload.productId,
      code: payload.code,
      description: payload.description,
      updated_at: new Date().toISOString()
    })
    .eq('id', bomId)
    .eq('org_id', orgId)

  if (bomError) return { error: bomError.message }

  // 2. Refresh Items: Delete and Re-insert
  const { error: deleteError } = await supabase
    .from('production_bom_items')
    .delete()
    .eq('bom_id', bomId)

  if (deleteError) return { error: deleteError.message }

  const bomItems = payload.items.map(item => ({
    bom_id: bomId,
    product_id: item.productId,
    quantity: item.quantity,
    unit: item.unit
  }))

  const { error: itemsError } = await supabase
    .from('production_bom_items')
    .insert(bomItems)

  if (itemsError) return { error: itemsError.message }

  revalidatePath('/factory')
  return { success: true }
}


export async function getWorkOrders(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('production_work_orders')
    .select(`
      *,
      bom:production_boms(
        id, code,
        product:products(id, name, sku),
        items:production_bom_items(
          quantity,
          product:products(name, average_cost, purchase_price)
        )
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching Work Orders:', error)
    return []
  }

  return data
}

export async function createWorkOrder(orgId: string, formData: FormData) {
  const supabase = await createClient()

  const bom_id = formData.get('bom_id') as string
  const wo_number = formData.get('wo_number') as string
  const quantity_planned = Number(formData.get('quantity_planned'))
  const notes = formData.get('notes') as string

  const { error } = await supabase
    .from('production_work_orders')
    .insert({
      org_id: orgId,
      bom_id,
      wo_number,
      quantity_planned,
      status: 'DRAFT',
      notes
    })

  if (error) return { error: error.message }

  revalidatePath('/factory')
  return { success: true, message: 'Work Order created successfully' }
}

export async function getWorkOrderCosts(woId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('production_wo_costs')
    .select('*')
    .eq('wo_id', woId)
    .order('created_at', { ascending: true })

  if (error) return []
  return data
}

export async function addWorkOrderCost(orgId: string, woId: string, payload: { description: string; amount: number; cost_type: string }) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('production_wo_costs')
    .insert([{ ...payload, wo_id: woId }])

  if (error) return { error: error.message }
  revalidatePath('/factory')
  return { success: true }
}

export async function getFGBins(orgId: string, warehouseId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('warehouse_bins')
    .select('id, code')
    .eq('org_id', orgId)
    .eq('warehouse_id', warehouseId)
  
  if (error) return []
  return data
}

export async function updateWorkOrderStatus(orgId: string, woId: string, status: string, options?: { warehouseId?: string; binId?: string }) {
  const supabase = await createClient()

  if (status === 'COMPLETED') {
    const { data: userData } = await supabase.auth.getUser()
    
    // Use V2 (with overhead support)
    const { data, error } = await supabase.rpc('process_work_order_completion_v2', {
      p_wo_id: woId,
      p_user_id: userData.user?.id,
      p_warehouse_id: options?.warehouseId,
      p_bin_id: options?.binId
    })

    if (error) {
      // Fallback to V1 if RPC V2 is not found/active
      console.warn('RPC V2 not found, falling back to V1')
      const { data: v1Data, error: v1Err } = await supabase.rpc('process_work_order_completion', {
        p_wo_id: woId,
        p_user_id: userData.user?.id
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

  const { error } = await supabase
    .from('production_work_orders')
    .update(payload)
    .eq('id', woId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/factory')
  return { success: true }
}

export async function deleteBom(orgId: string, bomId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('production_boms')
    .delete()
    .eq('id', bomId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/factory')
  return { success: true }
}

export async function deleteWorkOrder(orgId: string, woId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('production_work_orders')
    .delete()
    .eq('id', woId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/factory')
  return { success: true }
}
