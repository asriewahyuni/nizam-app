'use client'

import React, { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download, Upload, CheckCircle2, AlertCircle, FileSpreadsheet,
  Loader2, TriangleAlert, ChevronDown, ChevronUp, RotateCcw,
} from 'lucide-react'
import { parseBulkImportFile, executeBulkImport } from '@/modules/bulk-import/actions/bulk-import.actions'
import type { BulkPreviewRow, BulkImportResult } from '@/modules/bulk-import/actions/bulk-import.actions'
import { formatRupiah } from '@/lib/utils'

interface BulkImportSectionProps {
  orgId: string
  type: 'sales' | 'purchase'
  onSuccess: () => void
}

type View = 'idle' | 'preview' | 'result'

export function BulkImportSection({ orgId, type, onSuccess }: BulkImportSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<View>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<BulkPreviewRow[]>([])
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const label    = type === 'sales' ? 'Penjualan' : 'Pembelian'
  const contact  = type === 'sales' ? 'Customer' : 'Vendor'
  const priceCol = type === 'sales' ? 'Harga Jual' : 'Harga Beli'

  const validCount = previewRows.filter(r => r.errors.length === 0 && r.contact_id).length
  const errorCount = previewRows.filter(r => r.errors.length > 0 || !r.contact_id).length

  const reset = () => {
    setView('idle')
    setPreviewRows([])
    setResult(null)
    setError(null)
  }

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx')) { setError('Hanya file .xlsx yang didukung.'); return }
    setLoading(true)
    setError(null)
    try {
      const buf = await file.arrayBuffer()
      const b64 = Buffer.from(buf).toString('base64')
      const res = await parseBulkImportFile(orgId, b64, type)
      if (res.error) { setError(res.error); return }
      if (!res.rows.length) { setError('Tidak ada data ditemukan. Pastikan template sudah diisi.'); return }
      setPreviewRows(res.rows)
      setView('preview')
    } catch (e: any) {
      setError(e?.message || 'Gagal memproses file.')
    } finally {
      setLoading(false)
    }
  }, [orgId, type])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) processFile(f)
  }

  const handleConfirm = async () => {
    const rows = previewRows.filter(r => r.errors.length === 0 && r.contact_id)
    if (!rows.length) return
    setLoading(true)
    try {
      const res = await executeBulkImport(orgId, rows, type)
      setResult(res)
      setView('result')
      if (res.created > 0) onSuccess()
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan transaksi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ── Accordion header ── */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
            <FileSpreadsheet size={16} className="text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-800">Bulk Import {label}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Download template Excel → isi data → upload → review → simpan sebagai DRAFT
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'preview' && (
            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wide">
              {previewRows.length} baris siap review
            </span>
          )}
          {view === 'result' && result && (
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase tracking-wide">
              {result.created} berhasil
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* ── Body ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100">

              {/* ── VIEW: IDLE ── */}
              {view === 'idle' && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Download template */}
                  <div className="flex flex-col gap-3 p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-2">
                      <Download size={16} className="text-indigo-600" />
                      <span className="text-sm font-semibold text-indigo-900">1. Download Template</span>
                    </div>
                    <p className="text-[11px] text-indigo-700 leading-relaxed">
                      File Excel dengan 2 sheet: <strong>Header</strong> (satu baris per transaksi) dan <strong>Items</strong> (produk per baris). Berisi petunjuk dan contoh data.
                    </p>
                    <a
                      href={`/api/bulk-import/template?type=${type === 'sales' ? 'sales' : 'purchase'}`}
                      download
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-sm cursor-pointer self-start"
                    >
                      <Download size={13} />
                      Download .xlsx
                    </a>
                  </div>

                  {/* Upload zone */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Upload size={16} className="text-slate-500" />
                      <span className="text-sm font-semibold text-slate-800">2. Upload File yang Sudah Diisi</span>
                    </div>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}
                      className={`flex-1 min-h-[100px] flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                        isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
                      {loading ? (
                        <div className="flex items-center gap-2 text-indigo-600">
                          <Loader2 size={18} className="animate-spin" />
                          <span className="text-xs font-semibold">Memproses...</span>
                        </div>
                      ) : (
                        <>
                          <Upload size={20} className="text-slate-300" />
                          <p className="text-xs font-semibold text-slate-500">Drop file .xlsx di sini</p>
                          <p className="text-[10px] text-slate-400">atau klik untuk pilih file</p>
                        </>
                      )}
                    </div>
                    {error && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                        <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-semibold text-red-700">{error}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── VIEW: PREVIEW ── */}
              {view === 'preview' && (
                <div className="p-6 space-y-4">
                  {/* Summary */}
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-800">{validCount} transaksi siap</span>
                      </div>
                      {errorCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-xl border border-red-100">
                          <AlertCircle size={14} className="text-red-500" />
                          <span className="text-xs font-bold text-red-800">{errorCount} dilewati (error)</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={reset}
                      className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={12} /> Ganti file
                    </button>
                  </div>

                  {/* Table */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase w-10">#</th>
                            <th className="px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase">Tanggal</th>
                            <th className="px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase">{contact}</th>
                            <th className="px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase">Item</th>
                            <th className="px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase text-right">Total</th>
                            <th className="px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {previewRows.map(row => {
                            const hasError = row.errors.length > 0 || !row.contact_id
                            const sub  = row.items.reduce((s, i) => s + i.jumlah * i.harga_satuan, 0)
                            const tax  = row.pajak_persen > 0 ? Math.round((sub - row.diskon_global) * row.pajak_persen / 100) : 0
                            const total = sub - row.diskon_global + tax
                              + (row.biaya_lain_nominal ?? 0)
                              + (row.biaya_kirim ?? 0)
                              + (row.asuransi ?? 0)

                            return (
                              <React.Fragment key={row.row_no}>
                                <tr className={hasError ? 'bg-red-50/30' : ''}>
                                  <td className="px-4 py-3 font-mono text-slate-400 text-[10px]">{row.row_no}</td>
                                  <td className="px-4 py-3 text-slate-700 font-medium">{row.tanggal}</td>
                                  <td className="px-4 py-3">
                                    <p className="font-semibold text-slate-800 leading-tight">{row.contact_name || '—'}</p>
                                    <p className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${row.termin === 'LUNAS' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {row.termin}{row.jatuh_tempo ? ` · ${row.jatuh_tempo}` : ''}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    <span className="font-semibold">{row.items.length} produk</span>
                                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight max-w-[160px] truncate">
                                      {row.items.slice(0, 2).map(i => i.nama_produk).join(', ')}
                                      {row.items.length > 2 ? ` +${row.items.length - 2}` : ''}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold font-mono text-slate-800">
                                    {formatRupiah(total)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {hasError ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-[9px] font-bold uppercase">
                                        <AlertCircle size={9} /> Error
                                      </span>
                                    ) : row.warnings.length > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[9px] font-bold uppercase">
                                        <TriangleAlert size={9} /> Warning
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-bold uppercase">
                                        <CheckCircle2 size={9} /> OK
                                      </span>
                                    )}
                                  </td>
                                </tr>
                                {(row.errors.length > 0 || row.warnings.length > 0) && (
                                  <tr className="bg-red-50/10">
                                    <td />
                                    <td colSpan={5} className="px-4 pb-2.5 pt-0 space-y-0.5">
                                      {row.errors.map((e, i) => (
                                        <p key={i} className="text-[10px] text-red-600 font-medium flex items-center gap-1">
                                          <AlertCircle size={9} className="shrink-0" /> {e}
                                        </p>
                                      ))}
                                      {row.warnings.map((w, i) => (
                                        <p key={i} className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                          <TriangleAlert size={9} className="shrink-0" /> {w}
                                        </p>
                                      ))}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Confirm */}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={reset}
                      className="px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={loading || validCount === 0}
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                    >
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      Simpan {validCount} Transaksi sebagai DRAFT
                    </button>
                  </div>
                </div>
              )}

              {/* ── VIEW: RESULT ── */}
              {view === 'result' && result && (
                <div className="p-6 space-y-4">
                  <div className={`flex items-center gap-3 p-4 rounded-xl border ${result.failed === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                    {result.failed === 0
                      ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                      : <TriangleAlert size={20} className="text-amber-600 shrink-0" />}
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {result.created} transaksi berhasil disimpan sebagai DRAFT
                        {result.failed > 0 ? `, ${result.failed} gagal` : ''}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Review dan posting masing-masing transaksi di tabel di bawah untuk menghasilkan jurnal.
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase w-16">row_no</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase">Status</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {result.rows.map(r => (
                          <tr key={r.row_no} className={r.status === 'error' ? 'bg-red-50/30' : ''}>
                            <td className="px-4 py-2 font-mono text-slate-500">{r.row_no}</td>
                            <td className="px-4 py-2">
                              {r.status === 'ok' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md uppercase">
                                  <CheckCircle2 size={9} /> DRAFT
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md uppercase">
                                  <AlertCircle size={9} /> Gagal
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-slate-500">{r.error || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={reset}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <RotateCcw size={12} /> Import lagi
                    </button>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
