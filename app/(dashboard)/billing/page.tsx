'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, CreditCard, History, Package, Plus, CheckCircle2, 
  Building2, Warehouse, Store, Users, ExternalLink, 
  ArrowUpRight, ShieldCheck, AlertCircle, Clock, Truck, Edit3, Coins, Megaphone,
  type LucideIcon
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createBillingInvoice, submitPaymentProof, applyVoucher } from '@/modules/organization/actions/billing.actions'
import { normalizeSaasEntitlementName } from '@/lib/saas/module-catalog'
import { OPERATOR_ADDON_OPTIONS, isAddonSelfServiceEnabled } from '@/lib/saas/operator-pricing'
import { useActiveOrgId } from '@/lib/hooks/useActiveOrgId'

const db = createClient() as any

const BANK_INFO = {
  bank: 'BANK MANDIRI (KCP BANDUNG)',
  account: '1310022339999',
  name: 'PT NIZAM TEKNOLOGI BERKAH'
}

const SUPPORT_INFO = {
  wa: '628123456789',
  label: 'Admin Nizam Support'
}

const ADDON_UI_META: Record<string, { icon: LucideIcon; color: string; benefits: string[] }> = {
  addon_fleet: {
    icon: Truck,
    color: 'amber',
    benefits: ['Maintenance Scheduler', 'Driver Digital Logbooks', 'Fuel Consumption Tracking'],
  },
  addon_job_order: {
    icon: Edit3,
    color: 'emerald',
    benefits: ['Service Progress Tracker', 'Material Usage Breakdown', 'Worker Performance Log'],
  },
  addon_warehouse: {
    icon: Warehouse,
    color: 'emerald',
    benefits: ['Inventory Real-time per Lokasi', 'Surat Jalan Antar Cabang', 'Stok Opname per Area'],
  },
  addon_org: {
    icon: Building2,
    color: 'indigo',
    benefits: ['Konsolidasi Laporan Keuangan', 'NPWP & Branding Terpisah', 'Shared Supplier List'],
  },
  addon_sales_page: {
    icon: Megaphone,
    color: 'blue',
    benefits: ['Template Landing Page', 'Lead Capture Form', 'Integrasi Pipeline Sales'],
  },
}

const AVAILABLE_ADDONS = OPERATOR_ADDON_OPTIONS.map((addon) => ({
  ...addon,
  icon: ADDON_UI_META[addon.id]?.icon || Package,
  color: ADDON_UI_META[addon.id]?.color || 'slate',
  desc: addon.description,
  benefits: ADDON_UI_META[addon.id]?.benefits || [],
}))

const BILLING_MARKETPLACE_ADDONS = AVAILABLE_ADDONS.filter((addon) => isAddonSelfServiceEnabled(addon))

function BillingContent() {
  const searchParams = useSearchParams()
  const pkgId = searchParams.get('pkg')
  const section = searchParams.get('section')
  const { orgId: activeOrgId, loading: activeOrgLoading } = useActiveOrgId()
  
  const [activeOrg, setActiveOrg] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [aiTokenBalance, setAiTokenBalance] = useState(0)
  const [aiTokenPackages, setAiTokenPackages] = useState<any[]>([])

  // SaaS Dynamic Config
  const [bankInfo, setBankInfo] = useState(BANK_INFO)
  const [supportInfo, setSupportInfo] = useState(SUPPORT_INFO)
  
  // Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutInvoice, setCheckoutInvoice] = useState<any>(null)
  const [processing, setProcessing] = useState(false)
  const [timeLeft, setTimeLeft] = useState(900) // 15 mins
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [voucherCode, setVoucherCode] = useState('')
  const [applyingVoucher, setApplyingVoucher] = useState(false)

  // Billing Financial Status
  const [totalMonthly, setTotalMonthly] = useState(0)

  useEffect(() => {
    async function loadConfig() {
      const { data } = await db.from('saas_config').select('*')
      if (data) {
        const config: any = {}
        data.forEach((item: any) => config[item.key] = item.value)
        if (config.bank_info) setBankInfo(config.bank_info)
        if (config.support_info) setSupportInfo(config.support_info)
      }
    }
    loadConfig()
  }, [])

  useEffect(() => {
    if (!showCheckoutModal) return
// ... existing timer logic ...
    const timer = setInterval(() => setTimeLeft((prev: any) => prev > 0 ? prev - 1 : 0), 1000)
    return () => clearInterval(timer)
  }, [showCheckoutModal])

  useEffect(() => {
    if (loading || section !== 'ai-token') return
    const timer = window.setTimeout(() => {
      document.getElementById('ai-token')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [loading, section])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleBuyItem = async (org: any, item: any) => {
    if (!org?.id) {
      alert('Organisasi aktif tidak ditemukan.')
      return
    }

    if (item.type === 'PACKAGE' && org.parent_org_id) {
      alert('Paket SaaS child mengikuti holding. Upgrade paket dilakukan dari organisasi induk.')
      return
    }

    setProcessing(true)
    try {
      const res = await createBillingInvoice(org.id, item)
      if (res.success) {
        setCheckoutInvoice({
          id: res.id,
          invoice_number: res.invoiceNumber,
          amount: res.amount,
          status: 'UNPAID'
        })
        setTimeLeft(900)
        setShowCheckoutModal(true)
        
        const { data: invs } = await db.from('saas_invoices')
          .select('*')
          .eq('org_id', org.id)
          .order('created_at', { ascending: false })
        setInvoices(invs || [])
      } else {
        alert('Gagal membuat tagihan: ' + (res as any).error)
      }
    } catch (err: any) {
      alert('Sistem Error: ' + err.message)
    }
    setProcessing(false)
  }

  useEffect(() => {
    async function loadData() {
      if (activeOrgLoading) return

      setLoading(true)
      const { data: tokenPackages } = await db
        .from('ai_token_topup_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('tokens', { ascending: true })

      setAiTokenPackages(tokenPackages || [])

      if (!activeOrgId) {
        setActiveOrg(null)
        setInvoices([])
        setAiTokenBalance(0)
        setTotalMonthly(0)
        setLoading(false)
        return
      }

      const [{ data: org }, { data: pkgs }, { data: walletData }, { data: invs }] = await Promise.all([
        db.from('organizations').select('*').eq('id', activeOrgId).maybeSingle(),
        db.from('saas_packages').select('*'),
        db.from('ai_token_wallets').select('balance_tokens').eq('org_id', activeOrgId).maybeSingle(),
        db.from('saas_invoices').select('*').eq('org_id', activeOrgId).order('created_at', { ascending: false }),
      ])

      if (org) {
        setActiveOrg(org)
        setAiTokenBalance(Number(walletData?.balance_tokens || 0))

        const planPkg = pkgs?.find((p: any) => p.name === org.settings?.plan)
        let total = planPkg?.price || 0

        const activeAddons = Array.isArray(org.active_addons) ? org.active_addons : []
        activeAddons.forEach((a: any) => {
          const addonName = normalizeSaasEntitlementName(String(a?.name || ''))
          const addonPrice = AVAILABLE_ADDONS.find((ma) => ma.name === addonName)?.price || 0
          total += addonPrice
        })
        setTotalMonthly(total)

        if (pkgId) {
          const pkg = pkgs?.find((p: any) => p.id === pkgId)
          if (pkg) {
            handleBuyItem(org, { id: pkg.id, name: pkg.name, price: pkg.price, type: 'PACKAGE' })
          }
        }
      } else {
        setActiveOrg(null)
        setAiTokenBalance(0)
        setTotalMonthly(0)
      }

      setInvoices(invs || [])
      setLoading(false)
    }
    loadData()
  }, [pkgId, activeOrgId, activeOrgLoading])

  const openCheckout = (inv: any) => {
    if (activeOrg?.parent_org_id && inv?.package_id) {
      alert('Invoice paket untuk child dikelola dari organisasi induk/holding.')
      return
    }

    setCheckoutInvoice(inv)
    setTimeLeft(900)
    setShowCheckoutModal(true)
  }

  const handleManualPayment = async () => {
    if (!activeOrg || !checkoutInvoice || !proofFile) {
       return alert('Silakan unggah bukti transfer terlebih dahulu.')
    }
    
    setProcessing(true)
    try {
      const fileExt = proofFile.name.split('.').pop()
      const fileName = `${checkoutInvoice.invoice_number}-${Date.now()}.${fileExt}`
      const { data: uploadData, error: uploadErr } = await db.storage
        .from('billing-proofs')
        .upload(fileName, proofFile)
      
      if (uploadErr) throw uploadErr

      const proofUrl = db.storage.from('billing-proofs').getPublicUrl(fileName).data.publicUrl

      const res = await submitPaymentProof(activeOrg.id, checkoutInvoice.id, proofUrl, 'BANK_TRANSFER')
      if (res.success) {
        alert('BUKTI TERUNGGAH! Pembayaran Anda sedang diverifikasi admin. Paket akan aktif otomatis setelah disetujui.')
        setShowCheckoutModal(false)
        window.location.reload()
      } else {
        alert('Gagal: ' + (res as any).error)
      }
    } catch (err: any) {
      alert('Gagal upload: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleApplyVoucher = async () => {
    if (!activeOrg || !voucherCode) return alert('Silakan masukkan kode voucher.')
    if (activeOrg.parent_org_id) {
      return alert('Voucher paket child harus diapply dari organisasi induk/holding.')
    }
    
    setApplyingVoucher(true)
    try {
      const res = await applyVoucher(activeOrg.id, voucherCode)
      if (res.success) {
        alert(res.message || 'Voucher Berhasil Di-apply!')
        window.location.reload()
      } else {
        alert('Gagal: ' + (res as any).error)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setApplyingVoucher(false)
    }
  }

  if (loading) return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Memuat Data Billing...</div>

  const inheritsPlanFromHolding = Boolean(activeOrg?.parent_org_id)
  const inheritedPlanNotice = 'Paket inti mengikuti organisasi induk. Upgrade paket dan voucher dikelola dari holding.'

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckoutModal && checkoutInvoice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !processing && setShowCheckoutModal(false)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden ring-1 ring-slate-200">
               <div className="p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-rose-500 font-black text-sm uppercase tracking-widest bg-rose-50 py-2 rounded-2xl border border-rose-100 mb-6">
                      <Clock size={16} /> Selesaikan Dalam: {formatTime(timeLeft)}
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter">Instruksi Pembayaran</h3>
                    <p className="text-slate-400 font-bold text-xs">Simpan / Screenshot tagihan Anda.</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Invoice</p>
                      <p className="text-sm font-black text-slate-900">#{checkoutInvoice.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                      <p className="text-md font-black text-indigo-600 font-mono italic">{formatRupiah(checkoutInvoice.amount)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-indigo-600 rounded-3xl p-6 text-white space-y-2 relative overflow-hidden group shadow-xl">
                       <div className="absolute top-0 right-0 p-4 opacity-20"><CreditCard size={64} /></div>
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{bankInfo.bank}</p>
                       <p className="text-2xl font-black font-mono tracking-widest">{bankInfo.account}</p>
                       <p className="text-[10px] font-bold uppercase opacity-70">a.n {bankInfo.name}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-200 rounded-[32px] p-6 text-center group hover:border-indigo-400 hover:bg-indigo-50/30 transition-all relative">
                       <input 
                         type="file" 
                         id="proof-upload" 
                         className="hidden" 
                         accept="image/*,application/pdf"
                         onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                       />
                       <label htmlFor="proof-upload" className="cursor-pointer block space-y-2">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                             <ArrowUpRight size={24} className="rotate-45" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                                {proofFile ? proofFile.name : 'Upload Bukti Transfer'}
                             </p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Image or PDF (Max 5MB)</p>
                          </div>
                       </label>
                    </div>

                    <button disabled={processing || !proofFile} onClick={handleManualPayment} className="w-full py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl hover:bg-emerald-600 transition-all shadow-lg active:scale-95 disabled:opacity-50">
                      {processing ? 'Uploading...' : 'Konfirmasi Pembayaran →'}
                    </button>
                    <Link href={`https://wa.me/${supportInfo.wa}`} target="_blank" className="block w-full py-2.5 text-slate-400 font-black text-[9px] uppercase tracking-widest text-center hover:text-slate-900 transition-all">
                       Bantuan Support? Hubungi Kami
                    </Link>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header & Status Langganan */}
      <section className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-50/50 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px]" />
        
        <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center gap-12">
          <div className="w-64 h-64 rounded-[48px] bg-slate-900 flex flex-col items-center justify-center text-white relative shadow-2xl overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <Zap size={48} className="text-amber-400 fill-amber-400/20 mb-4 animate-bounce" />
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">PAKET ANDA</p>
             <h2 className="text-3xl font-black tracking-tighter uppercase">{activeOrg?.settings?.plan || 'Free'}</h2>
             {inheritsPlanFromHolding && (
               <div className="mt-2 px-3 py-1 bg-sky-500/15 border border-sky-400/30 rounded-full text-[9px] font-black text-sky-200 uppercase tracking-widest">
                 MENGIKUTI HOLDING
               </div>
             )}
             {activeOrg?.settings?.is_demo && (
               <div className="mt-2 px-3 py-1 bg-amber-500/20 border border-amber-500/50 rounded-full text-[9px] font-black text-amber-500 uppercase tracking-widest">
                 SESI DEMO
               </div>
             )}
          </div>

          <div className="flex-1 space-y-8">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3 mb-2">
                   <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">NIZAM <span className="text-indigo-600">ERP</span></h1>
                   <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-full border border-emerald-100">SYSTEM ACTIVE</div>
                </div>
                <p className="text-slate-500 font-bold leading-relaxed max-w-xl">
                  Kelola infrastruktur operasional Anda. Tambah kekuatan sistem sesuai skala bisnis Anda tanpa biaya tersembunyi.
                </p>
              </div>

              {/* Tagihan Rutin Per Bulan */}
              <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl border border-white/10 relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 to-transparent opacity-50" />
                 <div className="relative z-10 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Tagihan Rutin Per Bulan</p>
                    <div className="flex items-baseline gap-2">
                       <h3 className="text-3xl font-black font-mono tracking-tighter italic">{formatRupiah(totalMonthly)}</h3>
                       <p className="text-xs font-bold text-slate-400 text-right">/bln</p>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-t border-white/5 pt-2">
                       Include Plan & {activeOrg?.active_addons?.length || 0} Addons
                    </p>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <UsageMetric icon={Building2} label="Entitas Bisnis" current={1} max={activeOrg?.package_limit?.max_orgs || 1} unit="Org" />
               <UsageMetric icon={Warehouse} label="Gudang / WMS" current={1} max={activeOrg?.package_limit?.max_warehouses || 3} unit="Loc" />
               <UsageMetric icon={Users} label="Team Members" current={1} max={activeOrg?.package_limit?.max_users || 10} unit="Staff" />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6 pt-4 w-full">
               {inheritsPlanFromHolding ? (
                 <div className="w-full rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Paket Mengikuti Holding</p>
                    <p className="mt-2 text-sm font-bold text-amber-900 leading-relaxed">
                      {inheritedPlanNotice}
                    </p>
                 </div>
               ) : (
                 <>
                   <div className="flex items-center gap-4">
                      <Link href="/pricing" className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black text-sm rounded-2xl hover:bg-slate-900 transition-all shadow-lg shadow-indigo-200">
                        <Package size={18} /> Upgrade Paket Utama
                      </Link>
                      <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black text-sm rounded-2xl hover:bg-slate-50 transition-all">
                        <CreditCard size={18} /> Update Payment Method
                      </button>
                   </div>

                   <div className="h-10 w-px bg-slate-200 hidden md:block" />

                   <div className="flex-1 flex items-center gap-2 w-full md:w-auto">
                      <div className="relative flex-1">
                        <input 
                          type="text" 
                          placeholder="Punya Voucher? Contoh: ABS2024"
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                        {voucherCode && (
                           <div className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600 animate-pulse">
                              <Plus size={14} />
                           </div>
                        )}
                      </div>
                      <button 
                        disabled={applyingVoucher || !voucherCode}
                        onClick={handleApplyVoucher}
                        className="px-6 py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-600 transition-all disabled:opacity-50 shadow-xl"
                      >
                        {applyingVoucher ? 'Wait...' : 'Apply →'}
                      </button>
                   </div>
                 </>
               )}
            </div>
          </div>
        </div>
      </section>

      {/* Add-on Marketplace */}
      <section className="space-y-8">
        <div className="text-center space-y-3">
           <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
             🔥 Power-Up Your System
           </div>
           <h2 className="text-4xl font-black text-slate-900 tracking-tighter">NIZAM Power-Ups (Add-Ons)</h2>
           <p className="text-slate-400 font-bold">Butuh sirkulasi lebih lebar? Tambah slot spesifik tanpa harus ganti seluruh paket.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {BILLING_MARKETPLACE_ADDONS.map((addon) => (
            <div key={addon.id} className="bg-white rounded-[32px] border border-slate-100 p-6 flex flex-col transition-all hover:-translate-y-2 hover:shadow-2xl hover:border-indigo-100 group">
              <div className={`w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner`}>
                <addon.icon size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">{addon.name}</h3>
              <p className="text-xs font-bold text-slate-500 leading-relaxed mb-6">
                {addon.desc}
              </p>
              
              <div className="space-y-3 mb-8 flex-1">
                {addon.benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{b}</span>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-slate-50">
                 <div className="flex items-baseline justify-between mb-4">
                    <p className="text-xl font-black text-slate-900">{formatRupiah(addon.price)}</p>
                    <p className="text-[10px] font-bold text-slate-400">/{addon.billing}</p>
                 </div>
                 <button 
                  disabled={processing}
                  onClick={() => activeOrg && handleBuyItem(activeOrg, { id: addon.id, name: addon.name, price: addon.price, type: 'ADDON' })}
                  className="w-full py-3 bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-900 hover:text-white transition-all group-hover:bg-indigo-600 group-hover:text-white shadow-sm disabled:opacity-50"
                 >
                   {processing ? 'Processing...' : 'Aktivasi Add-On'}
                 </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Token Topup */}
      <section id="ai-token" className="space-y-8">
        <div className="flex flex-col gap-3 text-center">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 mx-auto">
            <Coins size={12} /> AI Token Economy
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Top Up Token AI</h2>
          <p className="text-slate-500 font-bold">Saldo token digunakan untuk generator AI seperti Sales Page. Saat habis, Anda bisa top up kapan saja.</p>
        </div>

        <div className="bg-white rounded-[36px] border border-slate-100 p-6 md:p-8 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Saldo Token AI Saat Ini</p>
              <p className="mt-2 text-4xl font-black tracking-tighter text-slate-900">{aiTokenBalance.toLocaleString('id-ID')}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estimasi Generate</p>
              <p className="mt-1 text-lg font-black text-slate-900">{Math.floor(aiTokenBalance / 4000).toLocaleString('id-ID')}x generate</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {aiTokenPackages.map((pkg: any) => (
            <div key={pkg.id} className="bg-white rounded-[32px] border border-slate-100 p-6 flex flex-col transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-center justify-between">
                <div className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                  {pkg.name}
                </div>
                <Coins size={18} className="text-indigo-400" />
              </div>
              <p className="mt-4 text-4xl font-black tracking-tighter text-slate-900">{Number(pkg.tokens || 0).toLocaleString('id-ID')}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Token</p>
              <p className="mt-4 text-xs font-bold text-slate-500 leading-relaxed">{pkg.description || 'Tambahan saldo token AI untuk kebutuhan generate konten.'}</p>
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Harga</p>
                  <p className="text-xl font-black text-slate-900">{formatRupiah(Number(pkg.price_idr || 0))}</p>
                </div>
                <button
                  disabled={processing || !activeOrg}
                  onClick={() => activeOrg && handleBuyItem(activeOrg, {
                    id: pkg.id,
                    name: pkg.name,
                    price: Number(pkg.price_idr || 0),
                    type: 'AI_TOKEN_TOPUP',
                    topupPackageId: pkg.id,
                    tokens: Number(pkg.tokens || 0),
                  })}
                  className="px-5 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 transition-all disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Top Up'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* History Penagihan */}
      <section className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-slate-100 rounded-xl">
               <History size={18} className="text-slate-600" />
             </div>
             <div>
               <h3 className="text-lg font-black text-slate-900 tracking-tight">Riwayat Penagihan & Invoice</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audit log pembayaran paket SaaS</p>
             </div>
          </div>
          <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1">
            Lihat Semua <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">No Invoice</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Paket / Item</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tgl Terbit</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Nilai Tagihan</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoices.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-bold text-xs uppercase italic">Belum ada riwayat tagihan.</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-4">
                      <Link href={`/billing/invoice/${inv.id}`} className="flex items-center gap-1">
                         <span className="text-xs font-black text-slate-900 tracking-tighter hover:text-blue-600 transition-colors">#{inv.invoice_number}</span>
                      </Link>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-indigo-400" />
                        <span className="text-xs font-bold text-slate-600 italic">{inv.item_name || 'Paket NIZAM'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-400">
                      {new Date(inv.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="text-xs font-black text-slate-900 font-mono tracking-tighter">{formatRupiah(inv.amount)}</span>
                    </td>
                    <td className="px-8 py-4 text-center">
                       <div className="flex flex-col items-center gap-1.5">
                          <SubscriptionStatus status={inv.status} />
                          {inv.status === 'UNPAID' && (
                             inheritsPlanFromHolding && inv.package_id ? (
                               <span className="text-[9px] font-black text-amber-600 uppercase tracking-[0.1em]">
                                 Kelola via Holding
                               </span>
                             ) : (
                               <button 
                                 onClick={() => openCheckout(inv)}
                                 className="text-[9px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-[0.1em] flex items-center gap-1 animate-pulse"
                               >
                                 <CreditCard size={10} /> Bayar Sekarang
                               </button>
                             )
                          )}
                       </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                       <Link href={`/billing/invoice/${inv.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                          Lihat Invoice
                       </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function UsageMetric({ icon: Icon, label, current, max, unit }: any) {
  const percentage = Math.min((current / max) * 100, 100)
  return (
    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
       <div className="flex items-center justify-between">
         <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
           <Icon size={16} className="text-indigo-600" />
         </div>
         <span className="text-[10px] font-black text-slate-900 uppercase italic tracking-tighter">{current} / {max} {unit}</span>
       </div>
       <div className="space-y-1">
         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
         <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
           <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className={`h-full rounded-full ${percentage > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
         </div>
       </div>
    </div>
  )
}

function SubscriptionStatus({ status }: { status: string }) {
  const colors: any = { PAID: 'bg-emerald-50 text-emerald-600 border-emerald-100', UNPAID: 'bg-amber-50 text-amber-600 border-amber-100', EXPIRED: 'bg-rose-50 text-rose-600 border-rose-100' }
  return (
    <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[status] || 'bg-slate-50'}`}>
      {status}
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">Loading Billing System...</div>}>
      <BillingContent />
    </Suspense>
  )
}
