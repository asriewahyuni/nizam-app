'use client'

import React, { useState, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn, signInWithNik, requestPasswordReset } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'
import { AlertCircle, Building2, CheckCircle2, Gamepad2, IdCard, ArrowRight, Eye, EyeOff, Info, ShieldCheck } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

type AuthNotice = 'logged-out' | 'session-expired'

const noticeMessages: Record<AuthNotice, string> = {
  'logged-out': 'Anda sudah keluar dari akun.',
  'session-expired': 'Sesi Anda sudah berakhir. Silakan masuk kembali.',
}

function getAuthNotice(value: string | null): AuthNotice | null {
  return value === 'logged-out' || value === 'session-expired' ? value : null
}

function AuthBanner({
  tone,
  children,
}: {
  tone: 'error' | 'info' | 'success'
  children: React.ReactNode
}) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info
  const toneClass = tone === 'error'
    ? 'bg-rose-500/10 text-rose-300 border-rose-500/25'
    : tone === 'success'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
      : 'bg-sky-500/10 text-sky-300 border-sky-500/25'

  return (
    <div role="status" className={`mb-6 px-4 py-3 rounded-xl text-xs font-bold leading-relaxed border flex items-start gap-3 ${toneClass}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'karyawan' ? 'karyawan' : 'bisnis'
  const error = searchParams.get('error')
  const notice = getAuthNotice(searchParams.get('notice'))

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
        <h2 className="text-2xl font-black text-white tracking-tight">Ruang Kendali</h2>
        <p className="text-slate-400 text-sm mt-1 font-medium">Buka akses untuk melanjutkan sesi aman Anda.</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 p-1.5 bg-slate-950/50 border border-white/5 rounded-2xl mb-8 shadow-inner">
        <button
          onClick={() => setTab('bisnis')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
            tab === 'bisnis'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(37,99,235,0.2)]'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
        >
          <Building2 size={14} />
          Admin Bisnis
        </button>
        <button
          onClick={() => setTab('karyawan')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
            tab === 'karyawan'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
        >
          <IdCard size={14} />
          Panel Staf
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <AuthBanner tone="error">{decodeURIComponent(error)}</AuthBanner>
      )}

      {/* Notice Banner */}
      {notice && !error && (
        <AuthBanner tone={notice === 'logged-out' ? 'success' : 'info'}>
          {noticeMessages[notice]}
        </AuthBanner>
      )}

      {/* Reset Message */}
      {resetMsg && (
        <AuthBanner tone={resetMsg.type === 'success' ? 'success' : 'error'}>
          {resetMsg.text}
        </AuthBanner>
      )}

      <AnimatePresence initial={false} mode="wait">
        {tab === 'bisnis' ? (
          <motion.div
            key="bisnis"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* ── BUSINESS OWNER LOGIN ── */}
            <form action={signIn} className="space-y-5">
              <input type="hidden" name="redirectTo" value={searchParams.get('redirectTo') || ''} />

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Email Bisnis</label>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus={tab === 'bisnis'}
                  placeholder="arsitek@perusahaan.com"
                  className="w-full px-4 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Sandi Keamanan</label>
                  <Link href="/forgot-password" className="text-[10px] text-blue-400 font-bold hover:text-blue-300 transition-colors uppercase tracking-widest">
                    Lupa Sandi?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 pr-11 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-4 rounded-xl text-[13px] font-black text-white uppercase tracking-widest flex items-center justify-center gap-3 hover:opacity-90 active:scale-[0.98] transition-all bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] border border-white/10"
              >
                Inisialisasi Kendali
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 space-y-4 text-center">
              <p className="text-sm text-slate-500 font-medium">
                Belum terdaftar di ekosistem kami?{' '}
                <Link href="/register" className="text-white font-bold hover:text-blue-400 transition-colors">
                  Daftar Sekarang
                </Link>
              </p>
              <Link
                href="/demo"
                className="inline-flex w-full justify-center items-center gap-2 px-5 py-3.5 bg-slate-800/50 text-slate-300 text-[11px] font-black rounded-xl hover:bg-slate-700/50 hover:text-white transition-all border border-white/5 uppercase tracking-[0.15em]"
              >
                <Gamepad2 size={14} />
                Coba Lingkungan Demo
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="karyawan"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* ── EMPLOYEE LOGIN ── */}
            <form action={signInWithNik} className="space-y-5">
              <input type="hidden" name="redirectTo" value={searchParams.get('redirectTo') || ''} />

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Nomor Induk Karyawan</label>
                <input
                  name="nik"
                  type="text"
                  required
                  autoFocus={tab === 'karyawan'}
                  placeholder="NOMOR PROTOKOL, MISAL: NIZ-001"
                  className="w-full px-4 py-3.5 rounded-xl border border-white/10 text-sm font-black text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all uppercase shadow-inner"
                />
              </div>

               <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Sandi Otorisasi</label>
                  <button 
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    disabled={resetLoading}
                    className="text-[10px] text-emerald-400 font-bold hover:text-emerald-300 transition-colors uppercase tracking-widest"
                  >
                    {resetLoading ? 'Menyinkronkan...' : 'Lupa sandi?'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 pr-11 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all shadow-inner"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-4 rounded-xl text-[13px] font-black text-emerald-950 uppercase tracking-widest flex items-center justify-center gap-3 hover:opacity-90 active:scale-[0.98] transition-all bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] border border-emerald-300/50"
              >
                Akses Platform
                <ArrowRight size={16} />
              </button>
            </form>

            <p className="mt-8 pt-6 border-t border-white/5 text-center text-xs text-slate-500 font-medium">
              Akses khusus otoritas pemilik?{' '}
              <button type="button" onClick={() => setTab('bisnis')} className="text-white font-bold hover:text-emerald-400 transition-colors">
                Ganti Otorisasi
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CUSTOM RESET PASSWORD MODAL ── */}
      <AnimatePresence>
        {isResetModalOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setIsResetModalOpen(false)} />
             <motion.div key="content" initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-emerald-500/20 blur-[80px] rounded-full pointer-events-none" />
                
                <div className="relative flex flex-col items-center text-center gap-4 mb-8 mt-2">
                   <div className="w-16 h-16 rounded-[20px] bg-slate-800 border border-white/5 text-emerald-400 flex items-center justify-center shadow-inner">
                      <ShieldCheck size={28} />
                   </div>
                   <div>
                      <h3 className="text-xl font-black text-white tracking-tight">Otorisasi Reset</h3>
                      <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-[0.2em] mt-2">Sinkronisasi Pihak Berwenang</p>
                   </div>
                </div>
                <form onSubmit={submitResetRequest} className="relative space-y-6">
                   <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ketik Nomor Induk Anda</label>
                      <input 
                         required
                         autoFocus
                         value={resetNik}
                         onChange={(e) => setResetNik(e.target.value)}
                         placeholder="Cth: NIZ-0042"
                         className="w-full px-5 py-4 bg-slate-950/50 border border-white/10 rounded-2xl text-sm font-black uppercase text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:normal-case placeholder:font-medium placeholder:text-slate-600 shadow-inner"
                      />
                   </div>
                   <div className="flex gap-4 pt-2">
                      <button type="button" onClick={() => setIsResetModalOpen(false)} className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all">Batal</button>
                      <button type="submit" className="flex-1 py-4 bg-emerald-500 text-emerald-950 text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50">Kirim Sinyal</button>
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
    <Suspense fallback={<div className="flex items-center justify-center p-8 text-xs font-black uppercase text-slate-500 tracking-widest animate-pulse">Inisialisasi Link...</div>}>
      <LoginForm />
    </Suspense>
  )
}
