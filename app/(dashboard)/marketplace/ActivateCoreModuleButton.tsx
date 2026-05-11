'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Loader2, CheckCircle2 } from 'lucide-react'
import { activateModule } from '@/modules/marketplace/actions/marketplace.actions'

type Props = {
  moduleKey: string
}

export function ActivateCoreModuleButton({ moduleKey }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await activateModule(moduleKey)
        if (result?.success) {
          setDone(true)
          router.refresh()
        }
      } catch (err: any) {
        setError(err.message || 'Gagal mengaktifkan modul inti')
      }
    })
  }

  if (done) {
    return (
      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold tracking-tight text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-full whitespace-nowrap">
        <CheckCircle2 className="h-2.5 w-2.5" /> Aktif
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap disabled:opacity-50"
      >
        {isPending ? (
          <><Loader2 className="h-3 w-3 animate-spin" /> Mengaktifkan...</>
        ) : (
          <><Zap className="h-3 w-3" /> Aktifkan</>
        )}
      </button>
      {error && (
        <p className="text-[9px] text-red-500 font-semibold text-right">{error}</p>
      )}
    </div>
  )
}
