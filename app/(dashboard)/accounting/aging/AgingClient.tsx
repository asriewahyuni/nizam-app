'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Building2, 
  UserCircle, 
  Calendar, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Clock,
  Briefcase,
  History,
  CreditCard,
  Wallet,
  ArrowUpRight,
  Filter,
  CheckCircle2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatRupiah, formatDate } from '@/lib/utils'

interface AgingClientProps {
  orgId: string
  initialData: any
  initialView?: 'AR' | 'AP'
}

export function AgingClient({ orgId, initialData, initialView = 'AR' }: AgingClientProps) {
  const router = useRouter()
  const [activeView, setActiveView] = useState<'AR' | 'AP'>(initialView)

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  }

  const highlightClass = (bucket: string) => {
    if (bucket === 'Current') return 'text-emerald-500 bg-emerald-50'
    if (bucket === '0-30 Days') return 'text-amber-500 bg-amber-50'
    return 'text-rose-500 bg-rose-50 animate-pulse'
  }

  const netPosition = initialData.totalAR - initialData.totalAP
  const arSalamReceivable = (initialData.ar || [])
    .filter((row: any) => row.source_account_code === '1404' || row.source_type === 'SALAM_VENDOR_RECEIVABLE')
    .reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0)
  const arIstishnaReceivable = (initialData.ar || [])
    .filter((row: any) => row.source_account_code === '1205' || row.source_type === 'ISTISHNA_VENDOR_RECEIVABLE')
    .reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0)

  const apSalamLiability = (initialData.ap || [])
    .filter((row: any) => row.source_account_code === '2602' || row.source_type === 'SALAM_SALES_LIABILITY')
    .reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0)
  const apIstishnaLiability = (initialData.ap || [])
    .filter((row: any) => row.source_account_code === '2603' || row.source_type === 'ISTISHNA_SALES_LIABILITY')
    .reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0)

  const openRowAction = (row: any) => {
    if (row.source_type === 'TAX') {
      router.push('/accounting/tax')
      return
    }

    if (row.source_type === 'JOURNAL') {
      if (!row.settlement_account_id) {
        router.push('/accounting/journal')
        return
      }
      const side = activeView === 'AR' ? 'IN' : 'OUT'
      const params = new URLSearchParams({
        pay: row.id,
        type: side,
        amount: String(Math.abs(row.outstanding)),
        desc: `Pelunasan ${row.doc_number}`,
        category_id: row.settlement_account_id,
        lock_category: '1',
      })
      router.push(`/cash?${params.toString()}`)
      return
    }

    if (row.doc_href) {
      router.push(row.doc_href)
      return
    }

    if (row.source_type === 'SALES') router.push(`/sales?pay=${row.id}`)
    else if (row.source_type === 'PURCHASING') router.push(`/purchasing?pay=${row.id}`)
    else router.push('/accounting/journal')
  }

  const actionLabel = (row: any) => {
    if (row.source_type === 'TAX') return 'Buka Pajak'
    if (row.source_type === 'JOURNAL') return activeView === 'AR' ? 'Terima Bayar' : 'Bayar Tagihan'
    return 'Buka Dokumen'
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
      
      {/* Header & Quick Summary */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-indigo-600 font-black tracking-widest text-[10px] uppercase bg-indigo-50 w-fit px-4 py-2 rounded-full border border-indigo-100 mb-2">
             <Clock size={14} />
             Liquidity Forensic
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight tracking-tighter">Account Aging Dashboard</h1>
          <p className="text-slate-500 font-medium">Monitoring perputaran kas dari sisi Piutang (AR) dan Hutang (AP).</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex items-center gap-8">
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Flow Position</span>
              <div className="flex items-center gap-2">
                 <h4 className={`text-2xl font-black ${netPosition >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                   {formatRupiah(netPosition)}
                 </h4>
                 {netPosition >= 0 ? <TrendingUp size={18} className="text-emerald-500" /> : <TrendingDown size={18} className="text-rose-500" />}
              </div>
           </div>
           <div className="w-px h-10 bg-slate-100" />
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Exposure Ratio</span>
              <span className="text-sm font-black text-slate-900">{(initialData.totalAR / (initialData.totalAP || 1)).toFixed(2)}x</span>
           </div>
        </div>
      </div>

      {/* Main Stats (AR vs AP) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
         {/* AR Card */}
         <div className={`p-10 rounded-[40px] border-2 transition-all shadow-sm bg-white ${activeView === 'AR' ? 'border-emerald-500 shadow-emerald-50' : 'border-slate-100'}`} onClick={() => setActiveView('AR')}>
            <div className="flex items-center justify-between mb-8 cursor-pointer">
               <h3 className="text-xl font-black text-slate-900 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeView === 'AR' ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                     <CreditCard size={24} />
                  </div>
                  Piutang Pelanggan (AR)
               </h3>
               {activeView === 'AR' && <CheckCircle2 size={24} className="text-emerald-500" />}
            </div>
            <div className="space-y-4">
               {initialData.arSummary.map((s: any) => (
                  <div key={s.bucket} className="flex items-center gap-4 group">
                     <div className="w-24 text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.bucket}</div>
                     <div className="flex-1 h-3 bg-slate-50 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full ${s.bucket === 'Current' ? 'bg-emerald-400' : s.bucket === '> 90 Days' ? 'bg-rose-500' : 'bg-amber-400'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${(s.amount / initialData.totalAR) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                     </div>
                     <div className="w-32 text-right text-xs font-black text-slate-900 group-hover:text-emerald-600 transition-colors uppercase">{formatRupiah(s.amount)}</div>
                  </div>
               ))}
               <div className="pt-6 mt-4 border-t border-slate-50 flex justify-between items-center font-black">
                  <span className="text-sm text-slate-400 uppercase tracking-widest">Total Outstanding AR</span>
                  <span className="text-2xl text-slate-900">{formatRupiah(initialData.totalAR)}</span>
               </div>
               <div className="pt-3 flex justify-between items-center">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Piutang Salam (1404)</span>
                  <span className="text-sm font-black text-indigo-600">{formatRupiah(arSalamReceivable)}</span>
               </div>
               <div className="pt-1 flex justify-between items-center opacity-80">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Piutang Istishna (1205)</span>
                  <span className="text-sm font-black text-indigo-500">{formatRupiah(arIstishnaReceivable)}</span>
               </div>
            </div>
         </div>

         {/* AP Card */}
         <div className={`p-10 rounded-[40px] border-2 transition-all shadow-sm bg-white ${activeView === 'AP' ? 'border-rose-500 shadow-rose-50' : 'border-slate-100'}`} onClick={() => setActiveView('AP')}>
            <div className="flex items-center justify-between mb-8 cursor-pointer">
               <h3 className="text-xl font-black text-slate-900 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeView === 'AP' ? 'bg-rose-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                     <Wallet size={24} />
                  </div>
                  Hutang Vendor (AP)
               </h3>
               {activeView === 'AP' && <CheckCircle2 size={24} className="text-rose-500" />}
            </div>
            <div className="space-y-4">
               {initialData.apSummary.map((s: any) => (
                  <div key={s.bucket} className="flex items-center gap-4 group">
                     <div className="w-24 text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.bucket}</div>
                     <div className="flex-1 h-3 bg-slate-50 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full ${s.bucket === 'Current' ? 'bg-indigo-400' : s.bucket === '> 90 Days' ? 'bg-rose-600' : 'bg-rose-400'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${(s.amount / initialData.totalAP) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                     </div>
                     <div className="w-32 text-right text-xs font-black text-slate-900 group-hover:text-rose-600 transition-colors uppercase">{formatRupiah(s.amount)}</div>
                  </div>
               ))}
               <div className="pt-6 mt-4 border-t border-slate-50 flex justify-between items-center font-black">
                  <span className="text-sm text-slate-400 uppercase tracking-widest">Total Outstanding AP</span>
                  <span className="text-2xl text-slate-900">{formatRupiah(initialData.totalAP)}</span>
               </div>
               <div className="pt-3 flex justify-between items-center">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Hutang Salam (2602)</span>
                  <span className="text-sm font-black text-indigo-600">{formatRupiah(apSalamLiability)}</span>
               </div>
               <div className="pt-1 flex justify-between items-center opacity-80">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Hutang Istishna (2603)</span>
                  <span className="text-sm font-black text-indigo-500">{formatRupiah(apIstishnaLiability)}</span>
               </div>
            </div>
         </div>
      </div>

      {/* Detailed List */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
         <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-xl flex items-center gap-3">
               <Filter size={18} className="text-indigo-500" />
               Rincian {activeView === 'AR' ? 'Piutang' : 'Hutang'} Terbuka
            </h3>
            <div className="flex gap-4">
               <div className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                  <ArrowUpRight size={14} /> Total Items: {activeView === 'AR' ? initialData.ar.length : initialData.ap.length}
               </div>
            </div>
         </div>
         <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left">
               <thead className="bg-slate-50/50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-100">
                  <tr>
                     <th className="px-10 py-5">{activeView === 'AR' ? 'Pelanggan' : 'Vendor'}</th>
                     <th className="px-6 py-5">No. Dokumen</th>
                     <th className="px-6 py-5">Sumber AR/AP</th>
                     <th className="px-6 py-5 text-right">Terhutang</th>
                     <th className="px-6 py-5 text-right">Sudah Bayar</th>
                     <th className="px-6 py-5 text-right">Retur</th>
                     <th className="px-6 py-5 text-right">Sisa (Outstanding)</th>
                     <th className="px-6 py-5 text-center">Status Aging</th>
                     <th className="px-10 py-5 text-right">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 font-medium">
                  {(activeView === 'AR' ? initialData.ar : initialData.ap).map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                       <td className="px-10 py-6 font-black text-slate-900 text-xs">
                          {row.contact_name}
                       </td>
                       <td className="px-6 py-6 font-bold text-indigo-600 text-xs uppercase">
                          {row.doc_href ? (
                            <Link href={row.doc_href} className="hover:underline underline-offset-2">
                              {row.doc_number}
                            </Link>
                          ) : (
                            row.doc_number
                          )}
                          <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase italic">Due {formatDate(row.due_date)}</p>
                       </td>
                       <td className="px-6 py-6">
                          <p className="text-[11px] font-black text-slate-700 uppercase">{row.source_label || row.source_type}</p>
                          {row.source_account_code && (
                            <span className="inline-flex mt-1 px-2 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-500">
                              CoA {row.source_account_code}
                            </span>
                          )}
                       </td>
                       <td className="px-6 py-6 text-right font-bold text-slate-600 text-xs">{formatRupiah(row.grand_total)}</td>
                       <td className="px-6 py-6 text-right font-bold text-emerald-500 text-xs">{formatRupiah(row.paid_amount)}</td>
                       <td className="px-6 py-6 text-right font-bold text-rose-400 text-xs">{formatRupiah(row.returned_amount || 0)}</td>
                       <td className="px-6 py-6 text-right font-black text-slate-900 text-lg tracking-tighter">{formatRupiah(row.outstanding)}</td>
                        <td className="px-6 py-6 text-center">
                           <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase shadow-sm ${highlightClass(row.aging_bucket)}`}>
                              {row.aging_bucket}
                           </span>
                        </td>
                        <td className="px-10 py-6 text-right">
                           <button 
                             onClick={() => openRowAction(row)}
                             className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${
                               activeView === 'AR' 
                               ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100' 
                               : row.source_type === 'TAX' ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-100'
                               : row.source_type === 'JOURNAL' ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                               : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                             }`}
                           >
                              {actionLabel(row)}
                              <ArrowRight size={14} />
                           </button>
                        </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

    </div>
  )
}
