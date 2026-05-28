'use client'

import React, { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Upload, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2, ChevronRight, TriangleAlert } from 'lucide-react'
import { parseBulkImportFile, executeBulkImport } from '@/modules/bulk-import/actions/bulk-import.actions'
import type { BulkPreviewRow, BulkImportResult } from '@/modules/bulk-import/actions/bulk-import.actions'
import { formatRupiah } from '@/lib/utils'

interface BulkImportModalProps {
  orgId: string
  type: 'sales' | 'purchase'
  onClose: () => void
  onSuccess: () => void
}

type Step = 'upload' | 'preview' | 'result'

export function BulkImportModal({ orgId, type, onClose, onSuccess }: BulkImportModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<BulkPreviewRow[]>([])
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const label = type === 'sales' ? 'Penjualan' : 'Pembelian'
  const contactLabel = type === 'sales' ? 'Customer' : 'Vendor'
  const priceLabel = type === 'sales' ? 'Harga Jual' : 'Harga Beli'

  const validCount = previewRows.filter(r => r.errors.length === 0 && r.contact_id).length
  const errorCount = previewRows.filter(r => r.errors.length > 0 || !r.contact_id).length

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setError('Hanya file .xlsx yang didukung.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const res = await parseBulkImportFile(orgId, base64, type)
      if (res.error) {
        setError(res.error)
      } else if (res.rows.length === 0) {
        setError('Tidak ada data ditemukan di file. Cek apakah template sudah diisi.')
      } else {
        setPreviewRows(res.rows)
        setStep('preview')
      }
    } catch (e: any) {
      setError(e?.message || 'Gagal memproses file.')
    } finally {
      setLoading(false)
    }
  }, [orgId, type])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleConfirm = async () => {
    const rowsToSubmit = previewRows.filter(r => r.errors.length === 0 && r.contact_id)
    if (rowsToSubmit.length === 0) return
    setLoading(true)
    try {
      const res = await executeBulkImport(orgId, rowsToSubmit, type)
      setResult(res)
      setStep('result')
      if (res.created > 0) onSuccess()
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan transaksi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Bulk Import {label}</h2>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">
                {step === 'upload' ? 'Upload file XLSX' : step === 'preview' ? `${previewRows.length} transaksi terdeteksi` : 'Selesai'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide">
              {(['upload', 'preview', 'result'] as Step[]).map((s, i) => (
                <React.Fragment key={s}>
                  <span className={`px-2 py-1 rounded-md transition-all ${step === s ? 'bg-white text-slate-900' : step === 'result' || (step === 'preview' && i === 0) ? 'bg-white/20 text-white' : 'text-slate-500'}`}>
                    {s === 'upload' ? '1. Upload' : s === 'preview' ? '2. Review' : '3. Selesai'}
                  </span>
                  {i < 2 && <ChevronRight size={10} className="text-slate-600" />}
                </React.Fragment>
              ))}
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: UPLOAD ── */}
            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 space-y-6">
                {/* Download template */}
                <div className="flex items-center justify-between p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">Download Template</p>
                    <p className="text-[11px] text-indigo-600 mt-0.5">Template XLSX resmi dengan petunjuk dan contoh data</p>
                  </div>
                  <a
                    href={`/api/bulk-import/template?type=${type === 'sales' ? 'sales' : 'purchase'}`}
                    download
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-sm cursor-pointer"
                  >
                    <Download size={14} />
                    Download .xlsx
                  </a>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                    isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                  }`}
                >
                  <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileInput} />
                  {loading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="text-indigo-500 animate-spin" />
                      <p className="text-sm font-semibold text-slate-600">Memproses file...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center shadow-sm">
                        <Upload size={24} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Drop file di sini atau klik untuk upload</p>
                        <p className="text-[11px] text-slate-400 mt-1">Hanya .xlsx — gunakan template yang sudah didownload</p>
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-red-700">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STEP 2: PREVIEW ── */}
            {step === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 space-y-4">
                {/* Summary bar */}
                <div className="flex gap-3">
                  <div className="flex-1 flex items-center gap-2.5 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-800">{validCount} transaksi siap diimport</p>
                      <p className="text-[10px] text-emerald-600">Akan disimpan sebagai DRAFT</p>
                    </div>
                  </div>
                  {errorCount > 0 && (
                    <div className="flex-1 flex items-center gap-2.5 p-4 bg-red-50 rounded-xl border border-red-100">
                      <AlertCircle size={16} className="text-red-500 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-red-800">{errorCount} transaksi akan dilewati</p>
                        <p className="text-[10px] text-red-600">Periksa error di bawah</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preview table */}
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wide w-12">No</th>
                          <th className="px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Tanggal</th>
                          <th className="px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wide">{contactLabel}</th>
                          <th className="px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Item</th>
                          <th className="px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wide text-right">Total</th>
                          <th className="px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {previewRows.map(row => {
                          const hasError = row.errors.length > 0 || !row.contact_id
                          const subtotal = row.items.reduce((s, i) => s + i.jumlah * i.harga_satuan, 0)
                          const tax = row.pajak_persen > 0 ? Math.round((subtotal - row.diskon_global) * row.pajak_persen / 100) : 0
                          const total = subtotal - row.diskon_global + tax + (row.biaya_lain_nominal ?? 0) + (row.biaya_kirim ?? 0) + (row.asuransi ?? 0)

                          return (
                            <React.Fragment key={row.row_no}>
                              <tr className={hasError ? 'bg-red-50/40' : ''}>
                                <td className="px-4 py-3 text-slate-400 font-mono">{row.row_no}</td>
                                <td className="px-4 py-3 font-medium text-slate-700">{row.tanggal}</td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-slate-800">{row.contact_name || '—'}</div>
                                  <div className={`text-[9px] font-semibold uppercase tracking-wide mt-0.5 ${row.termin === 'LUNAS' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {row.termin}{row.jatuh_tempo ? ` · ${row.jatuh_tempo}` : ''}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {row.items.length} produk
                                  <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                                    {row.items.slice(0, 2).map(i => i.nama_produk).join(', ')}
                                    {row.items.length > 2 ? ` +${row.items.length - 2} lainnya` : ''}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-slate-800 font-mono">
                                  {formatRupiah(total)}
                                </td>
                                <td className="px-4 py-3">
                                  {hasError ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-[9px] font-bold uppercase">
                                      <AlertCircle size={10} /> Error
                                    </span>
                                  ) : row.warnings.length > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[9px] font-bold uppercase">
                                      <TriangleAlert size={10} /> Warning
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-bold uppercase">
                                      <CheckCircle2 size={10} /> OK
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {/* Error/warning details */}
                              {(row.errors.length > 0 || row.warnings.length > 0) && (
                                <tr className="bg-red-50/20">
                                  <td />
                                  <td colSpan={5} className="px-4 pb-3 pt-0">
                                    <div className="space-y-0.5">
                                      {row.errors.map((e, i) => (
                                        <p key={i} className="text-[10px] text-red-600 font-medium flex items-start gap-1">
                                          <AlertCircle size={10} className="shrink-0 mt-0.5" /> {e}
                                        </p>
                                      ))}
                                      {row.warnings.map((w, i) => (
                                        <p key={i} className="text-[10px] text-amber-600 font-medium flex items-start gap-1">
                                          <TriangleAlert size={10} className="shrink-0 mt-0.5" /> {w}
                                        </p>
                                      ))}
                                    </div>
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

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-red-700">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STEP 3: RESULT ── */}
            {step === 'result' && result && (
              <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 space-y-6">
                <div className={`flex flex-col items-center gap-4 py-8 ${result.failed === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {result.failed === 0 ? <CheckCircle2 size={48} /> : <TriangleAlert size={48} />}
                  <div className="text-center">
                    <p className="text-xl font-bold text-slate-900">{result.created} transaksi berhasil diimport</p>
                    {result.failed > 0 && <p className="text-sm text-red-600 mt-1">{result.failed} transaksi gagal</p>}
                    <p className="text-[11px] text-slate-500 mt-2">Semua transaksi tersimpan sebagai <span className="font-bold text-indigo-600">DRAFT</span>. Buka halaman {label} untuk review dan posting.</p>
                  </div>
                </div>

                {/* Result detail */}
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase">row_no</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase">Status</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 text-[10px] uppercase">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {result.rows.map(r => (
                        <tr key={r.row_no} className={r.status === 'error' ? 'bg-red-50/30' : ''}>
                          <td className="px-4 py-2.5 font-mono text-slate-500">{r.row_no}</td>
                          <td className="px-4 py-2.5">
                            {r.status === 'ok' ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md uppercase">
                                <CheckCircle2 size={9} /> DRAFT Dibuat
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md uppercase">
                                <AlertCircle size={9} /> Gagal
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">{r.error || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <button
            onClick={() => {
              if (step === 'preview') { setStep('upload'); setPreviewRows([]); setError(null) }
              else onClose()
            }}
            className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            {step === 'preview' ? '← Ganti File' : 'Tutup'}
          </button>

          {step === 'preview' && (
            <button
              onClick={handleConfirm}
              disabled={loading || validCount === 0}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-xs font-semibold uppercase tracking-wide rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Import {validCount} Transaksi sebagai Draft
            </button>
          )}

          {step === 'result' && (
            <button
              onClick={onClose}
              className="px-6 py-3 bg-emerald-600 text-white text-xs font-semibold uppercase tracking-wide rounded-xl hover:bg-emerald-700 transition-all cursor-pointer shadow-sm"
            >
              Selesai
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
