'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Zap, ShieldCheck, Blocks } from 'lucide-react'
import { saveSaasModulePrices } from '@/modules/saas/actions/saas-settings.actions'
import { type ModuleDefinition } from '@/modules/marketplace/lib/module-registry'
import { type OperatorAddonOption } from '@/lib/saas/operator-pricing'

type PriceState = {
  operationalPrices: Record<string, number>
  corePrices: Record<string, number>
  addonPrices: Record<string, number>
}

export function SaasSettingsForm({
  initialPrices,
  coreModules,
  operationalModules,
  addons,
}: {
  initialPrices: PriceState
  coreModules: ModuleDefinition[]
  operationalModules: ModuleDefinition[]
  addons: OperatorAddonOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [prices, setPrices] = useState<PriceState>(initialPrices)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSave = () => {
    setIsSuccess(false)
    startTransition(async () => {
      try {
        await saveSaasModulePrices(prices)
        setIsSuccess(true)
        router.refresh()
        setTimeout(() => setIsSuccess(false), 3000)
      } catch (err: any) {
        alert(err.message || 'Gagal menyimpan harga.')
      }
    })
  }

  const handlePriceChange = (category: keyof PriceState, key: string, value: string) => {
    setPrices((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: parseInt(value) || 0,
      },
    }))
  }

  return (
    <div className="space-y-6">
      {/* ── CORE MODULES ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <h2 className="text-base font-semibold text-slate-900">Harga Modul Inti (Core)</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Harga referensi per bulan untuk modul inti. Digunakan untuk kustomisasi penawaran.
          </p>
        </div>
        <div className="p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {coreModules.map((mod) => (
              <div key={mod.key} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${mod.color} flex items-center justify-center text-lg flex-shrink-0 shadow-sm`}>
                    {mod.icon}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-900">{mod.name}</label>
                  </div>
                </div>
                <div className="mt-2 flex items-center relative">
                  <span className="absolute left-3 text-sm font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={prices.corePrices[mod.key] === 0 ? '' : prices.corePrices[mod.key] ?? ''}
                    onChange={(e) => handlePriceChange('corePrices', mod.key, e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── OPERATIONAL MODULES ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            <h2 className="text-base font-semibold text-slate-900">Harga Modul Operasional</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Harga per bulan. Akan tampil secara global di halaman Marketplace pelanggan.
          </p>
        </div>
        <div className="p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {operationalModules.map((mod) => (
              <div key={mod.key} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${mod.color} flex items-center justify-center text-lg flex-shrink-0 shadow-sm`}>
                    {mod.icon}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-900">{mod.name}</label>
                  </div>
                </div>
                <div className="mt-2 flex items-center relative">
                  <span className="absolute left-3 text-sm font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={prices.operationalPrices[mod.key] === 0 ? '' : prices.operationalPrices[mod.key] ?? ''}
                    onChange={(e) => handlePriceChange('operationalPrices', mod.key, e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ADD-ONS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
          <div className="flex items-center gap-2">
            <Blocks className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-900">Harga Add-on</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Harga per bulan untuk fitur dan limit tambahan.
          </p>
        </div>
        <div className="p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {addons.map((addon) => (
              <div key={addon.id} className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-900">{addon.name}</label>
                    <span className="block text-[10px] text-slate-500 mt-0.5 line-clamp-1">{addon.description}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center relative">
                  <span className="absolute left-3 text-sm font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={prices.addonPrices[addon.name] === 0 ? '' : prices.addonPrices[addon.name] ?? ''}
                    onChange={(e) => handlePriceChange('addonPrices', addon.name, e.target.value)}
                    placeholder={addon.price.toString()}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Action Bar */}
          <div className="mt-8 flex items-center justify-end gap-4 border-t border-slate-100 pt-6">
            {isSuccess && (
              <span className="text-sm font-bold text-emerald-600">Berhasil disimpan!</span>
            )}
            <button type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</>
              ) : (
                <><Save className="h-4 w-4" /> Simpan Perubahan Harga</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
