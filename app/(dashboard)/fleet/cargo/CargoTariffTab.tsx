'use client'

import React, { useState } from 'react'
import { Plus, Trash2, Save, CreditCard, ChevronRight } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { upsertCargoTariff, deleteCargoTariff } from '@/modules/fleet/actions/cargo-tariff.actions'

export function CargoTariffTab({
  orgId,
  terminals,
  tariffs,
  onRefresh
}: {
  orgId: string
  terminals: any[]
  tariffs: any[]
  onRefresh: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    
    const payload = {
      origin_terminal_id: formData.get('origin_terminal_id'),
      destination_terminal_id: formData.get('destination_terminal_id'),
      base_price: Number(formData.get('base_price')),
      price_per_kg: Number(formData.get('price_per_kg')),
      price_per_m3: Number(formData.get('price_per_m3')),
    }
    
    if (payload.origin_terminal_id === payload.destination_terminal_id) {
       alert('Asal dan Tujuan tidak boleh sama')
       setLoading(false)
       return
    }

    const res = await upsertCargoTariff(orgId, payload)
    if (res.error) alert(res.error)
    else {
      alert('Tarif berhasil disimpan!')
      onRefresh()
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus tarif ini?')) return
    setLoading(true)
    const res = await deleteCargoTariff(orgId, id)
    if (res.error) alert(res.error)
    else onRefresh()
    setLoading(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Form Tarif Baru */}
      <div className="lg:col-span-1 space-y-6">
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-6">
               <Plus className="text-blue-600" /> Tambah / Edit Tarif
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Terminal Asal</label>
                  <select name="origin_terminal_id" required className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-400 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-blue-100 outline-none">
                     <option value="">-- Pilih --</option>
                     {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Terminal Tujuan</label>
                  <select name="destination_terminal_id" required className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-400 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-blue-100 outline-none">
                     <option value="">-- Pilih --</option>
                     {terminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
               </div>
               
               <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tarif Dasar (Flat)</label>
                  <input name="base_price" required type="number" min="0" step="1000" defaultValue="15000" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-emerald-400 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-emerald-100 outline-none" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Per Kg (+)</label>
                    <input name="price_per_kg" required type="number" min="0" step="500" defaultValue="5000" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-emerald-400 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-emerald-100 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Per m³ (+)</label>
                    <input name="price_per_m3" required type="number" min="0" step="1000" defaultValue="0" className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-emerald-400 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-emerald-100 outline-none" />
                  </div>
               </div>

               <button type="submit" disabled={loading} className="w-full py-4 mt-2 bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-blue-200">
                  <Save size={18} /> Simpan Tarif
               </button>
            </form>
         </div>
      </div>

      {/* Daftar Tarif */}
      <div className="lg:col-span-2 space-y-6">
         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm min-h-[500px]">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-6">
               <CreditCard className="text-emerald-600" /> Daftar Tarif Aktif
            </h3>

            {tariffs.length === 0 ? (
               <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-2xl">
                  <p className="text-sm font-bold text-slate-400 italic">Belum ada pengaturan tarif rute khusus.</p>
               </div>
            ) : (
               <div className="space-y-3">
                 {tariffs.map(t => (
                   <div key={t.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                         <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                            {t.origin?.location_name || t.origin?.name} <ChevronRight size={12} className="inline text-slate-300 mx-1" /> {t.destination?.location_name || t.destination?.name}
                         </p>
                         <div className="flex gap-4">
                            <span className="text-sm font-black text-slate-900">Dasar: {formatRupiah(t.base_price)}</span>
                            <span className="text-sm font-bold text-emerald-600">+ {formatRupiah(t.price_per_kg)}/Kg</span>
                            {t.price_per_m3 > 0 && <span className="text-sm font-bold text-purple-600">+ {formatRupiah(t.price_per_m3)}/m³</span>}
                         </div>
                      </div>
                      <button onClick={() => handleDelete(t.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-rose-500 hover:bg-rose-100 transition-colors">
                         <Trash2 size={16} />
                      </button>
                   </div>
                 ))}
               </div>
            )}
         </div>
      </div>
    </div>
  )
}
