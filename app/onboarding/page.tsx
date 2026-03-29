'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ArrowRight, ShieldCheck, Sparkles, Globe, Wallet, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { createOrganization } from '@/modules/organization/actions/org.actions'
import { SafeButton } from '@/components/ui/NizamUI'

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan')
  const type = searchParams.get('type')
  const businessName = searchParams.get('businessName') || ''

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    try {
      const res = await createOrganization(formData)
      if (res && (res as any).error) {
        setError((res as any).error)
        setLoading(false)
      } else {
        // If no error, it likely redirected or success.
        // If it returns nothing (redirect internally), it will be handled by router.
        setSuccess(true)
      }
    } catch (err: any) {
      // Next.js redirect "error" shouldn't be caught here if possible, 
      // but if it is, it's the router's job.
      if (err.message === 'NEXT_REDIRECT') throw err
      setError("Terjadi kesalahan sistem. Silakan coba lagi.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-[#0a0c10]">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-indigo-600/10 blur-[80px] rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white/95 backdrop-blur-xl rounded-[40px] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.3)] p-10 md:p-12 border border-white relative overflow-hidden"
        >
          {/* Top Branding Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
          
          <div className="flex flex-col items-center text-center mb-10">
            <motion.div 
              whileHover={{ rotate: 10, scale: 1.1 }}
              className="w-16 h-16 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[24px] flex items-center justify-center shadow-xl mb-6 border border-white/20 relative"
            >
              <Building2 size={28} className="text-white" />
              <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                <Sparkles size={10} className="text-white fill-white" />
              </div>
            </motion.div>
            
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter mb-2 uppercase italic">
              NIZAM <span className="text-blue-600 not-italic tracking-normal">Setup</span>
            </h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Mempersiapkan Lingkungan ERP Anda</p>
          </div>

          {!success ? (
            <motion.form 
              layout
              onSubmit={handleSubmit} 
              className="space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label htmlFor="name" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Perusahaan</label>
                  <span className="text-[9px] text-blue-500 font-bold italic">Wajib</span>
                </div>
                
                <div className="relative group">
                  <input
                    id="name"
                    name="name"
                    required
                    autoFocus
                    defaultValue={businessName}
                    placeholder="Contoh: PT Nusantara Pangan"
                    className={`w-full px-6 py-4 bg-slate-50 border-2 rounded-[22px] text-base font-bold text-slate-900 outline-none transition-all shadow-inner placeholder:text-slate-300 ${error ? 'border-rose-500 bg-rose-50/20' : 'border-slate-100 focus:bg-white focus:border-blue-500'}`}
                  />
                  <div className={`absolute right-5 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-rose-500' : 'text-slate-300 group-focus-within:text-blue-500'}`}>
                    <Globe size={18} />
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-2 text-rose-600 text-[10px] font-black uppercase tracking-tight"
                    >
                      <AlertCircle size={14} className="shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 gap-3 mt-4">
                  <div className="p-4 bg-slate-50/50 rounded-[20px] border border-slate-100 flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
                      <Wallet size={16} />
                    </div>
                    <div>
                      <h4 className="text-[9px] font-black text-slate-900 uppercase leading-none">Auto COA PSAK</h4>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">Sistem akuntansi otomatis terkonfigurasi.</p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-[20px] border border-slate-100 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <h4 className="text-[9px] font-black text-slate-900 uppercase leading-none">Security Verified</h4>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">Isolasi data multi-tenant tingkat tinggi.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <SafeButton 
                  type="submit" 
                  size="lg" 
                  isLoading={loading}
                  className="w-full shadow-xl shadow-blue-500/10 py-5 text-sm" 
                  icon={<ArrowRight size={16} />}
                >
                  AKTIFKAN SEKARANG
                </SafeButton>
                
                <p className="text-[9px] text-slate-300 text-center font-bold px-4 leading-relaxed">
                   Dengan melanjutkan, Anda menyetujui Ketentuan Layanan NIZAM secara penuh.
                </p>
              </div>
              <input type="hidden" name="plan" value={plan || ''} />
              <input type="hidden" name="type" value={type || ''} />
            </motion.form>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-8"
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={36} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tighter uppercase italic">BERHASIL!</h2>
              <p className="text-slate-500 text-xs font-bold mb-8 max-w-[200px]">Infrastruktur database Anda sedang disiapkan...</p>
              <div className="w-full max-w-[180px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="h-full bg-blue-600 rounded-full"
                />
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Brand Link */}
        <div className="mt-8 flex items-center justify-center gap-2 opacity-30">
          <div className="text-[8px] font-black text-white uppercase tracking-[0.4em]">NIZAM CORESYSTEM</div>
        </div>
      </div>
    </div>
  )
}
