import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    reimbursements: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    reimbursement_items: { createMany: vi.fn() },
    approval_requests: { create: vi.fn(), updateMany: vi.fn() },
    bank_accounts: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  revalidatePath: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
  createJournalEntry: vi.fn(),
  uploadReimbursementReceipt: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))
vi.mock('@/modules/accounting/actions/journal.actions', () => ({ createJournalEntry: mocks.createJournalEntry }))
vi.mock('@/modules/accounting/lib/reimbursement-receipt-storage.server', () => ({ uploadReimbursementReceipt: mocks.uploadReimbursementReceipt }))

import { approveReimbursement, getReimbursements, payReimbursement, rejectReimbursement, submitReimbursement } from '@/modules/accounting/actions/reimburse.actions'

describe('Reimbursement Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('filters reimbursements by active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.reimbursements.findMany.mockResolvedValue([])

    await getReimbursements('org-1', 'branch-1')

    expect(mocks.prisma.reimbursements.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
  })

  it('rejects reimbursement submission when no active branch is selected', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: [] }, branchId: null })

    const result = await submitReimbursement('org-1', {
      description: 'Perjalanan Dinas',
      items: [{ expense_date: '2026-04-03', category_account_id: 'acc-1', description: 'Taksi', amount: 100000, receipt_url: 'https://example.com/nota.jpg' }],
    })

    expect(result).toEqual({ error: 'Pilih unit aktif terlebih dahulu untuk mengajukan reimbursement.' })
  })

  it('stamps active branch on reimbursement and approval request', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.$transaction.mockImplementation(async (callback: any) => callback({
      reimbursements: { create: vi.fn().mockResolvedValue({ id: 'reim-1' }) },
      reimbursement_items: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }))
    mocks.prisma.approval_requests.create.mockResolvedValue({ id: 'approval-1' })

    const result = await submitReimbursement('org-1', {
      description: 'Perjalanan Dinas',
      items: [{ expense_date: '2026-04-03', category_account_id: 'acc-1', description: 'Taksi', amount: 100000, receipt_url: 'https://example.com/nota.jpg' }],
    })

    expect(result).toEqual({ success: true, id: 'reim-1' })
    expect(mocks.prisma.approval_requests.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1', requester_id: 'user-1' }) }))
  })

  it('passes reimbursement branch into payment journal entry', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.reimbursements.findFirst.mockResolvedValue({ id: 'reim-1', claim_number: 'REIMB-1', description: 'Dinas', total_amount: 100000, status: 'APPROVED', reimbursement_items: [{ category_account_id: 'acc-exp', amount: 100000 }] })
    mocks.prisma.bank_accounts.findFirst.mockResolvedValue({ account_id: 'acc-bank' })
    mocks.createJournalEntry.mockResolvedValue({ success: true, entryId: 'je-1' })
    mocks.prisma.reimbursements.updateMany.mockResolvedValue({ count: 1 })

    const result = await payReimbursement('reim-1', 'org-1', 'bank-1')

    expect(result).toEqual({ success: true })
    expect(mocks.createJournalEntry).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }))
  })

  it('syncs rejection notes back to approval request when rejecting reimbursement directly', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.reimbursements.updateMany.mockResolvedValue({ count: 1 })
    mocks.prisma.approval_requests.updateMany.mockResolvedValue({ count: 1 })

    const result = await rejectReimbursement('reim-1', 'org-1', 'Dokumen kurang lengkap')

    expect(result).toEqual({ success: true })
    expect(mocks.prisma.approval_requests.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branch_id: 'branch-1', source_id: 'reim-1' }), data: expect.objectContaining({ notes: 'Dokumen kurang lengkap' }) }))
  })
})
