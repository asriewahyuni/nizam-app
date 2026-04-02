import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { getCashFlow, getGeneralLedger, getProfitLoss } from '@/modules/accounting/actions/reports.actions'

describe('Reports Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters general ledger by active branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        journal_entries: [
          {
            result: success([{ id: 'je-1', journal_lines: [] }]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getGeneralLedger('org-1', 'branch-1')

    expect(result).toEqual([{ id: 'je-1', journal_lines: [] }])
    expect(supabase.calls[0]?.table).toBe('journal_entries')
    expect(supabase.calls[0]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
        expect.objectContaining({ method: 'eq', args: ['status', 'POSTED'] }),
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )
  })

  it('scopes profit and loss calculations to the active branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        journal_entries: [
          {
            result: success([{ id: 'je-1' }]),
          },
        ],
        journal_lines: [
          {
            result: success([
              {
                debit: 0,
                credit: 125000,
                accounts: {
                  id: 'acc-rev',
                  code: '4001',
                  name: 'Penjualan',
                  type: 'REVENUE',
                  normal_balance: 'CREDIT',
                  cash_flow_category: 'OPERATING',
                },
              },
              {
                debit: 25000,
                credit: 0,
                accounts: {
                  id: 'acc-exp',
                  code: '5001',
                  name: 'Beban Operasional',
                  type: 'EXPENSE',
                  normal_balance: 'DEBIT',
                  cash_flow_category: 'OPERATING',
                },
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getProfitLoss('org-1', '2026-04-01', '2026-04-30', 'branch-1')

    expect(result.totalRevenue).toBe(125000)
    expect(result.totalExpenses).toBe(25000)
    expect(result.netProfit).toBe(100000)

    const entryCall = supabase.calls.find((call) => call.table === 'journal_entries')
    expect(entryCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
        expect.objectContaining({ method: 'gte', args: ['entry_date', '2026-04-01'] }),
        expect.objectContaining({ method: 'lte', args: ['entry_date', '2026-04-30'] }),
      ])
    )

    const lineCall = supabase.calls.find((call) => call.table === 'journal_lines')
    expect(lineCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'in', args: ['entry_id', ['je-1']] }),
      ])
    )
  })

  it('uses branch-scoped journal entries when calculating cash flow trends', async () => {
    const supabase = createSupabaseMock({
      tables: {
        bank_accounts: [
          {
            result: success([{ account_id: 'bank-1', accounts: { code: '1101' } }]),
          },
        ],
        journal_entries: [
          {
            result: success([{ id: 'je-all' }]),
          },
          {
            result: success([{ id: 'je-current' }]),
          },
          {
            result: success([{ id: 'je-last' }]),
          },
        ],
        journal_lines: [
          {
            result: success([
              {
                debit: 0,
                credit: 200000,
                accounts: {
                  id: 'acc-rev',
                  code: '4001',
                  name: 'Penjualan',
                  type: 'REVENUE',
                  normal_balance: 'CREDIT',
                  cash_flow_category: 'OPERATING',
                },
              },
            ]),
          },
          {
            result: success([
              {
                debit: 75000,
                credit: 0,
                accounts: { code: '1101' },
              },
            ]),
          },
          {
            result: success([
              {
                debit: 50000,
                credit: 0,
                accounts: { code: '1101' },
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getCashFlow('org-1', 'branch-1')

    expect(result.ocf).toBe(200000)
    const journalEntryCalls = supabase.calls.filter((call) => call.table === 'journal_entries')
    expect(journalEntryCalls).toHaveLength(3)
    journalEntryCalls.forEach((call) => {
      expect(call.operations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
        ])
      )
    })
  })
})
