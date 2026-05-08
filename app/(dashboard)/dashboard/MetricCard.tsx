'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Wallet, type LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: string | ReactNode
  hint: string
  icon: LucideIcon
  href?: string
  trend?: number
  danger?: boolean
  isEmpty?: boolean
}

/**
 * Improved MetricCard Component with:
 * - Better visual hierarchy
 * - Status badges for empty states
 * - Enhanced hover interactions
 * - Responsive design
 * - Color indicators for trends
 */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  href = '#',
  trend,
  danger = false,
  isEmpty = false,
}: MetricCardProps) {
  const router = useRouter()

  // Determine trend indicator
  const getTrendIndicator = () => {
    if (trend === undefined) return null
    if (trend > 0) return { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' }
    if (trend < 0) return { icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-50' }
    return null
  }

  const trendIndicator = getTrendIndicator()

  // Determine card styling
  const getCardStyle = () => {
    if (isEmpty) {
      return {
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        hover: 'hover:border-slate-300',
        icon: 'bg-slate-100 text-slate-400',
        label: 'text-slate-400',
        value: 'text-slate-300',
      }
    }
    if (danger) {
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        hover: 'hover:border-rose-300',
        icon: 'bg-rose-100 text-rose-600',
        label: 'text-rose-500',
        value: 'text-rose-700',
      }
    }
    return {
      bg: 'bg-white',
      border: 'border-slate-100',
      hover: 'hover:border-blue-300 hover:shadow-blue-100',
      icon: 'bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white',
      label: 'text-slate-500 group-hover:text-blue-600',
      value: 'text-slate-900 group-hover:text-blue-700',
    }
  }

  const styles = getCardStyle()

  return (
    <motion.div
      whileHover={isEmpty ? {} : { y: -4 }}
      whileTap={isEmpty ? {} : { scale: 0.98 }}
      onClick={() => !isEmpty && router.push(href)}
      className={`relative group rounded-2xl p-5 border transition-all duration-300 cursor-pointer
        ${styles.bg} ${styles.border} ${styles.hover}
        ${isEmpty ? 'shadow-sm opacity-60' : 'shadow-md hover:shadow-lg'}
        h-full flex flex-col justify-between min-h-[200px]`}
    >
      {/* Top Section: Icon & Label */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div
          className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm border border-current/10
            ${styles.icon}`}
        >
          <Icon size={20} strokeWidth={2} />
        </div>

        <div className="flex flex-col items-end flex-1 min-w-0 gap-2">
          <span
            className={`text-xs font-bold leading-tight uppercase tracking-wider text-right break-words transition-colors
            ${styles.label}`}
          >
            {label}
          </span>

          {/* Trend Indicator or Empty Badge */}
          {isEmpty ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-semibold">
              No data
            </span>
          ) : trendIndicator ? (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${trendIndicator.bg}`}>
              <trendIndicator.icon size={12} className={trendIndicator.color} />
              <span className={`text-xs font-bold ${trendIndicator.color}`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom Section: Value & Description */}
      <div className="space-y-3 mt-auto">
        <div className={`text-2xl font-black leading-tight font-mono tracking-tight
          ${styles.value}
          ${isEmpty ? 'opacity-50' : ''}`}
          title={typeof value === 'string' ? value : ''}
        >
          {isEmpty ? '—' : value}
        </div>

        <p
          className={`text-xs leading-relaxed font-medium
          ${isEmpty ? 'text-slate-400' : danger ? 'text-rose-500/80' : 'text-slate-500'}
          line-clamp-2`}
        >
          {hint}
        </p>
      </div>

      {/* Hover CTA Arrow (Desktop only) */}
      {!isEmpty && (
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-blue-500">
          <ArrowUpRight size={16} strokeWidth={2.5} />
        </div>
      )}

      {/* Danger Indicator */}
      {danger && (
        <div className="absolute top-0 right-0 w-1 h-8 bg-rose-400 rounded-b-lg opacity-60" />
      )}
    </motion.div>
  )
}
