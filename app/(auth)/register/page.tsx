'use client'

import React, { Suspense, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signUp } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { User, Mail, Lock, ArrowRight, AlertCircle, CheckCircle2, Building, ShieldCheck } from 'lucide-react'

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
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '' })
  
  const plan = searchParams.get('plan')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    
    startTransition(async () => {
      const fd = new FormData()
      fd.append('fullName', formData.fullName)
      fd.append('email', formData.email)
      fd.append('password', formData.password)
      
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
              href={`/onboarding?${searchParams.toString()}`}
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
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200">
           <ShieldCheck className="text-white" size={32} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic italic">Daftar Akun NIZAM</h1>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">SaaS ENTERPRISE SOLUTION • FREE TRIAL</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap Pemilik</label>
          <div className="relative">
             <input
               required
               placeholder="Contoh: Budi Santoso"
               value={formData.fullName}
               onChange={e => setFormData({...formData, fullName: e.target.value})}
               className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all pr-12"
             />
             <User className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Koorporasi / Bisnis</label>
          <div className="relative">
             <input
               type="email"
               required
               placeholder="nama@perusahaan.com"
               value={formData.email}
               onChange={e => setFormData({...formData, email: e.target.value})}
               className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all pr-12 ${
                 error && error.includes('Email') ? 'border-rose-300 ring-4 ring-rose-50' : 'border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50'
               }`}
             />
             <Mail className={`absolute right-5 top-1/2 -translate-y-1/2 ${error && error.includes('Email') ? 'text-rose-400' : 'text-slate-300'}`} size={18} />
          </div>
          <p className="text-[10px] font-bold text-amber-600 mt-2 flex gap-1.5 items-start">
             <AlertCircle size={14} className="shrink-0" />
             Pastikan email ini aktif dan dapat diakses untuk keperluan Lupa Password dan pengiriman Tagihan Billing.
          </p>
        </div>

        <div className="space-y-2">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Create Password</label>
           <div className="relative">
              <input
                type="password"
                required
                minLength={8}
                placeholder="Minimal 8 Karakter"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all pr-12"
              />
              <Lock className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
           </div>
        </div>

        <AnimatePresence>
           {error && (
             <motion.div 
               initial={{ opacity: 0, y: -10 }} 
               animate={{ opacity: 1, y: 0 }} 
               className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-600 text-[11px] font-black uppercase tracking-tight italic"
             >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {error}
             </motion.div>
           )}
        </AnimatePresence>

        <button
          disabled={isPending}
          type="submit"
          className="w-full py-4 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50 active:scale-[0.98]"
        >
          {isPending ? 'Mendaftarkan Akun...' : 'Mulai Sekarang — Gratis'}
          <ArrowRight size={18} />
        </button>
        <input type="hidden" name="plan" value={plan || ''} />
      </form>

      <div className="mt-8 text-center space-y-4">
         <p className="text-xs text-slate-400 font-bold">
            Sudah ada akun bisnis?{' '}
            <Link href="/login" className="text-blue-600 font-black hover:underline uppercase tracking-wider">Login di sini</Link>
         </p>
         <div className="flex items-center justify-center gap-2 text-[9px] text-slate-300 font-black uppercase tracking-[0.2em]">
            <Building size={12} /> Powered by NIZAM ERP Global
         </div>
      </div>
    </div>
  )
}
