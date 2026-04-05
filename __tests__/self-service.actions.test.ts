import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    employees: {
      findFirst: vi.fn(),
    },
    attendance: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    leave_requests: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    expense_claims: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    approval_requests: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  auth: vi.fn(),
  revalidatePath: vi.fn(),
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

import {
  cancelMyLeaveRequest,
  clockMyAttendance,
  deleteMyExpenseClaim,
  getMyAttendanceRecords,
  getMyExpenseClaims,
  getMyLeaveRequests,
  submitMyExpenseClaim,
  submitMyLeaveRequest,
} from '@/modules/hris/actions/self-service.actions'

function buildLeaveForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('leave_type', overrides.leave_type || 'Annual Leave')
  formData.set('start_date', overrides.start_date || '2026-04-10')
  formData.set('end_date', overrides.end_date || '2026-04-12')
  formData.set('reason', overrides.reason || 'Acara keluarga')
  return formData
}

function buildExpenseForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('claim_date', overrides.claim_date || '2026-04-11')
  formData.set('category', overrides.category || 'Transport')
  formData.set('amount', overrides.amount || '185000')
  formData.set('description', overrides.description || 'Taksi meeting klien')
  if (overrides.receipt_url) {
    formData.set('receipt_url', overrides.receipt_url)
  }
  return formData
}

describe('Employee Self Service Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads only the current employee attendance records', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-1',
      branch_id: 'branch-1',
      first_name: 'Nadia',
      last_name: 'Putri',
      job_title: 'Staff',
      nik: 'EMP-001',
    })
    mocks.prisma.attendance.findMany.mockResolvedValue([])

    await getMyAttendanceRecords('org-1')

    const findManyArgs = mocks.prisma.attendance.findMany.mock.calls[0]?.[0]
    expect(findManyArgs.where.employee_id).toBe('emp-1')
  })

  it('creates a self attendance clock-in with the employee branch', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-1',
      branch_id: 'branch-2',
      first_name: 'Nadia',
      last_name: 'Putri',
      job_title: 'Staff',
      nik: 'EMP-001',
    })
    mocks.prisma.attendance.findFirst.mockResolvedValue(null)
    mocks.prisma.attendance.create.mockResolvedValue({ id: 'att-1' })

    const result = await clockMyAttendance('org-1', { type: 'IN', notes: 'On site' })
    const insertPayload = mocks.prisma.attendance.create.mock.calls[0]?.[0]?.data as Record<string, any>

    expect(result).toEqual({ success: true })
    expect(insertPayload.employee_id).toBe('emp-1')
    expect(insertPayload.branch_id).toBe('branch-2')
    expect(insertPayload.status).toBe('PRESENT')
  })

  it('updates the current employee attendance on clock-out', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-1',
      branch_id: 'branch-2',
      first_name: 'Nadia',
      last_name: 'Putri',
      job_title: 'Staff',
      nik: 'EMP-001',
    })
    mocks.prisma.attendance.findFirst.mockResolvedValue({
      id: 'att-1',
      status: 'PRESENT',
      check_out: null,
      notes: 'On site',
    })
    mocks.prisma.attendance.updateMany.mockResolvedValue({ count: 1 })

    const result = await clockMyAttendance('org-1', { type: 'OUT', notes: 'Selesai shift' })
    const updateWhere = mocks.prisma.attendance.updateMany.mock.calls[0]?.[0]?.where

    expect(result).toEqual({ success: true })
    expect(updateWhere.employee_id).toBe('emp-1')
  })

  it('loads only the current employee leave requests', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-2',
      branch_id: 'branch-3',
      first_name: 'Rafi',
      last_name: 'Aulia',
      job_title: 'Admin',
      nik: 'EMP-002',
    })
    mocks.prisma.leave_requests.findMany.mockResolvedValue([])

    await getMyLeaveRequests('org-1')

    const findManyArgs = mocks.prisma.leave_requests.findMany.mock.calls[0]?.[0]
    expect(findManyArgs.where.employee_id).toBe('emp-2')
  })

  it('submits a leave request for the current employee only', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-2',
      branch_id: 'branch-3',
      first_name: 'Rafi',
      last_name: 'Aulia',
      job_title: 'Admin',
      nik: 'EMP-002',
    })
    const tx = {
      leave_requests: { create: vi.fn().mockResolvedValue({ id: 'leave-1' }) },
      approval_requests: { create: vi.fn().mockResolvedValue({ id: 'approval-1' }) },
    }
    mocks.prisma.$transaction.mockImplementation(async (fn: any) => fn(tx))

    const result = await submitMyLeaveRequest('org-1', buildLeaveForm())
    const insertPayload = tx.leave_requests.create.mock.calls[0]?.[0]?.data as Record<string, any>
    const approvalPayload = tx.approval_requests.create.mock.calls[0]?.[0]?.data as Record<string, any>

    expect(result).toEqual({ success: true })
    expect(insertPayload.employee_id).toBe('emp-2')
    expect(insertPayload.branch_id).toBe('branch-3')
    expect(insertPayload.days_taken).toBe(3)
    expect(approvalPayload.source_type).toBe('LEAVE_REQUEST')
    expect(approvalPayload.source_id).toBe('leave-1')
    expect(approvalPayload.requester_id).toBe('user-1')
  })

  it('loads only the current employee expense claims', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-3',
      branch_id: 'branch-4',
      first_name: 'Alya',
      last_name: 'Sari',
      job_title: 'Sales',
      nik: 'EMP-003',
    })
    mocks.prisma.expense_claims.findMany.mockResolvedValue([])

    await getMyExpenseClaims('org-1')

    const findManyArgs = mocks.prisma.expense_claims.findMany.mock.calls[0]?.[0]
    expect(findManyArgs.where.employee_id).toBe('emp-3')
  })

  it('submits an expense claim for the current employee only', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-3',
      branch_id: 'branch-4',
      first_name: 'Alya',
      last_name: 'Sari',
      job_title: 'Sales',
      nik: 'EMP-003',
    })
    mocks.prisma.expense_claims.create.mockResolvedValue({ id: 'claim-new' })

    const result = await submitMyExpenseClaim('org-1', buildExpenseForm({ receipt_url: 'https://example.com/nota.jpg' }))
    const insertPayload = mocks.prisma.expense_claims.create.mock.calls[0]?.[0]?.data as Record<string, any>

    expect(result).toEqual({ success: true })
    expect(insertPayload.employee_id).toBe('emp-3')
    expect(insertPayload.branch_id).toBe('branch-4')
    expect(insertPayload.receipt_url).toBe('https://example.com/nota.jpg')
  })

  it('deletes only the current employee pending or rejected expense claims', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-3',
      branch_id: 'branch-4',
      first_name: 'Alya',
      last_name: 'Sari',
      job_title: 'Sales',
      nik: 'EMP-003',
    })
    mocks.prisma.expense_claims.findFirst.mockResolvedValue({
      id: 'claim-1',
      status: 'PENDING',
    })
    mocks.prisma.expense_claims.deleteMany.mockResolvedValue({ count: 1 })

    const result = await deleteMyExpenseClaim('org-1', 'claim-1')
    const deleteWhere = mocks.prisma.expense_claims.deleteMany.mock.calls[0]?.[0]?.where

    expect(result).toEqual({ success: true })
    expect(deleteWhere.employee_id).toBe('emp-3')
  })

  it('cancels only the current employee pending leave request', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.employees.findFirst.mockResolvedValue({
      id: 'emp-2',
      branch_id: 'branch-3',
      first_name: 'Rafi',
      last_name: 'Aulia',
      job_title: 'Admin',
      nik: 'EMP-002',
    })
    mocks.prisma.leave_requests.findFirst.mockResolvedValue({
      id: 'leave-1',
      status: 'PENDING',
    })
    const tx = {
      leave_requests: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      approval_requests: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }
    mocks.prisma.$transaction.mockImplementation(async (fn: any) => fn(tx))

    const result = await cancelMyLeaveRequest('org-1', 'leave-1')
    const leaveUpdateWhere = tx.leave_requests.updateMany.mock.calls[0]?.[0]?.where
    const approvalUpdateWhere = tx.approval_requests.updateMany.mock.calls[0]?.[0]?.where

    expect(result).toEqual({ success: true })
    expect(leaveUpdateWhere.employee_id).toBe('emp-2')
    expect(approvalUpdateWhere.branch_id).toBe('branch-3')
  })
})
