import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
const SUBHEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
const EXAMPLE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
const REQUIRED_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }

function applyHeaderStyle(cell: ExcelJS.Cell, text: string, required = false) {
  cell.value = text
  cell.fill = required ? REQUIRED_FILL : SUBHEADER_FILL
  cell.font = { bold: true, size: 9, color: { argb: required ? 'FFEA580C' : 'FFFFFFFF' } }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  }
}

function buildSalesTemplate(wb: ExcelJS.Workbook) {
  // ── Sheet PETUNJUK ────────────────────────────────────────────────────────
  const guide = wb.addWorksheet('PETUNJUK')
  guide.getColumn(1).width = 80
  const lines = [
    ['TEMPLATE BULK IMPORT — PENJUALAN (Sales Order)'],
    [''],
    ['CARA PENGGUNAAN:'],
    ['1. Isi sheet HEADER_PENJUALAN — satu baris per transaksi penjualan.'],
    ['2. Isi sheet ITEM_PENJUALAN — satu baris per produk. Kolom row_no harus sama dengan row_no di header.'],
    ['3. Kolom berwarna ORANYE = WAJIB diisi.'],
    ['4. Kolom berwarna HIJAU = Contoh data yang bisa dihapus.'],
    [''],
    ['ATURAN PENTING:'],
    ['• row_no harus angka unik per transaksi (tidak harus berurutan).'],
    ['• tanggal format: YYYY-MM-DD, contoh: 2025-01-15'],
    ['• nama_customer harus SAMA PERSIS dengan nama kontak di database Nizam.'],
    ['• termin: tulis LUNAS atau TEMPO (huruf kapital).'],
    ['• jatuh_tempo wajib diisi jika termin = TEMPO.'],
    ['• pajak_persen: angka 0-100, misal 11 untuk PPN 11%.'],
    ['• diskon_global & diskon_item: nominal dalam Rupiah, bukan persen.'],
    ['• Semua transaksi akan disimpan sebagai DRAFT untuk direview sebelum diposting.'],
    [''],
    ['PERTANYAAN? Hubungi tim support Nizam.'],
  ]
  lines.forEach(([text], i) => {
    const row = guide.getRow(i + 1)
    row.getCell(1).value = text
    if (i === 0) {
      row.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } }
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
    } else if (i === 2 || i === 8) {
      row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E293B' } }
    } else {
      row.getCell(1).font = { size: 10, color: { argb: 'FF475569' } }
    }
    row.height = i === 0 ? 28 : 18
  })

  // ── Sheet HEADER_PENJUALAN ────────────────────────────────────────────────
  const hs = wb.addWorksheet('HEADER_PENJUALAN')
  const headerCols = [
    { key: 'row_no', width: 8, label: 'row_no*', required: true },
    { key: 'tanggal', width: 14, label: 'tanggal*', required: true },
    { key: 'nama_customer', width: 28, label: 'nama_customer*', required: true },
    { key: 'termin', width: 10, label: 'termin*', required: true },
    { key: 'jatuh_tempo', width: 14, label: 'jatuh_tempo', required: false },
    { key: 'diskon_global', width: 16, label: 'diskon_global', required: false },
    { key: 'pajak_persen', width: 12, label: 'pajak_persen', required: false },
    { key: 'biaya_lain_label', width: 22, label: 'biaya_lain_label', required: false },
    { key: 'biaya_lain_nominal', width: 20, label: 'biaya_lain_nominal', required: false },
    { key: 'catatan', width: 30, label: 'catatan', required: false },
  ]
  headerCols.forEach((c, i) => {
    hs.getColumn(i + 1).width = c.width
    applyHeaderStyle(hs.getRow(1).getCell(i + 1), c.label, c.required)
  })
  hs.getRow(1).height = 24

  // Title row
  const titleCell = hs.getRow(0).getCell(1)
  hs.spliceRows(1, 0, [])
  hs.getRow(1).height = 28
  const t = hs.getRow(1).getCell(1)
  t.value = 'HEADER PENJUALAN — Satu baris = Satu transaksi'
  t.fill = HEADER_FILL
  t.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  t.alignment = { vertical: 'middle' }
  hs.mergeCells(1, 1, 1, headerCols.length)

  // Column header row (row 2)
  headerCols.forEach((c, i) => applyHeaderStyle(hs.getRow(2).getCell(i + 1), c.label, c.required))
  hs.getRow(2).height = 22

  // Example row (row 3)
  const ex = hs.getRow(3)
  ex.values = ['', 1, '2025-01-15', 'Toko Maju Jaya', 'TEMPO', '2025-02-15', 0, 11, 'Ongkos Kirim', 25000, 'Pesanan batch Januari']
  ex.eachCell(cell => { cell.fill = EXAMPLE_FILL; cell.font = { size: 9, color: { argb: 'FF166534' }, italic: true } })
  ex.height = 18

  // Data validation: termin
  for (let r = 4; r <= 1000; r++) {
    hs.getCell(r, 4).dataValidation = { type: 'list', formulae: ['"LUNAS,TEMPO"'], showErrorMessage: true }
  }

  // ── Sheet ITEM_PENJUALAN ──────────────────────────────────────────────────
  const is = wb.addWorksheet('ITEM_PENJUALAN')
  const itemCols = [
    { key: 'row_no', width: 8, label: 'row_no*', required: true },
    { key: 'nama_produk', width: 32, label: 'nama_produk*', required: true },
    { key: 'jumlah', width: 10, label: 'jumlah*', required: true },
    { key: 'satuan', width: 10, label: 'satuan', required: false },
    { key: 'harga_satuan', width: 16, label: 'harga_satuan*', required: true },
    { key: 'diskon_item', width: 14, label: 'diskon_item', required: false },
  ]
  const iTitle = is.getRow(1)
  iTitle.height = 28
  const iT = iTitle.getCell(1)
  iT.value = 'ITEM PENJUALAN — Satu baris = Satu produk, row_no harus sama dengan header'
  iT.fill = HEADER_FILL
  iT.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  iT.alignment = { vertical: 'middle' }
  is.mergeCells(1, 1, 1, itemCols.length)

  itemCols.forEach((c, i) => {
    is.getColumn(i + 1).width = c.width
    applyHeaderStyle(is.getRow(2).getCell(i + 1), c.label, c.required)
  })
  is.getRow(2).height = 22

  // Example items
  const exItems = [
    [1, 'Meja Kantor Kayu Jati', 2, 'Unit', 1500000, 0],
    [1, 'Kursi Ergonomik', 4, 'Unit', 850000, 50000],
    [2, 'Laptop Lenovo ThinkPad', 1, 'Unit', 12000000, 0],
  ]
  exItems.forEach((data, i) => {
    const r = is.getRow(3 + i)
    r.values = ['', ...data]
    r.eachCell(cell => { cell.fill = EXAMPLE_FILL; cell.font = { size: 9, color: { argb: 'FF166534' }, italic: true } })
    r.height = 18
  })
}

function buildPurchaseTemplate(wb: ExcelJS.Workbook) {
  // ── Sheet PETUNJUK ────────────────────────────────────────────────────────
  const guide = wb.addWorksheet('PETUNJUK')
  guide.getColumn(1).width = 80
  const lines = [
    ['TEMPLATE BULK IMPORT — PEMBELIAN (Purchase Order)'],
    [''],
    ['CARA PENGGUNAAN:'],
    ['1. Isi sheet HEADER_PEMBELIAN — satu baris per transaksi pembelian.'],
    ['2. Isi sheet ITEM_PEMBELIAN — satu baris per produk. Kolom row_no harus sama dengan header.'],
    ['3. Kolom berwarna ORANYE = WAJIB diisi.'],
    ['4. Kolom berwarna HIJAU = Contoh data yang bisa dihapus.'],
    [''],
    ['ATURAN PENTING:'],
    ['• row_no harus angka unik per transaksi.'],
    ['• tanggal format: YYYY-MM-DD, contoh: 2025-01-15'],
    ['• nama_vendor harus SAMA PERSIS dengan nama kontak Supplier di database Nizam.'],
    ['• termin: tulis LUNAS atau TEMPO (huruf kapital).'],
    ['• pajak_persen: angka 0-100, misal 11 untuk PPN 11%.'],
    ['• biaya_kirim & asuransi: akan dialokasikan proporsional ke setiap item (landed cost).'],
    ['• Semua transaksi akan disimpan sebagai DRAFT untuk direview sebelum diposting.'],
    [''],
    ['PERTANYAAN? Hubungi tim support Nizam.'],
  ]
  lines.forEach(([text], i) => {
    const row = guide.getRow(i + 1)
    row.getCell(1).value = text
    if (i === 0) {
      row.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } }
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
    } else if (i === 2 || i === 8) {
      row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E293B' } }
    } else {
      row.getCell(1).font = { size: 10, color: { argb: 'FF475569' } }
    }
    row.height = i === 0 ? 28 : 18
  })

  // ── Sheet HEADER_PEMBELIAN ─────────────────────────────────────────────────
  const hs = wb.addWorksheet('HEADER_PEMBELIAN')
  const headerCols = [
    { key: 'row_no', width: 8, label: 'row_no*', required: true },
    { key: 'tanggal', width: 14, label: 'tanggal*', required: true },
    { key: 'nama_vendor', width: 28, label: 'nama_vendor*', required: true },
    { key: 'termin', width: 10, label: 'termin*', required: true },
    { key: 'jatuh_tempo', width: 14, label: 'jatuh_tempo', required: false },
    { key: 'diskon_global', width: 16, label: 'diskon_global', required: false },
    { key: 'pajak_persen', width: 12, label: 'pajak_persen', required: false },
    { key: 'biaya_kirim', width: 14, label: 'biaya_kirim', required: false },
    { key: 'asuransi', width: 12, label: 'asuransi', required: false },
    { key: 'catatan', width: 30, label: 'catatan', required: false },
  ]
  const hTitle = hs.getRow(1)
  hTitle.height = 28
  const hT = hTitle.getCell(1)
  hT.value = 'HEADER PEMBELIAN — Satu baris = Satu transaksi'
  hT.fill = HEADER_FILL
  hT.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  hT.alignment = { vertical: 'middle' }
  hs.mergeCells(1, 1, 1, headerCols.length)

  headerCols.forEach((c, i) => {
    hs.getColumn(i + 1).width = c.width
    applyHeaderStyle(hs.getRow(2).getCell(i + 1), c.label, c.required)
  })
  hs.getRow(2).height = 22

  const ex = hs.getRow(3)
  ex.values = ['', 1, '2025-01-15', 'PT Supplier Utama', 'TEMPO', '2025-02-15', 0, 11, 50000, 10000, 'PO batch Januari']
  ex.eachCell(cell => { cell.fill = EXAMPLE_FILL; cell.font = { size: 9, color: { argb: 'FF166534' }, italic: true } })
  ex.height = 18

  for (let r = 4; r <= 1000; r++) {
    hs.getCell(r, 4).dataValidation = { type: 'list', formulae: ['"LUNAS,TEMPO"'], showErrorMessage: true }
  }

  // ── Sheet ITEM_PEMBELIAN ──────────────────────────────────────────────────
  const is = wb.addWorksheet('ITEM_PEMBELIAN')
  const itemCols = [
    { key: 'row_no', width: 8, label: 'row_no*', required: true },
    { key: 'nama_produk', width: 32, label: 'nama_produk*', required: true },
    { key: 'jumlah', width: 10, label: 'jumlah*', required: true },
    { key: 'satuan', width: 10, label: 'satuan', required: false },
    { key: 'harga_beli', width: 16, label: 'harga_beli*', required: true },
    { key: 'diskon_item', width: 14, label: 'diskon_item', required: false },
  ]
  const iTitle = is.getRow(1)
  iTitle.height = 28
  const iT = iTitle.getCell(1)
  iT.value = 'ITEM PEMBELIAN — Satu baris = Satu produk, row_no harus sama dengan header'
  iT.fill = HEADER_FILL
  iT.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  iT.alignment = { vertical: 'middle' }
  is.mergeCells(1, 1, 1, itemCols.length)

  itemCols.forEach((c, i) => {
    is.getColumn(i + 1).width = c.width
    applyHeaderStyle(is.getRow(2).getCell(i + 1), c.label, c.required)
  })
  is.getRow(2).height = 22

  const exItems = [
    [1, 'Bahan Baku Kayu Jati', 100, 'Kg', 85000, 0],
    [1, 'Lem Kayu Premium', 20, 'Liter', 45000, 0],
    [2, 'Kain Kulit Sintetis', 50, 'Meter', 120000, 5000],
  ]
  exItems.forEach((data, i) => {
    const r = is.getRow(3 + i)
    r.values = ['', ...data]
    r.eachCell(cell => { cell.fill = EXAMPLE_FILL; cell.font = { size: 9, color: { argb: 'FF166534' }, italic: true } })
    r.height = 18
  })
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') ?? 'sales'

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Nizam ERP'
  wb.created = new Date()

  if (type === 'purchase') {
    buildPurchaseTemplate(wb)
  } else {
    buildSalesTemplate(wb)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const filename = type === 'purchase'
    ? 'template-bulk-pembelian.xlsx'
    : 'template-bulk-penjualan.xlsx'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
