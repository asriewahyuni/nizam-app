import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'

const mocks = vi.hoisted(() => ({
  getGeneralLedger: vi.fn(),
  getProfitLoss: vi.fn(),
  getBalanceSheet: vi.fn(),
  getZakatSummary: vi.fn(),
}))

vi.mock('@/modules/accounting/actions/reports.actions', () => ({
  getProfitLoss: mocks.getProfitLoss,
  getBalanceSheet: mocks.getBalanceSheet,
  getGeneralLedger: mocks.getGeneralLedger,
}))

vi.mock('@/modules/accounting/actions/zakat.actions', () => ({
  getZakatSummary: mocks.getZakatSummary,
}))

import { exportGeneralLedgerXLSX } from '@/modules/accounting/actions/export.actions'

describe('Export General Ledger XLSX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('membuat workbook xlsx untuk buku besar', async () => {
    mocks.getGeneralLedger.mockResolvedValue([
      {
        entry_date: '2026-04-30',
        entry_number: 'JU-0001',
        description: 'Penjualan tunai',
        reference_type: 'SALE',
        notes: 'Transaksi toko depan',
        purchase_transparency: null,
        journal_lines: [
          {
            debit: 150000,
            credit: 0,
            accounts: { code: '1101', name: 'Kas' },
          },
          {
            debit: 0,
            credit: 150000,
            accounts: { code: '4101', name: 'Penjualan' },
          },
        ],
      },
    ])

    const buffer = await exportGeneralLedgerXLSX('org-1', 'Org Demo', 'branch-1', false)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 2).toString()).toBe('PK')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const sheet = workbook.getWorksheet('Buku Besar')
    expect(sheet).toBeDefined()
    expect(sheet?.views?.[0]?.showGridLines).toBe(false)
    expect(sheet?.getCell('A1').value).toBe('ORG DEMO')
    expect(sheet?.getCell('A2').value).toBe('BUKU BESAR')
    expect(sheet?.getCell('A4').value).toBe('No')
    expect(sheet?.getCell('C5').value).toBe('JU-0001')
    expect(sheet?.getCell('F5').value).toBe('1101')
    expect(sheet?.getCell('G6').value).toBe('Penjualan')
    expect(sheet?.getCell('A4').fill).toEqual({ type: 'pattern', pattern: 'none' })
    expect(sheet?.getCell('A4').border).toEqual({})
  })
})
