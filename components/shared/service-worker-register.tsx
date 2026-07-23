'use client'

import { useEffect } from 'react'

// Mendaftarkan service worker (public/sw.js) agar mode PWA punya cache offline
// dan halaman fallback saat jaringan gagal, alih-alih error bawaan browser.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('[SW] Registrasi gagal:', error)
    })
  }, [])

  return null
}
