'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, CheckCircle2, AlertCircle, Sparkles, Settings, CheckCircle, Zap, BookOpen, SkipForward } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { installModuleCoa, saveModuleSettings, completeModuleOnboarding } from '@/modules/marketplace/actions/marketplace.actions'
import type { ModuleDefinition } from '@/modules/marketplace/lib/module-registry'

type StepStatus = 'pending' | 'active' | 'done' | 'error'

type StepDef = {
  id: string
  title: string
  description: string
  icon: React.ElementType
  required: boolean
}

function buildSteps(mod: ModuleDefinition): StepDef[] {
  const steps: StepDef[] = []
  const hasCoaStep = mod.onboardingSteps.some((s) => s.id === 'coa')
  const hasSettingsStep = mod.onboardingSteps.some((s) => s.id === 'settings')

  if (hasCoaStep || mod.coaInjectionFn) {
    steps.push({
      id: 'coa',
      title: 'Instal Chart of Accounts',
      description: `Pasang akun akuntansi spesifik untuk modul ${mod.name}`,
      icon: BookOpen,
      required: !!mod.coaInjectionFn,
    })
  }

  steps.push({
    id: 'settings',
    title: 'Pengaturan Awal',
    description: hasSettingsStep
      ? mod.onboardingSteps.find((s) => s.id === 'settings')?.description ?? 'Konfigurasi dasar modul'
      : 'Tidak ada konfigurasi tambahan yang diperlukan',
    icon: Settings,
    required: false,
  })

  steps.push({
    id: 'done',
    title: 'Modul Aktif',
    description: 'Semua siap — modul sudah bisa digunakan',
    icon: Sparkles,
    required: false,
  })

  return steps
}

export function SetupClient({
  mod,
  coaInstalled = false,
  currentSettings = {},
}: {
  mod: ModuleDefinition
  coaInstalled?: boolean
  currentSettings?: Record<string, any>
}) {
  const router = useRouter()
  const steps = buildSteps(mod)

  // Determine initial step based on what's already done
  const getInitialStep = () => {
    if (coaInstalled) return 1  // CoA done, go to settings
    return 0
  }

  const [currentStepIdx, setCurrentStepIdx] = useState(getInitialStep())
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(() => {
    const initial: StepStatus[] = steps.map(() => 'pending')
    const startIdx = getInitialStep()
    for (let i = 0; i < startIdx; i++) initial[i] = 'done'
    if (startIdx < initial.length) initial[startIdx] = 'active'
    return initial
  })
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), toast.type === 'error' ? 6000 : 3500)
      return () => clearTimeout(t)
    }
  }, [toast])

  function goToStep(nextIdx: number, prevIdx: number, success = true) {
    setStepStatuses((prev) => {
      const next = [...prev] as StepStatus[]
      next[prevIdx] = success ? 'done' : 'error'
      if (nextIdx < next.length) next[nextIdx] = 'active'
      return next
    })
    setCurrentStepIdx(nextIdx)
  }

  function handleInstallCoa() {
    startTransition(async () => {
      try {
        await installModuleCoa(mod.key)
        goToStep(1, 0, true)
        setToast({ message: 'Chart of Accounts berhasil diinstal! ✅', type: 'success' })
      } catch (err: any) {
        setStepStatuses((prev) => { const n = [...prev] as StepStatus[]; n[0] = 'error'; return n })
        setToast({ message: err.message || 'Gagal menginstal CoA', type: 'error' })
      }
    })
  }

  function handleSaveSettings() {
    startTransition(async () => {
      try {
        await saveModuleSettings(mod.key, currentSettings)
        setSettingsSaved(true)
        const doneIdx = steps.length - 1
        goToStep(doneIdx, currentStepIdx, true)
        setToast({ message: 'Pengaturan berhasil disimpan! ✅', type: 'success' })
      } catch (err: any) {
        setToast({ message: err.message || 'Gagal menyimpan pengaturan', type: 'error' })
      }
    })
  }

  function handleSkipSettings() {
    setSettingsSaved(true)
    const doneIdx = steps.length - 1
    goToStep(doneIdx, currentStepIdx, true)
    setToast({ message: 'Langsung ke tahap akhir', type: 'success' })
  }

  function handleComplete() {
    startTransition(async () => {
      try {
        await completeModuleOnboarding(mod.key)
        setStepStatuses((prev) => { const n = [...prev] as StepStatus[]; n[steps.length - 1] = 'done'; return n })
        setTimeout(() => {
          router.push(mod.href)
          // Tidak perlu router.refresh() — router.push sudah full load halaman baru
        }, 600)
      } catch (err: any) {
        setToast({ message: err.message || 'Gagal menyelesaikan setup', type: 'error' })
      }
    })
  }

  const coaStepIdx = steps.findIndex((s) => s.id === 'coa')
  const settingsStepIdx = steps.findIndex((s) => s.id === 'settings')
  const doneStepIdx = steps.findIndex((s) => s.id === 'done')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`w-20 h-20 rounded-xl ${mod.color} flex items-center justify-center text-4xl mx-auto shadow-md`}
          >
            {mod.icon}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-2xl font-semibold text-slate-900 mt-4">Setup {mod.name}</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{mod.description}</p>
          </motion.div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-lg p-6">
          <div className="flex items-center justify-between relative">
            {/* Progress track */}
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-slate-100" />
            <div
              className="absolute left-0 top-5 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${(currentStepIdx / Math.max(steps.length - 1, 1)) * 100}%` }}
            />

            {steps.map((step, idx) => {
              const status = stepStatuses[idx]
              const StepIcon = step.icon
              return (
                <div key={step.id} className="relative flex flex-col items-center z-10 flex-1">
                  <motion.div
                    animate={{
                      scale: status === 'active' ? 1.1 : 1,
                    }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      status === 'done'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : status === 'active'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-4 ring-blue-100'
                        : status === 'error'
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-100 text-slate-300'
                    }`}
                  >
                    {status === 'done' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : status === 'active' ? (
                      <StepIcon className="w-5 h-5" />
                    ) : (
                      idx + 1
                    )}
                  </motion.div>
                  <p className={`text-[10px] font-semibold mt-2 text-center leading-tight max-w-[80px] ${
                    status === 'done' ? 'text-emerald-600' : status === 'active' ? 'text-blue-600' : 'text-slate-300'
                  }`}>
                    {step.title}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className={`px-5 py-3 rounded-xl flex items-center gap-3 shadow-lg ${
                toast.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <p className="text-sm font-bold">{toast.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white rounded-xl border border-slate-200/80 shadow-xl shadow-slate-100/60 p-8"
          >
            {/* ── Step: CoA ── */}
            {currentStepIdx === coaStepIdx && coaStepIdx >= 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Instal Chart of Accounts</h2>
                    <p className="text-sm text-slate-500">
                      {mod.onboardingSteps.find((s) => s.id === 'coa')?.description ?? `Siapkan akun akuntansi untuk ${mod.name}`}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-2">
                  <p className="text-xs font-semibold text-blue-800">Yang akan dipasang:</p>
                  {mod.onboardingSteps.find((s) => s.id === 'coa') ? (
                    <p className="text-xs text-blue-600">
                      {mod.onboardingSteps.find((s) => s.id === 'coa')!.description}
                    </p>
                  ) : (
                    <p className="text-xs text-blue-600">
                      Akun-akun khusus yang dibutuhkan modul {mod.name} akan ditambahkan ke CoA organisasi. Proses ini aman dan tidak menimpa akun yang sudah ada.
                    </p>
                  )}
                </div>

                {coaInstalled ? (
                  <div className="flex items-center gap-3 bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-sm font-bold text-emerald-700">Chart of Accounts sudah terpasang sebelumnya.</p>
                  </div>
                ) : (
                  <button
                    onClick={handleInstallCoa}
                    disabled={isPending}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/25"
                  >
                    {isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Menginstal CoA...</>
                    ) : (
                      <><Zap className="w-4 h-4" /> Instal Chart of Accounts</>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* ── Step: Settings ── */}
            {currentStepIdx === settingsStepIdx && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Pengaturan Awal</h2>
                    <p className="text-sm text-slate-500">Konfigurasi dasar untuk modul {mod.name}</p>
                  </div>
                </div>

                {mod.onboardingSteps.filter((s) => s.id === 'settings').length > 0 ? (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                    {mod.onboardingSteps.filter((s) => s.id === 'settings').map((step) => (
                      <div key={step.id} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{step.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-400 font-medium border-t border-slate-100 pt-3">
                      Pengaturan detail dapat dikonfigurasi lebih lanjut dari menu Settings modul setelah aktivasi.
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                    <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-medium">
                      Tidak ada pengaturan tambahan yang diperlukan untuk modul ini.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Klik "Lanjutkan" untuk menyelesaikan setup.</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleSkipSettings}
                    disabled={isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    <SkipForward className="w-4 h-4" /> Lewati
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    disabled={isPending || settingsSaved}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                  >
                    {isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                    ) : settingsSaved ? (
                      <><CheckCircle2 className="w-4 h-4" /> Tersimpan</>
                    ) : (
                      <><ArrowRight className="w-4 h-4" /> Simpan &amp; Lanjutkan</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: Done ── */}
            {currentStepIdx === doneStepIdx && (
              <div className="space-y-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30"
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>

                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Setup Selesai! 🎉</h2>
                  <p className="text-sm text-slate-500 mt-2">
                    Modul <strong>{mod.name}</strong> sudah aktif dan siap digunakan.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-left">
                  {[
                    { icon: '✅', label: 'CoA terpasang' },
                    { icon: '⚙️', label: 'Pengaturan selesai' },
                    { icon: '📊', label: 'Data siap digunakan' },
                    { icon: '🔑', label: 'Akses penuh aktif' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-xs font-bold text-emerald-700">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <a
                    href="/marketplace"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Kembali ke Marketplace
                  </a>
                  <button
                    onClick={handleComplete}
                    disabled={isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-600/25"
                  >
                    {isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Membuka...</>
                    ) : (
                      <><ArrowRight className="w-4 h-4" /> Buka Modul {mod.name}</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  )
}
