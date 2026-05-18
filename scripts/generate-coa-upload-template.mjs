/**
 * generate-coa-upload-template.mjs
 * Generates CoA_Template_NIZAM.xlsx — a ready-to-customize CoA template
 * in the format expected by /api/accounting/coa/upload (uploadCoAFromExcel).
 *
 * Sheet 1 "CoA" : data sheet (read by uploadCoAFromExcel via getWorksheet(1))
 * Sheet 2 "Petunjuk" : instructions for the user
 *
 * Run: node scripts/generate-coa-upload-template.mjs
 */

import ExcelJS from 'exceljs'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ─── Warna per tipe akun ───────────────────────────────────────────────────
const TYPE_META = {
  ASSET:     { label: 'Aset',        header: 'FF1D4ED8', fill: 'FFDBEAFE' },
  LIABILITY: { label: 'Liabilitas',  header: 'FFB45309', fill: 'FFFEF3C7' },
  EQUITY:    { label: 'Ekuitas',     header: 'FF6D28D9', fill: 'FFEDE9FE' },
  REVENUE:   { label: 'Pendapatan',  header: 'FF065F46', fill: 'FFD1FAE5' },
  EXPENSE:   { label: 'Beban',       header: 'FFBE185D', fill: 'FFFCE7F3' },
}

// ─── Data: 67 akun PSAK standar Nizam ─────────────────────────────────────
// Sumber: STANDARD_PSAK_COA_TEMPLATE di modules/accounting/actions/coa.actions.ts
const PSAK_ACCOUNTS = [
  // ASET
  { code: '1000', name: 'Aset',                               type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '' },
  { code: '1100', name: 'Aset Lancar',                        type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1101', name: 'Kas Besar',                          type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1102', name: 'Kas Kecil (Petty Cash)',             type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1103', name: 'Bank - Rekening Operasional',        type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1104', name: 'Bank - Rekening Payroll',            type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1105', name: 'Bank - Rekening Lainnya',            type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1201', name: 'Piutang Usaha',                      type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1202', name: 'Piutang Karyawan',                   type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1203', name: 'Cadangan Kerugian Piutang',          type: 'ASSET',     normal_balance: 'CREDIT', parent_code: '1000' },
  { code: '1301', name: 'Persediaan Barang Dagangan',         type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1302', name: 'Persediaan Barang Dalam Proses',     type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1303', name: 'Persediaan Bahan Baku',              type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1304', name: 'Persediaan Barang Jadi',             type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1401', name: 'PPN Masukan (Pajak Dibayar)',        type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1402', name: 'Biaya Dibayar Dimuka',               type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1403', name: 'Uang Muka Pembelian',                type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1500', name: 'Aset Tetap',                         type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1501', name: 'Tanah',                              type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1502', name: 'Bangunan',                           type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1503', name: 'Akumulasi Penyusutan Bangunan',      type: 'ASSET',     normal_balance: 'CREDIT', parent_code: '1000' },
  { code: '1504', name: 'Kendaraan',                          type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1505', name: 'Akumulasi Penyusutan Kendaraan',     type: 'ASSET',     normal_balance: 'CREDIT', parent_code: '1000' },
  { code: '1506', name: 'Peralatan & Mesin',                  type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1507', name: 'Akumulasi Penyusutan Peralatan',     type: 'ASSET',     normal_balance: 'CREDIT', parent_code: '1000' },
  { code: '1600', name: 'Investasi Jangka Panjang',           type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1601', name: 'Investasi pada Entitas Anak / Unit', type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1600' },
  // LIABILITAS
  { code: '2000', name: 'Liabilitas',                         type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '' },
  { code: '2101', name: 'Hutang Usaha',                       type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2102', name: 'Hutang Bank Jangka Pendek',          type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2201', name: 'PPN Keluaran (Pajak Dipungut)',       type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2202', name: 'Hutang PPh 21',                      type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2203', name: 'Hutang PPh 23',                      type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2204', name: 'Hutang PPh Badan',                   type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2301', name: 'Pendapatan Diterima di Muka',        type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2302', name: 'Uang Muka Penjualan',                type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2401', name: 'Hutang Gaji',                        type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2501', name: 'Hutang Bank Jangka Panjang',         type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  // EKUITAS
  { code: '3000', name: 'Ekuitas',                            type: 'EQUITY',    normal_balance: 'CREDIT', parent_code: '' },
  { code: '3001', name: 'Modal Disetor',                      type: 'EQUITY',    normal_balance: 'CREDIT', parent_code: '3000' },
  { code: '3002', name: 'Laba Ditahan',                       type: 'EQUITY',    normal_balance: 'CREDIT', parent_code: '3000' },
  { code: '3003', name: 'Laba Periode Berjalan',              type: 'EQUITY',    normal_balance: 'CREDIT', parent_code: '3000' },
  { code: '3004', name: 'Prive / Dividen',                    type: 'EQUITY',    normal_balance: 'DEBIT',  parent_code: '3000' },
  // PENDAPATAN
  { code: '4000', name: 'Pendapatan',                         type: 'REVENUE',   normal_balance: 'CREDIT', parent_code: '' },
  { code: '4001', name: 'Pendapatan Usaha',                   type: 'REVENUE',   normal_balance: 'CREDIT', parent_code: '4000' },
  { code: '4002', name: 'Diskon Penjualan (Contra)',          type: 'REVENUE',   normal_balance: 'DEBIT',  parent_code: '4000' },
  { code: '4003', name: 'Retur Penjualan',                    type: 'REVENUE',   normal_balance: 'DEBIT',  parent_code: '4000' },
  { code: '4101', name: 'Pendapatan Bunga',                   type: 'REVENUE',   normal_balance: 'CREDIT', parent_code: '4000' },
  { code: '4102', name: 'Pendapatan Lain-lain',               type: 'REVENUE',   normal_balance: 'CREDIT', parent_code: '4000' },
  // BEBAN POKOK
  { code: '5000', name: 'Beban Pokok Penjualan',              type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '' },
  { code: '5001', name: 'HPP / Cost of Goods Sold',           type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '5000' },
  { code: '5002', name: 'Biaya Pengiriman Masuk (Freight In)',type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '5000' },
  { code: '5003', name: 'Retur Pembelian (Contra)',           type: 'EXPENSE',   normal_balance: 'CREDIT', parent_code: '5000' },
  // BEBAN OPERASIONAL
  { code: '6000', name: 'Beban Operasional',                  type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '' },
  { code: '6001', name: 'Gaji & Tunjangan',                   type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6002', name: 'Sewa Tempat',                        type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6003', name: 'Utilitas (Listrik, Air, Internet)',  type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6004', name: 'Perlengkapan Kantor',                type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6005', name: 'Biaya Pemasaran & Iklan',            type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6006', name: 'Biaya Transportasi',                 type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6007', name: 'Biaya Perbaikan & Pemeliharaan',     type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6008', name: 'Biaya Asuransi',                     type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6009', name: 'Biaya Penyusutan',                   type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6010', name: 'Biaya Profesional & Konsultan',      type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6099', name: 'Beban Lain-lain',                    type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6101', name: 'Biaya Bunga Pinjaman',               type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────
function headerFill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function applyHeaderStyle(cell, argb) {
  cell.fill = headerFill(argb)
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
  cell.border = {
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  }
}

function applyGroupLabelStyle(cell, fillArgb, fontArgb) {
  cell.fill = headerFill(fillArgb)
  cell.font = { bold: true, color: { argb: fontArgb }, size: 9, italic: true }
  cell.alignment = { vertical: 'middle', horizontal: 'left' }
}

function applyDataStyle(cell, fillArgb, isParentRow) {
  cell.fill = headerFill(fillArgb)
  if (isParentRow) {
    cell.font = { bold: true, size: 9 }
  } else {
    cell.font = { size: 9 }
  }
  cell.alignment = { vertical: 'middle', horizontal: 'left' }
}

// ─── Sheet 1: Data CoA ─────────────────────────────────────────────────────
function buildCoADataSheet(wb) {
  const ws = wb.addWorksheet('CoA')

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // Column definitions
  ws.columns = [
    { key: 'code',           width: 10, header: 'code' },
    { key: 'name',           width: 42, header: 'name' },
    { key: 'type',           width: 14, header: 'type' },
    { key: 'normal_balance', width: 16, header: 'normal_balance' },
    { key: 'parent_code',   width: 14, header: 'parent_code' },
    { key: 'description',   width: 36, header: 'description' },
  ]

  // Header row styling
  const headerRow = ws.getRow(1)
  headerRow.height = 22
  const HEADER_BG = 'FF1E3A5F'
  ;['code', 'name', 'type', 'normal_balance', 'parent_code', 'description'].forEach((key, i) => {
    applyHeaderStyle(headerRow.getCell(i + 1), HEADER_BG)
  })

  // Track which type we're currently rendering to add group separators
  let currentType = null

  for (const account of PSAK_ACCOUNTS) {
    const meta = TYPE_META[account.type]
    const isParentRow = !account.parent_code // top-level akun (1000, 2000, dst)

    // Add a thin group-label row when type changes
    if (account.type !== currentType) {
      currentType = account.type
      const groupRow = ws.addRow(['', `── ${meta.label.toUpperCase()} ──`, '', '', '', ''])
      groupRow.height = 16
      for (let c = 1; c <= 6; c++) {
        applyGroupLabelStyle(groupRow.getCell(c), meta.fill, meta.header)
      }
    }

    const dataRow = ws.addRow({
      code:           account.code,
      name:           account.name,
      type:           account.type,
      normal_balance: account.normal_balance,
      parent_code:    account.parent_code || '',
      description:    '',
    })
    dataRow.height = 16

    const rowFill = isParentRow ? meta.fill : 'FFFFFFFF'
    for (let c = 1; c <= 6; c++) {
      applyDataStyle(dataRow.getCell(c), rowFill, isParentRow)
    }
  }

  // Add data validation for 'type' column
  ws.dataValidations.add('C2:C2000', {
    type: 'list',
    allowBlank: false,
    formulae: ['"ASSET,LIABILITY,EQUITY,REVENUE,EXPENSE"'],
    showErrorMessage: true,
    errorTitle: 'Nilai tidak valid',
    error: 'Isi dengan salah satu: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE',
  })

  // Add data validation for 'normal_balance' column
  ws.dataValidations.add('D2:D2000', {
    type: 'list',
    allowBlank: false,
    formulae: ['"DEBIT,CREDIT"'],
    showErrorMessage: true,
    errorTitle: 'Nilai tidak valid',
    error: 'Isi dengan DEBIT atau CREDIT',
  })

  return ws
}

// ─── Sheet 2: Petunjuk ─────────────────────────────────────────────────────
function buildInstructionSheet(wb) {
  const ws = wb.addWorksheet('Petunjuk')
  ws.columns = [
    { width: 22 },
    { width: 60 },
  ]

  const addTitle = (text) => {
    const row = ws.addRow([text])
    row.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } }
    row.height = 24
    ws.mergeCells(`A${row.number}:B${row.number}`)
  }

  const addSubtitle = (text) => {
    const row = ws.addRow([text])
    row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF374151' } }
    row.height = 18
    ws.mergeCells(`A${row.number}:B${row.number}`)
  }

  const addNote = (label, value) => {
    const row = ws.addRow([label, value])
    row.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF6B7280' } }
    row.getCell(2).font = { size: 9, color: { argb: 'FF111827' } }
    row.height = 16
  }

  const addBlank = () => ws.addRow([])

  addTitle('Template CoA — Standar PSAK Nizam')
  addBlank()

  addSubtitle('Cara Penggunaan')
  addNote('1.', 'Edit sheet "CoA" — tambah, ubah, atau hapus baris sesuai kebutuhan bisnis Anda.')
  addNote('2.', 'Jangan ubah nama header di baris pertama (code, name, type, dll).')
  addNote('3.', 'Simpan file dalam format .xlsx.')
  addNote('4.', 'Upload via menu: Pengaturan → Chart of Accounts → tombol "Upload CoA".')
  addBlank()

  addSubtitle('Kolom Wajib')
  addNote('code',           'Kode unik akun (contoh: 1101). Boleh huruf dan angka.')
  addNote('name',           'Nama lengkap akun.')
  addNote('type',           'Tipe: ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE')
  addNote('normal_balance', 'Saldo normal: DEBIT | CREDIT')
  addBlank()

  addSubtitle('Kolom Opsional')
  addNote('parent_code',  'Kode akun induk. Kosongkan jika akun adalah root.')
  addNote('description',  'Keterangan tambahan.')
  addBlank()

  addSubtitle('Aturan Tipe Akun')
  for (const [type, meta] of Object.entries(TYPE_META)) {
    addNote(type, meta.label)
  }
  addBlank()

  addSubtitle('Catatan Penting')
  addNote('•', 'Akun yang sudah ada (kode sama) akan diperbarui, bukan digandakan.')
  addNote('•', 'Akun sistem (is_system = true) tetap dipertahankan meski tidak ada di file.')
  addNote('•', 'Baris kosong (code atau name kosong) akan diabaikan otomatis.')
  addNote('•', 'Group-label warna (baris ── ASET ──, dll) adalah dekorasi — abaikan atau hapus.')
  addNote('•', 'Ukuran file maksimal 5 MB.')
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'NIZAM ERP'
  wb.created = new Date()
  wb.modified = new Date()

  buildCoADataSheet(wb)
  buildInstructionSheet(wb)

  const outDir = path.join(ROOT, 'public', 'templates')
  fs.mkdirSync(outDir, { recursive: true })

  const outPath = path.join(outDir, 'CoA_Template_NIZAM.xlsx')
  await wb.xlsx.writeFile(outPath)

  const size = (fs.statSync(outPath).size / 1024).toFixed(1)
  console.log(`✓ CoA template dibuat: ${outPath} (${size} KB, ${PSAK_ACCOUNTS.length} akun)`)
}

main().catch((err) => {
  console.error('✗ Gagal generate CoA template:', err)
  process.exit(1)
})
