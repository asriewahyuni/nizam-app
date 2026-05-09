'use client'

import React from 'react'
import Link from 'next/link'
import { Package } from 'lucide-react'
import { motion } from 'framer-motion'
import { NIZAM_VERSION } from '@/lib/version'

export function FloatingVersionBadge() {
  return (
    <motion.div
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 1, duration: 0.5 }}
      className="fixed bottom-6 left-6 z-[60] print:hidden md:bottom-6 md:left-6"
    >
      <Link
        href="/settings/version-info"
        className="group flex items-center gap-3 pl-4 pr-5 py-2.5 rounded-full bg-white/95 backdrop-blur-md text-slate-900 shadow-2xl shadow-slate-900/10 hover:shadow-slate-900/20 hover:-translate-y-1 transition-all duration-300 border border-slate-200/50"
        title={`NIZAM Full ${NIZAM_VERSION.full} - ${NIZAM_VERSION.codeName}`}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
          <Package size={14} className="text-white fill-white/20" />
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-0.5">VERSI NIZAM</span>
          <span className="text-[11px] font-black text-slate-900 group-hover:text-blue-700 transition-colors uppercase tracking-widest leading-none flex items-center gap-1.5">
            {NIZAM_VERSION.short}
            <span className="text-[8px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md font-semibold opacity-75 group-hover:opacity-100 transition-opacity">
              {NIZAM_VERSION.category}
            </span>
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
