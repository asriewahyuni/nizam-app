'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  Attendance,
  Employee,
  FleetAsset,
  FleetBooking,
  FleetMaintenanceLab,
  FleetRoute,
  FleetSchedule,
  FleetTerminal,
  FleetTicket,
} from '@/types/database.types'
import { revalidatePath } from 'next/cache'

type BookingStatus = 'RESERVED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
type FleetAssetStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'OUT_OF_SERVICE'
type ScheduleStatus = 'SCHEDULED' | 'DEPARTED' | 'ARRIVED' | 'CANCELLED'
type MaintenanceType = 'ROUTINE' | 'CORRECTIVE' | 'EMERGENCY'
type MaintenancePart = Record<string, string | number | boolean | null>
type CreateCrewPayload = {
  nik: string
  first_name: string
  last_name?: string
  job_title: string
  phone?: string
  join_date: string
  license_number?: string
  license_expiry?: string
  blood_type?: string
}

const BOOKING_STATUSES: BookingStatus[] = ['RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED']

type DbError = { message: string; code?: string }
type QueryResult<T> = PromiseLike<{ data: T[]; error: DbError | null }>
type QueryBuilder<T> = QueryResult<T> & {
  select(query?: string): QueryBuilder<T>
  insert(values: unknown): QueryBuilder<T>
  update(values: unknown): QueryBuilder<T>
  eq(column: string, value: unknown): QueryBuilder<T>
  not(column: string, operator: string, value: unknown): QueryBuilder<T>
  lt(column: string, value: unknown): QueryBuilder<T>
  gt(column: string, value: unknown): QueryBuilder<T>
  neq(column: string, value: unknown): QueryBuilder<T>
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>
  limit(count: number): QueryBuilder<T>
  or(filters: string): QueryBuilder<T>
  maybeSingle(): Promise<{ data: T | null; error: DbError | null }>
  single(): Promise<{ data: T; error: DbError | null }>
}
type FleetScheduleRecord = FleetSchedule & {
  route?: FleetRoute | null
  asset?: FleetAsset | null
  driver?: Pick<Employee, 'first_name' | 'last_name' | 'phone'> | null
  helper?: Pick<Employee, 'first_name' | 'last_name' | 'phone'> | null
  tickets?: { count: number }[] | { count: number } | null
}
type FleetMaintenanceRecord = FleetMaintenanceLab & {
  asset?: Pick<FleetAsset, 'id' | 'plate_number' | 'model'> | null
}
type AttendanceRecord = Attendance & {
  employee?: Pick<Employee, 'first_name' | 'last_name'> | null
}
type CreateFleetMedicalRecordArgs = {
  p_org_id: string
  p_asset_id: string
  p_service_date: string
  p_description: string
  p_maintenance_type: MaintenanceType
  p_cost: number
  p_odometer_at: number
  p_technician_name: string | null
  p_vendor_name: string | null
  p_parts_replaced: MaintenancePart[]
  p_next_service_km: number | null
  p_next_service_date: string | null
  p_attachment_url: string | null
}
type FleetDb = {
  from(table: 'fleet_assets'): QueryBuilder<FleetAsset>
  from(table: 'fleet_bookings'): QueryBuilder<FleetBooking>
  from(table: 'fleet_routes'): QueryBuilder<FleetRoute>
  from(table: 'fleet_schedules'): QueryBuilder<FleetScheduleRecord>
  from(table: 'fleet_tickets'): QueryBuilder<FleetTicket>
  from(table: 'fleet_maintenance_labs'): QueryBuilder<FleetMaintenanceRecord>
  from(table: 'employees'): QueryBuilder<Employee>
  from(table: 'attendance'): QueryBuilder<AttendanceRecord>
  from(table: 'fleet_terminals'): QueryBuilder<FleetTerminal>
  rpc(
    fn: 'create_fleet_medical_record',
    args: CreateFleetMedicalRecordArgs
  ): Promise<{ data: string | null; error: DbError | null }>
}

async function createFleetDb(): Promise<FleetDb> {
  return (await createClient()) as unknown as FleetDb
}

function parseNumber(value: FormDataEntryValue | string | number | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function normalizeDateOnly(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().split('T')[0]
}

function normalizeBookingRange(startDate: string, endDate: string) {
  const startIso = normalizeDateTime(startDate)
  const endIso = normalizeDateTime(endDate)

  if (!startIso || !endIso) {
    return { error: 'Tanggal booking tidak valid.' as const }
  }

  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    return { error: 'Tanggal selesai harus lebih besar dari tanggal mulai.' as const }
  }

  return { startIso, endIso }
}

async function hasOverlappingBooking(
  supabase: FleetDb,
  orgId: string,
  assetId: string,
  startDate: string,
  endDate: string,
  excludeBookingId?: string
) {
  let query = supabase
    .from('fleet_bookings')
    .select('id')
    .eq('org_id', orgId)
    .eq('asset_id', assetId)
    .not('status', 'eq', 'CANCELLED')
    .lt('start_date', endDate)
    .gt('end_date', startDate)

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId)
  }

  const { data, error } = await query.limit(1)

  if (error) return { error: error.message }
  return { hasOverlap: (data?.length || 0) > 0 }
}

async function syncAssetBookingStatus(
  supabase: FleetDb,
  orgId: string,
  assetId: string
) {
  const { data: asset, error: assetError } = await supabase
    .from('fleet_assets')
    .select('status')
    .eq('org_id', orgId)
    .eq('id', assetId)
    .maybeSingle()

  if (assetError) return assetError.message
  if (!asset) return 'Armada tidak ditemukan.'

  if (asset.status === 'MAINTENANCE' || asset.status === 'OUT_OF_SERVICE') {
    return null
  }

  const { data: activeBooking, error: activeBookingError } = await supabase
    .from('fleet_bookings')
    .select('id')
    .eq('org_id', orgId)
    .eq('asset_id', assetId)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle()

  if (activeBookingError && activeBookingError.code !== 'PGRST116') {
    return activeBookingError.message
  }

  const nextStatus: FleetAssetStatus = activeBooking ? 'RENTED' : 'AVAILABLE'

  if (asset.status !== nextStatus) {
    const { error: updateError } = await supabase
      .from('fleet_assets')
      .update({ status: nextStatus })
      .eq('org_id', orgId)
      .eq('id', assetId)

    if (updateError) return updateError.message
  }

  return null
}

/** ASSET MANAGEMENT **/

export async function getAssets(orgId: string) {
  const supabase = await createFleetDb()

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
  const supabase = await createFleetDb()

  const payload = {
    org_id: orgId,
    plate_number: formData.get('plate_number') as string,
    model: formData.get('model') as string,
    brand: formData.get('brand') as string,
    type: formData.get('type') as string,
    status: 'AVAILABLE',
    daily_rate: parseNumber(formData.get('daily_rate')),
    odometer: parseNumber(formData.get('odometer')),
    notes: formData.get('notes') as string
  }

  const { error } = await supabase.from('fleet_assets').insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/fleet')
  return { success: true }
}

/** BOOKING MANAGEMENT **/

export async function getBookings(orgId: string) {
  const supabase = await createFleetDb()

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
  const supabase = await createFleetDb()

  const asset_id = formData.get('asset_id') as string
  const contact_id = formData.get('contact_id') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const total_amount = parseNumber(formData.get('total_amount'))
  const deposit = parseNumber(formData.get('deposit'))

  if (!asset_id || !contact_id) {
    return { error: 'Armada dan pelanggan wajib dipilih.' }
  }

  const dateRange = normalizeBookingRange(start_date, end_date)
  if ('error' in dateRange) {
    return dateRange
  }

  const { data: asset, error: assetError } = await supabase
    .from('fleet_assets')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('id', asset_id)
    .maybeSingle()

  if (assetError) return { error: assetError.message }
  if (!asset) return { error: 'Armada tidak ditemukan.' }

  if (asset.status === 'MAINTENANCE' || asset.status === 'OUT_OF_SERVICE') {
    return { error: 'Armada sedang tidak tersedia untuk dibooking.' }
  }

  const overlapCheck = await hasOverlappingBooking(
    supabase,
    orgId,
    asset_id,
    dateRange.startIso,
    dateRange.endIso
  )

  if (overlapCheck.error) return { error: overlapCheck.error }
  if (overlapCheck.hasOverlap) {
    return { error: 'Armada sudah memiliki booking aktif di periode tersebut.' }
  }

  // 1. Create Booking
  const { data: booking, error: bookingErr } = await supabase
    .from('fleet_bookings')
    .insert({
      org_id: orgId,
      asset_id,
      contact_id,
      start_date: dateRange.startIso,
      end_date: dateRange.endIso,
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

export async function updateBookingStatus(orgId: string, bookingId: string, assetId: string, status: BookingStatus) {
  const supabase = await createFleetDb()

  if (!BOOKING_STATUSES.includes(status)) {
    return { error: 'Status booking tidak valid.' }
  }

  // Update Booking
  const { error: bookingErr } = await supabase
    .from('fleet_bookings')
    .update({ status })
    .eq('id', bookingId)
    .eq('org_id', orgId)

  if (bookingErr) return { error: bookingErr.message }

  if (status === 'ACTIVE') {
    const { error: assetErr } = await supabase
      .from('fleet_assets')
      .update({ status: 'RENTED' })
      .eq('org_id', orgId)
      .eq('id', assetId)

    if (assetErr) return { error: assetErr.message }
  } else {
    const syncError = await syncAssetBookingStatus(supabase, orgId, assetId)
    if (syncError) return { error: syncError }
  }

  revalidatePath('/fleet')
  return { success: true }
}

/** PO BUS MANAGEMENT **/

export async function getRoutes(orgId: string) {
  const supabase = await createFleetDb()
  const { data, error } = await supabase.from('fleet_routes').select('*').eq('org_id', orgId).order('name', { ascending: true })
  if (error) return []
  return data
}

export async function createRoute(orgId: string, formData: FormData) {
  const supabase = await createFleetDb()
  const payload = {
    org_id: orgId,
    name: formData.get('name') as string,
    origin: formData.get('origin') as string,
    destination: formData.get('destination') as string,
    distance_km: parseNumber(formData.get('distance_km')),
    base_price: parseNumber(formData.get('base_price'))
  }
  const { error } = await supabase.from('fleet_routes').insert(payload)
  if (error) return { error: error.message }
  revalidatePath('/fleet')
  return { success: true }
}

export async function getSchedules(orgId: string) {
  const supabase = await createFleetDb()
  const { data, error } = await supabase
    .from('fleet_schedules')
    .select(`
      *,
      route:fleet_routes(*),
      asset:fleet_assets(*),
      driver:employees!fleet_schedules_driver_id_fkey(first_name, last_name, phone),
      helper:employees!fleet_schedules_helper_id_fkey(first_name, last_name, phone),
      tickets:fleet_tickets(count)
    `)
    .eq('org_id', orgId)
    .order('departure_time', { ascending: true })
  
  if (error) return []
  return data
}

export async function createSchedule(orgId: string, formData: FormData) {
  const supabase = await createFleetDb()
  const departureTime = normalizeDateTime(formData.get('departure_time') as string)

  if (!departureTime) {
    return { error: 'Tanggal keberangkatan tidak valid.' }
  }

  const payload = {
    org_id: orgId,
    route_id: formData.get('route_id') as string,
    asset_id: formData.get('asset_id') as string,
    driver_id: formData.get('driver_id') as string || null,
    helper_id: formData.get('helper_id') as string || null,
    departure_time: departureTime,
    status: 'SCHEDULED' as ScheduleStatus
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
  const supabase = await createFleetDb()
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
  const supabase = await createFleetDb()

  const { data, error } = await supabase
    .from('fleet_maintenance_labs')
    .select('*')
    .eq('asset_id', assetId)
    .order('service_date', { ascending: false })

  if (error) return []
  return data
}

export async function getAllMedicalRecords(orgId: string) {
  const supabase = await createFleetDb()

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
  const supabase = await createFleetDb()
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('org_id', orgId)
    .or('job_title.ilike.%sopir%,job_title.ilike.%driver%,job_title.ilike.%kernet%,job_title.ilike.%helper%')
    .order('first_name', { ascending: true })

  if (error) return []
  return data
}

export async function createCrew(orgId: string, payload: CreateCrewPayload) {
  const supabase = await createFleetDb()
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
  maintenance_type: MaintenanceType,
  cost: number,
  odometer_at: number,
  technician_name?: string,
  vendor_name?: string,
  parts_replaced?: MaintenancePart[],
  next_service_km?: number,
  next_service_date?: string,
  attachment_url?: string
}) {
  const supabase = await createFleetDb()

  if (!payload.asset_id || !payload.description.trim()) {
    return { error: 'Armada dan deskripsi servis wajib diisi.' }
  }

  const serviceDate = normalizeDateOnly(payload.service_date)
  if (!serviceDate) {
    return { error: 'Tanggal servis tidak valid.' }
  }

  const nextServiceDate = payload.next_service_date
    ? normalizeDateOnly(payload.next_service_date)
    : null

  if (payload.next_service_date && !nextServiceDate) {
    return { error: 'Tanggal next service tidak valid.' }
  }

  const { data, error } = await supabase.rpc('create_fleet_medical_record', {
    p_org_id: orgId,
    p_asset_id: payload.asset_id,
    p_service_date: serviceDate,
    p_description: payload.description.trim(),
    p_maintenance_type: payload.maintenance_type,
    p_cost: parseNumber(payload.cost),
    p_odometer_at: parseNumber(payload.odometer_at),
    p_technician_name: payload.technician_name || null,
    p_vendor_name: payload.vendor_name || null,
    p_parts_replaced: payload.parts_replaced || [],
    p_next_service_km: payload.next_service_km ?? null,
    p_next_service_date: nextServiceDate,
    p_attachment_url: payload.attachment_url || null
  })

  if (!error && data) {
    revalidatePath('/fleet')
    return { success: true }
  }

  if (error && error.code !== 'PGRST202') {
    return { error: error.message }
  }

  const { data: asset, error: assetError } = await supabase
    .from('fleet_assets')
    .select('status')
    .eq('org_id', orgId)
    .eq('id', payload.asset_id)
    .maybeSingle()

  if (assetError) return { error: assetError.message }
  if (!asset) return { error: 'Armada tidak ditemukan.' }

  const { error: assetUpdateError } = await supabase
    .from('fleet_assets')
    .update({ status: 'MAINTENANCE' })
    .eq('org_id', orgId)
    .eq('id', payload.asset_id)

  if (assetUpdateError) return { error: assetUpdateError.message }

  const { error: insertError } = await supabase
    .from('fleet_maintenance_labs')
    .insert({
      org_id: orgId,
      asset_id: payload.asset_id,
      service_date: serviceDate,
      description: payload.description.trim(),
      maintenance_type: payload.maintenance_type,
      cost: parseNumber(payload.cost),
      odometer_at: parseNumber(payload.odometer_at),
      technician_name: payload.technician_name || null,
      vendor_name: payload.vendor_name || null,
      parts_replaced: payload.parts_replaced || [],
      next_service_km: payload.next_service_km ?? null,
      next_service_date: nextServiceDate,
      attachment_url: payload.attachment_url || null
    })

  if (insertError) {
    await supabase
      .from('fleet_assets')
      .update({ status: asset.status })
      .eq('org_id', orgId)
      .eq('id', payload.asset_id)

    return { error: insertError.message }
  }

  revalidatePath('/fleet')
  return { success: true }
}

/** AVAILABILITY ENGINE **/

export async function checkAssetAvailability(assetId: string, startDate: string, endDate: string) {
  const supabase = await createFleetDb()
  const dateRange = normalizeBookingRange(startDate, endDate)

  if ('error' in dateRange) {
    return { available: false, error: dateRange.error }
  }

  // Find overlapping bookings
  const { data, error } = await supabase
    .from('fleet_bookings')
    .select('id')
    .eq('asset_id', assetId)
    .not('status', 'eq', 'CANCELLED')
    .lt('start_date', dateRange.endIso)
    .gt('end_date', dateRange.startIso)

  if (error) return { available: false, error: error.message }


  return { available: (data?.length || 0) === 0 }
}

/** SMART ATTENDANCE (GPS + QR) **/

export async function getTerminals(orgId: string) {
  const supabase = await createFleetDb()
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
  const supabase = await createFleetDb()
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
