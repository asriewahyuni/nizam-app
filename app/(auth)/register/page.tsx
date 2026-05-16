'use client'

import React, { Suspense, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signUp } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'

type SignUpResult = Awaited<ReturnType<typeof signUp>>

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8 text-xs text-slate-400 animate-pulse">
        Memuat...
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
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
          setError(`Email "${formData.email}" sudah terdaftar. Silakan gunakan email lain atau masuk.`)
        } else {
          setError(res.error)
        }
      } else {
        setSuccess(formData.email)
      }
    })
  }

  const inputClass = 'w-full px-4 py-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all'

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="text-center space-y-7"
      >
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Akun berhasil dibuat!</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Email <span className="text-slate-800 font-semibold">{success}</span> berhasil didaftarkan.
          </p>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-400 leading-relaxed">
          Cek email Anda untuk verifikasi, atau langsung lanjutkan ke setup organisasi.
        </div>
        <Link
          href={onboardingHref}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-all shadow-md shadow-blue-100"
        >
          Lanjutkan Setup
          <ArrowRight size={15} />
        </Link>
      </motion.div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-7">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {plan === 'abs' ? 'Daftar ABS Trial' : plan === 'demo' ? 'Coba Demo' : 'Buat Akun Bisnis'}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {plan === 'abs'
            ? 'Trial 30 hari gratis khusus peserta ABS.'
            : plan === 'demo'
            ? 'Akses lingkungan demo selama 12 jam.'
            : 'Mulai trial gratis, tanpa kartu kredit.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Nama Lengkap</label>
          <div className="relative">
            <input
              required
              placeholder="Contoh: Budi Santoso"
              value={formData.fullName}
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
              className={`${inputClass} pr-11`}
            />
            <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Email</label>
          <div className="relative">
            <input
              type="email"
              required
              placeholder="nama@perusahaan.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className={`${inputClass} pr-11 ${error && error.includes('Email') ? 'border-rose-300 ring-2 ring-rose-100 bg-rose-50' : ''}`}
            />
            <Mail className={`absolute right-4 top-1/2 -translate-y-1/2 ${error && error.includes('Email') ? 'text-rose-400' : 'text-slate-300'}`} size={15} />
          </div>
          <p className="text-[10px] text-slate-400 flex gap-1.5 items-start pt-0.5">
            <AlertCircle size={11} className="shrink-0 mt-0.5 text-amber-400" />
            Pastikan email ini aktif untuk reset password dan notifikasi billing.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              placeholder="Minimal 8 karakter"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className={`${inputClass} pl-11 pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-xs text-rose-600"
            >
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          disabled={isPending}
          type="submit"
          className="w-full py-3.5 mt-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-all shadow-md shadow-blue-100 disabled:opacity-50 active:scale-[0.98]"
        >
          {isPending ? 'Mendaftarkan...' : 'Buat Akun — Gratis'}
          <ArrowRight size={15} />
        </button>

        <input type="hidden" name="plan" value={plan || ''} />
      </form>

      <div className="mt-7 pt-6 border-t border-slate-100 text-center">
        <p className="text-sm text-slate-500">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  )
}
