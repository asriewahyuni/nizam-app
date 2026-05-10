'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PowerOff, Loader2, AlertTriangle, X } from 'lucide-react'
import { deactivateModule } from '@/modules/marketplace/actions/marketplace.actions'

type Props = {
  moduleKey: string
  moduleName: string
}

export function DeactivateModuleButton({ moduleKey, moduleName }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await deactivateModule(moduleKey)
        setShowConfirm(false)
        if (result?.success && result?.redirectUrl) {
          router.push(result.redirectUrl)
        } else {
          router.refresh()
        }
      } catch (err: any) {
        // error already shown to user via alert or toast
        setShowConfirm(false)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors py-1"
        title="Nonaktifkan modul"
      >
        <PowerOff className="h-3.5 w-3.5" />
        Nonaktifkan
      </button>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h3 className="text-base font-black text-slate-900 mb-1">
              Nonaktifkan {moduleName}?
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Modul ini akan hilang dari sidebar dan pengguna tidak dapat mengaksesnya.{' '}
              <strong className="text-slate-700">Data tidak akan dihapus</strong> — modul dapat diaktifkan kembali kapan saja.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1 rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menonaktifkan...
                  </>
                ) : (
                  <>
                    <PowerOff className="h-4 w-4" />
                    Ya, Nonaktifkan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
