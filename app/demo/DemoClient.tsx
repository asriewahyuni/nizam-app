'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Sparkles, Building2, ArrowRight, Zap, Shield, BarChart3, Package, Factory, Users } from 'lucide-react'
import { startDemoSession } from '@/modules/demo/actions/demo.actions'

export default function DemoClient() {
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'welcome' | 'setup'>('welcome')

  const handleStart = async () => {
    if (!businessName.trim()) return
    setLoading(true)
    await startDemoSession(businessName.trim())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-xl"
      >
        {step === 'welcome' ? (
          <div className="text-center space-y-8">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex items-center justify-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 overflow-hidden border border-white/10">
                <img src="/logo.png" alt="NIZAM" className="w-full h-full object-cover scale-[1.3]" />
              </div>
              <div className="text-left">
                <h1 className="text-3xl font-black text-white tracking-tighter">NIZAM</h1>
                <p className="text-[10px] font-bold text-blue-400 tracking-[0.3em] uppercase">Cloud ERP Demo</p>
              </div>
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
                Rasakan ERP
                <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent"> Tanpa Batas</span>
              </h2>
              <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto leading-relaxed">
                Jelajahi seluruh fitur NIZAM ERP secara real — dari akuntansi, inventory, manufaktur, 
                hingga POS. Data akan di-reset otomatis saat Anda selesai.
              </p>
            </motion.div>

            {/* Feature pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap justify-center gap-2"
            >
              {[
                { icon: BarChart3, label: 'Akuntansi' },
                { icon: Package, label: 'Inventory' },
                { icon: Factory, label: 'Manufaktur' },
                { icon: Users, label: 'HRIS' },
                { icon: Zap, label: 'POS' },
                { icon: Shield, label: 'Full Access' },
              ].map((f, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 backdrop-blur-sm text-white/70 text-[10px] font-bold uppercase tracking-wider rounded-full border border-white/10"
                >
                  <f.icon size={12} />
                  {f.label}
                </span>
              ))}
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <button
                onClick={() => setStep('setup')}
                className="group relative px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-lg rounded-2xl shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-3 mx-auto"
              >
                <Play size={22} className="group-hover:scale-110 transition-transform" />
                Mulai Demo Gratis
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-slate-500 text-xs mt-4">
                Tanpa registrasi • Tanpa kartu kredit • Data auto-reset
              </p>
            </motion.div>
          </div>
        ) : (
          /* Step 2: Business Name Input */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 p-8 md:p-10 shadow-2xl space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <Building2 size={28} className="text-white" />
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                Beri Nama Bisnis Demo Anda
              </h3>
              <p className="text-slate-400 text-sm">
                Ini akan menjadi nama organisasi di dalam sistem ERP.
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                placeholder="cth: PT Maju Sejahtera"
                autoFocus
                className="w-full px-6 py-4 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/30 border border-white/10 rounded-2xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-lg font-bold transition-all"
              />
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2">
                💡 Ketik apapun — ini hanya untuk simulasi demo
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleStart}
                disabled={loading || !businessName.trim()}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-blue-600 text-white font-black text-base rounded-2xl shadow-2xl shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menyiapkan demo Anda...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Masuk ke Dashboard
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                onClick={() => setStep('welcome')}
                className="w-full py-3 text-slate-500 text-sm font-bold hover:text-white transition-colors"
              >
                ← Kembali
              </button>
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex items-start gap-3 text-[10px] text-slate-500 leading-relaxed">
                <Shield size={16} className="shrink-0 text-emerald-500 mt-0.5" />
                <p>
                  <span className="font-bold text-slate-400">Aman & Privat.</span> Semua data demo akan dihapus otomatis 
                  saat Anda logout. Tidak ada data yang tersimpan permanen.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
