import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

import { getAgingReport } from '@/modules/accounting/actions/aging.actions'

describe('Aging Branch Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('filters AR aging data and GL reconciliation by active branch', async () => {
    const supabase = createSupabaseMock({
      tables: {
        sales: [
          {
            result: success([]),
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
                debit: 100000,
                credit: 0,
                accounts: {
                  code: '1201',
                  type: 'ASSET',
                },
              },
            ]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getAgingReport('org-1', 'AR', 'branch-1')

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          doc_number: 'GL-1201-ADJ',
          outstanding: 100000,
          source_type: 'JOURNAL',
        }),
      ])
    )

    const salesCall = supabase.calls.find((call) => call.table === 'sales')
    expect(salesCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )

    const journalEntryCall = supabase.calls.find((call) => call.table === 'journal_entries')
    expect(journalEntryCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
        expect.objectContaining({ method: 'eq', args: ['branch_id', 'branch-1'] }),
      ])
    )
  })

  it('uses Asia/Jakarta business date when bucketing due dates around midnight UTC', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-03T18:30:00.000Z'))

    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            result: success([{ id: 'acc-ar', code: '1201' }]),
          },
        ],
        sales: [
          {
            result: success([
              {
                id: 'sale-1',
                sale_number: 'SO-001',
                sale_date: '2026-04-04',
                due_date: '2026-04-04',
                grand_total: 100000,
                contacts: { name: 'PT Test' },
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
        journal_entries: [
          {
            result: success([]),
          },
        ],
      },
    })

    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getAgingReport('org-1', 'AR', 'branch-1')
    const row = result.find((item) => item.doc_number === 'SO-001')

    expect(row).toEqual(
      expect.objectContaining({
        aging_bucket: 'Current',
        days_overdue: 0,
      })
    )
  })
})
