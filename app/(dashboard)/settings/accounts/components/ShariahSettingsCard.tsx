'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import {
  injectShariahPack,
  setShariahAccountsActive,
} from '@/modules/accounting/actions/shariah.actions'
import type { ShariahSetupSummary } from '@/modules/accounting/actions/shariah.actions'

type Props = {
  orgId: string
  summary: ShariahSetupSummary
}

const STATUS_META: Record<ShariahSetupSummary['status'], {
  label: string
  badgeClassName: string
  panelClassName: string
  Icon: typeof CheckCircle2
}> = {
  READY: {
    label: 'Siap',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
    panelClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Icon: CheckCircle2,
  },
  INCOMPLETE: {
    label: 'Belum Lengkap',
    badgeClassName: 'bg-amber-100 text-amber-700',
    panelClassName: 'border-amber-200 bg-amber-50 text-amber-700',
    Icon: AlertCircle,
  },
  INACTIVE: {
    label: 'Nonaktif',
    badgeClassName: 'bg-slate-100 text-slate-600',
    panelClassName: 'border-slate-200 bg-slate-50 text-slate-600',
    Icon: ShieldCheck,
  },
}

export default function ShariahSettingsCard({ orgId, summary }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const statusMeta = STATUS_META[summary.status]

  async function runAction(action: () => Promise<{ success?: boolean; error?: string }>, successMessage: string) {
    setLoading(true)
    const result = await action()
    if (result.success) {
      alert(successMessage)
      router.refresh()
    } else {
      alert(result.error || 'Terjadi kesalahan.')
    }
    setLoading(false)
  }

  return (
    <section id="shariah-mode" className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Mode Syariah</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Pusat pengaturan mode syariah organisasi. Dari sini kita bisa mengaktifkan akun inti syariah dan
            mengecek kesiapan setup untuk syirkah, sales, dan purchasing.
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${statusMeta.badgeClassName}`}>
          <statusMeta.Icon size={14} />
          {statusMeta.label}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Mode Organisasi</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {summary.orgLevelShariahEnabled ? 'Aktif' : 'Belum aktif'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Akun Aktif</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{summary.activeShariahAccountCount} akun syariah</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Akun Inti Siap</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {summary.readyCount}/{summary.requiredCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Perlu Tindakan</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {summary.missingCount + summary.inactiveCount} akun
          </p>
        </div>
      </div>

      <div className={`rounded-lg border p-4 ${statusMeta.panelClassName}`}>
        {summary.status === 'READY' ? (
          <p className="text-sm font-medium">
            Setup syariah inti sudah lengkap. Akun kunci untuk syirkah, SALAM, dan ISTISHNA aktif semua.
          </p>
        ) : summary.status === 'INCOMPLETE' ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Setup syariah inti belum lengkap. Ada {summary.missingCount} akun belum ada dan {summary.inactiveCount} akun masih nonaktif.
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.issues.map((issue) => (
                <span
                  key={issue.code}
                  className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white px-3 py-1 text-[11px] font-bold text-slate-700"
                >
                  <span>{issue.code}</span>
                  <span className="text-slate-400">•</span>
                  <span>{issue.status === 'MISSING' ? 'belum ada' : 'nonaktif'}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium">
            Mode syariah belum aktif. Saat diaktifkan, sistem akan menyiapkan dan memantau akun inti untuk syirkah,
            sales, dan purchasing.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        {!summary.isShariahEnabled ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction(
              () => injectShariahPack(orgId),
              'Mode Syariah organisasi berhasil diaktifkan dan akun inti syariah sudah disiapkan.'
            )}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShieldCheck size={16} />
            Aktifkan Mode Syariah
          </button>
        ) : (
          <>
            {summary.status === 'INCOMPLETE' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => runAction(
                  () => injectShariahPack(orgId),
                  'Setup akun syariah berhasil disinkronkan ulang.'
                )}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={16} />
                Perbaiki Setup Akun
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => runAction(
                () => setShariahAccountsActive(orgId, false),
                'Mode Syariah organisasi berhasil dinonaktifkan.'
              )}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle size={16} />
              Nonaktifkan Mode Syariah
            </button>
          </>
        )}
      </div>
    </section>
  )
}
