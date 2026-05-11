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

  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-5 min-h-[180px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#9ca3af]">{label}</span>
          <div className="w-9 h-9 rounded-lg bg-[#e5e7eb] flex items-center justify-center">
            <Icon size={18} className="text-[#9ca3af]" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-[#d1d5db] tracking-tight">—</div>
          <div className="text-xs text-[#9ca3af] mt-1">{hint}</div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      onClick={() => router.push(href)}
      className="rounded-2xl border border-[#e5e7eb] bg-white p-5 min-h-[180px] flex flex-col justify-between cursor-pointer transition-shadow duration-200 hover:shadow-sm"
      title={hint}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs text-[#6b7280] font-medium">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-[#f3f4f6] flex items-center justify-center shrink-0 ml-3">
          <Icon size={18} className="text-[#6b7280]" />
        </div>
      </div>

      <div className="mt-auto">
        <div className="text-2xl font-semibold text-[#0a0c10] tracking-tight leading-none">
          {value}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-[#9ca3af]">{hint}</span>
          {trend !== undefined && (
            <span className={`flex items-center gap-1 text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
          {danger && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              Perhatian
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
