'use client'

import React, { useState } from 'react'
import { Plus, Users, Shield, Trash2, Edit2, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function UsersClient({ orgId, initialMembers }: { orgId: string, initialMembers: any[] }) {
  const [members, setMembers] = useState(initialMembers)
  const [loading, setLoading] = useState(false)
  const [emailToInvite, setEmailToInvite] = useState('')
  const [roleToInvite, setRoleToInvite] = useState('staff')
  const supabase = createClient()

  // MOCK INVITE ACTION FOR NOW (Requires edge function or admin API to really manipulate Auth)
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    alert(`Fitur Undangan (Invite via Email ke ${emailToInvite}) sedang dalam mode integrasi Admin API di Phase 3.`)
  }

  const handleDelete = async (memberId: string) => {
    if (!confirm('Hapus pengguna ini dari organisasi?')) return
    setLoading(true)
    const { error } = await (supabase as any).from('org_members').delete().eq('id', memberId)
    if (!error) {
      setMembers(members.filter((m: any) => m.id !== memberId))
    } else {
      alert(error.message)
    }
    setLoading(false)
  }

  const handleUpdateRole = async (memberId: string, currentRole: string) => {
    const newRole = prompt('Masukkan peran baru (owner, admin, hr, manager, staff, viewer):', currentRole)
    if (!newRole) return
    if (!['owner', 'admin', 'hr', 'manager', 'staff', 'viewer'].includes(newRole.toLowerCase())) {
       alert('Peran tidak valid.')
       return
    }

    setLoading(true)
    const { error } = await (supabase as any).from('org_members').update({ role: newRole }).eq('id', memberId)
    if (!error) {
      setMembers(members.map((m: any) => m.id === memberId ? { ...m, role: newRole } : m))
    } else {
      alert(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Shield className="text-slate-600" size={32} />
          Pengguna & Hak Akses
        </h1>
        <p className="text-sm text-slate-500 font-medium">Pengaturan tim (User Management) dan level otorisasi CRUD pada sistem ERP NIZAM.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* INVITE BOX */}
        <div className="col-span-1 border border-slate-100 bg-white rounded-3xl p-6 shadow-sm h-fit">
           <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-blue-500"/> Tambah Pengguna
           </h3>
           <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Alamat Email</label>
                <input type="email" required value={emailToInvite} onChange={e => setEmailToInvite(e.target.value)} className="w-full mt-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500" placeholder="nama@email.com" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Peran (Role)</label>
                <select required value={roleToInvite} onChange={e => setRoleToInvite(e.target.value)} className="w-full mt-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500">
                   <option value="owner">Owner (Super Admin)</option>
                   <option value="admin">Administrator</option>
                   <option value="manager">Manager</option>
                   <option value="hr">HR / Personalia</option>
                   <option value="staff">Staff Umum</option>
                   <option value="viewer">Viewer (Hanya Baca)</option>
                </select>
              </div>
              <button disabled={loading} type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition">
                Kirim Undangan (Invite)
              </button>
           </form>
           
           <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 font-medium flex gap-3 items-start">
             <ShieldAlert size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
             <p>Memberikan peran `Owner` atau `Admin` akan membuka seluruh akses keuangan, inventory, dan HRIS.</p>
           </div>
        </div>

        {/* USERS LIST */}
        <div className="col-span-1 lg:col-span-2 border border-slate-100 bg-white rounded-3xl overflow-hidden shadow-sm">
           <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                   <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">User ID & Info</th>
                   <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Peran (Role)</th>
                   <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {members.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 uppercase">
                             {(m.user?.email?.[0] || 'U')}
                           </div>
                           <div>
                              <p className="font-bold text-slate-900 text-sm">User ID: {m.user_id.substring(0,8)}...</p>
                              <p className="text-xs text-slate-500">Mulai: {new Date(m.joined_at).toLocaleDateString()}</p>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border 
                          ${m.role === 'owner' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                            m.role === 'hr' ? 'bg-pink-50 text-pink-600 border-pink-100' :
                            m.role === 'admin' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                        >
                          {m.role}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <button onClick={() => handleUpdateRole(m.id, m.role)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Ubah Peran">
                              <Edit2 size={16} />
                           </button>
                           <button onClick={() => handleDelete(m.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Hapus User">
                              <Trash2 size={16} />
                           </button>
                        </div>
                     </td>
                  </tr>
                ))}
                {members.length === 0 && (
                   <tr>
                     <td colSpan={3} className="px-6 py-10 text-center text-slate-400 font-medium">Belum ada pengguna di organisasi ini.</td>
                   </tr>
                )}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  )
}
