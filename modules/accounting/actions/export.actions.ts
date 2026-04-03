'use server'

/**
 * NIZAM ERP — Export Engine
 * CFO Requirement: "Tombol Download XLSX/PDF adalah harga mati."
 * Board Sprint 1 — Executed.
 */

import { createClient } from '@/lib/supabase/server'
import { getProfitLoss, getBalanceSheet, getGeneralLedger } from './reports.actions'
import { getZakatSummary } from './zakat.actions'
import ExcelJS from 'exceljs'

// ─────────────────────────────────────────────────────────────
// Styling helpers — Enterprise look, not toy
// ─────────────────────────────────────────────────────────────
const NIZAM_BLUE = 'FF003366'
const HEADER_BG = 'FF1E3A5F'
const ALT_ROW = 'FFF0F4FF'
const BORDER_STYLE: ExcelJS.BorderStyle = 'thin'

function styleHeaderRow(row: ExcelJS.Row, bgColor: string = HEADER_BG) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: BORDER_STYLE }, bottom: { style: BORDER_STYLE },
      left: { style: BORDER_STYLE }, right: { style: BORDER_STYLE }
    }
  })
  row.height = 30
}

function styleSectionHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: NIZAM_BLUE }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF5' } }
    cell.border = {
      bottom: { style: BORDER_STYLE, color: { argb: NIZAM_BLUE } }
    }
  })
}

function styleDataRow(row: ExcelJS.Row, isAlt: boolean) {
  row.eachCell((cell) => {
    cell.fill = isAlt 
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } }
      : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
    cell.font = { size: 9 }
    cell.border = {
      bottom: { style: 'hair' as ExcelJS.BorderStyle },
      left: { style: BORDER_STYLE }, right: { style: BORDER_STYLE }
    }
  })
}

function styleTotalRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: NIZAM_BLUE } }
    cell.border = {
      top: { style: 'medium' as ExcelJS.BorderStyle, color: { argb: NIZAM_BLUE } },
      bottom: { style: 'double' as ExcelJS.BorderStyle, color: { argb: NIZAM_BLUE } }
    }
  })
}

function addWorkbookMetadata(wb: ExcelJS.Workbook, orgName: string) {
  wb.creator = 'NIZAM ERP'
  wb.lastModifiedBy = 'NIZAM ERP Export Engine'
  wb.created = new Date()
  wb.modified = new Date()
  wb.properties.date1904 = false
}

function formatRupiahExcel(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

function addNizamHeader(sheet: ExcelJS.Worksheet, title: string, subtitle: string, orgName: string) {
  // Row 1: Company name
  sheet.mergeCells('A1:F1')
  const r1 = sheet.getRow(1)
  r1.getCell(1).value = orgName.toUpperCase()
  r1.getCell(1).font = { bold: true, size: 14, color: { argb: NIZAM_BLUE } }
  r1.getCell(1).alignment = { horizontal: 'center' }
  r1.height = 22

  // Row 2: Report title
  sheet.mergeCells('A2:F2')
  const r2 = sheet.getRow(2)
  r2.getCell(1).value = title
  r2.getCell(1).font = { bold: true, size: 12 }
  r2.getCell(1).alignment = { horizontal: 'center' }
  r2.height = 18

  // Row 3: Subtitle/period
  sheet.mergeCells('A3:F3')
  const r3 = sheet.getRow(3)
  r3.getCell(1).value = subtitle
  r3.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF666666' } }
  r3.getCell(1).alignment = { horizontal: 'center' }

  // Row 4: Generated timestamp
  sheet.mergeCells('A4:F4')
  const r4 = sheet.getRow(4)
  r4.getCell(1).value = `Digenerate oleh NIZAM ERP pada ${new Date().toLocaleString('id-ID')}`
  r4.getCell(1).font = { size: 8, color: { argb: 'FF999999' } }
  r4.getCell(1).alignment = { horizontal: 'center' }

  // Row 5: Spacer
  sheet.getRow(5).height = 10
}


// ─────────────────────────────────────────────────────────────
// 1. EXPORT: Profit & Loss (Laba Rugi)
// ─────────────────────────────────────────────────────────────
export async function exportProfitLossXLSX(
  orgId: string, 
  startDate: string, 
  endDate: string,
  orgName: string = 'Organisasi',
  branchId?: string | null
): Promise<Buffer> {
  const data = await getProfitLoss(orgId, startDate, endDate, branchId)
  
  const wb = new ExcelJS.Workbook()
  addWorkbookMetadata(wb, orgName)
  const sheet = wb.addWorksheet('Laba Rugi', { pageSetup: { paperSize: 9, orientation: 'portrait' } })

  sheet.columns = [
    { key: 'code', width: 12 },
    { key: 'name', width: 45 },
    { key: 'amount', width: 22 },
  ]

  addNizamHeader(sheet, 'LAPORAN LABA RUGI', `Periode: ${startDate} s/d ${endDate}`, orgName)

  // Revenue Header
  const revHeader = sheet.addRow(['Kode', 'Nama Akun', 'Nominal'])
  styleHeaderRow(revHeader)
  
  const revSection = sheet.addRow(['', 'PENDAPATAN', ''])
  styleSectionHeader(revSection)

  data.revenue.forEach((r: any, idx: number) => {
    const row = sheet.addRow([r.code, r.name, formatRupiahExcel(r.balance)])
    styleDataRow(row, idx % 2 === 0)
    row.getCell(3).alignment = { horizontal: 'right' }
  })

  const revTotal = sheet.addRow(['', 'TOTAL PENDAPATAN', formatRupiahExcel(data.totalRevenue)])
  styleTotalRow(revTotal)
  revTotal.getCell(3).alignment = { horizontal: 'right' }

  sheet.addRow([]) // spacer

  // Expenses Section
  const expSection = sheet.addRow(['', 'BEBAN & BIAYA', ''])
  styleSectionHeader(expSection)

  data.expenses.forEach((e: any, idx: number) => {
    const row = sheet.addRow([e.code, e.name, formatRupiahExcel(e.balance)])
    styleDataRow(row, idx % 2 === 0)
    row.getCell(3).alignment = { horizontal: 'right' }
  })

  const expTotal = sheet.addRow(['', 'TOTAL BEBAN', formatRupiahExcel(data.totalExpenses)])
  styleTotalRow(expTotal)
  expTotal.getCell(3).alignment = { horizontal: 'right' }

  sheet.addRow([])

  // Net Profit Row
  const netRow = sheet.addRow(['', 'LABA (RUGI) BERSIH', formatRupiahExcel(data.netProfit)])
  netRow.eachCell((cell) => {
    cell.font = { bold: true, size: 12, color: { argb: data.netProfit >= 0 ? 'FF16A34A' : 'FFDC2626' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: data.netProfit >= 0 ? 'FFF0FDF4' : 'FFFEF2F2' } }
    cell.border = {
      top: { style: 'double' as ExcelJS.BorderStyle, color: { argb: NIZAM_BLUE } },
      bottom: { style: 'double' as ExcelJS.BorderStyle, color: { argb: NIZAM_BLUE } }
    }
  })
  netRow.getCell(3).alignment = { horizontal: 'right' }
  netRow.height = 25

  return Buffer.from(await wb.xlsx.writeBuffer())
}


// ─────────────────────────────────────────────────────────────
// 2. EXPORT: Balance Sheet (Neraca)
// ─────────────────────────────────────────────────────────────
export async function exportBalanceSheetXLSX(
  orgId: string, 
  asOfDate: string,
  orgName: string = 'Organisasi',
  branchId?: string | null
): Promise<Buffer> {
  const data = await getBalanceSheet(orgId, asOfDate, branchId)

  const wb = new ExcelJS.Workbook()
  addWorkbookMetadata(wb, orgName)
  const sheet = wb.addWorksheet('Neraca', { pageSetup: { paperSize: 9, orientation: 'landscape' } })

  sheet.columns = [
    { key: 'code', width: 10 },
    { key: 'name', width: 40 },
    { key: 'amount', width: 22 },
    { key: 'spacer', width: 5 },
    { key: 'lia_name', width: 40 },
    { key: 'lia_amount', width: 22 },
  ]

  addNizamHeader(sheet, 'NERACA (BALANCE SHEET)', `Per Tanggal: ${asOfDate}`, orgName)

  // Column headers
  const hRow = sheet.addRow(['Kode', 'AKTIVA', 'Nominal', '', 'KEWAJIBAN & EKUITAS', 'Nominal'])
  styleHeaderRow(hRow)

  const assets = data.assets.filter((a: any) => Math.abs(a.balance) > 0.01)
  const liabEquity = [
    ...data.liabilities.filter((l: any) => Math.abs(l.balance) > 0.01),
    ...data.equity.filter((e: any) => Math.abs(e.balance) > 0.01)
  ]
  const maxRows = Math.max(assets.length, liabEquity.length)

  for (let i = 0; i < maxRows; i++) {
    const a = assets[i]
    const l = liabEquity[i]
    const row = sheet.addRow([
      a?.code || '', a?.name || '', a ? formatRupiahExcel(a.balance) : '',
      '',
      l?.name || '', l ? formatRupiahExcel(l.balance) : ''
    ])
    styleDataRow(row, i % 2 === 0)
    row.getCell(3).alignment = { horizontal: 'right' }
    row.getCell(6).alignment = { horizontal: 'right' }
  }

  // Totals
  const totalAssets = assets.reduce((s: number, a: any) => s + a.balance, 0)
  const totalLiab = data.liabilities.reduce((s: number, l: any) => s + l.balance, 0)
  const totalEq = data.equity.reduce((s: number, e: any) => s + e.balance, 0)

  sheet.addRow([])
  const totalRow = sheet.addRow(['', 'TOTAL AKTIVA', formatRupiahExcel(totalAssets), '', 'TOTAL PASIVA & EKUITAS', formatRupiahExcel(totalLiab + totalEq)])
  styleTotalRow(totalRow)
  totalRow.getCell(3).alignment = { horizontal: 'right' }
  totalRow.getCell(6).alignment = { horizontal: 'right' }

  return Buffer.from(await wb.xlsx.writeBuffer())
}


// ─────────────────────────────────────────────────────────────
// 3. EXPORT: General Ledger (Buku Besar)
// ─────────────────────────────────────────────────────────────
export async function exportGeneralLedgerXLSX(
  orgId: string,
  orgName: string = 'Organisasi',
  branchId?: string | null
): Promise<Buffer> {
  const entries = await getGeneralLedger(orgId, branchId)

  const wb = new ExcelJS.Workbook()
  addWorkbookMetadata(wb, orgName)
  const sheet = wb.addWorksheet('Buku Besar', { pageSetup: { paperSize: 9, orientation: 'landscape' } })

  sheet.columns = [
    { key: 'no', width: 8 },
    { key: 'date', width: 14 },
    { key: 'entry_number', width: 14 },
    { key: 'description', width: 40 },
    { key: 'account_code', width: 10 },
    { key: 'account_name', width: 30 },
    { key: 'ref_type', width: 16 },
    { key: 'debit', width: 20 },
    { key: 'credit', width: 20 },
  ]

  addNizamHeader(sheet, 'BUKU BESAR UMUM (GENERAL LEDGER)', `Semua transaksi POSTED per ${new Date().toLocaleDateString('id-ID')}`, orgName)

  const headerRow = sheet.addRow(['No', 'Tanggal', 'No. Jurnal', 'Keterangan', 'Kode Akun', 'Nama Akun', 'Tipe Referensi', 'DEBIT (Rp)', 'KREDIT (Rp)'])
  styleHeaderRow(headerRow)

  let lineNo = 1
  entries.forEach((entry: any, idx: number) => {
    if (entry.journal_lines && entry.journal_lines.length > 0) {
      let isFirstLine = true
      entry.journal_lines.forEach((line: any) => {
        const row = sheet.addRow([
          isFirstLine ? lineNo : '',
          isFirstLine ? entry.entry_date : '',
          isFirstLine ? (entry.entry_number || '') : '',
          isFirstLine ? entry.description : '',
          line.accounts?.code || '',
          line.accounts?.name || '',
          isFirstLine ? (entry.reference_type || 'MANUAL') : '',
          line.debit > 0 ? formatRupiahExcel(line.debit) : '',
          line.credit > 0 ? formatRupiahExcel(line.credit) : '',
        ])
        styleDataRow(row, idx % 2 === 0)
        row.getCell(8).alignment = { horizontal: 'right' }
        row.getCell(9).alignment = { horizontal: 'right' }
        isFirstLine = false
      })
      lineNo++
    }
  })

  // Summary totals
  sheet.addRow([])
  const totalDebit = entries.reduce((s: number, e: any) => {
    return s + (e.journal_lines || []).reduce((ls: number, l: any) => ls + Number(l.debit || 0), 0)
  }, 0)
  const totalCredit = entries.reduce((s: number, e: any) => {
    return s + (e.journal_lines || []).reduce((ls: number, l: any) => ls + Number(l.credit || 0), 0)
  }, 0)

  const totalRow = sheet.addRow(['', '', '', '', '', '', 'TOTAL', formatRupiahExcel(totalDebit), formatRupiahExcel(totalCredit)])
  styleTotalRow(totalRow)
  totalRow.getCell(8).alignment = { horizontal: 'right' }
  totalRow.getCell(9).alignment = { horizontal: 'right' }

  // Balance check
  const balRow = sheet.addRow(['', '', '', '', '', '', 'SELISIH (harus 0)', formatRupiahExcel(Math.abs(totalDebit - totalCredit)), ''])
  balRow.getCell(7).font = { italic: true, size: 8, color: { argb: Math.abs(totalDebit - totalCredit) < 0.01 ? 'FF16A34A' : 'FFDC2626' } }

  return Buffer.from(await wb.xlsx.writeBuffer())
}


// ─────────────────────────────────────────────────────────────
// 4. EXPORT: Zakat Report (Laporan Zakat Tijarah)
// Untuk keperluan audit LAZ — CFO requirement
// ─────────────────────────────────────────────────────────────
export async function exportZakatReportXLSX(
  orgId: string,
  goldPerGram: number,
  silverPerGram: number,
  orgName: string = 'Organisasi'
): Promise<Buffer> {
  const data = await getZakatSummary(orgId, { goldPerGram, silverPerGram })

  const wb = new ExcelJS.Workbook()
  addWorkbookMetadata(wb, orgName)
  const sheet = wb.addWorksheet('Zakat Tijarah', { pageSetup: { paperSize: 9, orientation: 'portrait' } })

  sheet.columns = [
    { key: 'item', width: 40 },
    { key: 'value', width: 28 },
    { key: 'notes', width: 40 },
  ]

  addNizamHeader(sheet, 'LAPORAN ZAKAT TIJARAH', `Digenerate: ${new Date().toLocaleDateString('id-ID')}`, orgName)

  const scopeRow = sheet.addRow(['CAKUPAN LAPORAN', data.scopeLabel || 'Level Organisasi', 'Zakat Tijarah dihitung untuk seluruh organisasi, bukan per unit.'])
  styleSectionHeader(scopeRow)
  sheet.mergeCells(`C${scopeRow.number}:C${scopeRow.number}`)

  sheet.addRow([])

  // Fiqh parameters
  const fiqhHeader = sheet.addRow(['PARAMETER FIQH', 'NILAI', 'KETERANGAN'])
  styleHeaderRow(fiqhHeader, 'FF2D6A4F')

  const fiqhRows = [
    ['Nishab Emas', `${data.nishabGoldGrams}g × Rp${goldPerGram.toLocaleString('id-ID')}/g`, `= ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(data.nishabGold)}`],
    ['Nishab Perak', `${data.nishabSilverGrams}g × Rp${silverPerGram.toLocaleString('id-ID')}/g`, `= ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(data.nishabSilver)}`],
    ['Tarif Zakat', '2.5%', 'Standar Zakat Tijarah'],
    ['Sumber Harga', data.activeHaul?.gold_price_source || 'Manual Input', data.activeHaul?.gold_price_evidence_url || 'Tidak ada bukti URL'],
  ]
  fiqhRows.forEach((r: any, i: any) => {
    const row = sheet.addRow(r)
    styleDataRow(row, i % 2 === 0)
  })

  sheet.addRow([])

  // Harta Kena Zakat
  const assetHeader = sheet.addRow(['KOMPONEN HARTA ZAKAT', 'SALDO', 'KATEGORI'])
  styleHeaderRow(assetHeader, HEADER_BG)

  data.zakatAssets.forEach((a: any, i: number) => {
    const row = sheet.addRow([
      `${a.code} — ${a.name}`,
      formatRupiahExcel(a.balance),
      a.type
    ])
    styleDataRow(row, i % 2 === 0)
    row.getCell(2).alignment = { horizontal: 'right' }
  })

  sheet.addRow([])
  const totalRow = sheet.addRow(['TOTAL HARTA KENA ZAKAT', formatRupiahExcel(data.totalAssets), ''])
  styleTotalRow(totalRow)
  totalRow.getCell(2).alignment = { horizontal: 'right' }

  sheet.addRow([])

  // Verdict
  const verdictHeader = sheet.addRow(['KESIMPULAN', 'NILAI', 'STATUS'])
  styleHeaderRow(verdictHeader, data.isZakatObligated ? 'FF2D6A4F' : 'FF6B7280')

  const verdictRows = [
    ['Wajib Zakat?', data.isZakatObligated ? 'YA' : 'BELUM', data.isZakatObligated ? 'Mencapai nishab' : 'Di bawah nishab'],
    ['Zakat Yang Harus Dibayar', formatRupiahExcel(data.zakatAmount), `2.5% × ${formatRupiahExcel(data.totalAssets)}`],
    ['Status Haul', data.haulStatus, data.haulStartDate ? `Dimulai: ${data.haulStartDate}` : 'Belum ada haul aktif'],
    ['Hari Haul Berjalan', `${data.haulDaysElapsed} hari`, `Sisa: ${data.haulDaysRemaining} hari menuju 354 hari (1 tahun Hijriah)`],
  ]

  verdictRows.forEach((r: any, i: any) => {
    const row = sheet.addRow(r)
    styleDataRow(row, i % 2 === 0)
    row.getCell(2).font = { bold: true, size: 10 }
  })

  // Disclaimer
  sheet.addRow([])
  const disRow = sheet.addRow(['DISCLAIMER', '', ''])
  disRow.getCell(1).value = '⚠ Laporan ini dihasilkan otomatis berdasarkan data akuntansi di NIZAM ERP. Untuk keputusan zakat final, konsultasikan dengan Lembaga Amil Zakat (LAZ) yang berwenang.'
  disRow.getCell(1).font = { italic: true, size: 8, color: { argb: 'FF999999' } }
  sheet.mergeCells(`A${disRow.number}:C${disRow.number}`)

  return Buffer.from(await wb.xlsx.writeBuffer())
}
