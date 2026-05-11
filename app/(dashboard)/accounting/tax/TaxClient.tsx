'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  Calendar, 
  Download, 
  Printer, 
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  Filter,
  CheckCircle2,
  FileText,
  X,
  Settings,
  FileSpreadsheet,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
  Receipt,
  Banknote,
  SwitchCamera,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatRupiah, formatDate } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip as ReTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer'

interface TaxClientProps {
  summary: any
  orgId: string
  payTax: (orgId: string, taxPeriod: string, paidAt: string, fromAccountId: string, notes?: string) => Promise<any>
  downloadSptCsv: (orgId: string, taxPeriod: string) => Promise<any>
  getOrgTaxSettings: (orgId: string) => Promise<any>
  upsertOrgTaxSettings: (orgId: string, settings: any) => Promise<any>
  generateTaxInvoice: (orgId: string, referenceType: 'SALE' | 'PURCHASE', referenceId: string) => Promise<any>
  getTaxInvoices: (orgId: string, period?: string) => Promise<any[]>
  getSptPpn1111: (orgId: string, taxPeriod: string) => Promise<any>
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeTaxDate(value: unknown): string {
  if (!value) return ''

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (DATE_ONLY_PATTERN.test(trimmed)) return trimmed

    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return ''
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }

  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

function compareTaxDateDesc(a: { date?: unknown }, b: { date?: unknown }) {
  return normalizeTaxDate(b?.date).localeCompare(normalizeTaxDate(a?.date))
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export default function TaxClient({ 
  summary, 
  orgId, 
  payTax, 
  downloadSptCsv, 
  getOrgTaxSettings, 
  upsertOrgTaxSettings, 
  generateTaxInvoice, 
  getTaxInvoices, 
  getSptPpn1111 
}: TaxClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'VAT' | 'PPH'>('VAT')
  
  const startDate = searchParams.get('startDate') || summary.startDate
  const endDate = searchParams.get('endDate') || summary.endDate

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showSptModal, setShowSptModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Tax settings
  const [taxSettings, setTaxSettings] = useState<any>(null)
  const [npwp, setNpwp] = useState('')
  const [ppnRate, setPpnRate] = useState(11)
  const [isPkp, setIsPkp] = useState(false)
  const [pkpSince, setPkpSince] = useState('')

  // Payment form
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentAccount, setPaymentAccount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [bankAccounts, setBankAccounts] = useState<any[]>([])

  // SPT data
  const [sptData, setSptData] = useState<any>(null)

  // Tax invoices
  const [taxInvoices, setTaxInvoices] = useState<any[]>([])

  const updateDates = (s: string, e: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('startDate', s)
    params.set('endDate', e)
    router.push(`/accounting/tax?${params.toString()}`)
  }

  const vatData = [
    { name: 'VAT In (PPN Masukan)', value: summary.vatIn.total, color: '#10b981' },
    { name: 'VAT Out (PPN Keluaran)', value: summary.vatOut.total, color: '#ef4444' },
  ]

  const pphData = [
    { name: 'PPh 21 (Hutang)', value: summary.pph21.total, color: '#f59e0b' },
    { name: 'PPh 23 (Hutang)', value: summary.pph23.total, color: '#3b82f6' },
  ]

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <ShieldCheck size={40} className="text-emerald-500" />
            Manajemen Pajak
          </h1>
          <p className="text-slate-500 font-medium text-lg leading-relaxed">Kelola PPN, PPh, dan pantau kesehatan kepatuhan pajak secara real-time.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
           {/* Date Picker */}
           <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200">
             <input 
               type="date" 
               value={startDate}
               onChange={(e) => updateDates(e.target.value, endDate)}
               className="text-xs font-bold text-slate-600 bg-transparent outline-none cursor-pointer"
             />
             <ArrowRight size={12} className="text-slate-300"/>
             <input 
               type="date" 
               value={endDate}
               onChange={(e) => updateDates(startDate, e.target.value)}
               className="text-xs font-bold text-slate-600 bg-transparent outline-none cursor-pointer"
             />
           </div>

           <button 
             onClick={async () => {
               setLoading(true)
               try {
                 const { createClient } = await import('@/lib/supabase/client')
                 const supabase = createClient()
                 const { data: banks } = await (supabase as any)
                   .from('bank_accounts')
                   .select('id, bank_name, account_number, accounts!inner(id, code, name)')
                   .eq('org_id', orgId)
                   .eq('is_active', true)
                 setBankAccounts(banks || [])
                 setPaymentAccount('')
                 setPaymentDate(new Date().toISOString().split('T')[0])
                 setShowPaymentModal(true)
               } catch (e) {
                 setMessage({ type: 'error', text: 'Gagal memuat data rekening.' })
               }
               setLoading(false)
             }}
             className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all text-sm"
           >
             <Wallet size={16} /> Bayar Pajak
           </button>
           
           <button 
             onClick={async () => {
               setLoading(true)
               try {
                 const period = (startDate || summary.startDate).slice(0, 7)
                 const result = await downloadSptCsv(orgId, period)
                 if (result?.csv) {
                   const blob = new Blob([result.csv], { type: 'text/csv' })
                   const url = URL.createObjectURL(blob)
                   const a = document.createElement('a')
                   a.href = url
                   a.download = result.filename
                   a.click()
                   URL.revokeObjectURL(url)
                   setMessage({ type: 'success', text: `SPT ${result.filename} berhasil di-download.` })
                 } else {
                   setMessage({ type: 'error', text: 'Tidak ada data SPT untuk periode ini.' })
                 }
               } catch (e) {
                 setMessage({ type: 'error', text: 'Gagal download SPT.' })
               }
               setLoading(false)
             }}
             className="flex items-center gap-2 px-5 py-3 bg-white text-slate-700 font-bold border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-sm"
           >
             {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download SPT
           </button>

           <button 
             onClick={async () => {
               setLoading(true)
               const settings = await getOrgTaxSettings(orgId)
               setTaxSettings(settings)
               setIsPkp(settings.is_pkp)
               setNpwp(settings.npwp || '')
               setPpnRate(settings.ppn_rate || 11)
               setPkpSince(settings.pkp_since ? settings.pkp_since.slice(0, 10) : '')
               setShowSettingsModal(true)
               setLoading(false)
             }}
             className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 rounded-2xl shadow-sm transition-all hidden md:flex items-center justify-center"
             title="Setting PKP"
           >
             <Settings size={18} />
           </button>

           <button onClick={() => window.print()} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 rounded-2xl shadow-sm transition-all hidden md:flex items-center justify-center">
             <Printer size={18} />
           </button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <motion.div variants={item} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
               <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                 <ArrowDownRight size={24} />
               </div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aset Pajak</span>
            </div>
            <div className="space-y-1">
               <p className="text-xs font-bold text-slate-500">PPN Masukan (Input)</p>
               <h3 className="text-2xl font-black text-emerald-600">{formatRupiah(summary.vatIn.total)}</h3>
            </div>
         </motion.div>

         <motion.div variants={item} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
               <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                 <ArrowUpRight size={24} />
               </div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kewajiban Pajak</span>
            </div>
            <div className="space-y-1">
               <p className="text-xs font-bold text-slate-500">PPN Keluaran (Output)</p>
               <h3 className="text-2xl font-black text-rose-600">{formatRupiah(summary.vatOut.total)}</h3>
            </div>
         </motion.div>

         <motion.div variants={item} className="bg-slate-900 p-8 rounded-[32px] shadow-2xl shadow-emerald-200/20 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
            <div className="relative z-10 space-y-4">
               <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
                    <Wallet size={24} />
                  </div>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Kurang/Lebih Bayar</span>
               </div>
               <div className="space-y-1">
                  <p className="text-xs font-bold text-white/60">Estimasi Penyetoran</p>
                  <h3 className={`text-2xl font-black ${summary.netVat >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {formatRupiah(Math.abs(summary.netVat))}
                  </h3>
                  <p className="text-[9px] font-medium text-white/40 italic">
                    {summary.netVat >= 0 ? '*Pajak Kurang Bayar' : '*Lebih Bayar (Siap Kompensasi)'}
                  </p>
               </div>
            </div>
         </motion.div>

         <motion.div variants={item} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
               <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
                 <Calendar size={24} />
               </div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jatuh Tempo</span>
            </div>
            <div className="space-y-1">
               <p className="text-xs font-bold text-slate-500">SPT Masa Berikutnya</p>
               <h3 className="text-xl font-black text-slate-800">20 {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleString('id-ID', { month: 'short' })}</h3>
            </div>
         </motion.div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Charts Side */}
         <motion.div variants={item} className="lg:col-span-1 space-y-8">
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8 h-full">
               <div className="flex items-center justify-between">
                 <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">Distribusi PPN</h4>
                 <Info size={16} className="text-slate-300" />
               </div>
               
               <div className="h-64 relative">
                  <SafeResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={vatData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {vatData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ReTooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: 'bold' }}
                        formatter={(value: any) => formatRupiah(Number(value || 0))}
                      />
                    </PieChart>
                  </SafeResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-[10px] font-black text-slate-400 uppercase">Efek Kas</span>
                     <span className={`text-xs font-black ${summary.netVat >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                       {Math.round((Math.abs(summary.netVat) / (summary.vatIn.total + summary.vatOut.total || 1)) * 100)}%
                     </span>
                  </div>
               </div>

               <div className="space-y-4">
                  {vatData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                       <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-xs font-bold text-slate-600">{d.name}</span>
                       </div>
                       <span className="text-xs font-black text-slate-900">{formatRupiah(d.value)}</span>
                    </div>
                  ))}
               </div>
            </div>
         </motion.div>

         {/* Tables Side */}
         <div className="lg:col-span-2 space-y-8">
            {/* Tab Selector */}
            <div className="flex bg-slate-100 p-1.5 rounded-3xl w-fit">
               <button 
                 onClick={() => setActiveTab('VAT')}
                 className={`px-8 py-3 rounded-2xl text-xs font-black transition-all ${activeTab === 'VAT' ? 'bg-white text-emerald-600 shadow-xl shadow-emerald-200/50' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 MANAJEMEN PPN
               </button>
               <button 
                 onClick={() => setActiveTab('PPH')}
                 className={`px-8 py-3 rounded-2xl text-xs font-black transition-all ${activeTab === 'PPH' ? 'bg-white text-blue-600 shadow-xl shadow-blue-200/50' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 MANAJEMEN PPh
               </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'VAT' ? (
                <motion.div 
                  key="vat" 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
                     <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                        <h4 className="text-lg font-black text-slate-900 flex items-center gap-3">
                           Rincian Transaksi PPN 
                           <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-400">Real-time Data</span>
                        </h4>
                        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black shadow-lg shadow-emerald-200">
                           <FileText size={14} /> EXPORT CSV
                        </button>
                     </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead className="bg-slate-50/50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-50">
                              <tr>
                                <th className="px-8 py-5">Tanggal</th>
                                <th className="px-6 py-5">Referensi</th>
                                <th className="px-6 py-5">Deskripsi</th>
                                <th className="px-6 py-5">Jenis</th>
                                <th className="px-8 py-5 text-right">Nominal Pajak</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {[...summary.vatIn.items, ...summary.vatOut.items].sort(compareTaxDateDesc).map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                   <td className="px-8 py-5 text-xs font-bold text-slate-600">{formatDate(it.date)}</td>
                                   <td className="px-6 py-5 font-mono text-[11px] font-black text-slate-400">{it.ref}</td>
                                   <td className="px-6 py-5 text-xs font-bold text-slate-900 max-w-xs truncate">{it.description}</td>
                                   <td className="px-6 py-5">
                                      <span className={`px-3 py-1 rounded-full text-[9px] font-black ${summary.vatIn.items.includes(it) ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                         {summary.vatIn.items.includes(it) ? 'PPN MASUKAN' : 'PPN KELUARAN'}
                                      </span>
                                   </td>
                                   <td className={`px-8 py-5 text-right font-black text-sm ${summary.vatIn.items.includes(it) ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {summary.vatIn.items.includes(it) ? '+' : '-'}{formatRupiah(it.amount)}
                                   </td>
                                </tr>
                              ))}
                              {(summary.vatIn.items.length + summary.vatOut.items.length) === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-20 text-center opacity-40 italic font-bold">Tidak ada transaksi pajak di periode ini.</td>
                                </tr>
                              )}
                           </tbody>
                        </table>
                     </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="pph" 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                   {/* PPh Summary Stats */}
                   <div className="grid grid-cols-2 gap-6">
                      <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                              <Wallet size={20} />
                            </div>
                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hutang PPh 21</h5>
                         </div>
                         <h3 className="text-3xl font-black text-slate-900 font-mono tracking-tighter">{formatRupiah(summary.pph21.total)}</h3>
                      </div>
                      <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                              <TrendingUp size={20} />
                            </div>
                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hutang PPh 23</h5>
                         </div>
                         <h3 className="text-3xl font-black text-slate-900 font-mono tracking-tighter">{formatRupiah(summary.pph23.total)}</h3>
                      </div>
                   </div>

                   {/* PPh Items List */}
                   <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                         <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Aktivitas Potong PPh</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead className="bg-slate-50/50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-50">
                              <tr>
                                <th className="px-8 py-5">Tanggal</th>
                                <th className="px-6 py-5">Uraian Transaksi</th>
                                <th className="px-6 py-5">Tipe PPh</th>
                                <th className="px-8 py-5 text-right">Potongan (Hutang)</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {[...summary.pph21.items.map((i:any) => ({...i, type: 'PPh 21'})), ...summary.pph23.items.map((i:any) => ({...i, type: 'PPh 23'}))].sort(compareTaxDateDesc).map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                   <td className="px-8 py-5 text-xs font-bold text-slate-600">{formatDate(it.date)}</td>
                                   <td className="px-6 py-5">
                                      <p className="text-xs font-black text-slate-900">{it.description}</p>
                                      <p className="text-[10px] text-slate-400 font-bold font-mono mt-1">{it.ref}</p>
                                   </td>
                                   <td className="px-6 py-5 text-xs font-black text-slate-400">{it.type}</td>
                                   <td className="px-8 py-5 text-right font-black text-slate-900">{formatRupiah(it.amount)}</td>
                                </tr>
                              ))}
                              {(summary.pph21.items.length + summary.pph23.items.length) === 0 && (
                                <tr>
                                  <td colSpan={4} className="py-20 text-center text-slate-300 font-bold italic">Belum ada pemotongan PPh dideteksi.</td>
                                </tr>
                              )}
                           </tbody>
                        </table>
                      </div>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
         </div>
      </div>

      {/* ── Toast Message ── */}
      {message && (
        <div className="fixed bottom-8 right-8 z-[9999] animate-in slide-in-from-bottom-2 fade-in">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
            message.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-red-500" />}
            <span className="font-bold text-sm">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-2 opacity-50 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── PAYMENT MODAL ── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-[32px] max-w-lg w-full shadow-2xl border border-slate-100 p-8 space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Bayar Pajak</h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Buat jurnal pembayaran PPN Kurang Bayar. Dana akan didebet dari rekening yang dipilih.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Periode Pajak</label>
                <div className="bg-slate-50 rounded-2xl px-5 py-4">
                  <span className="font-bold text-slate-900">{summary.taxPeriod || (startDate || summary.startDate).slice(0, 7)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Tanggal Bayar</label>
                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-900 border border-slate-100 outline-none focus:border-emerald-300 transition-all" />
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Dari Rekening</label>
                <select value={paymentAccount} onChange={e => setPaymentAccount(e.target.value)}
                  className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-900 border border-slate-100 outline-none focus:border-emerald-300 transition-all">
                  <option value="">Pilih Rekening...</option>
                  {bankAccounts.map((b: any) => (
                    <option key={b.id} value={b.accounts?.id}>{b.bank_name} - {b.account_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Keterangan (opsional)</label>
                <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} rows={2}
                  className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-medium text-slate-900 border border-slate-100 outline-none focus:border-emerald-300 transition-all resize-none"
                  placeholder="Pembayaran PPN Masa..." />
              </div>
            </div>

            <button
              disabled={!paymentAccount || loading}
              onClick={async () => {
                setLoading(true)
                setMessage(null)
                const period = (startDate || summary.startDate).slice(0, 7)
                const result = await payTax(orgId, period, paymentDate, paymentAccount, paymentNotes)
                if (result.success) {
                  setMessage({ type: 'success', text: `Jurnal pembayaran PPN berhasil! No. ${result.entry_number} - Rp ${formatRupiah(result.amount)}` })
                  setShowPaymentModal(false)
                } else {
                  setMessage({ type: 'error', text: result.error || 'Gagal memproses pembayaran.' })
                }
                setLoading(false)
              }}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
              {loading ? 'Memproses...' : 'Konfirmasi Pembayaran Pajak'}
            </button>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL (PKP) ── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSettingsModal(false)}>
          <div className="bg-white rounded-[32px] max-w-lg w-full shadow-2xl border border-slate-100 p-8 space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Setting PKP</h3>
              <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className={`w-14 h-8 rounded-full relative transition-all cursor-pointer ${isPkp ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  onClick={() => setIsPkp(!isPkp)}>
                  <div className={`absolute w-6 h-6 bg-white rounded-full top-1 shadow transition-all ${isPkp ? 'left-7' : 'left-1'}`} />
                </div>
                <div>
                  <p className="font-black text-sm text-slate-900">Pengusaha Kena Pajak (PKP)</p>
                  <p className="text-xs text-slate-500 font-medium">Aktifkan untuk menerbitkan Faktur Pajak</p>
                </div>
              </div>

              {isPkp && (
                <>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">NPWP</label>
                    <input type="text" value={npwp} onChange={e => setNpwp(e.target.value)} placeholder="XX.XXX.XXX.X-XXX.XXX"
                      className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-mono font-bold text-slate-900 border border-slate-100 outline-none focus:border-emerald-300 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Tarif PPN (%)</label>
                    <div className="flex gap-2">
                      {[11, 12].map(rate => (
                        <button key={rate} onClick={() => setPpnRate(rate)}
                          className={`px-6 py-4 rounded-2xl font-black text-sm border-2 transition-all ${
                            ppnRate === rate 
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                              : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                          }`}>
                          {rate}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Tanggal PKP</label>
                    <input type="date" value={pkpSince} onChange={e => setPkpSince(e.target.value)}
                      className="w-full bg-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-900 border border-slate-100 outline-none focus:border-emerald-300 transition-all" />
                  </div>
                </>
              )}
            </div>

            <button
              disabled={loading}
              onClick={async () => {
                setLoading(true)
                const settings = await getOrgTaxSettings(orgId)
                const result = await upsertOrgTaxSettings(orgId, {
                  is_pkp: isPkp,
                  npwp: isPkp ? npwp : null,
                  ppn_rate: ppnRate,
                  pkp_since: isPkp && pkpSince ? pkpSince : null,
                  ...(settings.ppn_masukan_account_id ? { ppn_masukan_account_id: settings.ppn_masukan_account_id } : {}),
                  ...(settings.ppn_keluaran_account_id ? { ppn_keluaran_account_id: settings.ppn_keluaran_account_id } : {}),
                })
                if (result.success) {
                  setMessage({ type: 'success', text: 'Setting PKP berhasil disimpan.' })
                  setShowSettingsModal(false)
                } else {
                  setMessage({ type: 'error', text: result.error || 'Gagal menyimpan setting.' })
                }
                setLoading(false)
              }}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-lg hover:bg-slate-800 transition-all disabled:opacity-40"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              {loading ? 'Menyimpan...' : 'Simpan Setting PKP'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
