import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    fixed_assets: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    asset_depreciation_logs: {
      create: vi.fn(),
    },
  },
  revalidatePath: vi.fn(),
  createJournalEntry: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/modules/accounting/actions/journal.actions', () => ({ createJournalEntry: mocks.createJournalEntry }))
vi.mock('@/modules/organization/lib/branch-access.server', () => ({ resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection }))

import { createFixedAsset, getFixedAssets, runOrganizationDepreciation } from '@/modules/accounting/actions/assets.actions'

describe('Fixed Assets Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters fixed assets by active branch', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.fixed_assets.findMany.mockResolvedValue([])

    await getFixedAssets('org-1', 'branch-1')

    expect(mocks.prisma.fixed_assets.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
  })

  it('stamps branch_id on fixed asset creation and capitalization journal', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.fixed_assets.create.mockResolvedValue({
      id: 'asset-1',
      org_id: 'org-1',
      branch_id: 'branch-1',
      code: 'AST-001',
      name: 'Mesin Potong',
      purchase_date: new Date('2026-04-03T00:00:00.000Z'),
      purchase_price: 1000000,
      salvage_value: 0,
      useful_life_months: 48,
      current_book_value: 1000000,
      accumulated_depreciation: 0,
      last_depreciation_date: null,
      asset_account_id: 'acc-asset',
      accum_dep_account_id: 'acc-accum',
      dep_expense_account_id: 'acc-exp',
      should_capitalize_tax: false,
      created_at: new Date('2026-04-03T00:00:00.000Z'),
      updated_at: new Date('2026-04-03T00:00:00.000Z'),
      depreciation_method: 'STRAIGHT_LINE',
      status: 'ACTIVE',
      branches: { id: 'branch-1', name: 'Unit A', code: 'UA' },
    })
    mocks.createJournalEntry.mockResolvedValue({ success: true, entryId: 'je-1' })

    const result = await createFixedAsset('org-1', {
      code: 'AST-001',
      name: 'Mesin Potong',
      purchase_date: '2026-04-03',
      purchase_price: 1000000,
      salvage_value: 0,
      useful_life_months: 48,
      source_account_id: 'cash-1',
      payment_method: 'LUNAS',
      asset_account_id: 'acc-asset',
      accum_dep_account_id: 'acc-accum',
      dep_expense_account_id: 'acc-exp',
      tax_percent: 0,
      tax_amount: 0,
      should_capitalize_tax: false,
    })

    expect(result).toEqual(expect.objectContaining({ data: expect.objectContaining({ id: 'asset-1', branch_id: 'branch-1' }) }))
    expect(mocks.prisma.fixed_assets.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
    expect(mocks.createJournalEntry).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1', reference_id: 'asset-1' }))
  })

  it('runs depreciation only for the active branch and writes branch-aware logs', async () => {
    mocks.resolveAccessibleBranchSelection.mockResolvedValue({ scope: { accessibleBranchIds: ['branch-1'] }, branchId: 'branch-1' })
    mocks.prisma.fixed_assets.findMany.mockResolvedValue([
      {
        id: 'asset-1', org_id: 'org-1', branch_id: 'branch-1', name: 'Laptop Operasional', code: 'AST-002',
        purchase_date: new Date('2026-04-01T00:00:00.000Z'), purchase_price: 12000000, salvage_value: 0, useful_life_months: 12,
        current_book_value: 12000000, accumulated_depreciation: 0, last_depreciation_date: null,
        dep_expense_account_id: 'acc-exp', accum_dep_account_id: 'acc-accum', depreciation_method: 'STRAIGHT_LINE', status: 'ACTIVE',
      },
    ])
    mocks.createJournalEntry.mockResolvedValue({ success: true, entryId: 'je-10' })
    mocks.prisma.fixed_assets.update.mockResolvedValue({ id: 'asset-1' })
    mocks.prisma.asset_depreciation_logs.create.mockResolvedValue({ id: 'log-1' })

    const result = await runOrganizationDepreciation('org-1', 'branch-1')

    expect(result).toEqual({ success: true, processed: 1 })
    expect(mocks.prisma.fixed_assets.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', branch_id: 'branch-1' }) }))
    expect(mocks.createJournalEntry).toHaveBeenCalledWith(expect.objectContaining({ branch_id: 'branch-1', reference_type: 'DEPRECIATION' }))
    expect(mocks.prisma.asset_depreciation_logs.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ asset_id: 'asset-1', org_id: 'org-1', branch_id: 'branch-1' }) }))
  })
})
