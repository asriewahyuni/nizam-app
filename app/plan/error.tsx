'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function PlanError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center">
            <AlertTriangle size={28} className="text-rose-500" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">
            Gagal Memuat Halaman
          </p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Tidak dapat menampilkan paket saat ini.
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Terjadi gangguan sementara. Coba muat ulang halaman ini.
          </p>
          {error.digest && (
            <p className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-xl px-4 py-2 inline-block">
              Ref: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center px-6 py-3 bg-[#003366] text-white text-xs font-black uppercase tracking-[0.18em] rounded-2xl hover:bg-[#00264d] transition-colors cursor-pointer"
          >
            Coba Lagi
          </button>
          <a
            href="https://wa.me/6281227145000?text=Halo%2C%20saya%20ingin%20konsultasi%20mengenai%20paket%20Nizam%20MiniERP.%20Bisa%20dibantu%3F"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-[0.18em] rounded-2xl hover:border-slate-300 transition-colors cursor-pointer"
          >
            Hubungi Kami
          </a>
        </div>

        <p className="text-xs text-slate-400">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-[#003366] font-black hover:underline">
            Masuk →
          </Link>
        </p>
      </div>
    </div>
  )
}
