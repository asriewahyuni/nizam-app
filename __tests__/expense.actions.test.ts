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
  approveExpenseClaim,
  createExpenseClaim,
  deleteExpenseClaim,
  getExpenseClaims,
} from '@/modules/hris/actions/expense.actions'

function buildExpenseForm(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.set('employee_id', overrides.employee_id || 'emp-1')
  formData.set('amount', overrides.amount || '125000')
  formData.set('category', overrides.category || 'Supplies')
  formData.set('description', overrides.description || 'Pembelian perlengkapan')
  formData.set('claim_date', overrides.claim_date || '2026-04-03')
  return formData
}

describe('Expense Claim Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters expense claims by resolved branch selection', async () => {
    const supabase = createSupabaseMock({
      tables: {
        expense_claims: [
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

    await getExpenseClaims('org-1')

    const branchFilter = supabase.calls[0]?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )
    expect(branchFilter?.args[1]).toBe('branch-1')
  })

  it('derives branch_id from employee when creating a claim', async () => {
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
        expense_claims: [
          {
            result: success([]),
          },
        ],
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

    const result = await createExpenseClaim('org-1', buildExpenseForm())
    const insertPayload = supabase.calls[1]?.operations.find((operation) => operation.method === 'insert')?.args[0] as Record<string, string>

    expect(result).toEqual({ success: true })
    expect(insertPayload.branch_id).toBe('branch-2')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/hris')
  })

  it('validates claim branch before approving', async () => {
    const supabase = createSupabaseMock({
      tables: {
        expense_claims: [
          {
            maybeSingleResult: success({
              id: 'claim-1',
              org_id: 'org-1',
              branch_id: 'branch-1',
            }),
          },
        ],
      },
      rpc: {
        process_expense_claim: [success('je-1')],
      },
    })

    mocks.createClient.mockResolvedValue({
      ...supabase.client,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'approver-1' } },
        }),
      },
    })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await approveExpenseClaim('claim-1', 'acc-exp', 'acc-payable')

    expect(result).toEqual({ success: true })
    expect(supabase.rpcCalls).toEqual([
      {
        fn: 'process_expense_claim',
        args: {
          p_claim_id: 'claim-1',
          p_approved_by: 'approver-1',
          p_expense_account_id: 'acc-exp',
          p_payable_account_id: 'acc-payable',
        },
      },
    ])
  })

  it('deletes claims only within the accessible branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        expense_claims: [
          {
            maybeSingleResult: success({
              id: 'claim-1',
              org_id: 'org-1',
              branch_id: 'branch-1',
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
      scope: { accessibleBranchIds: ['branch-1'] },
      branchId: 'branch-1',
    })

    const result = await deleteExpenseClaim('claim-1')
    const deleteCall = supabase.calls[1]
    const branchFilter = deleteCall?.operations.find(
      (operation) => operation.method === 'eq' && operation.args[0] === 'branch_id'
    )

    expect(result).toEqual({ success: true })
    expect(deleteCall?.operations.some((operation) => operation.method === 'delete')).toBe(true)
    expect(branchFilter?.args[1]).toBe('branch-1')
  })
})
