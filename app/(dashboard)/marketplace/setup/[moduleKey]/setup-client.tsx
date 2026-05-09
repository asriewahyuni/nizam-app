'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Loader2, CheckCircle, AlertCircle,
  BookOpen, Settings, Zap, Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  installModuleCoa,
  saveModuleSettings,
  completeModuleOnboarding,
} from '@/modules/marketplace/actions/marketplace.actions'
import type { OnboardingStep } from '@/modules/marketplace/lib/module-registry'

type Props = {
  moduleKey: string
  moduleName: string
  moduleIcon: string
  moduleHref: string
  tagline: string
  hasCoa: boolean
  coaInstalled: boolean
  onboardingSteps: OnboardingStep[]
  currentSettings: Record<string, any>
}

export function SetupClient({
  moduleKey,
  moduleName,
  moduleIcon,
  moduleHref,
  tagline,
  hasCoa,
  coaInstalled,
  onboardingSteps,
  currentSettings,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [coaDone, setCoaDone] = useState(coaInstalled)
  const [settingsDone, setSettingsDone] = useState(Object.keys(currentSettings).length > 0)
  const [settings, setSettings] = useState<Record<string, string>>({})

  const allDone = coaDone && settingsDone

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function handleInstallCoa() {
    startTransition(async () => {
      try {
        await installModuleCoa(moduleKey)
        setCoaDone(true)
        showToast('Chart of Accounts berhasil diinstal!', 'success')
        router.refresh()
      } catch (err: any) {
        showToast(err.message || 'Gagal menginstal CoA', 'error')
      }
    })
  }

  function handleComplete() {
    startTransition(async () => {
      try {
        await completeModuleOnboarding(moduleKey)
        showToast('Setup selesai! Mengalihkan...', 'success')
        setTimeout(() => router.push(moduleHref), 1000)
      } catch (err: any) {
        showToast(err.message || 'Gagal menyelesaikan setup', 'error')
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-10 -mr-20 -mt-20" />
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-3xl mb-5">
            {moduleIcon}
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200 mb-2">
            Setup Modul Baru
          </div>
          <h1 className="text-2xl font-black tracking-tight">{moduleName}</h1>
          <p className="mt-2 text-sm text-blue-100 leading-relaxed">{tagline}</p>
        </div>
      </div>

      {/* ── Steps ── */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 mb-5">
          Langkah Pengaturan
        </div>

        <div className="space-y-4">
          {/* Step 1: Activated */}
          <StepRow
            number={1}
            icon={<Zap className="h-5 w-5" />}
            title="Modul Diaktifkan"
            description="Modul sudah terdaftar untuk organisasi Anda."
            done
            alwaysDone
          />

          {/* Step 2: Install CoA */}
          {hasCoa && (
            <div className={`rounded-2xl border p-5 transition-all ${coaDone ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${coaDone ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Install Chart of Accounts</span>
                    {coaDone && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Pasang akun-akun khusus yang dibutuhkan untuk modul {moduleName}.
                  </p>
                  {!coaDone && (
                    <button
                      onClick={handleInstallCoa}
                      disabled={isPending}
                      className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-70"
                    >
                      {isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menginstal...</>
                      ) : (
                        <><BookOpen className="h-3.5 w-3.5" /> Install CoA</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Settings */}
          {onboardingSteps.filter(s => s.id !== 'coa').length > 0 && (
            <div className={`rounded-2xl border p-5 transition-all ${settingsDone ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${settingsDone ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  <Settings className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Pengaturan Awal</span>
                    {settingsDone && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Konfigurasi awal untuk menyesuaikan modul dengan bisnis Anda.
                  </p>
                  {!settingsDone && (
                    <button
                      onClick={() => setSettingsDone(true)}
                      className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all"
                    >
                      <Settings className="h-3.5 w-3.5" /> Konfirmasi Pengaturan
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CoA-only fallback if no settings steps */}
          {!hasCoa && onboardingSteps.filter(s => s.id !== 'coa').length === 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-slate-900">Siap Digunakan</span>
                  <p className="text-xs text-slate-500 mt-1">
                    Modul ini tidak memerlukan pengaturan awal tambahan.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Complete Button ── */}
      <div className="flex justify-end">
        <button
          onClick={handleComplete}
          disabled={!allDone || isPending}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-3 text-sm font-bold text-white shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Menyelesaikan...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Selesai — Buka {moduleName}</>
          )}
        </button>
      </div>

      {/* Toast */}
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
    </div>
  )
}

// ── Step Row ────────────────────────────────────────────────────────────────
function StepRow({
  number,
  icon,
  title,
  description,
  done,
  alwaysDone,
}: {
  number: number
  icon: React.ReactNode
  title: string
  description: string
  done: boolean
  alwaysDone?: boolean
}) {
  const isComplete = alwaysDone || done
  return (
    <div className={`rounded-2xl border p-5 transition-all ${isComplete ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{title}</span>
            {isComplete && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
      </div>
    </div>
  )
}
