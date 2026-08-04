// Generate template Excel bulk import untuk modul Kojasmat (anggota, saldo simpanan awal, proyek)
import { NextResponse } from 'next/server'
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

function addTitleRow(ws: ExcelJS.Worksheet, text: string, colSpan: number) {
  const row = ws.getRow(1)
  row.height = 28
  const cell = row.getCell(1)
  cell.value = text
  cell.fill = HEADER_FILL
  cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
  cell.alignment = { vertical: 'middle' }
  ws.mergeCells(1, 1, 1, colSpan)
}

function addExampleRow(ws: ExcelJS.Worksheet, rowIndex: number, values: (string | number)[]) {
  const r = ws.getRow(rowIndex)
  r.values = ['', ...values]
  r.eachCell(cell => { cell.fill = EXAMPLE_FILL; cell.font = { size: 9, color: { argb: 'FF166534' }, italic: true } })
  r.height = 18
}

export async function GET() {
  try {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Nizam ERP'
    wb.created = new Date()

    // ── Sheet PETUNJUK ──────────────────────────────────────────────────────
    const guide = wb.addWorksheet('PETUNJUK')
    guide.getColumn(1).width = 90
    const lines: [string][] = [
      ['TEMPLATE BULK IMPORT — MODUL KOJASMAT'],
      [''],
      ['CARA PENGGUNAAN:'],
      ['1. Isi sheet ANGGOTA — satu baris per anggota baru. Kolom nik* dipakai sebagai kunci referensi'],
      ['   oleh sheet SIMPANAN_AWAL dan PROYEK di bawah, jadi harus unik dan tidak boleh kosong.'],
      ['2. Isi sheet SIMPANAN_AWAL (opsional) — saldo awal simpanan per anggota, misal migrasi dari sistem lama.'],
      ['3. Isi sheet PROYEK (opsional) — proyek pembiayaan yang diajukan anggota. Proyek akan masuk'],
      ['   berstatus DRAFT dan lanjut lewat alur review DMR/DPS seperti biasa.'],
      ['4. Kolom berwarna ORANYE = WAJIB diisi. Kolom berwarna HIJAU = Contoh data, boleh dihapus.'],
      [''],
      ['ATURAN PENTING:'],
      ['• nik_anggota di sheet SIMPANAN_AWAL dan nik_pengaju di sheet PROYEK boleh merujuk ke anggota'],
      ['  BARU (yang ada di sheet ANGGOTA file ini) ATAU anggota yang SUDAH ADA di sistem.'],
      ['• nik harus 16 digit angka.'],
      ['• status anggota: CALON, AKTIF, TIDAK_AKTIF, atau DIBEKUKAN (default CALON jika kosong).'],
      ['• is_verified: YA atau TIDAK (default TIDAK jika kosong).'],
      ['• jenis simpanan: POKOK, WAJIB, atau SUKARELA.'],
      ['• jenis_akad proyek: MURABAHAH, MUDHARABAH, atau INAN.'],
      ['• tanggal & joined_at format: YYYY-MM-DD, contoh: 2025-01-15. Kosongkan untuk pakai hari ini.'],
      ['• Semua setoran simpanan awal otomatis tercatat ke jurnal akuntansi ERP.'],
      [''],
      ['PERTANYAAN? Hubungi tim support Nizam.'],
    ]
    lines.forEach(([text], i) => {
      const row = guide.getRow(i + 1)
      row.getCell(1).value = text
      if (i === 0) {
        row.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } }
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
      } else if (i === 2 || i === 10) {
        row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF1E293B' } }
      } else {
        row.getCell(1).font = { size: 10, color: { argb: 'FF475569' } }
      }
      row.height = i === 0 ? 28 : 18
    })

    // ── Sheet ANGGOTA ────────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet('ANGGOTA')
    const anggotaCols = [
      { width: 20, label: 'nik*', required: true },
      { width: 26, label: 'nama*', required: true },
      { width: 16, label: 'phone', required: false },
      { width: 24, label: 'email', required: false },
      { width: 30, label: 'alamat', required: false },
      { width: 20, label: 'pekerjaan', required: false },
      { width: 14, label: 'joined_at', required: false },
      { width: 14, label: 'status', required: false },
      { width: 12, label: 'is_verified', required: false },
      { width: 30, label: 'notes', required: false },
    ]
    addTitleRow(ws1, 'ANGGOTA — Satu baris = Satu anggota. nik dipakai sebagai referensi di sheet lain.', anggotaCols.length)
    anggotaCols.forEach((c, i) => {
      ws1.getColumn(i + 1).width = c.width
      applyHeaderStyle(ws1.getRow(2).getCell(i + 1), c.label, c.required)
    })
    ws1.getRow(2).height = 22
    addExampleRow(ws1, 3, ['3374010101990001', 'Ahmad Fauzi', '08112345001', 'ahmad@example.com', 'Jl. Melati No. 1, Yogyakarta', 'Pedagang', '2025-01-15', 'AKTIF', 'YA', ''])
    addExampleRow(ws1, 4, ['3374010202920002', 'Siti Rahayu', '08112345002', '', 'Jl. Kenanga No. 5, Yogyakarta', 'Ibu Rumah Tangga', '2025-02-01', 'CALON', 'TIDAK', ''])
    for (let r = 5; r <= 1000; r++) {
      ws1.getCell(r, 8).dataValidation = { type: 'list', formulae: ['"CALON,AKTIF,TIDAK_AKTIF,DIBEKUKAN"'], showErrorMessage: true }
      ws1.getCell(r, 9).dataValidation = { type: 'list', formulae: ['"YA,TIDAK"'], showErrorMessage: true }
    }
    ws1.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }]

    // ── Sheet SIMPANAN_AWAL ──────────────────────────────────────────────────
    const ws2 = wb.addWorksheet('SIMPANAN_AWAL')
    const simpananCols = [
      { width: 20, label: 'nik_anggota*', required: true },
      { width: 12, label: 'jenis*', required: true },
      { width: 18, label: 'saldo_awal*', required: true },
      { width: 14, label: 'tanggal', required: false },
      { width: 30, label: 'keterangan', required: false },
    ]
    addTitleRow(ws2, 'SALDO SIMPANAN AWAL — Opsional, misal saat migrasi dari sistem lama', simpananCols.length)
    simpananCols.forEach((c, i) => {
      ws2.getColumn(i + 1).width = c.width
      applyHeaderStyle(ws2.getRow(2).getCell(i + 1), c.label, c.required)
    })
    ws2.getRow(2).height = 22
    addExampleRow(ws2, 3, ['3374010101990001', 'POKOK', 500000, '2025-01-15', 'Setoran pokok migrasi'])
    addExampleRow(ws2, 4, ['3374010101990001', 'WAJIB', 250000, '2025-02-15', 'Setoran wajib Bln 1'])
    for (let r = 5; r <= 1000; r++) {
      ws2.getCell(r, 2).dataValidation = { type: 'list', formulae: ['"POKOK,WAJIB,SUKARELA"'], showErrorMessage: true }
      ws2.getCell(r, 3).numFmt = '#,##0'
    }
    ws2.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }]

    // ── Sheet PROYEK ─────────────────────────────────────────────────────────
    const ws3 = wb.addWorksheet('PROYEK')
    const proyekCols = [
      { width: 20, label: 'nik_pengaju*', required: true },
      { width: 28, label: 'nama_proyek*', required: true },
      { width: 14, label: 'jenis_akad*', required: true },
      { width: 18, label: 'kebutuhan_modal*', required: true },
      { width: 16, label: 'ujrah_nominal', required: false },
      { width: 14, label: 'durasi_bulan', required: false },
      { width: 34, label: 'deskripsi', required: false },
      { width: 26, label: 'agunan', required: false },
      { width: 26, label: 'notes', required: false },
    ]
    addTitleRow(ws3, 'PROYEK — Opsional, proyek masuk berstatus DRAFT (lanjut review DMR/DPS seperti biasa)', proyekCols.length)
    proyekCols.forEach((c, i) => {
      ws3.getColumn(i + 1).width = c.width
      applyHeaderStyle(ws3.getRow(2).getCell(i + 1), c.label, c.required)
    })
    ws3.getRow(2).height = 22
    addExampleRow(ws3, 3, ['3374010101990001', 'Warung Makan Bu Siti', 'MUDHARABAH', 5000000, 150000, 6, 'Renovasi warung dan tambah peralatan masak.', 'Sertifikat Tanah SHM No.1234', ''])
    for (let r = 4; r <= 1000; r++) {
      ws3.getCell(r, 3).dataValidation = { type: 'list', formulae: ['"MURABAHAH,MUDHARABAH,INAN"'], showErrorMessage: true }
      ws3.getCell(r, 4).numFmt = '#,##0'
      ws3.getCell(r, 5).numFmt = '#,##0'
    }
    ws3.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }]

    const buffer = await wb.xlsx.writeBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-bulk-kojasmat.xlsx"',
      },
    })
  } catch (err) {
    console.warn('[kojasmat/bulk-import/template] Error generating template:', err)
    return NextResponse.json({ error: 'Gagal generate template' }, { status: 500 })
  }
}
