import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  checkCanManageCoA: vi.fn(),
  nudgeEduModeValidation: vi.fn(),
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

vi.mock('@/modules/accounting/actions/coa.actions', () => ({
  checkCanManageCoA: mocks.checkCanManageCoA,
}))

vi.mock('@/modules/edu/lib/progress-hooks.server', () => ({
  nudgeEduModeValidation: mocks.nudgeEduModeValidation,
}))

import {
  createBankAccount,
  createBankTransaction,
  createInterOrgCapitalTransfer,
  deleteBankTransaction,
  getRecentBankTransactions,
} from '@/modules/cash/actions/bank.actions'

describe('Cash & Bank Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.checkCanManageCoA.mockResolvedValue({ canManageDirect: true })
    mocks.nudgeEduModeValidation.mockResolvedValue(undefined)
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
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'org_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { role: 'owner', role_id: null },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'employees') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role_id: null },
                    error: null,
                  }),
                })),
              })),
            })),
          }
        }
        if (table === 'bank_accounts') return { insert: insertMock }
        throw new Error(`Unexpected table ${table}`)
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

  it('rejects cross-org account placement when role has no Kas & Bank access', async () => {
    const insertMock = vi.fn().mockResolvedValue({
      error: null,
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

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'org_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { role: 'manager', role_id: 'role-1' },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'roles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { permissions: ['journal:read'] },
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === 'bank_accounts') return { insert: insertMock }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const formData = new FormData()
    formData.set('account_id', 'acc-1')
    formData.set('bank_name', 'BCA Anak')
    formData.set('target_org_branch', 'child-org|branch-2')

    const result = await createBankAccount('org-1', formData)

    expect(result).toEqual({
      error:
        'Role ini belum punya akses Kas & Bank, jadi tidak bisa memilih penempatan rekening lintas organisasi & unit.',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('allows cross-org account placement when role has Kas & Bank access', async () => {
    const insertMock = vi.fn().mockResolvedValue({
      error: null,
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

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'org_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { role: 'manager', role_id: 'role-1' },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'roles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { permissions: ['bank:read'] },
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === 'bank_accounts') return { insert: insertMock }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const formData = new FormData()
    formData.set('account_id', 'acc-1')
    formData.set('bank_name', 'BCA Anak')
    formData.set('target_org_branch', 'child-org|branch-2')

    const result = await createBankAccount('org-1', formData)

    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'child-org',
        branch_id: 'branch-2',
      })
    )
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

  it('creates inter-org capital transfer through RPC', async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [{ source_transaction_id: 'tx-out-1', target_transaction_id: 'tx-in-1' }],
      error: null,
    })
    const accountQuery = {
      select: vi.fn(() => accountQuery),
      eq: vi.fn(() => accountQuery),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({
          data: {
            id: 'acc-source-counter',
            code: '1601',
            name: 'Investasi pada Entitas Anak / Unit',
            type: 'ASSET',
            cash_flow_category: 'INVESTING',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'acc-target-counter',
            code: '3001',
            name: 'Modal Disetor',
            type: 'EQUITY',
            cash_flow_category: 'FINANCING',
          },
          error: null,
        }),
    }

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'accounts') throw new Error(`Unexpected table ${table}`)
        return accountQuery
      }),
      rpc: rpcMock,
    })

    const formData = new FormData()
    formData.set('bank_account_id', 'bank-source')
    formData.set('target_bank_account_id', 'bank-target')
    formData.set('source_counter_account_id', 'acc-source-counter')
    formData.set('target_counter_account_id', 'acc-target-counter')
    formData.set('transaction_date', '2026-04-06')
    formData.set('description', 'Transfer modal ke anak usaha')
    formData.set('amount', '2500000')

    const result = await createInterOrgCapitalTransfer('org-parent', formData)

    expect(rpcMock).toHaveBeenCalledWith('create_interorg_capital_transfer', {
      p_source_org_id: 'org-parent',
      p_source_bank_account_id: 'bank-source',
      p_source_counter_account_id: 'acc-source-counter',
      p_target_bank_account_id: 'bank-target',
      p_target_counter_account_id: 'acc-target-counter',
      p_transaction_date: '2026-04-06',
      p_amount: 2500000,
      p_description: 'Transfer modal ke anak usaha',
      p_reference_number: null,
    })
    expect(result).toEqual({
      success: true,
      data: [{ source_transaction_id: 'tx-out-1', target_transaction_id: 'tx-in-1' }],
    })
  })

  it('rejects inter-org capital transfer when source account is not an investing account', async () => {
    const rpcMock = vi.fn()
    const accountQuery = {
      select: vi.fn(() => accountQuery),
      eq: vi.fn(() => accountQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'acc-source-counter',
          code: '1103',
          name: 'Bank - Rekening Operasional',
          type: 'ASSET',
          cash_flow_category: null,
        },
        error: null,
      }),
    }

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'accounts') throw new Error(`Unexpected table ${table}`)
        return accountQuery
      }),
      rpc: rpcMock,
    })

    const formData = new FormData()
    formData.set('bank_account_id', 'bank-source')
    formData.set('target_bank_account_id', 'bank-target')
    formData.set('source_counter_account_id', 'acc-source-counter')
    formData.set('target_counter_account_id', 'acc-target-counter')
    formData.set('transaction_date', '2026-04-06')
    formData.set('description', 'Transfer modal ke anak usaha')
    formData.set('amount', '2500000')

    const result = await createInterOrgCapitalTransfer('org-parent', formData)

    expect(result).toEqual({
      error: 'Akun lawan parent harus akun investasi (kelompok 16xx), misalnya 1601 Investasi pada Entitas Anak / Unit.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('rejects inter-org capital transfer when target account is not a financing account', async () => {
    const rpcMock = vi.fn()
    const accountQuery = {
      select: vi.fn(() => accountQuery),
      eq: vi.fn(() => accountQuery),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({
          data: {
            id: 'acc-source-counter',
            code: '1601',
            name: 'Investasi pada Entitas Anak / Unit',
            type: 'ASSET',
            cash_flow_category: 'INVESTING',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'acc-target-counter',
            code: '2101',
            name: 'Hutang Usaha',
            type: 'LIABILITY',
            cash_flow_category: 'OPERATING',
          },
          error: null,
        }),
    }

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'accounts') throw new Error(`Unexpected table ${table}`)
        return accountQuery
      }),
      rpc: rpcMock,
    })

    const formData = new FormData()
    formData.set('bank_account_id', 'bank-source')
    formData.set('target_bank_account_id', 'bank-target')
    formData.set('source_counter_account_id', 'acc-source-counter')
    formData.set('target_counter_account_id', 'acc-target-counter')
    formData.set('transaction_date', '2026-04-06')
    formData.set('description', 'Transfer modal ke anak usaha')
    formData.set('amount', '2500000')

    const result = await createInterOrgCapitalTransfer('org-parent', formData)

    expect(result).toEqual({
      error: 'Akun lawan entitas tujuan harus akun pendanaan/modal (kelompok 25xx, 26xx, atau 3xxx), misalnya 3001 Modal Disetor.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
