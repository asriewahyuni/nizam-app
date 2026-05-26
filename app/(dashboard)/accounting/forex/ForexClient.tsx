'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Globe, DollarSign, Calendar, FileText, Trash2, ExternalLink } from 'lucide-react'
import { EmptyState, SafeButton } from '@/components/ui/NizamUI'
import { deleteFxGainLoss } from '@/modules/accounting/actions/forex.actions'
import { formatRupiah, formatDate } from '@/lib/utils'

type ForexRecord = {
  id: string
  currency_code: string
  amount_foreign: number
  rate_at_transaction: number
  rate_at_settlement: number
  fx_gain_loss: number
  is_gain: boolean
  realized_at: string
  reference_type: 'SALE' | 'PURCHASE'
  reference_id: string
  journal_entries?: { description?: string; id?: string } | null
}

export function ForexClient({ orgId, history }: { orgId: string; history: ForexRecord[] }) {
  const [items, setItems] = useState(history)
  const [deleting, setDeleting] = useState<string | null>(null)

  const totalGain = items.filter(i => i.is_gain).reduce((s, i) => s + Number(i.fx_gain_loss), 0)
  const totalLoss = items.filter(i => !i.is_gain).reduce((s, i) => s + Number(i.fx_gain_loss), 0)
  const netFx = totalGain - totalLoss

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus catatan selisih kurs ini? Jurnal terkait juga akan dihapus.')) return
    setDeleting(id)
    const result = await deleteFxGainLoss(id)
    if (result.success) setItems(prev => prev.filter(i => i.id !== id))
    else alert('Gagal menghapus: ' + (result as any).error)
    setDeleting(null)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Selisih Kurs (FX Gain/Loss)</h1>
          <p className="text-sm text-slate-400 font-medium mt-1">Realisasi laba/rugi dari selisih kurs mata uang asing</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Laba Kurs</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 font-mono">{formatRupiah(totalGain)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-rose-600" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Rugi Kurs</span>
          </div>
          <p className="text-2xl font-bold text-rose-600 font-mono">{formatRupiah(totalLoss)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm md:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${netFx >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
              <DollarSign className={`h-5 w-5 ${netFx >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Net Selisih Kurs</span>
          </div>
          <p className={`text-2xl font-bold font-mono ${netFx >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
            {netFx >= 0 ? '+' : ''}{formatRupiah(netFx)}
          </p>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">Riwayat Realisasi</h3>
          <span className="text-[10px] font-medium text-slate-400">{items.length} transaksi</span>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="Belum ada realisasi selisih kurs"
            description="Saat Anda menerima pembayaran dalam mata uang asing dengan kurs berbeda dari saat transaksi, selisihnya akan tercatat di sini secara otomatis."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="text-left px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Tanggal</th>
                  <th className="text-left px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Mata Uang</th>
                  <th className="text-right px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Jumlah Valas</th>
                  <th className="text-right px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Kurs Awal</th>
                  <th className="text-right px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Kurs Bayar</th>
                  <th className="text-right px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Selisih</th>
                  <th className="text-center px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Tipe</th>
                  <th className="text-center px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Referensi</th>
                  <th className="text-center px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-tight"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {items.map((item) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-600">{formatDate(item.realized_at)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                          <Globe size={10} />
                          {item.currency_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs font-mono font-bold text-slate-700">
                          {item.amount_foreign.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs font-mono text-slate-500">
                          Rp {Number(item.rate_at_transaction).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs font-mono text-slate-500">
                          Rp {Number(item.rate_at_settlement).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-xs font-mono font-bold ${item.is_gain ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.is_gain ? '+' : '-'}Rp {Number(item.fx_gain_loss).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${
                          item.is_gain ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {item.is_gain ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {item.is_gain ? 'GAIN' : 'LOSS'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg uppercase">
                          {item.reference_type === 'SALE' ? 'Jual' : 'Beli'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-indigo-900 tracking-tight">Bagaimana selisih kurs dihitung?</h4>
            <p className="text-xs text-indigo-700/80 font-medium mt-1 leading-relaxed max-w-2xl">
              Saat Anda membuat invoice dalam mata uang asing (misal USD), sistem mencatat kurs saat itu.
              Ketika pembayaran diterima, sistem membandingkan kurs pembayaran dengan kurs invoice.
              Selisihnya otomatis dicatat sebagai laba (gain) atau rugi (loss) selisih kurs dan
              dijurnal ke akun yang sesuai.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
