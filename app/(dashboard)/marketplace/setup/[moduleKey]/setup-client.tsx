'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, ArrowRight, Home, BookOpen, Sparkles } from 'lucide-react'

type Step = { id: string; title: string; description: string }
type ModInfo = {
  key: string; name: string; tagline?: string; description?: string
  icon?: string; color?: string; href: string; isCore: boolean
  category: string; coaInjectionFn?: string
  onboardingStepsJson: string
  tags?: string[]; requires?: string[]
}

export function SetupClient({
  mod,
  coaInstalled = false,
  currentSettings = {},
  completeOnboarding,
}: {
  mod: ModInfo
  coaInstalled?: boolean
  currentSettings?: Record<string, any>
  completeOnboarding?: (key: string) => Promise<any>
}) {
  const steps: Step[] = JSON.parse(mod.onboardingStepsJson || '[]')
  const [currentStep, setCurrentStep] = useState(coaInstalled ? 1 : 0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const coaStepIdx = steps.findIndex(s => s.id === 'coa')
  const hasCoaStep = coaStepIdx >= 0

  const handleFinish = async () => {
    if (!completeOnboarding) {
      setDone(true)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await completeOnboarding(mod.key)
      setDone(true)
    } catch (e: any) {
      setError(e?.message || 'Gagal menyelesaikan setup')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6 flex justify-center">
            <Sparkles className="w-16 h-16 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Setup Selesai! 🎉</h1>
          <p className="text-white/50 mb-8">{mod.name} siap digunakan.</p>
          <a
            href={mod.href}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all"
          >
            <Home className="w-4 h-4" />
            Buka {mod.name}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07080a] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">{mod.icon || '🚀'}</div>
          <h1 className="text-2xl font-semibold text-white mb-2">Setup {mod.name}</h1>
          {mod.tagline && (
            <p className="text-white/50 text-sm">{mod.tagline}</p>
          )}
        </div>

        {/* Steps */}
        {steps.length > 0 ? (
          <div className="space-y-4 mb-8">
            {steps.map((step, idx) => {
              const isActive = idx === currentStep
              const isPast = idx < currentStep
              return (
                <div
                  key={step.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isActive
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : isPast
                      ? 'border-white/10 bg-white/5'
                      : 'border-white/5 bg-white/3'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isPast
                        ? 'bg-emerald-500 text-white'
                        : isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-white/10 text-white/40'
                    }`}>
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-base font-semibold ${
                        isActive ? 'text-white' : isPast ? 'text-white/60' : 'text-white/30'
                      }`}>
                        {step.title}
                      </h3>
                      <p className={`text-sm mt-1 ${
                        isActive ? 'text-white/60' : 'text-white/30'
                      }`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center mb-8">
            <p className="text-white/50">Tidak ada langkah setup yang diperlukan.</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-3">
          {currentStep < steps.length - 1 && (
            <button
              onClick={() => {
                if (hasCoaStep && currentStep === coaStepIdx) {
                  setLoading(true)
                  setTimeout(() => { setLoading(false); setCurrentStep(c => c + 1) }, 500)
                  return
                }
                setCurrentStep(c => Math.min(c + 1, steps.length - 1))
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Lanjutkan
            </button>
          )}

          {currentStep === steps.length - 1 && (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Selesai & Buka Modul
            </button>
          )}

          <a
            href="/marketplace"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-white/20 text-white/50 hover:text-white/80 hover:border-white/40 transition-all text-sm"
          >
            Kembali
          </a>
        </div>
      </div>
    </div>
  )
}
