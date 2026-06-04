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
      origin:fleet_terminals!origin_terminal_id(id, name, location_name),
      destination:fleet_terminals!destination_terminal_id(id, name, location_name)
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
  }, { onConflict: 'org_id, origin_terminal_id, destination_terminal_id' })
  
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
