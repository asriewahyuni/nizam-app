'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Percent, TicketPercent } from 'lucide-react'
import type { AffiliateSettings } from '@/modules/ecommerce/lib/affiliate-settings.server'

export function LmsAffiliateSettingsForm({
  orgId,
  initialConfig,
  onSaveAction,
}: {
  orgId: string
  initialConfig: AffiliateSettings
  onSaveAction: (orgId: string, config: AffiliateSettings) => Promise<{ success?: boolean; error?: string }>
}) {
  const [config, setConfig] = useState<AffiliateSettings>(initialConfig)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const res = await onSaveAction(orgId, config)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: 'Pengaturan kupon afiliasi berhasil disimpan!' })
      }
    })
  }

  return (
    <div className="space-y-8 font-sans">
      {message && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between shadow-sm ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{message.text}</span>
          </div>
          <button type="button" onClick={() => setMessage(null)} className="text-xs underline cursor-pointer">Tutup</button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-bold mb-1">
            <TicketPercent size={20} />
            <h2 className="text-lg text-slate-900">Kupon Personal Afiliasi</h2>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Setiap kali member mengaktifkan profil afiliasi, sistem otomatis membuatkan mereka satu kupon diskon pribadi (kode sama dengan kode referral mereka) memakai aturan diskon di bawah ini. Afiliasi bisa membagikan kupon ini langsung ke calon pembeli.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                Jenis Diskon
              </label>
              <select
                value={config.defaultCouponDiscountType}
                onChange={(e) => setConfig({ ...config, defaultCouponDiscountType: e.target.value === 'FIXED' ? 'FIXED' : 'PERCENT' })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="PERCENT">Persentase (%)</option>
                <option value="FIXED">Nominal Tetap (Rp)</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                <Percent size={13} />
                Nilai Diskon Default
              </label>
              <input
                type="number"
                min={1}
                max={config.defaultCouponDiscountType === 'PERCENT' ? 100 : undefined}
                value={config.defaultCouponDiscountValue}
                onChange={(e) => setConfig({ ...config, defaultCouponDiscountValue: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                {config.defaultCouponDiscountType === 'PERCENT'
                  ? `Pembeli dapat diskon ${config.defaultCouponDiscountValue || 0}% dari total belanja.`
                  : `Pembeli dapat potongan Rp${(config.defaultCouponDiscountValue || 0).toLocaleString('id-ID')}.`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
          >
            {isPending ? 'Menyimpan...' : 'Simpan Pengaturan Afiliasi'}
          </button>
        </div>
      </form>
    </div>
  )
}
