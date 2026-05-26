'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { installModuleCoa, saveModuleSettings } from '@/modules/marketplace/actions/marketplace.actions'

export function InstallCoaButton({ moduleKey }: { moduleKey: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

  const handleInstall = () => {
    startTransition(async () => {
      try {
        await installModuleCoa(moduleKey)
        setToast({ message: 'Chart of Accounts berhasil diinstal!', type: 'success' })
        setTimeout(() => {
          setToast(null)
          router.refresh()
        }, 2000)
      } catch (err: any) {
        setToast({ message: err.message || 'Gagal menginstal CoA', type: 'error' })
        setTimeout(() => setToast(null), 3000)
      }
    })
  }

  return (
    <>
      <button
        onClick={handleInstall}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-70"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Menginstal...
          </>
        ) : (
          <>
            Install CoA LMS <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl px-6 py-4 shadow-xl ${
              toast.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-rose-50 border border-rose-100 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            )}
            <p className="text-sm font-bold tracking-tight">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function SettingsForm({
  moduleKey,
  currentSettings,
  defaultInstitutionName,
}: {
  moduleKey: string
  currentSettings: any
  defaultInstitutionName: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    
    startTransition(async () => {
      try {
        await saveModuleSettings(moduleKey, {
          institutionName: fd.get('institutionName') as string,
          allowPublicRegistration: fd.get('allowPublicRegistration') === 'on',
          defaultCurrency: fd.get('defaultCurrency') as string,
        })
        setToast({ message: 'Pengaturan berhasil disimpan!', type: 'success' })
        setTimeout(() => {
          setToast(null)
          router.refresh()
        }, 2000)
      } catch (err: any) {
        setToast({ message: err.message || 'Gagal menyimpan pengaturan', type: 'error' })
        setTimeout(() => setToast(null), 3000)
      }
    })
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
        <label className="block text-sm">
          <div className="font-bold text-slate-900 mb-1.5">Nama Lembaga Pelatihan</div>
          <input
            name="institutionName"
            defaultValue={currentSettings?.institutionName ?? defaultInstitutionName}
            required
            placeholder="Contoh: Balai Pelatihan Nizam"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 bg-slate-50 disabled:opacity-50"
            disabled={isPending}
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <div className="font-bold text-slate-900 mb-1.5">Mata Uang Default</div>
            <select
              name="defaultCurrency"
              defaultValue={currentSettings?.defaultCurrency ?? 'IDR'}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 bg-slate-50 disabled:opacity-50"
              disabled={isPending}
            >
              <option value="IDR">IDR (Rupiah)</option>
              <option value="USD">USD (Dollar)</option>
            </select>
          </label>
          <label className={`flex items-center gap-3 pt-6 text-sm ${isPending ? 'opacity-50' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              name="allowPublicRegistration"
              defaultChecked={currentSettings?.allowPublicRegistration !== false}
              className="w-5 h-5 rounded text-blue-600 border-slate-300"
              disabled={isPending}
            />
            <div>
              <div className="font-bold text-slate-900">Registrasi Publik</div>
              <div className="text-xs text-slate-500">Izinkan pendaftaran dari luar</div>
            </div>
          </label>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-xl shadow-slate-100 disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
            </>
          ) : (
            'Simpan Pengaturan'
          )}
        </button>
      </form>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl px-6 py-4 shadow-xl ${
              toast.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-rose-50 border border-rose-100 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            )}
            <p className="text-sm font-bold tracking-tight">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
