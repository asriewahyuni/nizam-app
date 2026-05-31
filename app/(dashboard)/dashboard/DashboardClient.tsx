'use client'

import { motion } from 'framer-motion'
import { useLayoutEffect, useRef } from 'react'
import {
   Search,
   ChevronRight,
   Wallet,
   ArrowUpRight,
   ArrowDownRight,
   TrendingUp,
   TrendingDown,
   BarChart3,
   Package,
   Star,
   Target,
   Trophy,
   GraduationCap,
   Users,
   Clock,
   CheckCircle2,
   XCircle,
   type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts'
import { formatRupiah } from '@/lib/utils'
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer'
import { MetricCard } from './MetricCard'

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
         top20Profit: number
         totalRevenue: number
         totalProfit: number
         paretoCustomers: Array<{
            id: string
            name: string
            revenue: number
            profit: number
         }>
      }
      attendanceSummary?: {
         date: string
         totalEmployees: number
         presentCount: number
         lateCount: number
         absentCount: number
         list: Array<{
            employeeId: string
            employeeName: string
            jobTitle: string
            checkIn: string | null
            checkOut: string | null
            status: string
         }>
      } | null
   }
}

const ICON_MAP: Record<string, LucideIcon> = {
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

function AutoFitMetricAmount({ value, className }: { value: string, className: string }) {
   const wrapperRef = useRef<HTMLSpanElement | null>(null)
   const textRef = useRef<HTMLSpanElement | null>(null)

   useLayoutEffect(() => {
      const wrapper = wrapperRef.current
      const text = textRef.current

      if (!wrapper || !text) return

      let frameId = 0

      const fitText = () => {
         const availableWidth = wrapper.clientWidth

         if (!availableWidth) return

         text.style.fontSize = ''

         const computedFontSize = Number.parseFloat(window.getComputedStyle(text).fontSize)

         if (!Number.isFinite(computedFontSize) || computedFontSize <= 0) return

         const minFontSize = Math.max(26, computedFontSize * 0.58)
         let nextFontSize = computedFontSize

         while (nextFontSize > minFontSize && text.scrollWidth > availableWidth) {
            nextFontSize -= 1
            text.style.fontSize = `${nextFontSize}px`
         }
      }

      const scheduleFit = () => {
         cancelAnimationFrame(frameId)
         frameId = requestAnimationFrame(fitText)
      }

      scheduleFit()

      const resizeObserver = new ResizeObserver(scheduleFit)
      resizeObserver.observe(wrapper)

      return () => {
         cancelAnimationFrame(frameId)
         resizeObserver.disconnect()
      }
   }, [value])

   return (
      <span ref={wrapperRef} className="block w-full max-w-full min-w-0 overflow-hidden">
         <span ref={textRef} className={className}>
            {value}
         </span>
      </span>
   )
}

function normalizeMetricValue(value: string) {
   return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function getMetricValueClass(value: string) {
   const normalizedValue = normalizeMetricValue(value)
   const valueParts = normalizedValue.split('/').map((part) => part.trim()).filter(Boolean)
   const longestAmount = valueParts.reduce((max, part) => {
      const currencyMatch = /^(?<sign>-)?\s*(?<currency>Rp)\s*(?<amount>.+)$/i.exec(part)
      const amountLength = currencyMatch?.groups?.amount?.trim().length ?? part.length

      return Math.max(max, amountLength)
   }, 0)

   if (valueParts.length > 1) {
      if (longestAmount >= 10) {
         return 'text-[clamp(1.5rem,1.8vw,2.2rem)]'
      }

      return 'text-[clamp(2.2rem,2.45vw,3rem)]'
   }

   if (longestAmount >= 13) {
      return 'text-[clamp(2.1rem,2.6vw,3rem)]'
   }

   if (longestAmount >= 10) {
      return 'text-[clamp(2.5rem,3.1vw,3.6rem)]'
   }

   return 'text-[clamp(2.8rem,3.6vw,4.4rem)]'
}

function renderMetricValue(value: string) {
   const normalizedValue = normalizeMetricValue(value)
   const valueParts = normalizedValue.split('/').map((part) => part.trim()).filter(Boolean)

   return valueParts.map((part, index) => {
      const currencyMatch = /^(?<sign>-)?\s*(?<currency>Rp)\s*(?<amount>.+)$/i.exec(part)

      return (
         <span key={`${part}-${index}`} className="block w-full">
            {index > 0 ? (
               <span className="mb-1 block text-[0.42em] font-semibold leading-none text-current/45">/</span>
            ) : null}
            {currencyMatch?.groups ? (
               <span className="flex w-full flex-col items-start gap-1 min-w-0">
                  <span className="flex items-center gap-1 text-[0.3em] font-semibold uppercase leading-none tracking-[0.12em] text-current/60">
                     {currencyMatch.groups.sign ? <span className="text-[1.15em] tracking-normal">{currencyMatch.groups.sign}</span> : null}
                     <span>{currencyMatch.groups.currency}</span>
                  </span>
                  <AutoFitMetricAmount
                     value={currencyMatch.groups.amount}
                     className="block max-w-full min-w-0 whitespace-nowrap font-mono tabular-nums tracking-[-0.05em]"
                  />
               </span>
            ) : (
               <AutoFitMetricAmount
                  value={part}
                  className="block max-w-full whitespace-nowrap font-mono tabular-nums tracking-[-0.05em]"
               />
            )}
         </span>
      )
   })
}

// ── Widget Kehadiran Hari Ini ─────────────────────────────────────────────────
type AttendanceSummary = NonNullable<DashboardClientProps['data']['attendanceSummary']>

function AttendanceTodayWidget({ summary }: { summary: AttendanceSummary }) {
   const pct = summary.totalEmployees > 0
      ? Math.round((summary.presentCount / summary.totalEmployees) * 100)
      : 0
   const fmtTime = (iso: string | null) => {
      if (!iso) return '--:--'
      try {
         return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
      } catch { return '--:--' }
   }

   return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
         {/* Header */}
         <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Users size={16} className="text-indigo-600" />
               </div>
               <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Kehadiran Hari Ini</p>
                  <p className="text-xs font-medium text-slate-400">{summary.date}</p>
               </div>
            </div>
            <Link href="/hris?tab=attendance" className="text-[10px] font-medium text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors">
               Lihat Semua <ChevronRight size={12} />
            </Link>
         </div>

         <div className="px-5 py-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
               <div className="text-center">
                  <p className="text-xl font-bold text-emerald-600">{summary.presentCount}</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mt-0.5">Hadir</p>
               </div>
               <div className="text-center">
                  <p className="text-xl font-bold text-amber-500">{summary.lateCount}</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mt-0.5">Terlambat</p>
               </div>
               <div className="text-center">
                  <p className="text-xl font-bold text-rose-500">{summary.absentCount}</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mt-0.5">Belum Absen</p>
               </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
               <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-medium text-slate-400">{summary.presentCount} / {summary.totalEmployees} karyawan</span>
                  <span className="text-[10px] font-semibold text-indigo-600">{pct}%</span>
               </div>
               <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                     className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                     style={{ width: `${pct}%` }}
                  />
               </div>
            </div>

            {/* Employee list (max 9, sorted: hadir first) */}
            {summary.list.length === 0 ? (
               <p className="text-sm text-slate-400 text-center py-2">Belum ada karyawan terdaftar.</p>
            ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {summary.list.slice(0, 9).map((emp) => {
                     const hadir = !!emp.checkIn
                     return (
                        <div
                           key={emp.employeeId}
                           className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100"
                        >
                           <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${hadir ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                              {hadir
                                 ? <CheckCircle2 size={13} className="text-emerald-600" />
                                 : <XCircle size={13} className="text-slate-400" />
                              }
                           </div>
                           <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-slate-800 truncate leading-tight">{emp.employeeName || '—'}</p>
                              {hadir ? (
                                 <p className="text-[10px] text-emerald-600 font-medium leading-tight flex items-center gap-1">
                                    <Clock size={9} />
                                    {fmtTime(emp.checkIn)} {emp.checkOut ? `→ ${fmtTime(emp.checkOut)}` : ''}
                                 </p>
                              ) : (
                                 <p className="text-[10px] text-slate-400 font-medium leading-tight">Belum absen</p>
                              )}
                           </div>
                        </div>
                     )
                  })}
               </div>
            )}
            {summary.list.length > 9 && (
               <Link href="/hris?tab=attendance" className="mt-3 block text-center text-[10px] font-medium text-indigo-400 hover:text-indigo-600 transition-colors">
                  +{summary.list.length - 9} karyawan lainnya →
               </Link>
            )}
         </div>
      </div>
   )
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
         className="space-y-8 pb-16"
      >
         {/* Header Section */}
         <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="space-y-1">
               <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg text-white">
                     <BarChart3 size={20} />
                  </div>
                  Overview
               </h1>
               <div className="flex items-center gap-2 pl-1">
                  <p className="text-sm text-slate-500 font-medium">Ringkasan bisnis untuk <span className="text-slate-900 font-semibold">{data.orgName}</span></p>
                  <div className="h-1 w-1 bg-slate-300 rounded-full" />
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                     Pareto Mode
                  </span>
               </div>
            </div>

            <div className="flex items-center gap-2">
               <button type="button" className="bg-white border border-slate-200 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                  <Search size={18} />
               </button>
            </div>
         </motion.div>

         {/* Grid: Metric Cards */}
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {data.metrics.map((m) => {
               const Icon = ICON_MAP[m.icon] || Wallet
               const isEmpty = String(m.value).trim() === 'Rp 0' || String(m.value).trim() === '0'
               const href = m.href || '#'

               return (
                  <motion.div key={m.label} variants={item}>
                     <MetricCard
                        label={m.label}
                        value={renderMetricValue(m.value)}
                        hint={m.hint}
                        icon={Icon}
                        href={href}
                        trend={m.trend}
                        danger={m.danger}
                        isEmpty={isEmpty}
                     />
                  </motion.div>
               )
            })}
         </div>

         {/* ── Kehadiran Hari Ini ────────────────────────────────── */}
         {data.attendanceSummary && (
            <motion.div variants={item}>
               <AttendanceTodayWidget summary={data.attendanceSummary} />
            </motion.div>
         )}

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Revenue Trend Chart */}
            <motion.div variants={item} className="lg:col-span-2 space-y-3">
               <div className="flex items-center justify-between">
                  <div>
                     <h2 className="text-sm font-semibold text-slate-800">Performa Keuangan</h2>
                     <p className="text-xs font-medium text-slate-400">Revenue vs Net Profit (bulanan)</p>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                     <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-medium text-slate-600">Revenue</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-medium text-slate-600">Profit</span>
                     </div>
                  </div>
               </div>
               <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm h-[320px]">
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
                           contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '12px' }}
                           itemStyle={{ fontWeight: 600, fontSize: '12px' }}
                           labelStyle={{ fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}
                           formatter={(value: number | string) => [formatRupiah(Number(value || 0)), '']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                        <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={4} strokeDasharray="8 8" fill="url(#colorProfit)" />
                     </AreaChart>
                  </SafeResponsiveContainer>
               </div>
            </motion.div>

            {/* Pareto High Impact Card */}
            <motion.div variants={item} className="lg:col-span-1 space-y-3">
               <h2 className="text-sm font-semibold text-slate-800">Market Impact</h2>
               <Link href="/reports/pareto" className="block h-full group">
                  <div className="bg-slate-900 rounded-xl p-5 text-white relative overflow-hidden border border-slate-800 h-full min-h-[320px] hover:bg-slate-800 transition-colors">
                     <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                        <Trophy size={120} strokeWidth={1} />
                     </div>
                     <div className="relative z-10 flex flex-col justify-between h-full">
                        <div className="space-y-4">
                           <div>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded text-[9px] font-semibold uppercase tracking-wide border border-amber-500/20 mb-3">
                                 <Target size={10} /> Pareto Focus
                              </div>
                              <p className="text-lg font-bold leading-snug">
                                 {pareto.top20Count} produk penguasa pendapatan.
                              </p>
                              <p className="text-xs font-medium text-slate-400 mt-1.5 leading-relaxed">
                                 80/20 otomatis mendeteksi item pelarisan.
                              </p>
                           </div>
                           <div className="space-y-2">
                              {pareto.paretoProducts.slice(0, 3).map((p, i) => (
                                 <div key={p.name} className="flex items-center gap-3 bg-white/5 p-2.5 rounded-lg border border-white/5">
                                    <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-semibold font-mono">#{i + 1}</div>
                                    <div className="flex-1 overflow-hidden">
                                       <span className="text-xs font-medium text-slate-50 truncate block">{p.name}</span>
                                       <div className="flex items-center gap-1.5">
                                          <span className="text-[9px] font-medium text-emerald-400">{formatRupiah(p.revenue)}</span>
                                          <span className="text-[9px] font-medium text-blue-400">/ {formatRupiah(p.profit || 0)}</span>
                                       </div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-white/10">
                           <div className="flex justify-between items-center">
                              <div className="flex gap-4">
                                 <div>
                                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wide mb-0.5">Total Revenue</p>
                                    <p className="text-sm font-semibold text-white font-mono">{formatRupiah(pareto.totalRevenue)}</p>
                                 </div>
                                 <div>
                                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wide mb-0.5">Total Profit</p>
                                    <p className="text-sm font-semibold text-blue-400 font-mono">{formatRupiah(pareto.totalProfit)}</p>
                                 </div>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                                 <ChevronRight size={18} />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </Link>
            </motion.div>

            {/* Customer Pareto Card */}
            <motion.div variants={item} className="lg:col-span-1 space-y-3">
               <h2 className="text-sm font-semibold text-slate-800">Top Customers (80/20)</h2>
               <Link href="/contacts" className="block h-full group">
                  <div className="bg-indigo-900 rounded-xl p-5 text-white relative overflow-hidden border border-indigo-800 h-full min-h-[320px] hover:bg-indigo-800 transition-colors">
                     <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                        <Star size={120} strokeWidth={1} />
                     </div>
                     <div className="relative z-10 flex flex-col justify-between h-full">
                        <div className="space-y-4">
                           <div>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded text-[9px] font-semibold uppercase tracking-wide border border-amber-500/20 mb-3">
                                 <Target size={10} /> Top Clients
                              </div>
                              <p className="text-lg font-bold leading-snug">
                                 {paretoCust.top20Count} klien sumbang 80% omset.
                              </p>
                              <p className="text-xs font-medium text-indigo-200 mt-1.5 leading-relaxed">
                                 Prioritaskan layanan ekstra untuk pelanggan utama.
                              </p>
                           </div>
                           <div className="space-y-2">
                              {paretoCust.paretoCustomers.slice(0, 3).map((c, i) => (
                                 <div key={c.name} className="flex items-center gap-3 bg-white/5 p-2.5 rounded-lg border border-white/5">
                                    <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-semibold font-mono">#{i + 1}</div>
                                    <div className="flex-1 overflow-hidden">
                                       <span className="text-xs font-medium text-slate-50 truncate block">{c.name}</span>
                                       <div className="flex items-center gap-1.5">
                                          <span className="text-[9px] font-medium text-emerald-400">{formatRupiah(c.revenue)}</span>
                                          <span className="text-[9px] font-medium text-blue-400">/ {formatRupiah(c.profit || 0)}</span>
                                       </div>
                                    </div>
                                    {i === 0 && <Trophy size={12} className="text-amber-400 shrink-0" />}
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-white/10">
                           <div className="flex justify-between items-center">
                              <div className="flex gap-4">
                                 <div>
                                    <p className="text-[9px] font-medium text-indigo-300 uppercase tracking-wide mb-0.5">VIP Revenue</p>
                                    <p className="text-sm font-semibold text-white font-mono">{formatRupiah(paretoCust.top20Revenue)}</p>
                                 </div>
                                 <div>
                                    <p className="text-[9px] font-medium text-indigo-300 uppercase tracking-wide mb-0.5">VIP Profit</p>
                                    <p className="text-sm font-semibold text-blue-400 font-mono">{formatRupiah(paretoCust.top20Profit)}</p>
                                 </div>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                                 <ChevronRight size={18} />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </Link>
            </motion.div>

         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Top Products */}
            <motion.div variants={item} className="xl:col-span-1 space-y-3">
               <h2 className="text-sm font-semibold text-slate-800">Produk Terlaris</h2>
               <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  {topProducts.length === 0 ? (
                     <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">Belum ada data produk</div>
                  ) : (
                     <div className="space-y-1">
                        {topProducts.slice(0, 7).map((p, i) => (
                           <div key={i} className="p-2.5 flex items-center gap-3 group hover:bg-slate-50 rounded-lg transition-colors">
                              <div className="shrink-0 w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                 {i + 1}
                              </div>
                              <div className="flex flex-col overflow-hidden flex-1">
                                 <span className="text-sm font-medium text-slate-900 truncate">{p.name}</span>
                                 <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-medium text-emerald-600">{formatRupiah(p.revenue)}</span>
                                    <span className="text-[10px] font-medium text-blue-500">/ {formatRupiah(p.profit || 0)}</span>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
                  <Link href="/inventory" className="mt-3 w-full py-2.5 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                     Semua Produk <ChevronRight size={12} />
                  </Link>
               </div>
            </motion.div>

            {/* Cost Centers */}
            <motion.div variants={item} className="xl:col-span-1 space-y-3">
               <h2 className="text-sm font-semibold text-slate-800">Pengeluaran Terbesar</h2>
               <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col h-full min-h-[400px]">
                  <div className="space-y-4 flex-1">
                     {data.topExpenses.length === 0 ? (
                        <div className="text-center py-12 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">Belum ada data pengeluaran</div>
                     ) : (
                        data.topExpenses.slice(0, 6).map((exp) => (
                           <div key={exp.name} className="space-y-1.5 group">
                              <div className="flex justify-between items-end">
                                 <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors truncate pr-2">{exp.name}</span>
                                 <span className="text-xs font-semibold text-slate-900 font-mono shrink-0">{formatRupiah(exp.value)}</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                 <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.max(5, (exp.value / Math.max(...data.topExpenses.map(e => e.value))) * 100)}%` }}
                                    className="h-full bg-slate-300 group-hover:bg-rose-400 rounded-full transition-colors duration-300"
                                 />
                              </div>
                           </div>
                        ))
                     )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100">
                     <p className="text-xs font-medium text-slate-500">Pantau biaya terbesar untuk efisiensi operasional.</p>
                  </div>
               </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={item} className="xl:col-span-1 space-y-3">
               <h2 className="text-sm font-semibold text-slate-800">Aksi Cepat</h2>
               <div className="grid grid-cols-1 gap-3">
                  <Link href="/inventory" className="bg-emerald-600 rounded-xl p-4 text-white flex items-center justify-between hover:bg-emerald-700 transition-colors group cursor-pointer">
                     <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider opacity-70 mb-1">Inventory</p>
                        <p className="text-base font-semibold leading-snug">Kelola stok produk</p>
                     </div>
                     <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <Package size={18} />
                     </div>
                  </Link>

                  <Link href="/accounting/budgets" className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between hover:border-blue-300 hover:bg-blue-50/30 transition-colors group cursor-pointer">
                     <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">Budget</p>
                        <p className="text-base font-semibold text-slate-900">Audit anggaran</p>
                        <p className="text-xs font-medium text-slate-400">Financial discipline</p>
                     </div>
                     <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                        <Target size={18} />
                     </div>
                  </Link>

                  <Link href="/learning" className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors group cursor-pointer">
                     <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">Learning</p>
                        <p className="text-base font-semibold text-slate-900">Learning Hub</p>
                        <p className="text-xs font-medium text-slate-400">Training & evaluasi tim</p>
                     </div>
                     <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                        <GraduationCap size={18} />
                     </div>
                  </Link>
               </div>
            </motion.div>
         </div>
      </motion.div>
   )
}
