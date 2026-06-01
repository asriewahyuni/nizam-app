'use client'

import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import { motion } from 'framer-motion'
import { DollarSign, TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon, BarChart3, ArrowRight } from 'lucide-react'
import type { DashboardFinancialData, MonthlySnapshot, ExpenseCategory } from '@/modules/accounting/actions/financial-dashboard.actions'
import { formatRupiah } from '@/lib/utils'
import Link from 'next/link'

interface Props {
  data: DashboardFinancialData
  orgId: string
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

function formatShortRupiah(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `Rp${(n / 1_000_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(1)}jt`
  if (Math.abs(n) >= 1_000) return `Rp${(n / 1_000).toFixed(0)}rb`
  return `Rp${n}`
}

function StatCard({ title, value, icon: Icon, color, trend }: {
  title: string
  value: string
  icon: React.ElementType
  color: string
  trend?: { label: string; up: boolean }
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-tight text-slate-400 uppercase">{title}</p>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
          {trend && (
            <div className="flex items-center gap-1">
              {trend.up ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              )}
              <span className="text-[10px] font-medium text-slate-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </motion.div>
  )
}

function MonthlyBarChart({ data }: { data: MonthlySnapshot[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Revenue vs Expense</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">6 bulan terakhir</p>
        </div>
        <BarChart3 className="w-4 h-4 text-slate-300" />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4}>
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatShortRupiah(v)} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(v: number) => formatRupiah(v)}
            />
            <Bar dataKey="revenue" name="Pendapatan" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Biaya" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ProfitLineChart({ data }: { data: MonthlySnapshot[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Trend Laba Bersih</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">6 bulan terakhir</p>
        </div>
        <TrendingUp className="w-4 h-4 text-slate-300" />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatShortRupiah(v)} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(v: number) => formatRupiah(v)}
            />
            <Line type="monotone" dataKey="profit" name="Laba Bersih" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ExpensePieChart({ data }: { data: ExpenseCategory[] }) {
  const top6 = data.slice(0, 6)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Komposisi Biaya</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Bulan ini</p>
        </div>
        <PieChartIcon className="w-4 h-4 text-slate-300" />
      </div>
      {top6.length > 0 ? (
        <div className="flex items-center gap-6">
          <div className="w-40 h-40 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={top6} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2}>
                  {top6.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            {top6.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] text-slate-600 truncate flex-1">{item.name}</span>
                <span className="text-[10px] font-semibold text-slate-900">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center">
          <p className="text-xs text-slate-400">Belum ada data biaya bulan ini</p>
        </div>
      )}
    </div>
  )
}

function CashFlowCard({ cf }: { cf: DashboardFinancialData['cashFlow'] }) {
  const items = [
    { label: 'Operating', amount: cf.operating, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Investing', amount: cf.investing, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Financing', amount: cf.financing, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Arus Kas</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Bulan ini</p>
        </div>
        <Wallet className="w-4 h-4 text-slate-300" />
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${item.bg}`}>
              <span className="text-[9px] font-semibold tracking-tight uppercase">{item.label}</span>
            </div>
            <span className={`text-xs font-bold ${item.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatShortRupiah(item.amount)}
            </span>
          </div>
        ))}
        <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Net Cash Flow</span>
          <span className={`text-sm font-bold ${cf.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatShortRupiah(cf.netCashFlow)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function FinancialDashboardClient({ data, orgId }: Props) {
  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 rounded-xl bg-white shadow-sm border border-slate-100">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Dashboard Keuangan</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Ringkasan performa keuangan bisnis Anda</p>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pendapatan"
          value={formatShortRupiah(data.currentMonth.revenue)}
          icon={TrendingUp}
          color="bg-blue-500"
          trend={{ label: 'Bulan ini', up: data.currentMonth.revenue >= 0 }}
        />
        <StatCard
          title="Biaya"
          value={formatShortRupiah(data.currentMonth.expenses)}
          icon={TrendingDown}
          color="bg-red-500"
        />
        <StatCard
          title="Laba Bersih"
          value={formatShortRupiah(data.currentMonth.netProfit)}
          icon={DollarSign}
          color="bg-emerald-500"
          trend={{ label: data.currentMonth.netProfit >= 0 ? 'Untung' : 'Rugi', up: data.currentMonth.netProfit >= 0 }}
        />
        <StatCard
          title="Saldo Kas"
          value={formatShortRupiah(data.currentMonth.cashBalance)}
          icon={Wallet}
          color="bg-purple-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyBarChart data={data.monthlyTrend} />
        <ProfitLineChart data={data.monthlyTrend} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ExpensePieChart data={data.expenseBreakdown} />
        <CashFlowCard cf={data.cashFlow} />
        
        {/* Quick Links */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Laporan Lainnya</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Akses cepat</p>
            </div>
          </div>
          <div className="space-y-2">
            <QuickLink href="/accounting/ratios" label="Rasio Keuangan" desc="11 rasio likuiditas, solvabilitas, profitabilitas" />
            <QuickLink href="/accounting/aging" label="Aging AR/AP" desc="Piutang & utang berdasarkan umur" />
            <QuickLink href="/accounting/budgets" label="Anggaran" desc="Budget vs actual" />
            <QuickLink href="/accounting/tax" label="Manajemen Pajak" desc="PPN, SPT, e-Faktur" />
            <QuickLink href="/accounting/forecast" label="Proyeksi Kas" desc="Forecast arus kas" />
            <QuickLink href="/accounting/journal" label="Buku Besar" desc="Semua transaksi" />
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group"
    >
      <div>
        <p className="text-xs font-semibold text-slate-900">{label}</p>
        <p className="text-[9px] text-slate-400 mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 transition-colors" />
    </Link>
  )
}
