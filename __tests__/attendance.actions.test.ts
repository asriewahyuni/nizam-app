import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    attendance: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    employees: {
      findFirst: vi.fn(),
    },
  },
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import {
  getAttendanceRecords,
  upsertAttendanceRecord,
} from '@/modules/hris/actions/attendance.actions'

function buildAttendanceForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('employee_id', overrides.employee_id || 'emp-1')
  formData.set('record_date', overrides.record_date || '2026-04-03')
  formData.set('status', overrides.status || 'PRESENT')
  formData.set('check_in', overrides.check_in || '2026-04-03T08:00')
  formData.set('check_out', overrides.check_out || '2026-04-03T17:00')
  formData.set('notes', overrides.notes || 'Tepat waktu')
  return formData
}

describe('Attendance Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters attendance records by resolved branch selection', async () => {
    mocks.prisma.attendance.findMany.mockResolvedValue([])
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    await getAttendanceRecords('org-1')

    const findManyArgs = mocks.prisma.attendance.findMany.mock.calls[0]?.[0]
    expect(findManyArgs.where.branch_id).toBe('branch-1')
  })

  it('derives branch_id from employee when creating an attendance record', async () => {
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-1',
      branch_id: 'branch-2',
    })
    mocks.prisma.attendance.findFirst.mockResolvedValue(null)
    mocks.prisma.attendance.create.mockResolvedValue({ id: 'att-1' })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-2'] },
      branchId: 'branch-2',
    })

    const result = await upsertAttendanceRecord('org-1', buildAttendanceForm())
    const insertPayload = mocks.prisma.attendance.create.mock.calls[0]?.[0]?.data as Record<string, any>

    expect(result).toEqual({ success: true })
    expect(insertPayload.branch_id).toBe('branch-2')
    expect(insertPayload.status).toBe('PRESENT')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/hris')
  })

  it('updates an existing attendance record only inside its own branch', async () => {
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-1',
      branch_id: 'branch-3',
    })
    mocks.prisma.attendance.findFirst.mockResolvedValue({
      id: 'att-1',
    })
    mocks.prisma.attendance.updateMany.mockResolvedValue({ count: 1 })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-3'] },
      branchId: 'branch-3',
    })

    const result = await upsertAttendanceRecord('org-1', buildAttendanceForm({ status: 'LATE' }))
    const updateWhere = mocks.prisma.attendance.updateMany.mock.calls[0]?.[0]?.where

    expect(result).toEqual({ success: true })
    expect(updateWhere.branch_id).toBe('branch-3')
  })
})
