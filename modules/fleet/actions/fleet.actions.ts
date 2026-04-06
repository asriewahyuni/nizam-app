'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { resolveAccessibleBranchSelection } from '@/modules/organization/lib/branch-access.server'
import { withDbUserContext } from '@/modules/sales/lib/sales-write.server'

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

type BranchSelectionResult =
  | { branchId: string | null }
  | { error: string }

type AssetBranchRecord = {
  id: string
  status: string
  branch_id: string
} | null

type RouteBranchRecord = {
  id: string
  branch_id: string
} | null

type ScheduleBranchRecord = {
  id: string
  branch_id: string
  asset_id: string
} | null

type BookingBranchRecord = {
  id: string
  branch_id: string
  asset_id: string
  status: string
} | null

type CrewBranchRecord = {
  id: string
  branch_id: string | null
} | null

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

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function toIsoDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function toNumber(value: unknown) {
  const normalized = Number(value ?? 0)
  return Number.isFinite(normalized) ? normalized : 0
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof (error as any)?.message === 'string') return String((error as any).message)
  return 'Unknown error'
}

function extractErrorCode(error: unknown) {
  if (typeof (error as any)?.code === 'string') return String((error as any).code)
  if (typeof (error as any)?.meta?.code === 'string') return String((error as any).meta.code)
  return null
}

function normalizeAsset(row: any) {
  return {
    ...row,
    status: row.status ? String(row.status) : 'AVAILABLE',
    type: row.type ? String(row.type) : 'CAR',
    odometer: toNumber(row.odometer),
    daily_rate: toNumber(row.daily_rate),
    created_at: toIsoDateTime(row.created_at),
    updated_at: toIsoDateTime(row.updated_at),
  }
}

function normalizeBooking(row: any) {
  return {
    ...row,
    status: row.status ? String(row.status) : 'RESERVED',
    total_amount: toNumber(row.total_amount),
    deposit: toNumber(row.deposit),
    start_date: toIsoDateTime(row.start_date),
    end_date: toIsoDateTime(row.end_date),
    created_at: toIsoDateTime(row.created_at),
    updated_at: toIsoDateTime(row.updated_at),
    asset: row.fleet_assets
      ? {
          id: row.fleet_assets.id,
          plate_number: row.fleet_assets.plate_number,
          model: row.fleet_assets.model,
        }
      : null,
    contact: row.contacts
      ? {
          id: row.contacts.id,
          name: row.contacts.name,
        }
      : null,
  }
}

function normalizeRoute(row: any) {
  return {
    ...row,
    distance_km: toNumber(row.distance_km),
    base_price: toNumber(row.base_price),
    created_at: toIsoDateTime(row.created_at),
    updated_at: toIsoDateTime(row.updated_at),
  }
}

function normalizeCrew(row: any) {
  return {
    ...row,
    join_date: toIsoDate(row.join_date),
    license_expiry: toIsoDate(row.license_expiry),
    basic_salary: toNumber(row.basic_salary),
    created_at: toIsoDateTime(row.created_at),
    updated_at: toIsoDateTime(row.updated_at),
  }
}

function normalizeTicket(row: any) {
  return {
    ...row,
    price: toNumber(row.price),
    status: row.status ? String(row.status) : 'BOOKED',
    created_at: toIsoDateTime(row.created_at),
    updated_at: toIsoDateTime(row.updated_at),
    passenger: row.contacts
      ? {
          id: row.contacts.id,
          name: row.contacts.name,
        }
      : null,
  }
}

function normalizeSchedule(row: any) {
  const tickets = (row.fleet_tickets || []).map(normalizeTicket)
  ;(tickets as any).count = tickets.length

  return {
    ...row,
    departure_time: toIsoDateTime(row.departure_time),
    arrival_time: toIsoDateTime(row.arrival_time),
    status: row.status ? String(row.status) : 'SCHEDULED',
    created_at: toIsoDateTime(row.created_at),
    updated_at: toIsoDateTime(row.updated_at),
    route: row.fleet_routes ? normalizeRoute(row.fleet_routes) : null,
    asset: row.fleet_assets ? normalizeAsset(row.fleet_assets) : null,
    driver: row.employees_fleet_schedules_driver_idToemployees
      ? {
          first_name: row.employees_fleet_schedules_driver_idToemployees.first_name,
          last_name: row.employees_fleet_schedules_driver_idToemployees.last_name,
          phone: row.employees_fleet_schedules_driver_idToemployees.phone,
        }
      : null,
    helper: row.employees_fleet_schedules_helper_idToemployees
      ? {
          first_name: row.employees_fleet_schedules_helper_idToemployees.first_name,
          last_name: row.employees_fleet_schedules_helper_idToemployees.last_name,
          phone: row.employees_fleet_schedules_helper_idToemployees.phone,
        }
      : null,
    tickets,
  }
}

function normalizeMedicalRecord(row: any) {
  return {
    ...row,
    service_date: toIsoDate(row.service_date),
    next_service_date: toIsoDate(row.next_service_date),
    cost: toNumber(row.cost),
    odometer_at: toNumber(row.odometer_at),
    next_service_km: row.next_service_km == null ? null : toNumber(row.next_service_km),
    created_at: toIsoDateTime(row.created_at),
    asset: row.fleet_assets
      ? {
          id: row.fleet_assets.id,
          plate_number: row.fleet_assets.plate_number,
          model: row.fleet_assets.model,
        }
      : null,
  }
}

function normalizeAttendance(row: any) {
  return {
    ...row,
    record_date: toIsoDate(row.record_date),
    check_in: toIsoDateTime(row.check_in),
    check_out: toIsoDateTime(row.check_out),
    created_at: toIsoDateTime(row.created_at),
    updated_at: toIsoDateTime(row.updated_at),
    employee: row.employees
      ? {
          first_name: row.employees.first_name,
          last_name: row.employees.last_name,
        }
      : null,
  }
}

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

async function hasOverlappingBooking(
  orgId: string,
  assetId: string,
  startDate: string,
  endDate: string,
  excludeBookingId?: string
) {
  const overlap = await prisma.fleet_bookings.findFirst({
    where: {
      org_id: orgId,
      asset_id: assetId,
      status: { not: 'CANCELLED' as any },
      start_date: { lt: new Date(endDate) },
      end_date: { gt: new Date(startDate) },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { id: true },
  })

  return { hasOverlap: Boolean(overlap) }
}

async function syncAssetBookingStatus(orgId: string, assetId: string) {
  const asset = await prisma.fleet_assets.findFirst({
    where: {
      org_id: orgId,
      id: assetId,
    },
    select: {
      id: true,
      status: true,
    },
  })

  if (!asset) return 'Armada tidak ditemukan.'

  const currentStatus = String(asset.status || 'AVAILABLE')
  if (currentStatus === 'MAINTENANCE' || currentStatus === 'OUT_OF_SERVICE') {
    return null
  }

  const activeBooking = await prisma.fleet_bookings.findFirst({
    where: {
      org_id: orgId,
      asset_id: assetId,
      status: 'ACTIVE' as any,
    },
    select: { id: true },
  })

  const nextStatus: FleetAssetStatus = activeBooking ? 'RENTED' : 'AVAILABLE'

  if (currentStatus !== nextStatus) {
    await prisma.fleet_assets.updateMany({
      where: {
        org_id: orgId,
        id: assetId,
      },
      data: {
        status: nextStatus as any,
      },
    })
  }

  return null
}

/** ASSET MANAGEMENT **/

export async function getAssets(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  try {
    const data = await prisma.fleet_assets.findMany({
      where: {
        org_id: orgId,
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    return data.map(normalizeAsset)
  } catch (error) {
    console.error('Error fetching Fleet Assets:', error)
    return []
  }
}

export async function createAsset(orgId: string, formData: FormData) {
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
    brand: (formData.get('brand') as string) || null,
    type: ((formData.get('type') as string) || 'CAR') as any,
    status: 'AVAILABLE' as any,
    daily_rate: parseNumber(formData.get('daily_rate')),
    odometer: parseNumber(formData.get('odometer')),
    notes: (formData.get('notes') as string) || null,
  }

  try {
    await prisma.fleet_assets.create({ data: payload })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  revalidatePath('/fleet')
  return { success: true }
}

/** BOOKING MANAGEMENT **/

export async function getBookings(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  try {
    const data = await prisma.fleet_bookings.findMany({
      where: {
        org_id: orgId,
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      include: {
        fleet_assets: {
          select: {
            id: true,
            plate_number: true,
            model: true,
          },
        },
        contacts: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    return data.map(normalizeBooking)
  } catch (error) {
    console.error('Error fetching Bookings:', error)
    return []
  }
}

export async function createBooking(orgId: string, formData: FormData) {
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

  let asset: AssetBranchRecord
  try {
    asset = await prisma.fleet_assets.findFirst({
      where: {
        org_id: orgId,
        id: asset_id,
      },
      select: {
        id: true,
        status: true,
        branch_id: true,
      },
    })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  if (!asset) return { error: 'Armada tidak ditemukan.' }
  const branchAccess = await ensureFleetBranchAccess(orgId, asset.branch_id, 'Armada tidak ditemukan.')
  if ('error' in branchAccess) return { error: branchAccess.error }

  if (asset.status === 'MAINTENANCE' || asset.status === 'OUT_OF_SERVICE') {
    return { error: 'Armada sedang tidak tersedia untuk dibooking.' }
  }

  const overlapCheck = await hasOverlappingBooking(
    orgId,
    asset_id,
    dateRange.startIso,
    dateRange.endIso
  )

  if (overlapCheck.hasOverlap) {
    return { error: 'Armada sudah memiliki booking aktif di periode tersebut.' }
  }

  try {
    const booking = await prisma.fleet_bookings.create({
      data: {
        org_id: orgId,
        branch_id: branchAccess.branchId,
        asset_id,
        contact_id,
        start_date: new Date(dateRange.startIso),
        end_date: new Date(dateRange.endIso),
        total_amount,
        deposit,
        status: 'RESERVED' as any,
      },
      select: {
        id: true,
      },
    })

    revalidatePath('/fleet')
    return { success: true, bookingId: booking.id }
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }
}

export async function updateBookingStatus(orgId: string, bookingId: string, assetId: string, status: BookingStatus) {
  if (!BOOKING_STATUSES.includes(status)) {
    return { error: 'Status booking tidak valid.' }
  }

  let booking: BookingBranchRecord
  try {
    booking = await prisma.fleet_bookings.findFirst({
      where: {
        id: bookingId,
        org_id: orgId,
      },
      select: {
        id: true,
        branch_id: true,
        asset_id: true,
        status: true,
      },
    })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  if (!booking) return { error: 'Booking tidak ditemukan.' }

  const branchAccess = await ensureFleetBranchAccess(orgId, booking.branch_id, 'Booking tidak ditemukan.')
  if ('error' in branchAccess) return { error: branchAccess.error }
  const effectiveAssetId = booking.asset_id || assetId

  try {
    await prisma.fleet_bookings.updateMany({
      where: {
        id: bookingId,
        org_id: orgId,
        branch_id: branchAccess.branchId,
      },
      data: {
        status: status as any,
      },
    })

    if (status === 'ACTIVE') {
      await prisma.fleet_assets.updateMany({
        where: {
          org_id: orgId,
          branch_id: branchAccess.branchId,
          id: effectiveAssetId,
        },
        data: {
          status: 'RENTED' as any,
        },
      })
    } else {
      const syncError = await syncAssetBookingStatus(orgId, effectiveAssetId)
      if (syncError) return { error: syncError }
    }
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  revalidatePath('/fleet')
  return { success: true }
}

/** PO BUS MANAGEMENT **/

export async function getRoutes(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  try {
    const data = await prisma.fleet_routes.findMany({
      where: {
        org_id: orgId,
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      orderBy: {
        name: 'asc',
      },
    })

    return data.map(normalizeRoute)
  } catch {
    return []
  }
}

export async function createRoute(orgId: string, formData: FormData) {
  const activeBranch = await requireFleetCreateBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk membuat rute.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }

  try {
    await prisma.fleet_routes.create({
      data: {
        org_id: orgId,
        branch_id: activeBranch.branchId,
        name: formData.get('name') as string,
        origin: formData.get('origin') as string,
        destination: formData.get('destination') as string,
        distance_km: parseNumber(formData.get('distance_km')),
        base_price: parseNumber(formData.get('base_price')),
      },
    })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  revalidatePath('/fleet')
  return { success: true }
}

export async function getSchedules(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  try {
    const data = await prisma.fleet_schedules.findMany({
      where: {
        org_id: orgId,
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      include: {
        fleet_routes: true,
        fleet_assets: true,
        employees_fleet_schedules_driver_idToemployees: {
          select: {
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
        employees_fleet_schedules_helper_idToemployees: {
          select: {
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
        fleet_tickets: {
          include: {
            contacts: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
        },
      },
      orderBy: {
        departure_time: 'asc',
      },
    })

    return data.map(normalizeSchedule)
  } catch {
    return []
  }
}

export async function createSchedule(orgId: string, formData: FormData) {
  const departureTime = normalizeDateTime(formData.get('departure_time') as string)

  if (!departureTime) {
    return { error: 'Tanggal keberangkatan tidak valid.' }
  }

  const assetId = formData.get('asset_id') as string
  const routeId = formData.get('route_id') as string

  let asset: AssetBranchRecord
  let route: RouteBranchRecord

  try {
    asset = await prisma.fleet_assets.findFirst({
      where: {
        org_id: orgId,
        id: assetId,
      },
      select: {
        id: true,
        branch_id: true,
        status: true,
      },
    })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  if (!asset?.branch_id) return { error: 'Armada tidak ditemukan.' }

  try {
    route = await prisma.fleet_routes.findFirst({
      where: {
        org_id: orgId,
        id: routeId,
      },
      select: {
        id: true,
        branch_id: true,
      },
    })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  if (!route?.branch_id) return { error: 'Rute tidak ditemukan.' }
  if (route.branch_id !== asset.branch_id) {
    return { error: 'Rute dan armada harus berasal dari unit yang sama.' }
  }

  const branchAccess = await ensureFleetBranchAccess(orgId, asset.branch_id, 'Unit armada tidak dapat diakses.')
  if ('error' in branchAccess) return { error: branchAccess.error }

  const driverId = (formData.get('driver_id') as string) || null
  const helperId = (formData.get('helper_id') as string) || null

  for (const [crewRole, crewId] of [['driver', driverId], ['helper', helperId]] as const) {
    if (!crewId) continue

    let crew: CrewBranchRecord
    try {
      crew = await prisma.employees.findFirst({
        where: {
          org_id: orgId,
          id: crewId,
        },
        select: {
          id: true,
          branch_id: true,
        },
      })
    } catch (error) {
      return { error: extractErrorMessage(error) }
    }

    if (!crew) {
      return { error: `Data ${crewRole} tidak ditemukan.` }
    }
    if (crew.branch_id && crew.branch_id !== branchAccess.branchId) {
      return { error: `${crewRole === 'driver' ? 'Driver' : 'Helper'} harus berasal dari unit yang sama.` }
    }
  }

  try {
    await prisma.fleet_schedules.create({
      data: {
        org_id: orgId,
        branch_id: branchAccess.branchId,
        route_id: routeId,
        asset_id: assetId,
        driver_id: driverId,
        helper_id: helperId,
        departure_time: new Date(departureTime),
        status: 'SCHEDULED' as any,
      },
    })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  revalidatePath('/fleet')
  return { success: true }
}

export async function createTicket(orgId: string, payload: {
  schedule_id: string
  passenger_id: string
  seat_number: string
  price: number
  notes?: string
}) {
  let schedule: ScheduleBranchRecord

  try {
    schedule = await prisma.fleet_schedules.findFirst({
      where: {
        org_id: orgId,
        id: payload.schedule_id,
      },
      select: {
        id: true,
        branch_id: true,
        asset_id: true,
      },
    })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  if (!schedule?.branch_id) return { error: 'Jadwal tidak ditemukan.' }

  const branchAccess = await ensureFleetBranchAccess(orgId, schedule.branch_id, 'Jadwal tidak ditemukan.')
  if ('error' in branchAccess) return { error: branchAccess.error }

  try {
    await prisma.fleet_tickets.create({
      data: {
        org_id: orgId,
        branch_id: branchAccess.branchId,
        schedule_id: payload.schedule_id,
        passenger_id: payload.passenger_id,
        seat_number: payload.seat_number,
        price: parseNumber(payload.price),
        notes: payload.notes || null,
        status: 'PAID' as any,
      },
    })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  revalidatePath('/fleet')
  return { success: true }
}

/**
 * VEHICLE MEDICAL RECORD (MAINTENANCE)
 * "Rekam Medis Bus"
 */

export async function getMedicalRecords(assetId: string) {
  try {
    const data = await prisma.fleet_maintenance_labs.findMany({
      where: {
        asset_id: assetId,
      },
      orderBy: {
        service_date: 'desc',
      },
    })

    return data.map(normalizeMedicalRecord)
  } catch {
    return []
  }
}

export async function getAllMedicalRecords(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  try {
    const data = await prisma.fleet_maintenance_labs.findMany({
      where: {
        org_id: orgId,
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      include: {
        fleet_assets: {
          select: {
            id: true,
            plate_number: true,
            model: true,
          },
        },
      },
      orderBy: {
        service_date: 'desc',
      },
    })

    return data.map(normalizeMedicalRecord)
  } catch (error) {
    console.error('Error fetching all medical records:', error)
    return []
  }
}

export async function getFleetCrew(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  try {
    const data = await prisma.employees.findMany({
      where: {
        org_id: orgId,
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
        OR: [
          { job_title: { contains: 'sopir', mode: 'insensitive' } },
          { job_title: { contains: 'driver', mode: 'insensitive' } },
          { job_title: { contains: 'kernet', mode: 'insensitive' } },
          { job_title: { contains: 'helper', mode: 'insensitive' } },
        ],
      },
      orderBy: {
        first_name: 'asc',
      },
    })

    return data.map(normalizeCrew)
  } catch {
    return []
  }
}

export async function createCrew(orgId: string, payload: CreateCrewPayload) {
  const activeBranch = await requireFleetCreateBranchId(
    orgId,
    'Pilih unit aktif terlebih dahulu untuk menambahkan kru.'
  )
  if ('error' in activeBranch) return { error: activeBranch.error }

  try {
    const data = await prisma.employees.create({
      data: {
        ...payload,
        org_id: orgId,
        branch_id: activeBranch.branchId,
        join_date: new Date(`${payload.join_date}T00:00:00.000Z`),
        license_expiry: payload.license_expiry ? new Date(`${payload.license_expiry}T00:00:00.000Z`) : null,
      },
    })

    return { data: normalizeCrew(data), error: undefined }
  } catch (error) {
    return { data: null, error: extractErrorMessage(error) }
  }
}

export async function createMedicalRecord(orgId: string, payload: {
  asset_id: string
  service_date: string
  description: string
  maintenance_type: MaintenanceType
  cost: number
  odometer_at: number
  technician_name?: string
  vendor_name?: string
  parts_replaced?: MaintenancePart[]
  next_service_km?: number
  next_service_date?: string
  attachment_url?: string
}) {
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

  let assetRecord: AssetBranchRecord
  try {
    assetRecord = await prisma.fleet_assets.findFirst({
      where: {
        org_id: orgId,
        id: payload.asset_id,
      },
      select: {
        id: true,
        status: true,
        branch_id: true,
      },
    })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  if (!assetRecord?.branch_id) return { error: 'Armada tidak ditemukan.' }

  const branchAccess = await ensureFleetBranchAccess(orgId, assetRecord.branch_id, 'Armada tidak ditemukan.')
  if ('error' in branchAccess) return { error: branchAccess.error }

  const session = await auth()
  if (session?.user?.id) {
    try {
      const rows = await withDbUserContext(session.user.id, async (tx) => {
        return tx.$queryRaw<Array<{ id: string | null }>>`
          SELECT public.create_fleet_medical_record(
            p_org_id := CAST(${orgId} AS uuid),
            p_asset_id := CAST(${payload.asset_id} AS uuid),
            p_service_date := CAST(${serviceDate} AS date),
            p_description := ${payload.description.trim()},
            p_maintenance_type := ${payload.maintenance_type},
            p_cost := ${parseNumber(payload.cost)},
            p_odometer_at := ${parseNumber(payload.odometer_at)},
            p_technician_name := ${payload.technician_name || null},
            p_vendor_name := ${payload.vendor_name || null},
            p_parts_replaced := CAST(${JSON.stringify(payload.parts_replaced || [])} AS jsonb),
            p_next_service_km := CAST(${payload.next_service_km ?? null} AS numeric),
            p_next_service_date := CAST(${nextServiceDate} AS date),
            p_attachment_url := ${payload.attachment_url || null}
          )::text AS id
        `
      })

      if (rows[0]?.id) {
        revalidatePath('/fleet')
        return { success: true }
      }
    } catch (error) {
      const errorCode = extractErrorCode(error)
      const message = extractErrorMessage(error)
      const missingFunction = errorCode === '42883' || message.includes('create_fleet_medical_record')

      if (!missingFunction) {
        return { error: message }
      }
    }
  }

  try {
    const asset = await prisma.fleet_assets.findFirst({
      where: {
        org_id: orgId,
        branch_id: branchAccess.branchId,
        id: payload.asset_id,
      },
      select: {
        status: true,
      },
    })

    if (!asset) return { error: 'Armada tidak ditemukan.' }

    await prisma.fleet_assets.updateMany({
      where: {
        org_id: orgId,
        branch_id: branchAccess.branchId,
        id: payload.asset_id,
      },
      data: {
        status: 'MAINTENANCE' as any,
      },
    })

    try {
      await prisma.fleet_maintenance_labs.create({
        data: {
          org_id: orgId,
          branch_id: branchAccess.branchId,
          asset_id: payload.asset_id,
          service_date: new Date(`${serviceDate}T00:00:00.000Z`),
          description: payload.description.trim(),
          maintenance_type: payload.maintenance_type,
          cost: parseNumber(payload.cost),
          odometer_at: parseNumber(payload.odometer_at),
          technician_name: payload.technician_name || null,
          vendor_name: payload.vendor_name || null,
          parts_replaced: payload.parts_replaced || [],
          next_service_km: payload.next_service_km ?? null,
          next_service_date: nextServiceDate ? new Date(`${nextServiceDate}T00:00:00.000Z`) : null,
          attachment_url: payload.attachment_url || null,
        },
      })
    } catch (error) {
      await prisma.fleet_assets.updateMany({
        where: {
          org_id: orgId,
          branch_id: branchAccess.branchId,
          id: payload.asset_id,
        },
        data: {
          status: asset.status as any,
        },
      })

      return { error: extractErrorMessage(error) }
    }
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  revalidatePath('/fleet')
  return { success: true }
}

/** AVAILABILITY ENGINE **/

export async function checkAssetAvailability(assetId: string, startDate: string, endDate: string) {
  const dateRange = normalizeBookingRange(startDate, endDate)

  if ('error' in dateRange) {
    return { available: false, error: dateRange.error }
  }

  try {
    const data = await prisma.fleet_bookings.findFirst({
      where: {
        asset_id: assetId,
        status: { not: 'CANCELLED' as any },
        start_date: { lt: new Date(dateRange.endIso) },
        end_date: { gt: new Date(dateRange.startIso) },
      },
      select: {
        id: true,
      },
    })

    return { available: !data }
  } catch (error) {
    return { available: false, error: extractErrorMessage(error) }
  }
}

/** SMART ATTENDANCE (GPS + QR) **/

export async function getTerminals(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  try {
    const data = await prisma.fleet_terminals.findMany({
      where: {
        org_id: orgId,
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      orderBy: {
        name: 'asc',
      },
    })

    return data.map((row) => ({
      ...row,
      created_at: toIsoDateTime(row.created_at),
    }))
  } catch {
    return []
  }
}

export async function getFleetAttendanceToday(orgId: string, branchId?: string | null) {
  const branchSelection = await resolveFleetBranchSelection(orgId, branchId)
  if ('error' in branchSelection) return []

  const today = new Date().toISOString().split('T')[0]

  try {
    const data = await prisma.attendance.findMany({
      where: {
        org_id: orgId,
        record_date: new Date(`${today}T00:00:00.000Z`),
        ...(branchSelection.branchId ? { branch_id: branchSelection.branchId } : {}),
      },
      include: {
        employees: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    return data.map(normalizeAttendance)
  } catch {
    return []
  }
}

export async function recordCrewAttendance(orgId: string, payload: {
  employee_id: string
  location_gps?: string
  qr_scanned_payload?: string
  type: 'IN' | 'OUT'
  notes?: string
}) {
  const date = new Date().toISOString().split('T')[0]
  const now = new Date()

  let employee: CrewBranchRecord
  try {
    employee = await prisma.employees.findFirst({
      where: {
        org_id: orgId,
        id: payload.employee_id,
      },
      select: {
        id: true,
        branch_id: true,
      },
    })
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  if (!employee?.branch_id) return { error: 'Kru tidak ditemukan atau belum terhubung ke unit.' }

  const branchAccess = await ensureFleetBranchAccess(orgId, employee.branch_id, 'Kru tidak ditemukan.')
  if ('error' in branchAccess) return { error: branchAccess.error }

  try {
    const existing = await prisma.attendance.findUnique({
      where: {
        employee_id_record_date: {
          employee_id: payload.employee_id,
          record_date: new Date(`${date}T00:00:00.000Z`),
        },
      },
      select: {
        id: true,
        check_out: true,
        notes: true,
      },
    })

    if (payload.type === 'IN') {
      if (existing) return { error: 'Anda sudah Clock-In hari ini.' }

      await prisma.attendance.create({
        data: {
          org_id: orgId,
          branch_id: branchAccess.branchId,
          employee_id: payload.employee_id,
          record_date: new Date(`${date}T00:00:00.000Z`),
          check_in: now,
          status: 'PRESENT' as any,
          location_gps: payload.location_gps || null,
          qr_scanned_payload: payload.qr_scanned_payload || null,
          notes: payload.notes || null,
        },
      })
    } else {
      if (!existing) return { error: 'Belum ada data Clock-In hari ini.' }
      if (existing.check_out) return { error: 'Anda sudah Clock-Out hari ini.' }

      await prisma.attendance.updateMany({
        where: {
          id: existing.id,
          branch_id: branchAccess.branchId,
        },
        data: {
          check_out: now,
          notes: payload.notes ? (existing.notes ? `${existing.notes} | ${payload.notes}` : payload.notes) : existing.notes,
        },
      })
    }
  } catch (error) {
    return { error: extractErrorMessage(error) }
  }

  revalidatePath('/fleet')
  return { success: true }
}
