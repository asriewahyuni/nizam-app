'use client'

/**
 * app/global-error.tsx
 *
 * Error boundary global App Router.
 * Dipakai agar error render React juga terkirim ke Sentry.
 */

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
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
    <html lang="id" data-scroll-behavior="smooth">
      <body className="min-h-screen bg-[#F8F9FA] text-[#212529]">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
          <div className="w-full rounded-[32px] border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/50">
            <div className="text-[10px] font-semibold tracking-tight text-rose-500">
              Sistem Mengalami Gangguan
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              Halaman gagal dimuat.
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Error sudah direkam untuk tim developer. Silakan coba muat ulang halaman ini.
            </p>

            {error.digest ? (
              <p className="mt-5 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
                Ref error: {error.digest}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center justify-center rounded-2xl bg-[#003366] px-5 py-3 text-xs font-semibold tracking-tight text-white transition hover:bg-[#00264d]"
              >
                Coba Lagi
              </button>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-semibold tracking-tight text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                Kembali ke Dashboard
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
