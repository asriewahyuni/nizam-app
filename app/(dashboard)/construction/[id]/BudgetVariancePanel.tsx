'use client'

import React, { useState, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  EyeOff,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import type { ConstructionBudgetItemRecord } from '@/modules/construction/lib/construction'

type VarianceStatus = 'OK' | 'CAUTION' | 'CRITICAL'
type FilterCategory = 'ALL' | 'MATERIAL' | 'LABOR' | 'SUBCON' | 'EQUIPMENT' | 'OTHER'
type SortBy = 'NAME' | 'VARIANCE_ABS' | 'VARIANCE_PCT' | 'ACTUAL'

interface BudgetVarianceItem extends ConstructionBudgetItemRecord {
  variance: number
  variancePct: number
  status: VarianceStatus
}

interface CategorySummary {
  category: FilterCategory
  label: string
  plannedTotal: number
  actualTotal: number
  varianceTotal: number
  variancePct: number
  itemCount: number
}

interface BudgetVariancePanelProps {
  budgetItems: ConstructionBudgetItemRecord[]
  onEditItem?: (item: ConstructionBudgetItemRecord) => void
}

function getVarianceStatus(variancePct: number): VarianceStatus {
  if (variancePct <= 5) return 'OK'
  if (variancePct <= 15) return 'CAUTION'
  return 'CRITICAL'
}

function getStatusColor(status: VarianceStatus) {
  switch (status) {
    case 'OK':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    case 'CAUTION':
      return 'bg-amber-50 border-amber-200 text-amber-700'
    case 'CRITICAL':
      return 'bg-rose-50 border-rose-200 text-rose-700'
  }
}

function getStatusIcon(status: VarianceStatus) {
  switch (status) {
    case 'OK':
      return <CheckCircle2 size={16} />
    case 'CAUTION':
      return <AlertTriangle size={16} />
    case 'CRITICAL':
      return <TrendingUp size={16} />
  }
}

function getStatusLabel(status: VarianceStatus) {
  switch (status) {
    case 'OK':
      return 'Sesuai'
    case 'CAUTION':
      return 'Perhatian'
    case 'CRITICAL':
      return 'Terlampaui'
  }
}

export function BudgetVariancePanel({
  budgetItems,
  onEditItem,
}: BudgetVariancePanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<FilterCategory>('ALL')
  const [sortBy, setSortBy] = useState<SortBy>('VARIANCE_ABS')
  const [showOnlyOver, setShowOnlyOver] = useState(false)

  const enrichedItems = useMemo<BudgetVarianceItem[]>(() => {
    return budgetItems.map((item) => ({
      ...item,
      variance: item.actualTotal - item.plannedTotal,
      variancePct: item.plannedTotal > 0 ? ((item.actualTotal - item.plannedTotal) / item.plannedTotal) * 100 : 0,
      status: getVarianceStatus(
        item.plannedTotal > 0 ? Math.abs((item.actualTotal - item.plannedTotal) / item.plannedTotal * 100) : 0
      ),
    }))
  }, [budgetItems])

  const categorySummaries = useMemo<CategorySummary[]>(() => {
    const categories: FilterCategory[] = ['MATERIAL', 'LABOR', 'SUBCON', 'EQUIPMENT', 'OTHER']
    const labels: Record<FilterCategory, string> = {
      ALL: 'Semua',
      MATERIAL: 'Material',
      LABOR: 'Tenaga Kerja',
      SUBCON: 'Subkontraktor',
      EQUIPMENT: 'Peralatan',
      OTHER: 'Lainnya',
    }

    return categories.map((cat) => {
      const items = enrichedItems.filter((item) => item.category === cat)
      const plannedTotal = items.reduce((sum, item) => sum + item.plannedTotal, 0)
      const actualTotal = items.reduce((sum, item) => sum + item.actualTotal, 0)
      const varianceTotal = actualTotal - plannedTotal
      const variancePct = plannedTotal > 0 ? (varianceTotal / plannedTotal) * 100 : 0

      return {
        category: cat,
        label: labels[cat],
        plannedTotal,
        actualTotal,
        varianceTotal,
        variancePct,
        itemCount: items.length,
      }
    })
  }, [enrichedItems])

  const overallSummary = useMemo(() => {
    const plannedTotal = enrichedItems.reduce((sum, item) => sum + item.plannedTotal, 0)
    const actualTotal = enrichedItems.reduce((sum, item) => sum + item.actualTotal, 0)
    const varianceTotal = actualTotal - plannedTotal
    const variancePct = plannedTotal > 0 ? (varianceTotal / plannedTotal) * 100 : 0
    const overBudgetCount = enrichedItems.filter((item) => item.status !== 'OK').length

    return {
      plannedTotal,
      actualTotal,
      varianceTotal,
      variancePct,
      overBudgetCount,
      utilization: plannedTotal > 0 ? (actualTotal / plannedTotal) * 100 : 0,
    }
  }, [enrichedItems])

  let displayItems = enrichedItems
  if (expandedCategory !== 'ALL') {
    displayItems = displayItems.filter((item) => item.category === expandedCategory)
  }
  if (showOnlyOver) {
    displayItems = displayItems.filter((item) => item.status !== 'OK')
  }

  const sortedItems = [...displayItems].sort((a, b) => {
    switch (sortBy) {
      case 'NAME':
        return a.description.localeCompare(b.description)
      case 'VARIANCE_ABS':
        return Math.abs(b.variance) - Math.abs(a.variance)
      case 'VARIANCE_PCT':
        return Math.abs(b.variancePct) - Math.abs(a.variancePct)
      case 'ACTUAL':
        return b.actualTotal - a.actualTotal
      default:
        return 0
    }
  })

  return (
    <div className="space-y-6">
      {/* Overall Summary Card */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {/* Planned */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Direncanakan</div>
            <div className="text-2xl font-semibold tracking-tight text-slate-900">
              {formatRupiah(overallSummary.plannedTotal)}
            </div>
          </div>

          {/* Actual */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Realisasi</div>
            <div className="text-2xl font-semibold tracking-tight text-slate-900">
              {formatRupiah(overallSummary.actualTotal)}
            </div>
          </div>

          {/* Variance */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Varian</div>
            <div
              className={`text-2xl font-semibold tracking-tight ${
                overallSummary.varianceTotal >= 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {overallSummary.varianceTotal >= 0 ? '+' : ''}
              {formatRupiah(overallSummary.varianceTotal)}
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {overallSummary.variancePct.toFixed(1)}%
            </div>
          </div>

          {/* Utilization */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Utilisasi</div>
            <div className="text-2xl font-semibold tracking-tight text-slate-900">
              {overallSummary.utilization.toFixed(0)}%
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  overallSummary.utilization <= 100 ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(overallSummary.utilization, 100)}%` }}
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Terlampaui</div>
            <div className="text-2xl font-semibold tracking-tight text-rose-600">
              {overallSummary.overBudgetCount}
            </div>
            <div className="text-xs font-semibold text-slate-500">
              dari {enrichedItems.length} item
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Per Kategori</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {categorySummaries.map((cat) => (
            <button
              key={cat.category}
              onClick={() =>
                setExpandedCategory(expandedCategory === cat.category ? 'ALL' : (cat.category as FilterCategory))
              }
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                expandedCategory === cat.category
                  ? 'border-[#254b63] bg-[#254b63]/5'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              } ${cat.itemCount === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              disabled={cat.itemCount === 0}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {cat.label}
              </div>
              <div className="mt-2 space-y-1">
                <div className="text-sm font-bold text-slate-900">{cat.itemCount} item</div>
                <div className="text-xs font-semibold text-slate-500">
                  {formatRupiah(cat.plannedTotal)} / {formatRupiah(cat.actualTotal)}
                </div>
                <div
                  className={`text-xs font-bold ${
                    cat.varianceTotal >= 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {cat.varianceTotal >= 0 ? '+' : ''}
                  {cat.variancePct.toFixed(1)}%
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Filter & Sort Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <span className="text-sm font-bold text-slate-600">Filter & Sort</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-[#254b63]"
          >
            <option value="VARIANCE_ABS">Varian (Besar)</option>
            <option value="VARIANCE_PCT">Varian (%)</option>
            <option value="ACTUAL">Realisasi</option>
            <option value="NAME">Nama Item</option>
          </select>

          {/* Show Only Over-Budget Toggle */}
          <button
            onClick={() => setShowOnlyOver(!showOnlyOver)}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              showOnlyOver
                ? 'bg-rose-100 text-rose-700 border border-rose-300'
                : 'bg-slate-200 text-slate-600 border border-slate-300'
            }`}
          >
            {showOnlyOver ? <Eye size={14} className="inline mr-1" /> : <EyeOff size={14} className="inline mr-1" />}
            Terlampaui Saja
          </button>
        </div>
      </div>

      {/* Budget Item List */}
      <div className="space-y-2">
        {sortedItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
            {showOnlyOver ? 'Semua item sesuai budget!' : 'Tidak ada item budget.'}
          </div>
        ) : (
          sortedItems.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border-2 p-4 transition-all ${getStatusColor(item.status)}`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Item Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-current/10">
                      {getStatusIcon(item.status)}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {item.stageName || 'Tanpa Tahap'}
                    </span>
                    <span className="rounded-full bg-slate-300/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                      {item.category}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-current">{item.description}</h4>
                  <div className="text-xs font-medium text-current/70">
                    {item.plannedQuantity} {item.uom || 'unit'} @ {formatRupiah(item.plannedUnitCost)}/unit
                  </div>
                </div>

                {/* Right: Numbers */}
                <div className="flex flex-col items-end gap-3">
                  {/* Planned vs Actual */}
                  <div className="text-right space-y-0.5">
                    <div className="text-[10px] font-semibold text-current/60 uppercase tracking-wide">
                      Rencana → Realisasi
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-current/70 line-through">
                        {formatRupiah(item.plannedTotal)}
                      </span>
                      <span className="text-sm font-semibold text-current">
                        {formatRupiah(item.actualTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Variance */}
                  <div className="text-right space-y-0.5">
                    <div className="text-[10px] font-semibold text-current/60 uppercase tracking-wide">
                      Varian
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold text-current">
                        {item.variance >= 0 ? '+' : ''}
                        {formatRupiah(item.variance)}
                      </span>
                      <span className="text-xs font-bold text-current/60">
                        ({item.variancePct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              {onEditItem && (
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => onEditItem(item)}
                    className="rounded-lg border border-current/30 bg-current/5 px-3 py-1.5 text-xs font-bold transition hover:bg-current/10"
                  >
                    Edit Actual
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
