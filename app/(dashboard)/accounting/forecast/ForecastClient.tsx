'use client'

import React, { useState } from 'react'
import {
  LineChart as LucideLineChart,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Activity,
  Zap,
  LayoutGrid
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts'
import { useRouter, useSearchParams } from 'next/navigation'
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer'

interface ForecastClientProps {
  forecast: any
  orgId: string
  activeBranchName?: string | null
}

export default function ForecastClient({ forecast, orgId, activeBranchName = null }: ForecastClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const days = parseInt(searchParams.get('days') || '30')
  const scopeLabel = activeBranchName || 'Semua Unit'

  const changeDays = (d: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('days', d.toString())
    router.push(`/accounting/forecast?${params.toString()}`)
  }

  const chartData = forecast.forecast.map((f: any) => ({
    name: formatDate(f.date),
    balance: f.balance,
    inflow: f.inflow,
    outflow: f.outflow
  }))

  const isCritical = forecast.lowestPoint < 0

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 text-slate-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-slate-900 tracking-tight flex items-center gap-4">
                <LucideLineChart size={40} className="text-indigo-500" />
                Proyeksi Kas
            </h1>
            <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-2xl">
                Estimasi ketersediaan dana berdasarkan jatuh tempo Piutang (AR) dan Hutang (AP) 
                selama {days} hari ke depan.
            </p>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${
              activeBranchName
                ? 'bg-blue-50 text-blue-700 border-blue-100'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <LayoutGrid size={12} />
              {scopeLabel}
            </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-xl w-fit">
            {[30, 60, 90].map((d) => (
                <button type="button" 
                  key={d}
                  onClick={() => changeDays(d)}
                  className={`px-6 py-3 rounded-xl text-[10px] font-semibold transition-all ${days === d ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-200/50' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {d} HARI
                </button>
            ))}
        </div>
      </div>

      {/* Hero Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center text-slate-400">
               <span className="text-[10px] font-semibold uppercase tracking-wide italic">Kas Saat Ini</span>
               <DollarSign size={20} />
            </div>
            <div className="space-y-1">
               <h3 className="text-3xl font-semibold text-slate-900 font-mono tracking-tighter">{formatRupiah(forecast.currentCash)}</h3>
               <p className="text-[10px] font-bold text-slate-400 italic">Saldo Riil di Bank & Kas</p>
            </div>
         </div>

         <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center text-emerald-500">
               <span className="text-[10px] font-semibold uppercase tracking-wide italic">Target Masuk (AR)</span>
               <ArrowUpRight size={20} />
            </div>
            <div className="space-y-1">
               <h3 className="text-3xl font-semibold text-emerald-600 font-mono tracking-tighter">+{formatRupiah(forecast.totalProjectedInflow)}</h3>
               <p className="text-[10px] font-bold text-slate-400 italic">Berdasarkan Jatuh Tempo Invoice</p>
            </div>
         </div>

         <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center text-rose-500">
               <span className="text-[10px] font-semibold uppercase tracking-wide italic">Target Keluar (AP)</span>
               <ArrowDownRight size={20} />
            </div>
            <div className="space-y-1">
               <h3 className="text-3xl font-semibold text-rose-600 font-mono tracking-tighter">-{formatRupiah(forecast.totalProjectedOutflow)}</h3>
               <p className="text-[10px] font-bold text-slate-400 italic">Berdasarkan Jatuh Tempo Tagihan</p>
            </div>
         </div>
      </div>

      {/* Main Trend Chart */}
      <div className="bg-slate-900 p-5 rounded-xl shadow-md shadow-indigo-200/20 relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-indigo-500/20 transition-all duration-1000" />
         
         <div className="relative z-10 space-y-10">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h4 className="text-white font-semibold text-xl tracking-tight flex items-center gap-3">
                        Trend Saldo Kumulatif 
                        {isCritical ? <span className="bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full text-[10px] font-semibold border border-rose-500/20 animate-pulse">BERESIKO</span> : <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-semibold border border-emerald-500/20 font-mono italic">HEALTHY</span>}
                    </h4>
                    <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wide">Prediksi Posisi Kas Akhir Periode</p>
                </div>
                <div className="text-right">
                    <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wide">Saldo Akhir {days} Hari</p>
                    <h3 className={`text-3xl font-semibold font-mono tracking-tighter ${forecast.forecast[forecast.forecast.length-1].balance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                        {formatRupiah(forecast.forecast[forecast.forecast.length-1].balance)}
                    </h3>
                </div>
            </div>

            <div className="h-[400px] w-full">
                <SafeResponsiveContainer>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                        <XAxis 
                            dataKey="name" 
                            stroke="#ffffff1a" 
                            tick={{fill: '#ffffff4d', fontSize: 10, fontWeight: 'bold'}} 
                            axisLine={false}
                            padding={{left: 20, right: 20}}
                        />
                        <YAxis 
                            stroke="#ffffff1a" 
                            tick={{fill: '#ffffff4d', fontSize: 10, fontWeight: 'bold'}} 
                            axisLine={false} 
                            tickFormatter={(val) => `Rp ${val/1000000}M`}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff1a', borderRadius: '16px', color: 'white', fontWeight: 'bold' }}
                            formatter={(value: any) => formatRupiah(Number(value || 0))}
                        />
                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
                        <Area 
                            type="monotone" 
                            dataKey="balance" 
                            stroke="#6366f1" 
                            strokeWidth={4}
                            fillOpacity={1} 
                            fill="url(#colorBalance)" 
                            animationDuration={2000}
                        />
                    </AreaChart>
                </SafeResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Grid of Daily Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-8">
             <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Detail Pergerakan Harian</h4>
                <LayoutGrid size={20} className="text-slate-300" />
             </div>
             
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-50">
                            <th className="px-6 py-4 text-[10px] font-semibold uppercase text-slate-400 tracking-wide">Tanggal</th>
                            <th className="px-6 py-4 text-[10px] font-semibold uppercase text-slate-400 tracking-wide">Inflow (AR)</th>
                            <th className="px-6 py-4 text-[10px] font-semibold uppercase text-slate-400 tracking-wide">Outflow (AP)</th>
                            <th className="px-6 py-4 text-[10px] font-semibold uppercase text-slate-400 tracking-wide text-right">Prediksi Saldo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {forecast.forecast.filter((f:any) => f.inflow > 0 || f.outflow > 0).slice(0, 10).map((day: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 text-xs font-bold text-slate-600">{formatDate(day.date)}</td>
                                <td className="px-6 py-4 font-mono text-xs font-semibold text-emerald-600">+{formatRupiah(day.inflow)}</td>
                                <td className="px-6 py-4 font-mono text-xs font-semibold text-rose-600">-{formatRupiah(day.outflow)}</td>
                                <td className="px-6 py-4 text-right font-semibold text-slate-900 text-xs">{formatRupiah(day.balance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
             <div className="bg-indigo-50 p-8 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden group">
                 <div className="relative z-10 space-y-6">
                    <Activity size={24} className="text-indigo-500" />
                    <h5 className="font-semibold text-xs uppercase tracking-wide text-indigo-700">Analisa Runway</h5>
                    <p className="text-sm font-medium text-indigo-800 leading-relaxed italic">
                        "Berdasarkan data hari ini, titik terendah likuiditas Anda akan terjadi pada angka 
                        <span className="font-semibold"> {formatRupiah(forecast.lowestPoint)} </span>."
                    </p>
                    <div className="pt-2">
                        <span className={`px-4 py-2 rounded-full text-[10px] font-semibold ${isCritical ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                           {isCritical ? 'Kritis: Segera Percepatan AR' : 'Aman: Kas Terjaga'}
                        </span>
                    </div>
                 </div>
             </div>

             <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm space-y-6">
                <Zap size={24} className="text-amber-500" />
                <h5 className="font-semibold text-xs uppercase tracking-wide text-slate-400 italic">Rekomendasi Cepat</h5>
                <ul className="space-y-4">
                   <li className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-semibold">1</div>
                      <p className="text-[11px] font-bold text-slate-600 italic">Follow-up invoice jatuh tempo di atas 100jt.</p>
                   </li>
                   <li className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-semibold">2</div>
                      <p className="text-[11px] font-bold text-slate-600 italic">Negosiasi termin pembayaran vendor bulan depan.</p>
                   </li>
                </ul>
             </div>
          </div>
      </div>

    </div>
  )
}
