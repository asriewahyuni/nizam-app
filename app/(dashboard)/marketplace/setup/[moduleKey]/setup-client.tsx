'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, CheckCircle2, AlertCircle, Sparkles, Settings, CheckCircle, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { installModuleCoa, saveModuleSettings, completeModuleOnboarding } from '@/modules/marketplace/actions/marketplace.actions'
import type { ModuleDefinition, OnboardingStep } from '@/modules/marketplace/lib/module-registry'

type StepStatus = 'pending' | 'active' | 'done' | 'error'

export function SetupClient({
  mod,
}: {
  mod: ModuleDefinition
}) {
  const router = useRouter()
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(['active', 'pending', 'pending'])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [settingsSaved, setSettingsSaved] = useState(false)

  const steps: { id: string; title: string; description: string; icon: typeof Sparkles }[] = [
    { id: 'coa', title: 'Instal Chart of Accounts', description: 'Menyiapkan akun akuntansi untuk modul ini', icon: CheckCircle2 },
    { id: 'settings', title: 'Pengaturan Awal', description: 'Konfigurasi dasar modul sesuai bisnis kamu', icon: Settings },
    { id: 'done', title: 'Selesai', description: 'Modul siap digunakan', icon: Sparkles },
  ]

  function handleInstallCoa() {
    startTransition(async () => {
      try {
        await installModuleCoa(mod.key)
        setStepStatuses((prev) => {
          const next = [...prev] as StepStatus[]
          next[0] = 'done'
          next[1] = 'active'
          return next
        })
        setCurrentStepIdx(1)
        setToast({ message: 'Chart of Accounts berhasil diinstal!', type: 'success' })
        setTimeout(() => setToast(null), 3000)
      } catch (err: any) {
        setStepStatuses((prev) => {
          const next = [...prev] as StepStatus[]
          next[0] = 'error'
          return next
        })
        setToast({ message: err.message || 'Gagal menginstal CoA', type: 'error' })
        setTimeout(() => setToast(null), 5000)
      }
    })
  }

  function handleSaveSettings() {
    startTransition(async () => {
      try {
        await saveModuleSettings(mod.key, {})
        setSettingsSaved(true)
        setStepStatuses((prev) => {
          const next = [...prev] as StepStatus[]
          next[1] = 'done'
          next[2] = 'active'
          return next
        })
        setCurrentStepIdx(2)
        setToast({ message: 'Pengaturan berhasil disimpan!', type: 'success' })
        setTimeout(() => setToast(null), 3000)
      } catch (err: any) {
        setToast({ message: err.message || 'Gagal menyimpan pengaturan', type: 'error' })
        setTimeout(() => setToast(null), 5000)
      }
    })
  }

  function handleComplete() {
    startTransition(async () => {
      try {
        await completeModuleOnboarding(mod.key, true)
        setStepStatuses((prev) => {
          const next = [...prev] as StepStatus[]
          next[2] = 'done'
          return next
        })
        // Redirect to module page after short delay
        setTimeout(() => {
          router.push(mod.href)
          router.refresh()
        }, 1000)
      } catch (err: any) {
        setToast({ message: err.message || 'Gagal menyelesaikan setup', type: 'error' })
        setTimeout(() => setToast(null), 5000)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className={`w-16 h-16 rounded-3xl ${mod.color} flex items-center justify-center text-3xl mx-auto shadow-xl shadow-${mod.color}/30`}>
            {mod.icon}
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-4">Setup {mod.name}</h1>
          <p className="text-sm text-slate-500 mt-1">{mod.description}</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-10">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-200 -translate-y-1/2" />
            <div
              className="absolute left-0 top-1/2 h-0.5 bg-emerald-500 -translate-y-1/2 transition-all duration-500"
              style={{ width: `${(currentStepIdx / (steps.length - 1)) * 100}%` }}
            />
            {steps.map((step, idx) => {
              const status = stepStatuses[idx]
              return (
                <div key={step.id} className="relative flex flex-col items-center z-10">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300 ${
                      status === 'done'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : status === 'active'
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 ring-4 ring-blue-100'
                        : status === 'error'
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {status === 'done' ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                  </div>
                  <p className={`text-[10px] font-bold mt-2 text-center ${
                    status === 'done' ? 'text-emerald-600' : status === 'active' ? 'text-blue-600' : 'text-slate-400'
                  }`}>
                    {step.title}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-6 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-lg ${
                toast.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <p className="text-sm font-bold">{toast.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-8">
          {/* Step 0: Install CoA */}
          {currentStepIdx === 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Instal Chart of Accounts</h2>
                  <p className="text-sm text-slate-500">Menyiapkan akun akuntansi yang dibutuhkan oleh modul {mod.name}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                Langkah ini akan menambahkan akun-akun khusus yang diperlukan oleh modul <strong>{mod.name}</strong> ke dalam
                Chart of Accounts organisasi kamu. Proses ini aman dan tidak mengganggu akun yang sudah ada.
              </p>
              <button
                onClick={handleInstallCoa}
                disabled={isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menginstal...</>
                ) : (
                  <><Zap className="w-4 h-4" /> Instal CoA</>
                )}
              </button>
            </div>
          )}

          {/* Step 1: Settings */}
          {currentStepIdx === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Pengaturan Awal</h2>
                  <p className="text-sm text-slate-500">Konfigurasi dasar untuk modul {mod.name}</p>
                </div>
              </div>
              {mod.onboardingSteps.length > 0 ? (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                  {mod.onboardingSteps.map((step: OnboardingStep) => (
                    <div key={step.id} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-black shrink-0 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{step.title}</p>
                        <p className="text-xs text-slate-500">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  Tidak ada pengaturan tambahan yang diperlukan. Klik "Simpan" untuk melanjutkan.
                </p>
              )}
              <button
                onClick={handleSaveSettings}
                disabled={isPending || settingsSaved}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                ) : settingsSaved ? (
                  <><CheckCircle2 className="w-4 h-4" /> Tersimpan</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> Simpan Pengaturan</>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Done */}
          {currentStepIdx === 2 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Setup Selesai! 🎉</h2>
                <p className="text-sm text-slate-500 mt-2">Modul <strong>{mod.name}</strong> sudah siap digunakan.</p>
              </div>
              <button
                onClick={handleComplete}
                disabled={isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/25"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyelesaikan...</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> Buka Modul {mod.name}</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
