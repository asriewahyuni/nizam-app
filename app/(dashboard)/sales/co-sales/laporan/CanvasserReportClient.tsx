'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Share2, FileBarChart } from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import { PageHeader, StatCard, EmptyState, SafeButton } from '@/components/ui/NizamUI'
import { getCanvasserPerformanceReport, generateCanvasserReportPdfBase64 } from '@/modules/canvasser/actions/canvasser-reports.actions'
import type { CanvasserVan, CanvasserPerformanceReport } from '@/modules/canvasser/lib/canvasser-types'

interface Props {
  orgId: string
  vans: CanvasserVan[]
  initialReport: CanvasserPerformanceReport
  initialFrom: string
  initialTo: string
  brandColor: string
}

export function CanvasserReportClient({ orgId, vans, initialReport, initialFrom, initialTo, brandColor }: Props) {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [vanId, setVanId] = useState('')
  const [report, setReport] = useState(initialReport)
  const [loading, setLoading] = useState(false)

  async function applyFilter() {
    setLoading(true)
    const next = await getCanvasserPerformanceReport(orgId, { from, to, vanId: vanId || null })
    setReport(next)
    setLoading(false)
  }

  async function handleDownloadPdf() {
    const res = await generateCanvasserReportPdfBase64(orgId, { from, to, vanId: vanId || null })
    if ('error' in res) { throw new Error(res.error) }
    const byteChars = atob(res.base64)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handleShareWhatsapp() {
    const lines = [
      'Laporan Performa Canvasser',
      `Periode: ${formatDate(from, 'short')} s.d. ${formatDate(to, 'short')}`,
      '',
      `Total Penjualan: ${formatRupiah(report.totals.salesTotal)}`,
      `Kas Terkumpul: ${formatRupiah(report.totals.cashCollected)}`,
      `AR Tertagih: ${formatRupiah(report.totals.arCollected)}`,
      `Kunjungan: ${report.totals.visitsDone}/${report.totals.visitsTotal}`,
    ]
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/sales/co-sales" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 mb-2 cursor-pointer">
          <ArrowLeft size={12} /> Dashboard Canvasser
        </Link>
        <PageHeader
          tag="Sales Lapangan"
          title="Laporan Performa Canvasser"
          subtitle="Penjualan, kas, AR tertagih & tingkat kunjungan per van/periode."
          icon={<FileBarChart />}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dari Tanggal</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sampai Tanggal</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Van</label>
            <select value={vanId} onChange={e => setVanId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10">
              <option value="">Semua Van</option>
              {vans.map(v => <option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}
            </select>
          </div>
          <button type="button" onClick={applyFilter} disabled={loading}
            style={{ backgroundColor: brandColor }}
            className="px-4 py-2 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity duration-150 disabled:opacity-50 cursor-pointer min-h-[44px]">
            {loading ? 'Memuat...' : 'Terapkan Filter'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Penjualan" value={formatRupiah(report.totals.salesTotal)} color="emerald" />
        <StatCard label="Kas Terkumpul" value={formatRupiah(report.totals.cashCollected)} color="amber" />
        <StatCard label="AR Tertagih" value={formatRupiah(report.totals.arCollected)} color="rose" />
        <StatCard label="Kunjungan" value={`${report.totals.visitsDone}/${report.totals.visitsTotal}`} color="blue" />
      </div>

      <div className="flex flex-wrap gap-3">
        <SafeButton onClick={handleDownloadPdf} icon={<Download size={16} />} loadingText="Membuat PDF..." variant="white">
          Unduh PDF
        </SafeButton>
        <button type="button" onClick={handleShareWhatsapp}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm font-semibold rounded-lg hover:bg-emerald-100 transition-colors duration-150 cursor-pointer min-h-[44px]">
          <Share2 size={16} /> Kirim Ringkasan ke WhatsApp
        </button>
      </div>

      {report.rows.length === 0 ? (
        <EmptyState icon={FileBarChart} title="Tidak ada data pada periode ini" description="Coba ubah rentang tanggal atau pilih van lain." />
      ) : (
        <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Tanggal</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Van</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Penjualan</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Kas</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">AR Tertagih</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Kunjungan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {report.rows.map((row, idx) => (
                <tr key={`${row.vanId}-${row.sessionDate}-${idx}`} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-600">{formatDate(row.sessionDate, 'short')}</td>
                  <td className="px-5 py-3 font-medium text-slate-700">{row.vanCode} — {row.vanName}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">{formatRupiah(row.salesTotal)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-600">{formatRupiah(row.cashCollected)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-600">{formatRupiah(row.arCollected)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-600">{row.visitsDone}/{row.visitsTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
