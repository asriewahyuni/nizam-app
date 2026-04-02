'use client'

import React, { useEffect, useState } from 'react'
import { ArrowLeft, Plus, MapPin, Search, Maximize, CheckCircle2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { createWarehouseBin, deleteWarehouseBin } from '@/modules/inventory/actions/warehouse.actions'

interface WarehouseDetailClientProps {
  orgId: string
  activeBranchId: string | null
  activeBranchName?: string | null
  warehouse: any
  initialBins: any[]
  userRole: string
}

export function WarehouseDetailClient({
  orgId,
  activeBranchId,
  activeBranchName,
  warehouse,
  initialBins,
  userRole,
}: WarehouseDetailClientProps) {
  const [bins, setBins] = useState(initialBins)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    barcode: ''
  })

  const isAdmin = ['owner', 'admin', 'manager'].includes(userRole)
  const binMutationGuardMessage = !activeBranchId
    ? 'Mode Semua Unit hanya untuk baca. Pilih unit aktif untuk mengelola bin gudang.'
    : null

  useEffect(() => {
    setBins(initialBins)
  }, [initialBins])

  useEffect(() => {
    if (!binMutationGuardMessage) return
    setShowModal(false)
  }, [binMutationGuardMessage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (binMutationGuardMessage) {
      alert(binMutationGuardMessage)
      return
    }
    setSubmitting(true)
    const res = await createWarehouseBin(orgId, { ...formData, warehouse_id: warehouse.id })
    if ('error' in res && res.error) {
      alert(res.error)
    } else if ('data' in res) {
      setBins([...bins, res.data])
      setShowModal(false)
      setFormData({ code: '', description: '', barcode: '' })
    }
    setSubmitting(false)
  }

  const handleDelete = async (binId: string) => {
    if (binMutationGuardMessage) {
      alert(binMutationGuardMessage)
      return
    }
    if (!confirm('Yakin ingin menghapus Bin ini? Data terkait stok mungkin terpengaruh.')) return
    const res = await deleteWarehouseBin(orgId, binId)
    if (!('error' in res) || !res.error) {
       setBins(bins.filter(b => b.id !== binId))
    } else {
       alert(res.error)
    }
  }

  const filteredBins = bins.filter(b => b.code.toLowerCase().includes(search.toLowerCase()) || (b.barcode && b.barcode.includes(search)))

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      
      {/* Header with Background */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-8 sm:p-10 text-white">
        <div className="absolute top-0 right-0 p-10 opacity-10">
           <MapPin size={240} className="transform rotate-12 translate-x-12 -translate-y-12" />
        </div>
        
        <div className="relative z-10">
          <Link href="/inventory/warehouses" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold mb-6">
            <ArrowLeft size={16} /> Kembali ke Daftar Gudang
          </Link>
          
          <div className="flex flex-col md:flex-row gap-6 md:items-end justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-black uppercase tracking-widest">
                <CheckCircle2 size={14} /> Warehouse Aktif
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{warehouse.name}</h1>
              <div className="flex items-center gap-2 text-slate-400 font-medium max-w-lg leading-relaxed">
                 <MapPin size={18} className="shrink-0" />
                 <span>{warehouse.address || 'Alamat fisik belum diatur.'}</span>
              </div>
            </div>
            
            <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 flex flex-col gap-1 min-w-[200px]">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kode WMS</span>
               <span className="text-3xl font-black text-white">{warehouse.code}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bin Management Section */}
      <div className="space-y-6">
         {binMutationGuardMessage && (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800 shadow-sm">
              {binMutationGuardMessage} {activeBranchName ? `Unit aktif saat ini: ${activeBranchName}.` : ''}
            </div>
         )}
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">Layout Bins & Lorong</h2>
               <p className="text-slate-500 font-medium text-sm">Pemetaan struktur rak (Bin) untuk proses putaway yang akurat.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
               <div className="relative flex-1 sm:w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                   type="text" 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   placeholder="Cari kode rak / barcode..."
                   className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                 />
               </div>
               
               {isAdmin && (
                  <button 
                    onClick={() => setShowModal(true)}
                    disabled={Boolean(binMutationGuardMessage)}
                    title={binMutationGuardMessage || 'Tambah bin baru'}
                    className="shrink-0 flex items-center gap-2 px-4 py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
                  >
                    <Plus size={18} /> Bin Baru
                  </button>
               )}
            </div>
         </div>

         {/* Bin Grid */}
         <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredBins.length === 0 ? (
               <div className="col-span-full py-16 bg-white border border-slate-200 border-dashed rounded-3xl flex flex-col items-center justify-center text-center">
                  <Maximize size={48} className="text-slate-200 mb-4" />
                  <h3 className="font-bold text-slate-900 text-lg">Belum Ada Bin</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2">Buat Bin/Lorong/Rak pertama Anda untuk memetakan kapasitas gudang secara 3D.</p>
               </div>
            ) : (
               filteredBins.map(bin => (
                 <div key={bin.id} className="relative bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-500 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                       <div className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-black tracking-widest uppercase border border-slate-200/60">
                         {warehouse.code}-{bin.code}
                       </div>
                       {isAdmin && (
                         <button
                           onClick={() => handleDelete(bin.id)}
                           disabled={Boolean(binMutationGuardMessage)}
                           title={binMutationGuardMessage || 'Hapus bin'}
                           className="text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-300"
                         >
                            <Trash2 size={16} />
                         </button>
                       )}
                    </div>
                    
                    <h4 className="font-bold text-slate-900 text-xl tracking-tight mb-1">{bin.code}</h4>
                    <p className="text-xs font-medium text-slate-500 mb-4 line-clamp-2">{bin.description || 'Tidak ada deskripsi'}</p>
                    
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Barcode ID</span>
                       <span className="text-xs font-bold text-emerald-600 font-mono">
                          {bin.barcode || <span className="text-slate-300">Belum Diset</span>}
                       </span>
                    </div>
                 </div>
               ))
            )}
         </div>
      </div>

      {/* Modal Add Bin */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                 <Maximize size={20} className="text-emerald-600" /> Pembuatan Bin Lokasi
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Kode Bin / Rak <span className="text-rose-500">*</span></label>
                <div className="flex items-center">
                   <div className="px-4 py-3 bg-slate-100 border border-slate-200 border-r-0 rounded-l-xl text-sm font-bold text-slate-500">
                     {warehouse.code}-
                   </div>
                   <input 
                     type="text" 
                     value={formData.code} 
                     onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                     className="flex-1 bg-white border border-slate-200 rounded-r-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none uppercase placeholder:font-normal placeholder:normal-case"
                     placeholder="A1, RAK-C..."
                     required
                     maxLength={20}
                   />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Barcode Khusus (Opsional)</label>
                <input 
                  type="text" 
                  value={formData.barcode} 
                  onChange={e => setFormData({...formData, barcode: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Scan barcode di rak ini..."
                />
                <p className="text-[10px] text-slate-500 mt-1">Kosongkan jika sistem otomatis membuat berdasarkan kode.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Deskripsi Tambahan</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-20"
                  placeholder="Lantai 1, khusus barang rapuh..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                  Batal
                </button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-3 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-70">
                  {submitting ? 'Menyimpan...' : 'Buat Bin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
