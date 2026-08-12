'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'

// Tombol mengambang "Hubungi CS" via WhatsApp — tampil di seluruh subtree
// /anggota (login, daftar, portal) lewat app/anggota/layout.tsx. Bisa
// digeser (drag) kalau menutupi elemen lain; posisi terakhir disimpan di
// localStorage supaya tidak balik ke pojok tiap buka halaman/refresh.
const CS_WHATSAPP_NUMBER = '6281388885020'
const CS_WHATSAPP_MESSAGE = 'Halo, saya butuh bantuan terkait akun anggota Kojasmat.'
const BUTTON_SIZE = 56
const STORAGE_KEY = 'kojasmat_wa_cs_pos'
const DRAG_THRESHOLD_PX = 6

export default function WhatsappCsButton() {
  const href = `https://wa.me/${CS_WHATSAPP_NUMBER}?text=${encodeURIComponent(CS_WHATSAPP_MESSAGE)}`

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
  const draggedRef = useRef(false)
  const startRef = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0 })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setPos(JSON.parse(saved))
    } catch {
      // localStorage tidak tersedia (mode privat dll) — biarkan posisi default.
    }
  }, [])

  function clamp(x: number, y: number) {
    const margin = 4
    const maxX = window.innerWidth - BUTTON_SIZE - margin
    const maxY = window.innerHeight - BUTTON_SIZE - margin
    return {
      x: Math.min(Math.max(x, margin), Math.max(margin, maxX)),
      y: Math.min(Math.max(y, margin), Math.max(margin, maxY)),
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLAnchorElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    draggingRef.current = true
    draggedRef.current = false
    startRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: rect.left, y: rect.top }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLAnchorElement>) {
    if (!draggingRef.current) return
    const dx = e.clientX - startRef.current.pointerX
    const dy = e.clientY - startRef.current.pointerY
    if (!draggedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    draggedRef.current = true
    setPos(clamp(startRef.current.x + dx, startRef.current.y + dy))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLAnchorElement>) {
    if (!draggingRef.current) return
    draggingRef.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (draggedRef.current) {
      setPos(current => {
        if (current) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)) } catch { /* abaikan */ }
        }
        return current
      })
    }
  }

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (draggedRef.current) {
      e.preventDefault()
      draggedRef.current = false
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hubungi CS via WhatsApp — tahan dan geser untuk memindahkan"
      title="Hubungi CS via WhatsApp (tahan & geser untuk pindah)"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      className="fixed z-50 flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-900/20 transition-transform duration-200 hover:scale-105 hover:bg-[#20BD5A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 cursor-grab active:cursor-grabbing"
      style={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        touchAction: 'none',
        ...(pos
          ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
          : {
              right: 'max(1.25rem, env(safe-area-inset-right))',
              // Portal anggota punya bottom nav tab (~72px) yang fixed di dasar layar —
              // offset lebih tinggi dari sekadar safe-area supaya tombol tidak menutupi/
              // ketutupan nav itu di halaman manapun dalam subtree /anggota.
              bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
            }),
      }}
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-40 motion-reduce:animate-none" />
      <MessageCircle className="relative h-6 w-6" strokeWidth={2} />
    </a>
  )
}
