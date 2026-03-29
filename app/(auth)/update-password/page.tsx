'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Lock, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Ensure they only see this page if they have a session (handled by the magic link)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setErrorMsg('Sesi tidak valid atau telah kedaluwarsa. Silakan ajukan Lupa Password kembali.')
      }
    })
  }, [supabase.auth])

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
      const { error } = await supabase.auth.updateUser({ password })
      
      if (error) {
        setErrorMsg(error.message)
      } else {
        setSuccess(true)
        setTimeout(() => {
          router.push('/dashboard')
        }, 3000)
      }
    } catch (err: any) {
      setErrorMsg("Gagal menghubungi server.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-6 lg:px-8 relative overflow-hidden font-sans">
      <div className="max-w-md w-full mx-auto relative z-10 flex flex-col items-center">
        {/* LOGO */}
        <div className="mb-10 text-center flex flex-col items-center">
           <Link href="/" className="inline-block p-4 bg-white shadow-xl shadow-blue-500/10 rounded-3xl border border-slate-100 mb-6 hover:-translate-y-1 transition-transform">
              <img src="/logo.png" className="h-10 w-10 object-contain mx-auto" alt="NIZAM" />
           </Link>
           <h2 className="text-3xl font-black text-[#004AB8] uppercase tracking-tighter italic">BUAT PASSWORD BARU</h2>
           <p className="mt-2 text-sm text-slate-500 font-medium">Amankan kembali akun organisasi Anda</p>
        </div>

        {/* Modal/Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 p-8 md:p-10 w-full border border-slate-100"
        >
          {success ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="text-center space-y-6 py-6"
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-[24px] flex items-center justify-center mx-auto text-emerald-500 border border-emerald-100 mb-2">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">PASSWORD DIPERBARUI!</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-xs mx-auto">
                Anda telah berhasil mengganti password. Mengarahkan Anda ke dashboard dalam beberapa detik...
              </p>
            </motion.div>
          ) : (
            <>
              <AnimatePresence>
                 {errorMsg && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                       <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-start gap-3 border border-red-100">
                         <AlertCircle size={20} className="shrink-0 mt-0.5" />
                         <span className="text-xs font-bold uppercase leading-relaxed tracking-wider">{errorMsg}</span>
                       </div>
                    </motion.div>
                 )}
              </AnimatePresence>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">PASSWORD BARU</label>
                  <div className="relative group">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#004AB8] transition-colors" />
                    <input
                      name="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      className="block w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:bg-white focus:border-[#004AB8] focus:ring-4 focus:ring-blue-50 transition-all text-slate-900 font-black tracking-widest"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">KONFIRMASI PASSWORD</label>
                  <div className="relative group">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#004AB8] transition-colors" />
                    <input
                      name="confirm_password"
                      type="password"
                      required
                      placeholder="••••••••"
                      className="block w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:bg-white focus:border-[#004AB8] focus:ring-4 focus:ring-blue-50 transition-all text-slate-900 font-black tracking-widest"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-black rounded-2xl text-white bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all uppercase tracking-[0.3em] overflow-hidden shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative flex items-center gap-2">
                       {loading ? 'MENYIMPAN...' : 'SIMPAN PASSWORD'}
                    </span>
                  </button>
                </div>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
