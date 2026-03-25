'use client'

import React, { useState } from 'react'
import { Warehouse, Plus, MapPin, Package, CheckCircle2 } from 'lucide-react'
import { createWarehouse } from '@/modules/inventory/actions/warehouse.actions'
import Link from 'next/link'

interface WarehouseClientProps {
  orgId: string
  initialWarehouses: any[]
  userRole: string
}

export function WarehouseClient({ orgId, initialWarehouses, userRole }: WarehouseClientProps) {
  const [warehouses, setWarehouses] = useState(initialWarehouses)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const res = await createWarehouse(orgId, formData)
    
    if (res.error) {
       alert(res.error)
    } else {
       // Refresh page gracefully
       window.location.reload()
    }
    setSubmitting(false)
  }

  const isAdmin = ['owner', 'admin', 'manager'].includes(userRole)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Warehouse className="text-emerald-600" size={32} />
            Daftar Gudang
          </h1>
          <p className="text-slate-500 font-medium">Manajemen lokasi fisik dan pusat distribusi (WMS).</p>
        </div>
        
        {isAdmin && (
           <button 
             onClick={() => setShowModal(true)}
             className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-200"
           >
             <Plus size={20} />
             Gudang Baru
           </button>
        )}
      </div>

      {/* Grid Gudang */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.length === 0 ? (
          <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-400">
              <Warehouse size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-lg">Belum Ada Gudang</h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto">Tambahkan lokasi fisik untuk mulai melacak persediaan Anda.</p>
            </div>
          </div>
        ) : (
          warehouses.map((w) => (
            <Link href={`/inventory/warehouses/${w.id}`} key={w.id} className="block bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-emerald-100 transition-all group relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
               <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700 font-bold border border-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                     {w.code}
                  </div>
                  {w.is_active && (
                     <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                        <CheckCircle2 size={12} /> Aktif
                     </div>
                  )}
               </div>
               
               <h3 className="text-xl font-bold text-slate-900 mb-2 truncate group-hover:text-emerald-700 transition-colors" title={w.name}>{w.name}</h3>
               
               <div className="flex items-start gap-2 text-slate-500 text-sm">
                 <MapPin size={16} className="shrink-0 mt-0.5" />
                 <p className="line-clamp-2 leading-relaxed">{w.address || 'Alamat belum diatur'}</p>
               </div>
               
               <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                     <Package size={18} className="text-emerald-500" />
                     <span>Atur Bin & Layout</span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                     Buka &rarr;
                  </div>
               </div>
            </Link>
          ))
        )}
      </div>

      {/* Modal Tambah Gudang */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                 <Warehouse size={20} className="text-emerald-600" />
                 Tambah Gudang Baru
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Kode Gudang (Singkatan)</label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:font-normal"
                  placeholder="e.g., JKT-01"
                  required
                  maxLength={10}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Nama Gudang</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="Gudang Distribusi Jakarta"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Alamat Fisik</label>
                <textarea 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none h-24"
                  placeholder="Jl. Raya Perjuangan No.1..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-3 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                  {submitting ? 'Menyimpan...' : 'Simpan Gudang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
