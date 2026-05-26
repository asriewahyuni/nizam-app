'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard Error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
          Halaman gagal dimuat
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Ada kendala saat memuat halaman ini. Kamu bisa coba muat ulang atau kembali ke dashboard.
        </p>
        {error.digest && (
          <p className="text-[10px] text-slate-400 bg-slate-100 rounded-xl px-3 py-2 font-mono">
            Kode error: {error.digest}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm"
          >
            Muat Ulang
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-all"
          >
            Kembali ke Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
