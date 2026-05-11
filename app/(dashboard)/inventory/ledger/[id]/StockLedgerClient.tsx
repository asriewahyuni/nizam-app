'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  History, 
  ArrowUpRight, 
  ArrowDownRight, 
  Package, 
  Calendar,
  Layers,
  FileText,
  Info
} from 'lucide-react'
import Link from 'next/link'
import { formatRupiah, formatDate } from '@/lib/utils'

interface StockLedgerClientProps {
  productId: string
  data: {
    product: any
    movements: any[]
  }
}

export default function StockLedgerClient({ productId, data }: StockLedgerClientProps) {
  const { product, movements } = data

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  }

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  }

  // Calculate Running Balance
  let currentBalance = 0
  const ledgerData = (movements || []).map(m => {
    currentBalance += Number(m.quantity)
    return {
      ...m,
      running_balance: currentBalance
    }
  }).reverse() // Show newest first? Or oldest first? Usually oldest first for running balance, but newest first for list.

  const totalIn = movements.filter(m => m.quantity > 0).reduce((s, m) => s + Number(m.quantity), 0)
  const totalOut = movements.filter(m => m.quantity < 0).reduce((s, m) => s + Math.abs(Number(m.quantity)), 0)

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <Link 
          href="/inventory" 
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-tight hover:text-slate-900 transition-colors w-fit group"
        >
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-all">
            <ArrowLeft size={16} />
          </div>
          Kembali ke Inventori
        </Link>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                <History size={24} />
              </div>
              Kartu Stok: {product?.name || 'Produk Tidak Ditemukan'}
            </h1>
            <p className="text-sm text-slate-500 font-medium font-mono uppercase tracking-tight">
              SKU: {product?.sku || '---'} • Satuan: {product?.unit || 'Unit'}
            </p>
          </div>
          <div className="flex gap-4">
             <div className="bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                   <ArrowDownRight size={20} />
                </div>
                <div>
                   <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight leading-none mb-1">Total Masuk</p>
                   <p className="text-xl font-semibold text-slate-900 leading-none">{totalIn} {product?.unit}</p>
                </div>
             </div>
             <div className="bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                   <ArrowUpRight size={20} />
                </div>
                <div>
                   <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight leading-none mb-1">Total Keluar</p>
                   <p className="text-xl font-semibold text-slate-900 leading-none">{totalOut} {product?.unit}</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-slate-900 text-white rounded-2xl p-8 relative overflow-hidden shadow-2xl shadow-indigo-500/10 md:col-span-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-10 -mt-10" />
            <div className="relative z-10">
               <p className="text-[10px] font-semibold uppercase text-blue-400 tracking-tight mb-2">Stok Akhir</p>
               <h4 className="text-5xl font-black tracking-tighter">{currentBalance}</h4>
               <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-tight">{product?.unit || 'Unit'}</p>
            </div>
         </div>
         <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm md:col-span-3 flex items-center justify-around">
            <div className="text-center space-y-2">
               <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Transaksi Terakhir</p>
               <div className="flex items-center gap-2 text-slate-900 font-black justify-center">
                  <Calendar size={14} className="text-indigo-500" />
                  {movements.length > 0 ? formatDate(movements[movements.length-1].created_at) : '---'}
               </div>
            </div>
            <div className="w-px h-12 bg-slate-100" />
            <div className="text-center space-y-2">
               <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Aset Persediaan</p>
               <div className="flex items-center gap-2 text-slate-900 font-black justify-center">
                  <Layers size={14} className="text-emerald-500" />
                  {formatRupiah(movements.reduce((s, m) => s + (m.quantity * m.unit_price), 0))}
               </div>
            </div>
            <div className="w-px h-12 bg-slate-100" />
            <div className="text-center space-y-2">
               <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Total Pergerakan</p>
               <div className="flex items-center gap-2 text-slate-900 font-black justify-center">
                  <FileText size={14} className="text-blue-500" />
                  {movements.length} Log
               </div>
            </div>
         </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
         <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-lg flex items-center gap-3">
               <History size={18} className="text-indigo-500" />
               Riwayat Pergerakan Barang
            </h3>
            <div className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400">
               Audit Ready • Real-time
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50/50 text-[10px] uppercase font-semibold tracking-tight text-slate-400 border-b border-slate-100">
                  <tr>
                     <th className="px-10 py-5">Tanggal & Waktu</th>
                     <th className="px-6 py-5">Tipe & Ref</th>
                     <th className="px-6 py-5 text-right">Masuk</th>
                     <th className="px-6 py-5 text-right">Keluar</th>
                     <th className="px-6 py-5 text-right bg-blue-50/30 text-blue-600">Saldo</th>
                     <th className="px-6 py-5 text-right">HPP / Unit</th>
                     <th className="px-10 py-5">Keterangan</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 font-medium">
                  {ledgerData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-10 py-20 text-center">
                         <div className="flex flex-col items-center gap-3 opacity-20">
                            <Package size={48} />
                            <p className="text-sm font-semibold tracking-tight">Belum ada pergerakan stok.</p>
                         </div>
                      </td>
                    </tr>
                  ) : (
                    ledgerData.map((m: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-10 py-6 text-xs font-bold text-slate-500 whitespace-nowrap">
                           {formatDate(m.created_at)}
                           <span className="block text-[10px] font-medium opacity-60 mt-1">{new Date(m.created_at).toLocaleTimeString()}</span>
                        </td>
                        <td className="px-6 py-6">
                           <div className={`px-3 py-1 rounded-full text-[10px] font-semibold tracking-tight w-fit mb-1.5 border
                             ${m.reference_type === 'PURCHASE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                               m.reference_type === 'SALES' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                               'bg-slate-50 text-slate-500 border-slate-200'}`}>
                             {m.reference_type}
                           </div>
                           <p className="text-xs font-black text-slate-900 font-mono tracking-tighter">REF-{m.reference_id?.substring(0,8)}</p>
                        </td>
                        <td className="px-6 py-6 text-right">
                           {m.quantity > 0 && (
                             <div className="flex items-center justify-end gap-1.5 text-emerald-600 font-black">
                                +{m.quantity}
                                <ArrowDownRight size={14} />
                             </div>
                           )}
                        </td>
                        <td className="px-6 py-6 text-right">
                           {m.quantity < 0 && (
                             <div className="flex items-center justify-end gap-1.5 text-rose-600 font-black">
                                {m.quantity}
                                <ArrowUpRight size={14} />
                             </div>
                           )}
                        </td>
                        <td className="px-6 py-6 text-right font-black text-blue-600 bg-blue-50/10 text-lg tracking-tighter">
                           {m.running_balance}
                        </td>
                        <td className="px-6 py-6 text-right font-bold text-slate-900 text-xs">
                           {formatRupiah(m.unit_price)}
                        </td>
                        <td className="px-10 py-6 text-xs text-slate-500 italic max-w-xs truncate" title={m.notes}>
                           {m.notes || '-'}
                        </td>
                      </tr>
                    ))
                  )}
               </tbody>
            </table>
         </div>
      </div>
      
      {/* Footer Info */}
      <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100 flex items-start gap-4">
         <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
         <div className="space-y-1">
            <h4 className="text-xs font-black text-blue-900 uppercase">Audit Compliance</h4>
            <p className="text-xs text-blue-700 leading-relaxed font-medium">
              Kartu Stok ini disusun secara otomatis berdasarkan tabel `stock_movements` yang terintegrasi dengan modul Penjualan, Pembelian, dan Inventori (Write-off). 
              Setiap perubahan saldo stok wajib didahului oleh mutasi di buku pembantu ini untuk menjaga integritas laporan Neraca perusahaan.
            </p>
         </div>
      </div>
    </div>
  )
}
