'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createLmsRegistration } from '@/modules/edu/actions/lms-registration.actions'
import { CheckCircle2, Loader2 } from 'lucide-react'

type Props = {
  batchId: string
  price: number
  paymentInstructions: string | null
}

export default function RegistrationForm({ batchId, price, paymentInstructions }: Props) {
  const [state, action, isPending] = useActionState(createLmsRegistration, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success) formRef.current?.reset()
  }, [state])

  if (state?.success) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h3 className="mt-3 text-lg font-bold text-emerald-800">Pendaftaran Berhasil!</h3>
          <p className="mt-1 text-sm text-emerald-700">
            Data Anda telah kami terima. Silakan selesaikan pembayaran untuk mengkonfirmasi keikutsertaan Anda.
          </p>
        </div>

        {price > 0 && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <h4 className="text-sm font-bold text-blue-900 mb-3">Informasi Pembayaran</h4>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-blue-700">Total yang harus dibayar:</span>
              <span className="text-xl font-black text-blue-900">
                Rp{price.toLocaleString('id-ID')}
              </span>
            </div>
            {paymentInstructions ? (
              <div className="rounded-xl bg-white border border-blue-100 p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Cara Pembayaran</p>
                <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                  {paymentInstructions}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-blue-600 italic">
                Instruksi pembayaran akan dikirim ke email Anda oleh tim kami.
              </p>
            )}
          </div>
        )}

        <p className="text-center text-xs text-slate-500">
          Setelah pembayaran dikonfirmasi, status pendaftaran Anda akan berubah menjadi <strong>Terkonfirmasi</strong>.
        </p>
      </div>
    )
  }

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <input type="hidden" name="batchId" value={batchId} />

      {state?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-1.5">
          Nama Lengkap <span className="text-red-500">*</span>
        </label>
        <input
          name="fullName"
          required
          placeholder="Masukkan nama lengkap Anda"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 bg-slate-50"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-1.5">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          name="email"
          required
          placeholder="nama@email.com"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 bg-slate-50"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-900 mb-1.5">
          No. WhatsApp / Telepon
        </label>
        <input
          type="tel"
          name="phone"
          placeholder="08xx-xxxx-xxxx"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 bg-slate-50"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-sm font-bold text-white transition hover:bg-blue-700 shadow-xl shadow-blue-100 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isPending ? 'Memproses...' : 'Daftar Sekarang'}
      </button>

      <p className="text-center text-xs text-slate-400">
        Dengan mendaftar, Anda menyetujui syarat dan ketentuan yang berlaku.
      </p>
    </form>
  )
}
