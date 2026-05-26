'use client'

import React from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Line, 
  ComposedChart,
  Cell
} from 'recharts'
import { 
  Trophy, 
  Target, 
  BarChart3, 
  ArrowUpRight, 
  Package, 
  ChevronRight,
  TrendingUp,
  Lightbulb,
  AlertTriangle
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer'

interface ParetoClientProps {
  orgId: string
  data: any
}

export function ParetoClient({ orgId, data }: ParetoClientProps) {
  const { topProducts, paretoAnalysis } = data

  // Prepare full data for Pareto Curve (need all products, not just top 10)
  // Re-calculating cumulative % for the chart
  let runningPercent = 0
  const chartData = (topProducts || []).map((p: any, idx: number) => {
    const contribution = (p.revenue / paretoAnalysis.totalRevenue) * 100
    runningPercent += contribution
    return {
      name: p.name,
      revenue: p.revenue,
      cumulative: Math.min(100, runningPercent)
    }
  })

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-amber-600 font-semibold tracking-wide text-xs uppercase bg-amber-50 w-fit px-4 py-2 rounded-full border border-amber-100 mb-2">
             <Target size={14} strokeWidth={3} />
             Analisis Pareto (80/20)
          </div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">Optimasi Laba Produk</h1>
          <p className="text-slate-500 font-medium text-lg max-w-2xl">
            Identifikasi 20% produk yang menghasilkan 80% pendapatan Anda untuk fokus stok dan pemasaran.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
               <Package size={24} />
            </div>
            <div>
               <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Kontribusi Produk</p>
               <h3 className="text-4xl font-semibold text-slate-900 mt-1">{paretoAnalysis.top20Count} <span className="text-lg text-slate-400">Items</span></h3>
               <p className="text-xs font-bold text-slate-500 mt-2">Menghasilkan 80% dari total omzet.</p>
            </div>
         </div>

         <div className="bg-slate-900 p-8 rounded-xl shadow-md space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <Trophy size={100} />
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 text-amber-400 flex items-center justify-center">
               <Trophy size={24} />
            </div>
            <div className="relative z-10">
               <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide">Revenue Terkonsentrasi</p>
               <h3 className="text-3xl font-semibold text-white mt-1">{formatRupiah(paretoAnalysis.top20Revenue)}</h3>
               <p className="text-xs font-bold text-slate-400 mt-2">Nilai ekonomi tinggi dari grup Pareto.</p>
            </div>
         </div>

         <div className="bg-emerald-500 p-8 rounded-xl shadow-sm space-y-4 text-white">
            <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center">
               <TrendingUp size={24} />
            </div>
            <div>
               <p className="text-xs font-semibold opacity-60 uppercase tracking-wide">Total Sales Analyzed</p>
               <h3 className="text-3xl font-semibold mt-1">{formatRupiah(paretoAnalysis.totalRevenue)}</h3>
               <p className="text-xs font-bold opacity-80 mt-2">Data penjualan 3 bulan terakhir.</p>
            </div>
         </div>
      </div>

      {/* Pareto Curve Chart */}
      <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm space-y-8">
         <div className="flex justify-between items-center">
            <h3 className="font-semibold text-xl text-slate-900 flex items-center gap-3">
               <BarChart3 className="text-blue-600" />
               Pareto Distribution Curve
            </h3>
            <div className="flex gap-4">
               <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-semibold uppercase text-blue-600">Revenue</span>
               </div>
               <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-semibold uppercase text-amber-600">Cumulative %</span>
               </div>
            </div>
         </div>

         <div className="h-[400px]">
            <SafeResponsiveContainer>
               <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                    interval={0}
                    height={60}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis yAxisId="left" hide />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                    formatter={(value: any, name: any) => [name === 'cumulative' ? `${(value as number).toFixed(1)}%` : formatRupiah(value as number), name === 'cumulative' ? 'Cumulative' : 'Revenue'] as any}
                  />
                  <Bar yAxisId="left" dataKey="revenue" radius={[12, 12, 0, 0]}>
                     {chartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index < paretoAnalysis.top20Count ? '#3b82f6' : '#e2e8f0'} />
                     ))}
                  </Bar>
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="cumulative" 
                    stroke="#f59e0b" 
                    strokeWidth={4} 
                    dot={{fill: '#f59e0b', r: 4}} 
                  />
               </ComposedChart>
            </SafeResponsiveContainer>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         {/* Strategic Recommendation */}
         <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
               <h3 className="font-semibold text-slate-900 text-xl flex items-center gap-3">
                  <Lightbulb className="text-amber-500" />
                  Rekomendasi Strategis
               </h3>
            </div>
            <div className="p-5 space-y-8">
               <div className="flex gap-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                     <TrendingUp size={20} />
                  </div>
                  <div>
                     <h4 className="font-semibold text-slate-900 text-sm mb-1 uppercase tracking-tight">Prioritaskan Stok Utama</h4>
                     <p className="text-slate-500 text-xs leading-relaxed font-medium">Jangan biarkan produk kelompok Pareto (biru di grafik) out-of-stock. Satu hari kosong pada stok ini berdampak 10x lipat dibanding barang kategori non-Pareto.</p>
                  </div>
               </div>

               <div className="flex gap-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                     <Target size={20} />
                  </div>
                  <div>
                     <h4 className="font-semibold text-slate-900 text-sm mb-1 uppercase tracking-tight">Efisiensi Marketing</h4>
                     <p className="text-slate-500 text-xs leading-relaxed font-medium">Fokuskan biaya iklan dan diskon loyalitas pada {paretoAnalysis.top20Count} produk ini untuk memaksimalkan ROI (Return on Investment).</p>
                  </div>
               </div>

               <div className="flex gap-5">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                     <AlertTriangle size={20} />
                  </div>
                  <div>
                     <h4 className="font-semibold text-slate-900 text-sm mb-1 uppercase tracking-tight">Audit Barang Mati</h4>
                     <p className="text-slate-500 text-xs leading-relaxed font-medium">Evaluasi barang di luar kategori Pareto yang memiliki perputaran stok sangat lambat untuk di-liquid atau cuci gudang guna membebaskan modal kerja.</p>
                  </div>
               </div>
            </div>
         </div>

         {/* Detailed Data List */}
         <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
               <h3 className="font-semibold text-slate-900 text-xl">Daftar Kontribusi Produk</h3>
            </div>
            <div className="flex-1 overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase font-semibold tracking-wide text-slate-400 border-b border-slate-100">
                     <tr>
                        <th className="px-8 py-5">Produk</th>
                        <th className="px-6 py-5 text-right">Qty</th>
                        <th className="px-6 py-5 text-right">Revenue</th>
                        <th className="px-8 py-5 text-right">Kontribusi</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {topProducts.map((p: any, i: number) => {
                        const percent = (p.revenue / paretoAnalysis.totalRevenue) * 100
                        const isPareto = i < paretoAnalysis.top20Count
                        return (
                           <tr key={i} className={`hover:bg-slate-50/50 transition-colors ${isPareto ? 'bg-blue-50/20' : ''}`}>
                              <td className="px-8 py-5">
                                 <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-semibold ${isPareto ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                       {i+1}
                                    </div>
                                    <span className="font-semibold text-slate-900 text-xs truncate max-w-[150px]">{p.name}</span>
                                    {isPareto && <span className="text-[10px] font-semibold text-blue-600 uppercase bg-blue-100 px-2 py-0.5 rounded-full">80% VIP</span>}
                                 </div>
                              </td>
                              <td className="px-6 py-5 text-right font-bold text-slate-500 text-xs">{p.qty}</td>
                              <td className="px-6 py-5 text-right font-semibold text-slate-900 text-xs">{formatRupiah(p.revenue)}</td>
                              <td className="px-8 py-5 text-right font-semibold text-slate-500 text-xs">{percent.toFixed(1)}%</td>
                           </tr>
                        )
                     })}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  )
}
