import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    bank_accounts: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    bank_transactions: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { createBankAccount, createBankTransaction, deleteBankTransaction, getRecentBankTransactions } from '@/modules/cash/actions/bank.actions'

describe('Cash & Bank Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('stamps active branch when creating a bank account', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.bank_accounts.create.mockResolvedValue({ id: 'bank-1' })

    const formData = new FormData()
    formData.set('account_id', 'acc-1')
    formData.set('bank_name', 'BCA Unit A')
    formData.set('account_number', '1234567890')
    formData.set('currency', 'IDR')

    const result = await createBankAccount('org-1', formData)

    expect(mocks.prisma.bank_accounts.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1', account_id: 'acc-1', bank_name: 'BCA Unit A' }) }))
    expect(result).toEqual({ success: true })
  })

  it('rejects bank transactions when selected bank account is outside the active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.bank_accounts.findFirst.mockResolvedValue({ id: 'bank-1', branch_id: 'branch-2', account_id: 'acc-bank' })

    const formData = new FormData()
    formData.set('bank_account_id', 'bank-1')
    formData.set('transaction_date', '2026-04-03')
    formData.set('description', 'Pengeluaran unit lain')
    formData.set('amount', '10000')
    formData.set('type', 'OUT')
    formData.set('category_id', 'acc-2')

    const result = await createBankTransaction('org-1', formData)

    expect(result).toEqual({ error: 'Rekening kas/bank tersebut tidak tersedia pada unit aktif.' })
  })

  it('filters recent bank transactions strictly by branch when requested', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.bank_transactions.findMany.mockResolvedValue([{ id: 'tx-1', branch_id: 'branch-1', amount: 1000, transaction_date: new Date('2026-04-03T00:00:00.000Z'), created_at: new Date('2026-04-03T00:00:00.000Z'), updated_at: new Date('2026-04-03T00:00:00.000Z'), bank_accounts: null, accounts: null }])

    const result = await getRecentBankTransactions('org-1', 20, 'branch-1')

    expect(mocks.prisma.bank_transactions.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1' }) }))
    expect(result).toEqual([expect.objectContaining({ id: 'tx-1', branch_id: 'branch-1' })])
  })

  it('voids bank transactions instead of deleting the source record', async () => {
    mocks.prisma.bank_transactions.findFirst.mockResolvedValue({ id: 'tx-1', journal_entry_id: 'je-1', branch_id: 'branch-1', status: 'POSTED' })
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.$transaction.mockImplementation(async (callback: any) => callback({
      journal_entries: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      bank_transactions: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }))

    const result = await deleteBankTransaction('org-1', 'tx-1')

    expect(result).toEqual({ success: true })
  })
})
