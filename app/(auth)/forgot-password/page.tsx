'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ArrowLeft, Mail, CheckCircle2, AlertCircle, Building2 } from 'lucide-react'
import Link from 'next/link'
import { SafeButton } from '@/components/ui/NizamUI'
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
    } catch (err: any) {
      setErrorMsg("Gagal menghubungi server. Silakan coba sesaat lagi.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#004AB8]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-md w-full mx-auto relative z-10 flex flex-col items-center">
        {/* LOGO */}
        <div className="mb-10 text-center flex flex-col items-center">
           <Link href="/" className="inline-block p-4 bg-white shadow-xl shadow-blue-500/10 rounded-3xl border border-slate-100 mb-6 hover:-translate-y-1 transition-transform">
              <img src="/logo.png" className="h-10 w-10 object-contain mx-auto" alt="NIZAM" />
           </Link>
           <h2 className="text-3xl font-black text-[#004AB8] uppercase tracking-tighter italic">RESET PASSWORD</h2>
           <p className="mt-2 text-sm text-slate-500 font-medium">Sistem Keamanan Akun Terpadu</p>
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
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">EMAIL TERKIRIM!</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-xs mx-auto">
                Silakan periksa kotak masuk <strong>(atau folder spam/junk)</strong> email Anda untuk tautan reset password rahasia dari NIZAM.
              </p>
              <div className="pt-6">
                 <Link href="/login" className="block w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-[0.3em] rounded-2xl transition-all">
                   KEMBALI KE LOGIN
                 </Link>
              </div>
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
                  <label htmlFor="email" className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">ALAMAT EMAIL TERDAFTAR</label>
                  <div className="relative group">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#004AB8] transition-colors" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="email@perusahaan.com"
                      className="block w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:bg-white focus:border-[#004AB8] focus:ring-4 focus:ring-blue-50 transition-all text-slate-900 font-bold"
                    />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 text-center uppercase">Tautan rahasia akan dikirimkan ke email ini.</p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-black rounded-2xl text-white bg-[#004AB8] hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all uppercase tracking-[0.3em] overflow-hidden shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative flex items-center gap-2">
                       {loading ? 'MEMPROSES...' : 'KIRIM LINK RESET'}
                       {!loading && <ShieldCheck size={18} />}
                    </span>
                  </button>
                </div>
              </form>

              <div className="mt-8 text-center">
                 <Link href="/login" className="inline-flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-[#004AB8] uppercase tracking-[0.2em] transition-colors">
                   <ArrowLeft size={12} /> Kembali ke halaman Login
                 </Link>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
