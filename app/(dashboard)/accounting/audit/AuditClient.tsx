'use client'

import React, { useState } from 'react'
import { 
  ShieldAlert, 
  Scale, 
  PackageSearch, 
  History, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  RefreshCcw,
  Landmark,
  Calculator,
  Search,
  ArrowUpRight
} from 'lucide-react'
import Link from 'next/link'
import { getAuditOverview, forceReconcileAudit } from '@/modules/accounting/actions/audit.actions'
import { formatDate } from '@/lib/utils'

interface AuditClientProps {
  orgId: string
  initialData: any
}

export function AuditClient({ orgId, initialData }: AuditClientProps) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [reconciling, setReconciling] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const newData = await getAuditOverview(orgId)
      setData(newData)
    } finally {
      setLoading(false)
    }
  }

  const runReconcile = async (type: 'JOURNAL' | 'INVENTORY' | 'ASSETS') => {
    setReconciling(type)
    const res = await forceReconcileAudit(orgId, type)
    if (res.success) {
      await handleRefresh()
      alert(res.message)
    }
    setReconciling(null)
  }

  const stats = data.stats || { unbalancedCount: 0, inventoryVariance: 0, overdueAssetCount: 0 }

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
             <ShieldAlert size={28} className="text-indigo-600" />
             Audit Integritas
          </h1>
          <p className="text-sm text-slate-500 font-medium">Mendeteksi anomali jurnal, selisih stok, dan kelalaian depresiasi aset.</p>
        </div>
        
        <button type="button" 
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-3 px-8 py-5 bg-white border-2 border-slate-100 hover:border-indigo-200 hover:bg-slate-50 text-slate-900 font-semibold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCcw size={24} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Menganalisis...' : 'Re-Analyze Metadata'}
        </button>
      </div>

      {/* Audit Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         {/* Unbalanced Journals */}
         <div className={`p-8 rounded-xl border-2 transition-all shadow-sm flex flex-col justify-between h-full bg-white ${stats.unbalancedCount > 0 ? 'border-rose-100 shadow-rose-50' : 'border-emerald-100 shadow-emerald-50'}`}>
            <div className="space-y-4">
               <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${stats.unbalancedCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Scale size={32} />
               </div>
               <div>
                  <h3 className="text-lg font-semibold text-slate-900">Jurnal Unbalanced</h3>
                  <p className="text-sm font-bold text-slate-400">Ketidakseimbangan Debit vs Kredit Buku Besar.</p>
               </div>
            </div>
            <div className="mt-8 flex items-end justify-between">
               <span className={`text-5xl font-semibold ${stats.unbalancedCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {stats.unbalancedCount}
               </span>
               {stats.unbalancedCount > 0 ? (
                 <div className="flex items-center gap-2 text-rose-500 font-semibold text-xs uppercase animate-pulse">
                    <AlertCircle size={16} /> Needs Action
                 </div>
               ) : (
                 <div className="flex items-center gap-2 text-emerald-500 font-semibold text-xs uppercase">
                    <CheckCircle2 size={16} /> 100% Balanced
                 </div>
               )}
            </div>
         </div>

         {/* Inventory Variance */}
         <div className={`p-8 rounded-xl border-2 transition-all shadow-sm flex flex-col justify-between h-full bg-white ${Math.abs(stats.inventoryVariance) > 10 ? 'border-amber-100 shadow-amber-50' : 'border-emerald-100 shadow-emerald-50'}`}>
            <div className="space-y-4">
               <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${Math.abs(stats.inventoryVariance) > 10 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <PackageSearch size={32} />
               </div>
               <div>
                  <h3 className="text-lg font-semibold text-slate-900">Selisih Persediaan</h3>
                  <p className="text-sm font-bold text-slate-400">Total Variance Fiskal vs Ledger Persediaan (1301-1399).</p>
               </div>
            </div>
            <div className="mt-8 flex items-end justify-between">
               <span className={`text-2xl font-semibold ${Math.abs(stats.inventoryVariance) > 10 ? 'text-amber-600 font-mono' : 'text-emerald-600 font-mono'}`}>
                  {Math.abs(stats.inventoryVariance) <= 10 ? formatCurrency(0) : formatCurrency(stats.inventoryVariance)}
               </span>
               <div className="flex items-center gap-2 text-slate-500 font-semibold text-xs uppercase">
                  {Math.abs(stats.inventoryVariance) > 10 ? 'Adjustment Required' : 'Sync Perfect'}
               </div>
            </div>
         </div>

         {/* Late Depreciation */}
         <div className={`p-8 rounded-xl border-2 transition-all shadow-sm flex flex-col justify-between h-full bg-white ${stats.overdueAssetCount > 0 ? 'border-indigo-100 shadow-indigo-50' : 'border-emerald-100 shadow-emerald-50'}`}>
            <div className="space-y-4">
               <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${stats.overdueAssetCount > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Calculator size={32} />
               </div>
               <div>
                  <h3 className="text-lg font-semibold text-slate-900">Depresiasi Tertunda</h3>
                  <p className="text-sm font-bold text-slate-400">Aset Berjalan yang belum disusutkan bulan ini.</p>
               </div>
            </div>
            <div className="mt-8 flex items-end justify-between">
               <span className={`text-5xl font-semibold ${stats.overdueAssetCount > 0 ? 'text-indigo-600' : 'text-emerald-600'}`}>
                  {stats.overdueAssetCount}
               </span>
               {stats.overdueAssetCount > 0 && (
                  <button type="button" 
                    onClick={() => runReconcile('ASSETS')}
                    disabled={reconciling === 'ASSETS'}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[10px] font-semibold uppercase rounded-xl hover:bg-indigo-700 transition-all active:scale-95"
                  >
                     <Zap size={14} className={reconciling === 'ASSETS' ? 'animate-spin' : ''} /> Auto Susutkan
                  </button>
               )}
            </div>
         </div>
      </div>

      {/* Detailed Forensic Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         
         {/* 1. Unbalanced Journals Table */}
         <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
               <h3 className="font-semibold text-slate-900 text-xl flex items-center gap-3">
                  <Scale className="text-rose-500" />
                  Jurnal Bermasalah
                  {data.unbalanced.length > 0 && <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-[10px] font-semibold">{data.unbalanced.length}</span>}
               </h3>
            </div>
            <div className="flex-1 overflow-x-auto min-h-[300px]">
               {data.unbalanced.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-20 opacity-30">
                     <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                     <p className="font-bold text-slate-600 uppercase tracking-wide text-xs">Semua Jurnal Balance!</p>
                  </div>
               ) : (
                  <table className="w-full text-left">
                     <thead className="bg-slate-50/50 text-xs uppercase font-bold tracking-wider text-slate-500 border-b border-slate-100">
                        <tr>
                           <th className="px-8 py-5">Tanggal & Info</th>
                           <th className="px-6 py-5 text-right">Debit</th>
                           <th className="px-6 py-5 text-right">Kredit</th>
                           <th className="px-8 py-5 text-right text-rose-600">Selisih</th>
                           <th className="px-4 py-5"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 font-medium">
                        {data.unbalanced.map((j: any) => (
                           <tr key={j.entry_id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-8 py-5">
                                 <p className="font-semibold text-slate-900 text-xs truncate max-w-[200px]">{j.description}</p>
                                 <p className="text-[10px] text-slate-400 font-bold">{formatDate(j.entry_date)} • {j.reference_type}</p>
                              </td>
                              <td className="px-6 py-5 text-right font-bold text-slate-700 text-xs">{formatCurrency(j.total_debit)}</td>
                              <td className="px-6 py-5 text-right font-bold text-slate-700 text-xs">{formatCurrency(j.total_credit)}</td>
                               <td className="px-8 py-5 text-right font-semibold text-rose-600 text-xs">{formatCurrency(j.diff)}</td>
                               <td className="px-4 py-5 text-right">
                                  <Link
                                    href={`/accounting/journal?entry=${j.entry_id}`}
                                    className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors inline-block"
                                    title="Edit Jurnal"
                                  >
                                     <ArrowUpRight size={16} />
                                  </Link>
                               </td>
                            </tr>
                        ))}
                     </tbody>
                  </table>
               )}
            </div>
         </div>

         {/* 2. Overdue Assets Table */}
         <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
               <h3 className="font-semibold text-slate-900 text-xl flex items-center gap-3">
                  <Landmark className="text-indigo-500" />
                  Aset Tertunda Depresiasi
                  {data.overdueAssets.length > 0 && <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-semibold">{data.overdueAssets.length}</span>}
               </h3>
            </div>
            <div className="flex-1 overflow-x-auto min-h-[300px]">
               {data.overdueAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-20 opacity-30">
                     <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                     <p className="font-bold text-slate-600 uppercase tracking-wide text-xs">Penyusutan Up to Date!</p>
                  </div>
               ) : (
                  <table className="w-full text-left">
                     <thead className="bg-slate-50/50 text-xs uppercase font-bold tracking-wider text-slate-500 border-b border-slate-100">
                        <tr>
                           <th className="px-8 py-5">Nama Aset</th>
                           <th className="px-6 py-5">Penyusutan Terakhir</th>
                           <th className="px-8 py-5 text-right">Nilai Buku Saat Ini</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 font-medium">
                        {data.overdueAssets.map((a: any) => (
                           <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-8 py-5">
                                 <p className="font-semibold text-slate-900 text-xs truncate max-w-[200px]">{a.name}</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase">{a.code}</p>
                              </td>
                              <td className="px-6 py-5 font-bold text-rose-500 text-xs uppercase italic">
                                 {a.last_depreciation_date ? formatDate(a.last_depreciation_date) : 'Belum Pernah'}
                              </td>
                              <td className="px-8 py-5 text-right font-semibold text-slate-900 text-xs">{formatCurrency(a.current_book_value)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               )}
            </div>
         </div>

      </div>

      {/* 3. Inventory Discrepancy (Full Width) */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
         <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-xl flex items-center gap-3">
               <PackageSearch className="text-amber-500" />
               Analisis Selisih Inventaris vs Buku Besar
               <span className="text-xs font-bold text-slate-400 italic font-mono">(Accounts 1301-1399 vs Physical On-Hand)</span>
            </h3>
            <button type="button"
              onClick={() => runReconcile('INVENTORY')}
              disabled={reconciling === 'INVENTORY'}
              className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-amber-100 text-amber-600 text-[10px] font-semibold uppercase rounded-xl hover:bg-amber-50 transition-all active:scale-95 disabled:opacity-50"
            >
               <History size={16} className={reconciling === 'INVENTORY' ? 'animate-spin' : ''} /> Sync Audit
            </button>
         </div>
         <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left">
               <thead className="bg-slate-50/50 text-xs uppercase font-bold tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                     <th className="px-8 py-5">Produk</th>
                     <th className="px-6 py-5 text-right">Stok Fisik</th>
                     <th className="px-6 py-5 text-right">Avg Cost</th>
                     <th className="px-6 py-5 text-right">Nilai On-Hand</th>
                     <th className="px-6 py-5 text-right italic opacity-60">Alokasi Ledger (GL)</th>
                     <th className="px-8 py-5 text-right">Variance</th>
                     <th className="px-4 py-5"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 font-medium">
                  {data.inventory.length === 0 ? (
                    <tr>
                       <td colSpan={7} className="px-8 py-20 text-center opacity-30 font-semibold text-xs uppercase">Tidak ada data persediaan untuk diaudit.</td>
                    </tr>
                  ) : (
                    data.inventory.map((i: any) => (
                      <tr key={i.product_id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-8 py-6">
                            <p className="font-bold text-slate-900 text-sm">{i.product_name}</p>
                         </td>
                         <td className="px-6 py-6 text-right font-semibold text-slate-700 text-xs">{i.stock_qty}</td>
                         <td className="px-6 py-6 text-right font-bold text-slate-400 text-xs">{formatCurrency(i.avg_cost)}</td>
                         <td className="px-6 py-6 text-right font-semibold text-indigo-600 text-xs">{formatCurrency(i.on_hand_value)}</td>
                         <td className="px-6 py-6 text-right font-bold text-slate-400 text-xs italic opacity-60">{formatCurrency(i.ledger_value)}</td>
                          <td className={`px-8 py-6 text-right font-semibold text-xs ${Math.abs(i.variance) > 10 ? 'text-amber-500' : 'text-emerald-500'}`}>
                             {Math.abs(i.variance) <= 10 ? formatCurrency(0) : `${i.variance > 0 ? '+' : ''}${formatCurrency(i.variance)}`}
                          </td>
                          <td className="px-4 py-6 text-right">
                             {Math.abs(i.variance) > 10 && (
                                <Link
                                  href={`/inventory?adjust=${i.product_id}`}
                                  className="p-2 hover:bg-amber-50 text-amber-500 rounded-lg transition-colors inline-block"
                                  title="Sesuaikan Stok"
                                >
                                   <Zap size={16} />
                                </Link>
                             )}
                          </td>
                       </tr>
                    ))
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* Footer / Meta Audit */}
      <div className="flex items-center justify-center gap-6 opacity-30 grayscale hover:grayscale-0 transition-all duration-1000">
         <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-slate-400">
            <ShieldAlert size={14} /> Powered by Nizam Forensic Intelligence Engine v1.0
         </div>
         <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
         <div className="text-[10px] font-bold text-slate-400">Scan Time: {mounted ? new Date().toLocaleTimeString() : '--:--'}</div>
      </div>

    </div>
  )
}
