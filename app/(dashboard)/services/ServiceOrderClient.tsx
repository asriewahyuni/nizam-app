'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Briefcase,
  X,
  MoreVertical,
  ClipboardList
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { createServiceOrder, updateServiceStatus } from '@/modules/services/actions/service.actions'

interface ServiceOrderClientProps {
  orgId: string
  orders: any[]
  contacts: any[]
}

const statusColors = {
  PENDING: 'bg-slate-50 text-slate-400 border-slate-100',
  IN_PROGRESS: 'bg-[#003366]/10 text-[#003366] border-[#003366]/20',
  ON_HOLD: 'bg-amber-50 text-amber-600 border-amber-100',
  COMPLETED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  CANCELLED: 'bg-rose-50 text-rose-600 border-rose-100'
}

export function ServiceOrderClient({ orgId, orders, contacts }: ServiceOrderClientProps) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCreateOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const res = await createServiceOrder(orgId, new FormData(e.currentTarget))
    if (res.error) alert(res.error)
    else {
      setShowModal(false)
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
             <Briefcase size={32} className="text-[#003366]" />
             Job Order & Jasa
          </h1>
          <p className="text-sm text-slate-500 font-medium">Pengelolaan Perintah Kerja untuk Industri Layanan & Jasa.</p>
        </div>

        <button type="button" onClick={() => setShowModal(true)} className="flex items-center gap-2 px-6 py-3 bg-[#003366] text-white text-sm font-bold rounded-xl hover:bg-[#002d5a] shadow-xl shadow-[#003366]/10 transition-all">
           <Plus size={18} /> Terbitkan Job Order
        </button>
      </div>

      {/* Main List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {orders.length === 0 ? (
           <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 font-bold italic">
             Belum ada antrian pekerjaan jasa.
           </div>
         ) : (
           orders.map(order => (
             <motion.div key={order.id} whileHover={{ y: -5 }} className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all rotate-12">
                   <ClipboardList size={100} strokeWidth={1} />
                </div>
                <div className="flex justify-between items-start mb-6">
                   <span className={`px-4 py-1.5 text-[10px] font-semibold rounded-full uppercase tracking-tighter border ${statusColors[order.status as keyof typeof statusColors]}`}>
                      {order.status}
                   </span>
                   <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{order.job_number}</p>
                </div>

                <div className="space-y-4">
                   <div>
                      <h3 className="text-xl font-semibold text-slate-900 group-hover:text-[#003366] transition-colors line-clamp-2">{order.description}</h3>
                      <div className="flex items-center gap-2 mt-2">
                         <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[8px] font-semibold text-slate-400 uppercase">
                            {order.contact?.name?.[0]}
                         </div>
                         <p className="text-xs font-bold text-slate-500">{order.contact?.name}</p>
                      </div>
                   </div>

                   <p className="text-xs text-slate-400 font-medium leading-relaxed">{order.notes || 'No extra instructions provided.'}</p>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
                   <div className="flex flex-col">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Est. Cost</p>
                      <p className="text-sm font-semibold text-slate-900">{formatRupiah(order.estimated_cost)}</p>
                   </div>
                   <div className="flex items-center gap-2">
                      {order.status === 'PENDING' && (
                        <button type="button" onClick={() => updateServiceStatus(orgId, order.id, 'IN_PROGRESS')} className="px-4 py-2 bg-[#003366] text-white text-[10px] font-semibold uppercase rounded-lg">Mulai</button>
                      )}
                      {order.status === 'IN_PROGRESS' && (
                        <button type="button" onClick={() => updateServiceStatus(orgId, order.id, 'COMPLETED')} className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-semibold uppercase rounded-lg">Selesai</button>
                      )}
                      <button type="button" className="p-2 bg-slate-50 text-slate-300 hover:text-slate-600 rounded-lg transition"><MoreVertical size={16} /></button>
                   </div>
                </div>
             </motion.div>
           ))
         )}
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-md p-8 overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-3">
                      <Plus size={20} className="text-[#003366]" /> Terbitkan SPK Jasa
                   </h3>
                   <button type="button" onClick={() => setShowModal(false)} className="text-slate-400"><X size={20} /></button>
                </div>
                <form onSubmit={handleCreateOrder} className="space-y-6">
                   <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">No. Job (Internal)</label>
                      <input name="job_number" required placeholder="JOB-XXXXX" defaultValue={`JOB-${Date.now().toString().slice(-6)}`} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-[#003366] font-bold" />
                   </div>
                   <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Pilih Pelanggan</label>
                      <select name="contact_id" required className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-[#003366] font-bold">
                         <option value="">-- Customer --</option>
                         {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Deskripsi Pekerjaan *</label>
                      <input name="description" required placeholder="Cth: Perbaikan AC Split 2 PK" className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-[#003366] font-bold" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-left">
                         <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Estimasi Biaya</label>
                         <input name="estimated_cost" type="number" placeholder="0" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-[#003366] font-bold" />
                      </div>
                      <div className="space-y-1.5 text-left">
                         <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Tgl Mulai</label>
                         <input name="start_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-[#003366] font-bold" />
                      </div>
                   </div>
                   <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Catatan Tambahan</label>
                      <textarea name="notes" placeholder="Tulis instruksi khusus..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-[#003366] text-sm h-24" />
                   </div>
                   <button type="submit" disabled={loading} className="w-full py-5 bg-[#003366] text-white font-semibold rounded-xl shadow-xl shadow-[#003366]/10 mt-4 overflow-hidden relative group">
                      <span className="relative z-10">{loading ? 'Processing...' : 'Terbitkan Sekarang'}</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:scale-110 transition-transform" />
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
