import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { getCashFlowForecast } from '@/modules/accounting/actions/forecast.actions'

describe('Forecast Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes current cash, inflow, and outflow to the active branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        bank_accounts: [
          {
            result: success([
              {
                account_id: 'cash-1',
                accounts: { code: '1101' },
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
                debit: 500000,
                credit: 0,
                accounts: { code: '1101' },
              },
            ]),
          },
        ],
        sales: [
          {
            result: success([
              {
                grand_total: 150000,
                due_date: null,
                sale_number: 'SO-001',
              },
            ]),
          },
        ],
        purchases: [
          {
            result: success([
              {
                grand_total: 40000,
                due_date: null,
                purchase_number: 'PO-001',
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getCashFlowForecast('org-1', 1, 'branch-1')

    expect(result.currentCash).toBe(500000)
    expect(result.totalProjectedInflow).toBe(150000)
    expect(result.totalProjectedOutflow).toBe(40000)
    expect(result.forecast[0]?.balance).toBe(610000)

    const branchScopedTables = ['journal_entries', 'sales', 'purchases']
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
