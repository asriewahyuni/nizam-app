'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

const ERROR_MESSAGES: Record<string, string> = {
  'akses-ditolak': 'Anda tidak memiliki akses ke halaman tersebut.',
}

/**
 * Baca query param ?error=<key> saat halaman dimuat,
 * tampilkan notifikasi merah selama 4 detik, lalu bersihkan URL.
 * Tidak ada UI permanen — hanya muncul sekali setelah redirect.
 */
export function RouteErrorToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const shownRef = useRef(false)

  useEffect(() => {
    const errorKey = searchParams.get('error')
    if (!errorKey || shownRef.current) return
    shownRef.current = true

    const msg = ERROR_MESSAGES[errorKey] ?? 'Terjadi kesalahan, silakan coba lagi.'

    // Tampilkan notifikasi inline
    const el = document.createElement('div')
    el.setAttribute('role', 'alert')
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:9999', 'background:#ef4444', 'color:#fff',
      'padding:12px 20px', 'border-radius:12px',
      'font-size:13px', 'font-weight:700',
      'box-shadow:0 4px 20px rgba(0,0,0,0.15)',
      'max-width:calc(100vw - 32px)', 'text-align:center',
      'opacity:0', 'transition:opacity 200ms ease',
    ].join(';')
    el.textContent = msg
    document.body.appendChild(el)

    requestAnimationFrame(() => { el.style.opacity = '1' })

    const timer = setTimeout(() => {
      el.style.opacity = '0'
      setTimeout(() => el.remove(), 200)
    }, 4000)

    // Bersihkan ?error dari URL tanpa reload
    const params = new URLSearchParams(searchParams.toString())
    params.delete('error')
    const newUrl = params.toString() ? `${pathname}?${params}` : pathname
    router.replace(newUrl, { scroll: false })

    return () => { clearTimeout(timer); el.remove() }
  }, [searchParams, pathname, router])

  return null
}
