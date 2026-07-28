'use client'

/**
 * Manajemen afiliasi & pencairan dana untuk admin (referensi Sejoli
 * wp-admin/admin.php?page=sejoli-affiliates).
 */
import { useState, useTransition } from 'react'
import {
  Ban,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  RotateCcw,
  Users,
  X,
} from 'lucide-react'
import { cn, formatRupiah } from '@/lib/utils'
import type {
  AdminAffiliatePayoutView,
  AdminAffiliateView,
} from '@/modules/ecommerce/lib/affiliate.server'
import {
  approveAffiliatePayoutAction,
  rejectAffiliatePayoutAction,
  setAffiliateStatusAction,
} from '@/modules/edu/actions/lms-affiliate-admin.actions'

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-800',
  SUSPENDED: 'bg-amber-50 text-amber-800',
  REJECTED: 'bg-rose-50 text-rose-800',
  PENDING: 'bg-slate-100 text-slate-700',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktif',
  SUSPENDED: 'Ditangguhkan',
  REJECTED: 'Ditolak',
  PENDING: 'Menunggu',
}

const PAYOUT_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-800',
  APPROVED: 'bg-sky-50 text-sky-800',
  PAID: 'bg-emerald-50 text-emerald-800',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

const PAYOUT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Menunggu Persetujuan',
  APPROVED: 'Disetujui',
  PAID: 'Sudah Dibayar',
  CANCELLED: 'Ditolak',
}

export default function AdminAffiliateClient({
  affiliates,
  payouts,
}: {
  affiliates: AdminAffiliateView[]
  payouts: AdminAffiliatePayoutView[]
}) {
  const [activeTab, setActiveTab] = useState<'affiliates' | 'payouts'>('affiliates')
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const draftPayoutCount = payouts.filter((payout) => payout.status === 'DRAFT').length

  function handleStatusChange(affiliate: AdminAffiliateView, status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED') {
    setMessage(null)
    setPendingId(affiliate.id)
    startTransition(async () => {
      const result = await setAffiliateStatusAction(affiliate.id, status)
      setPendingId(null)
      if (!result.success) {
        setMessage({ tone: 'error', text: result.error || 'Gagal mengubah status afiliasi.' })
        return
      }
      setMessage({ tone: 'success', text: `Status ${affiliate.name} berhasil diubah.` })
    })
  }

  function handleApprovePayout(payout: AdminAffiliatePayoutView) {
    setMessage(null)
    setPendingId(payout.id)
    startTransition(async () => {
      const result = await approveAffiliatePayoutAction(payout.id)
      setPendingId(null)
      if (!result.success) {
        setMessage({ tone: 'error', text: result.error || 'Gagal menyetujui pencairan dana.' })
        return
      }
      setMessage({ tone: 'success', text: `Pencairan ${payout.payoutNumber} disetujui & dicatat ke jurnal.` })
    })
  }

  function handleRejectPayout(payout: AdminAffiliatePayoutView) {
    if (!window.confirm(`Tolak pengajuan pencairan ${payout.payoutNumber} senilai ${formatRupiah(payout.amount)}?`)) return
    setMessage(null)
    setPendingId(payout.id)
    startTransition(async () => {
      const result = await rejectAffiliatePayoutAction(payout.id)
      setPendingId(null)
      if (!result.success) {
        setMessage({ tone: 'error', text: result.error || 'Gagal menolak pencairan dana.' })
        return
      }
      setMessage({ tone: 'success', text: `Pencairan ${payout.payoutNumber} ditolak, saldo dikembalikan.` })
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          /lms/admin · Afiliasi
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Manajemen Afiliasi</h1>
        <p className="mt-1 text-slate-500">
          Kelola akun mitra afiliasi dan proses pengajuan pencairan komisi mereka.
        </p>
      </div>

      {message && (
        <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold', message.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>
          {message.tone === 'error' ? <CircleAlert aria-hidden="true" size={17} /> : <Check aria-hidden="true" size={17} />}
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('affiliates')}
          className={cn(
            'inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition cursor-pointer',
            activeTab === 'affiliates' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50',
          )}
        >
          <Users size={16} />
          Afiliasi ({affiliates.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payouts')}
          className={cn(
            'inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold transition cursor-pointer',
            activeTab === 'payouts' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50',
          )}
        >
          <HandCoins size={16} />
          Pencairan Dana
          {draftPayoutCount > 0 && (
            <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{draftPayoutCount}</span>
          )}
        </button>
      </div>

        <a
          href={`/api/lms/export?type=${activeTab === 'payouts' ? 'payouts' : 'affiliates'}`}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <FileSpreadsheet size={16} />
          Export XLSX
        </a>
      </div>

      {activeTab === 'affiliates' ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[900px] w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Afiliasi</th>
                <th className="px-4 py-3">Kode Referral</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Menunggu</th>
                <th className="px-4 py-3 text-right">Siap Cair</th>
                <th className="px-4 py-3 text-right">Sudah Dibayar</th>
                <th className="px-4 py-3 text-center">Konversi</th>
                <th className="px-4 py-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {affiliates.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">Belum ada afiliasi terdaftar.</td></tr>
              ) : (
                affiliates.map((affiliate) => (
                  <tr key={affiliate.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-900 text-sm">{affiliate.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{affiliate.email || affiliate.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-4"><code className="font-mono text-xs font-bold text-slate-700">{affiliate.referralCode}</code></td>
                    <td className="px-4 py-4">
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', STATUS_BADGE[affiliate.status] || 'bg-slate-100 text-slate-700')}>
                        {STATUS_LABEL[affiliate.status] || affiliate.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-semibold text-slate-700">{formatRupiah(affiliate.pendingAmount)}</td>
                    <td className="px-4 py-4 text-right text-sm font-bold text-amber-700">{formatRupiah(affiliate.payableAmount)}</td>
                    <td className="px-4 py-4 text-right text-sm font-bold text-emerald-700">{formatRupiah(affiliate.paidAmount)}</td>
                    <td className="px-4 py-4 text-center text-sm font-semibold text-slate-700">{affiliate.conversionCount}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1.5">
                        {affiliate.status !== 'ACTIVE' && (
                          <button
                            type="button"
                            disabled={isPending && pendingId === affiliate.id}
                            onClick={() => handleStatusChange(affiliate, 'ACTIVE')}
                            title="Aktifkan"
                            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        {affiliate.status !== 'SUSPENDED' && (
                          <button
                            type="button"
                            disabled={isPending && pendingId === affiliate.id}
                            onClick={() => handleStatusChange(affiliate, 'SUSPENDED')}
                            title="Tangguhkan"
                            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-amber-600 transition hover:bg-amber-50 disabled:opacity-50"
                          >
                            <Clock size={16} />
                          </button>
                        )}
                        {affiliate.status !== 'REJECTED' && (
                          <button
                            type="button"
                            disabled={isPending && pendingId === affiliate.id}
                            onClick={() => handleStatusChange(affiliate, 'REJECTED')}
                            title="Tolak / Blokir"
                            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[900px] w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">No. Pencairan</th>
                <th className="px-4 py-3">Afiliasi</th>
                <th className="px-4 py-3">Rekening Tujuan</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payouts.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">Belum ada pengajuan pencairan dana.</td></tr>
              ) : (
                payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-4"><code className="font-mono text-xs font-bold text-slate-700">{payout.payoutNumber}</code></td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-900 text-sm">{payout.affiliateName}</p>
                      <p className="mt-0.5 text-xs text-slate-500 font-mono">{payout.referralCode}</p>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {payout.bankName || payout.accountNumber ? (
                        <div className="flex items-center gap-1.5">
                          <Landmark size={13} className="text-slate-400 shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-800">{payout.bankName || '—'}</p>
                            <p>{payout.accountNumber} a.n. {payout.accountName}</p>
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-bold text-slate-900">{formatRupiah(payout.amount)}</td>
                    <td className="px-4 py-4">
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', PAYOUT_STATUS_BADGE[payout.status] || 'bg-slate-100 text-slate-700')}>
                        {PAYOUT_STATUS_LABEL[payout.status] || payout.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {payout.status === 'DRAFT' ? (
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isPending && pendingId === payout.id}
                            onClick={() => handleApprovePayout(payout)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            Setujui
                          </button>
                          <button
                            type="button"
                            disabled={isPending && pendingId === payout.id}
                            onClick={() => handleRejectPayout(payout)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                          >
                            <X size={14} />
                            Tolak
                          </button>
                        </div>
                      ) : (
                        <p className="text-right text-xs text-slate-400">
                          {payout.paidAt ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(payout.paidAt)) : '—'}
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
