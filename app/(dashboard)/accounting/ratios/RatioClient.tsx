'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  CalendarRange,
  DollarSign,
  CreditCard,
  Scale,
  Droplets,
  Zap,
  Eye,
  BarChart3
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts'

type RatioValue = {
  value: number
  label: string
  healthy: boolean
  min: number
  max: number
}

export interface FinancialRatios {
  currentRatio: RatioValue
  quickRatio: RatioValue
  cashRatio: RatioValue
  debtToEquity: RatioValue
  debtToAssets: RatioValue
  equityRatio: RatioValue
  grossProfitMargin: RatioValue
  netProfitMargin: RatioValue
  returnOnAssets: RatioValue
  returnOnEquity: RatioValue
  operatingExpenseRatio: RatioValue
  raw: {
    totalAssets: number
    currentAssets: number
    nonCurrentAssets: number
    totalLiabilities: number
    currentLiabilities: number
    nonCurrentLiabilities: number
    totalEquity: number
    totalRevenue: number
    grossProfit: number
    netProfit: number
    operatingExpenses: number
    cashAndEquivalents: number
    inventory: number
  }
  period: { startDate: string; endDate: string }
}

interface Props {
  initialData: FinancialRatios
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 },
}

function getStatusColor(healthy: boolean) {
  return healthy
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : 'bg-amber-50 border-amber-200 text-amber-700'
}

function RatioGauge({ ratio, maxBar }: { ratio: RatioValue; maxBar: number }) {
  const pct = maxBar > 0 ? Math.min((ratio.value / maxBar) * 100, 100) : 0
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${
          ratio.healthy ? 'bg-emerald-500' : 'bg-amber-400'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function RatioClient({ initialData }: Props) {
  const [ratios] = useState<FinancialRatios>(initialData)
  const [activeCategory, setActiveCategory] = useState<string>('LIQUIDITY')

  const categories = [
    { key: 'LIQUIDITY', label: 'Likuiditas', icon: Droplets, desc: 'Kemampuan bayar hutang jangka pendek' },
    { key: 'SOLVENCY', label: 'Solvabilitas', icon: Scale, desc: 'Kemampuan bayar semua hutang' },
    { key: 'PROFITABILITY', label: 'Profitabilitas', icon: TrendingUp, desc: 'Kemampuan menghasilkan laba' },
    { key: 'EFFICIENCY', label: 'Efisiensi', icon: Zap, desc: 'Efektivitas pengelolaan biaya' },
  ]

  const liquidityRatios = [ratios.currentRatio, ratios.quickRatio, ratios.cashRatio]
  const solvencyRatios = [ratios.debtToEquity, ratios.debtToAssets, ratios.equityRatio]
  const profitabilityRatios = [ratios.grossProfitMargin, ratios.netProfitMargin, ratios.returnOnAssets, ratios.returnOnEquity]
  const efficiencyRatios = [ratios.operatingExpenseRatio]

  const activeRatios = activeCategory === 'LIQUIDITY' ? liquidityRatios
    : activeCategory === 'SOLVENCY' ? solvencyRatios
    : activeCategory === 'PROFITABILITY' ? profitabilityRatios
    : efficiencyRatios

  const chartData = [
    { name: 'Current Ratio', value: ratios.currentRatio.value, healthy: ratios.currentRatio.healthy, unit: 'x' },
    { name: 'Quick Ratio', value: ratios.quickRatio.value, healthy: ratios.quickRatio.healthy, unit: 'x' },
    { name: 'DER', value: ratios.debtToEquity.value, healthy: ratios.debtToEquity.healthy, unit: 'x' },
    { name: 'GPM', value: ratios.grossProfitMargin.value, healthy: ratios.grossProfitMargin.healthy, unit: '%' },
    { name: 'NPM', value: ratios.netProfitMargin.value, healthy: ratios.netProfitMargin.healthy, unit: '%' },
    { name: 'ROA', value: ratios.returnOnAssets.value, healthy: ratios.returnOnAssets.healthy, unit: '%' },
    { name: 'ROE', value: ratios.returnOnEquity.value, healthy: ratios.returnOnEquity.healthy, unit: '%' },
  ]

  const healthyCount = Object.entries(ratios)
    .filter(([k]) => !['raw', 'period'].includes(k))
    .filter(([, v]) => (v as RatioValue).healthy !== undefined)
    .filter(([, v]) => (v as RatioValue).healthy).length
  const totalRatios = Object.entries(ratios)
    .filter(([k]) => !['raw', 'period'].includes(k))
    .filter(([, v]) => (v as RatioValue).healthy !== undefined).length

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight flex items-center gap-4">
            <Activity size={40} className="text-violet-500" />
            Rasio Keuangan
          </h1>
          <p className="text-slate-500 font-medium text-lg">Analisis kesehatan finansial lewat 11 rasio standar akuntansi.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-bold bg-white px-4 py-2 rounded-xl border border-slate-100">
          <CalendarRange size={14} />
          {ratios.period.startDate} — {ratios.period.endDate}
        </div>
      </motion.div>

      {/* Health Score */}
      <motion.div variants={item} className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-tight">Skor Kesehatan</p>
            <p className="text-5xl font-semibold text-slate-900 tracking-tight">
              {healthyCount}/{totalRatios}
            </p>
            <p className="text-sm text-slate-500 font-medium">
              {healthyCount === totalRatios ? 'Semua rasio dalam batas sehat 💪' :
               healthyCount >= totalRatios * 0.7 ? 'Mayoritas sehat, beberapa perlu perhatian' :
               'Perlu evaluasi finansial menyeluruh'}
            </p>
          </div>
          <div className="hidden md:block">
            <Droplets size={48} className="text-violet-200" />
          </div>
        </div>
      </motion.div>

      {/* Summary Cards — Raw Data */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-400">
            <DollarSign size={16} />
            <span className="text-[10px] font-semibold tracking-tight">Total Aset</span>
          </div>
          <p className="text-2xl font-semibold text-slate-900 font-mono">{formatRupiah(ratios.raw.totalAssets)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-400">
            <CreditCard size={16} />
            <span className="text-[10px] font-semibold tracking-tight">Total Hutang</span>
          </div>
          <p className="text-2xl font-semibold text-slate-900 font-mono">{formatRupiah(ratios.raw.totalLiabilities)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-400">
            <Scale size={16} />
            <span className="text-[10px] font-semibold tracking-tight">Total Ekuitas</span>
          </div>
          <p className="text-2xl font-semibold text-slate-900 font-mono">{formatRupiah(ratios.raw.totalEquity)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-400">
            <TrendingUp size={16} />
            <span className="text-[10px] font-semibold tracking-tight">Laba Bersih</span>
          </div>
          <p className={`text-2xl font-semibold font-mono ${ratios.raw.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatRupiah(ratios.raw.netProfit)}
          </p>
        </div>
      </motion.div>

      {/* Category Tabs */}
      <motion.div variants={item} className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => {
          const Icon = cat.icon
          return (
            <button type="button"
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
                activeCategory === cat.key
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                  : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-300'
              }`}
            >
              <Icon size={18} />
              {cat.label}
            </button>
          )
        })}
      </motion.div>

      {/* Active Category Ratio Cards */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeRatios.map((ratio, idx) => {
          const isPercent = ratio.label.includes('Margin') || ratio.label.includes('RO') || ratio.label.includes('Rasio Beban')
          const unit = isPercent ? '%' : 'x'

          return (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-tight">{ratio.label}</h4>
                  <p className="text-3xl font-semibold text-slate-900 font-mono tracking-tight mt-1">
                    {ratio.value}{unit}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-xl text-[10px] font-semibold flex items-center gap-1 ${getStatusColor(ratio.healthy)}`}>
                  {ratio.healthy ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  {ratio.healthy ? 'SEHAT' : 'WASPADA'}
                </div>
              </div>

              <RatioGauge ratio={ratio} maxBar={Math.max(ratio.max, ratio.value * 1.2)} />

              <div className="flex justify-between text-[11px] font-bold text-slate-400">
                <span>Min: {ratio.min}{unit}</span>
                <span>Max: {ratio.max}{unit}</span>
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* Bar Chart Summary */}
      <motion.div variants={item} className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={20} className="text-violet-500" />
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-tight">Ringkasan Rasio</h3>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                angle={-30}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
                formatter={(value: any, _name: any, props: any) => {
                  const u = props.payload?.unit || ''
                  return [`${value}${u}`, props.payload?.name]
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={50}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.healthy ? '#10b981' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Interpretation */}
      <motion.div variants={item} className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-100 p-8 space-y-4">
        <div className="flex items-center gap-3">
          <Eye size={20} className="text-violet-600" />
          <h3 className="text-sm font-semibold text-violet-900 uppercase tracking-tight">Interpretasi</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-medium text-slate-600 leading-relaxed">
          <div className="space-y-3">
            <p>
              <strong className="text-slate-900">Likuiditas:</strong>{' '}
              {ratios.currentRatio.healthy
                ? 'Rasio lancar dalam batas sehat (1.5x-3x). Bisnis mampu bayar kewajiban jangka pendek.'
                : `Rasio lancar ${ratios.currentRatio.value}x — ${ratios.currentRatio.value < 1.5 ? 'di bawah standar. Likuiditas perlu diperkuat.' : 'di atas standar. Kas terlalu banyak menganggur.'}`}
            </p>
            <p>
              <strong className="text-slate-900">Solvabilitas:</strong>{' '}
              {ratios.debtToEquity.healthy
                ? 'DER dalam batas wajar (0-2x). Struktur modal sehat.'
                : `DER ${ratios.debtToEquity.value}x — ${ratios.debtToEquity.value > 2 ? 'terlalu tinggi. Risiko gagal bayar meningkat.' : 'rendah. Kurang memanfaatkan utang untuk ekspansi.'}`}
            </p>
          </div>
          <div className="space-y-3">
            <p>
              <strong className="text-slate-900">Profitabilitas:</strong>{' '}
              {ratios.netProfitMargin.healthy
                ? 'Margin laba bersih sehat (5-25%). Bisnis efisien dan menguntungkan.'
                : `NPM ${ratios.netProfitMargin.value}% — ${ratios.netProfitMargin.value < 5 ? 'tipis. Evaluasi struktur biaya dan pricing.' : 'di atas rata-rata. Performa bagus!'}`}
            </p>
            <p>
              <strong className="text-slate-900">Efisiensi:</strong>{' '}
              {ratios.operatingExpenseRatio.healthy
                ? 'Beban operasional terkendali (0-80% dari revenue).'
                : `OER ${ratios.operatingExpenseRatio.value}% — ${ratios.operatingExpenseRatio.value > 80 ? 'terlalu tinggi. Biaya operasional perlu dipangkas.' : 'efisien.'}`}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
