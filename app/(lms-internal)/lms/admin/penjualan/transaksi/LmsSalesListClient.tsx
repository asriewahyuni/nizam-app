'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  HandCoins,
  Search,
  ShoppingCart,
  XCircle,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { updateOrderStatusAction } from '@/modules/edu/actions/lms-sales-admin.actions'
import type {
  LmsSaleItem,
  LmsSalesSummaryMetrics,
} from '@/modules/edu/lib/lms-sales.server'

type StatusActionValue =
  | 'on-hold'
  | 'payment-confirm'
  | 'in-progress'
  | 'shipping'
  | 'completed'
  | 'refunded'
  | 'cancelled'
  | 'resend'

const STATUS_ACTIONS: Array<{ value: StatusActionValue; label: string; physicalOnly?: boolean; allowedFrom: string[] }> = [
  { value: 'on-hold', label: 'Menunggu pembayaran', allowedFrom: ['PAYMENT_UNDER_REVIEW', 'PAYMENT_REJECTED', 'PAYMENT_EXCEPTION'] },
  { value: 'payment-confirm', label: 'Pembayaran dikonfirmasi', allowedFrom: ['AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAYMENT_REJECTED', 'PAYMENT_EXCEPTION'] },
  { value: 'in-progress', label: 'Pesanan diproses', physicalOnly: true, allowedFrom: ['READY_TO_FULFILL'] },
  { value: 'shipping', label: 'Proses pengiriman', physicalOnly: true, allowedFrom: ['READY_TO_FULFILL', 'FULFILLING'] },
  { value: 'completed', label: 'Selesai', allowedFrom: ['PAID', 'READY_TO_FULFILL', 'FULFILLING', 'SHIPPED'] },
  { value: 'refunded', label: 'Refund', allowedFrom: ['PAID', 'READY_TO_FULFILL', 'FULFILLING', 'SHIPPED', 'COMPLETED'] },
  { value: 'cancelled', label: 'Batal', allowedFrom: ['DRAFT', 'AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAYMENT_REJECTED', 'PAYMENT_EXCEPTION'] },
  { value: 'resend', label: 'Kirim ulang notifikasi', allowedFrom: ['PAID', 'READY_TO_FULFILL', 'FULFILLING', 'SHIPPED', 'COMPLETED'] },
]

function getAvailableActions(sale: LmsSaleItem) {
  return STATUS_ACTIONS.filter((action) => {
    if (action.physicalOnly && !sale.hasPhysicalItems) return false
    return action.allowedFrom.includes(sale.rawStatus)
  })
}

export function LmsSalesListClient({
  metrics,
  initialSales,
}: {
  metrics: LmsSalesSummaryMetrics
  initialSales: LmsSaleItem[]
}) {
  const router = useRouter()
  const sales = initialSales
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedSale, setSelectedSale] = useState<LmsSaleItem | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const filteredSales = sales.filter((item) => {
    const matchStatus = statusFilter === 'ALL' || item.paymentStatus === statusFilter
    const matchQuery = !search.trim()
      || item.orderNumber.toLowerCase().includes(search.toLowerCase())
      || item.customerName.toLowerCase().includes(search.toLowerCase())
      || (item.customerEmail && item.customerEmail.toLowerCase().includes(search.toLowerCase()))
    return matchStatus && matchQuery
  })

  const CONFIRM_MESSAGES: Partial<Record<StatusActionValue, string>> = {
    'payment-confirm': 'Tandai order ini LUNAS secara manual? Akses kelas akan otomatis terbuka untuk pembeli.',
    'in-progress': 'Ubah status order ini menjadi diproses?',
    shipping: 'Ubah status order ini menjadi dikirim?',
    completed: 'Tandai order ini SELESAI?',
    cancelled: 'Batalkan order ini? Customer akan diberi tahu lewat WhatsApp/Email.',
    'on-hold': 'Kembalikan order ini ke status menunggu pembayaran?',
  }

  const handleStatusAction = (orderId: string, action: StatusActionValue) => {
    let reason: string | undefined

    if (action === 'refunded') {
      reason = prompt('Alasan refund (wajib diisi):') || ''
      if (!reason.trim()) {
        setFeedback({ type: 'error', text: 'Alasan refund wajib diisi.' })
        return
      }
      if (!confirm('Proses refund order ini? Jurnal, kas, dan akses akan dibalik otomatis.')) return
    } else if (action === 'cancelled') {
      reason = prompt('Alasan pembatalan (opsional):') || undefined
      if (!confirm(CONFIRM_MESSAGES.cancelled!)) return
    } else if (CONFIRM_MESSAGES[action]) {
      if (!confirm(CONFIRM_MESSAGES[action]!)) return
    }

    setFeedback(null)
    startTransition(async () => {
      const res = await updateOrderStatusAction(orderId, action, reason)
      if (res.error) {
        setFeedback({ type: 'error', text: res.error })
      } else {
        setFeedback({ type: 'success', text: 'Status order berhasil diperbarui.' })
        router.refresh()
      }
    })
  }

  const handleExportCsv = () => {
    const headers = ['No Order', 'Tanggal', 'Nama Pembeli', 'Email', 'Telepon', 'Total', 'Status', 'Metode Bayar', 'Kode Affiliate']
    const rows = filteredSales.map((s) => [
      s.orderNumber,
      new Date(s.createdAt).toISOString().slice(0, 10),
      `"${s.customerName}"`,
      s.customerEmail || '',
      s.customerPhone || '',
      s.grandTotal,
      s.paymentStatus,
      s.paymentGateway || 'MANUAL',
      s.affiliate ? s.affiliate.referralCode : '',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `LMS_Sales_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Alert Feedback */}
      {feedback && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between shadow-sm ${feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs underline cursor-pointer">Tutup</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Omset LMS</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600"><ShoppingCart size={18} /></div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatRupiah(metrics.totalRevenue)}</p>
          <p className="mt-1 text-xs text-slate-500">Pembayaran lunas terkonfirmasi</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Transaksi Sukses</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={18} /></div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{metrics.paidOrderCount} Pesanan</p>
          <p className="mt-1 text-xs text-slate-500">Akses kelas aktif</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Menunggu Bayar</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><Clock size={18} /></div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{metrics.pendingOrderCount} Pesanan</p>
          <p className="mt-1 text-xs text-slate-500">Pending checkout</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Komisi Afiliasi</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600"><HandCoins size={18} /></div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatRupiah(metrics.totalAffiliateCommissions)}</p>
          <p className="mt-1 text-xs text-slate-500">Beban komisi mitra</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Cari no order, nama, atau email pembeli..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700">
            <Filter size={14} className="text-slate-500" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="PAID">LUNAS (PAID)</option>
              <option value="PENDING">PENDING</option>
              <option value="CANCELLED">BATAL / GAGAL</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <Download size={14} /> Ekspor CSV (Halaman Ini)
          </button>

          <a
            href={`/api/lms/export?type=sales${statusFilter !== 'ALL' ? `&status=${encodeURIComponent(statusFilter)}` : ''}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <FileSpreadsheet size={14} /> Export XLSX (Semua Data)
          </a>
        </div>
      </div>

      {/* Sales Data Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[950px] text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-5">No. Order &amp; Waktu</th>
              <th className="py-3.5 px-5">Pembeli</th>
              <th className="py-3.5 px-5">Item Kelas</th>
              <th className="py-3.5 px-5">Total Pembayaran</th>
              <th className="py-3.5 px-5 text-center">Status</th>
              <th className="py-3.5 px-5">Afiliasi</th>
              <th className="py-3.5 px-5 text-right sticky right-0 bg-slate-50 shadow-[-6px_0_12px_rgba(0,0,0,0.04)] z-10">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500 text-sm">
                  Tidak ada transaksi penjualan LMS yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              filteredSales.map((sale) => {
                const isPaid = sale.paymentStatus === 'PAID'
                const isPendingState = sale.paymentStatus === 'PENDING'

                return (
                  <tr key={sale.id} className="group hover:bg-slate-50 transition">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-indigo-600">{sale.orderNumber}</span>
                        {sale.source === 'legacy' && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            Legacy
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sale.createdAt))}
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900">{sale.customerName}</div>
                      <div className="text-xs text-slate-500">{sale.customerEmail || sale.customerPhone}</div>
                    </td>

                    <td className="py-4 px-5">
                      <div className="text-xs font-medium text-slate-800 line-clamp-2 max-w-xs">
                        {sale.items.map((i) => i.productName).join(', ') || 'Kelas Pembelajaran'}
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <div className="font-black text-slate-900">{formatRupiah(sale.grandTotal)}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">{sale.paymentGateway || 'MANUAL'}</div>
                    </td>

                    <td className="py-4 px-5 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isPaid ? 'bg-emerald-100 text-emerald-800' : isPendingState ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                        {sale.paymentStatus}
                      </span>
                    </td>

                    <td className="py-4 px-5">
                      {sale.affiliate ? (
                        <div>
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px] font-bold">
                            {sale.affiliate.referralCode}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">+ {formatRupiah(sale.affiliate.commissionAmount)}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    <td className="py-4 px-5 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 transition shadow-[-6px_0_12px_rgba(0,0,0,0.04)] z-10">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedSale(sale)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          title="Lihat Detail"
                        >
                          <Eye size={15} />
                        </button>

                        {sale.source === 'native' && (
                          <select
                            value=""
                            disabled={isPending}
                            onChange={(e) => {
                              const action = e.target.value as StatusActionValue
                              e.target.value = ''
                              if (action) handleStatusAction(sale.id, action)
                            }}
                            className="min-h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="">Pilihan aksi</option>
                            {getAvailableActions(sale).map((action) => (
                              <option key={action.value} value={action.value}>{action.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Detail Transaksi */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Rincian Order {selectedSale.orderNumber}</h3>
                <p className="text-xs text-slate-500">Waktu: {new Date(selectedSale.createdAt).toLocaleString('id-ID')}</p>
              </div>
              <button type="button" onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Data Pembeli</p>
                <p className="font-bold text-slate-900">{selectedSale.customerName}</p>
                <p className="text-slate-600 text-xs">{selectedSale.customerEmail || '-'}</p>
                <p className="text-slate-600 text-xs">{selectedSale.customerPhone}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Item Kelas yang Dibeli</p>
                <div className="space-y-2 border-t border-slate-100 pt-2">
                  {selectedSale.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800">{item.productName} (x{item.quantity})</span>
                      <span className="font-bold text-slate-900">{formatRupiah(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-between font-bold text-base">
                <span>Total Pembayaran</span>
                <span className="text-indigo-600">{formatRupiah(selectedSale.grandTotal)}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
