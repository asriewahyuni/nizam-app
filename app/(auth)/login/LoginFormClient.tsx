'use client'

import React, { useState, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn, signInWithNik, requestPasswordReset } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'
import {
  Building2, IdCard, ArrowRight, Eye, EyeOff, ShieldCheck, Users,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'

export type OrgContext = {
  id: string
  name: string
  logo_url: string | null
  slug: string
}

interface LoginFormProps {
  orgContext?: OrgContext | null
}

function LoginFormInner({ orgContext }: LoginFormProps) {
  const searchParams = useSearchParams()
  const defaultTab = orgContext ? 'karyawan' : (searchParams.get('tab') === 'karyawan' ? 'karyawan' : 'bisnis')
  const error = searchParams.get('error')

  const [tab, setTab] = useState<'bisnis' | 'karyawan'>(defaultTab)
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
      setResetMsg({ type: 'success', text: 'Permintaan reset terkirim. Silakan hubungi Admin HRD untuk mendapatkan sandi baru.' })
    } else {
      setResetMsg({ type: 'error', text: res.error || 'Gagal mengirim permintaan.' })
    }
    setResetNik('')
    setTimeout(() => setResetMsg(null), 10000)
  }

  return (
    <div>
      {/* ── Org context badge (saat akses via link slug) ── */}
      {orgContext && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
          {orgContext.logo_url ? (
            <img src={orgContext.logo_url} alt={orgContext.name} className="w-8 h-8 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Users size={16} className="text-emerald-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Login Karyawan</p>
            <p className="text-sm font-bold text-white truncate">{orgContext.name}</p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-black text-white tracking-tight">Ruang Kendali</h2>
        <p className="text-slate-400 text-sm mt-1 font-medium">Buka akses untuk melanjutkan sesi aman Anda.</p>
      </div>

      {/* Tab Switcher — sembunyikan saat orgContext aktif (selalu karyawan) */}
      {!orgContext && (
        <div className="flex gap-2 p-1.5 bg-slate-950/50 border border-white/5 rounded-2xl mb-8 shadow-inner">
          <button
            onClick={() => setTab('bisnis')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
              tab === 'bisnis'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            <Building2 size={14} />
            Pemilik Bisnis
          </button>
          <button
            onClick={() => setTab('karyawan')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
              tab === 'karyawan'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            <IdCard size={14} />
            Karyawan
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div role="alert" className="mb-6 px-4 py-3 rounded-xl text-sm font-medium leading-relaxed bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-start gap-2.5">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-rose-400" />
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Reset Message */}
      {resetMsg && (
        <div role="status" aria-live="polite" className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium leading-relaxed flex items-start gap-2.5 ${resetMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          <ShieldCheck size={15} className="mt-0.5 shrink-0" />
          {resetMsg.text}
        </div>
      )}

      <AnimatePresence initial={false} mode="wait">
        {tab === 'bisnis' && !orgContext ? (
          <motion.div
            key="bisnis"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* ── BUSINESS OWNER LOGIN ── */}
            <form action={signIn} className="space-y-5">
              <input type="hidden" name="redirectTo" value={searchParams.get('redirectTo') || ''} />

              <div className="space-y-1.5">
                <label htmlFor="bisnis-email" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Bisnis</label>
                <input
                  id="bisnis-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  placeholder="nama@bisnis.com"
                  className="w-full px-4 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="bisnis-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kata Sandi</label>
                  <Link href="/forgot-password" className="text-xs text-blue-400 font-medium hover:text-blue-300 transition-colors">
                    Lupa sandi?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="bisnis-password"
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 pr-12 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer p-1">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_4px_14px_rgba(37,99,235,0.4)] cursor-pointer"
              >
                Masuk <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 space-y-4 text-center">
              <p className="text-sm text-slate-500 font-medium">
                Belum punya akun?{' '}
                <Link href="/register" className="text-white font-semibold hover:text-blue-400 transition-colors">
                  Daftar Sekarang
                </Link>
              </p>
              <Link
                href="/demo"
                className="inline-flex w-full justify-center items-center gap-2 px-5 py-3 bg-slate-800/50 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-700/50 hover:text-white transition-all border border-white/5"
              >
                Coba Demo Gratis
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="karyawan"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* ── EMPLOYEE LOGIN ── */}
            <form action={signInWithNik} className="space-y-5">
              <input type="hidden" name="redirectTo" value={searchParams.get('redirectTo') || ''} />
              {/* orgId + orgSlug dari slug page — memastikan NIK hanya resolve ke org ini */}
              {orgContext && <input type="hidden" name="orgId" value={orgContext.id} />}
              {orgContext && <input type="hidden" name="orgSlug" value={orgContext.slug} />}

              <div className="space-y-1.5">
                <label htmlFor="karyawan-nik" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nomor Induk Karyawan (NIK)</label>
                <input
                  id="karyawan-nik"
                  name="nik"
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: NIZ-001"
                  className="w-full px-4 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all uppercase shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="karyawan-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kata Sandi</label>
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    disabled={resetLoading}
                    className="text-xs text-emerald-400 font-medium hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    {resetLoading ? 'Memproses...' : 'Lupa sandi?'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="karyawan-password"
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 pr-12 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-900/50 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all shadow-inner"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer p-1">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_14px_rgba(16,185,129,0.4)] cursor-pointer"
              >
                Masuk <ArrowRight size={16} />
              </button>
            </form>

            {!orgContext && (
              <p className="mt-8 pt-6 border-t border-white/5 text-center text-sm text-slate-500 font-medium">
                Login sebagai pemilik bisnis?{' '}
                <button type="button" onClick={() => setTab('bisnis')} className="text-white font-semibold hover:text-emerald-400 transition-colors cursor-pointer">
                  Ganti ke Admin
                </button>
              </p>
            )}

            {orgContext && (
              <p className="mt-8 pt-6 border-t border-white/5 text-center text-sm text-slate-500 font-medium">
                Bukan karyawan {orgContext.name}?{' '}
                <Link href="/login" className="text-white font-semibold hover:text-slate-300 transition-colors">
                  Login halaman utama
                </Link>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESET PASSWORD MODAL ── */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setIsResetModalOpen(false)} />
            <motion.div key="content" initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-7 shadow-2xl">
              <div className="flex flex-col items-center text-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/10 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Reset Kata Sandi</h3>
                  <p className="text-sm text-slate-400 font-normal mt-1">Masukkan NIK Anda untuk meminta reset kata sandi ke Admin HRD.</p>
                </div>
              </div>
              <form onSubmit={submitResetRequest} className="space-y-5">
                <div className="space-y-1.5 text-left">
                  <label htmlFor="reset-nik" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nomor Induk Karyawan (NIK)</label>
                  <input
                    id="reset-nik"
                    required
                    autoFocus
                    value={resetNik}
                    onChange={(e) => setResetNik(e.target.value)}
                    placeholder="Contoh: NIZ-0042"
                    className="w-full px-4 py-3.5 bg-slate-950/50 border border-white/10 rounded-xl text-sm font-semibold uppercase text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:normal-case placeholder:font-normal placeholder:text-slate-600 shadow-inner"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setIsResetModalOpen(false)} className="flex-1 py-3 text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-white/5 rounded-xl transition-all cursor-pointer">Batal</button>
                  <button type="submit" className="flex-1 py-3 bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all active:scale-[0.98] cursor-pointer">Kirim</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function LoginFormClient({ orgContext }: LoginFormProps) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8 text-xs font-black uppercase text-slate-500 tracking-widest animate-pulse">Inisialisasi Link...</div>}>
      <LoginFormInner orgContext={orgContext} />
    </Suspense>
  )
}
