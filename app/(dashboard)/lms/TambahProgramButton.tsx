'use client'

// Wrapper client untuk tombol "Tambah Program" di LMS Dashboard.
// Memisahkan state modal dari server component agar tetap server-renderable.

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { TambahProgramModal } from './TambahProgramModal'

export function TambahProgramButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        id="btn-tambah-program"
        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-200"
      >
        <Plus size={18} /> Tambah Program
      </button>
      <TambahProgramModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
