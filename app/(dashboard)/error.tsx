'use client'

import { useEffect } from 'react'
import { ErrorBoundary } from '@/components/ui/NizamUI'

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
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Terjadi Kesalahan</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Maaf, terjadi kesalahan yang tidak terduga. Tim kami telah mencatat error ini.
        </p>
        <div className="text-xs text-slate-400 bg-slate-100 rounded-xl p-3 font-mono break-all">
          {error.message || 'Unknown error'}
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  )
}
