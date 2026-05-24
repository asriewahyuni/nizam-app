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
    console.error('[AccountingError] Detail error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="flex items-center justify-center py-24">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
            <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
          </svg>
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
        {isDev && error.message && (
          <details className="text-left">
            <summary className="text-[10px] font-semibold text-slate-500 cursor-pointer hover:text-slate-900">
              Detail (dev mode)
            </summary>
            <pre className="mt-2 text-[9px] text-rose-700 bg-rose-50 rounded-xl px-3 py-2 font-mono overflow-auto text-left whitespace-pre-wrap break-all">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        )}
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer"
        >
          Muat Ulang
        </button>
      </div>
    </div>
  )
}
