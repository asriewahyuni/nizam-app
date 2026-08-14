// Renderer PDF tabular untuk laporan performa canvasser — font bawaan
// pdf-lib (Helvetica), tanpa embed font file seperti sertifikat LMS karena
// ini laporan tabel biasa, bukan dokumen bermerek.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatRupiah, formatDate } from '@/lib/utils'
import type { CanvasserPerformanceReport } from '@/modules/canvasser/lib/canvasser-types'

export type CanvasserReportPdfInput = {
  orgName: string
  report: CanvasserPerformanceReport
  generatedAtLabel: string
  logoBytes?: Uint8Array | null
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 40

export async function renderCanvasserReportPdf(input: CanvasserReportPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const dark = rgb(0.06, 0.09, 0.16)
  const muted = rgb(0.42, 0.45, 0.5)
  const primary = rgb(0.02, 0.2, 0.4)
  const headerBg = rgb(0.95, 0.96, 0.98)

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const cols = [
    { label: 'Tanggal', x: MARGIN },
    { label: 'Van', x: MARGIN + 70 },
    { label: 'Penjualan', x: MARGIN + 190 },
    { label: 'Kas', x: MARGIN + 280 },
    { label: 'AR Tertagih', x: MARGIN + 365 },
    { label: 'Kunjungan', x: MARGIN + 460 },
  ]

  function drawTableHeader() {
    page.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_WIDTH - MARGIN * 2, height: 18, color: headerBg })
    for (const col of cols) {
      page.drawText(col.label, { x: col.x + 4, y, size: 8.5, font: bold, color: muted })
    }
    y -= 20
  }

  function ensureSpace(): boolean {
    if (y - 16 < MARGIN + 30) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
      return true
    }
    return false
  }

  if (input.logoBytes) {
    try {
      // Kunci tinggi, lebar ikut rasio asli gambar — resize proporsional,
      // logo tidak gepeng/melar walau bentuk aslinya landscape.
      const logoImage = await pdf.embedPng(input.logoBytes).catch(() => pdf.embedJpg(input.logoBytes as Uint8Array))
      const logoHeight = 32
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight
      page.drawImage(logoImage, { x: MARGIN, y: y - logoHeight, width: logoWidth, height: logoHeight })
      y -= logoHeight + 10
    } catch {
      // Format logo tidak didukung pdf-lib (mis. WEBP/SVG) — lewati, PDF tetap dibuat tanpa logo.
    }
  }

  page.drawText(input.orgName, { x: MARGIN, y, size: 13, font: bold, color: primary })
  y -= 22
  page.drawText('Laporan Performa Canvasser', { x: MARGIN, y, size: 17, font: bold, color: dark })
  y -= 16
  page.drawText(`Periode ${formatDate(input.report.from, 'short')} - ${formatDate(input.report.to, 'short')}`, {
    x: MARGIN, y, size: 10, font: regular, color: muted,
  })
  y -= 12
  page.drawText(`Dibuat: ${input.generatedAtLabel}`, { x: MARGIN, y, size: 9, font: regular, color: muted })
  y -= 24

  const totals = input.report.totals
  const summary = `Total Penjualan ${formatRupiah(totals.salesTotal)}   |   Kas ${formatRupiah(totals.cashCollected)}   |   AR Tertagih ${formatRupiah(totals.arCollected)}   |   Kunjungan ${totals.visitsDone}/${totals.visitsTotal}`
  page.drawText(summary, { x: MARGIN, y, size: 9.5, font: bold, color: dark })
  y -= 24

  drawTableHeader()

  if (input.report.rows.length === 0) {
    page.drawText('Tidak ada data pada periode ini.', { x: MARGIN, y, size: 9, font: regular, color: muted })
  }

  for (const row of input.report.rows) {
    if (ensureSpace()) drawTableHeader()
    const vanLabel = `${row.vanCode} - ${row.vanName}`
    page.drawText(formatDate(row.sessionDate, 'short'), { x: cols[0].x + 4, y, size: 8.5, font: regular, color: dark })
    page.drawText(vanLabel.length > 26 ? `${vanLabel.slice(0, 25)}…` : vanLabel, { x: cols[1].x + 4, y, size: 8.5, font: regular, color: dark })
    page.drawText(formatRupiah(row.salesTotal), { x: cols[2].x + 4, y, size: 8.5, font: regular, color: dark })
    page.drawText(formatRupiah(row.cashCollected), { x: cols[3].x + 4, y, size: 8.5, font: regular, color: dark })
    page.drawText(formatRupiah(row.arCollected), { x: cols[4].x + 4, y, size: 8.5, font: regular, color: dark })
    page.drawText(`${row.visitsDone}/${row.visitsTotal}`, { x: cols[5].x + 4, y, size: 8.5, font: regular, color: dark })
    y -= 16
  }

  pdf.setTitle(`Laporan Performa Canvasser - ${input.report.from} s.d. ${input.report.to}`)
  pdf.setAuthor(input.orgName)
  pdf.setCreator('Nizam ERP')
  return pdf.save()
}
