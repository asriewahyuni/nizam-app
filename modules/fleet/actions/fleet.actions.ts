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
      route:fleet_routes(*),
      asset:fleet_assets(*),
      driver:employees(first_name, last_name, phone),
      helper:employees(first_name, last_name, phone),
      tickets:fleet_tickets(count)
    `)
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
    helper_id: formData.get('helper_id') as string || null,
    departure_time: new Date(formData.get('departure_time') as string).toISOString(),
    status: 'WAITING'
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

/** 
 * VEHICLE MEDICAL RECORD (MAINTENANCE) 
 * "Rekam Medis Bus"
 **/

export async function getMedicalRecords(assetId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('fleet_maintenance_labs')
    .select('*')
    .eq('asset_id', assetId)
    .order('service_date', { ascending: false })

  if (error) return []
  return data
}

export async function getAllMedicalRecords(orgId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('fleet_maintenance_labs')
    .select(`
      *,
      asset:fleet_assets(id, plate_number, model)
    `)
    .eq('org_id', orgId)
    .order('service_date', { ascending: false })

  if (error) {
    console.error('Error fetching all medical records:', error)
    return []
  }
  return data
}

export async function getFleetCrew(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('org_id', orgId)
    .or('job_title.ilike.%sopir%,job_title.ilike.%driver%,job_title.ilike.%kernet%,job_title.ilike.%helper%')
    .order('first_name', { ascending: true })

  if (error) return []
  return data
}

export async function createCrew(orgId: string, payload: any) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .insert([{ ...payload, org_id: orgId }])
    .select()
    .single()

  return { data, error: error?.message }
}

export async function createMedicalRecord(orgId: string, payload: {
  asset_id: string,
  service_date: string,
  description: string,
  maintenance_type: 'ROUTINE' | 'CORRECTIVE' | 'EMERGENCY',
  cost: number,
  odometer_at: number,
  technician_name?: string,
  vendor_name?: string,
  parts_replaced?: any[],
  next_service_km?: number,
  next_service_date?: string,
  attachment_url?: string
}) {
  const supabase = await createClient()

  // 1. Mark asset as MAINTENANCE
  await supabase.from('fleet_assets').update({ status: 'MAINTENANCE' }).eq('id', payload.asset_id)

  // 2. Insert record
  const { error } = await supabase
    .from('fleet_maintenance_labs')
    .insert({
      org_id: orgId,
      ...payload,
      parts_replaced: JSON.stringify(payload.parts_replaced || [])
    })

  if (error) return { error: error.message }

  revalidatePath('/fleet')
  return { success: true }
}

/** AVAILABILITY ENGINE **/

export async function checkAssetAvailability(assetId: string, startDate: string, endDate: string) {
  const supabase = await createClient()

  // Find overlapping bookings
  const { data, error } = await supabase
    .from('fleet_bookings')
    .select('id')
    .eq('asset_id', assetId)
    .not('status', 'eq', 'CANCELLED')
    .filter('start_date', 'lt', endDate)
    .filter('end_date', 'gt', startDate)

  if (error) return { available: false, error: error.message }


  return { available: data.length === 0 }
}

/** SMART ATTENDANCE (GPS + QR) **/

export async function getTerminals(orgId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fleet_terminals')
    .select('*')
    .eq('org_id', orgId)
    .order('name', { ascending: true })
  
  if (error) return []
  return data
}

export async function recordCrewAttendance(orgId: string, payload: {
  employee_id: string,
  location_gps?: string,
  qr_scanned_payload?: string,
  type: 'IN' | 'OUT',
  notes?: string
}) {
  const supabase = await createClient()
  const date = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  // Find if already exists for today
  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', payload.employee_id)
    .eq('record_date', date)
    .single()

  if (payload.type === 'IN') {
    if (existing) return { error: 'Anda sudah Clock-In hari ini.' }
    
    const { error } = await supabase.from('attendance').insert([{
      org_id: orgId,
      employee_id: payload.employee_id,
      record_date: date,
      check_in: now,
      status: 'PRESENT',
      location_gps: payload.location_gps,
      qr_scanned_payload: payload.qr_scanned_payload,
      notes: payload.notes
    }])
    if (error) return { error: error.message }
  } else {
    if (!existing) return { error: 'Belum ada data Clock-In hari ini.' }
    if (existing.check_out) return { error: 'Anda sudah Clock-Out hari ini.' }

    const { error } = await supabase
      .from('attendance')
      .update({
        check_out: now,
        notes: payload.notes ? (existing.notes ? existing.notes + ' | ' + payload.notes : payload.notes) : existing.notes
      })
      .eq('id', existing.id)
    
    if (error) return { error: error.message }
  }

  revalidatePath('/fleet')
  return { success: true }
}
