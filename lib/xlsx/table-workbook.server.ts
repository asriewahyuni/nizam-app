/**
 * Helper generik untuk membuat file XLSX bergaya tabel (header + baris data)
 * dari data admin LMS — dipisah dari export.actions.ts akuntansi karena
 * format laporan keuangan (P&L/neraca) beda kebutuhan dengan export tabel biasa.
 */
import 'server-only'

import ExcelJS from 'exceljs'

export type TableColumn = {
  header: string
  key: string
  width?: number
}

export async function buildTableXLSXBuffer(
  sheetName: string,
  columns: TableColumn[],
  rows: Array<Record<string, unknown>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Nizam LMS'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 22,
  }))

  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  })
  headerRow.height = 22

  rows.forEach((row) => {
    sheet.addRow(row)
  })

  if (columns.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export function buildXLSXContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]+/g, '_').replace(/[";]/g, '_')
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
