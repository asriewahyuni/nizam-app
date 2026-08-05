'use client'

import React, { useState, Suspense, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { registerLmsMember } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'
import { ArrowRight, Eye, EyeOff, ShieldCheck, Users, User, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import type { OrgContext } from '../login/LoginFormClient'

interface RegisterMemberProps {
  tenantContext: OrgContext
}

function RegisterMemberInner({ tenantContext }: RegisterMemberProps) {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || searchParams.get('callbackUrl') || '/dashboard'
  
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)
  
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    
    startTransition(async () => {
      const fd = new FormData()
      fd.append('fullName', formData.fullName)
      fd.append('email', formData.email)
      fd.append('password', formData.password)
      fd.append('orgId', tenantContext.id)
      fd.append('orgSlug', tenantContext.slug)
      fd.append('redirectTo', redirectTo)
      
      const res = await registerLmsMember(fd)
      if (res && 'error' in res && res.error) {
        if (res.error.toLowerCase().includes('sudah terdaftar') || res.error.toLowerCase().includes('duplicate key')) {
           setError(`Email "${formData.email}" sudah terdaftar sebelumnya. Silakan Login.`)
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
           initial={{ opacity: 0, scale: 0.95 }} 
           animate={{ opacity: 1, scale: 1 }} 
           className="text-center space-y-8"
        >
           <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-900/10">
              <CheckCircle2 size={32} />
           </div>
           <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">Pendaftaran Berhasil!</h1>
              <p className="text-slate-400 text-sm mt-2 font-medium">Akun Anda dengan email <span className="text-white font-bold">{success}</span> telah dibuat.</p>
           </div>
           
           <div className="p-5 bg-slate-900/50 border border-white/10 rounded-2xl text-xs text-slate-400 font-medium leading-relaxed">
              Anda kini bisa mengakses semua materi di {tenantContext.name}. Cek email Anda untuk info lebih lanjut.
           </div>

           <Link 
              href={redirectTo}
              className="w-full py-4 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_4px_14px_rgba(37,99,235,0.4)]"
           >
              Lanjutkan ke Dashboard
              <ArrowRight size={16} />
           </Link>
        </motion.div>
     )
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-indigo-400/25 bg-indigo-400/10 px-4 py-3">
        {tenantContext.logo_url ? (
          <img
            src={tenantContext.logo_url}
            alt=""
            className="size-10 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-400/15">
            <Users aria-hidden="true" size={18} className="text-indigo-300" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
            Pendaftaran Member
          </p>
          <p className="truncate text-sm font-bold text-white">{tenantContext.name}</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-black text-white tracking-tight">
          Buat Akun Baru
        </h2>
        <p className="text-slate-400 text-sm mt-1 font-medium">
          Daftar untuk mengakses kelas dan materi belajar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="reg-fullname" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nama Lengkap</label>
          <div className="relative">
             <input
               id="reg-fullname"
               required
               placeholder="Contoh: Budi Santoso"
               value={formData.fullName}
               onChange={e => setFormData({...formData, fullName: e.target.value})}
               className="w-full px-4 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner pl-11"
             />
             <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</label>
          <div className="relative">
             <input
               id="reg-email"
               type="email"
               required
               placeholder="nama@email.com"
               value={formData.email}
               onChange={e => setFormData({...formData, email: e.target.value})}
               className={`w-full px-4 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none transition-all shadow-inner pl-11 ${
                 error && error.includes('Email') ? 'focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 border-rose-500/50' : 'focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50'
               }`}
             />
             <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${error && error.includes('Email') ? 'text-rose-400' : 'text-slate-500'}`} size={16} />
          </div>
        </div>

        <div className="space-y-1.5">
           <label htmlFor="reg-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kata Sandi</label>
           <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
              <input
                id="reg-password"
                type={showPass ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="Minimal 8 karakter"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-3.5 pl-11 pr-12 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPass((previous) => !previous)}
                aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer p-0.5"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
           </div>
        </div>

        <AnimatePresence>
           {error && (
             <motion.div 
               initial={{ opacity: 0, y: -8 }} 
               animate={{ opacity: 1, y: 0 }} 
               className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-rose-400 text-sm font-medium"
             >
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                {error}
             </motion.div>
           )}
        </AnimatePresence>

        <button
          disabled={isPending}
          type="submit"
          className="w-full mt-2 py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_4px_14px_rgba(37,99,235,0.4)] disabled:opacity-50 cursor-pointer"
        >
          {isPending ? 'Memproses...' : 'Daftar Sekarang'}
          <ArrowRight size={16} />
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-white/5 text-center">
         <p className="text-sm text-slate-500 font-medium">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-white font-semibold hover:text-blue-400 transition-colors">
               Masuk di sini
            </Link>
         </p>
      </div>
    </div>
  )
}

export default function RegisterMemberClient({ tenantContext }: RegisterMemberProps) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8 text-xs font-black uppercase text-slate-500 tracking-widest animate-pulse">Inisialisasi Form...</div>}>
      <RegisterMemberInner tenantContext={tenantContext} />
    </Suspense>
  )
}
