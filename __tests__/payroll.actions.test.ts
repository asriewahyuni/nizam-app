import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    payroll_runs: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    payslips: {
      findMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
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

import {
  deletePayrollRun,
  generatePayrollRun,
  getPayrollRunDetails,
  getPayrollRuns,
  payPayrollRun,
  voidPayrollRun,
} from '@/modules/hris/actions/payroll.actions'

function buildPayrollRunForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('period_start', overrides.period_start || '2026-04-01')
  formData.set('period_end', overrides.period_end || '2026-04-30')
  formData.set('payment_date', overrides.payment_date || '2026-04-30')
  return formData
}

describe('Payroll Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters payroll runs by resolved branch selection', async () => {
    mocks.prisma.payroll_runs.findMany.mockResolvedValue([])
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    await getPayrollRuns('org-1')

    const findManyArgs = mocks.prisma.payroll_runs.findMany.mock.calls[0]?.[0]
    expect(findManyArgs.where.branch_id).toBe('branch-1')
  })

  it('stamps branch_id and calls generation RPC when creating a payroll run', async () => {
    mocks.prisma.payroll_runs.create.mockResolvedValue({ id: 'run-1' })
    mocks.prisma.$executeRaw.mockResolvedValue(1)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await generatePayrollRun('org-1', buildPayrollRunForm())
    const insertPayload = mocks.prisma.payroll_runs.create.mock.calls[0]?.[0]?.data as Record<string, any>

    expect(result).toEqual({ success: true })
    expect(insertPayload.branch_id).toBe('branch-1')
    expect(mocks.prisma.$executeRaw).toHaveBeenCalled()
  })

  it('checks run branch before paying payroll', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.prisma.payroll_runs.findFirst.mockResolvedValue({
      id: 'run-1',
      branch_id: 'branch-2',
    })
    mocks.prisma.payroll_runs.updateMany.mockResolvedValue({ count: 1 })
    mocks.prisma.$executeRaw.mockResolvedValue(1)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-2'] },
      branchId: 'branch-2',
    })

    const result = await payPayrollRun('run-1', 'org-1', 'acc-bank')
    const updateWhere = mocks.prisma.payroll_runs.updateMany.mock.calls[0]?.[0]?.where

    expect(result).toEqual({ success: true })
    expect(updateWhere.branch_id).toBe('branch-2')
  })

  it('filters payroll run details by accessible branch', async () => {
    mocks.prisma.payroll_runs.findFirst.mockResolvedValue({
      id: 'run-1',
      branch_id: 'branch-1',
    })
    mocks.prisma.payslips.findMany.mockResolvedValue([])
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    await getPayrollRunDetails('org-1', 'run-1')

    const findManyArgs = mocks.prisma.payslips.findMany.mock.calls[0]?.[0]
    expect(findManyArgs.where.branch_id).toBe('branch-1')
  })

  it('scopes delete and void operations to the run branch', async () => {
    mocks.prisma.payroll_runs.findFirst.mockResolvedValue({
      id: 'run-1',
      branch_id: 'branch-1',
    })
    mocks.prisma.payroll_runs.deleteMany.mockResolvedValue({ count: 1 })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const deleteResult = await deletePayrollRun('run-1', 'org-1')
    const deleteWhere = mocks.prisma.payroll_runs.deleteMany.mock.calls[0]?.[0]?.where

    expect(deleteResult).toEqual({ success: true })
    expect(deleteWhere.branch_id).toBe('branch-1')

    mocks.prisma.payroll_runs.findFirst.mockResolvedValue({
      id: 'run-2',
      branch_id: 'branch-1',
    })
    mocks.prisma.$executeRaw.mockResolvedValue(1)

    const voidResult = await voidPayrollRun('run-2', 'org-1')

    expect(voidResult).toEqual({ success: true })
    expect(mocks.prisma.$executeRaw).toHaveBeenCalled()
  })
})
