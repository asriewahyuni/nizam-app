'use client'

import React from 'react'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { motion } from 'framer-motion'

interface FloatingPlanBadgeProps {
  planName?: string
}

export function FloatingPlanBadge({ planName = 'Trial' }: FloatingPlanBadgeProps) {
  return (
    <motion.div 
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 1, duration: 0.5 }}
      className="fixed bottom-6 right-6 z-[60] print:hidden"
    >
      <Link
        href="/billing"
        className="group flex items-center gap-3 pl-4 pr-5 py-2.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white shadow-md shadow-indigo-900/40 hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all duration-300 border border-white/10"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
          <Zap size={14} className="text-white fill-white/20" />
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-semibold text-white/50 uppercase tracking-wide leading-none mb-0.5">PAKET AKTIF</span>
          <span className="text-[11px] font-semibold text-white group-hover:text-indigo-300 transition-colors uppercase tracking-wide leading-none flex items-center gap-1.5">
            {planName} 
            <span className="text-[8px] px-1 py-0.5 bg-white/10 rounded-md opacity-60 group-hover:opacity-100 transition-opacity">PRO</span>
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
