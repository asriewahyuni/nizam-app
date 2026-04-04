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

import { processBankCSV } from '@/modules/cash/actions/reconcile.actions'

describe('Bank Reconciliation CSV Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects empty CSV files with a clear validation error', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'bank_accounts') throw new Error(`Unexpected table ${table}`)
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'bank-1', branch_id: 'branch-1' },
                  error: null,
                }),
              })),
            })),
          })),
        }
      }),
    })

    const result = await processBankCSV('org-1', 'bank-1', '\n')

    expect(result).toEqual({ error: 'File CSV kosong.' })
  })

  it('parses quoted descriptions containing commas correctly', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'bank_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'bank-1', branch_id: 'branch-1' },
                    error: null,
                  }),
                })),
              })),
            })),
          }
        }
        if (table === 'bank_mutations') {
          return { insert: insertMock }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const csv = `date,description,amount,type,balance
2026-04-04,"TRANSFER, BIAYA ADMIN",-2500,OUT,997500`

    const result = await processBankCSV('org-1', 'bank-1', csv)

    expect(result).toEqual({ success: true, count: 1 })
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          mutation_date: '2026-04-04',
          description: 'TRANSFER, BIAYA ADMIN',
          amount: 2500,
          type: 'OUT',
          balance: 997500,
        }),
      ])
    )
  })

  it('supports DD/MM/YYYY dates from bank exports', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })

    mocks.resolveAccessibleBranchSelection.mockResolvedValue({
      scope: { accessibleBranches: [], accessibleBranchIds: ['branch-1'], canAccessAllBranches: false, membershipId: 'member-1', role: 'staff' },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'bank_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'bank-1', branch_id: 'branch-1' },
                    error: null,
                  }),
                })),
              })),
            })),
          }
        }
        if (table === 'bank_mutations') {
          return { insert: insertMock }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const csv = `date,description,amount,type,balance
04/04/2026,SETOR TUNAI,100000,IN,1097500`

    const result = await processBankCSV('org-1', 'bank-1', csv)

    expect(result).toEqual({ success: true, count: 1 })
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          mutation_date: '2026-04-04',
          description: 'SETOR TUNAI',
          amount: 100000,
          type: 'IN',
          balance: 1097500,
        }),
      ])
    )
  })
})
