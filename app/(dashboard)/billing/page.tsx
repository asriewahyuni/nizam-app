'use client'

import React, { useState, useEffect, Suspense, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, CreditCard, History, Package, Plus, CheckCircle2,
  Building2, Warehouse, Users,
  ArrowUpRight, Clock, Truck, Edit3, Megaphone,
  Copy, Check, Layers3, ShieldCheck,
  type LucideIcon
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createBillingInvoice, submitPaymentProof, applyVoucher } from '@/modules/organization/actions/billing.actions'
import {
  getSaasProvisioningModulesForCoreFamily,
  getSaasRelatedAddonsForModule,
  getSaasCoreFamilyLabel,
  getSaasPackageArchitecture,
  normalizeSaasEntitlementList,
  normalizeSaasEntitlementName,
} from '@/lib/saas/module-catalog'
import {
  OPERATOR_ADDON_OPTIONS,
  OPERATOR_MODULE_OPTIONS,
  getOperatorMarketplaceCompatibility,
  getOperatorMarketplaceKind,
  getOperatorMarketplaceLabel,
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
  const [provisioningFocusedModule, setProvisioningFocusedModule] = useState<string | null>(null)
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
  const currentPlanLimits = useMemo(
    () => ({
      maxOrgs: typeof currentPlanPackage?.max_orgs === 'number' ? currentPlanPackage.max_orgs : 1,
      maxWarehouses: typeof currentPlanPackage?.max_warehouses === 'number' ? currentPlanPackage.max_warehouses : 3,
      maxUsers: typeof currentPlanPackage?.max_users === 'number' ? currentPlanPackage.max_users : 10,
    }),
    [currentPlanPackage]
  )
  const usesCustomModules = activeOrg?.settings?.use_custom_modules === true
  const currentEnabledModules = useMemo(
    () => normalizeSaasEntitlementList(
      usesCustomModules
        ? (Array.isArray(activeOrg?.enabled_modules) ? activeOrg.enabled_modules : [])
            .map((entry: any) => String(entry || '').trim())
            .filter(Boolean)
        : (currentPlanPackage?.modules || [])
    ),
    [activeOrg?.enabled_modules, currentPlanPackage?.modules, usesCustomModules]
  )
  const corePackageOptions = useMemo(
    () => packageCatalog
      .filter((pkg) => pkg.is_active !== false && pkg.name !== 'Demo')
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0)),
    [packageCatalog]
  )
  const currentPlanArchitecture = useMemo(
    () => currentEnabledModules.length > 0 ? getSaasPackageArchitecture(currentEnabledModules, []) : null,
    [currentEnabledModules]
  )
  const activeAddonNames = useMemo(
    () => normalizeSaasEntitlementList(
      (Array.isArray(activeOrg?.active_addons) ? activeOrg.active_addons : [])
        .map((entry: any) => String(entry?.name || entry || '').trim())
        .filter(Boolean)
    ),
    [activeOrg?.active_addons]
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
  const quickAiTokenPackages = useMemo(
    () => aiTokenPackages.slice(0, 3),
    [aiTokenPackages]
  )
  const provisioningCorePackages = useMemo(() => ({
    lite: corePackageOptions.find((pkg) => getSaasPackageArchitecture(pkg.modules || [], []).coreFamilyLevel === 'lite') || null,
    starter: corePackageOptions.find((pkg) => getSaasPackageArchitecture(pkg.modules || [], []).coreFamilyLevel === 'starter') || null,
    full: corePackageOptions.find((pkg) => getSaasPackageArchitecture(pkg.modules || [], []).coreFamilyLevel === 'full') || null,
  }), [corePackageOptions])
  const previewPackage = useMemo(() => {
    if (selectedCheckoutItem?.type === 'PACKAGE') {
      return packageCatalog.find((pkg) => String(pkg.id) === selectedCheckoutItem.id) || null
    }
    return currentPlanPackage
  }, [currentPlanPackage, packageCatalog, selectedCheckoutItem])
  const previewPackageModules = useMemo(
    () => normalizeSaasEntitlementList(Array.isArray(previewPackage?.modules) ? previewPackage.modules : []),
    [previewPackage]
  )
  const selectedMarketplaceKind = useMemo(() => {
    if (selectedCheckoutItem?.type !== 'ADDON') return null
    return getOperatorMarketplaceKind({ name: selectedCheckoutItem.name })
  }, [selectedCheckoutItem])
  const previewCoreFamilyLevel = useMemo(() => {
    if (previewPackage) {
      return getSaasPackageArchitecture(previewPackage.modules || [], []).coreFamilyLevel
    }
    return currentPlanArchitecture?.coreFamilyLevel || 'none'
  }, [currentPlanArchitecture?.coreFamilyLevel, previewPackage])
  const previewCoreFamily = previewCoreFamilyLevel === 'none' ? 'lite' : previewCoreFamilyLevel
  const previewEnabledModules = useMemo(() => {
    const baseModules =
      selectedCheckoutItem?.type === 'PACKAGE'
        ? previewPackageModules
        : currentEnabledModules
    const pendingModule =
      selectedCheckoutItem?.type === 'ADDON' && selectedMarketplaceKind === 'module'
        ? [selectedCheckoutItem.name]
        : []

    return normalizeSaasEntitlementList([
      ...baseModules,
      ...pendingModule,
    ])
  }, [
    currentEnabledModules,
    previewPackageModules,
    selectedCheckoutItem,
    selectedMarketplaceKind,
  ])
  const previewAddonNames = useMemo(() => {
    const pendingAddon =
      selectedCheckoutItem?.type === 'ADDON' && selectedMarketplaceKind !== 'module'
        ? [selectedCheckoutItem.name]
        : []

    return normalizeSaasEntitlementList([
      ...activeAddonNames,
      ...pendingAddon,
    ])
  }, [activeAddonNames, selectedCheckoutItem, selectedMarketplaceKind])
  const previewCapabilities = useMemo(() => normalizeSaasEntitlementList([
    ...previewEnabledModules,
    ...previewAddonNames,
  ]), [previewAddonNames, previewEnabledModules])
  const provisioningModuleOptions = useMemo(
    () => getSaasProvisioningModulesForCoreFamily(previewCoreFamily),
    [previewCoreFamily]
  )
  const focusedProvisioningModule = useMemo(
    () => provisioningModuleOptions.find((option) => normalizeSaasEntitlementName(option.value) === normalizeSaasEntitlementName(provisioningFocusedModule || '')) || null,
    [provisioningFocusedModule, provisioningModuleOptions]
  )
  const provisioningRelatedAddons = useMemo(() => {
    if (!focusedProvisioningModule) return []

    const relatedNames = getSaasRelatedAddonsForModule(
      focusedProvisioningModule.value,
      previewCoreFamily
    ).map((option) => normalizeSaasEntitlementName(option.value))

    return AVAILABLE_ADDONS
      .filter((addon) => (
        relatedNames.includes(normalizeSaasEntitlementName(addon.name)) &&
        getOperatorMarketplaceKind(addon) !== 'module' &&
        isAddonSelfServiceEnabled(addon)
      ))
      .map((addon) => ({
        ...addon,
        compatibility: getOperatorMarketplaceCompatibility(addon, {
          coreFamilyLevel: previewCoreFamily,
          enabledCapabilities: previewCapabilities,
        }),
      }))
  }, [focusedProvisioningModule, previewCapabilities, previewCoreFamily])

  useEffect(() => {
    const nextFocusedModule =
      provisioningModuleOptions.find((option) =>
        previewEnabledModules.includes(normalizeSaasEntitlementName(option.value))
      )?.value ||
      provisioningModuleOptions[0]?.value ||
      null

    if (
      provisioningFocusedModule &&
      provisioningModuleOptions.some((option) => normalizeSaasEntitlementName(option.value) === normalizeSaasEntitlementName(provisioningFocusedModule))
    ) {
      return
    }

    if (nextFocusedModule !== provisioningFocusedModule) {
      setProvisioningFocusedModule(nextFocusedModule)
    }
  }, [
    previewEnabledModules,
    provisioningFocusedModule,
    provisioningModuleOptions,
  ])

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
               <UsageMetric icon={Building2} label="Entitas Bisnis" current={1} max={currentPlanLimits.maxOrgs} unit="Org" />
               <UsageMetric icon={Warehouse} label="Gudang / WMS" current={1} max={currentPlanLimits.maxWarehouses} unit="Loc" />
               <UsageMetric icon={Users} label="Team Members" current={1} max={currentPlanLimits.maxUsers} unit="Staff" />
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

      {false && (
      <section id="billing-provisioning" className="rounded-[40px] border border-slate-100 bg-white p-6 md:p-8 shadow-xl shadow-slate-200/50">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">
            <Layers3 size={12} /> Provisioning Builder
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-slate-900">Flow yang sama seperti provisioning admin, tapi khusus untuk billing</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Pilih core untuk preview paket, fokuskan module, lalu pilih add-on yang memang kompatibel untuk dibeli lewat checkout.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.25fr_1.25fr_0.95fr]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">1. Core</h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Preview paket core yang akan menjadi fondasi compatibility.</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">3 opsi</span>
            </div>
            <div className="mt-4 space-y-3">
              {(['lite', 'starter', 'full'] as const).map((coreFamily) => {
                const pkg = provisioningCorePackages[coreFamily]
                const isSelected = selectedCheckoutItem?.type === 'PACKAGE' && pkg && String(pkg.id) === selectedCheckoutItem.id
                const isCurrentFamily = currentPlanArchitecture?.coreFamilyLevel === coreFamily

                return (
                  <button
                    key={`billing-core-${coreFamily}`}
                    type="button"
                    disabled={!pkg || inheritsPlanFromHolding}
                    onClick={() => {
                      if (!pkg) return
                      setSelectedCheckoutItem(buildPackageCheckoutItem(pkg))
                      scrollToSection('billing-checkout')
                    }}
                    className={`w-full rounded-[24px] border px-4 py-4 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                        : isCurrentFamily
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                    } ${(!pkg || inheritsPlanFromHolding) ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">
                          {getSaasCoreFamilyLabel(coreFamily)}
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          {pkg ? pkg.name : 'Belum ada paket self-service'}
                        </p>
                      </div>
                      {isSelected ? (
                        <span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">
                          Preview
                        </span>
                      ) : isCurrentFamily ? (
                        <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                          Current
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 text-[10px] font-bold text-slate-400">
                      {pkg ? `${formatRupiah(Number(pkg.price || 0))} / ${pkg.billing}` : 'Hubungi tim Nizam'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">2. Modules</h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Klik module untuk memfokuskan daftar add-on di kolom sebelah.</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {provisioningModuleOptions.length} opsi
              </span>
            </div>
            <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {provisioningModuleOptions.map((option) => {
                const normalizedValue = normalizeSaasEntitlementName(option.value)
                const marketplaceModule = BILLING_MARKETPLACE_MODULES.find((addon) => normalizeSaasEntitlementName(addon.name) === normalizedValue) || null
                const isFocused = focusedProvisioningModule ? normalizeSaasEntitlementName(focusedProvisioningModule.value) === normalizedValue : false
                const isProvisioned = previewEnabledModules.includes(normalizedValue)
                const isCurrentActive = currentEnabledModules.includes(normalizedValue)
                const isSelected = selectedCheckoutItem?.type === 'ADDON' && normalizeSaasEntitlementName(selectedCheckoutItem.name) === normalizedValue

                return (
                  <div
                    key={`billing-provisioning-module-${option.value}`}
                    className={`rounded-[24px] border px-4 py-4 transition-all ${
                      isFocused
                        ? 'border-indigo-300 bg-indigo-50/80 shadow-sm'
                        : isProvisioned
                          ? 'border-slate-300 bg-slate-50'
                          : 'border-slate-200 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setProvisioningFocusedModule(option.value)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-700">
                            {option.label}
                          </div>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            {option.description}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                          {option.sectionTitle}
                        </span>
                      </div>
                    </button>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {isCurrentActive && (
                        <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                          Active
                        </span>
                      )}
                      {!isCurrentActive && isProvisioned && (
                        <span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">
                          Preview Core
                        </span>
                      )}
                      {isSelected && (
                        <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">
                          Dipilih
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        disabled={processing || isProvisioned || !marketplaceModule}
                        onClick={() => {
                          if (!marketplaceModule) return
                          setSelectedCheckoutItem(buildAddonCheckoutItem(marketplaceModule))
                          scrollToSection('billing-checkout')
                        }}
                        className={`w-full rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                          isProvisioned
                            ? 'cursor-default border border-slate-200 bg-slate-100 text-slate-500'
                            : !marketplaceModule
                              ? 'cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400'
                              : isSelected
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        {isProvisioned
                          ? 'Sudah Termasuk'
                          : !marketplaceModule
                            ? 'Ikut Paket Core'
                            : isSelected
                              ? 'Siap untuk Checkout'
                              : 'Pilih Module Ini'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">3. Add-ons</h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Add-on mengikuti module yang sedang difokuskan dan rule compatibility billing.</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {provisioningRelatedAddons.length} opsi
              </span>
            </div>
            <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {focusedProvisioningModule ? (
                provisioningRelatedAddons.map((addon) => {
                  const isLocked = !addon.compatibility.isCompatible
                  const isSelected = selectedCheckoutItem?.type === 'ADDON' && selectedCheckoutItem.id === addon.id
                  const isActive = activeAddonNames.includes(normalizeSaasEntitlementName(addon.name))

                  return (
                    <div
                      key={`billing-provisioning-addon-${addon.id}`}
                      className={`rounded-[24px] border px-4 py-4 transition-all ${
                        isActive
                          ? 'border-emerald-200 bg-emerald-50/80'
                          : isSelected
                            ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                            : isLocked
                              ? 'border-slate-200 bg-slate-50 opacity-80'
                              : 'border-slate-200 bg-white hover:border-emerald-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-700">
                            {addon.name}
                          </div>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            {addon.desc}
                          </p>
                        </div>
                        <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-blue-700">
                          {getOperatorMarketplaceLabel(addon)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {isActive && (
                          <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                            Sudah Aktif
                          </span>
                        )}
                        {isSelected && !isActive && (
                          <span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">
                            Dipilih
                          </span>
                        )}
                        {isLocked && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-700">
                            Locked
                          </span>
                        )}
                      </div>

                      <p className={`mt-3 text-[11px] font-semibold ${isLocked ? 'text-amber-700' : 'text-slate-500'}`}>
                        {isLocked ? addon.compatibility.reason : 'Compatible dengan preview capability tenant saat ini.'}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Harga</p>
                          <p className="mt-1 text-lg font-black text-slate-900">{formatRupiah(addon.price)}</p>
                        </div>
                        <button
                          type="button"
                          disabled={processing || isLocked || isActive}
                          onClick={() => {
                            setSelectedCheckoutItem(buildAddonCheckoutItem(addon))
                            scrollToSection('billing-checkout')
                          }}
                          className={`rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                            isActive
                              ? 'cursor-default border border-emerald-200 bg-emerald-100 text-emerald-700'
                              : isSelected
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          {isActive ? 'Sudah Aktif' : isSelected ? 'Siap untuk Checkout' : 'Pilih Add-on'}
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                  Fokuskan satu module dulu untuk melihat add-on yang relevan di billing.
                </div>
              )}
            </div>
          </div>

          <div id="billing-checkout" className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">4. Summary</h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Ringkasan preview, target checkout, dan invoice action ada di sini.</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Live</span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Preview Core</div>
                <div className="mt-1 text-sm font-black text-slate-900">{getSaasCoreFamilyLabel(previewCoreFamily)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Preview Plan</div>
                <div className="mt-1 text-sm font-black text-slate-900">{previewPackage?.name || activeOrg?.settings?.plan || 'Belum Ada'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Modules</div>
                  <div className="mt-1 text-2xl font-black tracking-tight text-slate-900">{previewEnabledModules.length}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Add-ons</div>
                  <div className="mt-1 text-2xl font-black tracking-tight text-slate-900">{previewAddonNames.length}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700">Checkout Target</div>
                <p className="mt-1 text-[11px] font-semibold text-indigo-700">
                  {selectedCheckoutItem ? `${selectedCheckoutItem.label}: ${selectedCheckoutItem.name}` : 'Belum ada item dipilih dari builder.'}
                </p>
              </div>
              {selectedCheckoutItem ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700">
                        {selectedCheckoutItem.label}
                      </div>
                      <h4 className="mt-3 text-lg font-black tracking-tight text-slate-900">{selectedCheckoutItem.name}</h4>
                      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-600">
                        {selectedCheckoutItem.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Harga</p>
                      <p className="mt-1 text-xl font-black tracking-tight text-slate-900">{formatRupiah(selectedCheckoutItem.price)}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">/{selectedCheckoutItem.billing}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Catatan Aktivasi</p>
                    <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-600">{selectedCheckoutItem.note}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Belum Ada Item Dipilih</p>
                  <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-600">
                    Pilih core, module, add-on, atau paket token dari builder supaya checkout target muncul di sini.
                  </p>
                </div>
              )}
              {selectedCheckoutDisabledReason && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-semibold leading-relaxed text-amber-900">
                  {selectedCheckoutDisabledReason}
                </div>
              )}
              <button
                type="button"
                disabled={processing || Boolean(selectedCheckoutDisabledReason) || !activeOrg || !selectedCheckoutItem}
                onClick={() => activeOrg && selectedCheckoutItem && handleBuyItem(activeOrg, selectedCheckoutItem)}
                className="w-full rounded-[24px] bg-slate-900 px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing ? 'Membuat Invoice...' : selectedCheckoutItem ? 'Buat Invoice & Lanjut Checkout' : 'Pilih Item Dulu'}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Invoice UNPAID</div>
                  <div className="mt-1 text-2xl font-black tracking-tight text-slate-900">{unpaidInvoiceCount}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Metode Bayar</div>
                  <div className="mt-1 text-sm font-black tracking-tight text-slate-900">Transfer Manual</div>
                </div>
              </div>
              <div id="ai-token" className="rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">AI Token Quick Top Up</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      Saldo saat ini {aiTokenBalance.toLocaleString('id-ID')} token. Estimasi {Math.floor(aiTokenBalance / 4000).toLocaleString('id-ID')}x generate.
                    </p>
                  </div>
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700">
                    3 Paket
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {quickAiTokenPackages.map((pkg: any) => {
                    const isSelected = selectedCheckoutItem?.type === 'AI_TOKEN_TOPUP' && selectedCheckoutItem.id === pkg.id
                    return (
                      <button
                        key={`quick-ai-${pkg.id}`}
                        type="button"
                        disabled={processing || !activeOrg}
                        onClick={() => setSelectedCheckoutItem(buildAiTokenCheckoutItem(pkg))}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                          isSelected
                            ? 'border-indigo-200 bg-indigo-50'
                            : 'border-slate-200 bg-slate-50 hover:border-indigo-200 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-700">{pkg.name}</div>
                          <div className="mt-1 text-[11px] font-semibold text-slate-500">
                            {Number(pkg.tokens || 0).toLocaleString('id-ID')} token
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900">{formatRupiah(Number(pkg.price_idr || 0))}</div>
                          <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                            {isSelected ? 'Dipilih' : 'Pilih'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              {inheritsPlanFromHolding && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Holding Rule</div>
                  <p className="mt-1 text-[11px] font-semibold text-amber-800">
                    Core package tetap mengikuti organisasi induk. Builder billing masih bisa dipakai untuk melihat compatibility dan add-on yang diizinkan.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      )}


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
