'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShieldCheck, 
  Users, 
  Building2,
  Package, 
  Plus, 
  Search, 
  Settings2, 
  CheckCircle2, 
  Edit3,
  Loader2,
  RefreshCw,
  X,
  Trash2,
  ReceiptText,
  Filter,
  LayoutGrid,
  List,
  MoreVertical,
  Edit2,
  XCircle,
  Mail,
  Database,
  Zap,
  ExternalLink,
  Coins,
  LogIn
} from 'lucide-react'
import { PageHeader, SectionCard, SectionHeader, SafeButton, StatusBadge, ConfirmDialog } from '@/components/ui/NizamUI'
import { createClient } from '@/lib/supabase/client'
import { deleteInactiveTenantByPlatformAdmin, signInAsTenantOwner } from '@/modules/auth/actions/auth.actions'
import { Organization } from '@/types/database.types'
import Link from 'next/link'
import { UserActivityMonitor } from '@/components/admin/UserActivityMonitor'
import {
  SAAS_ADDON_ITEMS,
  SAAS_FULL_CORE_EXTENSION_ITEMS,
  SAAS_PACKAGE_EDITOR_SECTIONS,
  SAAS_STARTER_CORE_ITEMS,
  SAAS_VERTICAL_MODULE_ITEMS,
  getSaasCapabilityDisplayLabel,
  getSaasPackageArchitecture,
  saasModuleMatches,
} from '@/lib/saas/module-catalog'
import {
  calculateAiHppPerGeneration,
  calculateAiRecommendedSellPer1kTokens,
  calculateAiRecommendedSellPerGeneration,
  normalizeAiTokenPolicy,
} from '@/modules/ai/lib/ai-token'

const supabase = createClient()

function isCapabilitySelected(values: readonly string[] | undefined, value: string) {
  if (!Array.isArray(values) || values.length === 0) return false

  if (value === 'Dashboard') {
    return values.some((moduleName) => String(moduleName || '').trim().toLowerCase() === 'dashboard')
  }

  return values.some((moduleName) => saasModuleMatches(String(moduleName || ''), value))
}

type OrganizationExpirySource = {
  subscription_end?: unknown
  settings?: Record<string, unknown> | null
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value) return null

  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function resolveOrganizationExpiryDate(org: OrganizationExpirySource | null | undefined): Date | null {
  const settings = org?.settings && typeof org.settings === 'object' ? org.settings : null
  const candidates = [
    parseOptionalDate(org?.subscription_end),
    parseOptionalDate(settings?.expires_at),
  ].filter((candidate): candidate is Date => candidate instanceof Date)

  if (candidates.length === 0) return null

  return candidates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest
  )
}

function formatDateInputValue(date: Date | null): string {
  if (!date) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function buildPlanExpiryIso(durationDays: number | null | undefined): string | null {
  if (typeof durationDays !== 'number' || durationDays <= 0) return null

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + durationDays)
  return expiresAt.toISOString()
}

type Tab = 'users' | 'packages' | 'invoices' | 'settings' | 'ai_tokens' | 'activity'

export default function SaaSAdminPage() {
  const db = supabase as any
  const [invoices, setInvoices] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [searchTxt, setSearchTxt] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'demo' | 'official'>('all')
  const [packageFilter, setPackageFilter] = useState<string>('all')
  const [saasSettings, setSaasSettings] = useState<any>({ bank_info: {}, support_info: {} })
  const [aiTokenPolicyRaw, setAiTokenPolicyRaw] = useState<any>({})
  const [aiTokenInventory, setAiTokenInventory] = useState<any>({ total_stock_tokens: 0 })
  const [aiTopupPackages, setAiTopupPackages] = useState<any[]>([])
  const [aiWalletSummary, setAiWalletSummary] = useState({
    totalBalance: 0,
    totalPurchased: 0,
    totalUsed: 0,
  })
  const [aiTopupModal, setAiTopupModal] = useState<{ open: boolean; editData: any | null }>({ open: false, editData: null })

  const aiPolicy = normalizeAiTokenPolicy(aiTokenPolicyRaw)
  const aiHppPerGenerate = calculateAiHppPerGeneration(aiPolicy)
  const aiRecommendedPerGenerate = calculateAiRecommendedSellPerGeneration(aiPolicy)
  const aiRecommendedPer1kToken = calculateAiRecommendedSellPer1kTokens(aiPolicy)
  const aiAvailableStock = Math.max(0, Number(aiTokenInventory?.total_stock_tokens || 0) - aiWalletSummary.totalBalance)

  useEffect(() => {
    async function fetchConfig() {
      const { data } = await db.from('saas_config').select('*')
      if (data) {
        const config: any = {}
        data.forEach((item: any) => config[item.key] = item.value)
        setSaasSettings(config)
      }
    }
    fetchConfig()
  }, [])

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const bank = { 
      bank: fd.get('bank_name'), 
      account: fd.get('bank_acc'), 
      name: fd.get('bank_user') 
    }
    const support = { 
      wa: fd.get('wa_num'), 
      label: fd.get('wa_label') 
    }
    
    const { error } = await db.from('saas_config').upsert([
      { key: 'bank_info', value: bank }, 
      { key: 'support_info', value: support }
    ])
    
    if (!error) {
      alert('✅ Pengaturan Global Berhasil Disimpan!')
      setSaasSettings({ bank_info: bank, support_info: support })
    } else {
      alert('❌ Gagal: ' + error.message)
    }
  }
  
  const [packages, setPackages] = useState<any[]>([])
  const [loadingPackages, setLoadingPackages] = useState(true)

  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ======== MODALS STATE ========
  const [pkgModal, setPkgModal] = useState<{ open: boolean; editData: any | null }>({ open: false, editData: null })
  const [orgModal, setOrgModal] = useState<{ open: boolean; editData: any | null }>({ open: false, editData: null })
  
  const [confirmState, setConfirmState] = useState<{ open: boolean, title: string, message: string, action: () => Promise<void> }>({
    open: false, title: '', message: '', action: async () => {}
  })
  const [loginAsPending, startLoginAsTransition] = useTransition()
  const [loginAsOrgId, setLoginAsOrgId] = useState<string | null>(null)
  const [tenantDeleteMode, setTenantDeleteMode] = useState(false)
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null)

  // State local untuk helper set date di modal org
  const [modalExpireDate, setModalExpireDate] = useState('')
  

  const fetchOrganizations = async () => {
    try {
      setLoading(true)
      const { data, error } = await db.from('organizations').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setOrgs(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchPackages = async () => {
    try {
      setLoadingPackages(true)
      const { data, error } = await db.from('saas_packages').select('*').order('price', { ascending: true })
      
      if (error) throw error

      const formatted = (data || []).map((p: any) => ({
        ...p,
        active: p.is_active, 
        modules: Array.isArray(p.modules) ? p.modules : JSON.parse(p.modules || '[]'),
        addons: Array.isArray(p.addons) ? p.addons : JSON.parse(p.addons || '[]')
      }))
      setPackages(formatted)
    } catch (err: any) {
    } finally {
      setLoadingPackages(false)
    }
  }

  const fetchInvoices = async () => {
    const { data } = await db.from('saas_invoices').select(`
      *,
      organization:organizations(name),
      package:saas_packages(name, modules, duration_days, max_orgs, max_warehouses)
    `).order('created_at', { ascending: false })
    if (data) setInvoices(data)
  }

  const fetchAiTokenData = async () => {
    const { data: configRows } = await db
      .from('saas_config')
      .select('*')
      .in('key', ['ai_token_policy', 'ai_token_inventory'])

    const config: any = {}
    ;(configRows || []).forEach((row: any) => {
      config[row.key] = row.value
    })
    setAiTokenPolicyRaw(config.ai_token_policy || {})
    setAiTokenInventory(config.ai_token_inventory || { total_stock_tokens: 0 })

    const { data: topupRows } = await db
      .from('ai_token_topup_packages')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('tokens', { ascending: true })

    setAiTopupPackages(topupRows || [])

    const { data: walletRows } = await db
      .from('ai_token_wallets')
      .select('balance_tokens, total_purchased_tokens, total_used_tokens')

    const summary = (walletRows || []).reduce(
      (acc: { totalBalance: number; totalPurchased: number; totalUsed: number }, wallet: any) => {
        acc.totalBalance += Number(wallet.balance_tokens || 0)
        acc.totalPurchased += Number(wallet.total_purchased_tokens || 0)
        acc.totalUsed += Number(wallet.total_used_tokens || 0)
        return acc
      },
      { totalBalance: 0, totalPurchased: 0, totalUsed: 0 },
    )

    setAiWalletSummary(summary)
  }

  const saveAiTokenConfig = async () => {
    const policyValue = {
      cost_per_1k_input_idr: Number(aiPolicy.costPer1kInputIdr || 0),
      cost_per_1k_output_idr: Number(aiPolicy.costPer1kOutputIdr || 0),
      avg_input_tokens: Number(aiPolicy.avgInputTokens || 0),
      avg_output_tokens: Number(aiPolicy.avgOutputTokens || 0),
      tokens_per_generation: Number(aiPolicy.tokensPerGeneration || 0),
      overhead_percent: Number(aiPolicy.overheadPercent || 0),
      margin_percent: Number(aiPolicy.marginPercent || 0),
      low_balance_threshold: Number(aiPolicy.lowBalanceThreshold || 0),
    }

    const inventoryValue = {
      total_stock_tokens: Number(aiTokenInventory?.total_stock_tokens || 0),
    }

    const { error } = await db.from('saas_config').upsert([
      { key: 'ai_token_policy', value: policyValue },
      { key: 'ai_token_inventory', value: inventoryValue },
    ])

    if (error) {
      alert('❌ Gagal menyimpan pengaturan token AI: ' + error.message)
      return
    }

    alert('✅ Konfigurasi token AI berhasil disimpan.')
    await fetchAiTokenData()
  }

  const saveAiTopupPackageForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: String(fd.get('name') || '').trim(),
      description: String(fd.get('description') || '').trim(),
      tokens: Number(fd.get('tokens') || 0),
      price_idr: Number(fd.get('price_idr') || 0),
      cost_idr: Number(fd.get('cost_idr') || 0),
      sort_order: Number(fd.get('sort_order') || 0),
      is_active: fd.get('is_active') === 'on',
    }

    if (!payload.name || payload.tokens <= 0) {
      alert('Nama paket dan jumlah token wajib valid.')
      return
    }

    const { error } = aiTopupModal.editData?.id
      ? await db.from('ai_token_topup_packages').update(payload).eq('id', aiTopupModal.editData.id)
      : await db.from('ai_token_topup_packages').insert(payload)

    if (error) {
      alert('❌ Gagal menyimpan paket topup: ' + error.message)
      return
    }

    alert('✅ Paket topup token berhasil disimpan.')
    setAiTopupModal({ open: false, editData: null })
    await fetchAiTokenData()
  }

  const toggleAiTopupStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await db
      .from('ai_token_topup_packages')
      .update({ is_active: !currentStatus })
      .eq('id', id)

    if (error) {
      alert('❌ Gagal mengubah status paket topup: ' + error.message)
      return
    }

    await fetchAiTokenData()
  }

  const handleDeleteAiTopupPackage = (id: string, name: string) => {
    setConfirmState({
      open: true,
      title: 'Hapus Paket Topup?',
      message: `Paket token "${name}" akan dihapus permanen. Lanjutkan?`,
      action: async () => {
        const { error } = await db.from('ai_token_topup_packages').delete().eq('id', id)
        if (error) {
          alert(error.message)
        } else {
          await fetchAiTokenData()
        }
        setConfirmState(prev => ({ ...prev, open: false }))
      },
    })
  }

  const approveInvoice = async (invoice: any) => {
    const pkg = invoice.package
    const isAddon = !invoice.package_id
    
    // 1. Update status invoice jadi PAID
    const { error: invErr } = await db.from('saas_invoices').update({ status: 'PAID' }).eq('id', invoice.id)
    if (invErr) return alert('Gagal update invoice: ' + invErr.message)

    // 1.1 Jika ini invoice topup token AI, lakukan kredit token ke wallet org
    const { data: tokenOrder } = await db
      .from('ai_token_topup_orders')
      .select('*')
      .eq('invoice_id', invoice.id)
      .maybeSingle()

    if (tokenOrder) {
      const tokenAmount = Number(tokenOrder.tokens || 0)
      const { data: wallet } = await db
        .from('ai_token_wallets')
        .select('*')
        .eq('org_id', invoice.org_id)
        .maybeSingle()

      if (wallet?.org_id) {
        const { error: walletUpdateError } = await db
          .from('ai_token_wallets')
          .update({
            balance_tokens: Number(wallet.balance_tokens || 0) + tokenAmount,
            total_purchased_tokens: Number(wallet.total_purchased_tokens || 0) + tokenAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('org_id', invoice.org_id)

        if (walletUpdateError) {
          return alert('Gagal update saldo token AI: ' + walletUpdateError.message)
        }
      } else {
        const { error: walletCreateError } = await db
          .from('ai_token_wallets')
          .insert({
            org_id: invoice.org_id,
            balance_tokens: tokenAmount,
            total_purchased_tokens: tokenAmount,
            total_used_tokens: 0,
            low_balance_threshold: aiPolicy.lowBalanceThreshold,
          })

        if (walletCreateError) {
          return alert('Gagal membuat wallet token AI: ' + walletCreateError.message)
        }
      }

      await db.from('ai_token_usage_logs').insert({
        org_id: invoice.org_id,
        source: 'topup',
        direction: 'CREDIT',
        tokens: tokenAmount,
        related_invoice_id: invoice.id,
        note: `Topup AI token dari paket ${tokenOrder.package_id}`,
        meta: {
          topup_order_id: tokenOrder.id,
          package_id: tokenOrder.package_id,
        },
      })

      await db
        .from('ai_token_topup_orders')
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tokenOrder.id)

      alert('✅ Topup token AI berhasil dikonfirmasi dan saldo tenant sudah ditambahkan.')
      fetchInvoices()
      fetchAiTokenData()
      return
    }

    if (isAddon) {
      // HANDLE ADDON ACTIVATION
      const { data: org, error: orgLookupError } = await db
        .from('organizations')
        .select('active_addons, settings')
        .eq('id', invoice.org_id)
        .single()
      if (orgLookupError) return alert('Gagal membaca data organisasi: ' + orgLookupError.message)

      const currentAddons = Array.isArray(org?.active_addons) ? org.active_addons : []
      const newAddon = {
        id: invoice.id, // linked to invoice
        name: invoice.item_name,
        activated_at: new Date().toISOString()
      }
      
      const { error: addonErr } = await db.from('organizations').update({
        active_addons: [...currentAddons, newAddon]
      }).eq('id', invoice.org_id)
      
      if (addonErr) return alert('Gagal aktivasi add-on: ' + addonErr.message)
    } else {
      // HANDLE PLAN UPGRADE
      const { data: org, error: orgLookupError } = await db
        .from('organizations')
        .select('settings')
        .eq('id', invoice.org_id)
        .single()
      if (orgLookupError) return alert('Gagal membaca data organisasi: ' + orgLookupError.message)

      const expiresAt = buildPlanExpiryIso(pkg?.duration_days)
      const currentSettings =
        org?.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
          ? org.settings
          : {}

      const { error: orgErr } = await db.from('organizations').update({
        settings: {
          ...currentSettings,
          plan: pkg?.name || 'Pro',
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        },
        subscription_end: expiresAt,
        package_limit: {
          max_orgs: pkg?.max_orgs || 1,
          max_warehouses: pkg?.max_warehouses || 1
        }
      }).eq('id', invoice.org_id)

      if (orgErr) return alert('Gagal update plan organisasi: ' + orgErr.message)
    }

    alert('✅ Pembayaran Berhasil Dikonfirmasi & Item Aktif!')
    fetchInvoices()
    fetchAiTokenData()
  }

  const cancelInvoice = async (id: string) => {
    const { error } = await db.from('saas_invoices').update({ status: 'CANCELLED' }).eq('id', id)
    if (error) alert('Gagal membatalkan: ' + error.message)
    else fetchInvoices()
  }

  const deleteInvoice = async (id: string) => {
    setConfirmState({
      open: true,
      title: "Hapus Tagihan?",
      message: "Data tagihan akan dihapus permanen dari sistem (Soft-delete not applied). Lanjutkan?",
      action: async () => {
        const { error } = await db.from('saas_invoices').delete().eq('id', id)
        if (error) alert(error.message)
        else fetchInvoices()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  useEffect(() => {
    fetchOrganizations()
    fetchPackages()
    fetchInvoices()
    fetchAiTokenData()
  }, [])

  const togglePackageStatus = async (pkgId: string, currentStatus: boolean) => {
    setPackages(packages.map(p => p.id === pkgId ? { ...p, active: !p.active } : p))
    try {
       await db.from('saas_packages').update({ is_active: !currentStatus }).eq('id', pkgId)
    } catch (err) {}
  }

  const handleDeletePackage = (id: string) => {
    setConfirmState({
      open: true,
      title: "Hapus Paket?",
      message: "Tindakan ini tidak dapat dibatalkan. Konfirmasi penghapusan paket SaaS?",
      action: async () => {
         const { error } = await db.from('saas_packages').delete().eq('id', id)
        if (error) {
           alert("Gagal menghapus paket: " + error.message)
        }
        await fetchPackages()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  const savePackageForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const fd = new FormData(e.currentTarget)
      const modules = Array.from(
        new Set(
          fd.getAll('modules')
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      )
      const addons = Array.from(
        new Set(
          fd.getAll('addons')
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      )
      const payload = {
        name: fd.get('name') as string,
        price: Number(fd.get('price')),
        billing: fd.get('billing') as string,
        is_active: true,
        modules: JSON.stringify(modules), // PostgREST requires stringified array for jsonb column
        addons: JSON.stringify(addons),
        duration_days: Number(fd.get('duration_days') || 30),
        max_orgs: Number(fd.get('max_orgs') || 1),
        max_warehouses: Number(fd.get('max_warehouses') || 1),
        max_branches: fd.get('max_branches') ? Number(fd.get('max_branches')) : null,
        max_child_orgs: fd.get('max_child_orgs') ? Number(fd.get('max_child_orgs')) : null,
        max_users: fd.get('max_users') ? Number(fd.get('max_users')) : null,
      }

      const { error } = pkgModal.editData?.id
        ? await (db.from('saas_packages').update(payload).eq('id', pkgModal.editData.id) as any)
        : await (db.from('saas_packages').upsert([payload], { onConflict: 'name' }) as any)

      if (error) throw error
      alert('✅ Paket Berhasil Disimpan!')
      setPkgModal({ open: false, editData: null })
      fetchPackages()
    } catch (err: any) {
      alert('❌ Gagal: ' + err.message)
    }
  }

  const saveOrgForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const fd = new FormData(e.currentTarget)
      const expiresVal = fd.get('expires_at') as string
      const existingExpiry = resolveOrganizationExpiryDate(orgModal.editData as OrganizationExpirySource)
      const expiresAt = expiresVal
        ? new Date(expiresVal).toISOString()
        : (existingExpiry?.toISOString() || null)
      const currentSettings =
        orgModal.editData?.settings &&
        typeof orgModal.editData.settings === 'object' &&
        !Array.isArray(orgModal.editData.settings)
          ? orgModal.editData.settings
          : {}
      
      const payload = {
         name: fd.get('name'),
         is_active: fd.get('is_active') === 'on',
         is_demo: fd.get('is_demo') === 'on',
         owner_email: fd.get('owner_email'),
         subscription_end: expiresAt,
         settings: {
            ...currentSettings,
            plan: fd.get('plan'),
            expires_at: expiresAt,
         }
      }

      if (orgModal.editData?.id) {
         await db.from('organizations').update(payload).eq('id', orgModal.editData.id)
      } else {
         const slug = (fd.get('name') as string).toLowerCase().replace(/ /g, '-') + '-' + Math.random().toString(36).substring(2,5)
         await db.from('organizations').insert([{ ...payload, slug }])
      }

      setOrgModal({ open: false, editData: null })
      setModalExpireDate('') // Reset local state
      fetchOrganizations()
    } catch (err: any) {
       alert(err.message)
    }
  }

  const handleDeleteOrg = (org: Organization) => {
     if (!tenantDeleteMode) {
        alert('Aktifkan Mode Hapus Tenant Nonaktif terlebih dahulu.')
        return
     }

     if (org.is_active) {
        alert(`Tenant "${org.name}" masih aktif. Ubah status ke Suspended terlebih dahulu sebelum menghapus.`)
        return
     }

     setConfirmState({
        open: true,
        title: "Hapus Tenant?",
        message: `PERINGATAN: Tenant nonaktif "${org.name}" akan dihapus permanen beserta seluruh data terkait. Lanjutkan?`,
        action: async () => {
           setDeletingOrgId(org.id)
           try {
             const result = await deleteInactiveTenantByPlatformAdmin(org.id)
             if (result?.error) {
               alert(result.error)
             } else {
               await fetchOrganizations()
             }
           } finally {
             setDeletingOrgId(null)
             setConfirmState(prev => ({ ...prev, open: false }))
           }
        }
     })
  }

  const filteredOrgs = orgs.filter(o => {
     const matchesSearch = o.name.toLowerCase().includes(searchTxt.toLowerCase()) || (o as any).owner_email?.toLowerCase().includes(searchTxt.toLowerCase())
     const matchesType = typeFilter === 'all' ? true : (typeFilter === 'demo' ? (o as any).is_demo : !(o as any).is_demo)
     const matchesPkg = packageFilter === 'all' ? true : (o.settings as any)?.plan === packageFilter
     return matchesSearch && matchesType && matchesPkg
  })

  const handleLoginAsTenant = (org: Organization) => {
    const ownerEmail = String((org as any).owner_email || '').trim()
    const confirmText = ownerEmail
      ? `Sesi admin saat ini akan diganti dengan sesi tenant ${org.name} (${ownerEmail}). Lanjutkan login as owner?`
      : `Sesi admin saat ini akan diganti dengan sesi tenant ${org.name}. Lanjutkan login as owner?`

    if (!window.confirm(confirmText)) {
      return
    }

    setLoginAsOrgId(org.id)
    startLoginAsTransition(async () => {
      const result = await signInAsTenantOwner(org.id)

      if (result?.error) {
        alert(result.error)
        setLoginAsOrgId(null)
      }
    })
  }

  return (
    <div className="p-8 pb-32 max-w-[1600px] mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4 italic uppercase">
               <ShieldCheck size={48} className="text-blue-600" /> Control Center
            </h1>
            <p className="text-slate-400 font-bold text-sm tracking-widest mt-1 uppercase">NIZAM SaaS Platform Administration</p>
         </div>
	         <div className="flex gap-4">
	            <button onClick={() => setActiveTab('users')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Tenants</button>
	            <button onClick={() => setActiveTab('activity')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'activity' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Activity</button>
	            <button onClick={() => setActiveTab('packages')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'packages' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>SaaS Plans</button>
	            <button onClick={() => setActiveTab('ai_tokens')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ai_tokens' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>AI Tokens</button>
	            <button onClick={() => setActiveTab('invoices')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'invoices' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Billing</button>
	            <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Settings</button>
	         </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
	          {activeTab === 'activity' && <UserActivityMonitor />}

	          {activeTab === 'ai_tokens' && (
	            <div className="space-y-8">
	              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
	                <SectionCard>
	                  <div className="p-5 space-y-2">
	                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stok Provider</p>
	                    <p className="text-2xl font-black text-slate-900 tracking-tight">{Number(aiTokenInventory?.total_stock_tokens || 0).toLocaleString('id-ID')}</p>
	                  </div>
	                </SectionCard>
	                <SectionCard>
	                  <div className="p-5 space-y-2">
	                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Tenant Aktif</p>
	                    <p className="text-2xl font-black text-slate-900 tracking-tight">{aiWalletSummary.totalBalance.toLocaleString('id-ID')}</p>
	                  </div>
	                </SectionCard>
	                <SectionCard>
	                  <div className="p-5 space-y-2">
	                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stok Tersedia</p>
	                    <p className={`text-2xl font-black tracking-tight ${aiAvailableStock < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
	                      {aiAvailableStock.toLocaleString('id-ID')}
	                    </p>
	                  </div>
	                </SectionCard>
	                <SectionCard>
	                  <div className="p-5 space-y-2">
	                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pemakaian Total</p>
	                    <p className="text-2xl font-black text-slate-900 tracking-tight">{aiWalletSummary.totalUsed.toLocaleString('id-ID')}</p>
	                  </div>
	                </SectionCard>
	              </div>

	              <SectionCard>
	                <div className="p-6 space-y-6">
	                  <div>
	                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Konfigurasi Biaya & Pricing Token AI</h3>
	                    <p className="text-sm font-medium text-slate-500 mt-1">Atur input cost, overhead, margin, dan stok global token untuk kalkulasi HPP otomatis.</p>
	                  </div>
	                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Biaya Input / 1K (IDR)</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.costPer1kInputIdr}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, cost_per_1k_input_idr: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Biaya Output / 1K (IDR)</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.costPer1kOutputIdr}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, cost_per_1k_output_idr: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Avg Input Tokens</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.avgInputTokens}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, avg_input_tokens: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Avg Output Tokens</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.avgOutputTokens}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, avg_output_tokens: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                  </div>

	                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Token / Generate</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.tokensPerGeneration}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, tokens_per_generation: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Overhead (%)</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.overheadPercent}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, overhead_percent: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Margin (%)</label>
	                      <input
	                        type="number"
	                        value={aiPolicy.marginPercent}
	                        onChange={(e) => setAiTokenPolicyRaw((prev: any) => ({ ...prev, margin_percent: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                    <div>
	                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Stok Token Global</label>
	                      <input
	                        type="number"
	                        value={Number(aiTokenInventory?.total_stock_tokens || 0)}
	                        onChange={(e) => setAiTokenInventory((prev: any) => ({ ...prev, total_stock_tokens: Number(e.target.value || 0) }))}
	                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold"
	                      />
	                    </div>
	                  </div>

	                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
	                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
	                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">HPP / Generate</div>
	                      <div className="mt-1 text-lg font-black text-slate-900">Rp {Math.ceil(aiHppPerGenerate).toLocaleString('id-ID')}</div>
	                    </div>
	                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
	                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rekomendasi / Generate</div>
	                      <div className="mt-1 text-lg font-black text-emerald-700">Rp {Math.ceil(aiRecommendedPerGenerate).toLocaleString('id-ID')}</div>
	                    </div>
	                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
	                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rekomendasi / 1K Token</div>
	                      <div className="mt-1 text-lg font-black text-indigo-700">Rp {Math.ceil(aiRecommendedPer1kToken).toLocaleString('id-ID')}</div>
	                    </div>
	                  </div>

	                  <div className="flex justify-end">
	                    <SafeButton variant="primary" onClick={saveAiTokenConfig} icon={<Coins size={16} />}>
	                      Simpan Konfigurasi Token AI
	                    </SafeButton>
	                  </div>
	                </div>
	              </SectionCard>

	              <SectionCard>
	                <div className="p-6 space-y-5">
	                  <div className="flex items-center justify-between gap-4">
	                    <div>
	                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Paket Top Up Token AI</h3>
	                      <p className="text-sm font-medium text-slate-500 mt-1">Kelola paket yang akan tampil di halaman billing tenant.</p>
	                    </div>
	                    <SafeButton variant="primary" onClick={() => setAiTopupModal({ open: true, editData: null })} icon={<Plus size={16} />}>
	                      Tambah Paket Token
	                    </SafeButton>
	                  </div>

	                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
	                    {aiTopupPackages.map((pkg) => (
	                      <div key={pkg.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
	                        <div className="flex items-center justify-between gap-3">
	                          <div className="text-sm font-black text-slate-900">{pkg.name}</div>
	                          <button
	                            onClick={() => toggleAiTopupStatus(pkg.id, Boolean(pkg.is_active))}
	                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pkg.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
	                          >
	                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pkg.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
	                          </button>
	                        </div>
	                        <div className="mt-4 text-3xl font-black tracking-tighter text-slate-900">{Number(pkg.tokens || 0).toLocaleString('id-ID')}</div>
	                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Token</div>
	                        <div className="mt-3 text-xs font-bold text-slate-500">{pkg.description || '-'}</div>
	                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
	                          <div>
	                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sell Price</div>
	                            <div className="text-sm font-black text-slate-900">Rp {Number(pkg.price_idr || 0).toLocaleString('id-ID')}</div>
	                          </div>
	                          <div className="flex gap-2">
	                            <button onClick={() => setAiTopupModal({ open: true, editData: pkg })} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
	                              <Edit3 size={16} />
	                            </button>
	                            <button onClick={() => handleDeleteAiTopupPackage(pkg.id, pkg.name)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
	                              <Trash2 size={16} />
	                            </button>
	                          </div>
	                        </div>
	                      </div>
	                    ))}
	                  </div>
	                </div>
	              </SectionCard>
	            </div>
	          )}

	          {activeTab === 'settings' && (
            <div className="max-w-4xl space-y-8">
               <SectionHeader title="SaaS Platform Settings" subtitle="Konfigurasi rekening bank & bantuan WA secara global." />
               <form onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SectionCard>
                    <div className="p-6 space-y-4">
                       <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-indigo-600 border-b pb-3 mb-4">
                          <Building2 size={18} /> Bank Info (Main Account)
                       </h4>
                       <div className="space-y-4">
                          <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nama Bank</label>
                             <input name="bank_name" defaultValue={saasSettings.bank_info?.bank} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold" />
                          </div>
                          <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nomor Rekening</label>
                             <input name="bank_acc" defaultValue={saasSettings.bank_info?.account} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-mono text-lg font-black tracking-widest" />
                          </div>
                          <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Atas Nama (Pemilik)</label>
                             <input name="bank_user" defaultValue={saasSettings.bank_info?.name} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold" />
                          </div>
                       </div>
                    </div>
                  </SectionCard>

                  <SectionCard>
                    <div className="p-6 space-y-4">
                       <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-emerald-600 border-b pb-3 mb-4">
                          <Mail size={18} /> Support Contacts
                       </h4>
                       <div className="space-y-4">
                          <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">WhatsApp (62xxx)</label>
                             <input name="wa_num" defaultValue={saasSettings.support_info?.wa} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold" />
                          </div>
                          <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Label / Nama CS</label>
                             <input name="wa_label" defaultValue={saasSettings.support_info?.label} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold" />
                          </div>
                          <div className="pt-6">
                            <SafeButton type="submit" variant="primary" size="lg" className="w-full">Simpan Pengaturan</SafeButton>
                          </div>
                       </div>
                    </div>
                  </SectionCard>
               </form>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                <div className="lg:col-span-2 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    value={searchTxt}
                    onChange={(e) => setSearchTxt(e.target.value)}
                    placeholder="Cari tenant / email pemilik..." 
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Tipe Akun</label>
                  <select 
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  >
                    <option value="all">Semua Tipe</option>
                    <option value="official">Resmi / Produksi</option>
                    <option value="demo">Demo / Latihan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 ml-1 tracking-widest">Filter Paket</label>
                  <select 
                    value={packageFilter}
                    onChange={(e) => setPackageFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  >
                    <option value="all">Semua Paket</option>
                    {packages.map(p => <option key={p.id||p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                 <SafeButton variant="primary" onClick={() => setOrgModal({ open: true, editData: null })} icon={<Plus size={18} />}>Registrasi Tenant Baru</SafeButton>
                 <SafeButton
                   variant={tenantDeleteMode ? 'danger' : 'white'}
                   onClick={() => setTenantDeleteMode(prev => !prev)}
                   icon={tenantDeleteMode ? <X size={18} /> : <Trash2 size={18} />}
                 >
                   {tenantDeleteMode ? 'Keluar Mode Hapus' : 'Mode Hapus Tenant Nonaktif'}
                 </SafeButton>
                 <button onClick={fetchOrganizations} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
              </div>

              {tenantDeleteMode && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                  Mode hapus aktif: hanya tenant berstatus <span className="font-black">Suspended</span> yang dapat dihapus.
                </div>
              )}

              <SectionCard>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Organisasi / Pemilik</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Tipe</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Paket / Plan</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Masa Berlaku</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                        <th className="text-right py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredOrgs.map((org) => {
                        const expiryDate = resolveOrganizationExpiryDate(org as OrganizationExpirySource)
                        const expiryTime = expiryDate?.getTime() ?? null
                        const daysRemaining = expiryTime
                          ? Math.ceil((expiryTime - Date.now()) / (1000 * 60 * 60 * 24))
                          : null

                        return (
                          <tr key={org.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6">
                            <div>
                               <p className="font-bold text-slate-900">{org.name}</p>
                               <p className="text-[10px] text-blue-600 font-black flex items-center gap-1.5 mt-0.5">
                                  <Mail size={12} /> {(org as any).owner_email || 'No Email'}
                               </p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {(org as any).is_demo ? 
                              <span className="px-2.5 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase rounded-lg border border-orange-100 flex items-center gap-1 w-fit"><Settings2 size={10} /> Demo</span> : 
                              <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg border border-blue-100 flex items-center gap-1 w-fit"><CheckCircle2 size={10} /> Official</span>
                            }
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm font-bold text-slate-700">{(org.settings as any)?.plan || 'Basic'}</span>
                          </td>
                          <td className="py-4 px-6">
                            {expiryDate && expiryTime !== null && daysRemaining !== null ? (
                              <div className="flex flex-col gap-0.5">
                                <p className={`text-xs font-black tabular-nums ${
                                  expiryTime < Date.now()
                                    ? 'text-rose-600' 
                                    : (expiryTime - Date.now() < 7 * 24 * 60 * 60 * 1000 ? 'text-orange-500' : 'text-slate-900')
                                }`}>
                                  {daysRemaining} Hari
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight italic">
                                  s/d {expiryDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-300 italic">Unlimited / No Data</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <StatusBadge variant={org.is_active ? 'success' : 'neutral'} label={org.is_active ? 'Running' : 'Suspended'} />
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleLoginAsTenant(org)}
                                disabled={loginAsPending}
                                title="Login sebagai owner tenant ini"
                                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-emerald-700 transition-all hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
                              >
                                {loginAsPending && loginAsOrgId === org.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <LogIn size={14} />
                                )}
                                <span>Login As</span>
                              </button>
                              <button onClick={() => setOrgModal({ open: true, editData: org })} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                 <Edit3 size={18} />
                              </button>
                              {tenantDeleteMode && (
                                <button
                                  onClick={() => handleDeleteOrg(org)}
                                  disabled={org.is_active || deletingOrgId === org.id}
                                  title={org.is_active ? 'Hanya tenant Suspended yang bisa dihapus.' : 'Hapus tenant nonaktif'}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                                >
                                  {deletingOrgId === org.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                </button>
                              )}
                            </div>
                          </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === 'packages' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                 <p className="text-sm font-bold text-slate-500 italic">Daftar Paket SaaS Aktif</p>
                 <SafeButton variant="primary" onClick={() => setPkgModal({ open: true, editData: null })} icon={<Plus size={16} />}>Tambah Paket Baru</SafeButton>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 {packages.map((pkg) => {
                    const architecture = getSaasPackageArchitecture(pkg.modules || [], pkg.addons || [])
                    const totalCoreItems = architecture.liteCore.length + architecture.starterCore.length
                    return (
                    <div key={pkg.id || pkg.name} className={`
                      relative p-6 rounded-[32px] border transition-all duration-300 shadow-sm flex flex-col justify-between
                      ${pkg.active ? 'bg-white border-slate-200 hover:shadow-xl hover:-translate-y-1' : 'bg-slate-50/50 border-slate-200 opacity-75 grayscale-[30%]'}
                    `}>
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-widest uppercase border shadow-sm ${pkg.active ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                            {pkg.name}
                          </div>
                          <div className="flex gap-1">
                             <button onClick={() => setPkgModal({ open: true, editData: pkg })} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Edit3 size={16} />
                             </button>
                             <button onClick={() => handleDeletePackage(pkg.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                <Trash2 size={16} />
                             </button>
                          </div>
                        </div>

                        <div className="mb-6 space-y-1">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black font-mono text-slate-900 tracking-tighter">
                              {pkg.price === 0 ? `Free` : `Rp ${pkg.price.toLocaleString('id-ID')}`}
                            </span>
                            {pkg.price > 0 && <span className="text-xs text-slate-400 font-bold">/{pkg.billing}</span>}
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
                            {architecture.bundleLabel}
                          </p>
                          <p className={`text-[10px] font-black uppercase tracking-wider ${pkg.price === 0 ? 'text-orange-500' : 'text-emerald-600'}`}>
                            Batas: {pkg.duration_days ?? '?'} Hari
                          </p>
                        </div>

                        <div className="space-y-4 mb-4">
                           <div className="flex flex-wrap gap-1.5">
                              {pkg.modules?.slice(0, 4).map((mod: string) => (
                                 <span key={mod} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                   {getSaasCapabilityDisplayLabel(mod)}
                                 </span>
                              ))}
                              {pkg.modules?.length > 4 && <span className="text-[9px] font-bold text-slate-400">+{pkg.modules.length - 4} more</span>}
                           </div>
                           <p className="text-[10px] font-semibold text-slate-400">
                             Platform Core + {totalCoreItems} core item
                             {architecture.fullCoreExtensions.length > 0 ? ` + ${architecture.fullCoreExtensions.length} full core` : ''}
                             {architecture.verticalModules.length > 0 ? ` + ${architecture.verticalModules.length} vertical module` : ''}
                           </p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-600">Status</span>
                         <button
                            onClick={() => togglePackageStatus(pkg.id, pkg.active)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pkg.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                         >
                           <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pkg.active ? 'translate-x-6' : 'translate-x-1'}`} />
                         </button>
                      </div>
                    </div>
                    )
                 })}
              </div>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50">
                     <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="px-8 py-5">Tanggal</th>
                        <th className="px-8 py-5">Tenant / Bisnis</th>
                        <th className="px-8 py-5">Paket / Add-on</th>
                        <th className="px-8 py-5 text-right">Nominal</th>
                        <th className="px-8 py-5 text-center">Status</th>
                        <th className="px-8 py-5 text-right">Aksi</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="px-8 py-5 text-xs font-bold text-slate-500">
                              {new Date(inv.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                           </td>
                           <td className="px-8 py-5">
                              <p className="text-sm font-black text-slate-900">{inv.organization?.name || 'Unknown'}</p>
                              <code className="text-[9px] text-slate-400 font-mono">#{inv.invoice_number}</code>
                           </td>
                           <td className="px-8 py-5">
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 italic">
                                 {inv.item_name || inv.package?.name || 'Nizam Package'}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-sm font-black text-slate-900 text-right tabular-nums">
                              Rp {inv.amount?.toLocaleString('id-ID')}
                           </td>
                           <td className="px-8 py-5 text-center">
                              <div className="flex flex-col items-center gap-1">
                                 <StatusBadge label={inv.status} variant={inv.status === 'PAID' ? 'success' : 'warning'} />
                                 {inv.payment_proof_url && (
                                    <a href={inv.payment_proof_url} target="_blank" className="text-[9px] font-black text-blue-600 hover:underline uppercase flex items-center gap-1">
                                       <ExternalLink size={10} /> Lihat Bukti
                                    </a>
                                 )}
                              </div>
                           </td>
                           <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                 {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                                    <button 
                                       onClick={() => approveInvoice(inv)} 
                                       className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                                    >
                                       Konfirmasi
                                    </button>
                                 )}
                                 
                                 {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                                    <button 
                                       onClick={() => cancelInvoice(inv.id)} 
                                       title="Batalkan Invoice"
                                       className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                                    >
                                       <XCircle size={18} />
                                    </button>
                                 )}

                                 <button 
                                    onClick={() => deleteInvoice(inv.id)} 
                                    title="Hapus Permanen"
                                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                 >
                                    <Trash2 size={18} />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ORG MODAL */}
      <AnimatePresence>
         {orgModal.open && (
           <div key="org-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div key="org-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOrgModal({ open: false, editData: null })} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div key="org-modal-content" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl p-10 overflow-hidden border border-white">
                 <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight mb-8">
                    {orgModal.editData ? 'Edit Data Tenant' : 'Registrasi Tenant Manual'}
                 </h2>
                 <form onSubmit={saveOrgForm} className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Organisasi</label>
                       <input name="name" required defaultValue={orgModal.editData?.name} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Pemilik (Login Akun)</label>
                       <input name="owner_email" required type="email" defaultValue={orgModal.editData?.owner_email} placeholder="email@perusahaan.com" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paket SaaS</label>
                           <select name="plan" defaultValue={orgModal.editData?.settings?.plan || 'Demo'} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                              <option value="Demo">Demo</option>
                              {packages.map(p => (
                                 <option key={p.id} value={p.name}>{p.name}</option>
                              ))}
                           </select>
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between items-center ml-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masa Berlaku (Expire Date)</label>
                              <div className="flex gap-1">
                                 {[3, 5, 30].map(days => (
                                    <button 
                                       key={days}
                                       type="button"
                                       onClick={() => {
                                          const d = new Date()
                                          d.setDate(d.getDate() + days)
                                          setModalExpireDate(formatDateInputValue(d))
                                       }}
                                       className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-600 hover:text-white rounded text-[8px] font-black transition-colors"
                                    >
                                       +{days} Hari
                                    </button>
                                 ))}
                              </div>
                           </div>
                           <input 
                              name="expires_at" 
                              type="date" 
                              value={modalExpireDate || formatDateInputValue(resolveOrganizationExpiryDate(orgModal.editData as OrganizationExpirySource))} 
                              onChange={(e) => setModalExpireDate(e.target.value)}
                              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" 
                           />
                        </div>
                    </div>
                    <div className="flex gap-4 items-center h-full pt-6">
                           <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" name="is_demo" defaultChecked={orgModal.editData?.is_demo} className="w-5 h-5 rounded-lg text-orange-500" />
                              <span className="text-[10px] font-bold uppercase text-slate-500">Demo?</span>
                           </label>
                           <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" name="is_active" defaultChecked={orgModal.editData?.is_active ?? true} className="w-5 h-5 rounded-lg text-emerald-500" />
                              <span className="text-[10px] font-bold uppercase text-slate-500">Active?</span>
                           </label>
                    </div>
                    <div className="flex justify-end gap-4 pt-6">
                       <button type="button" onClick={() => setOrgModal({ open: false, editData: null })} className="px-6 py-4 text-xs font-black uppercase text-slate-400">Batal</button>
                       <SafeButton type="submit" variant="primary">Simpan Tenant</SafeButton>
                    </div>
                 </form>
              </motion.div>
           </div>
         )}
      </AnimatePresence>

      {/* PKG MODAL */}
      <AnimatePresence>
         {pkgModal.open && (
           <div key="pkg-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div key="pkg-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPkgModal({ open: false, editData: null })} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div key="pkg-modal-content" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl p-10 overflow-hidden border border-white">
                 <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight mb-8">
                    {pkgModal.editData ? 'Edit Paket SaaS' : 'Buat Paket SaaS Baru'}
                 </h2>
                 <form onSubmit={savePackageForm} className="space-y-6 max-h-[70vh] overflow-y-auto px-1 pr-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Paket</label>
                          <input name="name" required defaultValue={pkgModal.editData?.name} placeholder="e.g. Basic, Pro" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe Billing</label>
                          <select name="billing" defaultValue={pkgModal.editData?.billing || 'Bulan'} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                             <option value="Bulan">Bulan</option>
                             <option value="Tahun">Tahun</option>
                             <option value="Sekali">Sekali</option>
                          </select>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga (Angka)</label>
                          <input name="price" type="number" required defaultValue={pkgModal.editData?.price ?? 0} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Durasi (Hari)</label>
                          <input name="duration_days" type="number" required defaultValue={pkgModal.editData?.duration_days ?? 30} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maks. Branch / Cabang</label>
                          <input name="max_branches" type="number" defaultValue={pkgModal.editData?.max_branches ?? ''} placeholder="Kosong = Unlimited" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maks. Anak Perusahaan</label>
                          <input name="max_child_orgs" type="number" defaultValue={pkgModal.editData?.max_child_orgs ?? ''} placeholder="Kosong = Unlimited" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maks. Org</label>
                          <input name="max_orgs" type="number" required defaultValue={pkgModal.editData?.max_orgs ?? 1} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maks. Warehouse</label>
                          <input name="max_warehouses" type="number" required defaultValue={pkgModal.editData?.max_warehouses ?? 1} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maks. Users</label>
                          <input name="max_users" type="number" defaultValue={pkgModal.editData?.max_users ?? ''} placeholder="Unlimited" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                       </div>
                    </div>

                    <div className="space-y-6">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bundle Core, Module, dan Add-on</label>
                       
                       <div className="space-y-6 p-6 bg-slate-50 border border-slate-100 rounded-[32px]">
                          {SAAS_PACKAGE_EDITOR_SECTIONS.map((cat) => (
                             <div key={cat.key} className="space-y-2" data-module-group={cat.key}>
                                <div className="flex items-center gap-2 px-2">
                                   <div className="h-[1px] flex-1 bg-slate-200" />
                                   <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{cat.title}</span>
                                   <div className="h-[1px] flex-1 bg-slate-200" />
                                </div>
                                <p className="px-2 text-[11px] font-semibold text-slate-500">{cat.description}</p>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                   {/* Opsi untuk centang "SATU GRUP" sekaligus — hanya toggle UI, tidak submit value sendiri */}
                                   <label className="flex items-center gap-2 p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 cursor-pointer hover:bg-indigo-100/50 transition-colors group">
                                      <input 
                                         type="checkbox" 
                                         defaultChecked={cat.items.every((item) => isCapabilitySelected(pkgModal.editData?.modules, item.value))}
                                         onChange={(e) => {
                                           const container = e.target.closest('[data-module-group]')
                                           if (!container) return
                                           const checkboxes = container.querySelectorAll<HTMLInputElement>('input[name="modules"]')
                                           checkboxes.forEach((cb) => { cb.checked = e.target.checked })
                                         }}
                                         className="w-4 h-4 rounded text-indigo-600" 
                                      />
                                      <span className="text-[9px] font-black uppercase text-indigo-600 group-hover:underline italic">Pilih Semua {cat.title}</span>
                                   </label>

                                   {cat.items.map((item) => (
                                      <label key={item.value} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 hover:border-blue-200 cursor-pointer transition-all group">
                                         <input 
                                            type="checkbox" 
                                            name="modules" 
                                            value={item.value} 
                                            defaultChecked={isCapabilitySelected(pkgModal.editData?.modules, item.value)}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                         />
                                         <span className="text-[9px] font-black text-slate-500 group-hover:text-blue-600 truncate">{item.label}</span>
                                      </label>
                                   ))}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-6">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Growth Layer Opsional</label>

                       <div className="space-y-6 p-6 bg-slate-50 border border-slate-100 rounded-[32px]">
                          {[
                            {
                              key: 'starter_core_upsell',
                              title: 'Upsell Starter Core',
                              description: 'Ekstensi operasional dari Lite menuju Starter Core Family.',
                              items: SAAS_STARTER_CORE_ITEMS,
                            },
                            {
                              key: 'full_core_upsell',
                              title: 'Upsell Full Core',
                              description: 'Capability tambahan yang bisa ditawarkan di atas Starter Core.',
                              items: SAAS_FULL_CORE_EXTENSION_ITEMS,
                            },
                            {
                              key: 'vertical_modules',
                              title: 'Vertical Modules',
                              description: 'Modul industri yang bisa diaktifkan terpisah dari core.',
                              items: SAAS_VERTICAL_MODULE_ITEMS,
                            },
                            {
                              key: 'addons',
                              title: 'Add-ons',
                              description: 'Ekspansi tambahan seperti WMS, sales page, API, dan capacity pack.',
                              items: SAAS_ADDON_ITEMS,
                            },
                          ].map((cat) => (
                             <div key={cat.key} className="space-y-2" data-addon-group={cat.key}>
                                <div className="flex items-center gap-2 px-2">
                                   <div className="h-[1px] flex-1 bg-slate-200" />
                                   <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{cat.title}</span>
                                   <div className="h-[1px] flex-1 bg-slate-200" />
                                </div>
                                <p className="px-2 text-[11px] font-semibold text-slate-500">{cat.description}</p>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                   <label className="flex items-center gap-2 p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100/50 cursor-pointer hover:bg-emerald-100/50 transition-colors group">
                                      <input
                                         type="checkbox"
                                         defaultChecked={cat.items.every((item) => isCapabilitySelected(pkgModal.editData?.addons, item.value))}
                                         onChange={(e) => {
                                           const container = e.target.closest('[data-addon-group]')
                                           if (!container) return
                                           const checkboxes = container.querySelectorAll<HTMLInputElement>('input[name="addons"]')
                                           checkboxes.forEach((cb) => { cb.checked = e.target.checked })
                                         }}
                                         className="w-4 h-4 rounded text-emerald-600"
                                      />
                                      <span className="text-[9px] font-black uppercase text-emerald-700 group-hover:underline italic">Pilih Semua {cat.title}</span>
                                   </label>

                                   {cat.items.map((item) => (
                                      <label key={`addon-${item.value}`} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 hover:border-emerald-200 cursor-pointer transition-all group">
                                         <input
                                            type="checkbox"
                                            name="addons"
                                            value={item.value}
                                            defaultChecked={isCapabilitySelected(pkgModal.editData?.addons, item.value)}
                                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                         />
                                         <span className="text-[9px] font-black text-slate-500 group-hover:text-emerald-600 truncate">{item.label}</span>
                                      </label>
                                   ))}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                       <button type="button" onClick={() => setPkgModal({ open: false, editData: null })} className="px-6 py-4 text-xs font-black uppercase text-slate-400">Batal</button>
                       <SafeButton type="submit" variant="primary">Simpan Paket</SafeButton>
                    </div>
                 </form>
              </motion.div>
           </div>
         )}
	      </AnimatePresence>

	      {/* AI TOPUP MODAL */}
	      <AnimatePresence>
	        {aiTopupModal.open && (
	          <div key="ai-topup-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
	            <motion.div
	              key="ai-topup-modal-backdrop"
	              initial={{ opacity: 0 }}
	              animate={{ opacity: 1 }}
	              exit={{ opacity: 0 }}
	              onClick={() => setAiTopupModal({ open: false, editData: null })}
	              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
	            />
	            <motion.div
	              key="ai-topup-modal-content"
	              initial={{ scale: 0.9, opacity: 0 }}
	              animate={{ scale: 1, opacity: 1 }}
	              exit={{ scale: 0.9, opacity: 0 }}
	              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl p-8 border border-white"
	            >
	              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">
	                {aiTopupModal.editData ? 'Edit Paket Topup Token' : 'Tambah Paket Topup Token'}
	              </h2>

	              <form onSubmit={saveAiTopupPackageForm} className="space-y-4">
	                <div>
	                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Nama Paket</label>
	                  <input name="name" required defaultValue={aiTopupModal.editData?.name} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                </div>
	                <div>
	                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Deskripsi</label>
	                  <textarea name="description" rows={3} defaultValue={aiTopupModal.editData?.description} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                </div>
	                <div className="grid grid-cols-2 gap-4">
	                  <div>
	                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Jumlah Token</label>
	                    <input name="tokens" type="number" min={1} required defaultValue={aiTopupModal.editData?.tokens || 50000} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                  </div>
	                  <div>
	                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Sort Order</label>
	                    <input name="sort_order" type="number" defaultValue={aiTopupModal.editData?.sort_order || 0} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                  </div>
	                </div>
	                <div className="grid grid-cols-2 gap-4">
	                  <div>
	                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Harga Jual (IDR)</label>
	                    <input name="price_idr" type="number" min={0} required defaultValue={aiTopupModal.editData?.price_idr || 0} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                  </div>
	                  <div>
	                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">HPP Paket (IDR)</label>
	                    <input name="cost_idr" type="number" min={0} defaultValue={aiTopupModal.editData?.cost_idr || 0} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
	                  </div>
	                </div>
	                <label className="inline-flex items-center gap-2 cursor-pointer">
	                  <input type="checkbox" name="is_active" defaultChecked={aiTopupModal.editData?.is_active ?? true} className="w-4 h-4 rounded" />
	                  <span className="text-xs font-bold text-slate-600">Aktifkan paket ini</span>
	                </label>
	                <div className="flex justify-end gap-3 pt-2">
	                  <button type="button" onClick={() => setAiTopupModal({ open: false, editData: null })} className="px-4 py-3 text-xs font-black uppercase text-slate-400">Batal</button>
	                  <SafeButton type="submit" variant="primary">Simpan Paket</SafeButton>
	                </div>
	              </form>
	            </motion.div>
	          </div>
	        )}
	      </AnimatePresence>

	      <ConfirmDialog 
	        isOpen={confirmState.open} 
        title={confirmState.title} 
        message={confirmState.message} 
        onConfirm={confirmState.action} 
        onClose={() => setConfirmState(prev => ({ ...prev, open: false }))} 
      />
    </div>
  )
}
