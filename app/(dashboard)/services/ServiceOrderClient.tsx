'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Search,
  User,
  MoreVertical,
  ChevronRight,
  ClipboardList,
  Wrench,
  Stethoscope
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import { createServiceOrder, updateServiceStatus } from '@/modules/services/actions/service.actions'
import { PageHeader, StatCard, StatusBadge, SafeButton, SectionCard, FormField, FormInput, FormSelect, FormTextarea } from '@/components/ui/NizamUI'

interface ServiceOrderClientProps {
  orgId: string
  orders: any[]
  contacts: any[]
}

const statusLabel: Record<string, string> = {
  PENDING: 'Antri',
  IN_PROGRESS: 'Dikerjakan',
  ON_HOLD: 'Ditahan',
  COMPLETED: 'Selesai',
  CANCELLED: 'Batal',
}

const statusVariant: Record<string, string> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'info',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
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
      <PageHeader
        title="Job Order & Jasa"
        subtitle="Pengelolaan Perintah Kerja untuk Industri Layanan & Jasa."
        icon={<Briefcase size={32} />}
        iconColor="text-blue-600"
        actions={
          <SafeButton onClick={() => setShowModal(true)}>
            <Plus size={18} /> Terbitkan Job Order
          </SafeButton>
        }
      />

      {/* Main List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {orders.length === 0 ? (
           <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold italic">
             Belum ada antrian pekerjaan jasa.
           </div>
         ) : (
           orders.map(order => (
             <motion.div key={order.id} whileHover={{ y: -5 }} className="bg-white rounded-xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all rotate-12">
                   <ClipboardList size={100} strokeWidth={1} />
                </div>
                <div className="flex justify-between items-start mb-6">
                   <StatusBadge label={statusLabel[order.status as keyof typeof statusLabel] || order.status} variant={(statusVariant[order.status as keyof typeof statusVariant] as any) || 'neutral'} />
                   <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{order.job_number}</p>
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
                      <p className="text-[10px] font-bold text-slate-400 tracking-tight">Est. Cost</p>
                      <p className="text-sm font-semibold text-slate-900">{formatRupiah(order.estimated_cost)}</p>
                   </div>
                   <div className="flex items-center gap-2">
                      {order.status === 'PENDING' && (
                        <SafeButton onClick={() => updateServiceStatus(orgId, order.id, 'IN_PROGRESS')} variant="primary" size="sm">Mulai</SafeButton>
                      )}
                      {order.status === 'IN_PROGRESS' && (
                        <SafeButton onClick={() => updateServiceStatus(orgId, order.id, 'COMPLETED')} variant="success" size="sm">Selesai</SafeButton>
                      )}
                      <button className="p-2 bg-slate-50 text-slate-300 hover:text-slate-600 rounded-lg transition"><MoreVertical size={16} /></button>
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
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-8 overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-3">
                      <Plus size={20} className="text-[#003366]" /> Terbitkan SPK Jasa
                   </h3>
                   <button onClick={() => setShowModal(false)} className="text-slate-400"><X size={20} /></button>
                </div>
                <form onSubmit={handleCreateOrder} className="space-y-6">
                   <FormField label="No. Job (Internal)">
                     <FormInput name="job_number" required placeholder="JOB-XXXXX" defaultValue={`JOB-${Date.now().toString().slice(-6)}`} />
                   </FormField>
                   <FormField label="Pilih Pelanggan" required>
                     <FormSelect name="contact_id" required>
                       <option value="">-- Customer --</option>
                       {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </FormSelect>
                   </FormField>
                   <FormField label="Deskripsi Pekerjaan" required>
                     <FormInput name="description" required placeholder="Cth: Perbaikan AC Split 2 PK" />
                   </FormField>
                   <div className="grid grid-cols-2 gap-4">
                     <FormField label="Estimasi Biaya">
                       <FormInput name="estimated_cost" type="number" placeholder="0" />
                     </FormField>
                     <FormField label="Tgl Mulai" required>
                       <FormInput name="start_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                     </FormField>
                   </div>
                   <FormField label="Catatan Tambahan">
                     <FormTextarea name="notes" placeholder="Tulis instruksi khusus..." />
                   </FormField>
                   <SafeButton type="submit" disabled={loading} className="w-full justify-center">
                     {loading ? 'Memproses...' : 'Terbitkan Sekarang'}
                   </SafeButton>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
