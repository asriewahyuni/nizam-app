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
  getBudgets,
  getBudgetVsActual,
  saveBudget,
} from '@/modules/accounting/actions/budget.actions'

describe('Budget Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters budget rows by the active branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        budgets: [
          {
            result: success([]),
          },
        ],
      },
    })

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
    mocks.createClient.mockResolvedValue(supabase.client)

    await getBudgets('org-1', '2026-04-01', 'branch-1')

    expect(supabase.calls[0]?.table).toBe('budgets')
    expect(supabase.calls[0]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
        expect.objectContaining({ method: 'eq', args: ['period', '2026-04-01'] }),
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )
  })

  it('stamps branch_id when saving a budget', async () => {
    const supabase = createSupabaseMock({
      tables: {
        budgets: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: {
        accessibleBranches: [],
        accessibleBranchIds: ['branch-1'],
        canAccessAllBranches: false,
        membershipId: 'member-1',
        role: 'admin',
      },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await saveBudget('org-1', 'acc-1', '2026-04-01', 1500000)

    expect(result).toEqual({ success: true, branchId: 'branch-1' })
    expect(supabase.calls[0]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'upsert',
          args: [
            expect.objectContaining({
              org_id: 'org-1',
              branch_id: 'branch-1',
              account_id: 'acc-1',
              period: '2026-04-01',
              budget_amount: 1500000,
            }),
            expect.objectContaining({
              onConflict: 'org_id,branch_id,account_id,period',
            }),
          ],
        }),
      ])
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/accounting/budgets')
  })

  it('filters budget vs actual calculation by the active branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            result: success([
              {
                id: 'acc-revenue',
                code: '4001',
                name: 'Penjualan',
                type: 'REVENUE',
                normal_balance: 'CREDIT',
              },
            ]),
          },
        ],
        budgets: [
          {
            result: success([
              {
                account_id: 'acc-revenue',
                budget_amount: 2000000,
              },
            ]),
          },
        ],
        journal_entries: [
          {
            result: success([{ id: 'je-1' }]),
          },
        ],
        journal_lines: [
          {
            result: success([
              {
                account_id: 'acc-revenue',
                debit: 0,
                credit: 2500000,
              },
            ]),
          },
        ],
      },
    })

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
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getBudgetVsActual('org-1', '2026-04-01', '2026-04-30', 'branch-1')

    expect(result).toEqual([
      expect.objectContaining({
        account_id: 'acc-revenue',
        budget_amount: 2000000,
        actual_amount: 2500000,
        variance: 500000,
      }),
    ])

    const budgetCall = supabase.calls.find((call) => call.table === 'budgets')
    expect(budgetCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )

    const entryCall = supabase.calls.find((call) => call.table === 'journal_entries')
    expect(entryCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )
  })
})
