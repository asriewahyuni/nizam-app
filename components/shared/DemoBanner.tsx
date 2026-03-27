'use client'

import { signOutDemo } from '@/modules/demo/actions/demo.actions'
import { Monitor, LogOut, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function DemoBanner() {
  return (
    <motion.div 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-[#003366] px-4 py-2 flex items-center justify-between gap-4 print:hidden border-b border-white/10 relative z-[60]"
    >
      <div className="flex items-center gap-4">
        {/* DEMO BADGE */}
        <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
          <Monitor size={12} className="text-amber-500 fill-amber-500/20" />
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">
            MODE DEMO AKTIF
          </span>
        </div>
        
        {/* INFO TEXT */}
        <div className="flex items-center gap-2 text-white/50 group cursor-default">
          <Trash2 size={12} className="group-hover:text-rose-400 group-hover:animate-bounce transition-colors" />
          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline leading-none">
            Sesi Efemer: Seluruh data akan dimusnahkan saat Anda keluar 🛡️🔥
          </span>
        </div>
      </div>

      <form action={signOutDemo}>
        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-1.5 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 backdrop-blur-sm text-white/60 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all border border-white/10 hover:border-rose-500/30 active:scale-95 group"
        >
          <LogOut size={12} className="group-hover:-translate-x-1 transition-transform" />
          Hancurkan Sesi Demo
        </button>
      </form>
    </motion.div>
  )
}
