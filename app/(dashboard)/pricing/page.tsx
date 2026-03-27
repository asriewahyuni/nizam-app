'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Zap, Crown, Shield, Package, ArrowRight, Loader2 } from 'lucide-react'
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

              {/* Body: Modules */}
              <div className="flex-1 bg-white p-6 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modul Termasuk</p>
                <ul className="space-y-2">
                  {pkg.modules?.slice(0, 8).map((mod: string) => (
                    <li key={mod} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      {mod}
                    </li>
                  ))}
                  {pkg.modules?.length > 8 && (
                    <li className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-5">
                      +{pkg.modules.length - 8} modul lainnya
                    </li>
                  )}
                  {(!pkg.modules || pkg.modules.length === 0) && (
                    <li className="text-sm text-slate-400 italic">Paket standar</li>
                  )}
                </ul>
              </div>

              {/* CTA */}
              <div className="bg-white px-6 pb-6">
                {isCurrentPlan ? (
                  <div className="w-full py-3 text-center text-sm font-black text-[#003366] bg-[#003366]/5 rounded-2xl border border-[#003366]/20">
                    ✓ Paket Anda Saat Ini
                  </div>
                ) : (
                  <Link
                    href="/settings/business"
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
                       'Hubungi Tim Kami →'}
                    </span>
                  </Link>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Bottom Note */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center">
        <p className="text-slate-400 text-sm font-medium">
          Butuh paket khusus atau enterprise custom?{' '}
          <Link href="/settings/business" className="text-[#003366] font-black hover:underline">
            Hubungi tim kami →
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
