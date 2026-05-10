'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { activateModule } from '@/modules/marketplace/actions/marketplace.actions'

type Props = {
  moduleKey: string
  disabled?: boolean
}

export function ActivateModuleButton({ moduleKey, disabled }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleActivate() {
    setError(null)
    startTransition(async () => {
      try {
        await activateModule(moduleKey)
        setSuccess(true)
        // Redirect ke halaman setup — pake window.location biar gak konflik sama revalidatePath
        setTimeout(() => {
          window.location.href = `/marketplace/setup/${encodeURIComponent(moduleKey)}`
        }, 500)
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat mengaktifkan modul')
      }
    })
  }

  if (success) {
    return (
      <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-100">
        <CheckCircle2 className="h-4 w-4" /> Mengalihkan ke Setup...
      </div>
    )
  }

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
