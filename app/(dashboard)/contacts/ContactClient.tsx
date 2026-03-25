'use client'

import React, { useState } from 'react'
import { Plus, Search, Users, Phone, Building2, UserCircle, Star, Mail, Trophy, Target, TrendingUp } from 'lucide-react'
import { PageHeader, SectionCard, SectionHeader, SafeButton, StatCard } from '@/components/ui/NizamUI'
import { createContact } from '@/modules/contacts/actions/contact.actions'
import { formatRupiah } from '@/lib/utils'

export default function ContactClient({ orgId, contacts, customerPareto }: any) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const customers = contacts.filter((c: any) => c.type === 'CUSTOMER')
  const suppliers = contacts.filter((c: any) => c.type === 'SUPPLIER')
  
  // Pareto Helper
  const isParetoVIP = (cid: string) => {
    return customerPareto?.paretoCustomers?.some((p: any) => p.id === cid)
  }

  const handleCreateContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await createContact(orgId, formData)
    if (res?.error) setError(res.error)
    else {
      setSuccess('Kontak baru berhasil ditambahkan!')
      setShowModal(false)
      setTimeout(() => setSuccess(null), 3000)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      <PageHeader
        icon={<Users />}
        title="Pelanggan & Pemasok (CRM)"
        subtitle="Pusat data relasi bisnis, manajemen pelanggan (Customer), dan pemasok (Supplier)."
        tag="CRM Core"
        actions={
          <SafeButton variant="primary" icon={<Plus size={18} />} onClick={() => setShowModal(true)}>
            Kontak Baru
          </SafeButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Customer" value={customers.length} icon={UserCircle} color="blue" />
        <StatCard label="Total Supplier" value={suppliers.length} icon={Building2} color="emerald" />
        <StatCard label="Customer Pareto (Top 20%)" value={customerPareto?.top20Count || 0} icon={Trophy} color="amber" />
        <StatCard label="Sales / Profit VIP" value={`${formatRupiah(customerPareto?.top20Revenue || 0)} / ${formatRupiah(customerPareto?.top20Profit || 0)}`} icon={TrendingUp} color="indigo" />
      </div>

      {customerPareto && (
        <div className="bg-indigo-900 rounded-[48px] p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/20">
          <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
            <Trophy size={180} />
          </div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="space-y-4">
               <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500 text-amber-950 rounded-full text-[9px] font-black uppercase tracking-widest">
                  <Target size={12}/> Pareto Intelligence
               </div>
               <h2 className="text-3xl font-black italic tracking-tighter leading-tight">Analisis 80/20 Pelanggan VIP</h2>
               <p className="text-sm font-medium text-indigo-200 leading-relaxed">
                 Sistem mendeteksi bahwa <span className="text-white font-bold">{customerPareto.top20Count} pelanggan</span> Anda berkontribusi terhadap <span className="text-amber-400 font-bold">80% dari total pendapatan</span> ({formatRupiah(customerPareto.top20Revenue)}).
               </p>
            </div>
            
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
               {customerPareto.paretoCustomers?.slice(0, 4).map((c: any, i: number) => (
                  <div key={c.name} className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-[32px] flex items-center justify-between group hover:bg-white/20 transition-all">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-black">#{i+1}</div>
                        <div>
                           <div className="text-sm font-bold text-white">{c.name}</div>
                           <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{formatRupiah(c.revenue)}</span>
                             <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">/ {formatRupiah(c.profit || 0)} PROFIT</span>
                           </div>
                        </div>
                     </div>
                     <Star size={16} className="text-amber-400 fill-amber-400" />
                  </div>
               ))}
            </div>
          </div>
        </div>
      )}

      <SectionCard>
        <SectionHeader 
          title="Daftar Relasi Bisnis" 
          subtitle="Database lengkap pelanggan dan mitra perusahaan."
          actions={
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Cari nama atau telepon..." className="pl-9 pr-4 py-2 text-[10px] font-bold border border-slate-200 rounded-xl bg-white focus:border-blue-500 outline-none w-64" />
            </div>
          }
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contacts.map((c: any) => (
            <div key={c.id} className="bg-white border border-slate-100 rounded-[32px] p-6 hover:shadow-xl hover:shadow-blue-500/5 transition-all group relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-2xl -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-opacity" />
               <div className="flex justify-between items-start mb-4">
                 <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-lg">
                   {c.name.slice(0, 1)}
                 </div>
                 <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full ${c.type === 'CUSTOMER' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                   {c.type}
                 </span>
               </div>
               
               <h3 className="text-xl font-black text-slate-800 mb-1 tracking-tight">{c.name}</h3>
               {isParetoVIP(c.id) && (
                 <div className="absolute top-6 right-6">
                    <div className="bg-amber-100 text-amber-600 p-2 rounded-xl shadow-sm border border-amber-200" title="Pelanggan VIP (Pareto 80/20)">
                       <Trophy size={16} />
                    </div>
                 </div>
               )}
               {c.type === 'CUSTOMER' && <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold mb-4 uppercase"><Star size={10} className="fill-amber-500" /> {isParetoVIP(c.id) ? 'Pelanggan VIP (PARETO)' : 'Pelanggan Aktif'}</div>}
               {c.type === 'SUPPLIER' && <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mb-4 uppercase"><Building2 size={10} /> Mitra Bisnis</div>}
               
               <div className="space-y-3 mt-6 pt-6 border-t border-slate-50 italic">
                 <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                   <Phone size={14} className="text-slate-400" /> {c.phone || '-'}
                 </div>
                 <div className="flex items-center gap-3 text-sm font-semibold text-slate-600 truncate">
                   <Mail size={14} className="text-slate-400" /> {c.email || '-'}
                 </div>
               </div>
            </div>
          ))}
        </div>
        {contacts.length === 0 && (
          <div className="text-center py-20 text-slate-400 font-bold text-xs uppercase italic">Belum ada pelanggan atau pemasok didaftarkan.</div>
        )}
      </SectionCard>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">Tambah Kontak Baru</h3>
            <form onSubmit={handleCreateContact} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipe Kontak</label>
                <select name="type" required className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none">
                  <option value="CUSTOMER">PELANGGAN (CUSTOMER)</option>
                  <option value="SUPPLIER">PEMASOK (SUPPLIER)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Lengkap / Perusahaan</label>
                <input name="name" required className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none" placeholder="Contoh: PT ABC Makmur" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor HP</label>
                <input name="phone" className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none" placeholder="08..." />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email (Opsional)</label>
                <input name="email" type="email" className="w-full h-12 px-4 border rounded-xl bg-slate-50 text-sm font-bold focus:border-blue-500 outline-none" placeholder="email@contoh.com" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 font-bold text-slate-400">Batalkan</button>
                <SafeButton variant="primary" isLoading={loading} type="submit">Simpan Data</SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
