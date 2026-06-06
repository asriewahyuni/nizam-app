'use client'

import { Printer } from 'lucide-react'

export function PrintButton({ label = 'Cetak' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-700 active:scale-95 transition-all cursor-pointer shadow-sm"
    >
      <Printer className="w-4 h-4" />
      {label}
    </button>
  )
}
