'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, ArrowRight, Home, Sparkles, AlertCircle } from 'lucide-react'
import { getSetupModData, completeSetupOnboarding } from './setup.actions'

type Step = { id: string; title: string; description: string }
type ModData = {
  key: string; name: string; tagline?: string; description?: string
  icon?: string; color?: string; href: string; isCore: boolean
  category: string; coaInjectionFn?: string
  onboardingSteps: Step[]
  tags?: string[]; requires?: string[]
}

export function SetupClient({
  moduleKey,
  orgId,
}: {
  moduleKey: string
  orgId: string
}) {
  const router = useRouter()
  const [mod, setMod] = useState<ModData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Fetch module data on mount
  useEffect(() => {
    getSetupModData(moduleKey)
      .then(data => {
        setMod(data as ModData)
        setLoading(false)
      })
      .catch(err => {
        setError(err?.message || 'Gagal memuat data modul')
        setLoading(false)
      })
  }, [moduleKey])

  const handleFinish = async () => {
    if (!mod) return
    setBusy(true)
    setError(null)
    try {
      const result = await completeSetupOnboarding(mod.key)
      setDone(true)
    } catch (e: any) {
      setError(e?.message || 'Gagal menyelesaikan setup')
    } finally {
      setBusy(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-white/50">Memuat data modul...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !mod) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Gagal Memuat Halaman</h1>
          <p className="text-white/50 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => window.location.reload()} className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all">
              Coba Lagi
            </button>
            <a href="/marketplace" className="px-6 py-3 rounded-2xl border border-white/20 text-white/50 hover:text-white/80 transition-all">
              Kembali
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!mod) return null

  const steps = mod.onboardingSteps || []
  const isLastStep = currentStep >= steps.length - 1

  // Done state
  if (done) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <Sparkles className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
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
          {mod.tagline && <p className="text-white/50 text-sm">{mod.tagline}</p>}
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
                    <div className="flex-1 text-left">
                      <h3 className={`text-base font-semibold ${isActive ? 'text-white' : isPast ? 'text-white/60' : 'text-white/30'}`}>
                        {step.title}
                      </h3>
                      <p className={`text-sm mt-1 ${isActive ? 'text-white/60' : 'text-white/30'}`}>
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
            <p className="text-white/50">Tidak ada langkah setup khusus.</p>
          </div>
        )}

        {/* Error toast */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-3">
          {!isLastStep && steps.length > 0 && (
            <button
              onClick={() => setCurrentStep(c => Math.min(c + 1, steps.length - 1))}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all"
            >
              <ArrowRight className="w-4 h-4" />
              Lanjutkan
            </button>
          )}

          {isLastStep && steps.length > 0 && (
            <button
              onClick={handleFinish}
              disabled={busy}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Selesai & Buka Modul
            </button>
          )}

          {steps.length === 0 && (
            <button
              onClick={handleFinish}
              disabled={busy}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Home className="w-4 h-4" />}
              Buka Modul
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
