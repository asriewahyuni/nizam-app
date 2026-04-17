import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseMock, success } from './helpers/supabase-mock'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getAccountBalances: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/modules/accounting/actions/coa.actions', () => ({
  getAccountBalances: mocks.getAccountBalances,
}))

import { getZakatSummary } from '@/modules/accounting/actions/zakat.actions'

describe('Zakat Accounting Boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports zakat summary as organization-scoped', async () => {
    const supabase = createSupabaseMock({
      tables: {
        zakat_haul: [
          {
            maybeSingleResult: success(null),
          },
          {
            maybeSingleResult: success(null),
          },
          {
            result: success([]),
          },
        ],
        zakat_asset_timeline: [
          {
            maybeSingleResult: success(null),
          },
          {
            result: success([]),
          },
          {
            result: success([]),
          },
        ],
        accounts: [
          {
            result: { data: null, error: null, count: 4 } as any,
          },
        ],
      },
    })

    mocks.getAccountBalances.mockResolvedValue([
      { code: '1101', name: 'Kas', balance: 100000000 },
      { code: '1201', name: 'Piutang Usaha', balance: 50000000 },
      { code: '1301', name: 'Persediaan', balance: 25000000 },
      { code: '2101', name: 'Hutang Dagang', balance: -10000000 },
      { code: '4001', name: 'Penjualan', balance: 80000000 },
      { code: '5001', name: 'Beban Operasional', balance: 20000000 },
    ])
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getZakatSummary('org-1', {
      goldPerGram: 1500000,
      silverPerGram: 15000,
    })

    expect(result.scopeLevel).toBe('ORG')
    expect(result.scopeLabel).toBe('Level Organisasi')
    expect(result.totalAssets).toBe(165000000)
    expect(result.isZakatObligated).toBe(true)
  })

  it('disables trade zakat obligation for service/labour business', async () => {
    const supabase = createSupabaseMock({
      tables: {
        organizations: [
          {
            maybeSingleResult: success({
              settings: {
                business_type: 'LAYANAN_JASA',
              },
            }),
          },
        ],
        zakat_haul: [
          {
            maybeSingleResult: success(null),
          },
          {
            maybeSingleResult: success(null),
          },
          {
            result: success([]),
          },
        ],
        zakat_asset_timeline: [
          {
            maybeSingleResult: success(null),
          },
          {
            result: success([]),
          },
          {
            result: success([]),
          },
        ],
        accounts: [
          {
            result: { data: null, error: null, count: 4 } as any,
          },
        ],
      },
    })

    mocks.getAccountBalances.mockResolvedValue([
      { code: '1101', name: 'Kas', balance: 300000000 },
      { code: '1201', name: 'Piutang Usaha', balance: 100000000 },
      { code: '1301', name: 'Persediaan', balance: 0 },
      { code: '2101', name: 'Hutang Dagang', balance: -50000000 },
    ])
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getZakatSummary('org-jasa', {
      goldPerGram: 1500000,
      silverPerGram: 15000,
    })

    expect(result.isTradeZakatApplicable).toBe(false)
    expect(result.tradeZakatIneligibilityReason).toContain('layanan')
    expect(result.isZakatObligated).toBe(false)
    expect(result.zakatAmount).toBe(0)
  })

  it('classifies SALAM and ISTISHNA receivables-liabilities into zakat assets correctly', async () => {
    const supabase = createSupabaseMock({
      tables: {
        zakat_haul: [
          {
            maybeSingleResult: success(null),
          },
          {
            maybeSingleResult: success(null),
          },
          {
            result: success([]),
          },
        ],
        zakat_asset_timeline: [
          {
            maybeSingleResult: success(null),
          },
          {
            result: success([]),
          },
          {
            result: success([]),
          },
        ],
        accounts: [
          {
            result: { data: null, error: null, count: 2 } as any,
          },
        ],
      },
    })

    mocks.getAccountBalances.mockResolvedValue([
      { code: '1101', name: 'Kas', balance: 100000000 },
      { code: '1205', name: 'Piutang Barang Istishna', balance: 15000000 },
      { code: '1404', name: 'Piutang Salam Vendor', balance: 5000000 },
      { code: '1301', name: 'Persediaan', balance: 20000000 },
      { code: '2101', name: 'Hutang Dagang', balance: -7000000 },
      { code: '2602', name: 'Hutang Salam', balance: -3000000 },
      { code: '2603', name: 'Hutang Istishna', balance: -4000000 },
    ])
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getZakatSummary('org-syariah', {
      goldPerGram: 1500000,
      silverPerGram: 15000,
    })

    expect(result.breakdown.totalAR).toBe(20000000)
    expect(result.breakdown.totalAP).toBe(14000000)
    expect(result.totalAssets).toBe(126000000)
  })

  it('counts derived account codes for cash, receivables, and inventory while excluding contra receivable 1203', async () => {
    const supabase = createSupabaseMock({
      tables: {
        zakat_haul: [
          {
            maybeSingleResult: success(null),
          },
          {
            maybeSingleResult: success(null),
          },
          {
            result: success([]),
          },
        ],
        zakat_asset_timeline: [
          {
            maybeSingleResult: success(null),
          },
          {
            result: success([]),
          },
          {
            result: success([]),
          },
        ],
        accounts: [
          {
            result: { data: null, error: null, count: 4 } as any,
          },
        ],
      },
    })

    mocks.getAccountBalances.mockResolvedValue([
      { code: '1101-01', name: 'Kas POS Depan', balance: '12000000' },
      { code: '1103-02', name: 'Bank Operasional Cabang', balance: '8000000' },
      { code: '1201-AR', name: 'Piutang Usaha Cabang', balance: '9000000' },
      { code: '1203', name: 'Cadangan Kerugian Piutang', balance: '7000000' },
      { code: '1304-FG', name: 'Persediaan Barang Jadi', balance: '15000000' },
      { code: '2101-AP', name: 'Hutang Usaha Cabang', balance: '-4000000' },
    ])
    mocks.createClient.mockResolvedValue(supabase.client)

    const result = await getZakatSummary('org-derived', {
      goldPerGram: 1500000,
      silverPerGram: 15000,
    })

    expect(result.breakdown.totalCash).toBe(20000000)
    expect(result.breakdown.totalAR).toBe(9000000)
    expect(result.breakdown.totalInventory).toBe(15000000)
    expect(result.breakdown.totalAP).toBe(4000000)
    expect(result.totalAssets).toBe(40000000)
  })
})
