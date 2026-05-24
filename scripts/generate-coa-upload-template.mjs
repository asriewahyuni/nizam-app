/**
 * generate-coa-upload-template.mjs
 * Menghasilkan CoA_Template_Standar_NIZAM.xlsx — template CoA siap pakai
 * sesuai standar PSAK Indonesia dengan hierarki parent-child yang benar.
 *
 * Format yang dihasilkan kompatibel dengan uploadCoAFromExcel di:
 *   /api/accounting/coa/upload
 *
 * Sheet 1 "CoA"     : data akun (dibaca otomatis saat upload)
 * Sheet 2 "Petunjuk": panduan penggunaan
 *
 * Run: node scripts/generate-coa-upload-template.mjs
 * atau: npm run templates:coa
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

/**
 * Hierarki CoA Standar PSAK (Indonesia PSAK 1) — selaras dengan
 * STANDARD_PSAK_COA_TEMPLATE di modules/accounting/actions/coa.actions.ts
 *
 * Hierarki:
 * 1000 Aset
 *   1100 Aset Lancar
 *     1101-1105  Kas & Bank              ← parent: 1100
 *     1200 Piutang (grup)               ← parent: 1100
 *       1201-1203 Piutang detail        ← parent: 1200
 *     1300 Persediaan (grup)            ← parent: 1100
 *       1301-1304 Persediaan detail     ← parent: 1300
 *     1400 Aset Lancar Lainnya (grup)   ← parent: 1100
 *       1401-1403 detail               ← parent: 1400
 *   1500 Aset Tetap                     ← parent: 1000
 *     1501-1507  detail                 ← parent: 1500
 *   1600 Investasi Jangka Panjang       ← parent: 1000
 *     1601       detail                 ← parent: 1600
 *
 * 2000 Liabilitas
 *   2100 Hutang Lancar                  ← parent: 2000
 *     2101-2102  detail                 ← parent: 2100
 *   2200 Hutang Pajak                   ← parent: 2000
 *     2201-2204  detail                 ← parent: 2200
 *   2300 Pendapatan Diterima di Muka    ← parent: 2000
 *     2301-2302  detail                 ← parent: 2300
 *   2400 Hutang Jangka Pendek Lainnya  ← parent: 2000
 *     2401       detail                 ← parent: 2400
 *   2500 Hutang Jangka Panjang          ← parent: 2000
 *     2501       detail                 ← parent: 2500
 *
 * 3000 Ekuitas
 *   3001-3004                           ← parent: 3000
 *
 * 4000 Pendapatan
 *   4001-4003  Pendapatan Usaha         ← parent: 4000
 *   4100 Pendapatan Non-Usaha           ← parent: 4000
 *     4101-4102  detail                 ← parent: 4100
 *
 * 5000 Beban Pokok Penjualan
 *   5001-5003                           ← parent: 5000
 *
 * 6000 Beban Operasional
 *   6001-6099  Beban Operasional        ← parent: 6000
 *   6100 Beban Non-Operasional          ← parent: 6000
 *     6101       detail                 ← parent: 6100
 */
const PSAK_ACCOUNTS = [
  // ── ASET ──────────────────────────────────────────────────────────────────
  { code: '1000', name: 'Aset',                               type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '' },
  { code: '1100', name: 'Aset Lancar',                        type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  // Kas & Bank
  { code: '1101', name: 'Kas Besar',                          type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1100' },
  { code: '1102', name: 'Kas Kecil (Petty Cash)',             type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1100' },
  { code: '1103', name: 'Bank - Rekening Operasional',        type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1100' },
  { code: '1104', name: 'Bank - Rekening Payroll',            type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1100' },
  { code: '1105', name: 'Bank - Rekening Lainnya',            type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1100' },
  // Piutang
  { code: '1200', name: 'Piutang',                            type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1100' },
  { code: '1201', name: 'Piutang Usaha',                      type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1200' },
  { code: '1202', name: 'Piutang Karyawan',                   type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1200' },
  { code: '1203', name: 'Cadangan Kerugian Piutang',          type: 'ASSET',     normal_balance: 'CREDIT', parent_code: '1200' },
  // Persediaan
  { code: '1300', name: 'Persediaan',                         type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1100' },
  { code: '1301', name: 'Persediaan Barang Dagangan',         type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1300' },
  { code: '1302', name: 'Persediaan Barang Dalam Proses',     type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1300' },
  { code: '1303', name: 'Persediaan Bahan Baku',              type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1300' },
  { code: '1304', name: 'Persediaan Barang Jadi',             type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1300' },
  // Aset Lancar Lainnya
  { code: '1400', name: 'Aset Lancar Lainnya',                type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1100' },
  { code: '1401', name: 'PPN Masukan (Pajak Dibayar)',        type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1400' },
  { code: '1402', name: 'Biaya Dibayar Dimuka',               type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1400' },
  { code: '1403', name: 'Uang Muka Pembelian',                type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1400' },
  // Aset Tetap
  { code: '1500', name: 'Aset Tetap',                         type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1501', name: 'Tanah',                              type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1500' },
  { code: '1502', name: 'Bangunan',                           type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1500' },
  { code: '1503', name: 'Akumulasi Penyusutan Bangunan',      type: 'ASSET',     normal_balance: 'CREDIT', parent_code: '1500' },
  { code: '1504', name: 'Kendaraan',                          type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1500' },
  { code: '1505', name: 'Akumulasi Penyusutan Kendaraan',     type: 'ASSET',     normal_balance: 'CREDIT', parent_code: '1500' },
  { code: '1506', name: 'Peralatan & Mesin',                  type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1500' },
  { code: '1507', name: 'Akumulasi Penyusutan Peralatan',     type: 'ASSET',     normal_balance: 'CREDIT', parent_code: '1500' },
  // Investasi Jangka Panjang
  { code: '1600', name: 'Investasi Jangka Panjang',           type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1000' },
  { code: '1601', name: 'Investasi pada Entitas Anak / Unit', type: 'ASSET',     normal_balance: 'DEBIT',  parent_code: '1600' },
  // ── LIABILITAS ────────────────────────────────────────────────────────────
  { code: '2000', name: 'Liabilitas',                         type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '' },
  // Hutang Lancar
  { code: '2100', name: 'Hutang Lancar',                      type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2101', name: 'Hutang Usaha',                       type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2100' },
  { code: '2102', name: 'Hutang Bank Jangka Pendek',          type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2100' },
  // Hutang Pajak
  { code: '2200', name: 'Hutang Pajak',                       type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2201', name: 'PPN Keluaran (Pajak Dipungut)',       type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2200' },
  { code: '2202', name: 'Hutang PPh 21',                      type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2200' },
  { code: '2203', name: 'Hutang PPh 23',                      type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2200' },
  { code: '2204', name: 'Hutang PPh Badan',                   type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2200' },
  // Pendapatan Diterima di Muka
  { code: '2300', name: 'Pendapatan Diterima di Muka',        type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2301', name: 'Pendapatan Diterima di Muka',        type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2300' },
  { code: '2302', name: 'Uang Muka Penjualan',                type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2300' },
  // Hutang Jangka Pendek Lainnya
  { code: '2400', name: 'Hutang Jangka Pendek Lainnya',       type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2401', name: 'Hutang Gaji',                        type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2400' },
  // Hutang Jangka Panjang
  { code: '2500', name: 'Hutang Jangka Panjang',              type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2000' },
  { code: '2501', name: 'Hutang Bank Jangka Panjang',         type: 'LIABILITY', normal_balance: 'CREDIT', parent_code: '2500' },
  // ── EKUITAS ───────────────────────────────────────────────────────────────
  { code: '3000', name: 'Ekuitas',                            type: 'EQUITY',    normal_balance: 'CREDIT', parent_code: '' },
  { code: '3001', name: 'Modal Disetor',                      type: 'EQUITY',    normal_balance: 'CREDIT', parent_code: '3000' },
  { code: '3002', name: 'Laba Ditahan',                       type: 'EQUITY',    normal_balance: 'CREDIT', parent_code: '3000' },
  { code: '3003', name: 'Laba Periode Berjalan',              type: 'EQUITY',    normal_balance: 'CREDIT', parent_code: '3000' },
  { code: '3004', name: 'Prive / Dividen',                    type: 'EQUITY',    normal_balance: 'DEBIT',  parent_code: '3000' },
  // ── PENDAPATAN ────────────────────────────────────────────────────────────
  { code: '4000', name: 'Pendapatan',                         type: 'REVENUE',   normal_balance: 'CREDIT', parent_code: '' },
  { code: '4001', name: 'Pendapatan Usaha',                   type: 'REVENUE',   normal_balance: 'CREDIT', parent_code: '4000' },
  { code: '4002', name: 'Diskon Penjualan (Contra)',          type: 'REVENUE',   normal_balance: 'DEBIT',  parent_code: '4000' },
  { code: '4003', name: 'Retur Penjualan',                    type: 'REVENUE',   normal_balance: 'DEBIT',  parent_code: '4000' },
  // Pendapatan Non-Usaha
  { code: '4100', name: 'Pendapatan Non-Usaha',               type: 'REVENUE',   normal_balance: 'CREDIT', parent_code: '4000' },
  { code: '4101', name: 'Pendapatan Bunga',                   type: 'REVENUE',   normal_balance: 'CREDIT', parent_code: '4100' },
  { code: '4102', name: 'Pendapatan Lain-lain',               type: 'REVENUE',   normal_balance: 'CREDIT', parent_code: '4100' },
  // ── BEBAN POKOK PENJUALAN ─────────────────────────────────────────────────
  { code: '5000', name: 'Beban Pokok Penjualan',              type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '' },
  { code: '5001', name: 'HPP / Cost of Goods Sold',           type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '5000' },
  { code: '5002', name: 'Biaya Pengiriman Masuk (Freight In)',type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '5000' },
  { code: '5003', name: 'Retur Pembelian (Contra)',           type: 'EXPENSE',   normal_balance: 'CREDIT', parent_code: '5000' },
  // ── BEBAN OPERASIONAL ─────────────────────────────────────────────────────
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
  // Beban Non-Operasional
  { code: '6100', name: 'Beban Non-Operasional',              type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6000' },
  { code: '6101', name: 'Biaya Bunga Pinjaman',               type: 'EXPENSE',   normal_balance: 'DEBIT',  parent_code: '6100' },
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

function applyDataStyle(cell, fillArgb, isHeader) {
  cell.fill = headerFill(fillArgb)
  if (isHeader) {
    cell.font = { bold: true, size: 9 }
  } else {
    cell.font = { size: 9 }
  }
  cell.alignment = { vertical: 'middle', horizontal: 'left' }
}

/**
 * Tentukan level indentasi akun berdasarkan kode:
 * - kode tanpa parent (1000, 2000, ...) = level 0 (root)
 * - kode dengan parent pada xx00 → level 1 (grup)
 * - kode detail (leaf) → level 2
 * Digunakan untuk memberi padding nama akun agar hierarki terlihat jelas.
 */
function getIndentLevel(code, parentCode) {
  if (!parentCode) return 0
  // parent adalah root (x000)
  if (/^[1-9]000$/.test(parentCode)) return 1
  // parent adalah grup level 1 (xx00)
  if (/^[1-9][0-9]00$/.test(parentCode)) return 1
  // semua lainnya = level 2
  return 2
}

// ─── Sheet 1: Data CoA ─────────────────────────────────────────────────────
function buildCoADataSheet(wb) {
  const ws = wb.addWorksheet('CoA')

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // Column definitions
  ws.columns = [
    { key: 'code',           width: 10,  header: 'code' },
    { key: 'name',           width: 46,  header: 'name' },
    { key: 'type',           width: 14,  header: 'type' },
    { key: 'normal_balance', width: 16,  header: 'normal_balance' },
    { key: 'parent_code',    width: 14,  header: 'parent_code' },
    { key: 'description',    width: 36,  header: 'description' },
  ]

  // Header row styling
  const headerRow = ws.getRow(1)
  headerRow.height = 22
  const HEADER_BG = 'FF1E3A5F'
  ;['code', 'name', 'type', 'normal_balance', 'parent_code', 'description'].forEach((_key, i) => {
    applyHeaderStyle(headerRow.getCell(i + 1), HEADER_BG)
  })

  // Track type changes for section separators
  let currentType = null

  for (const account of PSAK_ACCOUNTS) {
    const meta = TYPE_META[account.type]
    const isRootAccount = !account.parent_code    // 1000, 2000, 3000 ...
    const isGroupAccount = account.parent_code &&  // 1100, 1200, 1500, 2100 ...
      /^[1-9][0-9]00$/.test(account.code)

    // Section separator saat tipe berubah
    if (account.type !== currentType) {
      currentType = account.type
      const groupRow = ws.addRow(['', `── ${meta.label.toUpperCase()} ──`, '', '', '', ''])
      groupRow.height = 16
      for (let c = 1; c <= 6; c++) {
        applyGroupLabelStyle(groupRow.getCell(c), meta.fill, meta.header)
      }
    }

    // Nama akun dengan indentasi visual sesuai level hierarki
    const level = getIndentLevel(account.code, account.parent_code)
    const indent = '  '.repeat(level) // 2 spasi per level
    const displayName = indent + account.name

    const dataRow = ws.addRow({
      code:           account.code,
      name:           displayName,
      type:           account.type,
      normal_balance: account.normal_balance,
      parent_code:    account.parent_code || '',
      description:    '',
    })
    dataRow.height = 16

    // Warna baris: root/grup lebih gelap, leaf putih
    const rowFill = (isRootAccount || isGroupAccount) ? meta.fill : 'FFFFFFFF'
    for (let c = 1; c <= 6; c++) {
      applyDataStyle(dataRow.getCell(c), rowFill, isRootAccount || isGroupAccount)
    }
  }

  // Data validation: type
  ws.dataValidations.add('C2:C2000', {
    type: 'list',
    allowBlank: false,
    formulae: ['"ASSET,LIABILITY,EQUITY,REVENUE,EXPENSE"'],
    showErrorMessage: true,
    errorTitle: 'Nilai tidak valid',
    error: 'Isi dengan salah satu: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE',
  })

  // Data validation: normal_balance
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
    { width: 24 },
    { width: 64 },
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
  addNote('code',           'Kode unik akun (contoh: 1101). Harus 4 digit angka untuk kompatibilitas PSAK.')
  addNote('name',           'Nama lengkap akun.')
  addNote('type',           'Tipe: ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE')
  addNote('normal_balance', 'Saldo normal: DEBIT | CREDIT')
  addBlank()

  addSubtitle('Kolom Opsional')
  addNote('parent_code',  'Kode akun induk. Kosongkan jika akun adalah root (1000, 2000, dst).')
  addNote('description',  'Keterangan tambahan.')
  addBlank()

  addSubtitle('Hierarki Akun PSAK')
  addNote('Root (1000/2000/...)',  'Akun utama — tidak perlu parent_code.')
  addNote('Grup (1100/1200/...)',  'Akun kelompok — isi parent_code dengan kode root (misal: 1000).')
  addNote('Detail (1101/1201/...)', 'Akun posting — isi parent_code dengan kode grup (misal: 1100, 1200).')
  addNote('Contoh hierarki:',       '1000 → 1100 → 1101 (Kas Besar)')
  addNote('',                        '1000 → 1100 → 1200 → 1201 (Piutang Usaha)')
  addBlank()

  addSubtitle('Catatan Penting')
  addNote('•', 'Akun yang sudah ada (kode sama) akan diperbarui, bukan digandakan.')
  addNote('•', 'Baris kosong (code atau name kosong) akan diabaikan otomatis.')
  addNote('•', 'Baris dekorasi "── ASET ──" (tanpa kode) juga diabaikan otomatis.')
  addNote('•', 'Indentasi spasi pada kolom name hanya untuk tampilan — tidak memengaruhi data.')
  addNote('•', 'Pastikan parent_code ada di file sebelum akun yang merujuknya (urutan top-down).')
  addNote('•', 'Ukuran file maksimal 5 MB.')

  addBlank()
  addSubtitle('Tipe Akun')
  for (const [type, meta] of Object.entries(TYPE_META)) {
    addNote(type, meta.label)
  }
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

  // Nama file sesuai yang direferensikan oleh UploadCoAButton.tsx
  const outPath = path.join(outDir, 'CoA_Template_Standar_NIZAM.xlsx')
  await wb.xlsx.writeFile(outPath)

  const size = (fs.statSync(outPath).size / 1024).toFixed(1)
  console.log(`✓ CoA template dibuat: ${outPath}`)
  console.log(`  ${PSAK_ACCOUNTS.length} akun, ${size} KB`)
  console.log(`  Termasuk grup baru: 1200, 1300, 1400, 2100, 2200, 2300, 2400, 2500, 4100, 6100`)
  console.log(`  Hierarki parent_code telah diperbaiki sesuai PSAK`)
}

main().catch((err) => {
  console.error('✗ Gagal generate CoA template:', err)
  process.exit(1)
})
