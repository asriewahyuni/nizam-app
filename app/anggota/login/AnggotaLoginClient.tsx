'use client'

import { useState, useTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signInAsAnggota, requestAnggotaPasswordReset } from '@/modules/kojasmat/actions/kojasmat-auth.actions'
import { Eye, EyeOff, ArrowRight, ShieldCheck, Loader2, HandCoins } from 'lucide-react'

export default function AnggotaLoginClient({ orgId }: { orgId?: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const error = searchParams.get('error')
  const redirectTo = searchParams.get('redirectTo') || ''

  const [showPass, setShowPass] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Lupa password
  const [showReset, setShowReset] = useState(false)
  const [resetKode, setResetKode] = useState('')
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [resetPending, startResetTransition] = useTransition()

  function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => {
      signInAsAnggota(fd)
    })
  }

  function handleReset(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('kode_anggota', resetKode)
    if (orgId) fd.set('org_id', orgId)
    setResetMsg(null)
    startResetTransition(async () => {
      const res = await requestAnggotaPasswordReset(fd)
      if (res.success) {
        setResetMsg({
          type: 'success',
          text: 'Permintaan reset diterima. Silakan hubungi pengurus koperasi untuk mendapatkan kata sandi baru.',
        })
        setResetKode('')
        setTimeout(() => { setShowReset(false); setResetMsg(null) }, 8000)
      } else {
        setResetMsg({ type: 'error', text: res.error || 'Gagal memproses permintaan.' })
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <HandCoins size={28} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Portal Anggota</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Koperasi Syariah</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/60 border border-white/8 rounded-2xl p-7 shadow-2xl backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Masuk ke Akun Anda</h2>
            <p className="text-slate-400 text-sm mt-1">Gunakan kode anggota dan kata sandi yang diberikan pengurus.</p>
          </div>

          {/* Error banner */}
          {error && (
            <div role="alert" className="mb-5 px-4 py-3 rounded-xl text-sm font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-start gap-2.5">
              <ShieldCheck size={15} className="mt-0.5 shrink-0" />
              {decodeURIComponent(error)}
            </div>
          )}

          {/* Reset success/error message */}
          {resetMsg && (
            <div role="status" aria-live="polite" className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-2.5 ${resetMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              <ShieldCheck size={15} className="mt-0.5 shrink-0" />
              {resetMsg.text}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            {orgId && <input type="hidden" name="org_id" value={orgId} />}

            <div className="space-y-1.5">
              <label htmlFor="kode_anggota" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Kode Anggota
              </label>
              <input
                id="kode_anggota"
                name="kode_anggota"
                type="text"
                required
                autoFocus
                autoComplete="username"
                placeholder="Contoh: KJM-001"
                className="w-full px-4 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-950/60 placeholder:text-slate-600 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all uppercase tracking-widest shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-xs text-emerald-400 font-medium hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  Lupa sandi?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 pr-12 rounded-xl border border-white/10 text-sm font-semibold text-white bg-slate-950/60 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer p-1"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_14px_rgba(16,185,129,0.35)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Memproses...</>
              ) : (
                <>Masuk <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="mt-6 pt-5 border-t border-white/5 text-center text-xs text-slate-500 leading-relaxed">
            Belum punya akun?{' '}
            <span className="text-slate-400">Hubungi pengurus koperasi untuk mendaftar.</span>
          </p>
        </div>

        {/* Back link */}
        <p className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push(orgId ? `/anggota/daftar?org=${orgId}` : '/anggota/daftar')}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors cursor-pointer"
          >
            Daftar sebagai anggota baru →
          </button>
        </p>
      </div>

      {/* ── Modal Lupa Password ── */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
            onClick={() => setShowReset(false)}
          />
          <div className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-7 shadow-2xl">
            <div className="flex flex-col items-center text-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/10 text-emerald-400 flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Lupa Kata Sandi?</h3>
                <p className="text-sm text-slate-400 font-normal mt-1">
                  Masukkan kode anggota Anda. Pengurus koperasi akan memberikan kata sandi baru.
                </p>
              </div>
            </div>

            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-1.5 text-left">
                <label htmlFor="reset-kode" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Kode Anggota
                </label>
                <input
                  id="reset-kode"
                  required
                  autoFocus
                  value={resetKode}
                  onChange={e => setResetKode(e.target.value)}
                  placeholder="Contoh: KJM-001"
                  className="w-full px-4 py-3.5 bg-slate-950/60 border border-white/10 rounded-xl text-sm font-semibold uppercase tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:normal-case placeholder:font-normal placeholder:text-slate-600 shadow-inner"
                />
              </div>

              {resetMsg && (
                <div className={`px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-2.5 ${resetMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                  <ShieldCheck size={15} className="mt-0.5 shrink-0" />
                  {resetMsg.text}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowReset(false); setResetMsg(null) }}
                  className="flex-1 py-3 text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-white/5 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetPending}
                  className="flex-1 py-3 bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {resetPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  Kirim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
