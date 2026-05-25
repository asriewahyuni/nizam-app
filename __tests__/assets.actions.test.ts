import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  createJournalEntry: vi.fn(),
  resolveAccessibleBranchSelection: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock('@/modules/accounting/actions/journal.actions', () => ({
  createJournalEntry: mocks.createJournalEntry,
}))

vi.mock('@/modules/organization/lib/branch-access.server', () => ({
  resolveAccessibleBranchSelection: mocks.resolveAccessibleBranchSelection,
}))

import {
  createFixedAsset,
  getFixedAssets,
  runOrganizationDepreciation,
} from '@/modules/accounting/actions/assets.actions'

describe('Fixed Assets Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('filters fixed assets by active branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        fixed_assets: [
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
        role: 'staff',
      },
      branchId: 'branch-1',
    })
    mocks.createClient.mockResolvedValue(supabase.client)

    await getFixedAssets('org-1', 'branch-1')

    expect(supabase.calls[0]?.table).toBe('fixed_assets')
    expect(supabase.calls[0]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )
  })

  it('stamps branch_id on fixed asset creation and capitalization journal', async () => {
    const supabase = createSupabaseMock({
      tables: {
        fixed_assets: [
          {
            singleResult: success({
              id: 'asset-1',
              org_id: 'org-1',
              branch_id: 'branch-1',
              code: 'AST-001',
              name: 'Mesin Potong',
              purchase_date: '2026-04-03',
              purchase_price: 1000000,
              asset_account_id: 'acc-asset',
              accum_dep_account_id: 'acc-accum',
              dep_expense_account_id: 'acc-exp',
            }),
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
    mocks.createJournalEntry.mockResolvedValue({ success: true, entryId: 'je-1' })
    mocks.createClient.mockResolvedValue(supabase.client)

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

    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'asset-1',
          branch_id: 'branch-1',
        }),
      })
    )
    expect(supabase.calls[0]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'insert',
          args: [
            expect.objectContaining({
              org_id: 'org-1',
              branch_id: 'branch-1',
            }),
          ],
        }),
      ])
    )
    expect(mocks.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        branch_id: 'branch-1',
        reference_id: 'asset-1',
      })
    )
  })

  it('runs depreciation only for the active branch and writes branch-aware logs', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T00:00:00.000Z'))

    const supabase = createSupabaseMock({
      tables: {
        fixed_assets: [
          {
            result: success([
              {
                id: 'asset-1',
                org_id: 'org-1',
                branch_id: 'branch-1',
                name: 'Laptop Operasional',
                code: 'AST-002',
                purchase_date: '2026-04-01',
                purchase_price: 12000000,
                salvage_value: 0,
                useful_life_months: 12,
                current_book_value: 12000000,
                accumulated_depreciation: 0,
                last_depreciation_date: null,
                dep_expense_account_id: 'acc-exp',
                accum_dep_account_id: 'acc-accum',
                depreciation_method: 'STRAIGHT_LINE',
                status: 'ACTIVE',
              },
            ]),
          },
          {
            result: success([]),
          },
        ],
        asset_depreciation_logs: [
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
    mocks.createJournalEntry.mockResolvedValue({ success: true, entryId: 'je-10' })
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await runOrganizationDepreciation('org-1', 'branch-1')

    expect(result).toEqual({ success: true, processed: 1 })

    const assetSelectCall = supabase.calls.find((call) => call.table === 'fixed_assets')
    expect(assetSelectCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )

    expect(mocks.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: 'branch-1',
        reference_type: 'DEPRECIATION',
      })
    )

    const depreciationLogCall = supabase.calls.find((call) => call.table === 'asset_depreciation_logs')
    expect(depreciationLogCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'insert',
          args: [
            expect.objectContaining({
              asset_id: 'asset-1',
              org_id: 'org-1',
              branch_id: 'branch-1',
            }),
          ],
        }),
      ])
    )
  })
})
