'use client'

import { motion } from 'framer-motion'
import { GraduationCap, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

type AbsTrialBannerProps = {
  subscriptionEnd: string | null
}

function getDaysLeft(subscriptionEnd: string | null): number | null {
  if (!subscriptionEnd) return null
  const diff = new Date(subscriptionEnd).getTime() - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function AbsTrialBanner({ subscriptionEnd }: AbsTrialBannerProps) {
  const daysLeft = getDaysLeft(subscriptionEnd)

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-gradient-to-r from-[#004AB8] to-blue-600 px-4 py-2 flex items-center justify-between gap-4 print:hidden border-b border-white/10 relative z-20"
    >
      <div className="flex items-center gap-4">
        {/* ABS BADGE */}
        <div className="flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full">
          <GraduationCap size={12} className="text-amber-300 fill-amber-300/20" />
          <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wide leading-none">
            ABS Trial — 30 Hari
          </span>
        </div>

        {/* COUNTDOWN */}
        {daysLeft !== null && (
          <div className="flex items-center gap-2 text-white/60">
            <Clock size={12} />
            <span className="text-[10px] font-bold uppercase tracking-wide hidden sm:inline leading-none">
              {daysLeft > 0
                ? `${daysLeft} hari tersisa — Paket Plus aktif`
                : 'Trial berakhir — Upgrade untuk melanjutkan'}
            </span>
          </div>
        )}
      </div>

      <Link
        href="/pricing"
        className="flex items-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all border border-white/20 active:scale-95 group"
      >
        Upgrade Plan
        <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
      </Link>
    </motion.div>
  )
}
