'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  BarChart,
  PieChart,
  ArrowRight,
  ChevronDown,
  Printer,
  Download,
  TrendingUp,
  Triangle,
  Layers,
  TrendingDown,
  Percent,
  Filter,
  ArrowUpRight,
  ExternalLink,
  BookOpen,
  Search,
  X,
  Loader2,
  Calendar,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatRupiah, formatDate, getDateInTimeZone } from '@/lib/utils'
import { resolveSourceDocumentLink, extractDocumentNumber } from '@/lib/utils/document-links'
import LineChart from '../contacts/_components/LineChart'
import type { CogsRevenueTrendRow } from '@/modules/accounting/actions/analytics.actions'
import { getAccountLedger, type AccountLedgerResult } from '@/modules/accounting/actions/journal.actions'

interface ReportsClientProps {
  orgId: string
  orgName: string
  branchId?: string | null
  isConsolidated?: boolean
  isParentOrg?: boolean
  balanceSheet: any
  profitLoss: any
  cogsTrend?: CogsRevenueTrendRow[]
  cashFlow: {
    ocf: number
    icf: number
    fcf: number
    netChange: number
    ocfItems?: CashFlowItem[]
    icfItems?: CashFlowItem[]
    fcfItems?: CashFlowItem[]
    netChangeTrend?: 'UP' | 'DOWN' | 'NEUTRAL'
    changePercent?: number
  }
}

type CashFlowItemDetail = {
  entryId: string
  entryDate: string | null
  amount: number
  description: string
  notes: string | null
  referenceType: string | null
  referenceLabel: string | null
}

type CashFlowItem = {
  code: string
  name: string
  amount: number
  details?: CashFlowItemDetail[]
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

function CogsRevenueChart({ data }: { data: CogsRevenueTrendRow[] }) {
  if (data.length === 0) return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
      <TrendingUp size={32} className="text-slate-200" />
      <p className="text-sm font-semibold text-slate-400">Belum ada data penjualan</p>
      <p className="text-[11px] text-slate-300">Data akan muncul setelah ada transaksi penjualan tercatat</p>
    </div>
  )

  const labels = data.map(r => r.month_label)
  const hasAnyCogs = data.some(r => r.cogs > 0)
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0)
  const totalCogs = data.reduce((s, r) => s + r.cogs, 0)
  const totalGp = totalRevenue - totalCogs
  const avgMargin = totalRevenue > 0 ? Math.round((totalGp / totalRevenue) * 100) : 0

  const last = data[data.length - 1]
  const prev = data[data.length - 2]
  const mom = prev?.revenue > 0
    ? Math.round(((last.revenue - prev.revenue) / prev.revenue) * 100)
    : null

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-50 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <TrendingUp size={15} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">COGS vs Revenue — 12 Bulan Terakhir</h3>
          </div>
          <p className="text-[11px] text-slate-400 pl-10">Tren pendapatan kotor vs harga pokok penjualan bulan per bulan</p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
            <TrendingUp size={12} className="text-emerald-600" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Revenue</span>
            <span className="text-[11px] font-bold text-emerald-700">{formatRupiah(totalRevenue)}</span>
          </div>
          {hasAnyCogs && (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              <TrendingDown size={12} className="text-rose-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">COGS</span>
              <span className="text-[11px] font-bold text-rose-700">{formatRupiah(totalCogs)}</span>
            </div>
          )}
          <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-2 ${totalGp >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}>
            <Percent size={12} className={totalGp >= 0 ? 'text-blue-600' : 'text-amber-600'} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gross Margin</span>
            <span className={`text-[11px] font-bold ${totalGp >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{avgMargin}%</span>
          </div>
          {mom !== null && (
            <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-2 ${mom >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <Triangle size={10} className={mom >= 0 ? 'text-emerald-600 fill-emerald-600' : 'text-rose-500 fill-rose-500 rotate-180'} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">MoM</span>
              <span className={`text-[11px] font-bold ${mom >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{mom >= 0 ? '+' : ''}{mom}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="px-6 pt-4 pb-6">
        <LineChart
          labels={labels}
          series={[
            { key: 'revenue', label: 'Revenue', color: '#10b981', values: data.map(r => r.revenue) },
            ...(hasAnyCogs ? [{ key: 'cogs', label: 'COGS (HPP)', color: '#f43f5e', values: data.map(r => r.cogs) }] : []),
            { key: 'gp', label: 'Gross Profit', color: '#3b82f6', values: data.map(r => r.gross_profit) },
          ]}
          height={200}
          formatValue={formatRupiah}
        />

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5 mt-4 pt-4 border-t border-slate-50">
          {[
            { color: '#10b981', label: 'Revenue' },
            ...(hasAnyCogs ? [{ color: '#f43f5e', label: 'COGS (HPP)' }] : []),
            { color: '#3b82f6', label: 'Gross Profit' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <svg width="24" height="10" className="shrink-0">
                <line x1="0" y1="5" x2="24" y2="5" stroke={s.color} strokeWidth="2" />
                <circle cx="12" cy="5" r="3" fill="white" stroke={s.color} strokeWidth="2" />
              </svg>
              {s.label}
            </div>
          ))}
          {!hasAnyCogs && (
            <span className="text-[10px] text-slate-300 italic">COGS = 0 — belum ada produk dengan average cost</span>
          )}
        </div>

        {/* Gross margin badges per month */}
        {data.some(r => r.revenue > 0) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {data.filter(r => r.revenue > 0).map(r => (
              <div key={r.month_key} className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${r.gross_margin >= 40 ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : r.gross_margin >= 20 ? 'bg-blue-50 text-blue-700 border-blue-100'
                  : r.gross_margin > 0 ? 'bg-amber-50 text-amber-700 border-amber-100'
                    : 'bg-rose-50 text-rose-700 border-rose-100'
                }`}>
                <span className="text-slate-400 font-medium">{r.month_label}</span>
                <span>{r.gross_margin}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReportsClient({
  orgId,
  orgName,
  branchId,
  balanceSheet,
  profitLoss,
  cashFlow,
  cogsTrend = [],
  isConsolidated,
  isParentOrg,
}: ReportsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const todayInJakarta = getDateInTimeZone('Asia/Jakarta')
  const currentMonthStart = `${todayInJakarta.slice(0, 7)}-01`

  const tabParam = (searchParams.get('tab') || '').trim().toUpperCase()
  const resolvedInitialTab: 'PL' | 'BS' | 'CF' =
    tabParam === 'BS' || tabParam === 'NERACA'
      ? 'BS'
      : tabParam === 'CF' || tabParam === 'CASHFLOW' || tabParam === 'ARUSKAS' || tabParam === 'ARUS-KAS'
      ? 'CF'
      : 'PL'

  const [activeTab, setActiveTab] = useState<'PL' | 'BS' | 'CF'>(resolvedInitialTab)

  // Sync activeTab when searchParams changes (e.g. browser back/forward or deep links)
  useEffect(() => {
    const nextTabParam = (searchParams.get('tab') || '').trim().toUpperCase()
    if (nextTabParam === 'BS' || nextTabParam === 'NERACA') {
      setActiveTab('BS')
    } else if (nextTabParam === 'CF' || nextTabParam === 'CASHFLOW' || nextTabParam === 'ARUSKAS' || nextTabParam === 'ARUS-KAS') {
      setActiveTab('CF')
    } else if (nextTabParam === 'PL' || nextTabParam === 'LABARUGI' || nextTabParam === 'LABA-RUGI') {
      setActiveTab('PL')
    }
  }, [searchParams])

  const handleTabChange = (newTab: 'PL' | 'BS' | 'CF') => {
    setActiveTab(newTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    const queryString = params.toString()
    const newUrl = `/reports${queryString ? `?${queryString}` : ''}`
    window.history.replaceState(null, '', newUrl)
  }

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
  const [detailModal, setDetailModal] = useState<{ show: boolean, title: string, items: CashFlowItem[] }>({
    show: false,
    title: '',
    items: []
  })

  // State for Account Ledger Drilldown Drawer
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<{
    code: string
    name: string
    balance: number
    type?: string
    id?: string
  } | null>(null)
  const [ledgerData, setLedgerData] = useState<AccountLedgerResult | null>(null)
  const [isLoadingLedger, setIsLoadingLedger] = useState(false)
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [showDrawerMoM, setShowDrawerMoM] = useState(false)

  const openAccountLedger = async (account: { code: string; name: string; balance: number; type?: string; id?: string }) => {
    setSelectedLedgerAccount(account)
    setIsLoadingLedger(true)
    setLedgerData(null)
    setLedgerSearch('')
    setShowDrawerMoM(false)

    try {
      const isBalanceSheet = activeTab === 'BS'
      const fromDate = isBalanceSheet ? undefined : (startDate || undefined)
      const toDate = endDate || undefined

      const data = await getAccountLedger(orgId, {
        account_id: account.id && account.id.includes('-') ? account.id : account.code,
        branch_id: branchId || undefined,
        status: 'POSTED',
        fromDate,
        toDate,
        limit: 200,
      })
      setLedgerData(data)
    } catch (err) {
      console.error('[openAccountLedger] Failed to fetch ledger:', err)
    } finally {
      setIsLoadingLedger(false)
    }
  }

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

  const renderBalanceHeader = () => (
    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wide pb-2 border-b border-slate-100">
      <span>Akun</span>
      <span className="w-24 text-right shrink-0">Saldo</span>
    </div>
  )

  const renderBalanceRows = (rows: BalanceTreeRow[]) => (
    rows.map((row) => (
      <div
        key={row.key}
        onClick={() => openAccountLedger({ code: row.code, name: row.name, balance: row.balance, id: row.key })}
        className="group flex justify-between items-center text-sm py-1 px-4 -mx-2 rounded-xl hover:bg-blue-50/70 border border-transparent hover:border-blue-100 transition-all cursor-pointer gap-3"
      >
        <div className="flex items-center min-w-0" style={{ paddingLeft: `${row.level * 18}px` }}>
          <span className="w-4 text-slate-300 text-xs">{row.level > 0 ? '-' : ''}</span>
          <span className="w-4 text-slate-400">{row.hasChildren ? <ChevronDown size={12} /> : ''}</span>
          <span className="text-[10px] font-mono text-slate-400 mr-2 group-hover:text-blue-600 transition-colors">{row.code}</span>
          <div className="min-w-0 flex items-center gap-2">
            <span className={`truncate ${row.hasChildren ? 'text-slate-700 font-bold' : 'text-slate-600 font-medium'} group-hover:text-blue-900 transition-colors`}>
              {row.name}
            </span>
            {row.isSystemComputed && (
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 border border-amber-100">
                Otomatis
              </span>
            )}
            <ArrowUpRight size={12} className="text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
          </div>
        </div>
        <span className="text-slate-900 font-bold w-24 text-right shrink-0 tabular-nums group-hover:text-blue-900 transition-colors">
          {formatRupiah(row.balance)}
        </span>
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
    params.set('tab', activeTab)
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
    params.set('tab', activeTab)
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

  const openDetail = (title: string, items: CashFlowItem[]) => {
    setDetailModal({ show: true, title, items })
  }

  return (
    <div className="flex flex-col gap-6 pb-20">

      {/* ── HERO BANNER — financial command center ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[#0d1e3d] to-[#0b1a35] text-white shadow-2xl print:hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-28 -right-28 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-12 w-60 h-60 rounded-full bg-indigo-600/10 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-5 px-6 pt-6 pb-5">
          {/* Row 1: Title + Controls */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${isParentOrg ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' : 'bg-orange-500/15 text-orange-300 border-orange-500/25'}`}>
                  {isParentOrg ? 'Holding · Induk' : 'Entitas Anak'}
                </span>
                {isConsolidated && (
                  <span className="inline-flex items-center rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                    Konsolidasi Aktif
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Laporan Keuangan</h1>
              <p className="text-[11px] text-slate-400">{orgName}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {activeTab === 'BS' ? (
                <div className="flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-2 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Per Tanggal</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => updateDates(startDate, e.target.value)}
                    className="text-xs font-semibold text-white bg-transparent outline-none cursor-pointer [color-scheme:dark]"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-2 rounded-xl">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => updateDates(e.target.value, endDate)}
                    className="text-xs font-semibold text-white bg-transparent outline-none cursor-pointer [color-scheme:dark]"
                  />
                  <ArrowRight size={11} className="text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => updateDates(startDate, e.target.value)}
                    className="text-xs font-semibold text-white bg-transparent outline-none cursor-pointer [color-scheme:dark]"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                title="Cetak"
                className="p-2.5 bg-white/10 border border-white/15 text-slate-300 hover:text-white hover:bg-white/20 rounded-xl transition-all cursor-pointer"
              >
                <Printer size={16} />
              </button>

              <button
                type="button"
                onClick={() => handleExport(activeTab === 'BS' ? 'bs' : activeTab === 'CF' ? 'gl' : 'pl')}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl border border-emerald-400/30 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download size={13} className={isExporting ? 'animate-bounce' : ''} />
                {isExporting ? 'Mengunduh...' : 'Export XLSX'}
              </button>

              <button
                type="button"
                onClick={() => setShowEmptyAccounts(!showEmptyAccounts)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${showEmptyAccounts ? 'bg-white/20 text-white border-white/25' : 'bg-white/[0.08] text-slate-400 border-white/10 hover:bg-white/15 hover:text-slate-200'}`}
              >
                <Filter size={13} />
                {showEmptyAccounts ? 'Saldo 0: Tampil' : 'Saldo 0: Sembunyi'}
              </button>

              {isParentOrg && (
                <button
                  type="button"
                  onClick={toggleConsolidated}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${isConsolidated ? 'bg-indigo-500 text-white border-indigo-400/40 shadow-md shadow-indigo-900/40' : 'bg-white/10 text-slate-300 border-white/15 hover:bg-white/20'}`}
                >
                  <Layers size={13} />
                  {isConsolidated ? 'Konsolidasi: ON' : 'Konsolidasi: OFF'}
                </button>
              )}
            </div>
          </div>

          {/* Row 2: KPI Summary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {[
              { label: 'Revenue', value: profitLoss.totalRevenue ?? 0, icon: <TrendingUp size={13} />, accent: 'text-emerald-300' },
              { label: 'Total Beban', value: profitLoss.totalExpenses ?? 0, icon: <TrendingDown size={13} />, accent: 'text-rose-300' },
              { label: 'Laba Bersih', value: profitLoss.netProfit ?? 0, icon: <BarChart size={13} />, accent: (profitLoss.netProfit ?? 0) >= 0 ? 'text-blue-300' : 'text-red-300' },
              { label: 'Total Aset', value: (balanceSheet.assets ?? []).reduce((s: number, x: any) => s + (x.balance || 0), 0), icon: <PieChart size={13} />, accent: 'text-violet-300' },
              { label: 'Arus Kas Operasi', value: cashFlow.ocf ?? 0, icon: <Triangle size={13} />, accent: (cashFlow.ocf ?? 0) >= 0 ? 'text-sky-300' : 'text-amber-300' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white/[0.08] border border-white/10 rounded-xl px-4 py-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={kpi.accent}>{kpi.icon}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{kpi.label}</span>
                </div>
                <span className="text-sm font-bold text-white leading-tight">{formatRupiah(kpi.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── COGS & REVENUE — analytics selalu tampil ── */}
      <CogsRevenueChart data={cogsTrend} />

      {/* ── LAPORAN FORMAL — 3 tab ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
            {([
              { key: 'PL', label: 'Laba Rugi', icon: <BarChart size={14} /> },
              { key: 'BS', label: 'Neraca', icon: <PieChart size={14} /> },
              { key: 'CF', label: 'Arus Kas', icon: <TrendingUp size={14} /> },
            ] as const).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.key ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400 font-medium hidden md:block">
            {activeTab === 'BS' ? `Per Tanggal: ${formatDate(endDate)}` : `${formatDate(startDate)} — ${formatDate(endDate)}`}
          </span>
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
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <BarChart size={18} className="text-blue-500" /> Laporan Laba Rugi
                  </h3>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Periode: {formatDate(startDate)} — {formatDate(endDate)}
                  </div>
                </div>

                <div className="p-8 space-y-10">
                  {/* Revenue Section */}
                  <motion.div variants={item} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Pendapatan</span>
                      <span className="text-sm font-bold text-emerald-600 tabular-nums">{formatRupiah(profitLoss.totalRevenue)}</span>
                    </div>
                    <div className="space-y-1">
                      {profitLoss.revenue.filter((r: any) => showEmptyAccounts || Math.abs(r.balance) > 0.01).map((r: any) => (
                        <div
                          key={r.code}
                          onClick={() => openAccountLedger(r)}
                          className="group flex justify-between items-center text-sm px-3 py-2 rounded-xl hover:bg-blue-50/70 border border-transparent hover:border-blue-100 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-700 font-medium group-hover:text-blue-700 transition-colors truncate">
                              {r.code} - {r.name}
                            </span>
                            <ArrowUpRight size={13} className="text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                          </div>
                          <span className="text-slate-900 font-bold tabular-nums group-hover:text-blue-900 transition-colors shrink-0 ml-3">
                            {formatRupiah(r.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Expenses Section */}
                  <motion.div variants={item} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Beban & Biaya Operasional</span>
                      <span className="text-sm font-bold text-rose-600 tabular-nums">({formatRupiah(profitLoss.totalExpenses)})</span>
                    </div>
                    <div className="space-y-1">
                      {profitLoss.expenses.filter((e: any) => showEmptyAccounts || Math.abs(e.balance) > 0.01).map((e: any) => (
                        <div
                          key={e.code}
                          onClick={() => openAccountLedger(e)}
                          className="group flex justify-between items-center text-sm px-3 py-2 rounded-xl hover:bg-rose-50/70 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-700 font-medium group-hover:text-rose-700 transition-colors truncate">
                              {e.code} - {e.name}
                            </span>
                            <ArrowUpRight size={13} className="text-slate-300 group-hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                          </div>
                          <span className="text-slate-900 font-bold tabular-nums group-hover:text-rose-900 transition-colors shrink-0 ml-3">
                            {formatRupiah(e.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Summary Section */}
                  <motion.div variants={item} className="pt-8 border-t-2 border-slate-900 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xl font-semibold text-slate-900 uppercase">Laba (Rugi) Bersih</span>
                      <span className="text-xs text-slate-400 font-medium italic">Net Income for the period</span>
                    </div>
                    <div className={`px-6 py-3 rounded-xl text-2xl font-semibold ${profitLoss.netProfit >= 0 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-rose-500 text-white shadow-lg shadow-rose-200'}`}>
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
                    title: 'Operating (OCF - Direct)',
                    value: cashFlow.ocf,
                    icon: TrendingUp,
                    color: 'text-emerald-500',
                    hint: 'Arus kas operasional langsung dari jurnal kas/bank.',
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
                      <div className={`w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center ${m.color}`}>
                        <m.icon size={24} />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 px-3 py-1 rounded-full">{m.metric}</span>
                    </div>
                    <div className="space-y-1 relative z-10">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{m.title}</p>
                      <h4 className={`text-2xl font-semibold ${m.value >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                        {formatRupiah(m.value)}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed h-8">{m.hint}</p>
                    </div>
                    <div className="pt-2 relative z-10">
                      <button type="button"
                        onClick={() => openDetail(m.title, m.items || [])}
                        className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-semibold uppercase tracking-tighter flex items-center justify-center gap-2 transition-all border border-slate-100 hover:border-slate-200"
                      >
                        Lihat Rincian <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900 rounded-xl p-5 text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative shadow-md shadow-blue-500/20">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] -mr-40 -mt-40" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -ml-20 -mb-20" />

                <div className="relative z-10 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-3xl font-semibold tracking-tight">Net Cash Flow</h3>
                    <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-semibold shadow-sm ${cashFlow.netChangeTrend === 'UP' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                      <Triangle
                        size={10}
                        fill="currentColor"
                        className={`${cashFlow.netChangeTrend === 'UP' ? '' : 'rotate-180'} transition-transform duration-500`}
                      />
                      <span>{cashFlow.netChangeTrend === 'UP' ? 'NAIK' : 'TURUN'} {Math.abs(cashFlow.changePercent || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 font-medium font-mono opacity-80 uppercase tracking-wide">Total liquidity changes for current period</p>
                </div>

                <div className="relative z-10 text-5xl font-semibold tracking-tighter text-blue-400 flex flex-col items-end gap-1">
                  {formatRupiah(cashFlow.netChange)}
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide opacity-60">Real-time Balance Match</div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-600" />
                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-8 flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" /> Insight & Analisis Kinerja
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 rounded-[32px] bg-slate-50 border border-slate-100 space-y-4 hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-semibold text-xs">A</div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kualitas Laba vs Kas</p>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">
                      {cashFlow.ocf > profitLoss.netProfit ?
                        "Sangat Baik: Kas operasional lebih besar dari laba bersih. Bisnis memiliki kualitas laba yang tinggi karena pendapatan benar-benar cair menjadi uang tunai." :
                        "Waspada: Laba bersih di atas kertas belum sepenuhnya cair menjadi kas. Periksa piutang Anda atau stok yang menumpuk."}
                    </p>
                  </div>
                  <div className="p-8 rounded-[32px] bg-slate-50 border border-slate-100 space-y-4 hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-semibold text-xs">B</div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Arah Investasi</p>
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
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wide">Aktiva (Aset)</h3>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{formatDate(endDate)}</div>
                  </div>
                  <div className="p-8 space-y-3">
                    {renderBalanceHeader()}
                    {renderBalanceRows(assetTreeRows)}
                    <div className="flex justify-between items-center pt-4 pr-12 text-emerald-600">
                      <span className="font-semibold uppercase text-xs">Total Aktiva</span>
                      <span className="font-semibold text-lg w-24 text-right shrink-0">{formatRupiah(balanceSheet.assets.reduce((s: any, x: any) => s + (x.balance || 0), 0))}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Liability & Equity Side */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-400 text-xs uppercase tracking-wide">Kewajiban & Ekuitas</h3>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{formatDate(endDate)}</div>
                  </div>
                  <div className="p-8 space-y-6">
                    {renderBalanceHeader()}
                    {/* Liabilities */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Pasiva / Hutang</p>
                      {renderBalanceRows(liabilityTreeRows)}
                    </div>
                    {/* Equity */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Modal</p>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                        Akun <span className="font-mono font-semibold">3002</span> menampung laba/rugi periode lampau atau periode yang sudah ditutup, sedangkan <span className="font-mono font-semibold">3003</span> menampung laba/rugi periode berjalan. Beban utilitas tetap dicatat di laba rugi, lalu dampaknya mengurangi laba periode berjalan di neraca.
                      </p>
                      {renderBalanceRows(equityTreeRows)}
                    </div>

                    <div className="flex justify-between items-center pt-6 pr-10 text-blue-600 border-t-2 border-slate-100">
                      <span className="font-semibold uppercase text-xs">Total Pasiva & Ekuitas</span>
                      <span className="font-semibold text-lg w-24 text-right shrink-0">
                        {formatRupiah(
                          balanceSheet.liabilities.reduce((s: any, x: any) => s + (x.balance || 0), 0) +
                          balanceSheet.equity.reduce((s: any, x: any) => s + (x.balance || 0), 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
              className="relative w-full max-w-lg bg-white rounded-xl shadow-md p-5 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">{detailModal.title}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Rincian Arus Kas Langsung</p>
                </div>
                <button type="button"
                  onClick={() => setDetailModal(prev => ({ ...prev, show: false }))}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <ArrowRight className="rotate-45" size={20} />
                </button>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {detailModal.items.length === 0 ? (
                  <div className="py-10 text-center text-slate-300 font-bold italic">Tidak ada data penyusun.</div>
                ) : (
                  [...detailModal.items]
                    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                    .map((it) => (
                      <div key={`${it.code}-${it.name}`} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-semibold text-slate-400 font-mono tracking-tighter">{it.code}</p>
                            <p className="text-xs font-bold text-slate-700">{it.name}</p>
                          </div>
                          <div className={`shrink-0 text-sm font-semibold ${it.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {it.amount >= 0 ? '+' : ''}{formatRupiah(it.amount)}
                          </div>
                        </div>

                        {Array.isArray(it.details) && it.details.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                            {it.details.map((detail) => (
                              <div key={`${it.code}-${detail.entryId}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {detail.referenceLabel && (
                                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                                          {detail.referenceLabel}
                                        </span>
                                      )}
                                      {detail.entryDate && (
                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                          {formatDate(detail.entryDate, 'short')}
                                        </span>
                                      )}
                                      {!detail.referenceLabel && detail.referenceType && (
                                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                                          {detail.referenceType.replaceAll('_', ' ')}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] font-bold leading-relaxed text-slate-700">{detail.description}</p>
                                    {detail.notes && (
                                      <p className="text-[10px] font-medium leading-relaxed text-slate-500">{detail.notes}</p>
                                    )}
                                  </div>
                                  <div className={`shrink-0 text-[11px] font-semibold ${detail.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {detail.amount >= 0 ? '+' : ''}{formatRupiah(detail.amount)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>

              <div className="mt-8 pt-6 pr-10 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Kontribusi</span>
                <span className="text-lg font-semibold text-slate-900">
                  {formatRupiah(detailModal.items.reduce((s, x) => s + x.amount, 0))}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ACCOUNT LEDGER DRILLDOWN DRAWER ── */}
      <AnimatePresence>
        {selectedLedgerAccount && (
          <div className="fixed inset-0 z-50 overflow-hidden print:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedLedgerAccount(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            {/* Drawer Panel */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200"
              >
                {/* Drawer Header */}
                <div className="p-6 bg-slate-50/80 border-b border-slate-200/80 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-100/80 text-blue-800 font-mono text-xs font-bold">
                        {selectedLedgerAccount.code}
                      </span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {selectedLedgerAccount.type || (activeTab === 'PL' ? 'Laba Rugi' : 'Neraca')}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">
                      {selectedLedgerAccount.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 pt-1">
                      <Calendar size={13} className="text-slate-400" />
                      <span>
                        {activeTab === 'BS'
                          ? `Posisi Saldo s/d ${formatDate(endDate)}`
                          : `Periode: ${formatDate(startDate)} — ${formatDate(endDate)}`}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams()
                        params.set('accountCode', selectedLedgerAccount.code)
                        if (activeTab !== 'BS' && startDate) params.set('startDate', startDate)
                        if (endDate) params.set('endDate', endDate)
                        router.push(`/accounting/journal?${params.toString()}`)
                      }}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      title="Buka di Menu Buku Besar Penuh"
                    >
                      <BookOpen size={14} />
                      <span className="hidden sm:inline">Buku Besar Penuh</span>
                      <ExternalLink size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLedgerAccount(null)}
                      className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* KPI Summary & Net Movement Badge */}
                {ledgerData && (() => {
                  const normalBalance = ledgerData.account?.normal_balance || (
                    ['REVENUE', 'LIABILITY', 'EQUITY'].includes(selectedLedgerAccount.type || '') ||
                      ['2', '3', '4', '7', '8'].includes(selectedLedgerAccount.code[0])
                      ? 'CREDIT'
                      : 'DEBIT'
                  )
                  const netMovement = normalBalance === 'CREDIT'
                    ? ledgerData.summary.totalCredit - ledgerData.summary.totalDebit
                    : ledgerData.summary.totalDebit - ledgerData.summary.totalCredit

                  return (
                    <div className="border-b border-slate-200/80 bg-slate-50/60">
                      {/* Primary Net Mutation Highlight Banner Badge */}
                      <div className="px-6 py-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50/50 border-b border-blue-100/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                              Mutasi Bersih Periode Ini
                            </span>
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full w-fit">
                              {activeTab === 'BS' ? `Posisi s/d ${formatDate(endDate)}` : `Laba Rugi (${formatDate(startDate, 'short')} — ${formatDate(endDate, 'short')})`}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowDrawerMoM(!showDrawerMoM)}
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${showDrawerMoM ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                              📊 {showDrawerMoM ? 'Tutup Varians' : 'Bandingkan Periode Lalu'}
                            </button>
                          </div>
                        </div>
                        <span className={`text-base font-extrabold tabular-nums ${netMovement >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                          {formatRupiah(netMovement)}
                        </span>
                      </div>

                      {/* MoM Variance Comparison Box */}
                      {showDrawerMoM && (
                        <div className="px-6 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between gap-4 text-xs">
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Selisih Arus vs Saldo Awal (Δ)</span>
                            <span className="font-extrabold text-slate-900 tabular-nums">
                              {formatRupiah(Math.abs(netMovement - ledgerData.summary.openingBalance))}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Dinamika Aliran</span>
                            <span className={`font-extrabold tabular-nums ${netMovement >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {netMovement >= 0 ? '▲ Arus Masuk' : '▼ Arus Keluar'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Breakdown KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200/70 text-xs">
                        <div className="p-4 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Saldo Awal</span>
                          <p className="font-bold text-slate-800 tabular-nums">{formatRupiah(ledgerData.summary.openingBalance)}</p>
                        </div>
                        <div className="p-4 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Debit</span>
                          <p className="font-bold text-emerald-600 tabular-nums">+{formatRupiah(ledgerData.summary.totalDebit)}</p>
                        </div>
                        <div className="p-4 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Kredit</span>
                          <p className="font-bold text-rose-600 tabular-nums">-{formatRupiah(ledgerData.summary.totalCredit)}</p>
                        </div>
                        <div className="p-4 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Saldo Akhir</span>
                          <p className={`font-extrabold tabular-nums ${ledgerData.summary.endingBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                            {formatRupiah(ledgerData.summary.endingBalance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Search Input Filter */}
                <div className="p-4 border-b border-slate-100 bg-white">
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      placeholder="Cari deskripsi, no. jurnal, atau lawan akun..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                    />
                    {ledgerSearch && (
                      <button
                        type="button"
                        onClick={() => setLedgerSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Transaction List Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar bg-slate-50/30">
                  {isLoadingLedger ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 size={28} className="animate-spin text-blue-500" />
                      <p className="text-xs font-semibold">Mengambil rincian mutasi buku besar...</p>
                    </div>
                  ) : !ledgerData || ledgerData.rows.length === 0 ? (
                    <div className="py-20 text-center space-y-2">
                      <p className="text-sm font-bold text-slate-600">Tidak ada mutasi jurnal</p>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        Belum ada transaksi jurnal berstatus POSTED yang tercatat untuk akun ini pada periode yang dipilih.
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const filteredRows = ledgerData.rows.filter((r) => {
                        if (!ledgerSearch.trim()) return true
                        const q = ledgerSearch.toLowerCase()
                        return (
                          r.description?.toLowerCase().includes(q) ||
                          r.entry_number?.toLowerCase().includes(q) ||
                          r.counterparty_accounts?.toLowerCase().includes(q) ||
                          r.memo?.toLowerCase().includes(q)
                        )
                      })

                      if (filteredRows.length === 0) {
                        return (
                          <div className="py-12 text-center text-xs text-slate-400 italic">
                            Tidak ada transaksi yang cocok dengan pencarian "{ledgerSearch}".
                          </div>
                        )
                      }

                      return filteredRows.map((row) => {
                        const docLink = resolveSourceDocumentLink(row.reference_type, row.reference_id, row.description, row.memo)
                        const docCode = docLink?.documentCode || extractDocumentNumber(row.description)

                        return (
                          <div
                            key={row.line_id}
                            className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-blue-200 hover:shadow-xs transition-all space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900">
                                    {row.entry_date ? formatDate(row.entry_date, 'short') : '-'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                                    {row.entry_number}
                                  </span>
                                  {row.reference_type && (
                                    docLink ? (
                                      <a
                                        href={docLink.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 text-[9px] font-semibold uppercase tracking-wider border border-amber-200 shadow-2xs transition-all cursor-pointer"
                                        title={`Buka Dokumen di Modul ${docLink.module}`}
                                      >
                                        <span>{row.reference_type.replaceAll('_', ' ')}</span>
                                        <ExternalLink size={9} className="text-amber-600" />
                                      </a>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[9px] font-semibold uppercase tracking-wider border border-amber-100">
                                        {row.reference_type.replaceAll('_', ' ')}
                                      </span>
                                    )
                                  )}
                                </div>
                                <div className="text-xs font-semibold text-slate-700 flex items-center flex-wrap gap-1.5 leading-snug">
                                  <span>{row.description || '-'}</span>
                                  {docLink && docCode && (
                                    <a
                                      href={docLink.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200/80 shadow-2xs transition-all cursor-pointer"
                                      title={`Buka Dokumen ${docCode} di Modul ${docLink.module}`}
                                    >
                                      <span>{docCode}</span>
                                      <ExternalLink size={9} className="text-emerald-600" />
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Saldo</span>
                                <span className={`text-xs font-extrabold tabular-nums ${row.running_balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                  {formatRupiah(row.running_balance)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                              <div className="text-[11px] text-slate-500 font-medium truncate max-w-[240px]">
                                <span className="text-slate-400 font-semibold">Lawan:</span> {row.counterparty_accounts || '-'}
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {row.debit > 0 && (
                                  <span className="text-emerald-600 font-bold tabular-nums">
                                    +D: {formatRupiah(row.debit)}
                                  </span>
                                )}
                                {row.credit > 0 && (
                                  <span className="text-rose-600 font-bold tabular-nums">
                                    -K: {formatRupiah(row.credit)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()
                  )}
                </div>

                {/* Drawer Footer */}
                {ledgerData && ledgerData.rows.length > 0 && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                    <span className="font-semibold">
                      Menampilkan {ledgerData.rows.length} dari {ledgerData.summary.rowCount} transaksi
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedLedgerAccount(null)}
                      className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
