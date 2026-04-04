import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { createBankAccount, createBankTransaction, deleteBankTransaction, getRecentBankTransactions } from '@/modules/cash/actions/bank.actions'

describe('Cash & Bank Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stamps active branch when creating a bank account', async () => {
    const insertMock = vi.fn().mockResolvedValue({
      error: null,
    })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: {
        accessibleBranches: [],
        accessibleBranchIds: ['branch-1'],
        canAccessAllBranches: false,
        membershipId: 'member-1',
        role: 'owner',
      },
      branchId: 'branch-1',
    })

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'bank_accounts') throw new Error(`Unexpected table ${table}`)
        return { insert: insertMock }
      }),
    })

    const formData = new FormData()
    formData.set('account_id', 'acc-1')
    formData.set('bank_name', 'BCA Unit A')
    formData.set('account_number', '1234567890')
    formData.set('currency', 'IDR')

    const result = await createBankAccount('org-1', formData)

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        account_id: 'acc-1',
        bank_name: 'BCA Unit A',
      })
    )
    expect(result).toEqual({ success: true })
  })

  it('rejects bank transactions when selected bank account is outside the active branch', async () => {
    const bankAccountQuery = {
      select: vi.fn(() => bankAccountQuery),
      eq: vi.fn(() => bankAccountQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'bank-1', branch_id: 'branch-2' },
        error: null,
      }),
    }

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: {
        accessibleBranches: [],
        accessibleBranchIds: ['branch-1'],
        canAccessAllBranches: false,
        membershipId: 'member-1',
        role: 'staff',
      },
      branchId: 'branch-1',
    })

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'bank_accounts') throw new Error(`Unexpected table ${table}`)
        return bankAccountQuery
      }),
    })

    const formData = new FormData()
    formData.set('bank_account_id', 'bank-1')
    formData.set('transaction_date', '2026-04-03')
    formData.set('description', 'Pengeluaran unit lain')
    formData.set('amount', '10000')
    formData.set('type', 'OUT')
    formData.set('category_id', 'acc-2')

    const result = await createBankTransaction('org-1', formData)

    expect(result).toEqual({
      error: 'Rekening kas/bank tersebut tidak tersedia pada unit aktif.',
    })
  })

  it('filters recent bank transactions strictly by branch when requested', async () => {
    const txQuery = {
      select: vi.fn(() => txQuery),
      eq: vi.fn(() => txQuery),
      order: vi.fn(() => txQuery),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: 'tx-1', branch_id: 'branch-1' }],
        error: null,
      }),
    }

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: {
        accessibleBranches: [],
        accessibleBranchIds: ['branch-1'],
        canAccessAllBranches: false,
        membershipId: 'member-1',
        role: 'staff',
      },
      branchId: 'branch-1',
    })

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'bank_transactions') throw new Error(`Unexpected table ${table}`)
        return txQuery
      }),
    })

    const result = await getRecentBankTransactions('org-1', 20, 'branch-1')

    expect(txQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    expect(result).toEqual([{ id: 'tx-1', branch_id: 'branch-1' }])
  })

  it('voids bank transactions instead of deleting the source record', async () => {
    const txLookup = {
      select: vi.fn(() => txLookup),
      eq: vi.fn(() => txLookup),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'tx-1',
          journal_entry_id: 'je-1',
          branch_id: 'branch-1',
          status: 'POSTED',
        },
        error: null,
      }),
    }
    const txUpdateEq = vi.fn(() => txUpdate)
    const txUpdate = {
      eq: txUpdateEq,
    }
    const journalUpdateEq = vi.fn(() => journalUpdate)
    const journalUpdate = {
      eq: journalUpdateEq,
    }

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: {
        accessibleBranches: [],
        accessibleBranchIds: ['branch-1'],
        canAccessAllBranches: false,
        membershipId: 'member-1',
        role: 'owner',
      },
      branchId: 'branch-1',
    })

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'bank_transactions') {
          return {
            select: vi.fn(() => txLookup),
            update: vi.fn(() => txUpdate),
          }
        }
        if (table === 'journal_entries') {
          return {
            update: vi.fn(() => journalUpdate),
          }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await deleteBankTransaction('org-1', 'tx-1')

    expect(result).toEqual({ success: true })
    expect(journalUpdateEq).toHaveBeenCalledWith('org_id', 'org-1')
    expect(txUpdateEq).toHaveBeenCalledWith('org_id', 'org-1')
  })
})
