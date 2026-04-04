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
        expect.objectContaining({ method: 'or', args: ['branch_id.eq.branch-1,branch_id.is.null'] }),
      ])
    )

    const journalEntryCall = supabase.calls.find((call) => call.table === 'journal_entries')
    expect(journalEntryCall?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'eq', args: ['org_id', 'org-1'] }),
        expect.objectContaining({ method: 'or', args: ['branch_id.eq.branch-1,branch_id.is.null'] }),
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

  it('includes SALAM vendor receivable in AR with source trace and document link', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            result: success([{ id: 'acc-salam-ar', code: '1404' }]),
          },
        ],
        sales: [
          {
            result: success([]),
          },
        ],
        purchases: [
          {
            result: success([
              {
                id: 'po-salam-1',
                purchase_number: 'PO-SALAM-001',
                purchase_date: '2026-04-01',
                due_date: '2026-04-15',
                grand_total: 500000,
                status: 'ORDERED',
                payment_status: 'PAID',
                shariah_mode: 'SALAM',
                contacts: { name: 'CV Vendor Salam' },
              },
            ]),
          },
        ],
        purchase_payments: [
          {
            result: success([{ purchase_id: 'po-salam-1', amount: 500000, discount_amount: 0 }]),
          },
        ],
        purchase_returns: [
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

    const result = await getAgingReport('org-1', 'AR')
    const row = result.find((item) => item.source_type === 'SALAM_VENDOR_RECEIVABLE')

    expect(row).toEqual(
      expect.objectContaining({
        doc_number: 'PO-SALAM-001',
        doc_href: '/purchasing?pay=po-salam-1',
        outstanding: 500000,
        source_label: 'Piutang Salam Vendor (1404)',
        source_account_code: '1404',
      })
    )
  })

  it('includes SALAM sales liability in AP with source trace and document link', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            result: success([{ id: 'acc-salam-ap', code: '2602' }]),
          },
        ],
        purchases: [
          {
            result: success([]),
          },
        ],
        sales: [
          {
            result: success([
              {
                id: 'so-salam-1',
                sale_number: 'SO-SALAM-001',
                sale_date: '2026-04-01',
                due_date: '2026-04-20',
                grand_total: 750000,
                shariah_mode: 'SALAM',
                status: 'ORDERED',
                contacts: { name: 'PT Salam Customer' },
              },
            ]),
          },
        ],
        sales_payments: [
          {
            result: success([{ sale_id: 'so-salam-1', amount: 750000, discount_amount: 0 }]),
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

    const result = await getAgingReport('org-1', 'AP')
    const row = result.find((item) => item.source_type === 'SALAM_SALES_LIABILITY')

    expect(row).toEqual(
      expect.objectContaining({
        doc_number: 'SO-SALAM-001',
        doc_href: '/sales?pay=so-salam-1',
        outstanding: 750000,
        source_label: 'Hutang Salam (2602)',
        source_account_code: '2602',
      })
    )
  })

  it('detects SALAM rows case-insensitively on aging sources', async () => {
    const supabase = createSupabaseMock({
      tables: {
        accounts: [
          {
            result: success([{ id: 'acc-salam-ap', code: '2602' }]),
          },
        ],
        purchases: [
          {
            result: success([]),
          },
        ],
        sales: [
          {
            result: success([
              {
                id: 'so-salam-lower-1',
                sale_number: 'SO-SALAM-lower-001',
                sale_date: '2026-04-01',
                due_date: '2026-04-20',
                grand_total: 150000,
                shariah_mode: 'salam',
                status: 'ORDERED',
                contacts: { name: 'PT Lowercase' },
              },
            ]),
          },
        ],
        sales_payments: [
          {
            result: success([{ sale_id: 'so-salam-lower-1', amount: 150000, discount_amount: 0 }]),
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

    const result = await getAgingReport('org-1', 'AP')
    const row = result.find((item) => item.id === 'so-salam-lower-1')

    expect(row).toEqual(
      expect.objectContaining({
        source_type: 'SALAM_SALES_LIABILITY',
        source_account_code: '2602',
        outstanding: 150000,
      })
    )
  })
})
