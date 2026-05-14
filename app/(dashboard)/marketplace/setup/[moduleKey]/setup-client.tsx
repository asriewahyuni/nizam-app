'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, CheckCircle2, AlertCircle, Sparkles, Settings, BookOpen, CheckCircle, Zap, SkipForward } from 'lucide-react'
import { installModuleCoa, saveModuleSettings, completeModuleOnboarding } from '@/modules/marketplace/actions/marketplace.actions'
import type { ModuleDefinition } from '@/modules/marketplace/lib/module-registry'

type StepStatus = 'pending' | 'active' | 'done' | 'error'

type StepDef = {
  id: string
  title: string
  description: string
  required: boolean
}

function buildSteps(mod: ModuleDefinition): StepDef[] {
  const steps: StepDef[] = []
  const hasCoaStep = mod.onboardingSteps.some((s) => s.id === 'coa')

  if (hasCoaStep || mod.coaInjectionFn) {
    steps.push({
      id: 'coa',
      title: 'Instal Chart of Accounts',
      description: `Pasang akun akuntansi spesifik untuk modul ${mod.name}`,
      required: !!mod.coaInjectionFn,
    })
  }

  steps.push({
    id: 'settings',
    title: 'Pengaturan Awal',
    description: 'Konfigurasi dasar modul',
    required: false,
  })

  steps.push({
    id: 'done',
    title: 'Modul Aktif',
    description: 'Semua siap — modul sudah bisa digunakan',
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

  const getInitialStep = () => coaInstalled ? 1 : 0

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
        setToast({ message: 'Pengaturan berhasil disimpan! ✅', type: 'success' })
        setTimeout(() => goToStep(2, 1, true), 300)
      } catch (err: any) {
        setToast({ message: err.message || 'Gagal menyimpan pengaturan', type: 'error' })
      }
    })
  }

  function handleSkipSettings() {
    setSettingsSaved(true)
    setTimeout(() => goToStep(2, 1, true), 200)
    setToast({ message: 'Langsung ke tahap akhir', type: 'success' })
  }

  function handleComplete() {
    startTransition(async () => {
      try {
        await completeModuleOnboarding(mod.key)
        setStepStatuses((prev) => { const n = [...prev] as StepStatus[]; n[steps.length - 1] = 'done'; return n })
        router.push(mod.href)
      } catch (err: any) {
        setToast({ message: err.message || 'Gagal menyelesaikan setup', type: 'error' })
      }
    })
  }

  const coaStepIdx = steps.findIndex((s) => s.id === 'coa')
  const settingsStepIdx = steps.findIndex((s) => s.id === 'settings')
  const doneStepIdx = steps.findIndex((s) => s.id === 'done')

  if (!mod) {
    return <div className="p-8 text-center text-red-500">Modul tidak ditemukan</div>
  }

  return (
    <div className="min-h-screen bg-[#07080a] py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center">
          <div className={`w-20 h-20 rounded-3xl ${mod.color} flex items-center justify-center text-4xl mx-auto shadow-2xl`}>
            {mod.icon}
          </div>
          <h1 className="text-2xl font-semibold text-white mt-4">Setup {mod.name}</h1>
          <p className="text-sm text-white/50 mt-1 max-w-sm mx-auto">{mod.description}</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`px-5 py-3 rounded-2xl flex items-center gap-3 shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-900/50 border border-emerald-700 text-emerald-300'
              : 'bg-rose-900/50 border border-rose-700 text-rose-300'
          }`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="text-sm font-bold">{toast.message}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white/5 rounded-3xl border border-white/10 p-8">

          {/* ── Step: CoA ── */}
          {currentStepIdx === coaStepIdx && coaStepIdx >= 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Instal Chart of Accounts</h2>
                  <p className="text-sm text-white/50">
                    {mod.onboardingSteps.find((s) => s.id === 'coa')?.description ?? `Siapkan akun akuntansi untuk ${mod.name}`}
                  </p>
                </div>
              </div>

              <div className="bg-blue-900/20 rounded-2xl p-4 border border-blue-800/30">
                <p className="text-xs font-semibold text-blue-300">Yang akan dipasang:</p>
                {mod.onboardingSteps.find((s) => s.id === 'coa') ? (
                  <p className="text-xs text-blue-400 mt-1">
                    {mod.onboardingSteps.find((s) => s.id === 'coa')!.description}
                  </p>
                ) : (
                  <p className="text-xs text-blue-400 mt-1">
                    Akun-akun khusus yang dibutuhkan modul {mod.name} akan ditambahkan ke CoA organisasi.
                  </p>
                )}
              </div>

              {coaInstalled ? (
                <div className="flex items-center gap-3 bg-emerald-900/30 rounded-2xl p-4 border border-emerald-800/40">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="text-sm font-bold text-emerald-300">Chart of Accounts sudah terpasang sebelumnya.</p>
                </div>
              ) : (
                <button
                  onClick={handleInstallCoa}
                  disabled={isPending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Pengaturan Awal</h2>
                  <p className="text-sm text-white/50">Konfigurasi dasar untuk modul {mod.name}</p>
                </div>
              </div>

              {mod.onboardingSteps.filter((s) => s.id === 'settings').length > 0 ? (
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-4">
                  {mod.onboardingSteps.filter((s) => s.id === 'settings').map((step) => (
                    <div key={step.id} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{step.title}</p>
                        <p className="text-xs text-white/50 mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-white/40 font-medium border-t border-white/10 pt-3">
                    Pengaturan detail dapat dikonfigurasi lebih lanjut dari menu Settings modul setelah aktivasi.
                  </p>
                </div>
              ) : (
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
                  <Sparkles className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-sm text-white/50 font-medium">Tidak ada pengaturan tambahan yang diperlukan.</p>
                  <p className="text-xs text-white/30 mt-1">Klik "Lanjutkan" untuk menyelesaikan setup.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSkipSettings}
                  disabled={isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-sm font-bold text-white/60 hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  <SkipForward className="w-4 h-4" /> Lewati
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={isPending || settingsSaved}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><CheckCircle2 className="w-4 h-4" /> Simpan & Lanjut</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Done ── */}
          {currentStepIdx === doneStepIdx && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-10 h-10 text-white" />
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-white">Setup Selesai! 🎉</h2>
                <p className="text-sm text-white/50 mt-2">
                  Modul <span className="font-bold text-white">{mod.name}</span> sudah aktif dan siap digunakan.
                </p>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <p className="text-xs text-white/40">
                  Kamu bisa langsung masuk ke modul atau mengatur lebih detail dari halaman Settings.
                </p>
              </div>

              <button
                onClick={handleComplete}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyelesaikan...</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> Selesai, Buka Modul</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
