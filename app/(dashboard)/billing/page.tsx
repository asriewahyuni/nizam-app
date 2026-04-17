'use client'

import React, { useState, useEffect, Suspense, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, CreditCard, History, Package, Plus, CheckCircle2,
  Building2, Warehouse, Users,
  ArrowUpRight, AlertCircle, Clock, Truck, Edit3, Coins, Megaphone,
  Copy, Check, Layers3, ShieldCheck, ShoppingCart,
  type LucideIcon
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createBillingInvoice, submitPaymentProof, applyVoucher } from '@/modules/organization/actions/billing.actions'
import {
  getSaasCoreFamilyLabel,
  getSaasPackageArchitecture,
  normalizeSaasEntitlementList,
  normalizeSaasEntitlementName,
} from '@/lib/saas/module-catalog'
import {
  OPERATOR_ADDON_OPTIONS,
  OPERATOR_GROWTH_ADDON_OPTIONS,
  OPERATOR_MODULE_OPTIONS,
  getOperatorMarketplaceCompatibility,
  getOperatorMarketplaceLabel,
  getOperatorMarketplaceMinCoreFamily,
  isAddonSelfServiceEnabled,
} from '@/lib/saas/operator-pricing'
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

const PLAN_UI_META: Record<string, { eyebrow: string; summary: string }> = {
  Trial: {
    eyebrow: 'Coba dulu tanpa berat di biaya awal',
    summary: 'Pintu masuk ringan untuk eksplorasi alur dasar sebelum naik ke paket bulanan.',
  },
  Lite: {
    eyebrow: 'Mulai rapi tanpa ribet',
    summary: 'Paling pas untuk bisnis yang ingin penjualan, kasir, pelanggan, dan laporan inti berjalan dalam satu alur ringan.',
  },
  Basic: {
    eyebrow: 'Naik kelas ke operasional yang lebih tertib',
    summary: 'Untuk bisnis yang sudah butuh accounting, finance, inventory, dan purchasing tanpa loncat ke sistem terlalu berat.',
  },
  Pro: {
    eyebrow: 'Full core untuk tim yang sudah serius bertumbuh',
    summary: 'Cocok saat HRIS, manufacturing, dan audit mulai jadi kebutuhan operasional harian.',
  },
  Enterprise: {
    eyebrow: 'Untuk skala besar dan kontrol yang lebih luas',
    summary: 'Paling cocok untuk organisasi yang butuh ruang tumbuh lebih besar, governance lebih rapi, dan ekspansi berlapis.',
  },
  'ABS Special': {
    eyebrow: 'Paket khusus untuk kebutuhan operasional tertentu',
    summary: 'Starter core plus kombinasi HRIS dan warehouse untuk use case yang lebih spesifik.',
  },
}

type BillingItemType = 'PACKAGE' | 'ADDON' | 'AI_TOKEN_TOPUP'

type BillingCheckoutItem = {
  id: string
  name: string
  price: number
  type: BillingItemType
  billing: string
  label: string
  description: string
  note: string
  topupPackageId?: string
  tokens?: number
}

type FlashMessage = {
  tone: 'success' | 'error' | 'info'
  text: string
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

const BILLING_MARKETPLACE_MODULES = AVAILABLE_ADDONS.filter((addon) =>
  OPERATOR_MODULE_OPTIONS.some((candidate) => candidate.id === addon.id) && isAddonSelfServiceEnabled(addon)
)

const BILLING_MARKETPLACE_ADDONS = AVAILABLE_ADDONS.filter((addon) =>
  OPERATOR_GROWTH_ADDON_OPTIONS.some((candidate) => candidate.id === addon.id) && isAddonSelfServiceEnabled(addon)
)

function buildPackageCheckoutItem(pkg: any): BillingCheckoutItem {
  return {
    id: String(pkg.id),
    name: String(pkg.name || 'Paket Core'),
    price: Number(pkg.price || 0),
    type: 'PACKAGE',
    billing: String(pkg.billing || 'Bulan'),
    label: 'Paket Core',
    description: PLAN_UI_META[String(pkg.name || '')]?.summary || 'Paket inti Nizam untuk mengelola proses bisnis utama.',
    note: 'Paket core akan mengganti plan aktif setelah pembayaran diverifikasi.',
  }
}

function buildAddonCheckoutItem(addon: any): BillingCheckoutItem {
  return {
    id: String(addon.id),
    name: String(addon.name || 'Add-on'),
    price: Number(addon.price || 0),
    type: 'ADDON',
    billing: String(addon.billing || 'Bulan'),
    label: getOperatorMarketplaceLabel(addon),
    description: String(addon.desc || addon.description || 'Tambahan capability untuk memperluas proses bisnis.'),
    note: 'Add-on aktif di organisasi ini setelah pembayaran diverifikasi.',
  }
}

function buildAiTokenCheckoutItem(pkg: any): BillingCheckoutItem {
  return {
    id: String(pkg.id),
    name: String(pkg.name || 'AI Token'),
    price: Number(pkg.price_idr || 0),
    type: 'AI_TOKEN_TOPUP',
    billing: 'Sekali',
    label: 'AI Token Top Up',
    description: `${Number(pkg.tokens || 0).toLocaleString('id-ID')} token untuk generator AI dan workflow berbasis AI.`,
    note: 'Saldo token AI akan bertambah setelah pembayaran diverifikasi.',
    topupPackageId: String(pkg.id),
    tokens: Number(pkg.tokens || 0),
  }
}

function BillingContent() {
  const searchParams = useSearchParams()
  const pkgId = searchParams.get('pkg')
  const section = searchParams.get('section')
  const { orgId: activeOrgId, loading: activeOrgLoading } = useActiveOrgId()

  const [activeOrg, setActiveOrg] = useState<any>(null)
  const [packageCatalog, setPackageCatalog] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [aiTokenBalance, setAiTokenBalance] = useState(0)
  const [aiTokenPackages, setAiTokenPackages] = useState<any[]>([])
  const [selectedCheckoutItem, setSelectedCheckoutItem] = useState<BillingCheckoutItem | null>(null)
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null)

  // SaaS Dynamic Config
  const [bankInfo, setBankInfo] = useState(BANK_INFO)
  const [supportInfo, setSupportInfo] = useState(SUPPORT_INFO)

  // Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutInvoice, setCheckoutInvoice] = useState<any>(null)
  const [processing, setProcessing] = useState(false)
  const [timeLeft, setTimeLeft] = useState(900) // 15 mins
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [checkoutFeedback, setCheckoutFeedback] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<'invoice' | 'account' | null>(null)
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
    if (!flashMessage) return
    const timer = window.setTimeout(() => setFlashMessage(null), 5000)
    return () => window.clearTimeout(timer)
  }, [flashMessage])

  useEffect(() => {
    if (!showCheckoutModal) return
    setCopiedField(null)
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

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const closeCheckout = () => {
    if (processing) return
    setShowCheckoutModal(false)
    setCheckoutFeedback(null)
    setProofFile(null)
    setCopiedField(null)
  }

  const copyToClipboard = async (value: string, field: 'invoice' | 'account') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      window.setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current))
      }, 2000)
    } catch {
      setFlashMessage({ tone: 'error', text: 'Clipboard browser tidak tersedia. Silakan copy manual.' })
    }
  }

  async function loadBillingSnapshot(requestedOrgId: string | null) {
    setLoading(true)
    const { data: tokenPackages } = await db
      .from('ai_token_topup_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('tokens', { ascending: true })

    setAiTokenPackages(tokenPackages || [])

    if (!requestedOrgId) {
      setActiveOrg(null)
      setInvoices([])
      setAiTokenBalance(0)
      setTotalMonthly(0)
      setLoading(false)
      return
    }

    const [{ data: org }, { data: pkgs }, { data: walletData }, { data: invs }] = await Promise.all([
      db.from('organizations').select('*').eq('id', requestedOrgId).maybeSingle(),
      db.from('saas_packages').select('*'),
      db.from('ai_token_wallets').select('balance_tokens').eq('org_id', requestedOrgId).maybeSingle(),
      db.from('saas_invoices').select('*').eq('org_id', requestedOrgId).order('created_at', { ascending: false }),
    ])

    const normalizedPackages = (pkgs || []).map((pkg: any) => ({
      ...pkg,
      modules: Array.isArray(pkg.modules) ? pkg.modules : JSON.parse(pkg.modules || '[]'),
      addons: Array.isArray(pkg.addons) ? pkg.addons : JSON.parse(pkg.addons || '[]'),
    }))
    setPackageCatalog(normalizedPackages)

    if (org) {
      setActiveOrg(org)
      setAiTokenBalance(Number(walletData?.balance_tokens || 0))

      const planPkg = normalizedPackages.find((p: any) => p.name === org.settings?.plan)
      let total = Number(planPkg?.price || 0)

      const activeAddons = Array.isArray(org.active_addons) ? org.active_addons : []
      activeAddons.forEach((a: any) => {
        const addonName = normalizeSaasEntitlementName(String(a?.name || ''))
        const addonPrice = AVAILABLE_ADDONS.find((ma) => ma.name === addonName)?.price || 0
        total += addonPrice
      })
      setTotalMonthly(total)
    } else {
      setActiveOrg(null)
      setAiTokenBalance(0)
      setTotalMonthly(0)
    }

    setInvoices(invs || [])
    setLoading(false)
  }

  const handleBuyItem = async (org: any, item: BillingCheckoutItem) => {
    if (!org?.id) {
      setFlashMessage({ tone: 'error', text: 'Organisasi aktif tidak ditemukan.' })
      return
    }

    if (item.type === 'PACKAGE' && org.parent_org_id) {
      setFlashMessage({ tone: 'info', text: 'Paket SaaS child mengikuti holding. Upgrade paket dilakukan dari organisasi induk.' })
      return
    }

    setProcessing(true)
    try {
      const res = await createBillingInvoice(org.id, item)
      if (res.success) {
        const [{ data: invoiceRow }, { data: invs }] = await Promise.all([
          db.from('saas_invoices').select('*').eq('id', res.id).maybeSingle(),
          db.from('saas_invoices').select('*').eq('org_id', org.id).order('created_at', { ascending: false }),
        ])
        setCheckoutInvoice(invoiceRow || {
          id: res.id,
          invoice_number: res.invoiceNumber,
          item_name: item.name,
          amount: res.amount,
          status: 'UNPAID',
          package_id: item.type === 'PACKAGE' ? item.id : null,
        })
        setCheckoutFeedback((res as any).message || 'Invoice siap. Lanjutkan transfer dan upload bukti pembayaran.')
        setProofFile(null)
        setTimeLeft(900)
        setShowCheckoutModal(true)
        setInvoices(invs || [])
        setFlashMessage({ tone: 'success', text: `${item.label} "${item.name}" siap untuk checkout.` })
      } else {
        setFlashMessage({ tone: 'error', text: 'Gagal membuat tagihan: ' + (res as any).error })
      }
    } catch (err: any) {
      setFlashMessage({ tone: 'error', text: 'Sistem error: ' + err.message })
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    if (activeOrgLoading) return
    void loadBillingSnapshot(activeOrgId)
  }, [activeOrgId, activeOrgLoading])

  useEffect(() => {
    if (loading || !pkgId || packageCatalog.length === 0) return
    const pkg = packageCatalog.find((candidate) => candidate.id === pkgId)
    if (!pkg) return
    setSelectedCheckoutItem((current) => (
      current?.type === 'PACKAGE' && current.id === pkg.id
        ? current
        : buildPackageCheckoutItem(pkg)
    ))
  }, [loading, packageCatalog, pkgId])

  const openCheckout = (inv: any) => {
    if (activeOrg?.parent_org_id && inv?.package_id) {
      setFlashMessage({ tone: 'info', text: 'Invoice paket untuk child dikelola dari organisasi induk/holding.' })
      return
    }

    setCheckoutInvoice(inv)
    setCheckoutFeedback('Lanjutkan transfer sesuai invoice ini, lalu unggah bukti pembayaran agar kami bisa verifikasi.')
    setProofFile(null)
    setTimeLeft(900)
    setShowCheckoutModal(true)
  }

  const handleManualPayment = async () => {
    if (!activeOrg || !checkoutInvoice || !proofFile) {
       setCheckoutFeedback('Silakan unggah bukti transfer terlebih dahulu.')
       return
    }

    setProcessing(true)
    try {
      const fileExt = proofFile.name.split('.').pop()
      const fileName = `${checkoutInvoice.invoice_number}-${Date.now()}.${fileExt}`
      const { error: uploadErr } = await db.storage
        .from('billing-proofs')
        .upload(fileName, proofFile)

      if (uploadErr) throw uploadErr

      const proofUrl = db.storage.from('billing-proofs').getPublicUrl(fileName).data.publicUrl

      const res = await submitPaymentProof(activeOrg.id, checkoutInvoice.id, proofUrl, 'BANK_TRANSFER')
      if (res.success) {
        closeCheckout()
        setFlashMessage({
          tone: 'success',
          text: 'Bukti pembayaran berhasil diunggah. Tim admin akan memverifikasi pembayaran Anda.',
        })
        await loadBillingSnapshot(activeOrg.id)
      } else {
        setCheckoutFeedback('Gagal: ' + (res as any).error)
      }
    } catch (err: any) {
      setCheckoutFeedback('Gagal upload: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleApplyVoucher = async () => {
    if (!activeOrg || !voucherCode) {
      setFlashMessage({ tone: 'info', text: 'Silakan masukkan kode voucher.' })
      return
    }
    if (activeOrg.parent_org_id) {
      setFlashMessage({ tone: 'info', text: 'Voucher paket child harus diapply dari organisasi induk/holding.' })
      return
    }

    setApplyingVoucher(true)
    try {
      const res = await applyVoucher(activeOrg.id, voucherCode)
      if (res.success) {
        setFlashMessage({ tone: 'success', text: res.message || 'Voucher berhasil di-apply.' })
        setVoucherCode('')
        await loadBillingSnapshot(activeOrg.id)
      } else {
        setFlashMessage({ tone: 'error', text: 'Gagal: ' + (res as any).error })
      }
    } catch (err: any) {
      setFlashMessage({ tone: 'error', text: 'Error: ' + err.message })
    } finally {
      setApplyingVoucher(false)
    }
  }

  const inheritsPlanFromHolding = Boolean(activeOrg?.parent_org_id)
  const inheritedPlanNotice = 'Paket inti mengikuti organisasi induk. Upgrade paket dan voucher dikelola dari holding.'
  const currentPlanPackage = useMemo(
    () => packageCatalog.find((pkg) => pkg.name === activeOrg?.settings?.plan) || null,
    [activeOrg?.settings?.plan, packageCatalog]
  )
  const corePackageOptions = useMemo(
    () => packageCatalog
      .filter((pkg) => pkg.is_active !== false && pkg.name !== 'Demo')
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0)),
    [packageCatalog]
  )
  const currentPlanArchitecture = useMemo(
    () => currentPlanPackage ? getSaasPackageArchitecture(currentPlanPackage.modules || [], currentPlanPackage.addons || []) : null,
    [currentPlanPackage]
  )
  const activeAddonNames = useMemo(
    () => normalizeSaasEntitlementList(
      (Array.isArray(activeOrg?.active_addons) ? activeOrg.active_addons : [])
        .map((entry: any) => String(entry?.name || entry || '').trim())
        .filter(Boolean)
    ),
    [activeOrg?.active_addons]
  )
  const enabledCapabilities = useMemo(
    () => normalizeSaasEntitlementList([
      ...(currentPlanPackage?.modules || []),
      ...(currentPlanPackage?.addons || []),
      ...activeAddonNames,
    ]),
    [activeAddonNames, currentPlanPackage?.addons, currentPlanPackage?.modules]
  )
  const activeAddonDetails = useMemo(
    () => activeAddonNames
      .map((addonName) => AVAILABLE_ADDONS.find((candidate) => normalizeSaasEntitlementName(candidate.name) === addonName))
      .filter(Boolean),
    [activeAddonNames]
  )
  const unpaidInvoiceCount = useMemo(
    () => invoices.filter((invoice) => invoice.status === 'UNPAID').length,
    [invoices]
  )
  const currentCoreFamilyLabel = getSaasCoreFamilyLabel(currentPlanArchitecture?.coreFamilyLevel || 'none')
  const selectedCheckoutDisabledReason = useMemo(() => {
    if (!selectedCheckoutItem) return null
    if (selectedCheckoutItem.type === 'PACKAGE' && inheritsPlanFromHolding) {
      return inheritedPlanNotice
    }
    return null
  }, [inheritsPlanFromHolding, inheritedPlanNotice, selectedCheckoutItem])
  const marketplaceSections = useMemo(() => ([
    {
      title: 'Module Marketplace',
      description: 'Pilih modul vertikal untuk industri atau workflow bisnis tertentu.',
      items: BILLING_MARKETPLACE_MODULES.map((addon) => ({
        ...addon,
        compatibility: getOperatorMarketplaceCompatibility(addon, {
          coreFamilyLevel: currentPlanArchitecture?.coreFamilyLevel || 'none',
          enabledCapabilities,
        }),
      })),
    },
    {
      title: 'Add-on Marketplace',
      description: 'Aktifkan channel, capacity, atau fitur pelengkap di atas Core Family dan Module.',
      items: BILLING_MARKETPLACE_ADDONS.map((addon) => ({
        ...addon,
        compatibility: getOperatorMarketplaceCompatibility(addon, {
          coreFamilyLevel: currentPlanArchitecture?.coreFamilyLevel || 'none',
          enabledCapabilities,
        }),
      })),
    },
  ]), [currentPlanArchitecture?.coreFamilyLevel, enabledCapabilities])

  if (loading) return <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Memuat Data Billing...</div>

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      {flashMessage && <BillingFlashMessage tone={flashMessage.tone} text={flashMessage.text} />}

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckoutModal && checkoutInvoice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeCheckout} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.96, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden ring-1 ring-slate-200">
              <div className="p-8 md:p-10 space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-600">
                      <Clock size={14} /> Selesaikan Dalam {formatTime(timeLeft)}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tighter text-slate-900">Checkout Pembayaran</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        Review invoice, transfer ke rekening resmi, lalu unggah bukti pembayaran dalam satu alur yang rapi.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeCheckout}
                    disabled={processing}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
                  >
                    Tutup
                  </button>
                </div>

                {checkoutFeedback && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold leading-relaxed text-indigo-900">
                    {checkoutFeedback}
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Invoice Aktif</p>
                    <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-sm font-black text-slate-900">{checkoutInvoice.item_name || 'Pembelian Nizam ERP'}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">#{checkoutInvoice.invoice_number}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Total Tagihan</p>
                        <p className="text-2xl font-black tracking-tighter text-indigo-700">{formatRupiah(checkoutInvoice.amount)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(String(checkoutInvoice.invoice_number || ''), 'invoice')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700"
                      >
                        {copiedField === 'invoice' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedField === 'invoice' ? 'Invoice Dicopy' : 'Copy Nomor Invoice'}
                      </button>
                      <Link
                        href={`/billing/invoice/${checkoutInvoice.id}`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        Lihat Detail Invoice <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Langkah Checkout</p>
                    <div className="mt-4 space-y-3">
                      {[
                        'Pastikan nominal transfer sesuai invoice.',
                        'Transfer ke rekening resmi Nizam.',
                        'Upload bukti transfer agar tim kami bisa verifikasi.',
                      ].map((step) => (
                        <div key={step} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                          <div className="mt-0.5 rounded-full bg-emerald-100 p-1 text-emerald-600">
                            <CheckCircle2 size={12} />
                          </div>
                          <p className="text-xs font-semibold leading-relaxed text-slate-600">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[32px] bg-indigo-600 p-6 text-white shadow-xl">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-100">Rekening Tujuan</p>
                      <p className="text-sm font-black uppercase tracking-[0.14em] text-indigo-100">{bankInfo.bank}</p>
                      <p className="text-3xl font-black tracking-widest">{bankInfo.account}</p>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">a.n {bankInfo.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(bankInfo.account || ''), 'account')}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 transition hover:bg-indigo-50"
                    >
                      {copiedField === 'account' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedField === 'account' ? 'Rekening Dicopy' : 'Copy Rekening'}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div className="border-2 border-dashed border-slate-200 rounded-[32px] p-6 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/40">
                    <input
                      type="file"
                      id="proof-upload"
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="proof-upload" className="cursor-pointer block space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <ArrowUpRight size={24} className="rotate-45" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-900">
                          {proofFile ? 'File Siap Dikirim' : 'Upload Bukti Transfer'}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">
                          {proofFile ? proofFile.name : 'Format gambar atau PDF, maksimal 5MB.'}
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="flex flex-col justify-between gap-3">
                    <button
                      disabled={processing || !proofFile}
                      onClick={handleManualPayment}
                      className="min-w-[240px] rounded-[28px] bg-slate-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processing ? 'Mengirim Bukti...' : 'Konfirmasi Pembayaran'}
                    </button>
                    <Link
                      href={`https://wa.me/${supportInfo.wa}`}
                      target="_blank"
                      className="inline-flex items-center justify-center gap-2 rounded-[28px] border border-slate-200 px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Butuh Bantuan Support
                    </Link>
                  </div>
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
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
                  Core Family Aktif: {currentCoreFamilyLabel}
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

            {activeAddonDetails.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Add-on Aktif Saat Ini</p>
                <div className="flex flex-wrap gap-2">
                  {activeAddonDetails.map((addon: any) => (
                    <div key={addon.id} className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                      <CheckCircle2 size={12} />
                      {addon.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-6 pt-4 w-full">
               {inheritsPlanFromHolding ? (
                 <div className="w-full rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Paket Mengikuti Holding</p>
                    <p className="mt-2 text-sm font-bold text-amber-900 leading-relaxed">
                      {inheritedPlanNotice}
                    </p>
                 </div>
               ) : (
                 <div className="grid gap-4 xl:grid-cols-[auto_1fr] xl:items-center">
                   <div className="flex flex-wrap items-center gap-3">
                     <button
                       type="button"
                       onClick={() => scrollToSection('core-packages')}
                       className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-900 shadow-lg shadow-indigo-200"
                     >
                       <ShieldCheck size={18} /> Pilih Paket Core
                     </button>
                     <button
                       type="button"
                       onClick={() => scrollToSection('billing-history')}
                       className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                     >
                       <History size={18} /> Lihat Invoice
                     </button>
                     <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                       <CreditCard size={14} /> Transfer Manual + Upload Bukti
                     </div>
                   </div>

                   <div className="flex flex-col gap-2 md:flex-row md:items-center">
                     <div className="relative flex-1">
                       <input
                         type="text"
                         placeholder="Punya Voucher? Contoh: ABS2024"
                         value={voucherCode}
                         onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                         className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                       className="rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-indigo-600 disabled:opacity-50 shadow-xl"
                     >
                       {applyingVoucher ? 'Memproses...' : 'Apply Voucher'}
                     </button>
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div id="core-packages" className="rounded-[40px] border border-slate-100 bg-white p-6 md:p-8 shadow-xl shadow-slate-200/50">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">
                <ShieldCheck size={12} /> 1. Pilih Paket Core
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tighter text-slate-900">Pilih fondasi yang paling pas untuk bisnis Anda</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Paket core dipilih dulu, lalu module dan add-on ditambahkan hanya bila memang dibutuhkan.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Paket Aktif Saat Ini</p>
              <p className="mt-1 text-lg font-black tracking-tight text-slate-900">{activeOrg?.settings?.plan || 'Free'}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {corePackageOptions.map((pkg) => {
              const isCurrent = currentPlanPackage?.id === pkg.id
              const isSelected = selectedCheckoutItem?.type === 'PACKAGE' && selectedCheckoutItem.id === pkg.id
              const architecture = getSaasPackageArchitecture(pkg.modules || [], pkg.addons || [])
              const previewCapabilities = [
                ...architecture.liteCore,
                ...architecture.starterCore,
                ...architecture.fullCoreExtensions,
              ].slice(0, 4)

              return (
                <div
                  key={pkg.id}
                  className={`rounded-[32px] border p-5 transition-all ${
                    isSelected
                      ? 'border-indigo-300 bg-indigo-50 shadow-lg shadow-indigo-100'
                      : isCurrent
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:-translate-y-1 hover:shadow-xl'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {PLAN_UI_META[pkg.name]?.eyebrow || 'Paket Core'}
                      </p>
                      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{pkg.name}</h3>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                        {PLAN_UI_META[pkg.name]?.summary || 'Paket inti untuk mengelola proses bisnis utama.'}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Harga</p>
                      <p className="mt-1 text-2xl font-black tracking-tighter text-slate-900">{formatRupiah(Number(pkg.price || 0))}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">/{pkg.billing}</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Arsitektur Core</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{architecture.bundleLabel}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {previewCapabilities.map((capability) => (
                        <div key={`${pkg.id}-${capability}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                          {capability}
                        </div>
                      ))}
                      {previewCapabilities.length === 0 && (
                        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                          Platform Core
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {isCurrent && (
                      <div className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                        Paket Aktif
                      </div>
                    )}
                    {isSelected && !isCurrent && (
                      <div className="rounded-full border border-indigo-200 bg-indigo-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700">
                        Siap Checkout
                      </div>
                    )}
                    {inheritsPlanFromHolding && (
                      <div className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                        Kelola di Holding
                      </div>
                    )}
                  </div>

                  <div className="mt-5">
                    <button
                      type="button"
                      disabled={processing || isCurrent || inheritsPlanFromHolding}
                      onClick={() => {
                        setSelectedCheckoutItem(buildPackageCheckoutItem(pkg))
                        scrollToSection('billing-checkout')
                      }}
                      className={`w-full rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-[0.18em] transition ${
                        isCurrent
                          ? 'cursor-default border border-emerald-200 bg-emerald-100 text-emerald-700'
                          : inheritsPlanFromHolding
                            ? 'cursor-not-allowed border border-amber-200 bg-amber-100 text-amber-700'
                            : isSelected
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                              : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white'
                      }`}
                    >
                      {isCurrent ? 'Paket Aktif' : inheritsPlanFromHolding ? 'Kelola di Holding' : isSelected ? 'Siap untuk Checkout' : 'Pilih Paket Ini'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div id="billing-checkout" className="space-y-6 xl:sticky xl:top-24 self-start">
          <div className="rounded-[32px] border border-slate-100 bg-slate-900 p-6 text-white shadow-xl shadow-slate-300/30">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <Layers3 size={20} className="text-indigo-200" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200">Alur Pembelian</p>
                <h3 className="mt-1 text-xl font-black tracking-tight">Pilih, review, lalu checkout</h3>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                'Pilih satu paket core, add-on, atau top up token yang ingin dibeli.',
                'Review ringkasan item di panel ini sebelum invoice dibuat.',
                'Buat invoice, transfer, lalu upload bukti pembayaran.',
              ].map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-400/20 text-[10px] font-black text-indigo-100">
                    {index + 1}
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-slate-100">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
                <ShoppingCart size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">2. Review Checkout</p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Ringkasan item yang dipilih</h3>
              </div>
            </div>

            {selectedCheckoutItem ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700">
                        {selectedCheckoutItem.label}
                      </div>
                      <h4 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{selectedCheckoutItem.name}</h4>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                        {selectedCheckoutItem.description}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Harga</p>
                      <p className="mt-1 text-3xl font-black tracking-tighter text-slate-900">{formatRupiah(selectedCheckoutItem.price)}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">/{selectedCheckoutItem.billing}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Catatan Aktivasi</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{selectedCheckoutItem.note}</p>
                </div>

                {selectedCheckoutDisabledReason && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-900">
                    {selectedCheckoutDisabledReason}
                  </div>
                )}

                <button
                  type="button"
                  disabled={processing || Boolean(selectedCheckoutDisabledReason) || !activeOrg}
                  onClick={() => activeOrg && handleBuyItem(activeOrg, selectedCheckoutItem)}
                  className="w-full rounded-[28px] bg-slate-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? 'Membuat Invoice...' : 'Buat Invoice & Lanjut Checkout'}
                </button>

                <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
                  Jika item yang sama masih punya invoice `UNPAID`, sistem akan memakai invoice yang sudah ada agar user tidak bingung dengan tagihan ganda.
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Belum Ada Item Dipilih</p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                  Pilih paket core, add-on, atau top up token terlebih dahulu. Ringkasan checkout akan langsung muncul di panel ini.
                </p>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Invoice UNPAID</p>
                <p className="mt-1 text-2xl font-black tracking-tighter text-slate-900">{unpaidInvoiceCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Metode Bayar</p>
                <p className="mt-1 text-sm font-black tracking-tight text-slate-900">Transfer Manual</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Growth Layer Marketplace */}
      <section className="space-y-8">
        <div className="text-center space-y-3">
           <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
             <Layers3 size={12} /> 2. Module & Add-on Tambahan
           </div>
           <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Tambahkan hanya yang benar-benar dibutuhkan</h2>
           <p className="text-slate-400 font-bold">Setelah core siap, user bisa memilih module vertikal atau add-on tertentu tanpa merasa dipaksa membeli semuanya.</p>
        </div>

        {marketplaceSections.map((section) => (
          <div key={section.title} className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{section.title}</p>
              <p className="text-sm font-semibold text-slate-500">{section.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {section.items.map((addon) => {
                const isLocked = !addon.compatibility.isCompatible
                const isSelected = selectedCheckoutItem?.type === 'ADDON' && selectedCheckoutItem.id === addon.id
                const isActive = activeAddonNames.includes(normalizeSaasEntitlementName(addon.name))
                return (
                <div
                  key={addon.id}
                  className={`rounded-[32px] border p-6 flex flex-col transition-all ${
                    isActive
                      ? 'bg-emerald-50 border-emerald-200'
                      : isSelected
                        ? 'bg-indigo-50 border-indigo-200 shadow-lg shadow-indigo-100'
                      : isLocked
                      ? 'bg-slate-50 border-slate-200 opacity-80'
                      : 'bg-white border-slate-100 hover:-translate-y-2 hover:shadow-2xl hover:border-indigo-100 group'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner`}>
                    <addon.icon size={28} />
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{addon.name}</h3>
                    <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-blue-700">
                      {getOperatorMarketplaceLabel(addon)}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed mb-6">
                    {addon.desc}
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-indigo-700">
                      Min. {getSaasCoreFamilyLabel(getOperatorMarketplaceMinCoreFamily(addon))}
                    </span>
                    {isActive && (
                      <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                        Sudah Aktif
                      </span>
                    )}
                    {isSelected && !isActive && (
                      <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-indigo-700">
                        Dipilih
                      </span>
                    )}
                    {isLocked && (
                      <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-700">
                        Locked
                      </span>
                    )}
                  </div>
                  {isLocked && addon.compatibility.reason && (
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>{addon.compatibility.reason}</span>
                      </div>
                    </div>
                  )}

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
                      disabled={processing || isLocked || isActive}
                      onClick={() => {
                        setSelectedCheckoutItem(buildAddonCheckoutItem(addon))
                        scrollToSection('billing-checkout')
                      }}
                      className={`w-full rounded-xl py-3 text-xs font-black uppercase tracking-widest transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white group-hover:bg-indigo-600 group-hover:text-white'
                      }`}
                     >
                       {isActive ? 'Sudah Aktif' : isLocked ? 'Belum Kompatibel' : isSelected ? 'Siap untuk Checkout' : `Pilih ${getOperatorMarketplaceLabel(addon)}`}
                     </button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        ))}
      </section>

      {/* AI Token Topup */}
      <section id="ai-token" className="space-y-8">
        <div className="flex flex-col gap-3 text-center">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 mx-auto">
            <Coins size={12} /> 3. Top Up Token AI
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
          {aiTokenPackages.map((pkg: any) => {
            const isSelected = selectedCheckoutItem?.type === 'AI_TOKEN_TOPUP' && selectedCheckoutItem.id === pkg.id
            return (
            <div key={pkg.id} className={`rounded-[32px] border p-6 flex flex-col transition-all hover:-translate-y-1 hover:shadow-xl ${isSelected ? 'border-indigo-200 bg-indigo-50 shadow-lg shadow-indigo-100' : 'border-slate-100 bg-white'}`}>
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
                  onClick={() => {
                    setSelectedCheckoutItem(buildAiTokenCheckoutItem(pkg))
                    scrollToSection('billing-checkout')
                  }}
                  className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white hover:bg-indigo-600'
                  }`}
                >
                  {isSelected ? 'Siap untuk Checkout' : 'Pilih Paket Token'}
                </button>
              </div>
            </div>
          )})}
        </div>
      </section>

      {/* History Penagihan */}
      <section id="billing-history" className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
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
          <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {invoices.length} Invoice
          </div>
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
  const safeMax = Math.max(Number(max || 0), 1)
  const percentage = Math.min((Number(current || 0) / safeMax) * 100, 100)
  return (
    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
       <div className="flex items-center justify-between">
         <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
           <Icon size={16} className="text-indigo-600" />
         </div>
         <span className="text-[10px] font-black text-slate-900 uppercase italic tracking-tighter">{current} / {safeMax} {unit}</span>
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

function BillingFlashMessage({ tone, text }: FlashMessage) {
  const palette = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    info: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  } as const

  return (
    <div className={`rounded-[28px] border px-5 py-4 text-sm font-semibold leading-relaxed shadow-sm ${palette[tone]}`}>
      {text}
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
