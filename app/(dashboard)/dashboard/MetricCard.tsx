'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
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

  const getTrendIndicator = () => {
    if (trend === undefined) return null
    if (trend > 0) return { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' }
    if (trend < 0) return { icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-50' }
    return null
  }

  const trendIndicator = getTrendIndicator()

  const getCardStyle = () => {
    if (isEmpty) {
      return {
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        icon: 'bg-slate-100 text-slate-400',
        label: 'text-slate-400',
        value: 'text-slate-300',
      }
    }
    if (danger) {
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        icon: 'bg-rose-100 text-rose-600',
        label: 'text-rose-500',
        value: 'text-rose-700',
      }
    }
    return {
      bg: 'bg-white',
      border: 'border-slate-200',
      icon: 'bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white',
      label: 'text-slate-500',
      value: 'text-slate-900',
    }
  }

  const styles = getCardStyle()

  return (
    <motion.div
      whileHover={isEmpty ? {} : { y: -2 }}
      whileTap={isEmpty ? {} : { scale: 0.99 }}
      onClick={() => !isEmpty && router.push(href)}
      className={`group relative rounded-xl p-4 border transition-colors duration-150
        ${styles.bg} ${styles.border}
        ${isEmpty ? '' : 'hover:border-slate-300 cursor-pointer'}
        h-full flex flex-col justify-between min-h-[160px]`}
      title={hint}
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${styles.icon}`}>
          <Icon size={18} strokeWidth={2} />
        </div>

        <div className="flex flex-col items-end flex-1 min-w-0 gap-1.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wide text-right transition-colors ${styles.label}`} title={label}>
            {label}
          </span>

          {isEmpty ? (
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px] font-medium" title="No data available">—</span>
          ) : trendIndicator ? (
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${trendIndicator.bg}`} title={`${trend! > 0 ? '+' : ''}${trend}%`}>
              <trendIndicator.icon size={11} className={trendIndicator.color} />
              <span className={`text-[10px] font-semibold ${trendIndicator.color}`}>{trend! > 0 ? '+' : ''}{trend}%</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto">
        <div className={`text-xl font-bold font-mono tracking-tight ${styles.value} ${isEmpty ? 'opacity-40' : ''}`} title={typeof value === 'string' ? value : ''}>
          {isEmpty ? '—' : value}
        </div>
      </div>

      {danger && <div className="absolute top-0 right-0 w-1 h-6 bg-rose-400 rounded-b" title="Perlu perhatian" />}
    </motion.div>
  )
}
