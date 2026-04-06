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
import { signInAsTenantOwner } from '@/modules/auth/actions/auth.actions'
import Link from 'next/link'
import {
  calculateAiHppPerGeneration,
  calculateAiRecommendedSellPer1kTokens,
  calculateAiRecommendedSellPerGeneration,
  normalizeAiTokenPolicy,
} from '@/modules/ai/lib/ai-token'
import {
  approveSaasInvoice,
  cancelSaasInvoice,
  deleteAiTopupPackage,
  deleteSaasInvoice,
  deleteSaasOrganization,
  deleteSaasPackage,
  getSaasAdminSnapshot,
  saveAiTokenConfig as saveAiTokenConfigAction,
  saveAiTopupPackage,
  saveSaasOrganization,
  saveSaasPackage,
  saveSaasSettings,
  toggleAiTopupPackageStatus,
  toggleSaasPackageStatus,
} from '@/modules/saas/actions/admin.actions'

const CORE_MODULES = [
  'Dashboard', 'Audit Integritas',
  'Akun (CoA)', 'Kas & Bank', 'Buku Besar', 'Aging (AR/AP)', 'Manajemen Zakat', 'Manajemen Pajak', 'Reimbursement', 'Penutupan Buku', 'Aset Tetap', 'Anggaran',
  'Pembelian', 'Inventori', 'Gudang (WMS)', 'Manufaktur (BoM)', 
  'Pelanggan (CRM)', 'POS (Kasir)', 'Penawaran (Quotation)', 'Penjualan', 'Sales Pipeline', 'Target & Komisi', 'Promo & Reward', 'Sales Page',
  'Karyawan (HRIS)', 'Absensi & Cuti', 'Payroll Components', 'Proses Penggajian', 'Akses & Jabatan',
  'Laporan', 'Strategi (BSC)', 'Proyeksi Kas',
  'Audit Trail', 'Cabang & Divisi', 'Anak Perusahaan', 'Pengaturan Bisnis', 'Ticketing', 'Doc Update Ticketing'
]

const ADDON_MODULES = [
  'Fleet & Rental', 'Job Order (Jasa)'
]

type Tab = 'users' | 'packages' | 'invoices' | 'settings' | 'ai_tokens'
type AdminSnapshot = Awaited<ReturnType<typeof getSaasAdminSnapshot>>
type AdminInvoice = AdminSnapshot['invoices'][number]
type AdminOrganization = AdminSnapshot['orgs'][number]
type AdminPackage = AdminSnapshot['packages'][number]
type AdminTopupPackage = AdminSnapshot['aiTopupPackages'][number]

export default function SaaSAdminPage() {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [searchTxt, setSearchTxt] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'demo' | 'official'>('all')
  const [packageFilter, setPackageFilter] = useState<string>('all')
  const [saasSettings, setSaasSettings] = useState<any>({ bank_info: {}, support_info: {} })
  const [aiTokenPolicyRaw, setAiTokenPolicyRaw] = useState<any>({})
  const [aiTokenInventory, setAiTokenInventory] = useState<any>({ total_stock_tokens: 0 })
  const [aiTopupPackages, setAiTopupPackages] = useState<AdminTopupPackage[]>([])
  const [aiWalletSummary, setAiWalletSummary] = useState({
    totalBalance: 0,
    totalPurchased: 0,
    totalUsed: 0,
  })
  const [aiTopupModal, setAiTopupModal] = useState<{ open: boolean; editData: AdminTopupPackage | null }>({ open: false, editData: null })

  const aiPolicy = normalizeAiTokenPolicy(aiTokenPolicyRaw)
  const aiHppPerGenerate = calculateAiHppPerGeneration(aiPolicy)
  const aiRecommendedPerGenerate = calculateAiRecommendedSellPerGeneration(aiPolicy)
  const aiRecommendedPer1kToken = calculateAiRecommendedSellPer1kTokens(aiPolicy)
  const aiAvailableStock = Math.max(0, Number(aiTokenInventory?.total_stock_tokens || 0) - aiWalletSummary.totalBalance)

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const bank = { 
      bank: String(fd.get('bank_name') || '').trim(),
      account: String(fd.get('bank_acc') || '').trim(),
      name: String(fd.get('bank_user') || '').trim(),
    }
    const support = { 
      wa: String(fd.get('wa_num') || '').trim(),
      label: String(fd.get('wa_label') || '').trim(),
    }

    try {
      const result = await saveSaasSettings({
        bankInfo: bank,
        supportInfo: support,
      })

      if ('error' in result && result.error) {
        alert('❌ Gagal: ' + result.error)
        return
      }

      alert('✅ Pengaturan Global Berhasil Disimpan!')
      await refreshAdminSnapshot()
    } catch (err: any) {
      alert('❌ Gagal: ' + (err?.message || 'Unknown error'))
    }
  }
  
  const [packages, setPackages] = useState<AdminPackage[]>([])

  const [orgs, setOrgs] = useState<AdminOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ======== MODALS STATE ========
  const [pkgModal, setPkgModal] = useState<{ open: boolean; editData: AdminPackage | null }>({ open: false, editData: null })
  const [orgModal, setOrgModal] = useState<{ open: boolean; editData: AdminOrganization | null }>({ open: false, editData: null })
  
  const [confirmState, setConfirmState] = useState<{ open: boolean, title: string, message: string, action: () => Promise<void> }>({
    open: false, title: '', message: '', action: async () => {}
  })
  const [loginAsPending, startLoginAsTransition] = useTransition()
  const [loginAsOrgId, setLoginAsOrgId] = useState<string | null>(null)

  // State local untuk helper set date di modal org
  const [modalExpireDate, setModalExpireDate] = useState('')

  const applySnapshot = (snapshot: AdminSnapshot) => {
    setSaasSettings(snapshot.saasSettings || { bank_info: {}, support_info: {} })
    setOrgs(snapshot.orgs || [])
    setPackages(snapshot.packages || [])
    setInvoices(snapshot.invoices || [])
    setAiTokenPolicyRaw(snapshot.aiTokenPolicyRaw || {})
    setAiTokenInventory(snapshot.aiTokenInventory || { total_stock_tokens: 0 })
    setAiTopupPackages(snapshot.aiTopupPackages || [])
    setAiWalletSummary(snapshot.aiWalletSummary || { totalBalance: 0, totalPurchased: 0, totalUsed: 0 })
    return snapshot
  }

  const refreshAdminSnapshot = async () => {
    try {
      setLoading(true)
      const snapshot = await getSaasAdminSnapshot()
      setError(null)
      return applySnapshot(snapshot)
    } catch (err: any) {
      const message = err?.message || 'Gagal memuat data admin SaaS.'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
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

    try {
      const result = await saveAiTokenConfigAction({
        policyValue,
        inventoryValue,
      })

      if ('error' in result && result.error) {
        alert('❌ Gagal menyimpan pengaturan token AI: ' + result.error)
        return
      }

      alert('✅ Konfigurasi token AI berhasil disimpan.')
      await refreshAdminSnapshot()
    } catch (err: any) {
      alert('❌ Gagal menyimpan pengaturan token AI: ' + (err?.message || 'Unknown error'))
    }
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

    try {
      const result = await saveAiTopupPackage({
        id: aiTopupModal.editData?.id || null,
        ...payload,
      })

      if ('error' in result && result.error) {
        alert('❌ Gagal menyimpan paket topup: ' + result.error)
        return
      }

      alert('✅ Paket topup token berhasil disimpan.')
      setAiTopupModal({ open: false, editData: null })
      await refreshAdminSnapshot()
    } catch (err: any) {
      alert('❌ Gagal menyimpan paket topup: ' + (err?.message || 'Unknown error'))
    }
  }

  const toggleAiTopupStatus = async (id: string, currentStatus: boolean) => {
    try {
      const result = await toggleAiTopupPackageStatus(id, currentStatus)
      if ('error' in result && result.error) {
        alert('❌ Gagal mengubah status paket topup: ' + result.error)
        return
      }
      await refreshAdminSnapshot()
    } catch (err: any) {
      alert('❌ Gagal mengubah status paket topup: ' + (err?.message || 'Unknown error'))
    }
  }

  const handleDeleteAiTopupPackage = (id: string, name: string) => {
    setConfirmState({
      open: true,
      title: 'Hapus Paket Topup?',
      message: `Paket token "${name}" akan dihapus permanen. Lanjutkan?`,
      action: async () => {
        try {
          const result = await deleteAiTopupPackage(id)
          if ('error' in result && result.error) {
            alert(result.error)
          } else {
            await refreshAdminSnapshot()
          }
        } catch (err: any) {
          alert(err?.message || 'Gagal menghapus paket token.')
        }
        setConfirmState(prev => ({ ...prev, open: false }))
      },
    })
  }

  const approveInvoice = async (invoiceId: string) => {
    try {
      const result = await approveSaasInvoice(invoiceId)
      if ('error' in result && result.error) {
        alert('Gagal update invoice: ' + result.error)
        return
      }
      alert('✅ Pembayaran Berhasil Dikonfirmasi & Item Aktif!')
      await refreshAdminSnapshot()
    } catch (err: any) {
      alert('Gagal update invoice: ' + (err?.message || 'Unknown error'))
    }
  }

  const cancelInvoice = async (id: string) => {
    try {
      const result = await cancelSaasInvoice(id)
      if ('error' in result && result.error) {
        alert('Gagal membatalkan: ' + result.error)
        return
      }
      await refreshAdminSnapshot()
    } catch (err: any) {
      alert('Gagal membatalkan: ' + (err?.message || 'Unknown error'))
    }
  }

  const deleteInvoice = async (id: string) => {
    setConfirmState({
      open: true,
      title: "Hapus Tagihan?",
      message: "Data tagihan akan dihapus permanen dari sistem (Soft-delete not applied). Lanjutkan?",
      action: async () => {
        try {
          const result = await deleteSaasInvoice(id)
          if ('error' in result && result.error) {
            alert(result.error)
          } else {
            await refreshAdminSnapshot()
          }
        } catch (err: any) {
          alert(err?.message || 'Gagal menghapus invoice.')
        }
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  useEffect(() => {
    refreshAdminSnapshot().catch(() => {})
  }, [])

  const togglePackageStatus = async (pkgId: string, currentStatus: boolean) => {
    try {
      const result = await toggleSaasPackageStatus(pkgId, currentStatus)
      if ('error' in result && result.error) {
        alert(result.error)
        return
      }
      await refreshAdminSnapshot()
    } catch (err: any) {
      alert(err?.message || 'Gagal mengubah status paket.')
    }
  }

  const handleDeletePackage = (id: string) => {
    setConfirmState({
      open: true,
      title: "Hapus Paket?",
      message: "Tindakan ini tidak dapat dibatalkan. Konfirmasi penghapusan paket SaaS?",
      action: async () => {
        try {
          const result = await deleteSaasPackage(id)
          if ('error' in result && result.error) {
            alert("Gagal menghapus paket: " + result.error)
          } else {
            await refreshAdminSnapshot()
          }
        } catch (err: any) {
          alert("Gagal menghapus paket: " + (err?.message || 'Unknown error'))
        }
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  const savePackageForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const fd = new FormData(e.currentTarget)
      const modules = fd.getAll('modules') as string[]
      const payload = {
        id: pkgModal.editData?.id || null,
        name: String(fd.get('name') || ''),
        price: Number(fd.get('price')),
        billing: String(fd.get('billing') || 'Bulan'),
        modules: modules,
        duration_days: Number(fd.get('duration_days') || 30),
        max_orgs: Number(fd.get('max_orgs') || 1),
        max_warehouses: Number(fd.get('max_warehouses') || 1),
        max_branches: fd.get('max_branches') ? Number(fd.get('max_branches')) : null,
        max_child_orgs: fd.get('max_child_orgs') ? Number(fd.get('max_child_orgs')) : null,
        max_users: fd.get('max_users') ? Number(fd.get('max_users')) : null,
      }

      const result = await saveSaasPackage(payload)
      if ('error' in result && result.error) throw new Error(result.error)
      alert('✅ Paket Berhasil Disimpan!')
      setPkgModal({ open: false, editData: null })
      await refreshAdminSnapshot()
    } catch (err: any) {
      alert('❌ Gagal: ' + err.message)
    }
  }

  const saveOrgForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const fd = new FormData(e.currentTarget)
      const expiresVal = fd.get('expires_at') as string
      
      const payload = {
         id: orgModal.editData?.id || null,
         name: String(fd.get('name') || ''),
         is_active: fd.get('is_active') === 'on',
         is_demo: fd.get('is_demo') === 'on',
         owner_email: String(fd.get('owner_email') || ''),
         plan: String(fd.get('plan') || 'Demo'),
         expires_at: expiresVal ? new Date(expiresVal).toISOString() : (orgModal.editData?.settings?.expires_at as string | null) || null,
      }

      const result = await saveSaasOrganization(payload)
      if ('error' in result && result.error) throw new Error(result.error)

      setOrgModal({ open: false, editData: null })
      setModalExpireDate('') // Reset local state
      await refreshAdminSnapshot()
    } catch (err: any) {
       alert(err.message)
    }
  }

  const handleDeleteOrg = (id: string, name: string) => {
     setConfirmState({
        open: true,
        title: "Hapus Tenant?",
        message: `PERINGATAN: Menghapus organisasi "${name}" akan menghapus seluruh data yang terkait di dalamnya. Lanjutkan?`,
        action: async () => {
           try {
             const result = await deleteSaasOrganization(id)
             if ('error' in result && result.error) {
               alert(result.error)
             } else {
               await refreshAdminSnapshot()
             }
           } catch (err: any) {
             alert(err?.message || 'Gagal menghapus tenant.')
           }
           setConfirmState(prev => ({ ...prev, open: false }))
        }
     })
  }

  const filteredOrgs = orgs.filter(o => {
     const ownerEmail = String(o.owner_email || '').toLowerCase()
     const matchesSearch = o.name.toLowerCase().includes(searchTxt.toLowerCase()) || ownerEmail.includes(searchTxt.toLowerCase())
     const matchesType = typeFilter === 'all' ? true : (typeFilter === 'demo' ? o.is_demo : !o.is_demo)
     const matchesPkg = packageFilter === 'all' ? true : o.settings?.plan === packageFilter
     return matchesSearch && matchesType && matchesPkg
  })

  const handleLoginAsTenant = (org: AdminOrganization) => {
    const ownerEmail = String(org.owner_email || '').trim()
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

  const orgModalPlan = typeof orgModal.editData?.settings?.plan === 'string'
    ? orgModal.editData.settings.plan
    : 'Demo'
  const orgModalExpiresAt = typeof orgModal.editData?.settings?.expires_at === 'string'
    ? orgModal.editData.settings.expires_at
    : ''

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
	            <button onClick={() => setActiveTab('packages')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'packages' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>SaaS Plans</button>
	            <button onClick={() => setActiveTab('ai_tokens')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ai_tokens' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>AI Tokens</button>
	            <button onClick={() => setActiveTab('invoices')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'invoices' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Billing</button>
	            <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>Settings</button>
	         </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
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
                 <button onClick={() => refreshAdminSnapshot().catch(() => {})} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
              </div>

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
                      {filteredOrgs.map((org) => (
                        <tr key={org.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6">
                            <div>
                               <p className="font-bold text-slate-900">{org.name}</p>
                               <p className="text-[10px] text-blue-600 font-black flex items-center gap-1.5 mt-0.5">
                                  <Mail size={12} /> {org.owner_email || 'No Email'}
                               </p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {org.is_demo ? 
                              <span className="px-2.5 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase rounded-lg border border-orange-100 flex items-center gap-1 w-fit"><Settings2 size={10} /> Demo</span> : 
                              <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg border border-blue-100 flex items-center gap-1 w-fit"><CheckCircle2 size={10} /> Official</span>
                            }
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm font-bold text-slate-700">{(org.settings as any)?.plan || 'Basic'}</span>
                          </td>
                          <td className="py-4 px-6">
                            {(org.settings as any)?.expires_at ? (
                              <div className="flex flex-col gap-0.5">
                                <p className={`text-xs font-black tabular-nums ${
                                  new Date((org.settings as any).expires_at).getTime() < new Date().getTime() 
                                    ? 'text-rose-600' 
                                    : (new Date((org.settings as any).expires_at).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000 ? 'text-orange-500' : 'text-slate-900')
                                }`}>
                                  {Math.ceil((new Date((org.settings as any).expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} Hari
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight italic">
                                  s/d {new Date((org.settings as any).expires_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                              <button onClick={() => handleDeleteOrg(org.id, org.name)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                 <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
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
                 {packages.map((pkg) => (
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
                          <p className={`text-[10px] font-black uppercase tracking-wider ${pkg.price === 0 ? 'text-orange-500' : 'text-emerald-600'}`}>
                            Batas: {pkg.duration_days ?? '?'} Hari
                          </p>
                        </div>

                        <div className="space-y-4 mb-4">
                           <div className="flex flex-wrap gap-1.5">
                              {pkg.modules?.slice(0, 4).map((mod: string) => (
                                 <span key={mod} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                   {mod}
                                 </span>
                              ))}
                              {pkg.modules?.length > 4 && <span className="text-[9px] font-bold text-slate-400">+{pkg.modules.length - 4} more</span>}
                           </div>
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
                 ))}
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
                              {inv.created_at
                                ? new Date(inv.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '-'}
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
                                       onClick={() => approveInvoice(inv.id)} 
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
                       <input name="owner_email" required type="email" defaultValue={orgModal.editData?.owner_email ?? ''} placeholder="email@perusahaan.com" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paket SaaS</label>
                           <select name="plan" defaultValue={orgModalPlan} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
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
                                          setModalExpireDate(d.toISOString().split('T')[0])
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
                              value={modalExpireDate || (orgModalExpiresAt ? new Date(orgModalExpiresAt).toISOString().split('T')[0] : '')} 
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
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Konfigurasi Fitur & Modul</label>
                       
                       <div className="space-y-6 p-6 bg-slate-50 border border-slate-100 rounded-[32px]">
                          {[
                             { group: 'Utama', items: ['Dashboard', 'Audit Integritas'] },
                             { group: 'Finance', items: ['Akun (CoA)', 'Kas & Bank', 'Buku Besar', 'Aging (AR/AP)', 'Manajemen Zakat', 'Manajemen Pajak', 'Reimbursement', 'Penutupan Buku', 'Aset Tetap', 'Anggaran'] },
                             { group: 'Operasional', items: ['Pembelian', 'Inventori', 'Gudang (WMS)', 'Manufaktur (BoM)'] },
                             { group: 'Tambahan (Premium)', items: ['Fleet & Rental', 'Job Order (Jasa)'] },
                             { group: 'Marketing & Sales', items: ['Pelanggan (CRM)', 'POS (Kasir)', 'Penawaran (Quotation)', 'Penjualan', 'Sales Pipeline', 'Target & Komisi', 'Promo & Reward', 'Sales Page'] },
                             { group: 'HRIS', items: ['Karyawan (HRIS)', 'Absensi & Cuti', 'Payroll Components', 'Proses Penggajian', 'Akses & Jabatan'] },
                             { group: 'Insight', items: ['Laporan', 'Strategi (BSC)', 'Proyeksi Kas'] },
                             { group: 'Config', items: ['Audit Trail', 'Cabang & Divisi', 'Anak Perusahaan', 'Pengaturan Bisnis', 'Ticketing', 'Doc Update Ticketing'] }
                          ].map(cat => (
                             <div key={cat.group} className="space-y-2" data-module-group={cat.group}>
                                <div className="flex items-center gap-2 px-2">
                                   <div className="h-[1px] flex-1 bg-slate-200" />
                                   <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{cat.group}</span>
                                   <div className="h-[1px] flex-1 bg-slate-200" />
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                   {/* Opsi untuk centang "SATU GRUP" sekaligus — hanya toggle UI, tidak submit value sendiri */}
                                   <label className="flex items-center gap-2 p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 cursor-pointer hover:bg-indigo-100/50 transition-colors group">
                                      <input 
                                         type="checkbox" 
                                         defaultChecked={cat.items.every(item => pkgModal.editData?.modules?.includes(item))}
                                         onChange={(e) => {
                                           const container = e.target.closest('[data-module-group]')
                                           if (!container) return
                                           const checkboxes = container.querySelectorAll<HTMLInputElement>('input[name="modules"]')
                                           checkboxes.forEach((cb) => { cb.checked = e.target.checked })
                                         }}
                                         className="w-4 h-4 rounded text-indigo-600" 
                                      />
                                      <span className="text-[9px] font-black uppercase text-indigo-600 group-hover:underline italic">Pilih Semua {cat.group}</span>
                                   </label>

                                   {cat.items.map(item => (
                                      <label key={item} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 hover:border-blue-200 cursor-pointer transition-all group">
                                         <input 
                                            type="checkbox" 
                                            name="modules" 
                                            value={item} 
                                            defaultChecked={pkgModal.editData?.modules?.includes(item)}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                         />
                                         <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-blue-600 truncate">{item}</span>
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
		                  <textarea name="description" rows={3} defaultValue={aiTopupModal.editData?.description ?? ''} className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold" />
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
