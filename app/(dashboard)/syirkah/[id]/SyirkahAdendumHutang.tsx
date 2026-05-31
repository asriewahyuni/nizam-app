'use client'

// Adendum: Alokasi & Eksposur Hutang.
// Diisi setelah akad ditandatangani (status SIGNING / ACTIVE / COMPLETED).
// Terpisah dari draft wizard agar proses penandatanganan tidak terganjal data hutang.

import { useState, useTransition } from 'react'
import { Shield, Pencil, X, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { updateSyirkahDebtAllocation } from '@/modules/syirkah/actions/syirkah.actions'

type Props = {
  contractId: string
  orgId: string
  initialDebtAllocation: number
  initialCurrentDebt: number
  contractStatus: 'DRAFT' | 'SIGNING' | 'ACTIVE' | 'COMPLETED'
}

export function SyirkahAdendumHutang({
  contractId,
  orgId,
  initialDebtAllocation,
  initialCurrentDebt,
  contractStatus,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [debtAllocation, setDebtAllocation] = useState(initialDebtAllocation)
  const [currentDebt, setCurrentDebt] = useState(initialCurrentDebt)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isDraft = contractStatus === 'DRAFT'
  const usageRatio = debtAllocation > 0 ? currentDebt / debtAllocation : 0
  const usagePct = (usageRatio * 100).toFixed(1)
  const isCritical = usageRatio > 0.8

  function handleSave() {
    setError(null)
    if (currentDebt > debtAllocation && debtAllocation > 0) {
      setError('Hutang terserap tidak boleh melebihi limit alokasi.')
      return
    }
    startTransition(async () => {
      try {
        await updateSyirkahDebtAllocation(contractId, orgId, debtAllocation, currentDebt)
        setSaved(true)
        setIsEditing(false)
        setTimeout(() => setSaved(false), 3000)
      } catch (e: any) {
        setError(e.message || 'Gagal menyimpan adendum.')
      }
    })
  }

  function handleCancel() {
    setDebtAllocation(initialDebtAllocation)
    setCurrentDebt(initialCurrentDebt)
    setError(null)
    setIsEditing(false)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Shield size={16} className="text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Adendum: Alokasi &amp; Eksposur Hutang</h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                Adendum
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isDraft
                ? 'Tersedia setelah akad ditandatangani'
                : 'Batas maksimum hutang yang diizinkan dalam kemitraan ini'}
            </p>
          </div>
        </div>

        {!isDraft && !isEditing && (
          <button type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <Pencil size={13} /> Edit
          </button>
        )}

        {saved && !isEditing && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <CheckCircle2 size={14} /> Tersimpan
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {isDraft ? (
          <div className="flex items-center gap-3 py-4 text-center justify-center">
            <AlertTriangle size={16} className="text-slate-300" />
            <p className="text-sm text-slate-400 font-medium">
              Adendum ini bisa diisi setelah akad selesai ditandatangani.
            </p>
          </div>
        ) : isEditing ? (
          <div className="space-y-5">
            {/* Input limit */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                Limit Alokasi Hutang Keseluruhan (Rp)
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                Batas maksimum hutang yang boleh ditanggung oleh usaha bersama ini.
              </p>
              <input
                type="number"
                value={debtAllocation}
                onChange={(e) => setDebtAllocation(Number(e.target.value))}
                placeholder="0"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
              />
              <p className="mt-1 text-xs text-slate-400">{formatRupiah(debtAllocation)}</p>
            </div>

            {/* Input hutang terserap */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                Hutang Terserap Saat Ini (Rp)
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                Jumlah hutang yang sudah berjalan sekarang.
              </p>
              <input
                type="number"
                value={currentDebt}
                onChange={(e) => setCurrentDebt(Number(e.target.value))}
                placeholder="0"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
              />
              <p className="mt-1 text-xs text-slate-400">{formatRupiah(currentDebt)}</p>
            </div>

            {/* Live preview */}
            {debtAllocation > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="text-slate-600">Kapasitas Digunakan</span>
                  <span className={isCritical ? 'text-rose-600' : 'text-slate-700'}>{usagePct}%</span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isCritical ? 'bg-rose-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(usageRatio * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                ⚠ {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                <X size={14} /> Batal
              </button>
              <button type="button"
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 transition-all disabled:opacity-50 shadow-lg shadow-amber-100"
              >
                {isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
                ) : (
                  <><CheckCircle2 size={14} /> Simpan Adendum</>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Read-only view */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Limit Alokasi Hutang
                </span>
                <p className={`mt-1 text-lg font-bold ${initialDebtAllocation > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                  {initialDebtAllocation > 0 ? formatRupiah(initialDebtAllocation) : 'Belum diatur'}
                </p>
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Hutang Terserap
                </span>
                <p className={`mt-1 text-lg font-bold ${initialCurrentDebt > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {initialCurrentDebt > 0 ? formatRupiah(initialCurrentDebt) : 'Belum ada'}
                </p>
              </div>
            </div>

            {initialDebtAllocation > 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">Kapasitas Digunakan</span>
                  <span className={isCritical ? 'text-rose-600' : 'text-slate-600'}>{usagePct}%</span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isCritical ? 'bg-rose-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(usageRatio * 100, 100)}%` }}
                  />
                </div>
                {isCritical && (
                  <p className="mt-2 text-xs font-bold text-rose-600">
                    ⚠ Eksposur hutang sudah &gt;80% dari limit — perlu perhatian.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
