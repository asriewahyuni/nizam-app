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
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'

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

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

type AssetBranchRecord = Pick<FleetAsset, 'id' | 'status' | 'branch_id'> | null
type RouteBranchRecord = Pick<FleetRoute, 'id' | 'branch_id'> | null
type ScheduleBranchRecord = Pick<FleetSchedule, 'id' | 'branch_id' | 'asset_id'> | null
type BookingBranchRecord = Pick<FleetBooking, 'id' | 'branch_id' | 'asset_id' | 'status'> | null
type CrewBranchRecord = Pick<Employee, 'id' | 'branch_id'> | null

async function resolveFleetBranchSelection(orgId: string, branchId?: string | null): Promise<BranchSelectionResult> {
  const branchSelection = await resolveAccessibleBranchSelection(orgId, branchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error || 'Akses unit tidak valid.' }
  }

  return { branchId: branchSelection.branchId }
}

async function requireFleetCreateBranchId(orgId: string, errorMessage: string): Promise<{ branchId: string } | { error: string }> {
  const branchSelection = await resolveFleetBranchSelection(orgId)
  if ('error' in branchSelection || !branchSelection.branchId) {
    return { error: errorMessage }
  }

  return { branchId: branchSelection.branchId as string }
}

async function ensureFleetBranchAccess(orgId: string, branchId: string | null, notFoundMessage: string) {
  const trimmedBranchId = String(branchId || '').trim()
  if (!trimmedBranchId) {
    return { error: notFoundMessage }
  }

  const branchSelection = await resolveFleetBranchSelection(orgId, trimmedBranchId)
  if ('error' in branchSelection) {
    return { error: branchSelection.error }
  }

  return { branchId: trimmedBranchId }
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

export async function getAssets(orgId: string, branchId?: string | null) {
  const supabase = await createFleetDb()
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = supabase
    .from('fleet_assets')
    .select('*')
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching Fleet Assets:', error)
    return []
  }

  return data
}

export async function createAsset(orgId: string, formData: FormData) {
  const supabase = await createFleetDb()
  const activeBranch = await requireFleetCreateBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menambahkan armada.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }

  const payload = {
    org_id: orgId,
    branch_id: activeBranch.branchId,
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

export async function getBookings(orgId: string, branchId?: string | null) {
  const supabase = await createFleetDb()
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = supabase
    .from('fleet_bookings')
    .select(`
      *,
      asset:fleet_assets(id, plate_number, model),
      contact:contacts(id, name)
    `)
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

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
    return { error: dateRange.error }
  }

  const { data: asset, error: assetError } = await supabase
    .from('fleet_assets')
    .select('id, status, branch_id')
    .eq('org_id', orgId)
    .eq('id', asset_id)
    .maybeSingle() as { data: AssetBranchRecord; error: DbError | null }

  if (assetError) return { error: assetError.message }
  if (!asset) return { error: 'Armada tidak ditemukan.' }
  const branchAccess = await ensureFleetBranchAccess(orgId, asset.branch_id, 'Armada tidak ditemukan.')
  if ('error' in branchAccess) return { error: branchAccess.error }

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
      branch_id: branchAccess.branchId,
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

  const { data: booking, error: bookingFetchError } = await supabase
    .from('fleet_bookings')
    .select('id, branch_id, asset_id, status')
    .eq('id', bookingId)
    .eq('org_id', orgId)
    .maybeSingle() as { data: BookingBranchRecord; error: DbError | null }

  if (bookingFetchError) return { error: bookingFetchError.message }
  if (!booking) return { error: 'Booking tidak ditemukan.' }

  const branchAccess = await ensureFleetBranchAccess(orgId, booking.branch_id, 'Booking tidak ditemukan.')
  if ('error' in branchAccess) return { error: branchAccess.error }
  const effectiveAssetId = booking.asset_id || assetId

  // Update Booking
  const { error: bookingErr } = await supabase
    .from('fleet_bookings')
    .update({ status })
    .eq('id', bookingId)
    .eq('org_id', orgId)
    .eq('branch_id', branchAccess.branchId)

  if (bookingErr) return { error: bookingErr.message }

  if (status === 'ACTIVE') {
    const { error: assetErr } = await supabase
      .from('fleet_assets')
      .update({ status: 'RENTED' })
      .eq('org_id', orgId)
      .eq('branch_id', branchAccess.branchId)
      .eq('id', effectiveAssetId)

    if (assetErr) return { error: assetErr.message }
  } else {
    const syncError = await syncAssetBookingStatus(supabase, orgId, effectiveAssetId)
    if (syncError) return { error: syncError }
  }

  revalidatePath('/fleet')
  return { success: true }
}

/** PO BUS MANAGEMENT **/

export async function getRoutes(orgId: string, branchId?: string | null) {
  const supabase = await createFleetDb()
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = supabase.from('fleet_routes').select('*').eq('org_id', orgId)
  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('name', { ascending: true })
  if (error) return []
  return data
}

export async function createRoute(orgId: string, formData: FormData) {
  const supabase = await createFleetDb()
  const activeBranch = await requireFleetCreateBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat rute.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }
  const payload = {
    org_id: orgId,
    branch_id: activeBranch.branchId,
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

export async function getSchedules(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  const { queryPostgres } = await import('@/lib/db/postgres')

  const baseParams: unknown[] = [orgId]
  const branchFilter = branchSelection.branchId ? ` AND s.branch_id = $${baseParams.push(branchSelection.branchId)}` : ''

  let scheduleRows: any[] = []
  try {
    const result = await queryPostgres<Record<string, unknown>>(`
      SELECT
        s.*,
        r.id AS route_id_val, r.name AS route_name, r.origin, r.destination,
        r.distance_km, r.base_price, r.branch_id AS route_branch_id,
        fa.id AS asset_id_val, fa.plate_number, fa.model, fa.brand,
        fa.type AS asset_type, fa.status AS asset_status, fa.capacity,
        fa.daily_rate, fa.odometer,
        d.first_name AS driver_first_name, d.last_name AS driver_last_name, d.phone AS driver_phone,
        h.first_name AS helper_first_name, h.last_name AS helper_last_name, h.phone AS helper_phone
      FROM   public.fleet_schedules s
      LEFT JOIN public.fleet_routes   r  ON r.id  = s.route_id
      LEFT JOIN public.fleet_assets   fa ON fa.id = s.asset_id
      LEFT JOIN public.employees      d  ON d.id  = s.driver_id
      LEFT JOIN public.employees      h  ON h.id  = s.helper_id
      WHERE  s.org_id = $1${branchFilter}
      ORDER  BY s.departure_time ASC
    `, baseParams)
    scheduleRows = result.rows
  } catch (err) {
    ;(console as any).error('[getSchedules] raw SQL error:', err)
    return []
  }

  if (scheduleRows.length === 0) return []

  // Fetch ticket counts per schedule
  const scheduleIds = scheduleRows.map((r) => r.id)
  const ticketCountByScheduleId: Record<string, number> = {}
  try {
    const ticketResult = await queryPostgres<{ schedule_id: string; count: string }>(`
      SELECT schedule_id, COUNT(*) AS count
      FROM   public.fleet_tickets
      WHERE  schedule_id = ANY($1::uuid[])
      GROUP  BY schedule_id
    `, [scheduleIds])
    for (const row of ticketResult.rows) {
      ticketCountByScheduleId[String(row.schedule_id)] = Number(row.count || 0)
    }
  } catch { /* optional — ignore */ }

  return scheduleRows.map((row) => {
    const sid = String(row.id ?? '')
    return {
      ...row,
      route: row.route_name ? {
        id: row.route_id_val, name: row.route_name, origin: row.origin,
        destination: row.destination, distance_km: row.distance_km,
        base_price: row.base_price, branch_id: row.route_branch_id,
      } : null,
      asset: row.asset_id_val ? {
        id: row.asset_id_val, plate_number: row.plate_number, model: row.model,
        brand: row.brand, type: row.asset_type, status: row.asset_status,
        capacity: row.capacity, daily_rate: row.daily_rate, odometer: row.odometer,
      } : null,
      driver: row.driver_first_name ? {
        first_name: row.driver_first_name, last_name: row.driver_last_name, phone: row.driver_phone,
      } : null,
      helper: row.helper_first_name ? {
        first_name: row.helper_first_name, last_name: row.helper_last_name, phone: row.helper_phone,
      } : null,
      tickets: { count: ticketCountByScheduleId[sid] ?? 0 },
    }
  })
}


export async function createSchedule(orgId: string, formData: FormData) {
  const supabase = await createFleetDb()
  const departureTime = normalizeDateTime(formData.get('departure_time') as string)

  if (!departureTime) {
    return { error: 'Tanggal keberangkatan tidak valid.' }
  }

  const assetId = formData.get('asset_id') as string
  const routeId = formData.get('route_id') as string
  const { data: asset, error: assetError } = await supabase
    .from('fleet_assets')
    .select('id, branch_id')
    .eq('org_id', orgId)
    .eq('id', assetId)
    .maybeSingle() as { data: AssetBranchRecord; error: DbError | null }

  if (assetError) return { error: assetError.message }
  if (!asset?.branch_id) return { error: 'Armada tidak ditemukan.' }

  const { data: route, error: routeError } = await supabase
    .from('fleet_routes')
    .select('id, branch_id')
    .eq('org_id', orgId)
    .eq('id', routeId)
    .maybeSingle() as { data: RouteBranchRecord; error: DbError | null }

  if (routeError) return { error: routeError.message }
  if (!route?.branch_id) return { error: 'Rute tidak ditemukan.' }
  if (route.branch_id !== asset.branch_id) {
    return { error: 'Rute dan armada harus berasal dari unit yang sama.' }
  }

  const branchAccess = await ensureFleetBranchAccess(orgId, asset.branch_id, 'Unit armada tidak dapat diakses.')
  if ('error' in branchAccess) return { error: branchAccess.error }
  const driverId = formData.get('driver_id') as string || null
  const helperId = formData.get('helper_id') as string || null

  for (const [crewRole, crewId] of [['driver', driverId], ['helper', helperId]] as const) {
    if (!crewId) continue

    const { data: crew, error: crewError } = await supabase
      .from('employees')
      .select('id, branch_id')
      .eq('org_id', orgId)
      .eq('id', crewId)
      .maybeSingle() as { data: CrewBranchRecord; error: DbError | null }

    if (crewError) return { error: crewError.message }
    if (!crew) {
      return { error: `Data ${crewRole} tidak ditemukan.` }
    }
    if (crew.branch_id && crew.branch_id !== branchAccess.branchId) {
      return { error: `${crewRole === 'driver' ? 'Driver' : 'Helper'} harus berasal dari unit yang sama.` }
    }
  }

  const payload = {
    org_id: orgId,
    branch_id: branchAccess.branchId,
    route_id: routeId,
    asset_id: assetId,
    driver_id: driverId,
    helper_id: helperId,
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
  const { data: schedule, error: scheduleError } = await supabase
    .from('fleet_schedules')
    .select('id, branch_id')
    .eq('org_id', orgId)
    .eq('id', payload.schedule_id)
    .maybeSingle() as { data: ScheduleBranchRecord; error: DbError | null }

  if (scheduleError) return { error: scheduleError.message }
  if (!schedule?.branch_id) return { error: 'Jadwal tidak ditemukan.' }

  const branchAccess = await ensureFleetBranchAccess(orgId, schedule.branch_id, 'Jadwal tidak ditemukan.')
  if ('error' in branchAccess) return { error: branchAccess.error }

  const { error } = await supabase.from('fleet_tickets').insert({
    org_id: orgId,
    branch_id: branchAccess.branchId,
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

export async function getAllMedicalRecords(orgId: string, branchId?: string | null) {
  const supabase = await createFleetDb()
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = supabase
    .from('fleet_maintenance_labs')
    .select(`
      *,
      asset:fleet_assets(id, plate_number, model)
    `)
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('service_date', { ascending: false })

  if (error) {
    console.error('Error fetching all medical records:', error)
    return []
  }
  return data
}

export async function getFleetCrew(orgId: string, branchId?: string | null) {
  const supabase = await createFleetDb()
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = supabase
    .from('employees')
    .select('*')
    .eq('org_id', orgId)
    .or('job_title.ilike.%sopir%,job_title.ilike.%driver%,job_title.ilike.%kernet%,job_title.ilike.%helper%')

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('first_name', { ascending: true })

  if (error) return []
  return data
}

export async function createCrew(orgId: string, payload: CreateCrewPayload) {
  const supabase = await createFleetDb()
  const activeBranch = await requireFleetCreateBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menambahkan kru.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }
  const { data, error } = await supabase
    .from('employees')
    .insert([{ ...payload, org_id: orgId, branch_id: activeBranch.branchId }])
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

  const { data: assetRecord, error: assetError } = await supabase
    .from('fleet_assets')
    .select('id, status, branch_id')
    .eq('org_id', orgId)
    .eq('id', payload.asset_id)
    .maybeSingle() as { data: AssetBranchRecord; error: DbError | null }

  if (assetError) return { error: assetError.message }
  if (!assetRecord?.branch_id) return { error: 'Armada tidak ditemukan.' }

  const branchAccess = await ensureFleetBranchAccess(orgId, assetRecord.branch_id, 'Armada tidak ditemukan.')
  if ('error' in branchAccess) return { error: branchAccess.error }

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

  const { data: asset, error: assetFallbackError } = await supabase
    .from('fleet_assets')
    .select('status')
    .eq('org_id', orgId)
    .eq('branch_id', branchAccess.branchId)
    .eq('id', payload.asset_id)
    .maybeSingle()

  if (assetFallbackError) return { error: assetFallbackError.message }
  if (!asset) return { error: 'Armada tidak ditemukan.' }

  const { error: assetUpdateError } = await supabase
    .from('fleet_assets')
    .update({ status: 'MAINTENANCE' })
    .eq('org_id', orgId)
    .eq('branch_id', branchAccess.branchId)
    .eq('id', payload.asset_id)

  if (assetUpdateError) return { error: assetUpdateError.message }

  const { error: insertError } = await supabase
    .from('fleet_maintenance_labs')
    .insert({
      org_id: orgId,
      branch_id: branchAccess.branchId,
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
      .eq('branch_id', branchAccess.branchId)
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

export async function getTerminals(orgId: string, branchId?: string | null) {
  const supabase = await createFleetDb()
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  let query = supabase
    .from('fleet_terminals')
    .select('*')
    .eq('org_id', orgId)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('name', { ascending: true })
  
  if (error) return []
  return data
}

export async function createTerminal(orgId: string, formData: FormData) {
  const supabase = await createFleetDb()
  const activeBranch = await requireFleetCreateBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menambahkan terminal.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }

  const payload = {
    org_id: orgId,
    branch_id: activeBranch.branchId,
    name: formData.get('name') as string,
    location_name: formData.get('location_name') as string
  }

  const { error } = await supabase.from('fleet_terminals').insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/fleet')
  return { success: true }
}

export async function getFleetAttendanceToday(orgId: string, branchId?: string | null) {
  const supabase = await createFleetDb()
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  const today = new Date().toISOString().split('T')[0]
  let query = supabase
    .from('attendance')
    .select('*, employee:employees(first_name, last_name)')
    .eq('org_id', orgId)
    .eq('record_date', today)

  if (branchSelection.branchId) {
    query = query.eq('branch_id', branchSelection.branchId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
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
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id, branch_id')
    .eq('org_id', orgId)
    .eq('id', payload.employee_id)
    .maybeSingle() as { data: CrewBranchRecord; error: DbError | null }

  if (employeeError) return { error: employeeError.message }
  if (!employee?.branch_id) return { error: 'Kru tidak ditemukan atau belum terhubung ke unit.' }

  const branchAccess = await ensureFleetBranchAccess(orgId, employee.branch_id, 'Kru tidak ditemukan.')
  if ('error' in branchAccess) return { error: branchAccess.error }

  // Find if already exists for today
  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('org_id', orgId)
    .eq('branch_id', branchAccess.branchId)
    .eq('employee_id', payload.employee_id)
    .eq('record_date', date)
    .single()

  if (payload.type === 'IN') {
    if (existing) return { error: 'Anda sudah Clock-In hari ini.' }
    
    const { error } = await supabase.from('attendance').insert([{
      org_id: orgId,
      branch_id: branchAccess.branchId,
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
      .eq('branch_id', branchAccess.branchId)
    
    if (error) return { error: error.message }
  }

  revalidatePath('/fleet')
  return { success: true }
}
