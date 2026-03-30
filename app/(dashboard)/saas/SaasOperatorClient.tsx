'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeDollarSign, CheckCircle2, ClipboardList, Receipt, RefreshCcw } from 'lucide-react'
import {
  convertQuotationToSale,
  createOperatorQuotation,
  markOperatorSalePaid,
} from '@/modules/saas/actions/operator-sales.actions'

type Snapshot = {
  orgs: Array<{ id: string; name: string }>
  packages: Array<{ id: string; name: string; price: number; billing?: string }>
  quotations: InvoiceRecord[]
  sales: InvoiceRecord[]
  summary: {
    totalQuotes: number
    totalOpenSales: number
    totalPaidSales: number
    totalSalesValue: number
  }
}

type InvoiceRecord = {
  id: string
  invoice_number: string
  item_name: string | null
  item_description: string | null
  amount: number
  status: string
  created_at: string
  organization?: { name: string } | null
}

function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
}

function formatDate(dateLike: string) {
  if (!dateLike) return '-'
  return new Date(dateLike).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SaasOperatorClient({
  mode,
  snapshot,
}: {
  mode: 'quotes' | 'sales'
  snapshot: Snapshot
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const isQuotesMode = mode === 'quotes'

  const stats = useMemo(() => snapshot.summary, [snapshot.summary])

  const handleCreateQuote = (formData: FormData) => {
    startTransition(async () => {
      const res = await createOperatorQuotation(formData)
      if ('error' in res && res.error) {
        setMsg({ type: 'err', text: res.error })
        return
      }

      setMsg({ type: 'ok', text: `Penawaran berhasil dibuat (${res.invoiceNumber}).` })
      router.refresh()
    })
  }

  const handleConvert = (invoiceId: string) => {
    startTransition(async () => {
      const res = await convertQuotationToSale(invoiceId)
      if ('error' in res && res.error) {
        setMsg({ type: 'err', text: res.error })
        return
      }
      setMsg({ type: 'ok', text: 'Penawaran berhasil dikonversi ke penjualan.' })
      router.refresh()
    })
  }

  const handleMarkPaid = (invoiceId: string) => {
    startTransition(async () => {
      const res = await markOperatorSalePaid(invoiceId, 'MANUAL_TRANSFER')
      if ('error' in res && res.error) {
        setMsg({ type: 'err', text: res.error })
        return
      }
      setMsg({ type: 'ok', text: 'Penjualan ditandai PAID dan paket tenant diaktifkan.' })
      router.refresh()
    })
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">SaaS Operator Desk</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Modul khusus pengelola SaaS untuk mengelola penawaran dan penjualan tanpa membuka halaman admin utama.
          </p>
        </div>
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1">
          <Link
            href="/saas/penawaran"
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider ${isQuotesMode ? 'bg-[#003366] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Penawaran
          </Link>
          <Link
            href="/saas/penjualan"
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider ${!isQuotesMode ? 'bg-[#003366] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Penjualan
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><ClipboardList size={14} /> Total Penawaran</div>
          <div className="mt-2 text-2xl font-black text-slate-900">{stats.totalQuotes}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><Receipt size={14} /> Open Sales</div>
          <div className="mt-2 text-2xl font-black text-amber-600">{stats.totalOpenSales}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><CheckCircle2 size={14} /> Paid Sales</div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{stats.totalPaidSales}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400"><BadgeDollarSign size={14} /> Nilai Penjualan</div>
          <div className="mt-2 text-lg font-black text-[#003366]">{formatIdr(stats.totalSalesValue)}</div>
        </div>
      </div>

      {msg && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${msg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {msg.text}
        </div>
      )}

      {isQuotesMode && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Buat Penawaran SaaS Baru</h2>
          <form action={handleCreateQuote} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
            <select name="org_id" required className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold">
              <option value="">Pilih Tenant</option>
              {snapshot.orgs.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <select name="package_id" required className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold">
              <option value="">Pilih Paket</option>
              {snapshot.packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} - {formatIdr(pkg.price)}
                </option>
              ))}
            </select>
            <input
              name="amount"
              type="number"
              min="0"
              placeholder="Nominal override (opsional)"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
            />
            <input
              name="note"
              placeholder="Catatan penawaran (opsional)"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
            />
            <button
              type="submit"
              disabled={isPending}
              className="h-11 rounded-xl bg-[#003366] px-4 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60"
            >
              {isPending ? 'Menyimpan...' : 'Buat Penawaran'}
            </button>
          </form>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">
            {isQuotesMode ? 'Daftar Penawaran SaaS' : 'Daftar Penjualan SaaS'}
          </h2>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500"
          >
            <RefreshCcw size={12} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3">Nomor</th>
                <th className="px-3 py-3">Tenant</th>
                <th className="px-3 py-3">Item</th>
                <th className="px-3 py-3">Nilai</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Dibuat</th>
                <th className="px-3 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(isQuotesMode ? snapshot.quotations : snapshot.sales).map((item) => (
                <tr key={item.id} className="border-b border-slate-100 text-sm">
                  <td className="px-3 py-3 font-black text-slate-900">{item.invoice_number}</td>
                  <td className="px-3 py-3 font-semibold text-slate-700">{item.organization?.name || '-'}</td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-slate-800">{item.item_name || '-'}</div>
                    {item.item_description && (
                      <div className="mt-1 text-xs text-slate-500">{item.item_description}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 font-black text-[#003366]">{formatIdr(Number(item.amount || 0))}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-500">{formatDate(item.created_at)}</td>
                  <td className="px-3 py-3">
                    {isQuotesMode ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleConvert(item.id)}
                        className="rounded-lg bg-[#003366] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-60"
                      >
                        Konversi ke Penjualan
                      </button>
                    ) : item.status !== 'PAID' ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleMarkPaid(item.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-60"
                      >
                        Tandai Paid
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600">Selesai</span>
                    )}
                  </td>
                </tr>
              ))}
              {(isQuotesMode ? snapshot.quotations.length === 0 : snapshot.sales.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm font-bold text-slate-400">
                    Belum ada data {isQuotesMode ? 'penawaran' : 'penjualan'} SaaS.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
