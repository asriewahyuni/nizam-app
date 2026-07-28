'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Mail, CheckCircle2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { sendPasswordResetEmail } from '@/modules/auth/actions/auth.actions'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    try {
      const res = await sendPasswordResetEmail(formData)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccess(true)
      }
    } catch {
      setErrorMsg('Gagal menghubungi server. Silakan coba sesaat lagi.')
    } finally {
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
          <h2 className="text-xl font-black text-white tracking-tight">Email Terkirim</h2>
          <p className="mt-2 text-sm text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
            Periksa kotak masuk (atau folder spam) email Anda untuk tautan reset password.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center gap-2 mt-2 py-3.5 rounded-xl text-sm font-semibold text-slate-300 bg-slate-800/50 hover:bg-slate-800 hover:text-white border border-white/5 transition-all cursor-pointer"
        >
          Kembali ke Login
        </Link>
      </motion.div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-black text-white tracking-tight">Lupa Password</h2>
        <p className="text-slate-400 text-sm mt-1 font-medium">
          Masukkan email terdaftar Anda, kami kirimkan tautan reset password.
        </p>
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
          <label htmlFor="email" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Alamat Email Terdaftar
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="email@perusahaan.com"
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_4px_14px_rgba(37,99,235,0.4)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-white/5 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 font-medium hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> Kembali ke halaman Login
        </Link>
      </div>
    </div>
  )
}
