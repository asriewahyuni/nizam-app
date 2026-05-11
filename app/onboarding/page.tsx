'use client'

import React, { Suspense, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ArrowRight, ShieldCheck, Sparkles, Globe, Wallet, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createOrganization } from '@/modules/organization/actions/org.actions'
import { SafeButton } from '@/components/ui/NizamUI'

// Prevent CDN/incremental cache — this page is fully dynamic
export const dynamic = 'force-dynamic'

type CreateOrganizationResult = Awaited<ReturnType<typeof createOrganization>>

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingContent />
    </Suspense>
  )
}

function OnboardingFallback() {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-[#07080a]">
      <div className="w-full max-w-sm relative z-10 rounded-3xl border border-white/[0.04] bg-white/[0.96] px-10 py-14 text-center shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0a0c10] text-white">
          <Building2 size={24} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-[#0a0c10]">NIZAM</h1>
        <p className="mt-1 text-xs text-[#6b7280]">Mempersiapkan lingkungan Anda</p>
        <div className="mt-8 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-6 py-8 text-sm text-[#6b7280]">
          Memuat...
        </div>
      </div>
    </div>
  )
}

function OnboardingContent() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const plan = searchParams.get('plan')
  const type = searchParams.get('type')
  const businessName = searchParams.get('businessName') || ''
  const isDemoSetup = (plan || '').trim().toLowerCase() === 'demo'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    try {
      const res: CreateOrganizationResult = await createOrganization(formData)
      if (res && typeof res === 'object' && 'error' in res && typeof res.error === 'string') {
        setError(res.error)
        setLoading(false)
      } else {
        setSuccess(true)
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
      setError('Terjadi kesalahan sistem. Silakan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-[#07080a] selection:bg-blue-200/30">
      {/* Deep background atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] right-[-20%] w-[50%] h-[55%] bg-gradient-to-br from-blue-500/[0.08] via-transparent to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-[-15%] left-[-20%] w-[45%] h-[45%] bg-gradient-to-tr from-indigo-500/[0.06] via-transparent to-transparent rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAwaDQwdjQwSDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMjBoNDBNMjAgMHY0MCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4wMTUiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')] opacity-40" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative"
        >
          {/* Card — refined glass */}
          <div className="bg-white/[0.97] rounded-3xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] p-9 md:p-10">
            {/* Subtle top accent */}
            <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-blue-600/20 via-blue-600/60 to-blue-600/20 rounded-full" />

            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[#0a0c10] flex items-center justify-center shadow-sm mb-5">
                <Building2 size={22} className="text-white" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-[#0a0c10]">
                NIZAM <span className="text-blue-600">Setup</span>
              </h1>
              <p className="mt-1 text-xs text-[#6b7280]">Siapkan perusahaan Anda</p>
            </div>

            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Nama Perusahaan */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="name" className="text-xs font-medium text-[#374151]">Nama perusahaan</label>
                    <span className="text-[10px] text-[#9ca3af]">wajib</span>
                  </div>
                  <div className="relative">
                    <input
                      id="name"
                      name="name"
                      required
                      autoFocus
                      defaultValue={businessName}
                      placeholder="cth: PT Nusantara Pangan"
                      className={`w-full h-11 px-4 bg-white border rounded-xl text-sm text-[#0a0c10] placeholder:text-[#9ca3af] outline-none transition-all duration-200
                        ${error
                          ? 'border-[#f87171] ring-1 ring-[#f87171]/20'
                          : 'border-[#e5e7eb] hover:border-[#d1d5db] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
                        }`}
                    />
                    <Globe size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex items-center gap-2 px-3 py-2.5 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs font-medium text-[#dc2626]"
                    >
                      <AlertCircle size={14} className="shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Feature highlights */}
                <div className="grid gap-2.5 pt-1">
                  <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[#f3f4f6] bg-[#fafbfc]">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <Wallet size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#0a0c10]">
                        {isDemoSetup ? 'CoA & Demo Budget' : 'Aktivasi CoA PSAK'}
                      </div>
                      <div className="text-[11px] text-[#6b7280] mt-px">
                        {isDemoSetup
                          ? 'Untuk akun demo, CoA dan contoh budgeting disiapkan otomatis.'
                          : 'Aktifkan dari menu CoA setelah organisasi dibuat.'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[#f3f4f6] bg-[#fafbfc]">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      <ShieldCheck size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#0a0c10]">Security Verified</div>
                      <div className="text-[11px] text-[#6b7280] mt-px">Isolasi data multi-tenant tingkat tinggi.</div>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-2 space-y-3">
                  <SafeButton
                    type="submit"
                    size="lg"
                    isLoading={loading}
                    className="w-full h-11 rounded-xl text-sm font-medium"
                  >
                    Aktifkan Sekarang
                  </SafeButton>
                  <p className="text-[10px] text-[#9ca3af] text-center leading-relaxed px-2">
                    Dengan melanjutkan, Anda menyetujui Ketentuan Layanan NIZAM.
                  </p>
                </div>

                <input type="hidden" name="plan" value={plan || ''} />
                <input type="hidden" name="type" value={type || ''} />
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center text-center py-6"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
                  <CheckCircle2 size={28} className="text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold text-[#0a0c10]">Bersiap...</h2>
                <p className="text-xs text-[#6b7280] mt-1 mb-6">Menyiapkan infrastruktur database Anda.</p>
                <div className="w-full max-w-[140px] h-1 bg-[#e5e7eb] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="h-full bg-blue-600 rounded-full"
                  />
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        <div className="mt-8 text-center">
          <span className="text-[9px] tracking-[0.3em] text-white/20 font-medium">NIZAM CORESYSTEM</span>
        </div>
      </div>
    </div>
  )
}
