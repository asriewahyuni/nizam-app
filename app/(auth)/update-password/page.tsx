'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resetPasswordWithToken } from '@/modules/auth/actions/auth.actions'

function UpdatePasswordContent() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const supabase = createClient()

  // Ensure they only see this page if they have a session (handled by the magic link for Supabase)
  // Or if they provided a token parameter in URL (for Internal Auth)
  useEffect(() => {
    if (token) return // Internal Auth Flow - Has token

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setErrorMsg('Sesi tidak valid atau telah kedaluwarsa. Silakan ajukan Lupa Password kembali.')
      }
    })
  }, [supabase.auth, token])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirmChoice = formData.get('confirm_password') as string

    if (password !== confirmChoice) {
      setErrorMsg('Password dan konfirmasi password tidak cocok.')
      setLoading(false)
      return
    }

    try {
      if (token) {
        // Internal Auth custom flow
        const result = await resetPasswordWithToken(token, password)
        if (result.error) {
          setErrorMsg(result.error)
          setLoading(false)
          return
        }
      } else {
        // Legacy Supabase flow
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
          setErrorMsg(error.message)
          setLoading(false)
          return
        }
      }

      setSuccess(true)
      setErrorMsg('')
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    } catch {
      setErrorMsg('Gagal menghubungi server.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center space-y-5 py-4"
      >
        <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto">
          <CheckCircle2 size={32} />
        </div>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Password Diperbarui</h2>
          <p className="mt-2 text-sm text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
            Anda berhasil mengganti password. Mengarahkan ke dashboard dalam beberapa detik...
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-black text-white tracking-tight">Buat Password Baru</h2>
        <p className="text-slate-400 text-sm mt-1 font-medium">Amankan kembali akun Anda.</p>
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div role="alert" className="mb-6 px-4 py-3 rounded-xl text-sm font-medium leading-relaxed bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-start gap-2.5">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-rose-400" />
              {errorMsg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Password Baru
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all shadow-inner"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm_password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Konfirmasi Password
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all shadow-inner"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_14px_rgba(16,185,129,0.4)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Menyimpan...' : 'Simpan Password'}
        </button>
      </form>
    </div>
  )
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-sm font-medium text-slate-500 animate-pulse">Memuat...</div>}>
      <UpdatePasswordContent />
    </Suspense>
  )
}
