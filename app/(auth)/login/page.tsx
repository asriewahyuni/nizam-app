'use client'

import React, { useState, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn, signInWithNik, requestPasswordReset } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'
import { Building2, IdCard, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
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
      setResetMsg({ type: 'success', text: `Permintaan reset terkirim. Silakan hubungi Admin HRD untuk mendapatkan sandi baru.` })
    } else {
      setResetMsg({ type: 'error', text: res.error || 'Gagal mengirim permintaan.' })
    }
    
    setResetNik('')
    setTimeout(() => setResetMsg(null), 10000)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Selamat datang</h1>
        <p className="text-gray-400 text-sm mt-1 font-medium">Pilih tipe akun untuk masuk</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl mb-8">
        <button
          onClick={() => setTab('bisnis')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            tab === 'bisnis'
              ? 'bg-white text-blue-600 shadow-md'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Building2 size={14} />
          Pemilik / Admin Bisnis
        </button>
        <button
          onClick={() => setTab('karyawan')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            tab === 'karyawan'
              ? 'bg-white text-emerald-600 shadow-md'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <IdCard size={14} />
          Login Karyawan
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl text-sm font-bold bg-rose-50 text-rose-600 border border-rose-100">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Reset Message */}
      {resetMsg && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-xs font-bold ${resetMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
          {resetMsg.text}
        </div>
      )}

      <AnimatePresence initial={false} mode="wait">
        {tab === 'bisnis' ? (
          <motion.div
            key="bisnis"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── BUSINESS OWNER LOGIN ── */}
            <form action={signIn} className="space-y-5">
              <input type="hidden" name="redirectTo" value={searchParams.get('redirectTo') || ''} />

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Bisnis</label>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus={tab === 'bisnis'}
                  placeholder="nama@perusahaan.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 bg-slate-50 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                  <Link href="/forgot-password" className="text-[10px] text-blue-600 font-bold hover:text-blue-700 uppercase tracking-wider">
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
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl text-sm font-black text-white tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all shadow-lg shadow-blue-200"
                style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563eb)' }}
              >
                Masuk ke Dashboard
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 space-y-4 text-center">
              <p className="text-sm text-gray-400">
                Belum punya akun bisnis?{' '}
                <Link href="/register" className="text-blue-600 font-bold hover:text-blue-700">
                  Daftar gratis
                </Link>
              </p>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black rounded-xl hover:opacity-90 transition-all shadow-md shadow-amber-200/50 uppercase tracking-wider"
              >
                🎮 Coba Demo Tanpa Daftar
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="karyawan"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── EMPLOYEE LOGIN ── */}
            <form action={signInWithNik} className="space-y-5">
              <input type="hidden" name="redirectTo" value={searchParams.get('redirectTo') || ''} />

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Induk Karyawan (NIK)</label>
                <input
                  name="nik"
                  type="text"
                  required
                  autoFocus={tab === 'karyawan'}
                  placeholder="Cth: K-0001"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-black text-gray-900 bg-slate-50 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all uppercase"
                />
              </div>

               <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                  <button 
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    disabled={resetLoading}
                    className="text-[10px] text-emerald-600 font-bold hover:text-emerald-700 uppercase tracking-wider"
                  >
                    {resetLoading ? 'Mengirim...' : 'Lupa password?'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl text-sm font-black text-white tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all shadow-lg shadow-emerald-200"
                style={{ background: 'linear-gradient(135deg, #065f46, #10b981)' }}
              >
                Masuk sebagai Karyawan
                <ArrowRight size={16} />
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400 font-medium">
              Anda pemilik bisnis?{' '}
              <button type="button" onClick={() => setTab('bisnis')} className="text-blue-600 font-bold hover:text-blue-700">
                Login di sini
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CUSTOM RESET PASSWORD MODAL ── */}
      <AnimatePresence>
        {isResetModalOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsResetModalOpen(false)} />
             <motion.div key="content" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-white rounded-[40px] p-10 shadow-2xl overflow-hidden border border-white">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-emerald-600" />
                <div className="flex flex-col items-center text-center gap-4 mb-8 mt-2">
                   <div className="w-16 h-16 rounded-[24px] bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                      <ShieldCheck size={32} />
                   </div>
                   <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Otorisasi Reset</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Sinkronisasi Ke Admin HRD</p>
                   </div>
                </div>
                <form onSubmit={submitResetRequest} className="space-y-6">
                   <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ketik NIK Anda</label>
                      <input 
                         required
                         autoFocus
                         value={resetNik}
                         onChange={(e) => setResetNik(e.target.value)}
                         placeholder="Cth: K-0042"
                         className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all placeholder:normal-case placeholder:font-medium placeholder:text-slate-300"
                      />
                   </div>
                   <div className="flex gap-4 pt-2">
                      <button type="button" onClick={() => setIsResetModalOpen(false)} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">Batal</button>
                      <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50">Kirim Panggilan</button>
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
    <Suspense fallback={<div className="flex items-center justify-center p-8 text-xs font-black uppercase text-slate-400 tracking-widest animate-pulse">Memuat Login...</div>}>
      <LoginForm />
    </Suspense>
  )
}
