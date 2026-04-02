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
    const supabase = createSupabaseMock({
      tables: {
        payroll_runs: [
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

    await getPayrollRuns('org-1')

    const branchFilter = supabase.calls[0]?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )
    expect(branchFilter?.args[1]).toBe('branch-1')
  })

  it('stamps branch_id and calls generation RPC when creating a payroll run', async () => {
    const supabase = createSupabaseMock({
      tables: {
        payroll_runs: [
          {
            singleResult: success({
              id: 'run-1',
            }),
          },
        ],
      },
      rpc: {
        generate_payslips_for_run: [success(1)],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await generatePayrollRun('org-1', buildPayrollRunForm())
    const insertPayload = supabase.calls[0]?.operations.find((operation) => operation.method === 'insert')?.args[0] as Record<string, string>

    expect(result).toEqual({ success: true })
    expect(insertPayload.branch_id).toBe('branch-1')
    expect(supabase.rpcCalls).toEqual([
      {
        fn: 'generate_payslips_for_run',
        args: { p_run_id: 'run-1' },
      },
    ])
  })

  it('checks run branch before paying payroll', async () => {
    const supabase = createSupabaseMock({
      tables: {
        payroll_runs: [
          {
            maybeSingleResult: success({
              id: 'run-1',
              branch_id: 'branch-2',
            }),
          },
          {
            result: success([]),
          },
        ],
      },
      rpc: {
        process_payroll_payment: [success('je-1')],
      },
    })

    mocks.createClient.mockResolvedValue({
      ...supabase.client,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
    })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-2'] },
      branchId: 'branch-2',
    })

    const result = await payPayrollRun('run-1', 'org-1', 'acc-bank')
    const branchFilter = supabase.calls[1]?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )

    expect(result).toEqual({ success: true })
    expect(branchFilter?.args[1]).toBe('branch-2')
  })

  it('filters payroll run details by accessible branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        payroll_runs: [
          {
            maybeSingleResult: success({
              id: 'run-1',
              branch_id: 'branch-1',
            }),
          },
        ],
        payslips: [
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

    await getPayrollRunDetails('org-1', 'run-1')

    const branchFilter = supabase.calls[1]?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )
    expect(branchFilter?.args[1]).toBe('branch-1')
  })

  it('scopes delete and void operations to the run branch', async () => {
    const deleteSupabase = createSupabaseMock({
      tables: {
        payroll_runs: [
          {
            maybeSingleResult: success({
              id: 'run-1',
              branch_id: 'branch-1',
            }),
          },
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValueOnce(deleteSupabase.client)
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const deleteResult = await deletePayrollRun('run-1', 'org-1')
    const deleteBranchFilter = deleteSupabase.calls[1]?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )

    expect(deleteResult).toEqual({ success: true })
    expect(deleteBranchFilter?.args[1]).toBe('branch-1')

    const voidSupabase = createSupabaseMock({
      tables: {
        payroll_runs: [
          {
            maybeSingleResult: success({
              id: 'run-2',
              branch_id: 'branch-1',
            }),
          },
        ],
      },
      rpc: {
        void_payroll_run: [success(null)],
      },
    })

    mocks.createClient.mockResolvedValueOnce(voidSupabase.client)

    const voidResult = await voidPayrollRun('run-2', 'org-1')

    expect(voidResult).toEqual({ success: true })
    expect(voidSupabase.rpcCalls).toEqual([
      {
        fn: 'void_payroll_run',
        args: { p_run_id: 'run-2' },
      },
    ])
  })
})
