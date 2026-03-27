'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShieldCheck, 
  Users, 
  Package, 
  Plus, 
  Search, 
  Settings2, 
  CheckCircle2, 
  Edit3,
  Loader2,
  RefreshCw,
  X,
  Trash2
} from 'lucide-react'
import { PageHeader, SectionCard, SectionHeader, SafeButton, StatusBadge, ConfirmDialog } from '@/components/ui/NizamUI'
import { createClient } from '@/lib/supabase/client'
import { Organization } from '@/types/database.types'

const supabase = createClient()

const AVAILABLE_MODULES = [
  'Accounting', 'Finance', 'Inventory', 'Purchasing', 
  'Sales', 'Marketing', 'POS', 'HRIS', 'Manufacturing', 
  'Fleet', 'Audit', 'Job Order'
]

type Tab = 'users' | 'packages'

export default function SaaSAdminPage() {
  const db = supabase as any
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [searchTxt, setSearchTxt] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'demo' | 'official'>('all')
  const [packageFilter, setPackageFilter] = useState<string>('all')
  
  const [packages, setPackages] = useState<any[]>([])
  const [loadingPackages, setLoadingPackages] = useState(true)

  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ======== MODALS STATE ========
  const [pkgModal, setPkgModal] = useState<{ open: boolean; editData: any | null }>({ open: false, editData: null })
  const [orgModal, setOrgModal] = useState<{ open: boolean; editData: any | null }>({ open: false, editData: null })
  
  // ======== CONFIRM DIALOG STATE ========
  const [confirmState, setConfirmState] = useState<{ open: boolean, title: string, message: string, action: () => Promise<void> }>({
    open: false, title: '', message: '', action: async () => {}
  })

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
      
      if (error) return

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

  useEffect(() => {
    fetchOrganizations()
    fetchPackages()
  }, [])

  // ==================== CRUD PACKAGES ====================
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
      const modules = fd.getAll('modules') as string[]
      const addonsRaw = fd.get('addons') as string | null
      const payload = {
        name: fd.get('name') as string,
        price: Number(fd.get('price')),
        duration_days: Number(fd.get('duration_days') || 30),
        billing: fd.get('billing') as string,
        is_active: true,
        modules: modules,
        addons: addonsRaw ? addonsRaw.split(',').map(s => s.trim()).filter(Boolean) : []
      }

      const { error } = pkgModal.editData?.id 
        ? await db.from('saas_packages').update(payload).eq('id', pkgModal.editData.id)
        : await db.from('saas_packages').insert([payload])

      if (error) throw error

      setPkgModal({ open: false, editData: null })
      fetchPackages()
    } catch (err: any) {
      console.error("SavePackage Failed:", err)
      alert("Gagal menyimpan paket: " + (err.message || "Unknown error"))
    }
  }

  // ==================== CRUD ORGANIZATIONS ====================
  const handleDeleteOrg = (id: string, name: string) => {
    setConfirmState({
      open: true,
      title: "Hapus Organisasi?",
      message: `Tindakan ini akan menghapus permanen data "${name}" beserta seluruh isinya secara aman dan tuntas. Anda yakin?`,
      action: async () => {
        const { error } = await db.rpc('delete_org_cascade', { target_org_id: id })
        if (error) {
           alert("Gagal menghapus organisasi sakti:\n\n" + error.message)
        }
        await fetchOrganizations()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  const bulkDeleteDemos = () => {
    setConfirmState({
      open: true,
      title: "Hapus Semua Akun Demo?",
      message: "Ini akan menghapus seluruh organisasi yang ditandai sebagai Akun Demo/Latihan secara aman.",
      action: async () => {
        const demos = orgs.filter(o => (o as any).is_demo)
        for(const d of demos) {
          await db.rpc('delete_org_cascade', { target_org_id: d.id })
        }
        await fetchOrganizations()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  const saveOrgForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name') as string,
      settings: { 
        plan: fd.get('plan') as string,
        subscription_start: new Date().toISOString()
      },
      is_active: fd.get('is_active') === 'on',
      is_demo: fd.get('is_demo') === 'on'
    }

    if (orgModal.editData?.id) {
      await db.from('organizations').update(payload).eq('id', orgModal.editData.id)
    } else {
      const slug = payload.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(7)
      await db.from('organizations').insert([{ ...payload, slug }])
    }
    setOrgModal({ open: false, editData: null })
    fetchOrganizations()
  }

  const filteredOrgs = orgs.filter(o => {
    const matchesSearch = o.name.toLowerCase().includes(searchTxt.toLowerCase())
    const matchesType = typeFilter === 'all' || 
                       (typeFilter === 'demo' && (o as any).is_demo) || 
                       (typeFilter === 'official' && !(o as any).is_demo)
    const matchesPkg = packageFilter === 'all' || (o.settings as any)?.plan === packageFilter
    return matchesSearch && matchesType && matchesPkg
  })

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 min-h-screen bg-[#F8F9FA]/30 pb-32">
      <PageHeader 
        title="Admin Control Center" 
        subtitle="SaaS Management & Tenant Registry"
        icon={<ShieldCheck className="text-blue-600" size={32} />}
      />

      <div className="flex gap-2 p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl w-fit border border-slate-200 shadow-sm">
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={18} /> Tenant Manager
        </button>
        <button 
          onClick={() => setActiveTab('packages')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'packages' ? 'bg-white text-blue-600 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Package size={18} /> SaaS Packages
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'users' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                <div className="lg:col-span-2 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    value={searchTxt}
                    onChange={(e) => setSearchTxt(e.target.value)}
                    placeholder="Cari tenant / organisasi..." 
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
                 <SafeButton variant="ghost" onClick={bulkDeleteDemos} icon={<Trash2 size={18} />}>Bersihkan Akun Demo</SafeButton>
                 <button onClick={fetchOrganizations} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
              </div>

              <SectionCard>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Organisasi</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Tipe</th>
                        <th className="text-left py-4 px-6 text-[11px] font-black uppercase text-slate-400 tracking-widest">Paket / Plan</th>
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
                               <p className="text-[10px] text-slate-400 font-mono">{org.id.slice(0,8)}...</p>
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
                            <StatusBadge variant={org.is_active ? 'success' : 'neutral'} label={org.is_active ? 'Running' : 'Suspended'} />
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex justify-end gap-2">
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
          ) : (
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
                              {pkg.price === 0 ? 'Trial / Free' : `Rp ${pkg.price.toLocaleString('id-ID')}`}
                            </span>
                            {pkg.price > 0 && <span className="text-xs text-slate-400 font-bold">/{pkg.billing}</span>}
                          </div>
                          <p className={`text-[10px] font-black uppercase tracking-wider ${pkg.price === 0 ? 'text-orange-500' : 'text-emerald-600'}`}>
                            Batas Waktu: {pkg.duration_days !== null && pkg.duration_days !== undefined ? pkg.duration_days : 30} Hari
                          </p>
                        </div>

                        <div className="space-y-4 mb-8">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Modul Inti</p>
                            <div className="flex flex-wrap gap-1.5">
                              {pkg.modules?.length > 0 ? pkg.modules.map((mod: string) => (
                                 <span key={mod} className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                                   <CheckCircle2 size={12} className="text-emerald-500" /> {mod}
                                 </span>
                              )) : <span className="text-xs text-slate-400 italic">Standard</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-100 mt-auto flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-600">Status Paket</span>
                         <button
                            onClick={() => togglePackageStatus(pkg.id, pkg.active)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${pkg.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                         >
                           <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${pkg.active ? 'translate-x-6' : 'translate-x-1'}`} />
                         </button>
                      </div>
                    </div>
                 ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ===================== PACKAGE MODAL ===================== */}
      <AnimatePresence>
        {pkgModal.open && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPkgModal({ open: false, editData: null })} />
               <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
                  <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h3 className="text-xl font-black text-slate-900">{pkgModal.editData ? 'Edit Paket SaaS' : 'Tambah Paket Baru'}</h3>
                     <button onClick={() => setPkgModal({ open: false, editData: null })} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={20} /></button>
                  </div>
                  <form onSubmit={savePackageForm} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                     <div>
                       <label className="block text-xs font-black uppercase text-slate-500 mb-2">Nama Paket</label>
                       <input name="name" required defaultValue={pkgModal.editData?.name} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Cth: Trial / Pro" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="block text-xs font-black uppercase text-slate-500 mb-2">Harga (0 untuk Trial)</label>
                         <input name="price" type="number" required defaultValue={pkgModal.editData?.price} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                       </div>
                       <div>
                         <label className="block text-xs font-black uppercase text-slate-500 mb-2">Batas Waktu (Hari)</label>
                         <input name="duration_days" type="number" required defaultValue={pkgModal.editData?.duration_days || 30} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="14" />
                       </div>
                     </div>
                     <div>
                       <label className="block text-xs font-black uppercase text-slate-500 mb-2">Siklus Penagihan</label>
                       <input name="billing" defaultValue={pkgModal.editData?.billing || 'Bulan'} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Cth: Sekali / Bulan" />
                     </div>
                     <div>
                        <label className="block text-xs font-black uppercase text-slate-500 mb-3 tracking-widest flex items-center justify-between">Pilih Modul Aktif</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                           {AVAILABLE_MODULES.map(mod => (
                              <label key={mod} className="flex items-center gap-2 p-2 hover:bg-white rounded-xl cursor-pointer border border-transparent hover:border-slate-200 group">
                                 <input type="checkbox" name="modules" value={mod} defaultChecked={pkgModal.editData?.modules?.includes(mod)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                 <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900">{mod}</span>
                              </label>
                           ))}
                        </div>
                     </div>
                     <div className="pt-2 flex justify-end">
                       <SafeButton type="submit" variant="primary" size="lg">Simpan Paket</SafeButton>
                     </div>
                  </form>
               </motion.div>
           </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {orgModal.open && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOrgModal({ open: false, editData: null })} />
               <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
                  <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h3 className="text-xl font-black text-slate-900">{orgModal.editData ? 'Edit Tenant' : 'Registrasi Tenant Baru'}</h3>
                     <button onClick={() => setOrgModal({ open: false, editData: null })} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={20} /></button>
                  </div>
                  <form onSubmit={saveOrgForm} className="p-8 space-y-6">
                     <div>
                       <label className="block text-xs font-black uppercase text-slate-500 mb-2">Nama Perusahaan / Org</label>
                       <input name="name" required defaultValue={orgModal.editData?.name} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Cth: PT Makmur Sentosa" />
                     </div>
                     <div>
                       <label className="block text-xs font-black uppercase text-slate-500 mb-2">Pilih Paket</label>
                       <select name="plan" defaultValue={orgModal.editData?.settings?.plan || 'Basic'} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                         {packages.map(p => <option key={p.id||p.name} value={p.name}>{p.name} — Rp {p.price.toLocaleString()}</option>)}
                       </select>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                           <span className="text-xs font-black uppercase text-slate-500">Demo</span>
                           <input type="checkbox" name="is_demo" defaultChecked={(orgModal.editData as any)?.is_demo} className="w-5 h-5" />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                           <span className="text-xs font-black uppercase text-slate-500">Aktif</span>
                           <input type="checkbox" name="is_active" defaultChecked={orgModal.editData ? orgModal.editData.is_active : true} className="w-5 h-5" />
                        </div>
                     </div>
                     <div className="pt-2 flex justify-end">
                       <SafeButton type="submit" variant="primary" size="lg">Simpan Perubahan</SafeButton>
                     </div>
                  </form>
               </motion.div>
           </div>
        )}
      </AnimatePresence>

      <ConfirmDialog 
        isOpen={confirmState.open} 
        onClose={() => setConfirmState(prev => ({ ...prev, open: false }))} 
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
        variant="danger"
        confirmLabel="Ya, Hapus"
      />
    </div>
  )
}
