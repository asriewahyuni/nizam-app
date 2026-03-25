'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** ASSET MANAGEMENT **/

export async function getAssets(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('fleet_assets')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching Fleet Assets:', error)
    return []
  }

  return data
}

export async function createAsset(orgId: string, formData: FormData) {
  const supabase = await createClient()

  const payload = {
    org_id: orgId,
    plate_number: formData.get('plate_number') as string,
    model: formData.get('model') as string,
    brand: formData.get('brand') as string,
    type: formData.get('type') as string,
    status: 'AVAILABLE',
    daily_rate: Number(formData.get('daily_rate')),
    odometer: Number(formData.get('odometer')),
    notes: formData.get('notes') as string
  }

  const { error } = await supabase.from('fleet_assets').insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/fleet')
  return { success: true }
}

/** BOOKING MANAGEMENT **/

export async function getBookings(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('fleet_bookings')
    .select(`
      *,
      asset:fleet_assets(id, plate_number, model),
      contact:contacts(id, name)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching Bookings:', error)
    return []
  }

  return data
}

export async function createBooking(orgId: string, formData: FormData) {
  const supabase = await createClient()

  const asset_id = formData.get('asset_id') as string
  const contact_id = formData.get('contact_id') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const total_amount = Number(formData.get('total_amount'))
  const deposit = Number(formData.get('deposit'))

  // 1. Create Booking
  const { data: booking, error: bookingErr } = await supabase
    .from('fleet_bookings')
    .insert({
      org_id: orgId,
      asset_id,
      contact_id,
      start_date: new Date(start_date).toISOString(),
      end_date: new Date(end_date).toISOString(),
      total_amount,
      deposit,
      status: 'RESERVED'
    })
    .select()
    .single()

  if (bookingErr) return { error: bookingErr.message }

  // 2. Ideally, we would also mark the asset as RENTED if status is ACTIVE
  // but for reservation, we keep it as AVAILABLE until check-out.

  revalidatePath('/fleet')
  return { success: true, bookingId: booking.id }
}

export async function updateBookingStatus(orgId: string, bookingId: string, assetId: string, status: string) {
  const supabase = await createClient()

  // Update Booking
  const { error: bookingErr } = await supabase
    .from('fleet_bookings')
    .update({ status })
    .eq('id', bookingId)
    .eq('org_id', orgId)

  if (bookingErr) return { error: bookingErr.message }

  // Logic: If status becomes ACTIVE, asset becomes RENTED. If COMPLETED, asset becomes AVAILABLE.
  let assetStatus = 'AVAILABLE'
  if (status === 'ACTIVE') assetStatus = 'RENTED'
  else if (status === 'RESERVED') assetStatus = 'AVAILABLE' // Reserved doesn't block asset physically yet? Usually does.
  
  const { error: assetErr } = await supabase
    .from('fleet_assets')
    .update({ status: assetStatus })
    .eq('id', assetId)

  if (assetErr) return { error: assetErr.message }

  revalidatePath('/fleet')
  return { success: true }
}

/** PO BUS MANAGEMENT **/

export async function getRoutes(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('fleet_routes').select('*').eq('org_id', orgId).order('name', { ascending: true })
  if (error) return []
  return (data as any)
}

export async function createRoute(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const payload = {
    org_id: orgId,
    name: formData.get('name') as string,
    origin: formData.get('origin') as string,
    destination: formData.get('destination') as string,
    distance_km: Number(formData.get('distance_km')),
    base_price: Number(formData.get('base_price'))
  }
  const { error } = await supabase.from('fleet_routes').insert(payload)
  if (error) return { error: error.message }
  revalidatePath('/fleet')
  return { success: true }
}

export async function getSchedules(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fleet_schedules')
    .select(`
      *,
      route:fleet_routes(id, name),
      asset:fleet_assets(id, plate_number, model, capacity),
      driver:contacts(id, name)
    ` as any)
    .eq('org_id', orgId)
    .order('departure_time', { ascending: true })
  
  if (error) return []
  return (data as any)
}

export async function createSchedule(orgId: string, formData: FormData) {
  const supabase = await createClient()
  const payload = {
    org_id: orgId,
    route_id: formData.get('route_id') as string,
    asset_id: formData.get('asset_id') as string,
    driver_id: formData.get('driver_id') as string || null,
    departure_time: new Date(formData.get('departure_time') as string).toISOString(),
    status: 'SCHEDULED'
  }
  const { error } = await supabase.from('fleet_schedules').insert(payload)
  if (error) return { error: error.message }
  revalidatePath('/fleet')
  return { success: true }
}

export async function createTicket(orgId: string, payload: {
  schedule_id: string,
  passenger_id: string,
  seat_number: string,
  price: number,
  notes?: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('fleet_tickets').insert({
    org_id: orgId,
    ...payload,
    status: 'PAID'
  })
  if (error) return { error: error.message }

  revalidatePath('/fleet')
  return { success: true }
}
