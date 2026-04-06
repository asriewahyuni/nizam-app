import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    fleet_assets: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    fleet_bookings: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    fleet_routes: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    fleet_schedules: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    fleet_tickets: {
      create: vi.fn(),
    },
    fleet_maintenance_labs: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    employees: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    attendance: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    fleet_terminals: {
      findMany: vi.fn(),
    },
  },
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  withDbUserContext: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/auth', () => ({
  auth: mocks.auth,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

vi.mock('@/modules/sales/lib/sales-write.server', () => ({
  withDbUserContext: mocks.withDbUserContext,
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

describe('Fleet Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue(null)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })
  })

  it('rejects bookings when date range is invalid', async () => {
    const result = await createBooking('org-1', buildBookingForm({
      start_date: '2026-04-02T08:00:00.000Z',
      end_date: '2026-04-01T08:00:00.000Z',
    }))

    expect(result).toEqual({ error: 'Tanggal selesai harus lebih besar dari tanggal mulai.' })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects bookings when an asset is not available', async () => {
    mocks.prisma.fleet_assets.findFirst.mockResolvedValue({
      id: 'asset-1',
      status: 'MAINTENANCE',
      branch_id: 'branch-1',
    })

    const result = await createBooking('org-1', buildBookingForm())

    expect(result).toEqual({ error: 'Armada sedang tidak tersedia untuk dibooking.' })
  })

  it('rejects overlapping bookings before insert', async () => {
    mocks.prisma.fleet_assets.findFirst.mockResolvedValue({
      id: 'asset-1',
      status: 'AVAILABLE',
      branch_id: 'branch-1',
    })
    mocks.prisma.fleet_bookings.findFirst.mockResolvedValue({
      id: 'existing-booking',
    })

    const result = await createBooking('org-1', buildBookingForm())

    expect(result).toEqual({ error: 'Armada sudah memiliki booking aktif di periode tersebut.' })
    expect(mocks.prisma.fleet_bookings.create).not.toHaveBeenCalled()
  })

  it('creates a reserved booking and revalidates the fleet page', async () => {
    mocks.prisma.fleet_assets.findFirst.mockResolvedValue({
      id: 'asset-1',
      status: 'AVAILABLE',
      branch_id: 'branch-1',
    })
    mocks.prisma.fleet_bookings.findFirst.mockResolvedValue(null)
    mocks.prisma.fleet_bookings.create.mockResolvedValue({
      id: 'booking-1',
    })

    const result = await createBooking('org-1', buildBookingForm())
    const insertPayload = mocks.prisma.fleet_bookings.create.mock.calls[0]?.[0]?.data as Record<string, any>

    expect(result).toEqual({ success: true, bookingId: 'booking-1' })
    expect(insertPayload.branch_id).toBe('branch-1')
    expect(insertPayload.status).toBe('RESERVED')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/fleet')
  })

  it('marks assets as rented when a booking becomes active', async () => {
    mocks.prisma.fleet_bookings.findFirst.mockResolvedValue({
      id: 'booking-1',
      branch_id: 'branch-1',
      asset_id: 'asset-1',
      status: 'RESERVED',
    })

    const result = await updateBookingStatus('org-1', 'booking-1', 'asset-1', 'ACTIVE')
    const assetUpdate = mocks.prisma.fleet_assets.updateMany.mock.calls[0]?.[0]

    expect(result).toEqual({ success: true })
    expect(assetUpdate.data.status).toBe('RENTED')
  })

  it('creates schedules with SCHEDULED status', async () => {
    mocks.prisma.fleet_assets.findFirst.mockResolvedValue({
      id: 'asset-1',
      branch_id: 'branch-1',
      status: 'AVAILABLE',
    })
    mocks.prisma.fleet_routes.findFirst.mockResolvedValue({
      id: 'route-1',
      branch_id: 'branch-1',
    })
    mocks.prisma.employees.findFirst
      .mockResolvedValueOnce({
        id: 'driver-1',
        branch_id: 'branch-1',
      })
      .mockResolvedValueOnce({
        id: 'helper-1',
        branch_id: 'branch-1',
      })

    const result = await createSchedule('org-1', buildScheduleForm())
    const payload = mocks.prisma.fleet_schedules.create.mock.calls[0]?.[0]?.data as Record<string, any>

    expect(result).toEqual({ success: true })
    expect(payload.branch_id).toBe('branch-1')
    expect(payload.status).toBe('SCHEDULED')
  })

  it('stores medical records through the atomic RPC path when available', async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 'user-1' },
    })
    mocks.prisma.fleet_assets.findFirst.mockResolvedValue({
      id: 'asset-1',
      status: 'AVAILABLE',
      branch_id: 'branch-1',
    })
    mocks.withDbUserContext.mockImplementation(async (_userId: string, action: (tx: any) => Promise<any>) => {
      return action({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 'medical-1' }]),
      })
    })

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
    expect(mocks.withDbUserContext).toHaveBeenCalled()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/fleet')
  })

  it('falls back safely when the maintenance RPC is not available', async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 'user-1' },
    })
    mocks.prisma.fleet_assets.findFirst
      .mockResolvedValueOnce({
        id: 'asset-1',
        status: 'AVAILABLE',
        branch_id: 'branch-1',
      })
      .mockResolvedValueOnce({
        status: 'AVAILABLE',
      })
    mocks.withDbUserContext.mockRejectedValue(Object.assign(new Error('Function not found'), { code: '42883' }))
    mocks.prisma.fleet_maintenance_labs.create.mockRejectedValue(new Error('Insert maintenance failed'))

    const result = await createMedicalRecord('org-1', {
      asset_id: 'asset-1',
      service_date: '2026-04-01',
      description: 'Servis besar',
      maintenance_type: 'CORRECTIVE',
      cost: 1000000,
      odometer_at: 200000,
    })

    const assetUpdates = mocks.prisma.fleet_assets.updateMany.mock.calls.map((call) => call[0]?.data)

    expect(result).toEqual({ error: 'Insert maintenance failed' })
    expect(assetUpdates).toEqual([
      { status: 'MAINTENANCE' },
      { status: 'AVAILABLE' },
    ])
  })

  it('checks asset availability using the same overlap rule as bookings', async () => {
    mocks.prisma.fleet_bookings.findFirst.mockResolvedValue({
      id: 'booking-1',
    })

    const result = await checkAssetAvailability('asset-1', '2026-04-01T08:00:00.000Z', '2026-04-02T08:00:00.000Z')

    expect(result).toEqual({ available: false })
  })

  it('updates clock-out attendance and appends notes', async () => {
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'employee-1',
      branch_id: 'branch-1',
    })
    mocks.prisma.attendance.findUnique.mockResolvedValue({
      id: 'attendance-1',
      check_out: null,
      notes: 'Berangkat pool',
    })

    const result = await recordCrewAttendance('org-1', {
      employee_id: 'employee-1',
      type: 'OUT',
      notes: 'Selesai shift',
    })
    const payload = mocks.prisma.attendance.updateMany.mock.calls[0]?.[0]?.data as Record<string, string>

    expect(result).toEqual({ success: true })
    expect(payload.notes).toBe('Berangkat pool | Selesai shift')
  })
})
