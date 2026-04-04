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
                id: 'sale-1',
                grand_total: 150000,
                due_date: null,
                sale_number: 'SO-001',
              },
            ]),
          },
        ],
        sales_payments: [
          {
            result: success([]),
          },
        ],
        sales_returns: [
          {
            result: success([]),
          },
        ],
        purchases: [
          {
            result: success([
              {
                id: 'purchase-1',
                grand_total: 40000,
                due_date: null,
                purchase_number: 'PO-001',
              },
            ]),
          },
        ],
        purchase_payments: [
          {
            result: success([]),
          },
        ],
        purchase_returns: [
          {
            result: success([]),
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

  it('uses outstanding balances for PARTIAL documents instead of full totals', async () => {
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
                id: 'sale-1',
                grand_total: 1000000,
                due_date: null,
                sale_number: 'SO-TEST-01',
              },
            ]),
          },
        ],
        sales_payments: [
          {
            result: success([
              {
                sale_id: 'sale-1',
                amount: 400000,
                discount_amount: 0,
              },
            ]),
          },
        ],
        sales_returns: [
          {
            result: success([]),
          },
        ],
        purchases: [
          {
            result: success([
              {
                id: 'purchase-1',
                grand_total: 800000,
                due_date: null,
                purchase_number: 'PO-TEST-01',
              },
            ]),
          },
        ],
        purchase_payments: [
          {
            result: success([
              {
                purchase_id: 'purchase-1',
                amount: 300000,
                discount_amount: 0,
              },
            ]),
          },
        ],
        purchase_returns: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getCashFlowForecast('org-1', 1, 'branch-1')

    expect(result.totalProjectedInflow).toBe(600000)
    expect(result.totalProjectedOutflow).toBe(500000)
    expect(result.forecast[0]?.inflow).toBe(600000)
    expect(result.forecast[0]?.outflow).toBe(500000)
    expect(result.forecast[0]?.balance).toBe(600000)
  })
})
