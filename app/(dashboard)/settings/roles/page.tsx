'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Check, X, Shield, Users, Plus, Trash2 } from 'lucide-react'
import { PageHeader, SectionCard, SafeButton, ConfirmDialog } from '@/components/ui/NizamUI'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const AVAILABLE_MODULES = [
  { id: 'accounting', name: 'Accounting & Finance', perms: ['accounting:read', 'accounting:write'] },
  { id: 'inventory', name: 'Inventory / WMS', perms: ['inventory:read', 'inventory:write'] },
  { id: 'sales', name: 'Sales & POS', perms: ['sales:read', 'sales:write'] },
  { id: 'purchasing', name: 'Purchasing', perms: ['purchasing:read', 'purchasing:write'] },
  { id: 'hris', name: 'HRIS & Payroll', perms: ['hris:read', 'hris:write'] },
  { id: 'reports', name: 'Reports (Laporan)', perms: ['reports:read'] }
]

export default function RolesManagementPage() {
  const [org, setOrg] = useState<any>(null)
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newRoleModal, setNewRoleModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean, id: string, name: string }>({ open: false, id: '', name: '' })

  const loadData = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: memberData } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .limit(1)

    if (memberData && memberData.length > 0) {
      setOrg(memberData[0])
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .eq('org_id', memberData[0].org_id)
        .order('name')
      
      if (rolesData) setRoles(rolesData)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const togglePermission = async (roleId: string, perm: string) => {
    const roleIndex = roles.findIndex(r => r.id === roleId)
    if (roleIndex === -1) return

    const currentRole = roles[roleIndex]
    const pSet = new Set(currentRole.permissions || [])

    if (pSet.has(perm)) pSet.delete(perm)
    else pSet.add(perm)

    const updatedPerms = Array.from(pSet)
    const updatedRoles = [...roles]
    updatedRoles[roleIndex].permissions = updatedPerms
    setRoles(updatedRoles)

    await supabase.from('roles').update({ permissions: updatedPerms }).eq('id', roleId)
  }

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim() || !org?.org_id) return
    
    await supabase.from('roles').insert([{
      name: newRoleName.trim(),
      org_id: org.org_id,
      permissions: [],
      is_system: false
    }])
    
    setNewRoleName('')
    setNewRoleModal(false)
    loadData()
  }

  const deleteRole = async () => {
    if (!confirmDelete.id) return
    await supabase.from('roles').delete().eq('id', confirmDelete.id)
    setConfirmDelete({ open: false, id: '', name: '' })
    loadData()
  }

  if (loading && roles.length === 0) return <div className="p-20 text-center animate-pulse text-slate-400">Memuat aturan izin...</div>

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Role & Akses Modul"
        subtitle="Atur izin setiap divisi/jabatan untuk mencegah akses karyawan asing ke modul tertentu."
        icon={<ShieldAlert />}
        iconColor="text-indigo-600"
        actions={
          <SafeButton variant="primary" icon={<Plus size={16} />} onClick={() => setNewRoleModal(true)}>
             Tambah Jabatan Baru
          </SafeButton>
        }
      />

      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-3xl text-sm mb-6 flex gap-3 shadow-sm">
         <Shield className="text-amber-500 shrink-0" />
         <div>
            <p className="font-bold">Keamanan Role-Based Access Control (RBAC)</p>
            <p className="mt-1">Pilih centang pada modul yang boleh dibuka oleh masing-masing jabatan. Anda juga bisa membuat jabatan spesifik baru seperti "Admin HRD" atau "Kasir Gudang".</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {roles.map(role => (
           <SectionCard key={role.id}>
             <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                 <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 text-indigo-600">
                       <Users size={20} />
                    </div>
                    <div>
                       <h3 className="font-black text-slate-900">{role.name}</h3>
                       <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                         {role.is_system ? 'Bawaan Sistem' : 'Jabatan Kustom'}
                       </p>
                    </div>
                 </div>
                 {!role.is_system && (
                    <button 
                       onClick={() => setConfirmDelete({ open: true, id: role.id, name: role.name })}
                       className="p-2 text-rose-400 hover:text-white hover:bg-rose-500 rounded-lg transition-colors"
                    >
                       <Trash2 size={16} />
                    </button>
                 )}
             </div>
             
             <div className="space-y-4">
                {AVAILABLE_MODULES.map(mod => {
                   const hasRead = (role.permissions || []).includes(mod.perms[0])
                   const hasWrite = mod.perms.length > 1 ? (role.permissions || []).includes(mod.perms[1]) : hasRead

                   return (
                     <div key={mod.id} className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 shadow-sm transition-colors hover:border-slate-300">
                        <div className="flex justify-between items-center mb-3">
                           <span className="font-bold text-sm text-slate-700">{mod.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <button 
                             onClick={() => togglePermission(role.id, mod.perms[0])}
                             className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                               hasRead ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                             }`}
                           >
                             {hasRead ? <Check size={14} /> : <X size={14} />} Lihat
                           </button>

                           {mod.perms.length > 1 && (
                              <button 
                                onClick={() => togglePermission(role.id, mod.perms[1])}
                                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                  hasWrite ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {hasWrite ? <Check size={14} /> : <X size={14} />} Ubah
                              </button>
                           )}
                        </div>
                     </div>
                   )
                })}
             </div>
           </SectionCard>
         ))}
      </div>

      <AnimatePresence>
        {newRoleModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setNewRoleModal(false)} />
               <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-sm p-8 border border-slate-100">
                  <h3 className="text-xl font-black text-slate-900 mb-6">Tambah Jabatan</h3>
                  <form onSubmit={createRole} className="space-y-4">
                     <div>
                       <label className="block text-xs font-black uppercase text-slate-500 mb-2">Nama Jabatan (Role)</label>
                       <input 
                          autoFocus
                          value={newRoleName}
                          onChange={e => setNewRoleName(e.target.value)}
                          required 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                          placeholder="Cth: Admin HRD" 
                       />
                     </div>
                     <div className="pt-4 flex gap-3">
                       <button type="button" onClick={() => setNewRoleModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors">Batal</button>
                       <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">Simpan</button>
                     </div>
                  </form>
               </motion.div>
           </div>
        )}
      </AnimatePresence>

      <ConfirmDialog 
        isOpen={confirmDelete.open} 
        onClose={() => setConfirmDelete({ open: false, id: '', name: '' })} 
        onConfirm={deleteRole}
        title="Hapus Jabatan?"
        message={`Anda yakin ingin menghapus jabatan custom "${confirmDelete.name}"? Karyawan yang ada di jabatan ini akan kehilangan akses spesifiknya.`}
        variant="danger"
        confirmLabel="Hapus Jabatan"
      />
    </div>
  )
}
