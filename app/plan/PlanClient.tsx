'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2, XCircle, Zap,
  Building2, Warehouse, Truck, Edit3, Megaphone,
  Users, Network, GitBranch, Star,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  OPERATOR_GROWTH_ADDON_OPTIONS,
  OPERATOR_MODULE_OPTIONS,
  getOperatorMarketplaceMinCoreFamily,
} from '@/lib/saas/operator-pricing'
import { getSaasCoreFamilyLabel } from '@/lib/saas/module-catalog'

type Package = {
  id: string
  name: string
  price: number
  billing: string
  max_users: number | null
  max_child_orgs: number | null
  max_branches: number | null
}

const PLAN_META: Record<string, {
  tagline: string
  popular?: boolean
  cta: string
  planParam: string
  textColor: string
  badgeBg: string
  activeBg: string
}> = {
  Lite: {
    tagline: 'Untuk bisnis yang baru mulai',
    textColor: 'text-emerald-600',
    badgeBg: 'bg-emerald-500',
    activeBg: 'bg-emerald-50 border-emerald-400',
    cta: 'Mulai dengan Lite →',
    planParam: 'lite',
  },
  Mini: {
    tagline: 'Untuk bisnis yang sudah berkembang',
    textColor: 'text-blue-600',
    badgeBg: 'bg-blue-600',
    activeBg: 'bg-blue-50 border-blue-500',
    popular: true,
    cta: 'Pilih Mini →',
    planParam: 'mini',
  },
  Enterprise: {
    tagline: 'Untuk skala menengah-besar',
    textColor: 'text-[#003366]',
    badgeBg: 'bg-[#003366]',
    activeBg: 'bg-slate-100 border-[#003366]',
    cta: 'Pilih Enterprise →',
    planParam: 'enterprise',
  },
}

const FEATURE_ROWS: { label: string; plans: Record<string, boolean>; note?: string }[] = [
  { label: 'Jualan & Kasir',        plans: { Lite: true,  Mini: true,  Enterprise: true  } },
  { label: 'Data Pelanggan',        plans: { Lite: true,  Mini: true,  Enterprise: true  } },
  { label: 'Laporan Bisnis',        plans: { Lite: true,  Mini: true,  Enterprise: true  } },
  { label: 'Akuntansi & Keuangan',  plans: { Lite: true,  Mini: true,  Enterprise: true  } },
  { label: 'Stok & Pembelian',      plans: { Lite: true,  Mini: true,  Enterprise: true  } },
  { label: 'Syirkah',               plans: { Lite: true,  Mini: true,  Enterprise: true  } },
  { label: 'Karyawan & Penggajian', plans: { Lite: false, Mini: true,  Enterprise: true  } },
  { label: 'Produksi & Manufaktur', plans: { Lite: false, Mini: true,  Enterprise: true  } },
  { label: 'Audit & Kepatuhan',     plans: { Lite: false, Mini: true,  Enterprise: true  } },
  { label: 'Modul Operasional',     plans: { Lite: true,  Mini: true,  Enterprise: true  }, note: 'beli terpisah' },
  { label: 'Add-on',                plans: { Lite: true,  Mini: true,  Enterprise: true  }, note: 'beli terpisah' },
]

const LIMIT_ROWS = [
  { label: 'User',            icon: Users,     key: 'max_users'      },
  { label: 'Anak Perusahaan', icon: Network,   key: 'max_child_orgs' },
  { label: 'Cabang',          icon: GitBranch, key: 'max_branches'   },
]

const GROWTH_LAYER_META: Record<string, { icon: typeof Building2; detail: string }> = {
  addon_fleet:      { icon: Truck,     detail: 'modul operasional / bulan' },
  addon_job_order:  { icon: Edit3,     detail: 'modul operasional / bulan' },
  addon_warehouse:  { icon: Warehouse, detail: 'add-on / bulan' },
  addon_org:        { icon: Building2, detail: 'add-on kapasitas / bulan' },
  addon_sales_page: { icon: Megaphone, detail: 'add-on / bulan' },
}

export default function PlanClient({ packages }: { packages: Package[] }) {
  const normalize = (name: string) =>
    name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()

  const defaultPlan = packages.find(p => PLAN_META[normalize(p.name)]?.popular)?.name
    ?? packages[0]?.name ?? ''
  const [activePlan, setActivePlan] = useState(normalize(defaultPlan))

  const activePkg = packages.find(p => normalize(p.name) === activePlan)
  const activeMeta = activePkg ? PLAN_META[normalize(activePkg.name)] : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">

        {/* Logo */}
        <div className="text-center">
          <Link href="/">
            <span className="text-[#003366] font-black text-2xl tracking-tight">Nizam <span className="font-light">MiniERP</span></span>
          </Link>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20">
            <Zap size={13} className="fill-white" />
            Pilih Paket Terbaik untuk Bisnis Anda
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">
            Satu Sistem,{' '}
            <span className="bg-gradient-to-r from-[#003366] to-blue-600 bg-clip-text text-transparent">
              Semua Terkendali.
            </span>
          </h1>
          <p className="text-slate-500 text-sm md:text-lg max-w-xl mx-auto font-medium">
            Pilih paket yang sesuai dengan tahap bisnis Anda.
          </p>
        </motion.div>

        {/* ── MOBILE: Plan Switcher + Detail ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="md:hidden space-y-4"
        >
          {/* Plan Switcher */}
          <div className="grid grid-cols-3 gap-2">
            {packages.map((pkg) => {
              const n = normalize(pkg.name)
              const meta = PLAN_META[n]
              if (!meta) return null
              const isActive = activePlan === n
              return (
                <button
                  key={pkg.id}
                  onClick={() => setActivePlan(n)}
                  className={cn(
                    'relative flex flex-col items-center py-3 px-2 rounded-2xl border-2 transition-all',
                    isActive ? meta.activeBg : 'bg-white border-slate-200'
                  )}
                >
                  {meta.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                      Populer
                    </span>
                  )}
                  <span className={cn('text-sm font-black', isActive ? meta.textColor : 'text-slate-500')}>{n}</span>
                  <span className={cn('text-[10px] font-black whitespace-nowrap', isActive ? meta.textColor : 'text-slate-400')}>
                    Rp {pkg.price.toLocaleString('id-ID')}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Detail Plan Aktif */}
          {activePkg && activeMeta && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
              {/* Plan Header */}
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className={cn('text-lg font-black', activeMeta.textColor)}>{activePlan}</span>
                    <p className="text-xs text-slate-400 mt-0.5">{activeMeta.tagline}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-lg font-black whitespace-nowrap', activeMeta.textColor)}>
                      Rp {activePkg.price.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-slate-400">/ {activePkg.billing}</p>
                  </div>
                </div>
              </div>

              {/* Fitur */}
              <div className="px-5 py-4 space-y-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Fitur</p>
                {FEATURE_ROWS.map((row) => {
                  const included = row.plans[activePlan] ?? false
                  return (
                    <div key={row.label} className="flex items-center gap-3">
                      {included
                        ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        : <XCircle     size={16} className="text-slate-200 shrink-0" />
                      }
                      <span className={cn('text-sm font-medium', included ? 'text-slate-700' : 'text-slate-300')}>
                        {row.label}
                      </span>
                      {row.note && <span className="text-[9px] text-slate-400 ml-auto">{row.note}</span>}
                    </div>
                  )
                })}
              </div>

              {/* Batas */}
              <div className="px-5 py-4 border-t border-dashed border-slate-100 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Batas</p>
                {LIMIT_ROWS.map(({ label, icon: Icon, key }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Icon size={13} className="text-slate-400" />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <span className="text-sm font-black text-slate-800">
                      {(activePkg as any)[key] ?? '∞'}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="px-5 pb-5">
                <Link
                  href={`/register?plan=${activeMeta.planParam}`}
                  className={cn(
                    'flex items-center justify-center w-full py-4 text-sm font-black rounded-2xl transition-all',
                    activeMeta.popular
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : activePlan === 'Enterprise'
                        ? 'bg-[#003366] text-white shadow-lg shadow-[#003366]/20'
                        : 'bg-slate-900 text-white'
                  )}
                >
                  {activeMeta.cta}
                </Link>
                <p className="text-center text-[10px] text-slate-400 mt-2">Tanpa kartu kredit</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── DESKTOP: Tabel Perbandingan ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="hidden md:block rounded-3xl border border-slate-200 shadow-xl overflow-hidden bg-white"
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="w-2/5 px-8 py-6 text-left align-bottom">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fitur & Batas</p>
                </th>
                {packages.map((pkg) => {
                  const n = normalize(pkg.name)
                  const meta = PLAN_META[n]
                  if (!meta) return null
                  const pricePerUser = pkg.max_users && pkg.max_users > 0
                    ? Math.round(pkg.price / pkg.max_users) : null
                  return (
                    <th key={pkg.id} className={cn('px-5 py-6 text-center align-top relative', meta.popular && 'bg-blue-50/60')}>
                      {meta.popular && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2">
                          <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-[0.18em] px-4 py-1 rounded-b-xl shadow">
                            <Star size={8} className="fill-white" /> Populer
                          </span>
                        </div>
                      )}
                      <div className="mt-5 space-y-1.5">
                        <span className={cn('inline-block px-3 py-1 rounded-full text-xs font-black text-white', meta.badgeBg)}>{n}</span>
                        <p className="text-[10px] text-slate-400 font-medium leading-tight">{meta.tagline}</p>
                        <p className={cn('text-lg font-black whitespace-nowrap', meta.textColor)}>
                          Rp {pkg.price.toLocaleString('id-ID')}
                          <span className="text-xs font-semibold text-slate-400 ml-1">/ {pkg.billing}</span>
                        </p>
                        {pricePerUser && (
                          <p className="text-[10px] text-slate-400 whitespace-nowrap">≈ Rp {pricePerUser.toLocaleString('id-ID')}/user</p>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {/* Fitur */}
              <tr className="bg-slate-50 border-t border-slate-100">
                <td colSpan={4} className="px-8 py-2.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fitur</span>
                </td>
              </tr>
              {FEATURE_ROWS.map((row, idx) => (
                <tr key={row.label} className={cn('border-t border-slate-100 hover:bg-slate-50/60', idx % 2 !== 0 && 'bg-slate-50/30')}>
                  <td className="px-8 py-3.5">
                    <span className="text-sm font-medium text-slate-700">{row.label}</span>
                    {row.note && <span className="ml-2 text-[10px] text-slate-400">{row.note}</span>}
                  </td>
                  {packages.map((pkg) => {
                    const n = normalize(pkg.name)
                    const included = row.plans[n] ?? false
                    return (
                      <td key={pkg.id} className={cn('px-5 py-3.5 text-center', PLAN_META[n]?.popular && 'bg-blue-50/40')}>
                        {included
                          ? <CheckCircle2 size={18} className="mx-auto text-emerald-500" />
                          : <XCircle     size={18} className="mx-auto text-slate-200" />
                        }
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Batas */}
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={4} className="px-8 py-2.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Batas</span>
                </td>
              </tr>
              {LIMIT_ROWS.map(({ label, icon: Icon, key }, idx) => (
                <tr key={key} className={cn('border-t border-slate-100 hover:bg-slate-50/60', idx % 2 !== 0 && 'bg-slate-50/30')}>
                  <td className="px-8 py-3.5">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Icon size={14} className="text-slate-400 shrink-0" />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                  </td>
                  {packages.map((pkg) => {
                    const n = normalize(pkg.name)
                    return (
                      <td key={pkg.id} className={cn('px-5 py-3.5 text-center', PLAN_META[n]?.popular && 'bg-blue-50/40')}>
                        <span className="text-base font-black text-slate-800">{(pkg as any)[key] ?? '∞'}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* CTA Desktop */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="hidden md:grid grid-cols-3 gap-4"
        >
          {packages.map((pkg) => {
            const n = normalize(pkg.name)
            const meta = PLAN_META[n]
            if (!meta) return null
            return (
              <div key={pkg.id} className="flex flex-col items-center gap-2">
                <Link
                  href={`/register?plan=${meta.planParam}`}
                  className={cn(
                    'w-full py-4 text-sm font-black rounded-2xl text-center transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg',
                    meta.popular
                      ? 'bg-blue-600 text-white shadow-blue-500/30 hover:bg-blue-700'
                      : n === 'Enterprise'
                        ? 'bg-[#003366] text-white shadow-[#003366]/20 hover:opacity-90'
                        : 'bg-slate-900 text-white hover:bg-slate-700'
                  )}
                >
                  {meta.cta}
                </Link>
                <p className="text-[10px] text-slate-400 font-medium">Tanpa kartu kredit</p>
              </div>
            )
          })}
        </motion.div>

        {/* Modul Operasional & Add-on */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900 rounded-3xl p-6 md:p-12 text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/20 rounded-full blur-[120px]" />
          <div className="relative z-10 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/20 text-blue-300 rounded-full text-[10px] font-semibold border border-blue-500/30">
                Modul Operasional & Add-on
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">Tambahkan Sesuai Kebutuhan.</h2>
              <p className="text-slate-400 font-medium text-sm max-w-lg">
                Semua paket bisa diperluas. Aktifkan modul atau add-on saat bisnis sudah butuh.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: 'Modul Operasional', items: OPERATOR_MODULE_OPTIONS },
                { title: 'Add-on',            items: OPERATOR_GROWTH_ADDON_OPTIONS },
              ].map((section) => (
                <div key={section.title} className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">{section.title}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {section.items.map((addon) => {
                      const addonMeta = GROWTH_LAYER_META[addon.id] || { icon: Building2, detail: addon.billing.toLowerCase() }
                      const Icon = addonMeta.icon
                      return (
                        <div key={addon.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-colors">
                          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center mb-2">
                            <Icon size={14} className="text-blue-400" />
                          </div>
                          <p className="text-xs font-bold text-slate-300 uppercase tracking-tight leading-tight">{addon.name}</p>
                          {addon.anchorPrice && addon.anchorPrice > addon.price && (
                            <p className="text-[10px] font-bold text-slate-500 line-through">
                              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(addon.anchorPrice)}
                            </p>
                          )}
                          <p className="text-base font-black text-white">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(addon.price)}
                          </p>
                          <p className="text-[10px] text-slate-500 font-semibold">{addonMeta.detail}</p>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mt-1">
                            Min. {getSaasCoreFamilyLabel(getOperatorMarketplaceMinCoreFamily(addon))}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Bottom Note */}
        <div className="text-center space-y-2 pb-4">
          <p className="text-slate-400 text-sm font-medium">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-[#003366] font-black hover:underline">Masuk →</Link>
          </p>
          <p className="text-slate-400 text-sm font-medium">
            Butuh paket khusus?{' '}
            <a
              href="https://wa.me/6281227145000?text=Halo%2C%20saya%20ingin%20konsultasi%20mengenai%20paket%20Nizam%20MiniERP.%20Bisa%20dibantu%3F"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#003366] font-black hover:underline"
            >
              Konsultasikan Kebutuhan Anda →
            </a>
          </p>
        </div>

      </div>
    </div>
  )
}
