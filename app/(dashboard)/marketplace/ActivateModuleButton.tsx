'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, X, CreditCard, Tag, CheckCircle2, Sparkles, Shield } from 'lucide-react'
import { activateModule } from '@/modules/marketplace/actions/marketplace.actions'
import { motion, AnimatePresence } from 'framer-motion'

type Props = {
  moduleKey: string
  moduleName?: string
  moduleIcon?: string
  moduleColor?: string
  price?: number
  disabled?: boolean
}

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

export function ActivateModuleButton({ moduleKey, moduleName, moduleIcon, moduleColor, price, disabled }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [voucher, setVoucher] = useState('')
  const [voucherApplied, setVoucherApplied] = useState(false)
  const [voucherError, setVoucherError] = useState<string | null>(null)
  const [discountPct, setDiscountPct] = useState(0)

  // Handle navigation after successful activation
  useEffect(() => {
    if (redirectUrl && !isPending) {
      router.push(redirectUrl)
    }
  }, [redirectUrl, isPending, router])

  // Voucher mock validation
  function handleApplyVoucher() {
    const code = voucher.trim().toUpperCase()
    if (code === 'GRATIS30') {
      setDiscountPct(30)
      setVoucherApplied(true)
      setVoucherError(null)
    } else if (code === 'COBA50') {
      setDiscountPct(50)
      setVoucherApplied(true)
      setVoucherError(null)
    } else if (code === 'FULL100') {
      setDiscountPct(100)
      setVoucherApplied(true)
      setVoucherError(null)
    } else if (code) {
      setVoucherError('Kode voucher tidak valid atau sudah kedaluwarsa.')
      setVoucherApplied(false)
      setDiscountPct(0)
    }
  }

  function handleActivate() {
    setError(null)
    setRedirectUrl(null)
    startTransition(async () => {
      try {
        const result = await activateModule(moduleKey)
        if (result?.success && result?.redirectUrl) {
          setRedirectUrl(result.redirectUrl)
          setShowPayment(false)
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat mengaktifkan modul')
        setShowPayment(false)
      }
    })
  }

  const finalPrice = price !== undefined ? Math.round(price * (1 - discountPct / 100)) : undefined

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowPayment(true)}
          disabled={disabled || isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-slate-200 hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Mengaktifkan...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Aktifkan Modul
            </>
          )}
        </button>
        {error && (
          <p className="text-[10px] text-red-500 font-semibold">{error}</p>
        )}
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
            >
              {/* Header */}
              <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-6 pt-6 pb-8 text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-8 -mt-8" />
                <button
                  onClick={() => { setShowPayment(false); setError(null) }}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="relative flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${moduleColor || 'bg-blue-600'} flex items-center justify-center text-2xl shadow-lg`}>
                    {moduleIcon || '📦'}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-0.5">Aktivasi Modul</p>
                    <h2 className="text-lg font-black leading-tight">{moduleName || moduleKey}</h2>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Pricing */}
                {price !== undefined ? (
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-500">Biaya Berlangganan</span>
                      {voucherApplied && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Diskon {discountPct}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      {voucherApplied && discountPct > 0 && (
                        <span className="text-sm text-slate-400 line-through">{formatRp(price)}</span>
                      )}
                      <span className="text-2xl font-black text-slate-900">
                        {finalPrice === 0 ? 'Gratis' : formatRp(finalPrice ?? price)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">/ bulan</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                      Ditambahkan ke tagihan langganan. Batalkan kapan saja.
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-black text-blue-700">Sudah Termasuk Paket</span>
                    </div>
                    <p className="text-xs text-blue-600">Modul ini sudah termasuk dalam paket berlangganan Anda tanpa biaya tambahan.</p>
                  </div>
                )}

                {/* Voucher */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-2">
                    <Tag className="h-3.5 w-3.5 inline mr-1.5 text-slate-400" />
                    Kode Voucher (opsional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Masukkan kode voucher..."
                      value={voucher}
                      onChange={(e) => {
                        setVoucher(e.target.value)
                        setVoucherApplied(false)
                        setVoucherError(null)
                        setDiscountPct(0)
                      }}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold placeholder-slate-300 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all uppercase"
                    />
                    <button
                      onClick={handleApplyVoucher}
                      disabled={!voucher.trim() || voucherApplied}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {voucherApplied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : 'Pakai'}
                    </button>
                  </div>
                  {voucherApplied && (
                    <p className="text-[10px] font-bold text-emerald-600 mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Voucher berhasil diterapkan! Diskon {discountPct}%
                    </p>
                  )}
                  {voucherError && (
                    <p className="text-[10px] font-bold text-red-500 mt-1.5">{voucherError}</p>
                  )}
                </div>

                {/* Benefits */}
                <div className="space-y-2">
                  {[
                    'Akses penuh ke seluruh fitur modul',
                    'Chart of Accounts otomatis terpasang',
                    'Data tidak hilang saat nonaktif',
                    'Batalkan langganan kapan saja',
                  ].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs text-slate-600 font-medium">{benefit}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setShowPayment(false); setError(null) }}
                    disabled={isPending}
                    className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleActivate}
                    disabled={isPending}
                    className="flex-1 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
                  >
                    {isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</>
                    ) : (
                      <><CreditCard className="h-4 w-4" /> Konfirmasi &amp; Aktifkan</>
                    )}
                  </button>
                </div>

                <p className="text-center text-[10px] text-slate-400 font-medium">
                  🔒 Pembayaran aman · Tagihan muncul di siklus langganan berikutnya
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
