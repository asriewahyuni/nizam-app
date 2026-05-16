'use client'

import React, { useState, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn, signInWithNik, requestPasswordReset } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'
import { Building2, IdCard, ArrowRight, Eye, EyeOff, ShieldCheck, X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'karyawan' ? 'karyawan' : 'bisnis'
  const error = searchParams.get('error')

  const [tab, setTab] = useState<'bisnis' | 'karyawan'>(initialTab)
  const [showPass, setShowPass] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetNik, setResetNik] = useState('')

  const submitResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetNik.trim()) return
    setIsResetModalOpen(false)
    setResetLoading(true)
    const res = await requestPasswordReset(resetNik)
    setResetLoading(false)
    if (res.success) {
      setResetMsg({ type: 'success', text: 'Permintaan reset terkirim. Hubungi Admin HRD untuk mendapatkan sandi baru.' })
    } else {
      setResetMsg({ type: 'error', text: res.error || 'Gagal mengirim permintaan.' })
    }
    setResetNik('')
    setTimeout(() => setResetMsg(null), 10000)
  }

  const inputClass = (accent: 'blue' | 'emerald') =>
    `w-full px-4 py-3.5 rounded-2xl border border-white/8 text-sm font-medium text-white bg-white/5 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-${accent}-500/30 focus:border-${accent}-500/40 transition-all`

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white tracking-tight">Masuk ke Akun</h2>
        <p className="text-slate-500 text-sm mt-1">Pilih mode akses sesuai peran Anda.</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex p-1 bg-white/5 border border-white/8 rounded-2xl mb-7 gap-1">
        {(['bisnis', 'karyawan'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
              tab === t
                ? t === 'bisnis'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'bisnis' ? <Building2 size={13} /> : <IdCard size={13} />}
            {t === 'bisnis' ? 'Admin Bisnis' : 'Karyawan'}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl text-xs font-medium leading-relaxed bg-rose-500/10 text-rose-400 border border-rose-500/20">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Reset Message */}
      {resetMsg && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-xs font-medium leading-relaxed border ${
          resetMsg.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {resetMsg.text}
        </div>
      )}

      <AnimatePresence initial={false} mode="wait">
        {tab === 'bisnis' ? (
          <motion.div
            key="bisnis"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <form action={signIn} className="space-y-4">
              <input type="hidden" name="redirectTo" value={searchParams.get('redirectTo') || ''} />

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Email</label>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus={tab === 'bisnis'}
                  placeholder="nama@perusahaan.com"
                  className={inputClass('blue')}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Password</label>
                  <Link href="/forgot-password" className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                    Lupa password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className={`${inputClass('blue')} pr-11`}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-1 py-3.5 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2.5 hover:opacity-90 active:scale-[0.98] transition-all bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/30"
              >
                Masuk
                <ArrowRight size={15} />
              </button>
            </form>

            <div className="mt-7 pt-6 border-t border-white/5 space-y-3 text-center">
              <p className="text-sm text-slate-500">
                Belum punya akun?{' '}
                <Link href="/register" className="text-white font-semibold hover:text-blue-400 transition-colors">
                  Daftar gratis
                </Link>
              </p>
              <Link
                href="/demo"
                className="inline-flex w-full justify-center items-center gap-2 px-5 py-3 bg-white/5 text-slate-400 text-xs font-medium rounded-xl hover:bg-white/10 hover:text-white transition-all border border-white/8"
              >
                Coba Demo Dulu
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="karyawan"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <form action={signInWithNik} className="space-y-4">
              <input type="hidden" name="redirectTo" value={searchParams.get('redirectTo') || ''} />

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Nomor Induk Karyawan</label>
                <input
                  name="nik"
                  type="text"
                  required
                  autoFocus={tab === 'karyawan'}
                  placeholder="Contoh: NIZ-001"
                  className={`${inputClass('emerald')} uppercase`}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Password</label>
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    disabled={resetLoading}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {resetLoading ? 'Memproses...' : 'Lupa password?'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    className={`${inputClass('emerald')} pr-11`}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-1 py-3.5 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2.5 hover:opacity-90 active:scale-[0.98] transition-all bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/30"
              >
                Masuk
                <ArrowRight size={15} />
              </button>
            </form>

            <p className="mt-7 pt-6 border-t border-white/5 text-center text-sm text-slate-500">
              Login sebagai pemilik bisnis?{' '}
              <button type="button" onClick={() => setTab('bisnis')} className="text-white font-semibold hover:text-emerald-400 transition-colors">
                Ganti mode
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setIsResetModalOpen(false)}
            />
            <motion.div
              key="modal"
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={15} />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Reset Password</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Masukkan NIK Anda untuk melanjutkan</p>
                </div>
              </div>

              <form onSubmit={submitResetRequest} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Nomor Induk Karyawan</label>
                  <input
                    required
                    autoFocus
                    value={resetNik}
                    onChange={(e) => setResetNik(e.target.value)}
                    placeholder="Contoh: NIZ-0042"
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm font-medium uppercase text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40 transition-all placeholder:normal-case placeholder:font-normal placeholder:text-slate-600"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="flex-1 py-3 text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all active:scale-95"
                  >
                    Kirim Permintaan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8 text-xs text-slate-600 animate-pulse">
        Memuat...
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
