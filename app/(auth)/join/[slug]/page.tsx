'use client'

import React, { useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, UserCheck, Key, ArrowRight, CheckCircle2, AlertCircle, Users, Building2 } from 'lucide-react'
import { verifyEmployeeNikBySlug, registerEmployeeAccount } from '@/modules/auth/actions/auth.actions'

export default function JoinBySlugPage({ 
  params: paramsPromise 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const params = use(paramsPromise)
  const orgSlug = params.slug

  const [step, setStep] = useState(1) // 1: NIK, 2: Account Creation
  const [nik, setNik] = useState('')
  const [employee, setEmployee] = useState<any>(null)
  const [org, setOrg] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const res = await verifyEmployeeNikBySlug(orgSlug, nik)
    if (res.error) {
      setError(res.error)
    } else {
      setEmployee(res.employee)
      setOrg(res.org)
      setStep(2)
    }
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault()
     setLoading(true)
     setError('')
     const formData = new FormData(e.currentTarget)
     formData.append('nik', nik)
     
     const res = await registerEmployeeAccount(formData)
     if (res?.error) {
       setError(res.error)
       setLoading(false)
     }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-100 via-slate-50 to-blue-50">
      <div className="w-full max-w-xl">
        <div className="mb-12 text-center">
            <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 border border-slate-100 group hover:scale-110 transition-transform">
               <img src="/logo.png" alt="NIZAM" className="w-10 h-10 object-contain scale-[1.5]" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic flex items-center justify-center gap-2">
               Aktivasi Akun <span className="text-blue-600 tracking-tighter not-italic">@{orgSlug}</span>
            </h1>
            <p className="text-slate-400 font-bold text-[10px] mt-2 uppercase tracking-[0.2em]">{org?.name || 'Verifikasi Identitas Karyawan Enterprise'}</p>
        </div>

        <motion.div 
           initial={{ opacity: 0, scale: 0.95, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           className="bg-white rounded-[48px] shadow-2xl shadow-emerald-900/10 p-10 md:p-14 border border-white relative overflow-hidden"
        >
          {/* Decorative Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 to-blue-500" />

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 text-emerald-600 mb-2">
                  <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center">
                    <UserCheck size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Tahap 1: Verifikasi NIK</span>
                </div>

                <form onSubmit={handleVerify} className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor Induk Karyawan</label>
                      <input 
                         autoFocus
                         required
                         value={nik}
                         onChange={e => setNik(e.target.value)}
                         placeholder="Masukkan NIK Anda"
                         className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-emerald-500 transition-all shadow-inner uppercase"
                      />
                   </div>

                   {error && (
                     <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-[10px] font-black animate-shake uppercase tracking-tight">
                        <AlertCircle size={14} />
                        {error}
                     </div>
                   )}

                   <button 
                     disabled={loading}
                     type="submit"
                     className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                   >
                     {loading ? 'MENGECEK DB...' : 'Konfirmasi Identitas'}
                     <ArrowRight size={18} />
                   </button>
                </form>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-2">
                    <Building2 size={12} className="text-slate-300" />
                    <span className="text-[9px] text-slate-300 font-black uppercase tracking-widest">Aktivasi ini khusus karyawan di dalam lingkungan @{orgSlug}</span>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 text-blue-600 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] block">Data Ditemukan</span>
                    <h3 className="text-lg font-black text-slate-800 leading-none mt-1 uppercase italic tracking-tight">{employee?.first_name} {employee?.last_name}</h3>
                  </div>
                </div>

                <form onSubmit={handleRegister} className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password Baru</label>
                      <div className="relative">
                        <input 
                          name="password"
                          type="password"
                          required
                          minLength={8}
                          placeholder="Minimal 8 karakter"
                          className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
                        />
                        <Key className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold ml-2 uppercase tracking-wider">
                        NIK: <span className="text-slate-700">{nik}</span> • Bisnis: <span className="text-slate-700">@{orgSlug}</span>
                      </p>
                   </div>

                   {error && (
                     <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-[10px] font-black animate-shake uppercase tracking-tight">
                        <AlertCircle size={14} />
                        {error}
                     </div>
                   )}

                   <div className="flex flex-col gap-4">
                     <button 
                       disabled={loading}
                       type="submit"
                       className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-50"
                     >
                       {loading ? 'MENGAKTIFKAN...' : 'Gunakan Akun Sekarang'}
                       <ShieldCheck size={18} />
                     </button>
                     <button 
                       type="button" 
                       onClick={() => setStep(1)}
                       className="text-[10px] font-black text-slate-300 hover:text-slate-500 uppercase tracking-widest transition-all"
                     >
                        Bukan Anda? Kembali
                     </button>
                   </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
