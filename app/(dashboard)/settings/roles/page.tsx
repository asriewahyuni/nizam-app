'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { ShieldAlert, Check, X, Shield, Users, Plus, Trash2, Edit2, GripVertical, CornerDownRight, AlertCircle, Sparkles } from 'lucide-react'
import { SafeButton, ConfirmDialog } from '@/components/ui/NizamUI'
import { useActiveOrgId } from '@/lib/hooks/useActiveOrgId'
import {
  deleteOrganizationRole,
  getActiveOrgEnabledModules,
  getRolesForOrganization,
  reorderOrganizationRoles,
  saveOrganizationRole,
  updateOrganizationRolePermissions,
} from '@/modules/organization/actions/roles.actions'
import {
  normalizeDepartmentIds,
  normalizePermissions,
  normalizeRoleRecord,
} from '@/modules/organization/lib/role-normalization'

const MODULE_CATEGORIES = [
  {
    category: 'Utama (Dashboard & Audit)',
    val: 'DASHBOARD_AUDIT',
    modules: [
      { id: 'dashboard', name: 'Dashboard Monitoring', perms: ['dashboard:read'] },
      { id: 'approval', name: 'Approval Center', perms: ['approval:read', 'approval:write'] },
      { id: 'audit', name: 'Audit Integritas', perms: ['audit:read', 'audit:write'] },
    ]
  },
  {
    category: 'Insight',
    val: 'INSIGHT',
    modules: [
      { id: 'reports', name: 'Laporan Finansial', perms: ['reports:read'] },
      { id: 'strategy', name: 'Strategi', perms: ['strategy:read', 'strategy:write'] },
      { id: 'forecast', name: 'Proyeksi Arus Kas', perms: ['forecast:read'] },
    ]
  },
  {
    category: 'IT (Config)',
    val: 'CONFIG',
    modules: [
      { id: 'audit_trail', name: 'Audit Trail (Log)', perms: ['audit_trail:read'] },
      { id: 'branch', name: 'Cabang & Divisi', perms: ['branch:read', 'branch:write'] },
      { id: 'business', name: 'Pengaturan Bisnis', perms: ['business:read', 'business:write'] },
    ]
  },
  {
    category: 'Finance',
    val: 'FINANCE',
    modules: [
      { id: 'coa', name: 'Akun (CoA)', perms: ['coa:read', 'coa:write'] },
      { id: 'bank', name: 'Kas & Bank', perms: ['bank:read', 'bank:write'] },
      { id: 'journal', name: 'Buku Besar & Jurnal', perms: ['journal:read', 'journal:write'] },
      { id: 'aging', name: 'Aging (AR/AP)', perms: ['aging:read', 'aging:write'] },
      { id: 'tax', name: 'Manajemen Pajak', perms: ['tax:read', 'tax:write'] },
      { id: 'zakat', name: 'Manajemen Zakat', perms: ['zakat:read', 'zakat:write'] },
      { id: 'reimburse', name: 'Reimbursement', perms: ['reimburse:read', 'reimburse:write'] },
      { id: 'assets', name: 'Aset Tetap', perms: ['assets:read', 'assets:write'] },
      { id: 'budget', name: 'Anggaran', perms: ['budget:read', 'budget:write'] },
      { id: 'closing', name: 'Penutupan Buku', perms: ['closing:read', 'closing:write'] }
    ]
  },
  {
    category: 'Operasional',
    val: 'OPERASIONAL',
    modules: [
      { id: 'purchasing', name: 'Pembelian & PO', perms: ['purchasing:read', 'purchasing:write'] },
      { id: 'inventory', name: 'Gudang & Stok', perms: ['inventory:read', 'inventory:write'] },
      { id: 'warehouse', name: 'Gudang (WMS)', perms: ['warehouse:read', 'warehouse:write'] },
      { id: 'factory', name: 'Manufaktur & BoM', perms: ['factory:read', 'factory:write'] },
      { id: 'workshop', name: 'Workshop & Service', perms: ['workshop:read', 'workshop:write'] },
      { id: 'joborder', name: 'Job Order (Jasa)', perms: ['joborder:read', 'joborder:write'] },
      { id: 'project', name: 'Proyek & Konstruksi', perms: ['project:read', 'project:write'] },
      { id: 'fleet', name: 'Fleet & Rental', perms: ['fleet:read', 'fleet:write'] },
      { id: 'lms', name: 'LMS / Lembaga Pelatihan', perms: ['lms:read', 'lms:write'] },
      { id: 'koperasi', name: 'Koperasi Syariah', perms: ['koperasi:read', 'koperasi:write'] },
      { id: 'syirkah', name: 'Akad Syirkah', perms: ['syirkah:read', 'syirkah:write'] },
    ]
  },
  {
    category: 'Marketing & Sales',
    val: 'MARKETING_SALES',
    modules: [
      { id: 'crm', name: 'Pelanggan (CRM)', perms: ['crm:read', 'crm:write'] },
      { id: 'pos', name: 'POS (Kasir)', perms: ['pos:read', 'pos:write'] },
      { id: 'salespage', name: 'Landing Penjualan', perms: ['salespage:read', 'salespage:write'] },
      { id: 'quotation', name: 'Penawaran Harga', perms: ['quotation:read', 'quotation:write'] },
      { id: 'sales', name: 'Penjualan', perms: ['sales:read', 'sales:write'] },
    ]
  },
  {
    category: 'HRIS',
    val: 'HRIS',
    modules: [
      { id: 'employees', name: 'Karyawan Dasar', perms: ['employees:read', 'employees:write'] },
      { id: 'payroll', name: 'Payroll & Slip Gaji', perms: ['payroll:read', 'payroll:write'] },
      { id: 'attendance', name: 'Absensi & Cuti', perms: ['attendance:read', 'attendance:write'] },
    ]
  }
]

export default function RolesManagementPage() {
  const { orgId: resolvedOrgId } = useActiveOrgId()
  const [org, setOrg] = useState<{ org_id: string } | null>(null)
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [newRoleModal, setNewRoleModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDepts, setNewRoleDepts] = useState<string[]>([])
  const [newRoleParent, setNewRoleParent] = useState<string | null>(null)
  const [editingInfo, setEditingInfo] = useState<any>(null)
  const [enabledModules, setEnabledModules] = useState<string[]>([])

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean, id: string, name: string }>({ open: false, id: '', name: '' })

  /** Modul yang kelihatan di roles cumanya kalau udah aktif (business type & add-on) */
  const GATED_MODULE_MAP: Record<string, string> = {
    factory: 'Manufacturing',
    workshop: 'Workshop',
    joborder: 'Job Order',
    project: 'Project & Construction',
    fleet: 'Fleet & Rental',
    lms: 'LMS',
    pos: 'POS',
    salespage: 'Sales Page',
  }

  const loadData = async (shouldSelectFirst = false) => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const activeOrgId = resolvedOrgId
      if (!activeOrgId) {
        setErrorMsg('Organisasi belum terdeteksi. Silakan tunggu atau refresh halaman.')
        setLoading(false)
        return
      }

      setOrg({ org_id: activeOrgId })

      const { data: rolesData, error: rolesError } = await getRolesForOrganization(activeOrgId)

      if (rolesError) {
        setErrorMsg(rolesError)
      } else if (rolesData) {
        const normalizedRoles = rolesData.map((role: any) => normalizeRoleRecord(role))
        setRoles(normalizedRoles)
        if (shouldSelectFirst || !activeRoleId) {
          setActiveRoleId(normalizedRoles[0]?.id || null)
        }
      }

      // Ambil modul yang aktif biar permission checkbox disesuaikan
      const { modules } = await getActiveOrgEnabledModules()
      setEnabledModules(modules || [])
    } catch (e: any) {
      setErrorMsg('Terjadi kesalahan fatal: ' + (e.message || 'Unknown Error'))
    }
    setLoading(false)
  }

  useEffect(() => { if (resolvedOrgId) loadData(true) }, [resolvedOrgId])


  const sortedRoles = useMemo(() => {
    const buildTree = (parentId: string | null = null, depth = 0): any[] => {
      const children = roles.filter(r => r.parent_id === parentId)
      let results: any[] = []
      children.forEach(c => {
        results.push({ ...c, depth })
        results = [...results, ...buildTree(c.id, depth + 1)]
      })
      return results
    }

    const roots = buildTree(null)
    const processedIds = new Set(roots.map(r => r.id))
    const orphans = roles.filter(r => !processedIds.has(r.id))
    return [...roots, ...orphans.map(o => ({ ...o, depth: 0 }))]
  }, [roles])

  const activeRole = roles.find(r => r.id === activeRoleId)
  const activeRoleDepartmentIds = useMemo(() => normalizeDepartmentIds(activeRole?.department_ids), [activeRole])
  const activeRolePermissions = useMemo(() => normalizePermissions(activeRole?.permissions), [activeRole])

  // FILTERED MODULES — cuma nampilin modul yang udah aktif di org
  const activeCategories = useMemo(() => {
    if (!activeRole) return []
    if (activeRoleDepartmentIds.length === 0) return []

    const normalizedEnabled = new Set(
      enabledModules.map((e: string) => e.toLowerCase().replace(/\s+/g, ''))
    )

    return MODULE_CATEGORIES
      .filter(cat => activeRoleDepartmentIds.includes(cat.val))
      .map(cat => ({
        ...cat,
        modules: cat.modules.filter((mod: { id: string; name: string; perms: string[] }) => {
          const registryKey = GATED_MODULE_MAP[mod.id]
          // Not gated → pillar sub-module, always visible
          if (!registryKey) return true
          // Gated → only show if its module key is in enabledModules
          return normalizedEnabled.has(registryKey.toLowerCase().replace(/\s+/g, ''))
        })
      }))
      .filter(cat => cat.modules.length > 0) // sembunyiin kategori yang semua modulnya nonaktif
  }, [activeRole, activeRoleDepartmentIds, enabledModules])

  const togglePermission = async (perm: string) => {
    if (!activeRole || !activeRoleId || !org?.org_id) return
    const pSet = new Set(activeRolePermissions)
    if (pSet.has(perm)) pSet.delete(perm)
    else pSet.add(perm)

    const updatedPerms = Array.from(pSet)
    const updatedRoles = roles.map(r => r.id === activeRoleId ? { ...r, permissions: updatedPerms } : r)
    setRoles(updatedRoles)

    const { error } = await updateOrganizationRolePermissions(org.org_id, activeRoleId, updatedPerms)
    if (error) alert('Gagal update izin: ' + error)
  }

  const updateRolesOrder = async (newOrder: any[]) => {
    setRoles(newOrder)
    if (!org?.org_id) return
    const { error } = await reorderOrganizationRoles(org.org_id, newOrder.map((role) => role.id))
    if (error) {
      setErrorMsg('Gagal menyimpan urutan jabatan: ' + error)
      loadData()
    }
  }

  const resetModal = () => {
    setNewRoleName('')
    setNewRoleDepts([])
    setNewRoleParent(null)
    setEditingInfo(null)
    setNewRoleModal(false)
    setErrorMsg(null)
  }

  const handleOpenEdit = (role: any) => {
    setEditingInfo(role)
    setNewRoleName(role.name)
    setNewRoleDepts(normalizeDepartmentIds(role.department_ids))
    setNewRoleParent(role.parent_id || null)
    setNewRoleModal(true)
  }

  const submitRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim() || !org?.org_id) {
       setErrorMsg('Pastikan nama jabatan terisi dan organisasi terdeteksi.')
       return
    }
    
    setErrorMsg(null)
    const payload = {
      name: newRoleName.trim(),
      org_id: org.org_id,
      department_ids: newRoleDepts,
      parent_id: newRoleParent,
    }

    const result = await saveOrganizationRole(org.org_id, {
      id: editingInfo?.id || null,
      name: payload.name,
      departmentIds: payload.department_ids,
      parentId: payload.parent_id,
    })
    
    if (result.error) {
       setErrorMsg('Gagal simpan: ' + result.error)
    } else {
       resetModal()
       loadData()
    }
  }

  const deleteRole = async () => {
    if (!confirmDelete.id || !org?.org_id) return
    const { error } = await deleteOrganizationRole(org.org_id, confirmDelete.id)
    if (error) alert('Gagal hapus: ' + error)
    setConfirmDelete({ open: false, id: '', name: '' })
    loadData(true)
  }

  if (loading && roles.length === 0) return <div className="p-20 text-center animate-pulse text-slate-400 font-semibold tracking-tight text-[10px]">Menyinkronkan Struktur...</div>

  return (
    <div className="flex h-[calc(100vh-140px)] overflow-hidden bg-slate-50/50 rounded-2xl p-2 border border-slate-100 shadow-2xl relative">
      
      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[100] bg-rose-500 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-3 animate-bounce">
          <AlertCircle size={20} />
          <p className="text-sm font-semibold tracking-tight">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="ml-4 opacity-50 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-80 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] leading-none">Hak Akses</h2>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Struktur Jabatan</p>
            </div>
          </div>
          <SafeButton variant="primary" icon={<Plus size={14} />} onClick={() => setNewRoleModal(true)} className="w-full py-4 text-[10px] tracking-widest font-black uppercase">
            TAMBAH JABATAN
          </SafeButton>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {roles.length === 0 && !loading && (
            <div className="p-10 text-center space-y-3 opacity-30">
              <Users size={32} className="mx-auto" />
              <p className="text-[10px] font-semibold tracking-tight">Jabatan Kosong</p>
            </div>
          )}
          <Reorder.Group axis="y" values={roles} onReorder={updateRolesOrder} className="space-y-2">
            {sortedRoles.map((role: any) => (
              <Reorder.Item key={role.id} value={role} className="relative group touch-none">
                <div className="flex items-center" style={{ paddingLeft: `${role.depth * 20}px` }}>
                  {role.depth > 0 && <CornerDownRight size={14} className="text-slate-200 mr-2 shrink-0" />}
                  <button onClick={() => setActiveRoleId(role.id)} className={`flex-1 text-left p-4 rounded-3xl transition-all border flex items-center gap-3 ${activeRoleId === role.id ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200' : 'bg-white border-transparent hover:border-slate-200 text-slate-600 shadow-sm'}`}>
                    <GripVertical size={14} className={`${activeRoleId === role.id ? 'text-slate-600' : 'text-slate-300'} opacity-40 group-hover:opacity-100 transition-opacity`} />
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-semibold text-[11px] uppercase tracking-tight truncate">{role.name}</h3>
                    </div>
                  </button>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      </aside>

      {/* DETAIL PANEL */}
      <main className="flex-1 flex flex-col h-full bg-white rounded-2xl ml-2 border border-slate-100 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeRole ? (
            <motion.div key={activeRole.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="h-full flex flex-col">
              <header className="p-8 border-b border-slate-50 flex items-center justify-between bg-white z-10 shadow-sm">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-200 shadow-inner">
                    <Users size={28} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-2">{activeRole.name}</h1>
                    <div className="flex items-center gap-2">
                       {activeRoleDepartmentIds.map((d: string) => (
                         <span key={d} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 text-[8px] font-semibold rounded uppercase tracking-tight">{d}</span>
                       ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleOpenEdit(activeRole)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"><Edit2 size={18} /></button>
                  {!activeRole.is_system && (
                    <button onClick={() => setConfirmDelete({ open: true, id: activeRole.id, name: activeRole.name })} className="p-3 bg-red-50 text-red-400 hover:text-white hover:bg-red-500 rounded-2xl transition-all"><Trash2 size={18} /></button>
                  )}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar pb-32">
                {activeCategories.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto py-20">
                     <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-100">
                        <Sparkles size={40} />
                     </div>
                     <div>
                       <h3 className="text-xl font-semibold text-slate-900 uppercase tracking-tight mb-2">Panel Masih Bersih</h3>
                       <p className="text-xs text-slate-400 font-bold leading-relaxed tracking-tight italic">Silakan klik ikon Pensil (Edit) di atas untuk memilih **Klasifikasi Departemen** agar Bapak bisa mengatur izin jabatan ini Pak.</p>
                     </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                    {activeCategories.map(cat => (
                      <div key={cat.category} className="space-y-6">
                          <div className="flex items-center justify-between border-b-2 border-slate-50 pb-3 h-10">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-lg shadow-indigo-100" />
                                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">{cat.category}</h4>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {cat.modules.map(mod => {
                              const hasRead = activeRolePermissions.includes(mod.perms[0])
                              const hasWrite = mod.perms.length > 1 ? activeRolePermissions.includes(mod.perms[1]) : hasRead
                              return (
                                <div key={mod.id} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl group hover:border-indigo-100 hover:bg-indigo-50/20 transition-all shadow-sm">
                                    <div>
                                      <p className="font-bold text-xs text-slate-800 leading-none mb-1">{mod.name}</p>
                                      <p className="text-[8px] text-slate-400 font-semibold tracking-tight">{mod.id}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => togglePermission(mod.perms[0])} className={`px-5 py-2.5 rounded-xl text-[9px] font-semibold tracking-tight transition-all border ${hasRead ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-100' : 'bg-white text-slate-300 border-slate-100 hover:text-slate-600 hover:border-slate-300'}`}>
                                        {hasRead && <Check size={10} className="inline mr-1" />} Lihat
                                      </button>
                                      {mod.perms.length > 1 && (
                                        <button onClick={() => togglePermission(mod.perms[1])} className={`px-5 py-2.5 rounded-xl text-[9px] font-semibold tracking-tight transition-all border ${hasWrite ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' : 'bg-white text-slate-300 border-slate-100 hover:text-slate-600 hover:border-slate-300'}`}>
                                          {hasWrite && <Check size={10} className="inline mr-1" />} Ubah
                                        </button>
                                      )}
                                    </div>
                                </div>
                              )
                            })}
                          </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
              <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-inner">
                <Shield size={40} className="opacity-20" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Pilih Jabatan untuk Mengatur Izin</p>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* MODALS */}
      <ConfirmDialog isOpen={confirmDelete.open} onClose={() => setConfirmDelete({ open: false, id: '', name: '' })} onConfirm={deleteRole} title="Hapus Jabatan?" message={`Anda yakin ingin menghapus "${confirmDelete.name}"? Ini tidak bisa dibatalkan.`} variant="danger" confirmLabel="Hapus Jabatan" />

      <AnimatePresence>
         {newRoleModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={resetModal} />
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }} className="relative bg-white rounded-[60px] shadow-2xl w-full max-w-xl p-16 border border-white max-h-[90vh] overflow-y-auto custom-scrollbar">
                   <h3 className="text-3xl font-semibold text-slate-900 mb-10 tracking-tighter uppercase italic">{editingInfo ? 'Edit Profil Jabatan' : 'Tambah Jabatan Baru'}</h3>
                   <form onSubmit={submitRole} className="space-y-10">
                     <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-[0.3em]">Nama Jabatan</label>
                       <input autoFocus value={newRoleName} onChange={e => setNewRoleName(e.target.value)} required className="w-full px-10 py-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-sm font-black transition-all" placeholder="Cth: Kepala Gudang Pusat" />
                     </div>
                     <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-[0.3em]">Jabatan Atasan Langsung</label>
                       <select value={newRoleParent || ''} onChange={e => setNewRoleParent(e.target.value || null)} className="w-full px-10 py-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-sm font-black appearance-none">
                         <option value="">-- Tidak Memiliki Atasan --</option>
                         {roles.filter(r => r.id !== editingInfo?.id).map(r => (
                           <option key={r.id} value={r.id}>{r.name}</option>
                         ))}
                       </select>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-[0.3em]">Klasifikasi Departemen</label>
                        <div className="grid grid-cols-2 gap-4">
                          {MODULE_CATEGORIES.map(cat => (
                             <button key={cat.category} type="button" onClick={() => {
                               if (newRoleDepts.includes(cat.val)) setNewRoleDepts(newRoleDepts.filter(d => d !== cat.val))
                               else setNewRoleDepts([...newRoleDepts, cat.val])
                             }} className={`p-6 rounded-xl text-[10px] font-black uppercase tracking-tight text-center transition-all border-2 flex flex-col items-center justify-center gap-2 ${newRoleDepts.includes(cat.val) ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xl shadow-indigo-200' : 'bg-slate-50 text-slate-300 border-slate-100 hover:border-slate-300'}`}>
                               {cat.category}
                             </button>
                          ))}
                        </div>
                     </div>
                     <div className="pt-8 flex gap-4">
                        <button type="button" onClick={resetModal} className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-3xl font-semibold text-[11px] uppercase tracking-tight hover:bg-slate-200 transition-colors">Batal</button>
                        <button type="submit" className="flex-1 py-6 bg-indigo-600 text-white rounded-3xl font-semibold text-[11px] uppercase tracking-tight hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200">{editingInfo ? 'SIMPAN PERUBAHAN' : 'BUAT JABATAN'}</button>
                     </div>
                  </form>
                </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  )
}
