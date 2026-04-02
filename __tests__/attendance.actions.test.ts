import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

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
    const supabase = createSupabaseMock({
      tables: {
        attendance: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    await getAttendanceRecords('org-1')

    const branchFilter = supabase.calls[0]?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )
    expect(branchFilter?.args[1]).toBe('branch-1')
  })

  it('derives branch_id from employee when creating an attendance record', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-1',
              branch_id: 'branch-2',
            }),
          },
        ],
        attendance: [
          {
            maybeSingleResult: success(null),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-2'] },
      branchId: 'branch-2',
    })

    const result = await upsertAttendanceRecord('org-1', buildAttendanceForm())
    const insertPayload = supabase.calls[2]?.operations.find((operation) => operation.method === 'insert')?.args[0] as Record<string, string>

    expect(result).toEqual({ success: true })
    expect(insertPayload.branch_id).toBe('branch-2')
    expect(insertPayload.status).toBe('PRESENT')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/hris')
  })

  it('updates an existing attendance record only inside its own branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        employees: [
          {
            maybeSingleResult: success({
              id: 'emp-1',
              branch_id: 'branch-3',
            }),
          },
        ],
        attendance: [
          {
            maybeSingleResult: success({
              id: 'att-1',
            }),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-3'] },
      branchId: 'branch-3',
    })

    const result = await upsertAttendanceRecord('org-1', buildAttendanceForm({ status: 'LATE' }))
    const updateCall = supabase.calls[2]
    const branchFilter = updateCall?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )

    expect(result).toEqual({ success: true })
    expect(updateCall?.operations.some((operation) => operation.method === 'update')).toBe(true)
    expect(branchFilter?.args[1]).toBe('branch-3')
  })
})
