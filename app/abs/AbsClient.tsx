'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, ShieldCheck, Users, CheckCircle2,
  ArrowRight, Timer, Building2,
  Sparkles, QrCode, BookOpen, TrendingUp, Package, UserCheck
} from 'lucide-react'
import Link from 'next/link'
import type { VoucherStatus } from './page'
import { MiniErpWordmark } from '@/components/shared/MiniErpWordmark'

const ABS_MODULES = [
  { icon: TrendingUp, label: 'Accounting & Finance', desc: 'Jurnal, kas bank, laporan keuangan syariah' },
  { icon: Package, label: 'Inventory & Purchasing', desc: 'Stok barang, pembelian, dan mutasi gudang' },
  { icon: Zap, label: 'Sales, POS & CRM', desc: 'Penjualan, kasir, dan manajemen pelanggan' },
  { icon: UserCheck, label: 'HRIS', desc: 'Karyawan, absensi, dan penggajian' },
  { icon: BookOpen, label: 'Reports', desc: 'Dashboard insight dan laporan performa' },
]

export default function AbsClient({ status }: { status: VoucherStatus }) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  useEffect(() => {
    if (!status.expiresAt) return
    const timer = setInterval(() => {
      const diff = new Date(status.expiresAt!).getTime() - new Date().getTime()
      if (diff <= 0) {
        setTimeLeft('Pendaftaran Berakhir')
        clearInterval(timer)
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        setTimeLeft(`${days}h ${hours}j ${mins}m lagi`)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [status.expiresAt])

  const canRegister = status.isValid && !status.isExpired && !status.isLimitReached

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-blue-500/30 overflow-hidden relative font-sans flex items-center justify-center py-20">

      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-20%] right-[-10%] w-[80%] h-[80%] bg-blue-100 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-orange-50 blur-[120px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#004AB8 0.5px, transparent 0.5px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="max-w-4xl w-full px-6 relative z-10 flex flex-col items-center">

        {/* Floating Logos Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-6 mb-12 bg-white/80 backdrop-blur-md px-8 py-4 rounded-[32px] shadow-sm border border-slate-100"
        >
          <img src="/logos/abs_logo.jpeg" alt="ABS" className="h-10 object-contain" />
          <div className="h-6 w-px bg-slate-200" />
          <img src="/logos/core_logo.webp" alt="CORe ISEC" className="h-6 object-contain" />
        </motion.div>

        {/* Main Ticket */}
        <motion.div
           initial={{ opacity: 0, scale: 0.9, y: 30 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
           className="w-full relative max-w-2xl"
        >
           <div className="absolute -inset-4 bg-blue-500/10 blur-3xl rounded-[60px] -z-10" />

           <div className="bg-white rounded-[40px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border-t-[12px] border-[#004AB8] relative overflow-hidden flex flex-col items-stretch">

              {/* Ticket Top: Brand Info */}
              <div className="p-10 text-center border-b-2 border-dashed border-slate-100 relative">
                 <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-[#F8FAFC] rounded-full border border-slate-100 shadow-inner" />
                 <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-[#F8FAFC] rounded-full border border-slate-100 shadow-inner" />

                 <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 rounded-full mb-6">
                    <Sparkles size={14} className="text-[#004AB8]" />
                    <span className="text-[10px] font-black text-[#004AB8] uppercase tracking-[0.2em]">Exclusively for ABS Participants</span>
                 </div>

                 <h1 className="text-4xl md:text-5xl font-black text-[#004AB8] tracking-tighter uppercase italic leading-none mb-4">
                    Trial 30 Hari <br className="hidden md:block" />
                    <span className="text-orange-500 not-italic">GRATIS PENUH</span>
                 </h1>

                 <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-md mx-auto">
                    Akses sistem ERP Syariah penuh selama 30 hari — khusus peserta{' '}
                    <span className="font-semibold text-slate-600">Akademi Bisnis Syariah</span>{' '}
                    bersama{' '}
                    <MiniErpWordmark
                      prefix="Nizam Mini"
                      className="font-semibold text-slate-600"
                      erpClassName="text-amber-500"
                    />.
                 </p>
              </div>

              {/* Ticket Middle: Offer Details */}
              <div className="p-10 flex flex-col md:flex-row items-start justify-between gap-10 bg-[#FBFCFE]">
                 <div className="space-y-6 flex-1">
                    <div className="space-y-1">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">Benefit Eksklusif:</p>
                       <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-black text-[#004AB8] italic tracking-tighter">30</span>
                          <span className="text-2xl font-black text-[#004AB8]/40 uppercase">HARI GRATIS</span>
                       </div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Paket Plus — Starter Core + HRIS</p>
                    </div>

                    <div className="space-y-3 pt-2">
                       {ABS_MODULES.map(({ icon: Icon, label, desc }) => (
                         <div key={label} className="flex items-start gap-3 group">
                           <div className="w-6 h-6 mt-0.5 bg-blue-100 rounded-full flex items-center justify-center shrink-0 group-hover:bg-[#004AB8] transition-colors duration-300">
                             <Icon size={12} className="text-[#004AB8] group-hover:text-white transition-colors" />
                           </div>
                           <div>
                             <p className="text-[11px] font-black text-slate-700 uppercase italic tracking-tighter leading-none">{label}</p>
                             <p className="text-[10px] font-medium text-slate-400 leading-snug mt-0.5">{desc}</p>
                           </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="shrink-0 w-32 h-32 bg-white rounded-3xl border-2 border-slate-100 flex flex-col items-center justify-center p-3 shadow-md relative group">
                    <QrCode size={64} className="text-[#004AB8] mb-2" />
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic font-mono">{status.code}</span>
                    <div className="absolute inset-0 bg-blue-500/5 rotate-3 -z-10 rounded-3xl" />
                 </div>
              </div>

              {/* Ticket Bottom: CTA */}
              <div className="p-10 bg-white space-y-8">
                 <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                          <Timer size={20} />
                       </div>
                       <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Offer Expiration:</p>
                          <p className="text-xs font-black text-slate-900 uppercase italic tracking-tighter">{timeLeft || 'Checking...'}</p>
                       </div>
                    </div>
                    <div className="h-8 w-px bg-slate-100 hidden md:block" />
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                          <Users size={20} />
                       </div>
                       <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Remaining Quota:</p>
                          <p className="text-xs font-black text-slate-900 uppercase italic tracking-tighter">Limited Slots Left</p>
                       </div>
                    </div>
                    <div className="h-8 w-px bg-slate-100 hidden md:block" />
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                          <ShieldCheck size={20} />
                       </div>
                       <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Durasi Trial:</p>
                          <p className="text-xs font-black text-emerald-700 uppercase italic tracking-tighter">30 Hari Penuh</p>
                       </div>
                    </div>
                 </div>

                 <div className="pt-2">
                    <AnimatePresence mode="wait">
                       {!canRegister ? (
                         <motion.div
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           className="w-full py-6 bg-slate-100 text-slate-400 rounded-3xl font-black text-xs uppercase tracking-[0.4em] text-center border-2 border-dashed border-slate-200"
                         >
                            Offer Not Available
                         </motion.div>
                       ) : (
                         <Link
                           href="/register?plan=abs"
                           className="group relative block w-full outline-none focus:ring-4 focus:ring-blue-100 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/20 active:scale-95 transition-all"
                         >
                            <div className="absolute inset-0 bg-gradient-to-r from-[#004AB8] via-blue-600 to-[#004AB8] animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                            <div className="relative py-6 flex items-center justify-center gap-4 text-white font-black text-sm uppercase tracking-[0.4em]">
                               AKTIFKAN TRIAL 30 HARI SAYA
                               <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform duration-300" />
                            </div>
                         </Link>
                       )}
                    </AnimatePresence>
                 </div>
              </div>
           </div>

           {/* Under-Ticket Ribbon */}
           <div className="flex justify-center mt-12 opacity-50 grayscale transition-all hover:grayscale-0 cursor-pointer">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] flex items-center gap-3 italic">
                 Official Collaboration <ArrowRight size={12} /> <img src="/logo.png" className="h-6 object-contain" />
              </p>
           </div>
        </motion.div>

        {/* Brand Link Back */}
        <div className="mt-20">
           <Link href="/pricing" className="text-[10px] font-black text-slate-300 hover:text-blue-500 transition-colors uppercase tracking-[0.3em] flex items-center gap-2">
              <Building2 size={12} /> Lihat Paket Standar
           </Link>
        </div>
      </div>

      <style jsx>{`
         @keyframes shimmer {
            0% { background-position: 100% 0; }
            100% { background-position: -100% 0; }
         }
         .animate-shimmer {
            animation: shimmer 3s infinite linear;
         }
      `}</style>
    </div>
  )
}
