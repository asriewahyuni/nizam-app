'use client'

import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  BarChart, 
  PieChart, 
  ArrowRight,
  ChevronDown,
  Printer,
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Triangle,
  Layers
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatRupiah, formatDate, getDateInTimeZone } from '@/lib/utils'

interface ReportsClientProps {
  orgId: string
  orgName: string
  branchId?: string | null
  isConsolidated?: boolean
  isParentOrg?: boolean
  balanceSheet: any
  profitLoss: any
  cashFlow: {
    ocf: number
    icf: number
    fcf: number
    netChange: number
    ocfItems?: any[]
    icfItems?: any[]
    fcfItems?: any[]
    netChangeTrend?: 'UP' | 'DOWN' | 'NEUTRAL'
    changePercent?: number
  }
}

interface BalanceTreeRow {
  key: string
  code: string
  name: string
  balance: number
  level: number
  hasChildren: boolean
  isSystemComputed?: boolean
}

const BALANCE_EPSILON = 0.01

function buildBalanceTreeRows(accounts: any[] = [], showEmptyAccounts: boolean): BalanceTreeRow[] {
  if (!Array.isArray(accounts) || accounts.length === 0) return []

  const byId = new Map<string, any>()
  accounts.forEach((acc: any) => {
    if (acc?.id) byId.set(acc.id, acc)
  })

  const childrenByParent = new Map<string, any[]>()
  const roots: any[] = []

  accounts.forEach((acc: any) => {
    const parentId = acc?.parent_id
    if (parentId && byId.has(parentId)) {
      const existing = childrenByParent.get(parentId) || []
      existing.push(acc)
      childrenByParent.set(parentId, existing)
      return
    }
    roots.push(acc)
  })

  const sortByCode = (a: any, b: any) => String(a?.code || '').localeCompare(String(b?.code || ''))
  roots.sort(sortByCode)
  for (const [parentId, children] of childrenByParent.entries()) {
    childrenByParent.set(parentId, children.sort(sortByCode))
  }

  const walk = (account: any, level: number): BalanceTreeRow[] => {
    const children = account?.id ? (childrenByParent.get(account.id) || []) : []
    const childRows = children.flatMap((child: any) => walk(child, level + 1))
    const ownBalance = Number(account?.balance || 0)
    const visible = showEmptyAccounts || Math.abs(ownBalance) > BALANCE_EPSILON || childRows.length > 0
    if (!visible) return []

    return [
      {
        key: String(account?.id || account?.code || `${account?.name || 'acc'}-${level}`),
        code: String(account?.code || '-'),
        name: String(account?.name || 'Tanpa Nama Akun'),
        balance: ownBalance,
        level,
        hasChildren: children.length > 0,
        isSystemComputed: Boolean(account?.isSystemComputed),
      },
      ...childRows,
    ]
  }

  return roots.flatMap((root) => walk(root, 0))
}

export default function ReportsClient({
  orgId,
  orgName,
  branchId,
  balanceSheet,
  profitLoss,
  cashFlow,
  isConsolidated,
  isParentOrg,
}: ReportsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const currentMonthStart = `${todayInJakarta.slice(0, 7)}-01`
  const [activeTab, setActiveTab] = useState<'PL' | 'BS' | 'CF'>('PL')
  const [showEmptyAccounts, setShowEmptyAccounts] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (type: 'pl' | 'bs' | 'gl') => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams({
        type,
        orgId,
        startDate: searchParams.get('startDate') || currentMonthStart,
        endDate: searchParams.get('endDate') || todayInJakarta,
        asOfDate: searchParams.get('endDate') || todayInJakarta,
      })
      if (isConsolidated) {
        params.set('consolidated', 'true')
      } else if (branchId) {
        params.set('branchId', branchId)
      }
      const url = `/api/export?${params.toString()}`
      const a = document.createElement('a')
      a.href = url
      a.click()
    } finally {
      setTimeout(() => setIsExporting(false), 1500)
    }
  }
  const [detailModal, setDetailModal] = useState<{ show: boolean, title: string, items: any[] }>({
    show: false,
    title: '',
    items: []
  })
  const assetTreeRows = useMemo(
    () => buildBalanceTreeRows(balanceSheet?.assets || [], showEmptyAccounts),
    [balanceSheet?.assets, showEmptyAccounts]
  )
  const liabilityTreeRows = useMemo(
    () => buildBalanceTreeRows(balanceSheet?.liabilities || [], showEmptyAccounts),
    [balanceSheet?.liabilities, showEmptyAccounts]
  )
  const equityTreeRows = useMemo(
    () => buildBalanceTreeRows(balanceSheet?.equity || [], showEmptyAccounts),
    [balanceSheet?.equity, showEmptyAccounts]
  )

  const renderBalanceRows = (rows: BalanceTreeRow[]) => (
    rows.map((row) => (
      <div key={row.key} className="flex justify-between items-center text-sm pb-2 border-b border-slate-50 gap-3">
        <div className="flex items-center min-w-0" style={{ paddingLeft: `${row.level * 18}px` }}>
          <span className="w-4 text-slate-300 text-xs">{row.level > 0 ? '-' : ''}</span>
          <span className="w-4 text-slate-400">{row.hasChildren ? <ChevronDown size={12} /> : ''}</span>
          <span className="text-[10px] font-mono text-slate-400 mr-2">{row.code}</span>
          <div className="min-w-0 flex items-center gap-2">
            <span className={`truncate ${row.hasChildren ? 'text-slate-700 font-bold' : 'text-slate-600 font-medium'}`}>{row.name}</span>
            {row.isSystemComputed && (
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-amber-700 border border-amber-100">
                Otomatis
              </span>
            )}
          </div>
        </div>
        <span className="text-slate-900 font-bold shrink-0">{formatRupiah(row.balance)}</span>
      </div>
    ))
  )

  // Date Range State from URL
  const startDate = searchParams.get('startDate') || currentMonthStart
  const endDate = searchParams.get('endDate') || todayInJakarta

  const updateDates = (s: string, e: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('startDate', s)
    params.set('endDate', e)
    router.push(`/reports?${params.toString()}`)
  }

  const toggleConsolidated = () => {
    if (!isParentOrg) return
    const params = new URLSearchParams(searchParams.toString())
    if (isConsolidated) {
      params.delete('consolidated')
    } else {
      params.set('consolidated', 'true')
    }
    router.push(`/reports?${params.toString()}`)
  }

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  }

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  }
  
  const openDetail = (title: string, items: any[]) => {
    setDetailModal({ show: true, title, items })
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Consolidation Control (Top) */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Status Struktur</span>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${isParentOrg ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
            {isParentOrg ? 'Parent (Holding)' : 'Child (Anak Perusahaan)'}
          </span>
          {isConsolidated && (
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-indigo-700">
              Mode Konsolidasi Aktif
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-sm text-slate-500 font-medium">
            {isParentOrg
              ? 'Parent dapat menarik laporan gabungan Parent + seluruh Child langsung dari halaman ini.'
              : 'Child hanya melihat laporan entitas sendiri. Konsolidasi diaktifkan dari akun Parent.'}
          </p>

          <button
            onClick={toggleConsolidated}
            disabled={!isParentOrg}
            className={`flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold rounded-2xl border transition-all ${
              isConsolidated
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                : isParentOrg
                  ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            <Layers size={14} />
            {isConsolidated ? 'Laporan Konsolidasi: ON' : 'Laporan Konsolidasi: OFF'}
          </button>
        </div>
      </div>

      {/* Header & Toggle */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Laporan Keuangan</h1>
          <p className="text-sm text-slate-500 font-medium">Laporan real-time yang dihasilkan otomatis dari Buku Besar.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker (Simplified) */}
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
            onClick={() => window.print()}
            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-2xl shadow-sm transition-all"
          >
            <Printer size={18} />
          </button>

          {/* Download XLSX — CFO Requirement: Harga Mati */}
          <button
            onClick={() => handleExport(activeTab === 'PL' ? 'pl' : activeTab === 'BS' ? 'bs' : 'gl')}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-3 text-xs font-black rounded-2xl border transition-all bg-[#003366] text-white border-[#003366] hover:bg-[#002244] shadow-md shadow-[#003366]/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download size={14} className={isExporting ? 'animate-bounce' : ''} />
            {isExporting ? 'Mengunduh...' : 'Download XLSX'}
          </button>

          <button 
            onClick={() => setShowEmptyAccounts(!showEmptyAccounts)}
            className={`flex items-center gap-2 px-6 py-3 text-xs font-bold rounded-2xl border transition-all ${showEmptyAccounts ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <Filter size={14} />
            {showEmptyAccounts ? 'Sembunyikan Saldo 0' : 'Tampilkan Saldo 0'}
          </button>

          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
            <button 
              onClick={() => setActiveTab('PL')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'PL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Laba Rugi
            </button>
            <button 
              onClick={() => setActiveTab('BS')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'BS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Neraca
            </button>
            <button 
              onClick={() => setActiveTab('CF')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'CF' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Arus Kas
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'PL' ? (
          <motion.div 
            key="pl" 
            variants={container} 
            initial="hidden" 
            animate="show" 
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <BarChart size={18} className="text-blue-500"/> Laporan Laba Rugi
                </h3>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Periode: Current Month</div>
              </div>
              
              <div className="p-8 space-y-10">
                {/* Revenue Section */}
                <motion.div variants={item} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Pendapatan</span>
                    <span className="text-sm font-bold text-emerald-600">{formatRupiah(profitLoss.totalRevenue)}</span>
                  </div>
                  <div className="space-y-2">
                    {profitLoss.revenue.filter((r: any) => showEmptyAccounts || Math.abs(r.balance) > 0.01).map((r: any) => (
                      <div key={r.code} className="flex justify-between items-center text-sm px-2 py-1">
                        <span className="text-slate-600 font-medium">{r.code} - {r.name}</span>
                        <span className="text-slate-900 font-bold">{formatRupiah(r.balance)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Expenses Section */}
                <motion.div variants={item} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Beban & Biaya Operasional</span>
                    <span className="text-sm font-bold text-rose-600">({formatRupiah(profitLoss.totalExpenses)})</span>
                  </div>
                  <div className="space-y-2">
                    {profitLoss.expenses.filter((e: any) => showEmptyAccounts || Math.abs(e.balance) > 0.01).map((e: any) => (
                      <div key={e.code} className="flex justify-between items-center text-sm px-2 py-1">
                        <span className="text-slate-600 font-medium">{e.code} - {e.name}</span>
                        <span className="text-slate-900 font-bold">{formatRupiah(e.balance)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Summary Section */}
                <motion.div variants={item} className="pt-8 border-t-2 border-slate-900 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 uppercase">Laba (Rugi) Bersih</span>
                    <span className="text-xs text-slate-400 font-medium italic">Net Income for the period</span>
                  </div>
                  <div className={`px-6 py-3 rounded-2xl text-2xl font-black ${profitLoss.netProfit >= 0 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-rose-500 text-white shadow-lg shadow-rose-200'}`}>
                    {formatRupiah(profitLoss.netProfit)}
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'CF' ? (
          <motion.div 
            key="cf" 
            variants={container} 
            initial="hidden" 
            animate="show" 
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { 
                  title: 'Operating (OCF)', 
                  value: cashFlow.ocf, 
                  icon: TrendingUp, 
                  color: 'text-emerald-500', 
                  hint: 'Kemampuan bisnis menghasilkan kas dari operasional inti.',
                  metric: cashFlow.ocf > 0 ? 'Sehat' : 'Perlu Perhatian',
                  items: cashFlow.ocfItems
                },
                { 
                  title: 'Investing (ICF)', 
                  value: cashFlow.icf, 
                  icon: BarChart, 
                  color: 'text-amber-500', 
                  hint: 'Kas yang digunakan untuk belanja aset tetap/investasi.',
                  metric: cashFlow.icf < 0 ? 'Ekspansi' : 'Divestasi',
                  items: cashFlow.icfItems
                },
                { 
                  title: 'Financing (FCF)', 
                  value: cashFlow.fcf, 
                  icon: PieChart, 
                  color: 'text-blue-500', 
                  hint: 'Aliran kas dari pinjaman bank atau modal pemilik.',
                  metric: cashFlow.fcf > 0 ? 'Pendanaan Masuk' : 'Pembayaran Hutang/Dividen',
                  items: cashFlow.fcfItems
                },
              ].map((m) => (
                <div key={m.title} className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-4 flex flex-col relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-blue-50 transition-colors" />
                  <div className="flex items-center justify-between relative z-10">
                    <div className={`w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center ${m.color}`}>
                      <m.icon size={24} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">{m.metric}</span>
                  </div>
                  <div className="space-y-1 relative z-10">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{m.title}</p>
                    <h4 className={`text-2xl font-black ${m.value >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                      {formatRupiah(m.value)}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed h-8">{m.hint}</p>
                  </div>
                  <div className="pt-2 relative z-10">
                    <button 
                      onClick={() => openDetail(m.title, m.items || [])}
                      className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-tighter flex items-center justify-center gap-2 transition-all border border-slate-100 hover:border-slate-200"
                    >
                      Lihat Rincian <ArrowRight size={12}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 rounded-[40px] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative shadow-2xl shadow-blue-500/20">
               <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] -mr-40 -mt-40" />
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -ml-20 -mb-20" />
               
               <div className="relative z-10 space-y-2">
                 <div className="flex items-center gap-3">
                    <h3 className="text-3xl font-black tracking-tight">Net Cash Flow</h3>
                    <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black shadow-sm ${cashFlow.netChangeTrend === 'UP' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                      <Triangle 
                        size={10} 
                        fill="currentColor" 
                        className={`${cashFlow.netChangeTrend === 'UP' ? '' : 'rotate-180'} transition-transform duration-500`}
                      />
                      <span>{cashFlow.netChangeTrend === 'UP' ? 'NAIK' : 'TURUN'} {Math.abs(cashFlow.changePercent || 0).toFixed(1)}%</span>
                    </div>
                 </div>
                 <p className="text-sm text-slate-400 font-medium font-mono opacity-80 uppercase tracking-widest">Total liquidity changes for current period</p>
               </div>

               <div className="relative z-10 text-5xl font-black tracking-tighter text-blue-400 flex flex-col items-end gap-1">
                 {formatRupiah(cashFlow.netChange)}
                 <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-60">Real-time Balance Match</div>
               </div>
            </div>

            <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full bg-blue-600" />
               <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-2">
                 <FileText size={18} className="text-blue-600"/> Insight & Analisis Kinerja
               </h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 rounded-[32px] bg-slate-50 border border-slate-100 space-y-4 hover:border-blue-200 transition-colors">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">A</div>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Kualitas Laba vs Kas</p>
                     </div>
                     <p className="text-sm text-slate-700 leading-relaxed font-medium">
                       {cashFlow.ocf > profitLoss.netProfit ? 
                        "Sangat Baik: Kas operasional lebih besar dari laba bersih. Bisnis memiliki kualitas laba yang tinggi karena pendapatan benar-benar cair menjadi uang tunai." : 
                        "Waspada: Laba bersih di atas kertas belum sepenuhnya cair menjadi kas. Periksa piutang Anda atau stok yang menumpuk."}
                     </p>
                  </div>
                  <div className="p-8 rounded-[32px] bg-slate-50 border border-slate-100 space-y-4 hover:border-emerald-200 transition-colors">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">B</div>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Arah Investasi</p>
                     </div>
                     <p className="text-sm text-slate-700 leading-relaxed font-medium">
                       {cashFlow.icf < 0 ? 
                        "Fase Ekspansi: Perusahaan aktif menginvestasikan kasnya untuk menambah aset tetap, pertanda persiapan pertumbuhan kapasitas di masa depan." : 
                        "Fase Konservatif: Tidak ada pengeluaran modal besar dideteksi. Fokus saat ini adalah efisiensi operasional dari aset yang ada."}
                     </p>
                  </div>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="bs" 
            variants={container} 
            initial="hidden" 
            animate="show" 
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Asset Side */}
            <div className="space-y-6">
               <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest">Aktiva (Aset)</h3>
                  </div>
                  <div className="p-8 space-y-3">
                    {renderBalanceRows(assetTreeRows)}
                    <div className="flex justify-between items-center pt-4 text-emerald-600">
                      <span className="font-black uppercase text-xs">Total Aktiva</span>
                      <span className="font-black text-lg">{formatRupiah(balanceSheet.assets.reduce((s:any, x:any) => s + (x.balance || 0), 0))}</span>
                    </div>
                  </div>
               </div>
            </div>

            {/* Liability & Equity Side */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest">Kewajiban & Ekuitas</h3>
                  </div>
                  <div className="p-8 space-y-6">
                    {/* Liabilities */}
                    <div className="space-y-2">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Pasiva / Hutang</p>
                       {renderBalanceRows(liabilityTreeRows)}
                    </div>
                    {/* Equity */}
                    <div className="space-y-2">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Modal</p>
                       <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                         Akun <span className="font-mono font-black">3002</span> menampung laba/rugi periode lampau atau periode yang sudah ditutup, sedangkan <span className="font-mono font-black">3003</span> menampung laba/rugi periode berjalan. Beban utilitas tetap dicatat di laba rugi, lalu dampaknya mengurangi laba periode berjalan di neraca.
                       </p>
                       {renderBalanceRows(equityTreeRows)}
                    </div>
                    
                    <div className="flex justify-between items-center pt-6 text-blue-600 border-t-2 border-slate-100">
                      <span className="font-black uppercase text-xs">Total Pasiva & Ekuitas</span>
                      <span className="font-black text-lg">
                        {formatRupiah(
                          balanceSheet.liabilities.reduce((s:any, x:any) => s + (x.balance || 0), 0) +
                          balanceSheet.equity.reduce((s:any, x:any) => s + (x.balance || 0), 0)
                        )}
                      </span>
                    </div>
                  </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drill-down Detail Modal */}
      <AnimatePresence>
        {detailModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setDetailModal(prev => ({ ...prev, show: false }))} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{detailModal.title}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Rincian Akun Penyusun</p>
                </div>
                <button 
                   onClick={() => setDetailModal(prev => ({ ...prev, show: false }))}
                   className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <ArrowRight className="rotate-45" size={20}/>
                </button>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {detailModal.items.length === 0 ? (
                  <div className="py-10 text-center text-slate-300 font-bold italic">Tidak ada data penyusun.</div>
                ) : (
                  detailModal.items.sort((a,b) => Math.abs(b.amount) - Math.abs(a.amount)).map((it: any) => (
                    <div key={it.code} className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black text-slate-400 font-mono tracking-tighter">{it.code}</p>
                        <p className="text-xs font-bold text-slate-700">{it.name}</p>
                      </div>
                      <div className={`text-sm font-black ${it.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {it.amount >= 0 ? '+' : ''}{formatRupiah(it.amount)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Kontribusi</span>
                <span className="text-lg font-black text-slate-900">
                  {formatRupiah(detailModal.items.reduce((s, x) => s + x.amount, 0))}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
