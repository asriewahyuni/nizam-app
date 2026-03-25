'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  CircleDollarSign, 
  Users, 
  Settings, 
  BookOpen,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Package,
  ShoppingCart,
  Zap
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'

interface BSCClientProps {
  orgId: string
  initialData: {
    financial: {
      currentRevenue: number
      currentExpenses: number
      netProfit: number
      profitMargin: number
      revenueGrowth: number
      lastRevenue: number
    }
    customer: {
      mtdSales: number
      totalOrders: number
      uniqueCustomers: number
    }
    internal: {
      pendingPurchases: number
      pendingSales: number
      totalAssets: number
      overdueDepreciation: number
      processHealth: number
    }
    learning: {
      activeEmployees: number
      payrollRunsCompleted: number
      hrCompletionRate: number
    }
  }
}

export function BSCClient({ orgId, initialData }: BSCClientProps) {
  const { financial, customer, internal, learning } = initialData

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
  const item = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }

  const financialStatus = financial.netProfit > 0 ? 'PROFITABLE' : 'ATTENTION'
  const internalStatus = internal.processHealth >= 80 ? 'OPTIMIZED' : 'BOTTLENECK'
  const customerStatus = customer.mtdSales > 0 ? 'GROWING' : 'NO DATA'
  const learningStatus = learning.activeEmployees > 0 ? 'ACTIVE' : 'SETUP NEEDED'

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-1000">
      
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-blue-600 font-black tracking-widest text-xs uppercase bg-blue-50 w-fit px-4 py-2 rounded-full border border-blue-100 mb-2">
           <BarChart3 size={14} />
           Performance Navigation · Live Data
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Balanced Scorecard (BSC)</h1>
        <p className="text-slate-500 font-medium text-lg italic opacity-80">4 Perspektif strategis — semua dari data operasional real-time.</p>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* PERSPEKTIF 1: FINANCIAL */}
        <motion.div variants={item} className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-emerald-100 transition-colors" />
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center">
                 <CircleDollarSign size={24} />
              </div>
              Financial
            </h2>
            <span className={`text-[10px] font-black tracking-widest px-3 py-1 rounded-full border ${financial.netProfit > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
              {financialStatus}
            </span>
          </div>

          <div className="space-y-5 relative z-10">
            {[
              { label: 'Pendapatan MTD', value: formatRupiah(financial.currentRevenue), sub: `vs bulan lalu: ${formatRupiah(financial.lastRevenue)}` },
              { label: 'Beban MTD', value: formatRupiah(financial.currentExpenses), sub: 'Total biaya operasional' },
              { label: 'Laba Bersih MTD', value: formatRupiah(financial.netProfit), highlight: true, positive: financial.netProfit >= 0 },
              { label: 'Profit Margin', value: `${financial.profitMargin}%`, sub: `Revenue Growth: ${financial.revenueGrowth > 0 ? '+' : ''}${financial.revenueGrowth}%` },
            ].map(row => (
              <div key={row.label} className={`flex justify-between items-center p-4 rounded-2xl ${row.highlight ? (row.positive ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100') : 'bg-slate-50'}`}>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.label}</p>
                  {row.sub && <p className="text-[10px] text-slate-300 font-medium mt-0.5">{row.sub}</p>}
                </div>
                <span className={`text-lg font-black ${row.highlight ? (row.positive ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-900'}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* PERSPEKTIF 2: CUSTOMER */}
        <motion.div variants={item} className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-blue-100 transition-colors" />
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                 <TrendingUp size={24} />
              </div>
              Customer & Sales
            </h2>
            <span className={`text-[10px] font-black tracking-widest px-3 py-1 rounded-full border ${customer.mtdSales > 0 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
              {customerStatus}
            </span>
          </div>

          <div className="space-y-4 relative z-10">
            <div className="p-8 bg-slate-900 rounded-[32px] text-white">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Penjualan MTD</p>
              <h4 className="text-3xl font-black">{formatRupiah(customer.mtdSales)}</h4>
              {customer.mtdSales === 0 && <p className="text-[10px] text-slate-500 mt-2 italic">Belum ada transaksi penjualan bulan ini</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-slate-50 rounded-[28px] border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart size={14} className="text-blue-400" />
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Total Orders</p>
                </div>
                <span className="text-2xl font-black text-slate-800">{customer.totalOrders}</span>
              </div>
              <div className="p-6 bg-slate-50 rounded-[28px] border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-blue-400" />
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Pelanggan Aktif</p>
                </div>
                <span className="text-2xl font-black text-slate-800">{customer.uniqueCustomers}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* PERSPEKTIF 3: INTERNAL PROCESS */}
        <motion.div variants={item} className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-blue-100 transition-colors" />
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                 <Settings size={24} />
              </div>
              Internal Process
            </h2>
            <span className={`text-[10px] font-black tracking-widest px-3 py-1 rounded-full border ${internal.processHealth >= 80 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
              {internalStatus}
            </span>
          </div>

          <div className="space-y-4 relative z-10">
            {/* Process Health Bar */}
            <div className="p-6 bg-slate-50 rounded-[28px] border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Process Health Score</p>
                <span className="text-xl font-black text-slate-900">{internal.processHealth}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${internal.processHealth >= 80 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${internal.processHealth}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={`p-5 rounded-[24px] border ${internal.pendingPurchases > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {internal.pendingPurchases > 0 ? <AlertTriangle size={12} className="text-amber-500" /> : <CheckCircle2 size={12} className="text-emerald-500" />}
                  <p className="text-[9px] font-black uppercase text-slate-400">Draft PO</p>
                </div>
                <span className={`text-xl font-black ${internal.pendingPurchases > 0 ? 'text-amber-600' : 'text-slate-600'}`}>{internal.pendingPurchases}</span>
              </div>
              <div className={`p-5 rounded-[24px] border ${internal.pendingSales > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {internal.pendingSales > 0 ? <AlertTriangle size={12} className="text-amber-500" /> : <CheckCircle2 size={12} className="text-emerald-500" />}
                  <p className="text-[9px] font-black uppercase text-slate-400">Draft SO</p>
                </div>
                <span className={`text-xl font-black ${internal.pendingSales > 0 ? 'text-amber-600' : 'text-slate-600'}`}>{internal.pendingSales}</span>
              </div>
              <div className={`p-5 rounded-[24px] border ${internal.overdueDepreciation > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {internal.overdueDepreciation > 0 ? <AlertTriangle size={12} className="text-rose-500" /> : <CheckCircle2 size={12} className="text-emerald-500" />}
                  <p className="text-[9px] font-black uppercase text-slate-400">Depresiasi Tertunda</p>
                </div>
                <span className={`text-xl font-black ${internal.overdueDepreciation > 0 ? 'text-rose-600' : 'text-slate-600'}`}>{internal.overdueDepreciation}</span>
              </div>
              <div className="p-5 rounded-[24px] border bg-slate-50 border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <Package size={12} className="text-slate-400" />
                  <p className="text-[9px] font-black uppercase text-slate-400">Total Aset Aktif</p>
                </div>
                <span className="text-xl font-black text-slate-600">{internal.totalAssets}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* PERSPEKTIF 4: LEARNING & GROWTH */}
        <motion.div variants={item} className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm relative overflow-hidden group hover:border-rose-200 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-rose-100 transition-colors" />
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center">
                 <BookOpen size={24} />
              </div>
              Learning & Growth
            </h2>
            <span className={`text-[10px] font-black tracking-widest px-3 py-1 rounded-full border ${learning.activeEmployees > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
              {learningStatus}
            </span>
          </div>

          <div className="space-y-4 relative z-10">
            <div className="p-8 bg-rose-50 border-2 border-rose-100 rounded-[32px] flex flex-col items-center justify-center text-center space-y-3">
              <p className="text-[10px] font-black uppercase text-rose-400 tracking-widest">Karyawan Aktif</p>
              <div className="text-6xl font-black text-rose-600">{learning.activeEmployees}</div>
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Orang dalam sistem</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-slate-50 rounded-[28px] border border-slate-100 space-y-1">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-rose-400" />
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Payroll Runs Selesai</p>
                </div>
                <span className="text-2xl font-black text-slate-800">{learning.payrollRunsCompleted}</span>
              </div>
              <div className="p-6 bg-slate-50 rounded-[28px] border border-slate-100 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-rose-400" />
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">HR Completion Rate</p>
                </div>
                <span className="text-2xl font-black text-slate-800">{learning.hrCompletionRate}%</span>
              </div>
            </div>
          </div>
        </motion.div>

      </motion.div>

      {/* Strategic Insight Box */}
      <div className="bg-slate-900 rounded-[50px] p-12 text-white overflow-hidden relative shadow-2xl shadow-indigo-500/10">
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] -mr-40 -mt-40" />
         <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="col-span-1 space-y-4">
               <h3 className="text-2xl font-black tracking-tight leading-tight">Strategic Radar</h3>
               <p className="text-sm text-slate-400 font-medium">Insight dari 4 perspektif BSC — berbasis data real-time Nizam ERP.</p>
            </div>
            <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8">
               <div className="flex gap-4">
                  <div className={`shrink-0 w-2 h-2 rounded-full mt-2 shadow-lg ${financial.netProfit > 0 ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-rose-500 shadow-rose-500/50'}`} />
                  <div className="space-y-1">
                     <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Financial</p>
                     <p className="text-sm text-slate-200 font-medium">
                       {financial.netProfit > 0 
                         ? `Margin ${financial.profitMargin}% — bisnis profitable bulan ini.`
                         : `Margin negatif. Beban (${formatRupiah(financial.currentExpenses)}) melebihi pendapatan.`}
                     </p>
                  </div>
               </div>
               <div className="flex gap-4">
                  <div className={`shrink-0 w-2 h-2 rounded-full mt-2 shadow-lg ${internal.pendingPurchases + internal.pendingSales === 0 ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-amber-500 shadow-amber-500/50'}`} />
                  <div className="space-y-1">
                     <p className="text-xs font-black uppercase tracking-widest text-amber-400">Internal Process</p>
                     <p className="text-sm text-slate-200 font-medium tracking-tight">
                       {internal.pendingPurchases + internal.pendingSales > 0
                         ? `${internal.pendingPurchases + internal.pendingSales} dokumen masih draft. Review dan approve segera.`
                         : 'Semua dokumen sudah diproses. Proses internal bersih.'}
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
