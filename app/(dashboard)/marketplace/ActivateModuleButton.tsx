'use client'

import { useState, useTransition } from 'react'
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
  const [voucher, setVoucher] = useState('')
  const [voucherApplied, setVoucherApplied] = useState(false)
  const [voucherError, setVoucherError] = useState<string | null>(null)
  const [discountPct, setDiscountPct] = useState(0)
  const [redirecting, setRedirecting] = useState(false)

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
    setRedirecting(true)
    startTransition(async () => {
      try {
        const result = await activateModule(moduleKey)
        if (result?.success && result?.redirectUrl) {
          // Redirect di luar transition biar gak konflik sama React batching
          setTimeout(() => {
            window.location.href = result.redirectUrl
          }, 50)
        } else {
          setRedirecting(false)
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat mengaktifkan modul')
        setShowPayment(false)
        setRedirecting(false)
      }
    })
  }

  if (redirecting) {
    return (
      <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-100">
        <Loader2 className="h-4 w-4 animate-spin" /> Mengalihkan ke Setup...
      </div>
    )
  }

  // If no price, show simple activation button
  if (price === undefined || price === 0) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={handleActivate}
          disabled={disabled || isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-slate-200 hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Mengaktifkan...
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4" /> Aktifkan Modul
            </>
          )}
        </button>
        {error && (
          <p className="text-[10px] text-red-500 font-semibold">{error}</p>
        )}
      </div>
    )
  }

  // ── Paid module: show price + payment modal ──
  const finalPrice = discountPct > 0 ? Math.round(price * (100 - discountPct) / 100) : price

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setShowPayment(true)}
        disabled={disabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50"
      >
        <CreditCard className="h-3.5 w-3.5" />
        Aktifkan Mulai {formatRp(price)}
      </button>

      <AnimatePresence>
        {showPayment && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => { if (!isPending) setShowPayment(false) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200"
            >
              {/* Close */}
              <button
                onClick={() => setShowPayment(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
                disabled={isPending}
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-12 h-12 rounded-2xl ${moduleColor || 'bg-slate-100'} flex items-center justify-center text-xl shadow-inner`}>
                  {moduleIcon || '📦'}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{moduleName || 'Modul'}</h3>
                  <p className="text-[10px] font-semibold text-slate-400">Konfirmasi Aktivasi</p>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Harga Modul</span>
                  <span className="font-bold text-slate-900">{formatRp(price)}</span>
                </div>
                {discountPct > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-600 font-semibold">Diskon {discountPct}%</span>
                    <span className="font-bold text-emerald-600">-{formatRp(price - finalPrice)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm">
                  <span className="font-bold text-slate-700">Total</span>
                  <span className="font-semibold text-slate-900">{formatRp(finalPrice)}</span>
                </div>
              </div>

              {/* Voucher */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Tag className="h-3 w-3 text-purple-500" />
                  <span className="text-[10px] font-bold text-purple-600 tracking-tight">Voucher</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Masukkan kode voucher"
                    value={voucher}
                    onChange={e => setVoucher(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                  <button
                    onClick={handleApplyVoucher}
                    disabled={!voucher.trim()}
                    className="rounded-xl bg-purple-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-purple-700 transition-all disabled:opacity-40"
                  >
                    Pakai
                  </button>
                </div>
                {voucherApplied && (
                  <p className="mt-1 text-[10px] font-semibold text-emerald-600">✅ Voucher {voucher.toUpperCase()} berhasil diterapkan!</p>
                )}
                {voucherError && (
                  <p className="mt-1 text-[10px] font-semibold text-red-500">{voucherError}</p>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={handleActivate}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-semibold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50"
              >
                {isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</>
                ) : (
                  <><Shield className="h-3.5 w-3.5" /> Aktifkan Sekarang</>
                )}
              </button>

              {error && (
                <p className="mt-2 text-[10px] text-red-500 font-semibold text-center">{error}</p>
              )}

              <p className="mt-3 text-[9px] text-slate-400 font-semibold text-center">
                Dengan mengaktifkan, Anda menyetujui Syarat & Ketentuan penggunaan modul.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}