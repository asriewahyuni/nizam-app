'use client'

import { signOutDemo } from '@/modules/demo/actions/demo.actions'
import { Monitor, LogOut } from 'lucide-react'

export function DemoBanner() {
  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 px-4 py-2 flex items-center justify-between gap-4 print:hidden">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
          <Monitor size={14} className="text-white" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">
            DEMO MODE
          </span>
        </div>
        <span className="text-white/90 text-xs font-medium hidden sm:inline">
          Semua data bersifat sementara — akan dihapus otomatis saat Anda keluar.
        </span>
      </div>

      <form action={signOutDemo}>
        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-wider rounded-full transition-all hover:scale-105 active:scale-95 border border-white/20"
        >
          <LogOut size={12} />
          Keluar Demo
        </button>
      </form>
    </div>
  )
}
