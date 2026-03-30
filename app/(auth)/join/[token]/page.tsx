'use client'

import React, { useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, UserCheck, Key, ArrowRight, CheckCircle2, AlertCircle, Users, Building2, Lock } from 'lucide-react'
import { verifyEmployeeNikByToken, registerEmployeeAccount } from '@/modules/auth/actions/auth.actions'
import { useRouter } from 'next/navigation'

export default function JoinByTokenPage({ 
  params: paramsPromise 
}: { 
  params: Promise<{ token: string }> 
}) {
  const params = use(paramsPromise)
  const token = params.token
  const router = useRouter()

  const [step, setStep] = useState(1) // 1: NIK, 2: Account Creation
  const [nik, setNik] = useState('')
  const [employee, setEmployee] = useState<any>(null)
  const [org, setOrg] = useState<any>(null)
  const [invite, setInvite] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const res = await verifyEmployeeNikByToken(token, nik)
    if (res.error) {
      setError(res.error)
    } else {
      setEmployee(res.employee)
      setOrg(res.org)
      setInvite(res.invite)
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
     formData.append('invite_id', invite?.id)
     
     try {
        const res = await registerEmployeeAccount(formData)
        if (res?.error) {
          setError(res.error)
          setLoading(false)
          return
        }

        if (res?.success) {
          router.push(res.redirectTo || '/dashboard')
          return
        }

        setError('Aktivasi akun gagal. Silakan coba lagi.')
        setLoading(false)
     } catch (err: any) {
        setError(err.message)
        setLoading(false)
     }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-indigo-50">
      <div className="w-full max-w-xl">
        <div className="mb-12 text-center">
            <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 border border-slate-100 group hover:scale-110 transition-transform">
               <img src={org?.logo_url || "/logo.png"} alt="NIZAM" className="w-10 h-10 object-contain scale-[1.5]" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic flex items-center justify-center gap-2">
               Aktivasi Akun <span className="text-blue-600 tracking-tighter not-italic">{org?.name?.toUpperCase() || 'NI-ZAM ERP'}</span>
            </h1>
            <p className="text-slate-400 font-bold text-[10px] mt-2 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
               <Lock size={12} className="text-blue-500" /> SECURE JOIN TOKEN: {token.toUpperCase()}
            </p>
        </div>

        <motion.div 
           initial={{ opacity: 0, scale: 0.95, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           className="bg-white rounded-[48px] shadow-2xl shadow-blue-900/10 p-10 md:p-14 border border-white relative overflow-hidden"
        >
          {/* Decorative Top Bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 text-blue-600 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
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
                         placeholder="CONTOH: EMP23001"
                         className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-black text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner uppercase"
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
                    <ShieldCheck size={12} className="text-slate-300" />
                    <span className="text-[9px] text-slate-300 font-black uppercase tracking-widest">Encypted Employee Portal System 2.1</span>
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
                <div className="flex items-center gap-4 text-emerald-600 mb-2">
                  <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] block">Data Terverifikasi</span>
                    <h3 className="text-lg font-black text-slate-800 leading-none mt-1 uppercase italic tracking-tight">{employee?.first_name} {employee?.last_name}</h3>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Akses Diberikan:</p>
                   <div className="flex items-center gap-3">
                      <div className="px-5 py-2 bg-blue-600 text-white text-[11px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-blue-100 italic">
                         {invite?.roles?.name || 'Staff Umum'}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 italic">Lewat Tautan: {invite?.label}</span>
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
                        NIK: <span className="text-slate-700">{nik}</span> • TOKEN: <span className="text-blue-600">{token}</span>
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
                       className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 disabled:opacity-50"
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
