import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock } from './helpers/supabase-mock'

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

import { getBSCMetrics } from '@/modules/accounting/actions/bsc.actions'

describe('BSC Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: {
        accessibleBranches: [],
        accessibleBranchIds: ['branch-1'],
        canAccessAllBranches: false,
        membershipId: 'member-1',
        role: 'manager',
      },
      branchId: 'branch-1',
    })
  })

  it('scopes BSC metrics to the active branch across all underlying modules', async () => {
    const supabase = createSupabaseMock({
      tables: {
        journal_entries: [
          {
            result: { data: [{ id: 'je-current' }], error: null },
          },
          {
            result: { data: [{ id: 'je-last' }], error: null },
          },
        ],
        journal_lines: [
          {
            result: {
              data: [
                {
                  debit: 0,
                  credit: 250000,
                  accounts: { type: 'REVENUE', code: '4001' },
                },
                {
                  debit: 50000,
                  credit: 0,
                  accounts: { type: 'EXPENSE', code: '5001' },
                },
              ],
              error: null,
            },
          },
          {
            result: {
              data: [
                {
                  debit: 0,
                  credit: 100000,
                  accounts: { type: 'REVENUE', code: '4001' },
                },
              ],
              error: null,
            },
          },
        ],
        sales: [
          {
            result: { data: [{ id: 'sale-1', grand_total: 250000, status: 'FINISHED', customer_id: 'cust-1' }], error: null },
          },
          {
            result: { data: null, error: null, count: 2 } as unknown as { data: null; error: null },
          },
        ],
        purchases: [
          {
            result: { data: null, error: null, count: 1 } as unknown as { data: null; error: null },
          },
        ],
        fixed_assets: [
          {
            result: { data: null, error: null, count: 3 } as unknown as { data: null; error: null },
          },
          {
            result: { data: null, error: null, count: 1 } as unknown as { data: null; error: null },
          },
        ],
        employees: [
          {
            result: { data: null, error: null, count: 5 } as unknown as { data: null; error: null },
          },
        ],
        payroll_runs: [
          {
            result: { data: null, error: null, count: 1 } as unknown as { data: null; error: null },
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getBSCMetrics('org-1', 'branch-1')

    expect(result.financial.currentRevenue).toBe(250000)
    expect(result.financial.currentExpenses).toBe(50000)
    expect(result.customer.totalOrders).toBe(1)
    expect(result.internal.pendingPurchases).toBe(1)
    expect(result.internal.pendingSales).toBe(2)
    expect(result.internal.totalAssets).toBe(3)
    expect(result.learning.activeEmployees).toBe(5)
    expect(result.learning.payrollRunsCompleted).toBe(1)

    const branchScopedTables = ['journal_entries', 'sales', 'purchases', 'fixed_assets', 'employees', 'payroll_runs']
    branchScopedTables.forEach((table) => {
      const calls = supabase.calls.filter((call) => call.table === table)
      expect(calls.length).toBeGreaterThan(0)
      calls.forEach((call) => {
        expect(call.operations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
          ])
        )
      })
    })
  })
})
