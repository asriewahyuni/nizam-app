import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, failure, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import {
  checkAssetAvailability,
  createBooking,
  createMedicalRecord,
  createSchedule,
  recordCrewAttendance,
  updateBookingStatus,
} from '@/modules/fleet/actions/fleet.actions'

function buildBookingForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('asset_id', overrides.asset_id || 'asset-1')
  formData.set('contact_id', overrides.contact_id || 'contact-1')
  formData.set('start_date', overrides.start_date || '2026-04-01T08:00:00.000Z')
  formData.set('end_date', overrides.end_date || '2026-04-02T08:00:00.000Z')
  formData.set('total_amount', overrides.total_amount || '450000')
  formData.set('deposit', overrides.deposit || '100000')
  return formData
}

function buildScheduleForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('route_id', overrides.route_id || 'route-1')
  formData.set('asset_id', overrides.asset_id || 'asset-1')
  formData.set('driver_id', overrides.driver_id || 'driver-1')
  formData.set('helper_id', overrides.helper_id || 'helper-1')
  formData.set('departure_time', overrides.departure_time || '2026-04-01T09:00:00.000Z')
  return formData
}

function getFirstOperationArg(callTable: string, method: string, calls: Array<{ table: string; operations: Array<{ method: string; args: unknown[] }> }>) {
  const call = calls.find((entry) =>
    entry.table === callTable && entry.operations.some((operation) => operation.method === method)
  )
  return call?.operations.find((operation) => operation.method === method)?.args[0]
}

describe('Fleet Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })
  })

  it('rejects bookings when date range is invalid', async () => {
    mocks.createClient.mockResolvedValue(createSupabaseMock().client)

    const result = await createBooking('org-1', buildBookingForm({
      start_date: '2026-04-02T08:00:00.000Z',
      end_date: '2026-04-01T08:00:00.000Z',
    }))

    expect(result).toEqual({ error: 'Tanggal selesai harus lebih besar dari tanggal mulai.' })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects bookings when an asset is not available', async () => {
    const supabase = createSupabaseMock({
      tables: {
        fleet_assets: [
          {
            maybeSingleResult: success({
              id: 'asset-1',
              status: 'MAINTENANCE',
              branch_id: 'branch-1',
            }),
          },
        ],
      },
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await createBooking('org-1', buildBookingForm())

    expect(result).toEqual({ error: 'Armada sedang tidak tersedia untuk dibooking.' })
  })

  it('rejects overlapping bookings before insert', async () => {
    const supabase = createSupabaseMock({
      tables: {
        fleet_assets: [
          {
            maybeSingleResult: success({
              id: 'asset-1',
              status: 'AVAILABLE',
              branch_id: 'branch-1',
            }),
          },
        ],
        fleet_bookings: [
          {
            result: success([{ id: 'existing-booking' }]),
          },
        ],
      },
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await createBooking('org-1', buildBookingForm())

    expect(result).toEqual({ error: 'Armada sudah memiliki booking aktif di periode tersebut.' })
    expect(supabase.calls.filter((call) => call.table === 'fleet_bookings')).toHaveLength(1)
  })

  it('creates a reserved booking and revalidates the fleet page', async () => {
    const supabase = createSupabaseMock({
      tables: {
        fleet_assets: [
          {
            maybeSingleResult: success({
              id: 'asset-1',
              status: 'AVAILABLE',
              branch_id: 'branch-1',
            }),
          },
        ],
        fleet_bookings: [
          {
            result: success([]),
          },
          {
            singleResult: success({
              id: 'booking-1',
            }),
          },
        ],
      },
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await createBooking('org-1', buildBookingForm())
    const insertedPayload = getFirstOperationArg('fleet_bookings', 'insert', supabase.calls) as Record<string, string>

    expect(result).toEqual({ success: true, bookingId: 'booking-1' })
    expect(insertedPayload.branch_id).toBe('branch-1')
    expect(insertedPayload.status).toBe('RESERVED')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/fleet')
  })

  it('marks assets as rented when a booking becomes active', async () => {
    const supabase = createSupabaseMock({
      tables: {
        fleet_bookings: [
          {
            maybeSingleResult: success({
              id: 'booking-1',
              branch_id: 'branch-1',
              asset_id: 'asset-1',
              status: 'RESERVED',
            }),
          },
        ],
        fleet_assets: [
          {
            result: success([]),
          },
        ],
      },
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await updateBookingStatus('org-1', 'booking-1', 'asset-1', 'ACTIVE')
    const assetUpdate = getFirstOperationArg('fleet_assets', 'update', supabase.calls) as Record<string, string>

    expect(result).toEqual({ success: true })
    expect(assetUpdate.status).toBe('RENTED')
  })

  it('creates schedules with SCHEDULED status', async () => {
    const supabase = createSupabaseMock({
      tables: {
        fleet_schedules: [
          {
            result: success([]),
          },
        ],
        fleet_assets: [
          {
            maybeSingleResult: success({
              id: 'asset-1',
              branch_id: 'branch-1',
            }),
          },
        ],
        fleet_routes: [
          {
            maybeSingleResult: success({
              id: 'route-1',
              branch_id: 'branch-1',
            }),
          },
        ],
        employees: [
          {
            maybeSingleResult: success({
              id: 'driver-1',
              branch_id: 'branch-1',
            }),
          },
          {
            maybeSingleResult: success({
              id: 'helper-1',
              branch_id: 'branch-1',
            }),
          },
        ],
      },
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await createSchedule('org-1', buildScheduleForm())
    const payload = getFirstOperationArg('fleet_schedules', 'insert', supabase.calls) as Record<string, string>

    expect(result).toEqual({ success: true })
    expect(payload.branch_id).toBe('branch-1')
    expect(payload.status).toBe('SCHEDULED')
  })

  it('stores medical records through the atomic RPC path when available', async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_fleet_medical_record: [
          success('medical-1'),
        ],
      },
      tables: {
        fleet_assets: [
          {
            maybeSingleResult: success({
              id: 'asset-1',
              status: 'AVAILABLE',
              branch_id: 'branch-1',
            }),
          },
        ],
      },
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await createMedicalRecord('org-1', {
      asset_id: 'asset-1',
      service_date: '2026-04-01',
      description: 'Ganti oli dan filter',
      maintenance_type: 'ROUTINE',
      cost: 250000,
      odometer_at: 125000,
      parts_replaced: [{ name: 'Oli Mesin', qty: 1 }],
    })

    expect(result).toEqual({ success: true })
    expect(supabase.rpcCalls[0]).toMatchObject({
      fn: 'create_fleet_medical_record',
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/fleet')
  })

  it('falls back safely when the maintenance RPC is not available', async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_fleet_medical_record: [
          failure('Function not found', 'PGRST202'),
        ],
      },
      tables: {
        fleet_assets: [
          {
            maybeSingleResult: success({
              id: 'asset-1',
              status: 'AVAILABLE',
              branch_id: 'branch-1',
            }),
          },
          {
            maybeSingleResult: success({
              id: 'asset-1',
              status: 'AVAILABLE',
              branch_id: 'branch-1',
            }),
          },
          {
            result: success([]),
          },
          {
            result: success([]),
          },
        ],
        fleet_maintenance_labs: [
          {
            result: failure('Insert maintenance failed'),
          },
        ],
      },
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await createMedicalRecord('org-1', {
      asset_id: 'asset-1',
      service_date: '2026-04-01',
      description: 'Servis besar',
      maintenance_type: 'CORRECTIVE',
      cost: 1000000,
      odometer_at: 200000,
    })

    const assetUpdates = supabase.calls
      .filter((call) => call.table === 'fleet_assets')
      .map((call) => call.operations.find((operation) => operation.method === 'update')?.args[0])
      .filter(Boolean) as Array<Record<string, string>>

    expect(result).toEqual({ error: 'Insert maintenance failed' })
    expect(assetUpdates).toEqual([
      { status: 'MAINTENANCE' },
      { status: 'AVAILABLE' },
    ])
  })

  it('checks asset availability using the same overlap rule as bookings', async () => {
    const supabase = createSupabaseMock({
      tables: {
        fleet_bookings: [
          {
            result: success([{ id: 'booking-1' }]),
          },
        ],
      },
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await checkAssetAvailability('asset-1', '2026-04-01T08:00:00.000Z', '2026-04-02T08:00:00.000Z')

    expect(result).toEqual({ available: false })
  })

  it('updates clock-out attendance and appends notes', async () => {
    const supabase = createSupabaseMock({
      tables: {
        attendance: [
          {
            singleResult: success({
              id: 'attendance-1',
              check_out: null,
              notes: 'Berangkat pool',
            }),
          },
          {
            result: success([]),
          },
        ],
        employees: [
          {
            maybeSingleResult: success({
              id: 'employee-1',
              branch_id: 'branch-1',
            }),
          },
        ],
      },
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await recordCrewAttendance('org-1', {
      employee_id: 'employee-1',
      type: 'OUT',
      notes: 'Selesai shift',
    })
    const payload = getFirstOperationArg('attendance', 'update', supabase.calls) as Record<string, string>

    expect(result).toEqual({ success: true })
    expect(payload.notes).toBe('Berangkat pool | Selesai shift')
  })
})
