'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Zap, Crown, Shield, Package, ArrowRight, Loader2, Building2, Store, Users, Warehouse } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const db = createClient() as any

const PLAN_ICON: Record<string, any> = {
  Trial: Shield,
  Demo: Zap,
  Basic: Package,
  Pro: Crown,
  Enterprise: Crown,
}

const PLAN_GRADIENT: Record<string, string> = {
  Trial: 'from-slate-500 to-slate-700',
  Demo: 'from-orange-500 to-amber-600',
  Basic: 'from-blue-500 to-blue-700',
  Pro: 'from-indigo-500 to-purple-700',
  Enterprise: 'from-[#003366] to-indigo-800',
}

export default function PricingPage() {
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      // Fetch packages
      const { data: pkgs } = await db.from('saas_packages').select('*').eq('is_active', true).order('price', { ascending: true })
      if (pkgs) {
        setPackages(pkgs.map((p: any) => ({
          ...p,
          modules: Array.isArray(p.modules) ? p.modules : JSON.parse(p.modules || '[]')
        })))
      }

      // Fetch current org plan
      const { data: { user } } = await db.auth.getUser()
      if (user) {
        const { data: member } = await db.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
        if (member?.org_id) {
          const { data: org } = await db.from('organizations').select('settings').eq('id', member.org_id).maybeSingle()
          setCurrentPlan(org?.settings?.plan || '')
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="animate-spin text-slate-400" size={32} />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-12">
      {/* Header Ala Hormozi */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-6 py-2 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20">
          <Zap size={14} className="fill-white" />
          The NIZAM Grand Slam Offer: Solusi Bisnis Tanpa Drama
        </div>
        <h1 className="text-6xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none">
          Hentikan Kebocoran Kas, <br />
          <span className="bg-gradient-to-r from-[#003366] to-blue-600 bg-clip-text text-transparent">Kuasai Operasional Anda.</span>
        </h1>
        <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto font-bold leading-relaxed">
          Jangan biarkan bisnis Anda berjalan di atas tebak-tebakan. Satu sistem, satu kebenaran — <span className="text-slate-900">pilih langkah kemenangan Anda hari ini.</span>
        </p>
      </motion.div>

      {/* Pricing Cards */}
      <div className={`grid gap-6 ${packages.length <= 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' : packages.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        {packages.map((pkg, i) => {
          const isEnterprise = pkg.name === 'Enterprise' || pkg.name === 'Pro'
          const isCurrentPlan = currentPlan === pkg.name
          const Icon = PLAN_ICON[pkg.name] || Package
          const gradient = PLAN_GRADIENT[pkg.name] || 'from-slate-600 to-slate-800'

          return (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col rounded-[32px] border overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl
                ${isEnterprise ? 'border-[#003366]/30 shadow-xl shadow-[#003366]/10' : 'border-slate-200 shadow-md'}
                ${isCurrentPlan ? 'ring-2 ring-[#003366] ring-offset-2' : ''}
              `}
            >
              {/* Top Gradient Header */}
              <div className={`bg-gradient-to-br ${gradient} p-6 text-white`}>
                {isCurrentPlan && (
                  <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/20">
                    Paket Aktif
                  </div>
                )}
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4">
                  <Icon size={24} className={isEnterprise ? 'text-amber-300' : 'text-white'} />
                </div>
                <h3 className="text-2xl font-black tracking-tight">{pkg.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-black font-mono">
                    {pkg.price === 0 ? 'Gratis' : `Rp ${pkg.price.toLocaleString('id-ID')}`}
                  </span>
                  {pkg.price > 0 && <span className="text-white/60 text-sm font-bold">/{pkg.billing}</span>}
                </div>
                {pkg.duration_days && (
                  <p className="text-[10px] text-white/60 font-bold mt-1 uppercase tracking-wider">
                    Durasi: {pkg.duration_days} Hari
                  </p>
                )}
              </div>

              {/* Body: Batas Operasional & Seluruh Modul */}
              <div className="flex-1 bg-white p-6 space-y-6 flex flex-col border-t border-slate-100">
                {/* Section: Limits */}
                <div className="grid grid-cols-2 gap-3 pb-5 border-b border-dashed border-slate-200">
                  <div className="flex flex-col gap-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Entitas</p>
                    <div className="flex items-center gap-1.5 text-slate-900">
                      <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                        <Building2 size={12} className="text-emerald-600" />
                      </div>
                      <span className="text-xs font-black italic tracking-tight leading-none">Maks. {pkg.max_orgs}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 border-l border-slate-100 pl-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Gudang/WMS</p>
                    <div className="flex items-center gap-1.5 text-slate-900">
                      <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                        <Warehouse size={12} className="text-emerald-600" />
                      </div>
                      <span className="text-xs font-black italic tracking-tight leading-none">Maks. {pkg.max_warehouses}</span>
                    </div>
                  </div>
                </div>

                {/* Section: FULL Modules Grid */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-1">Paket Fitur Lengkap:</p>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                    {pkg.modules?.map((mod: string) => (
                      <div key={mod} className="flex items-center gap-2 group">
                        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 rotate-12 transition-transform group-hover:rotate-0">
                          <CheckCircle2 size={10} className="text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors uppercase tracking-tight leading-tight">{mod}</span>
                      </div>
                    ))}
                    {(!pkg.modules || pkg.modules.length === 0) && (
                      <div className="col-span-2 text-xs text-slate-400 italic">Fitur Standar Terintegrasi</div>
                    )}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="bg-white px-6 pb-6">
                {isCurrentPlan ? (
                  <Link 
                    href="/billing"
                    className="group flex items-center justify-center w-full py-4 text-center text-sm font-black text-[#003366] bg-[#003366]/5 rounded-2xl border border-[#003366]/20 hover:bg-[#003366] hover:text-white transition-all shadow-sm"
                  >
                    <CheckCircle2 size={16} className="mr-2" /> Kelola Plan Aktif →
                  </Link>
                ) : (
                  <Link
                    href={`/billing?pkg=${pkg.id}`}
                    className={`group flex items-center justify-center text-center px-4 py-4 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
                      ${isEnterprise
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-orange-500/40'
                        : pkg.name === 'Trial' 
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }
                    `}
                  >
                    <span className="text-xs font-black leading-tight tracking-tight">
                      {pkg.name === 'Trial' ? 'Mulai Langkah Berkah Sekarang →' : 
                       pkg.name === 'Basic' ? 'Dapatkan Akses Operasional →' :
                       isEnterprise ? 'Dapatkan Full Power Expansion →' :
                       'Pilih Paket Ini →'}
                    </span>
                  </Link>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Add-ons Section ala Hormozi */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-slate-900 rounded-[40px] p-8 md:p-12 text-white relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px]" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
              Power-ups & Add-ons
            </div>
            <h2 className="text-4xl font-black tracking-tighter">Butuh Kekuatan Lebih? <br />Tambah Sesuai Kebutuhan.</h2>
            <p className="text-slate-400 font-bold max-w-lg">
              Bayar hanya yang Anda gunakan. Bebas tambah cabang atau perangkat POS kapan saja tanpa harus upgrade paket utama.
            </p>
          </div>

          <div className="w-full md:w-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Building2, label: 'Tambah Bisnis Baru', price: 'Rp 249rb', detail: 'per entitas baru / bulan' },
              { icon: Warehouse, label: 'Tambah Lokasi (WMS)', price: 'Rp 149rb', detail: 'per gudang / cabang / bulan' },
              { icon: Store, label: 'Mesin POS Tambahan', price: 'Rp 99rb', detail: 'per perangkat / bulan' },
              { icon: Users, label: 'Staff Unlimited', price: 'GRATIS', detail: 'di semua paket' },
            ].map((addon, i) => {
              const Icon = addon.icon
              return (
                <div key={i} className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-3 hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Icon size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{addon.label}</p>
                    <p className="text-xl font-black text-white">{addon.price}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{addon.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </motion.div>

      {/* Bottom Note */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-center">
        <p className="text-slate-400 text-sm font-medium">
          Butuh paket khusus atau enterprise custom?{' '}
          <Link href="/settings/business" className="text-[#003366] font-black hover:underline">
            Konsultasikan Kebutuhan Anda Sekarang →
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
