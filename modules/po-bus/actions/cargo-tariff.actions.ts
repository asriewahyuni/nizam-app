'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function getSupabase() {
  return createClient()
}

export async function getCargoTariffs(orgId: string) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('fleet_cargo_tariffs')
    .select(`
      *,
      origin_pool:bus_pools!origin_pool_id(id, name, city),
      destination_pool:bus_pools!destination_pool_id(id, name, city)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    
  if (error) return []
  return data
}

export async function upsertCargoTariff(orgId: string, payload: any) {
  const supabase = await getSupabase()
  
  const { error } = await supabase.from('fleet_cargo_tariffs').upsert({
    ...payload,
    org_id: orgId,
    updated_at: new Date().toISOString()
  }, { onConflict: 'org_id, origin_pool_id, destination_pool_id' })
  
  if (error) return { error: error.message }
  
  revalidatePath('/fleet/cargo')
  return { success: true }
}

export async function deleteCargoTariff(orgId: string, tariffId: string) {
  const supabase = await getSupabase()
  
  const { error } = await supabase
    .from('fleet_cargo_tariffs')
    .delete()
    .eq('id', tariffId)
    .eq('org_id', orgId)
    
  if (error) return { error: error.message }
  
  revalidatePath('/fleet/cargo')
  return { success: true }
}
