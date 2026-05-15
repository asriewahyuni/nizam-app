'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, CheckCircle, AlertCircle, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { installModuleCoa, saveModuleSettings } from '@/modules/marketplace/actions/marketplace.actions'

// ── Toast Notification ──────────────────────────────────────────────────────

function Toast({ toast }: { toast: { message: string; type: 'success' | 'error' } | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl px-6 py-4 shadow-xl ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-100 text-emerald-800'
              : 'bg-rose-50 border border-rose-100 text-rose-800'
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
  )
}

// ── Install CoA Button ──────────────────────────────────────────────────────

export function InstallCoaButton({
  moduleKey,
  label = 'Install CoA',
  doneLabel = 'CoA Terinstal',
}: {
  moduleKey: string
  label?: string
  doneLabel?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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
        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-70"
      >
        {isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Menginstal...</>
        ) : (
          <><CheckCircle className="h-4 w-4" /> {label} <ArrowRight className="h-4 w-4" /></>
        )}
      </button>
      <Toast toast={toast} />
    </>
  )
}

// ── Simple Settings Form ────────────────────────────────────────────────────
// Renders a list of fields defined in `fields` prop.

export type SettingsField = {
  name: string
  label: string
  type: 'text' | 'select' | 'number'
  placeholder?: string
  options?: { value: string; label: string }[]
  defaultValue?: string
}

export function SimpleSettingsForm({
  moduleKey,
  fields,
  defaultValues = {},
  buttonLabel = 'Simpan Pengaturan',
  successMessage = 'Pengaturan berhasil disimpan!',
}: {
  moduleKey: string
  fields: SettingsField[]
  defaultValues?: Record<string, string>
  buttonLabel?: string
  successMessage?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const settings: Record<string, string> = {}
    fields.forEach((f) => {
      const val = fd.get(f.name)
      if (val) settings[f.name] = val as string
    })

    startTransition(async () => {
      try {
        await saveModuleSettings(moduleKey, settings)
        setToast({ message: successMessage, type: 'success' })
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
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">{field.label}</label>
            {field.type === 'select' && field.options ? (
              <select
                name={field.name}
                defaultValue={defaultValues[field.name] || field.defaultValue || ''}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                name={field.name}
                defaultValue={defaultValues[field.name] || field.defaultValue || ''}
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-70"
        >
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</>
          ) : (
            <><Check className="h-4 w-4" /> {buttonLabel}</>
          )}
        </button>
      </form>
      <Toast toast={toast} />
    </>
  )
}

// ── Complete Button ─────────────────────────────────────────────────────────

export function CompleteOnboardingButton({
  moduleKey,
  redirectTo,
  label = 'Mulai Gunakan',
}: {
  moduleKey: string
  redirectTo: string
  label?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleComplete = () => {
    startTransition(async () => {
      const { completeModuleOnboarding } = await import('@/modules/marketplace/actions/marketplace.actions')
      await completeModuleOnboarding(moduleKey)
      router.push(redirectTo)
    })
  }

  return (
    <button
      onClick={handleComplete}
      disabled={isPending}
      className="w-full rounded-3xl bg-emerald-600 p-5 text-lg font-semibold text-white shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
    >
      {isPending ? (
        <><Loader2 className="h-5 w-5 animate-spin" /> Menyiapkan...</>
      ) : (
        <><CheckCircle className="h-6 w-6" /> {label}</>
      )}
    </button>
  )
}
