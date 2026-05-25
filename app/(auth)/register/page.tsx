'use client'

import React, { Suspense, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signUp } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react'

type SignUpResult = Awaited<ReturnType<typeof signUp>>

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageContent />
    </Suspense>
  )
}

function RegisterPageFallback() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200">
          <ShieldCheck className="text-white" size={32} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Daftar Akun NIZAM</h1>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">SaaS ENTERPRISE SOLUTION • FREE TRIAL</p>
      </div>
      <div className="rounded-3xl border border-slate-100 bg-slate-50 px-6 py-8 text-center text-sm font-bold text-slate-500">
        Memuat formulir pendaftaran...
      </div>
    </div>
  )
}

function RegisterPageContent() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '' })
  const source = (searchParams.get('source') || '').trim().toLowerCase()
  const requestedPlan = (searchParams.get('plan') || '').trim().toLowerCase()
  const isDemoFlow = source === 'demo'
  const plan = isDemoFlow ? 'demo' : (requestedPlan === 'abs' ? 'abs' : 'trial')
  const onboardingParams = new URLSearchParams(searchParams.toString())
  onboardingParams.set('plan', plan)
  if (isDemoFlow) onboardingParams.set('source', 'demo')
  else onboardingParams.delete('source')
  const onboardingHref = `/onboarding?${onboardingParams.toString()}`

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    
    startTransition(async () => {
      const fd = new FormData()
      fd.append('fullName', formData.fullName)
      fd.append('email', formData.email)
      fd.append('password', formData.password)
      fd.append('plan', plan)
      
      const res: SignUpResult = await signUp(fd)
      if ('error' in res && res.error) {
        if (res.error.includes('already registered')) {
           setError(`Email "${formData.email}" sudah terdaftar sebelumnya. Silakan gunakan email lain atau Login.`)
        } else {
           setError(res.error)
        }
      } else {
        setSuccess(formData.email)
      }
    })
  }

  if (success) {
     return (
        <motion.div 
           initial={{ opacity: 0, scale: 0.9 }} 
           animate={{ opacity: 1, scale: 1 }} 
           className="text-center space-y-8"
        >
           <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[32px] flex items-center justify-center mx-auto shadow-xl shadow-emerald-900/10">
              <CheckCircle2 size={40} />
           </div>
           <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">PENDAFTARAN BERHASIL!</h1>
              <p className="text-slate-500 text-sm mt-2 font-medium">Akun Anda dengan email <span className="text-slate-900 font-black underline">{success}</span> telah dibuat.</p>
           </div>
           
           <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-[11px] text-slate-500 font-bold leading-relaxed">
              Silakan cek email Anda untuk verifikasi atau klik tombol di bawah untuk masuk ke dashboard organisasi.
           </div>

           <Link 
              href={onboardingHref}
              className="w-full py-4 rounded-3xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-200"
           >
              Lanjutkan ke Onboarding
              <ArrowRight size={16} />
           </Link>
        </motion.div>
     )
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200">
           <ShieldCheck className="text-white" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Daftar Akun NIZAM</h1>
        <p className="text-slate-500 text-sm font-normal mt-1">Coba gratis, tanpa kartu kredit.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="reg-fullname" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
          <div className="relative">
             <input
               id="reg-fullname"
               required
               placeholder="Contoh: Budi Santoso"
               value={formData.fullName}
               onChange={e => setFormData({...formData, fullName: e.target.value})}
               className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all pr-12"
             />
             <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Bisnis</label>
          <div className="relative">
             <input
               id="reg-email"
               type="email"
               required
               placeholder="nama@bisnis.com"
               value={formData.email}
               onChange={e => setFormData({...formData, email: e.target.value})}
               className={`w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-sm text-slate-900 outline-none transition-all pr-12 ${
                 error && error.includes('Email') ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
               }`}
             />
             <Mail className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${error && error.includes('Email') ? 'text-rose-400' : 'text-slate-300'}`} size={16} />
          </div>
          <p className="text-xs text-amber-600 mt-1.5 flex gap-1.5 items-start leading-relaxed">
             <AlertCircle size={13} className="shrink-0 mt-0.5" />
             Gunakan email aktif. Dipakai untuk lupa sandi dan notifikasi tagihan.
          </p>
        </div>

        <div className="space-y-1.5">
           <label htmlFor="reg-password" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kata Sandi</label>
           <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="Minimal 8 karakter"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="w-full py-3.5 pl-11 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-0.5"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
           </div>
        </div>

        <AnimatePresence>
           {error && (
             <motion.div 
               initial={{ opacity: 0, y: -8 }} 
               animate={{ opacity: 1, y: 0 }} 
               className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-rose-600 text-sm font-medium"
             >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                {error}
             </motion.div>
           )}
        </AnimatePresence>

        <button
          disabled={isPending}
          type="submit"
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-200 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
        >
          {isPending ? 'Mendaftar...' : 'Daftar Gratis'}
          <ArrowRight size={16} />
        </button>
        <input type="hidden" name="plan" value={plan || ''} />
      </form>

      <div className="mt-6 text-center">
         <p className="text-sm text-slate-500">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-blue-600 font-semibold hover:underline">Masuk</Link>
         </p>
      </div>
    </div>
  )
}
