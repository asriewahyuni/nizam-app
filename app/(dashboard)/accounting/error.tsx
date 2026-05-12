'use client'

import { useEffect } from 'react'

export default function AccountingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Accounting Error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center py-24">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <span className="text-xl">📊</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Gagal Muat Data Keuangan</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Data keuangan tidak bisa dimuat saat ini. Kemungkinan koneksi terputus atau server sibuk.
          Coba refresh halaman atau periksa koneksi internet kamu.
        </p>
        {error.digest && (
          <p className="text-[10px] text-slate-400 bg-slate-100 rounded-xl px-3 py-2 font-mono">
            Kode error: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all"
        >
          Muat Ulang
        </button>
      </div>
    </div>
  )
}
