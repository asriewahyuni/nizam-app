'use client'

import { motion } from 'framer-motion'
import {
   Search,
   ChevronRight,
   Clock,
   CheckCircle2,
   Wallet,
   ArrowUpRight,
   ArrowDownRight,
   TrendingUp,
   TrendingDown,
   BarChart3,
   PieChart,
   Package,
   Star,
   Target,
   Trophy,
   GraduationCap
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts'
import { formatRupiah } from '@/lib/utils'
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer'

interface DashboardClientProps {
   data: {
      orgName: string
      metrics: Array<{
         label: string
         value: string
         icon: string
         hint: string
         href?: string
         trend?: number
         danger?: boolean
      }>
      analytics: Array<{
         name: string
         revenue: number
         expense: number
         profit: number
      }>
      topExpenses: Array<{
         name: string
         value: number
      }>
      topProducts: Array<{
         name: string
         revenue: number
         qty: number
         profit: number // Added profit to topProducts
      }>
      paretoAnalysis: {
         totalProducts: number
         top20Count: number
         top20Revenue: number
         totalRevenue: number
         totalProfit: number // Added totalProfit to paretoAnalysis
         paretoProducts: Array<{
            name: string
            revenue: number
            profit: number // Added profit to paretoProducts
         }>
      }
      customerPareto?: {
         totalCustomers: number
         top20Count: number
         top20Revenue: number
         top20Profit: number // Added top20Profit to customerPareto
         totalRevenue: number
         totalProfit: number // Added totalProfit to customerPareto
         paretoCustomers: Array<{
            id: string // Added id to paretoCustomers
            name: string
            revenue: number
            profit: number // Added profit to paretoCustomers
         }>
      }
   }
}

const ICON_MAP: Record<string, any> = {
   wallet: Wallet,
   receivables: ArrowDownRight,
   payables: ArrowUpRight,
   profit: TrendingUp,
   loss: TrendingDown,
}

const container = {
   hidden: { opacity: 0 },
   show: {
      opacity: 1,
      transition: {
         staggerChildren: 0.1
      }
   }
}

const item = {
   hidden: { opacity: 0, y: 20 },
   show: { opacity: 1, y: 0 }
}

export function DashboardClient({ data }: DashboardClientProps) {
   const router = useRouter()
   // Safety fallback for new fields
   const topProducts = data.topProducts || []
   const pareto = data.paretoAnalysis || { totalRevenue: 0, totalProfit: 0, top20Count: 0, top20Revenue: 0, paretoProducts: [] }
   const paretoCust = data.customerPareto || { totalCustomers: 0, top20Count: 0, top20Revenue: 0, top20Profit: 0, totalRevenue: 0, totalProfit: 0, paretoCustomers: [] }

   return (
      <motion.div
         variants={container}
         initial={false}
         animate="show"
         className="space-y-12 pb-20"
      >
         {/* Header Section */}
         <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-slate-100">
            <div className="space-y-1">
               <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-100 text-white">
                     <BarChart3 size={28} />
                  </div>
                  Overview
               </h1>
               <div className="flex items-center gap-3 pl-1">
                  <p className="text-sm text-slate-400 font-medium tracking-tight">Real-time business intelligence for <span className="text-slate-900 font-bold">{data.orgName}</span></p>
                  <div className="h-1 w-1 bg-slate-300 rounded-full" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 italic">
                     <Star size={10} className="fill-amber-500" /> Pareto Mode
                  </p>
               </div>
            </div>

            <div className="flex items-center gap-3">
               <button className="bg-white border border-slate-200 p-3 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                  <Search size={20} />
               </button>
            </div>
         </motion.div>

         {/* Grid: Metric Cards - Now with more impact */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {data.metrics.map((m) => {
               const Icon = ICON_MAP[m.icon] || Wallet
               const isDanger = m.danger

               const href = m.href || '#'

               return (
                  <motion.div
                     key={m.label}
                     variants={item}
                     whileHover={{ y: -6 }}
                     whileTap={{ scale: 0.96 }}
                     onClick={() => router.push(href)}
                     className={`relative bg-white flex flex-col justify-between rounded-[32px] p-6 border shadow-[0_10px_30px_-5px_rgba(0,0,0,0.03)] h-full transition-all duration-300 overflow-hidden cursor-pointer group pointer-events-auto z-20
                ${isDanger ? 'border-rose-100 bg-rose-50/20' : 'border-slate-100 hover:border-blue-500 hover:shadow-blue-100'}`}
                  >
                     <div className="flex items-start justify-between gap-4 mb-8 pointer-events-none">
                        <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                  ${isDanger
                              ? 'bg-rose-100 text-rose-600 shadow-sm border border-rose-200'
                              : 'bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm border border-slate-100'}`}
                        >
                           <Icon size={22} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col items-end flex-1 min-w-0">
                           <span className={`text-[10px] font-black leading-tight uppercase tracking-[0.1em] text-right break-words ${isDanger ? 'text-rose-400' : 'text-slate-400'} group-hover:text-blue-500 transition-colors`}>
                              {m.label}
                           </span>
                           <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-all text-blue-500 mt-1" />
                        </div>
                     </div>
                     <div className="space-y-1.5 mt-auto pointer-events-none">
                        <h3
                           className={`font-black font-mono tracking-tighter leading-none break-words
                             text-xl sm:text-2xl 
                             ${isDanger ? 'text-rose-700' : 'text-slate-900 group-hover:text-blue-700'}`}
                           title={String(m.value)}
                        >
                           {m.value}
                        </h3>
                        <p className={`text-[10px] font-bold leading-relaxed italic opacity-70 ${isDanger ? 'text-rose-500' : 'text-slate-400'}`}>{m.hint}</p>
                     </div>
                  </motion.div>
               )
            })}
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Revenue Trend Chart - Clean & Pro */}
            <motion.div variants={item} className="lg:col-span-2 space-y-5">
               <div className="flex items-center justify-between px-2">
                  <div>
                     <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Financial Performance</h2>
                     <p className="text-[10px] font-bold text-slate-400 italic">Moving average revenue vs net profit</p>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-50 p-2 px-4 rounded-xl border border-slate-100">
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">Revenue</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-200" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">Profit</span>
                     </div>
                  </div>
               </div>
               <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.04)] h-[380px] group transition-all">
                  <SafeResponsiveContainer>
                     <AreaChart data={data.analytics} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                           <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                           </linearGradient>
                           <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                           dataKey="name"
                           axisLine={false}
                           tickLine={false}
                           tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                           dy={15}
                        />
                        <YAxis hide={true} />
                        <Tooltip
                           cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }}
                           contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '20px' }}
                           itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                           labelStyle={{ fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px' }}
                           formatter={(value: any) => [formatRupiah(Number(value || 0)), '']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                        <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={4} strokeDasharray="8 8" fill="url(#colorProfit)" />
                     </AreaChart>
                  </SafeResponsiveContainer>
               </div>
            </motion.div>

            {/* Pareto High Impact Card - Dark Mode Aesthetic */}
            <motion.div variants={item} className="lg:col-span-1 space-y-5">
               <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest px-2">Market Impact</h2>
               <Link href="/reports/pareto" className="block h-full group relative z-10">
                  <div className="bg-slate-900 rounded-[48px] p-10 text-white relative overflow-hidden shadow-[0_30px_60px_-15px_rgba(15,23,42,0.3)] h-full min-h-[380px] hover:ring-2 hover:ring-emerald-500/50 transition-all group-hover:shadow-emerald-900/40">
                     <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none">
                        <Trophy size={180} strokeWidth={1} />
                     </div>
                     <div className="relative z-10 flex flex-col justify-between h-full pointer-events-none">
                        <div className="space-y-6 pointer-events-auto">
                           <div>
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-500/20 mb-4">
                                 <Target size={12} /> Pareto Focus
                              </div>
                              <p className="text-2xl font-black leading-tight italic tracking-tighter">
                                 {pareto.top20Count} Produk penguasa pendapatan.
                              </p>
                              <p className="text-[11px] font-medium text-slate-400 mt-2 leading-relaxed">
                                 Strategi 80/20 otomatis mendeteksi item pelarisan untuk optimasi stok.
                              </p>
                           </div>
                           <div className="space-y-4">
                              {pareto.paretoProducts.slice(0, 3).map((p, i) => (
                                 <div key={p.name} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-default">
                                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[11px] font-black font-mono">#{i + 1}</div>
                                    <div className="flex-1 overflow-hidden">
                                       <span className="text-xs font-bold text-slate-50 truncate block">{p.name}</span>
                                       <div className="flex items-center gap-2">
                                          <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">{formatRupiah(p.revenue)}</span>
                                          <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none">/ {formatRupiah(p.profit || 0)} PROFIT</span>
                                       </div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div className="pt-8 mt-auto border-t border-white/10 pointer-events-auto">
                           <div className="flex justify-between items-center">
                              <div className="flex gap-6">
                                 <div>
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Total Revenue</p>
                                    <p className="text-sm font-black text-white font-mono tracking-tighter">{formatRupiah(pareto.totalRevenue)}</p>
                                 </div>
                                 <div>
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Total Profit</p>
                                    <p className="text-sm font-black text-blue-400 font-mono tracking-tighter">{formatRupiah(pareto.totalProfit)}</p>
                                 </div>
                              </div>
                              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:scale-110 transition-all shadow-xl">
                                 <ChevronRight size={24} />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </Link>
            </motion.div>

            {/* Customer Pareto High Impact Card */}
            <motion.div variants={item} className="lg:col-span-1 space-y-5">
               <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest px-2">Top Customers (80/20)</h2>
               <Link href="/contacts" className="block h-full group relative z-10">
                  <div className="bg-indigo-900 rounded-[48px] p-10 text-white relative overflow-hidden shadow-[0_30px_60px_-15px_rgba(49,46,129,0.3)] h-full min-h-[380px] hover:ring-2 hover:ring-indigo-400/50 transition-all group-hover:shadow-indigo-900/50">
                     <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none">
                        <Star size={180} strokeWidth={1} />
                     </div>
                     <div className="relative z-10 flex flex-col justify-between h-full pointer-events-none">
                        <div className="space-y-6 pointer-events-auto">
                           <div>
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-500/20 mb-4">
                                 <Target size={12} /> VIP Whales
                              </div>
                              <p className="text-2xl font-black leading-tight italic tracking-tighter">
                                 {paretoCust.top20Count} Klien sumbang 80% omset.
                              </p>
                              <p className="text-[11px] font-medium text-indigo-200 mt-2 leading-relaxed">
                                 Prioritaskan layanan ekstra untuk daftar pelanggan emas ini.
                              </p>
                           </div>
                           <div className="space-y-4">
                              {paretoCust.paretoCustomers.slice(0, 3).map((c, i) => (
                                 <div key={c.name} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-default relative overflow-hidden">
                                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[11px] font-black font-mono relative z-10">#{i + 1}</div>
                                    <div className="flex-1 overflow-hidden relative z-10">
                                       <span className="text-xs font-bold text-slate-50 truncate block">{c.name}</span>
                                       <div className="flex items-center gap-2">
                                          <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">{formatRupiah(c.revenue)}</span>
                                          <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none">/ {formatRupiah(c.profit || 0)} PROFIT</span>
                                       </div>
                                    </div>
                                    {i === 0 && <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-amber-400/20 to-transparent flex items-center justify-end pr-2"><Trophy size={14} className="text-amber-400" /></div>}
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div className="pt-8 mt-auto border-t border-white/10 pointer-events-auto">
                           <div className="flex justify-between items-center">
                              <div className="flex gap-6">
                                 <div>
                                    <p className="text-[8px] font-bold text-indigo-300 uppercase tracking-[0.2em] mb-1">VIP Revenue</p>
                                    <p className="text-sm font-black text-white font-mono tracking-tighter">{formatRupiah(paretoCust.top20Revenue)}</p>
                                 </div>
                                 <div>
                                    <p className="text-[8px] font-bold text-indigo-300 uppercase tracking-[0.2em] mb-1">VIP Profit</p>
                                    <p className="text-sm font-black text-blue-400 font-mono tracking-tighter">{formatRupiah(paretoCust.top20Profit)}</p>
                                 </div>
                              </div>
                              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-amber-500 group-hover:scale-110 transition-all shadow-xl">
                                 <ChevronRight size={24} />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </Link>
            </motion.div>

         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {/* Top Products - More like a list of achievements */}
            <motion.div variants={item} className="xl:col-span-1 space-y-5">
               <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest px-2">Star Products</h2>
               <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm space-y-6">
                  {topProducts.length === 0 ? (
                     <div className="py-24 text-center opacity-30 font-black text-xs uppercase italic border-2 border-dashed border-slate-100 rounded-3xl">No performance data</div>
                  ) : (
                     <div className="space-y-3">
                        {topProducts.slice(0, 7).map((p, i) => (
                           <div key={i} className="p-4 flex justify-between items-center group hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                              <div className="flex items-center gap-4 overflow-hidden">
                                 <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                    0{i + 1}
                                 </div>
                                 <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-black text-slate-900 truncate tracking-tight">{p.name}</span>
                                    <div className="flex items-center gap-2">
                                       <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">{formatRupiah(p.revenue)}</span>
                                       <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">/ {formatRupiah(p.profit || 0)} PROFIT</span>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
                  <Link href="/inventory" className="w-full py-4 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                     All Products <ChevronRight size={14} />
                  </Link>
               </div>
            </motion.div>

            {/* Expense Progress - With more visual weight */}
            <motion.div variants={item} className="xl:col-span-1 space-y-5">
               <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest px-2">Cost Centers</h2>
               <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between h-full min-h-[460px]">
                  <div className="space-y-7">
                     {data.topExpenses.length === 0 ? (
                        <div className="text-center py-20 opacity-30 font-bold text-xs border-2 border-dashed border-slate-100 rounded-3xl">No costs recorded</div>
                     ) : (
                        data.topExpenses.slice(0, 6).map((exp) => (
                           <div key={exp.name} className="space-y-2 group">
                              <div className="flex justify-between items-end">
                                 <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter group-hover:text-slate-900 transition-colors">{exp.name}</span>
                                 <span className="text-xs font-black text-slate-900 font-mono tracking-tighter">{formatRupiah(exp.value)}</span>
                              </div>
                              <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                                 <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.max(5, (exp.value / Math.max(...data.topExpenses.map(e => e.value))) * 100)}%` }}
                                    className="h-full bg-slate-300 group-hover:bg-rose-500 rounded-full transition-all duration-500 shadow-sm"
                                 />
                              </div>
                           </div>
                        ))
                     )}
                  </div>
                  <div className="mt-8 p-6 bg-rose-50 rounded-3xl border border-rose-100 space-y-1">
                     <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">Efficiency Status</p>
                     <p className="text-sm font-bold text-rose-700 leading-tight">Biaya operasional stabil dalam 30 hari terakhir. Fokus pada optimasi vendor logistik.</p>
                  </div>
               </div>
            </motion.div>

            {/* Quick Strategic Actions - Buttons that pop */}
            <motion.div variants={item} className="xl:col-span-1 space-y-5">
               <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest px-2">Strategy Hub</h2>
               <div className="grid grid-cols-1 gap-6 h-full">
                  <div className="bg-emerald-600 rounded-[40px] p-10 text-white flex flex-col justify-between shadow-2xl shadow-emerald-100 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
                        <Package size={120} strokeWidth={1} />
                     </div>
                     <div className="relative z-10">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60 mb-3">Inventory Optimization</h3>
                        <p className="text-2xl font-black leading-[1.1] italic tracking-tighter">
                           Cegah &quot;Loss Sales&quot; di produk Pareto.
                        </p>
                        <p className="text-[11px] font-medium opacity-70 mt-3 leading-relaxed">System mendeteksi 4 item Pareto hampir habis. Segera restock.</p>
                     </div>
                     <Link href="/inventory" className="w-14 h-14 rounded-[20px] bg-white text-emerald-600 flex items-center justify-center hover:scale-110 transition-all shadow-xl shadow-emerald-900/20 active:scale-95 mt-10">
                        <ArrowUpRight size={28} />
                     </Link>
                  </div>

                  <div className="bg-white rounded-[40px] p-10 border border-slate-100 flex flex-col justify-between shadow-sm group hover:border-blue-200 transition-all">
                     <div className="flex items-start gap-6">
                        <div className="w-16 h-16 rounded-[24px] bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all shadow-inner border border-slate-100">
                           <Target size={32} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-1">
                           <h3 className="text-lg font-black text-slate-900 tracking-tight">Budget Policy</h3>
                           <p className="text-xs font-bold text-slate-400 italic">Financial discipline tracking.</p>
                        </div>
                     </div>
                     <div className="mt-8 flex items-center justify-between">
                        <Link href="/accounting/budgets" className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all">
                           Audit Budgets <ChevronRight size={16} />
                        </Link>
                        <div className="flex -space-x-3">
                           {[1, 2, 3].map(i => (
                              <div key={i} className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white shadow-sm" />
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-50 via-white to-emerald-50 rounded-[40px] p-10 border border-cyan-100 flex flex-col justify-between shadow-sm group hover:border-emerald-200 transition-all overflow-hidden relative">
                     <div className="absolute right-0 top-0 p-8 opacity-10 text-emerald-700 group-hover:scale-110 transition-transform duration-700">
                        <GraduationCap size={120} strokeWidth={1.2} />
                     </div>
                     <div className="relative z-10 flex items-start gap-6">
                        <div className="w-16 h-16 rounded-[24px] bg-white flex items-center justify-center text-emerald-600 shadow-inner border border-emerald-100">
                           <GraduationCap size={30} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-1">
                           <h3 className="text-lg font-black text-slate-900 tracking-tight">Peningkatan Kompetensi</h3>
                           <p className="text-xs font-bold text-slate-500 italic">Training, evaluasi, dan progress tim.</p>
                        </div>
                     </div>
                     <div className="relative z-10 mt-8 flex items-center justify-between">
                        <Link href="/learning" className="text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all">
                           Buka Learning Hub <ChevronRight size={16} />
                        </Link>
                        <div className="rounded-2xl bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 shadow-sm border border-emerald-100">
                           Shortcut Baru
                        </div>
                     </div>
                  </div>
               </div>
            </motion.div>
         </div>
      </motion.div>
   )
}
