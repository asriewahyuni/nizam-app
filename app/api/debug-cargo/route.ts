import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const orgIdBob = '6daf5e57-118c-4414-a0bc-35c5e346876f' // Bob
    const supabase = await createClient()
    
    // 1. Basic query
    const res1 = await supabase.from('fleet_cargo_shipments').select('*').eq('org_id', orgIdBob)
    
    // 2. Query with relations
    const res2 = await supabase
      .from('fleet_cargo_shipments')
      .select(`
        *,
        origin:fleet_terminals!origin_terminal_id(id, name, location_name)
      `)
      .eq('org_id', orgIdBob)
      
    // 3. Query with all relations (the one in cargo.actions.ts)
    const res3 = await supabase
      .from('fleet_cargo_shipments')
      .select(`
        *,
        origin:fleet_terminals!origin_terminal_id(id, name, location_name),
        destination:fleet_terminals!destination_terminal_id(id, name, location_name),
        schedule:fleet_schedules(id, departure_time, route_id)
      `)
      .eq('org_id', orgIdBob)
      
    return NextResponse.json({ 
      basic: { dataLength: res1.data?.length, error: res1.error },
      withOrigin: { dataLength: res2.data?.length, error: res2.error },
      full: { dataLength: res3.data?.length, error: res3.error }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack })
  }
}
