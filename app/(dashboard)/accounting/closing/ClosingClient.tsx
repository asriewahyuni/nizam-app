'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Lock, 
  Unlock, 
  Plus, 
  AlertTriangle, 
  Calendar, 
  ShieldAlert, 
  Info,
  CheckCircle,
  XCircle,
  GanttChartSquare,
  History
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import { createFiscalPeriod, closeFiscalPeriod, openFiscalPeriod } from '@/modules/accounting/actions/closing.actions'

interface ClosingClientProps {
  periods: any[]
  orgId: string
}

export default function ClosingClient({ periods, orgId }: ClosingClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { confirm, ConfirmUI } = useConfirm()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handleCreate = async () => {
    if (!name || !startDate || !endDate) return alert('Mohon lengkapi semua data periode.')
    setIsSubmitting(true)
    const result = await createFiscalPeriod(orgId, { name, start_date: startDate, end_date: endDate })
    setIsSubmitting(false)
    if (result.success) {
        setIsModalOpen(false)
        setName(''); setStartDate(''); setEndDate('')
    } else {
        alert(result.error)
    }
  }

  const handleToggleClose = async (period: any) => {
    const action = period.is_closed ? 'BUKA KEMBALI' : 'TUTUP BUKU'
    if (!await confirm(`Apakah Anda yakin ingin melakukan ${action} periode ${period.name}?`)) return
    
    setIsSubmitting(true)
    if (period.is_closed) {
        await openFiscalPeriod(period.id, orgId)
    } else {
        await closeFiscalPeriod(period.id, orgId)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 text-slate-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
            <h1 className="text-4xl font-semibold text-slate-900 tracking-tight flex items-center gap-4">
                <ShieldAlert size={40} className="text-orange-500" />
                Penutupan Buku
            </h1>
            <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-2xl">
                Kunci transaksi pada periode tertentu untuk menjamin integritas data laporan keuangan 
                dan mencegah adanya perubahan yang tidak diinginkan.
            </p>
        </div>
        <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-xl font-semibold shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
            <Plus size={20} /> BUKA PERIODE BARU
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         {/* Warning Box */}
         <div className="lg:col-span-1 space-y-6">
             <div className="bg-orange-50 p-8 rounded-xl border border-orange-100 space-y-6 shadow-sm">
                <div className="flex items-center gap-3 text-orange-600">
                    <AlertTriangle size={24} />
                    <h5 className="font-semibold text-xs uppercase tracking-wide">Informasi Sistem</h5>
                </div>
                <p className="text-sm font-bold text-orange-800 leading-relaxed italic">
                    "Saat periode berstatus TERKUNCI (Closed), seluruh transaksi baru, perubahan, atau penghapusan 
                    jurnal pada tanggal tersebut akan diblokir oleh sistem secara otomatis."
                </p>
                <div className="bg-white/50 p-4 rounded-xl text-[10px] font-bold text-orange-700 border border-orange-200 list-none space-y-2 italic opacity-80">
                   <li>• Tidak boleh ada jurnal draft menggantung.</li>
                   <li>• Lakukan rekonsiliasi kas & bank.</li>
                   <li>• Verifikasi saldo piutang & hutang.</li>
                </div>
             </div>
             
             <div className="bg-white p-8 rounded-xl border border-slate-100 space-y-4">
                <History size={20} className="text-slate-400" />
                <h5 className="font-semibold text-[10px] text-slate-400 uppercase tracking-wide">Log Aktivitas</h5>
                <p className="text-xs text-slate-400 font-medium italic">Belum ada penutupan buku historis di sistem ini.</p>
             </div>
         </div>

         {/* Period List */}
         <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               {periods.map((pe) => (
                  <motion.div 
                    layout
                    key={pe.id} 
                    className={`p-8 rounded-xl border-2 transition-all relative overflow-hidden group ${pe.is_closed ? 'bg-slate-50 border-slate-100' : 'bg-white border-blue-100 shadow-xl shadow-blue-200/50'}`}
                  >
                     <div className="absolute top-0 right-0 p-8">
                        {pe.is_closed ? <Lock size={20} className="text-slate-300" /> : <Unlock size={20} className="text-blue-500" />}
                     </div>

                     <div className="space-y-6">
                        <div className="flex items-center gap-3">
                           <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${pe.is_closed ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-500'}`}>
                             <Calendar size={24} />
                           </div>
                           <div className="space-y-1">
                              <h4 className="font-semibold text-xl text-slate-900 tracking-tight">{pe.name}</h4>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                 {formatDate(pe.start_date)} — {formatDate(pe.end_date)}
                              </p>
                           </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${pe.is_closed ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {pe.is_closed ? 'Status: TERKUNCI' : 'Status: DIBUKA'}
                            </span>
                            
                            <button 
                                onClick={() => handleToggleClose(pe)}
                                className={`px-6 py-3 rounded-xl text-[10px] font-semibold tracking-wide transition-all ${pe.is_closed ? 'bg-white border border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white' : 'bg-slate-900 text-white shadow-lg shadow-slate-200 hover:shadow-xl'}`}
                            >
                                {pe.is_closed ? 'BUKA KEMBALI' : 'TUTUP PERIODE'}
                            </button>
                        </div>

                        {pe.is_closed && pe.closed_at && (
                            <p className="text-[9px] font-bold text-slate-400 mt-4 italic text-center">
                                Terakhir dikunci: {new Date(pe.closed_at).toLocaleString('id-ID')}
                            </p>
                        )}
                     </div>
                  </motion.div>
               ))}
               
               {periods.length === 0 && (
                  <div className="col-span-full py-20 text-center space-y-4 opacity-30">
                     <GanttChartSquare size={64} className="mx-auto" />
                     <p className="text-2xl font-semibold italic tracking-tighter italic">Belum ada periode akuntansi dibuat.</p>
                  </div>
               )}
            </div>
         </div>
      </div>

      {/* Creation Modal */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }}
                    className="relative bg-white w-full max-w-lg rounded-xl shadow-md overflow-hidden text-slate-900"
                >
                    <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                        <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-3">
                            <Plus size={24} className="text-slate-900" /> Buka Periode Akuntansi
                        </h3>
                    </div>
                    <div className="p-5 space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-4">Nama Periode</label>
                            <input 
                                placeholder="Misal: Maret 2024" 
                                value={name} onChange={(e) => setName(e.target.value)}
                                className="w-full h-16 px-6 bg-slate-50 border-2 border-transparent focus:border-slate-200 outline-none rounded-xl font-bold transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-4">Tanggal Mulai</label>
                                <input 
                                    type="date" 
                                    value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full h-16 px-6 bg-slate-50 border-2 border-transparent focus:border-slate-200 outline-none rounded-xl font-bold uppercase font-mono text-xs"
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-4">Tanggal Selesai</label>
                                <input 
                                    type="date" 
                                    value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full h-16 px-6 bg-slate-50 border-2 border-transparent focus:border-slate-200 outline-none rounded-xl font-bold uppercase font-mono text-xs"
                                />
                            </div>
                        </div>

                        <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-100 flex items-start gap-4">
                           <Info size={20} className="text-amber-500 flex-shrink-0 mt-1" />
                           <p className="text-[11px] font-bold text-amber-800 italic leading-relaxed">
                              Saran: Periode akuntansi sebaiknya dibuat bulanan (contoh: 01 Maret s/d 31 Maret) 
                              agar laporan keuangan bulanan terpisah dengan rapi.
                           </p>
                        </div>

                        <div className="flex flex-col gap-3 pt-4">
                            <button 
                                disabled={isSubmitting}
                                onClick={handleCreate}
                                className="w-full py-5 bg-slate-900 disabled:bg-slate-300 text-white rounded-xl font-semibold shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                {isSubmitting ? 'MEMPROSES...' : 'AKTIFKAN PERIODE'}
                            </button>
                            <button onClick={() => setIsModalOpen(false)} className="w-full py-5 bg-white border border-slate-200 text-slate-400 rounded-xl font-semibold text-xs hover:text-slate-600 transition-all">
                                BATALKAN
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
      {ConfirmUI}
    </div>
  )
}
