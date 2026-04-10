import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { getBalanceSheet, getCashFlow, getGeneralLedger, getProfitLoss } from '@/modules/accounting/actions/reports.actions'

describe('Reports Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters general ledger by active branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        journal_entries: [
          {
            result: success([{ id: 'je-1' }]),
          },
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
        expect.objectContaining({ method: 'in', args: ['org_id', ['org-1']] }),
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

  it('uses cash-touching journal lines for branch-scoped cash flow', async () => {
    const supabase = createSupabaseMock({
      tables: {
        bank_accounts: [
          {
            result: success([{ account_id: 'bank-1', accounts: { code: '1101' } }]),
          },
        ],
        journal_entries: [
          {
            result: success([{ id: 'je-sale' }, { id: 'je-utility' }, { id: 'je-accrual' }, { id: 'je-loan' }]),
          },
          {
            result: success([{ id: 'je-prev' }]),
          },
        ],
        journal_lines: [
          {
            result: success([
              {
                entry_id: 'je-sale',
                debit: 200000,
                credit: 0,
                accounts: {
                  id: 'acc-cash',
                  code: '1101',
                  name: 'Kas Besar',
                  type: 'ASSET',
                  normal_balance: 'DEBIT',
                  cash_flow_category: null,
                },
              },
              {
                entry_id: 'je-sale',
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
              {
                entry_id: 'je-utility',
                debit: 50000,
                credit: 0,
                accounts: {
                  id: 'acc-util',
                  code: '6003',
                  name: 'Utilitas',
                  type: 'EXPENSE',
                  normal_balance: 'DEBIT',
                  cash_flow_category: 'OPERATING',
                },
              },
              {
                entry_id: 'je-utility',
                debit: 0,
                credit: 50000,
                accounts: {
                  id: 'acc-cash',
                  code: '1101',
                  name: 'Kas Besar',
                  type: 'ASSET',
                  normal_balance: 'DEBIT',
                  cash_flow_category: null,
                },
              },
              {
                entry_id: 'je-accrual',
                debit: 80000,
                credit: 0,
                accounts: {
                  id: 'acc-ar',
                  code: '1201',
                  name: 'Piutang Usaha',
                  type: 'ASSET',
                  normal_balance: 'DEBIT',
                  cash_flow_category: 'OPERATING',
                },
              },
              {
                entry_id: 'je-accrual',
                debit: 0,
                credit: 80000,
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
                entry_id: 'je-loan',
                debit: 300000,
                credit: 0,
                accounts: {
                  id: 'acc-cash',
                  code: '1101',
                  name: 'Kas Besar',
                  type: 'ASSET',
                  normal_balance: 'DEBIT',
                  cash_flow_category: null,
                },
              },
              {
                entry_id: 'je-loan',
                debit: 0,
                credit: 300000,
                accounts: {
                  id: 'acc-loan',
                  code: '2501',
                  name: 'Hutang Bank Jangka Panjang',
                  type: 'LIABILITY',
                  normal_balance: 'CREDIT',
                  cash_flow_category: 'FINANCING',
                },
              },
            ]),
          },
          {
            result: success([
              {
                entry_id: 'je-prev',
                debit: 150000,
                credit: 0,
                accounts: { code: '1101' },
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getCashFlow('org-1', 'branch-1', false, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    })

    expect(result.ocf).toBe(150000)
    expect(result.icf).toBe(0)
    expect(result.fcf).toBe(300000)
    expect(result.netChange).toBe(450000)
    expect(result.ocfItems).toEqual([
      { code: '4001', name: 'Penerimaan dari Pelanggan / Penjualan', amount: 200000 },
      { code: '6003', name: 'Pembayaran Utilitas', amount: -50000 },
    ])
    expect(result.fcfItems).toEqual([
      { code: '2501', name: 'Penerimaan Hutang Bank Jangka Panjang', amount: 300000 },
    ])

    const journalEntryCalls = supabase.calls.filter((call) => call.table === 'journal_entries')
    expect(journalEntryCalls).toHaveLength(2)
    journalEntryCalls.forEach((call) => {
      expect(call.operations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
        ])
      )
    })
  })

  it('counts 11xx cash accounts even when bank_accounts mapping is empty', async () => {
    const supabase = createSupabaseMock({
      tables: {
        bank_accounts: [
          {
            result: success([]),
          },
        ],
        accounts: [
          {
            result: success([
              { code: '1109' },
              { code: '1201' },
            ]),
          },
        ],
        journal_entries: [
          {
            result: success([{ id: 'je-pos' }]),
          },
          {
            result: success([]),
          },
        ],
        journal_lines: [
          {
            result: success([
              {
                entry_id: 'je-pos',
                debit: 175000,
                credit: 0,
                accounts: {
                  id: 'acc-cash-custom',
                  code: '1109',
                  name: 'Kas Outlet',
                  type: 'ASSET',
                  normal_balance: 'DEBIT',
                  cash_flow_category: null,
                },
              },
              {
                entry_id: 'je-pos',
                debit: 0,
                credit: 175000,
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
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getCashFlow('org-1', 'branch-1', false, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    })

    expect(result.ocf).toBe(175000)
    expect(result.netChange).toBe(175000)
    expect(result.ocfItems).toEqual([
      { code: '4001', name: 'Penerimaan dari Pelanggan / Penjualan', amount: 175000 },
    ])
  })

  it('splits retained earnings and current earnings on the balance sheet', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            result: success([
              {
                id: 'asset-root',
                org_id: 'org-1',
                code: '1000',
                name: 'Aset',
                type: 'ASSET',
                normal_balance: 'DEBIT',
                parent_id: null,
              },
              {
                id: 'cash-acc',
                org_id: 'org-1',
                code: '1101',
                name: 'Kas Besar',
                type: 'ASSET',
                normal_balance: 'DEBIT',
                parent_id: 'asset-root',
              },
              {
                id: 'eq-root',
                org_id: 'org-1',
                code: '3000',
                name: 'Ekuitas',
                type: 'EQUITY',
                normal_balance: 'CREDIT',
                parent_id: null,
              },
              {
                id: 'retained',
                org_id: 'org-1',
                code: '3002',
                name: 'Laba Ditahan',
                type: 'EQUITY',
                normal_balance: 'CREDIT',
                parent_id: 'eq-root',
              },
              {
                id: 'current',
                org_id: 'org-1',
                code: '3003',
                name: 'Laba Periode Berjalan',
                type: 'EQUITY',
                normal_balance: 'CREDIT',
                parent_id: 'eq-root',
              },
            ]),
          },
        ],
        journal_entries: [
          {
            result: success([]),
          },
          {
            result: success([{ id: 'je-retained' }]),
          },
          {
            result: success([{ id: 'je-current' }]),
          },
        ],
        fiscal_periods: [
          {
            maybeSingleResult: success({ end_date: '2026-03-31' }),
          },
        ],
        journal_lines: [
          {
            result: success([
              {
                debit: 0,
                credit: 1000000,
                accounts: {
                  id: 'acc-rev',
                  code: '4001',
                  name: 'Pendapatan Usaha',
                  type: 'REVENUE',
                  normal_balance: 'CREDIT',
                  cash_flow_category: 'OPERATING',
                },
              },
              {
                debit: 400000,
                credit: 0,
                accounts: {
                  id: 'acc-exp',
                  code: '6003',
                  name: 'Utilitas',
                  type: 'EXPENSE',
                  normal_balance: 'DEBIT',
                  cash_flow_category: 'OPERATING',
                },
              },
            ]),
          },
          {
            result: success([
              {
                debit: 0,
                credit: 500000,
                accounts: {
                  id: 'acc-rev',
                  code: '4001',
                  name: 'Pendapatan Usaha',
                  type: 'REVENUE',
                  normal_balance: 'CREDIT',
                  cash_flow_category: 'OPERATING',
                },
              },
              {
                debit: 200000,
                credit: 0,
                accounts: {
                  id: 'acc-exp',
                  code: '6003',
                  name: 'Utilitas',
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

    const result = await getBalanceSheet('org-1', '2026-04-30', 'branch-1')

    expect(result.equity.find((row: { code: string }) => row.code === '3002')?.balance).toBe(600000)
    expect(result.equity.find((row: { code: string }) => row.code === '3003')?.balance).toBe(300000)
    expect(result.equity.find((row: { code: string }) => row.code === '9999')).toBeUndefined()

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
