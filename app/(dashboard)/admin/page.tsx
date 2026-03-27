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

const MOCK_PACKAGES = [
  { id: 'P-001', name: 'Basic', price: 150000, billing: 'Bulan', is_active: true, modules: ['Accounting', 'Cash'], addons: [] },
  { id: 'P-002', name: 'Pro', price: 350000, billing: 'Bulan', is_active: true, modules: ['Accounting', 'Cash', 'POS', 'Inventory'], addons: ['CRM'] },
  { id: 'P-003', name: 'Enterprise', price: 950000, billing: 'Bulan', is_active: true, modules: ['Accounting', 'Cash', 'POS', 'Inventory', 'HRIS', 'Factory'], addons: ['Full API', 'Priority Support'] }
]

type Tab = 'users' | 'packages'

export default function SaaSAdminPage() {
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
      const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false })
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
      const { data, error } = await supabase.from('saas_packages').select('*').order('price', { ascending: true })
      
      if (error) {
         setPackages(MOCK_PACKAGES.map(p => ({ ...p, active: p.is_active })))
         return
      }

      const formatted = (data || []).map(p => ({
        ...p,
        active: p.is_active, 
        modules: Array.isArray(p.modules) ? p.modules : JSON.parse(p.modules || '[]'),
        addons: Array.isArray(p.addons) ? p.addons : JSON.parse(p.addons || '[]')
      }))
      setPackages(formatted.length > 0 ? formatted : MOCK_PACKAGES.map(p => ({ ...p, active: p.is_active })))
    } catch (err: any) {
      setPackages(MOCK_PACKAGES.map(p => ({ ...p, active: p.is_active })))
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
       await supabase.from('saas_packages').update({ is_active: !currentStatus }).eq('id', pkgId)
    } catch (err) {}
  }

  const handleDeletePackage = (id: string) => {
    setConfirmState({
      open: true,
      title: "Hapus Paket?",
      message: "Tindakan ini tidak dapat dibatalkan. Konfirmasi penghapusan paket SaaS?",
      action: async () => {
        const { error } = await supabase.from('saas_packages').delete().eq('id', id)
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
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name') as string,
      price: Number(fd.get('price')),
      billing: fd.get('billing') as string,
      is_active: true,
      modules: (fd.get('modules') as string).split(',').map(s => s.trim()).filter(Boolean),
      addons: (fd.get('addons') as string).split(',').map(s => s.trim()).filter(Boolean)
    }

    if (pkgModal.editData?.id) {
      await supabase.from('saas_packages').update(payload).eq('id', pkgModal.editData.id)
    } else {
      await supabase.from('saas_packages').insert([payload])
    }
    setPkgModal({ open: false, editData: null })
    fetchPackages()
  }

  // ==================== CRUD ORGANIZATIONS ====================
  const handleDeleteOrg = (id: string, name: string) => {
    setConfirmState({
      open: true,
      title: "Hapus Organisasi?",
      message: `Tindakan ini akan menghapus permanen data "${name}" beserta seluruh isinya secara aman dan tuntas. Anda yakin?`,
      action: async () => {
        // Use the new RPC function for robust cascading delete
        const { error } = await supabase.rpc('delete_org_cascade', { target_org_id: id })
        
        if (error) {
           alert("Gagal menghapus organisasi sakti:\n\n" + error.message)
        }
        await fetchOrganizations()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  const bulkDeleteDemos = async () => {
    const demos = orgs.filter(o => (o as any).is_demo)
    if (demos.length === 0) return alert("Tidak ada akun demo yang ditemukan.")

    setConfirmState({
      open: true,
      title: `Hapus ${demos.length} Akun Demo?`,
      message: `Tindakan ini akan menghapus SEMUA akun bertanda "DEMO" secara permanen dan tuntas.`,
      action: async () => {
        for (const demo of demos) {
           await supabase.rpc('delete_org_cascade', { target_org_id: demo.id })
        }
        await fetchOrganizations()
        setConfirmState(prev => ({ ...prev, open: false }))
      }
    })
  }

  const saveOrgForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const nameStr = fd.get('name') as string
    
    // Create random slug for simplicity if missing
    const slug = nameStr.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random()*100)
    const settings = { plan: fd.get('plan') as string }

    if (orgModal.editData?.id) {
      await supabase.from('organizations').update({ 
         name: nameStr,
         settings,
         is_active: fd.get('is_active') === 'on',
         is_demo: fd.get('is_demo') === 'on'
      }).eq('id', orgModal.editData.id)
    } else {
      await supabase.from('organizations').insert([{ 
         name: nameStr, 
         slug, 
         settings, 
         is_active: fd.get('is_active') === 'on',
         is_demo: fd.get('is_demo') === 'on'
      }])
    }
    setOrgModal({ open: false, editData: null })
    fetchOrganizations()
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="SaaS Admin Portal"
        subtitle="Manajemen Pengguna Terdaftar, Modul, dan Paket Harga (Live CRUD)."
        icon={<ShieldCheck />}
        iconColor="text-indigo-600"
        tag="Super Admin"
        actions={
          <div className="flex gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/60 shadow-inner">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-indigo-700 shadow-md border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users size={16} /> Data Pengguna
            </button>
            <button
              onClick={() => setActiveTab('packages')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'packages' ? 'bg-white text-indigo-700 shadow-md border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Package size={16} /> Manajemen Paket
            </button>
          </div>
        }
      />

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          {activeTab === 'users' ? (
            <SectionCard>
              <SectionHeader 
                title="Daftar Organisasi (Penyewa SaaS)" 
                subtitle="Data organisasi dari Supabase public.organizations."
                icon={Users}
                actions={
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex gap-2">
                       <select value={typeFilter} onChange={(e: any) => setTypeFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-tight shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20">
                          <option value="all">Semua Tipe</option>
                          <option value="demo">Hanya Demo/Latihan</option>
                          <option value="official">Hanya Resmi/Prod</option>
                       </select>
                       <select value={packageFilter} onChange={(e: any) => setPackageFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-tight shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20">
                          <option value="all">Semua Paket</option>
                          {packages.map(p => <option key={p.id||p.name} value={p.name}>{p.name}</option>)}
                       </select>
                    </div>

                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" placeholder="Cari..." value={searchTxt} onChange={(e) => setSearchTxt(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-44 shadow-sm"
                      />
                    </div>
                    
                    <div className="h-6 w-px bg-slate-200 hidden md:block" />
                    
                    <div className="flex gap-2">
                      <SafeButton variant="ghost" size="sm" onClick={fetchOrganizations} icon={<RefreshCw size={12} className={loading ? "animate-spin" : ""} />}>Refresh</SafeButton>
                      <SafeButton variant="primary" size="sm" onClick={() => setOrgModal({ open: true, editData: null })} icon={<Plus size={12} />}>Daftar Baru</SafeButton>
                      <button 
                        onClick={bulkDeleteDemos} 
                        className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-2"
                      >
                         <Trash2 size={12} /> Hapus Semua Demo
                      </button>
                    </div>
                  </div>
                }
              />
              <div className="overflow-x-auto min-h-[300px]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center p-20 text-slate-400 gap-4"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
                ) : error ? (
                   <div className="p-8 text-center text-rose-500 font-bold border-b border-rose-100 bg-rose-50/50">Gagal memuat data: {error}</div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400">ID / Perusahaan</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Paket Layanan</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Tgl Bergabung</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                          <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi CRUD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {orgs
                        .filter(o => o.name.toLowerCase().includes(searchTxt.toLowerCase()))
                        .filter(o => {
                           if (typeFilter === 'all') return true
                           if (typeFilter === 'demo') return (o as any).is_demo === true
                           return (o as any).is_demo === false || (o as any).is_demo === null
                        })
                        .filter(o => {
                           if (packageFilter === 'all') return true
                           return ((o as any).settings?.plan || 'Basic') === packageFilter
                        })
                        .map((org) => {
                        const planContext = (org.settings as any)?.plan || 'Basic'
                        return (
                        <tr key={org.id} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900 text-sm">{org.name}</p>
                                {(org as any).is_demo ? (
                                  <span className="px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[8px] font-black uppercase tracking-tighter border border-orange-200 shadow-sm leading-none">DEMO</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase tracking-tighter border border-emerald-200 shadow-sm leading-none">RESMI</span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-tight truncate max-w-[150px]">{org.id}</p>
                          </td>
                          <td className="py-4 px-6">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black tracking-tight border shadow-sm bg-indigo-50 text-indigo-700 border-indigo-100`}>
                                {planContext}
                              </span>
                          </td>
                          <td className="py-4 px-6 text-sm text-slate-600 font-medium">
                              {new Date(org.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-4 px-6 text-center">
                              <StatusBadge variant={org.is_active ? 'success' : 'neutral'} label={org.is_active ? 'Aktif' : 'Nonaktif'} />
                          </td>
                          <td className="py-4 px-6 text-right space-x-2">
                              <button onClick={() => setOrgModal({ open: true, editData: org })} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                <Edit3 size={18} />
                              </button>
                              <button onClick={() => handleDeleteOrg(org.id, org.name)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                <Trash2 size={18} />
                              </button>
                          </td>
                        </tr>
                      )})}
                      {orgs.length === 0 && !loading && (<tr><td colSpan={5} className="py-8 text-center text-sm font-medium text-slate-500">Belum ada organisasi terdaftar</td></tr>)}
                    </tbody>
                  </table>
                )}
              </div>
            </SectionCard>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                 <p className="text-sm font-bold text-slate-500 italic">Konfigurasi paket SaaS di Supabase</p>
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
                              {pkg.price === 0 ? 'Custom' : `Rp ${pkg.price.toLocaleString('id-ID')}`}
                            </span>
                            {pkg.price > 0 && <span className="text-xs text-slate-400 font-bold">/{pkg.billing}</span>}
                          </div>
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
                          {pkg.addons?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Add-ons</p>
                              <div className="flex flex-wrap gap-1.5">
                                {pkg.addons.map((add: string) => (
                                   <span key={add} className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                                     <Plus size={10} className="text-indigo-500" /> {add}
                                   </span>
                                ))}
                              </div>
                            </div>
                          )}
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
                  <form onSubmit={savePackageForm} className="p-8 space-y-6">
                     <div>
                       <label className="block text-xs font-black uppercase text-slate-500 mb-2">Nama Paket</label>
                       <input name="name" required defaultValue={pkgModal.editData?.name} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Cth: Enterprise" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="block text-xs font-black uppercase text-slate-500 mb-2">Harga</label>
                         <input name="price" type="number" required defaultValue={pkgModal.editData?.price} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                       </div>
                       <div>
                         <label className="block text-xs font-black uppercase text-slate-500 mb-2">Siklus</label>
                         <input name="billing" defaultValue={pkgModal.editData?.billing || 'Bulan'} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                       </div>
                     </div>
                     <div>
                       <label className="block text-xs font-black uppercase text-slate-500 mb-2">Modul Termasuk (pisahkan dgn koma)</label>
                       <input name="modules" defaultValue={pkgModal.editData?.modules?.join(', ')} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Accounting, POS, Inventory" />
                     </div>
                     <div>
                       <label className="block text-xs font-black uppercase text-slate-500 mb-2">Addons Khusus (pisahkan dgn koma)</label>
                       <input name="addons" defaultValue={pkgModal.editData?.addons?.join(', ')} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Full API, Priority Support" />
                     </div>
                     <div className="pt-2 flex justify-end">
                       <SafeButton type="submit" variant="primary" size="lg">Simpan Paket</SafeButton>
                     </div>
                  </form>
               </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* ===================== ORGANIZATION MODAL ===================== */}
      <AnimatePresence>
        {orgModal.open && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOrgModal({ open: false, editData: null })} />
               <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
                  <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h3 className="text-xl font-black text-slate-900">{orgModal.editData ? 'Edit Tenant / Org' : 'Registrasi Tenant Baru'}</h3>
                     <button onClick={() => setOrgModal({ open: false, editData: null })} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={20} /></button>
                  </div>
                  <form onSubmit={saveOrgForm} className="p-8 space-y-6">
                     <div>
                       <label className="block text-xs font-black uppercase text-slate-500 mb-2">Nama Perusahaan / Org</label>
                       <input name="name" required defaultValue={orgModal.editData?.name} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Cth: PT Makmur Sentosa" />
                     </div>
                     <div>
                       <label className="block text-xs font-black uppercase text-slate-500 mb-2">Terhubung ke Paket / Plan</label>
                       <select name="plan" defaultValue={orgModal.editData?.settings?.plan || 'Basic'} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                         {packages.map(p => <option key={p.id||p.name} value={p.name}>{p.name} — Rp {p.price}</option>)}
                       </select>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                         <div>
                            <p className="text-sm font-black text-slate-900">Akun Latihan / Demo</p>
                            <p className="text-xs text-slate-500">Tandai jika ini adalah data dummy</p>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" name="is_demo" defaultChecked={(orgModal.editData as any)?.is_demo} className="sr-only peer" />
                           <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                         </label>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                           <p className="text-sm font-black text-slate-900">Tenant Aktif</p>
                           <p className="text-xs text-slate-500">Izinkan tenant login dan akses modul</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" name="is_active" defaultChecked={orgModal.editData ? orgModal.editData.is_active : true} className="sr-only peer" />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                     </div>
                     <div className="pt-2 flex justify-end">
                       <SafeButton type="submit" variant="primary" size="lg">Simpan Organisasi</SafeButton>
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
        confirmLabel="Hapus Permanen"
      />
    </div>
  )
}
