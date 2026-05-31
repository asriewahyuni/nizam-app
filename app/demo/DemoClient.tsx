'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useFormStatus } from 'react-dom'
import { Play, Sparkles, Building2, ArrowRight, Zap, Shield, BarChart3, Package, Factory, Users, Utensils, Store, Truck, Laptop, type LucideIcon } from 'lucide-react'
import { startDemoSessionFromForm, type DemoBusinessType } from '@/modules/demo/actions/demo.actions'
import { MiniErpWordmark } from '@/components/shared/MiniErpWordmark'

const BUSINESS_TYPES: { id: DemoBusinessType; label: string; icon: LucideIcon; description: string; color: string }[] = [
  { 
    id: 'CATERING', 
    label: 'Katering', 
    icon: Utensils, 
    description: 'Manajemen bahan baku dapur, inventory box, dan layanan prasmanan.',
    color: 'from-orange-500 to-red-600'
  },
  { 
    id: 'RESTAURANT', 
    label: 'Rumah Makan', 
    icon: Store, 
    description: 'Ideal untuk resto/warung dengan stok harian dan penjualan porsian.',
    color: 'from-emerald-500 to-teal-600'
  },
  { 
    id: 'SUPPLIER_MBG', 
    label: 'Supplier MBG', 
    icon: Truck, 
    description: 'Khusus program Makan Bergizi Gratis: Logistik, Susu, dan Paket Sekolah.',
    color: 'from-blue-500 to-indigo-600'
  },
  { 
    id: 'COMPUTER', 
    label: 'Umum / Manufaktur', 
    icon: Laptop, 
    description: 'Simulasi perakitan (PC Assembly) dan inventori barang elektronik.',
    color: 'from-slate-600 to-slate-800'
  },
  { 
    id: 'BLANK', 
    label: 'Kosongan (Budget Dasar)', 
    icon: Building2, 
    description: 'Minim data operasional, tetapi sudah ada CoA dan dummy budgeting untuk eksplorasi modul anggaran.',
    color: 'from-slate-400 to-slate-600'
  },
]

export default function DemoClient() {
  const [businessName, setBusinessName] = useState('')
  const [selectedType, setSelectedType] = useState<DemoBusinessType>('CATERING')
  const [step, setStep] = useState<'welcome' | 'setup'>('welcome')

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
        className="relative z-10 w-full max-w-2xl"
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
                <MiniErpWordmark className="text-[10px] font-bold tracking-[0.3em] uppercase text-blue-400" suffix=" Demo" />
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
              <button type="button"
                onClick={() => setStep('setup')}
                className="group relative px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-lg rounded-2xl shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-3 mx-auto"
              >
                <Play size={22} className="group-hover:scale-110 transition-transform" />
                Mulai Demo Gratis
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-slate-500 text-xs mt-4 uppercase tracking-widest font-black">
                Akses Instan • Reset Otomatis • Data Sample
              </p>
            </motion.div>
          </div>
        ) : (
          /* Step 2: Selection & Business Name Input */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/5 backdrop-blur-xl rounded-[32px] border border-white/10 p-8 md:p-10 shadow-2xl space-y-8"
          >
            <form action={startDemoSessionFromForm} className="space-y-8">
              <input type="hidden" name="demoType" value={selectedType} />

              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-white tracking-tight">
                  Pilih Tipe Bisnis Demo
                </h3>
                <p className="text-slate-400 text-sm">
                  Data sampel akan disesuaikan dengan tipe bisnis yang Anda pilih.
                </p>
              </div>

              {/* Business Type Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {BUSINESS_TYPES.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSelectedType(type.id)}
                      className={`relative p-4 rounded-2xl border transition-all duration-300 text-left group ${
                        selectedType === type.id
                          ? 'bg-white/10 border-blue-500/50 ring-1 ring-blue-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex gap-4 items-start">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center shrink-0 shadow-lg`}>
                          <Icon size={24} className="text-white" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors uppercase text-xs tracking-widest">{type.label}</h4>
                          <p className="text-slate-400 text-[10px] leading-relaxed">
                            {type.description}
                          </p>
                        </div>
                      </div>
                      {selectedType === type.id && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <Sparkles size={10} className="text-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2">
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2">
                  Nama Organisasi (Opsional)
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="cth: Catering Berkah Jaya"
                  autoFocus
                  className="w-full px-6 py-4 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/30 border border-white/10 rounded-2xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-lg font-bold transition-all"
                />
              </div>

              <div className="space-y-3">
                <StartDemoButton selectedType={selectedType} />

                <button
                  type="button"
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
                    saat Anda logout. Tidak ada data yang tersimpan permanen di cloud kami.
                  </p>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

function StartDemoButton({ selectedType }: { selectedType: DemoBusinessType }) {
  const { pending } = useFormStatus()
  const activeBusinessType = BUSINESS_TYPES.find((item) => item.id === selectedType)

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-blue-600 text-white font-black text-base rounded-2xl shadow-2xl shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3"
    >
      {pending ? (
        <>
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Menyiapkan data {activeBusinessType?.label}...
        </>
      ) : (
        <>
          <Sparkles size={20} />
          Mulai Demo Sekarang
          <ArrowRight size={18} />
        </>
      )}
    </button>
  )
}
