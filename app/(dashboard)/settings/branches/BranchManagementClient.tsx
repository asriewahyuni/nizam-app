'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  MapPin, 
  X,
  Search,
  MoreVertical,
  ChevronRight,
  Shield,
  Building2,
  Phone,
  ArrowRight
} from 'lucide-react'
import { createBranch } from '@/modules/organization/actions/org.actions'

interface BranchManagementClientProps {
  orgId: string
  branches: any[]
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const item = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1 }
}

export function BranchManagementClient({ orgId, branches }: BranchManagementClientProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleAddBranch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const res = await createBranch(orgId, new FormData(e.currentTarget))
    if ((res as any).error) alert((res as any).error)
    else {
      setShowModal(false)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-6xl mx-auto space-y-10">
      
      {/* Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <MapPin size={32} className="text-emerald-500" />
             Cabang & Unit Bisnis
          </h1>
          <p className="text-sm text-slate-500 font-medium max-w-xl">
            Kelola struktur multi-cabang untuk bisnis retail, armada bus, atau pabrik manufaktur Anda dalam satu ekosistem terpadu.
          </p>
        </div>

        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-2xl hover:bg-slate-800 shadow-xl transition-all"
        >
           <Plus size={18} /> Tambah Cabang / Unit
        </button>
      </motion.div>

      {/* Grid of Branches */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => (
          <motion.div 
            key={branch.id} 
            variants={item}
            className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 group transition-all"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                <Building2 size={28} />
              </div>
              <span className={`px-4 py-1.5 text-[10px] font-black rounded-full uppercase tracking-tighter border ${branch.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                {branch.is_active ? 'Aktif' : 'Non-Aktif'}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{branch.name}</h3>
                <p className="text-xs font-bold text-slate-400 tracking-[0.2em] mt-1 uppercase">{branch.code}</p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <MapPin size={12} className="text-slate-300" />
                  <span className="line-clamp-1">{branch.address || 'Alamat belum diset'}</span>
                </div>
                {branch.phone && (
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Phone size={12} className="text-slate-300" />
                    <span>{branch.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
              <button className="text-[11px] font-black text-slate-400 hover:text-emerald-600 transition-all uppercase tracking-widest flex items-center gap-2">
                Konfigurasi <ArrowRight size={14} />
              </button>
              <button className="p-2 text-slate-300 hover:text-slate-600 rounded-lg transition opacity-0 group-hover:opacity-100">
                <MoreVertical size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-10 overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                        <Plus size={24} />
                      </div>
                      Tambah Unit / Cabang
                   </h3>
                   <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
                    <X size={20} />
                   </button>
                </div>
                <form onSubmit={handleAddBranch} className="space-y-6">
                   <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Cabang / Unit Bisnis</label>
                      <input name="name" required placeholder="Cth: Cabang Jakarta - Slipi" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold transition-all shadow-inner" />
                   </div>
                   <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kode Unit (Shortcore)</label>
                      <input name="code" required placeholder="Cth: BR-JKT-01" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold uppercase transition-all shadow-inner" />
                   </div>
                   <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Lengkap</label>
                      <textarea name="address" placeholder="Tulis alamat operasional unit ini..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-500 text-sm h-28 transition-all shadow-inner" />
                   </div>
                   
                   <div className="pt-4">
                    <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white font-black rounded-[20px] shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group">
                        <span className="relative z-10">{loading ? 'Memproses...' : 'Daftarkan Cabang Sekarang'}</span>
                        <div className="absolute inset-0 bg-emerald-500 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300" />
                    </button>
                    <p className="text-[10px] text-center text-slate-400 mt-4 font-bold uppercase tracking-widest">Akses operasional akan langsung aktif setelah didaftarkan.</p>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
