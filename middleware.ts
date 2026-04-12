import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')
  
  // Daftar domain lama yang usang dan harus di-redirect
  const legacyDomains = [
    'nizam.xales.id',
    'nizam.up.railway.app'
  ]

  // Cek apakah pengunjung menggunakan domain lama
  if (host && legacyDomains.includes(host)) {
    const url = request.nextUrl.clone()
    // Ubah tujuan host dan pastikan memaksakan protokol https (opsional tapi aman)
    url.host = 'brain.kliknizam.app'
    url.port = '' // Bersihkan port lokal kalau ada
    url.protocol = 'https:'
    
    // Kembalikan status 301 (Permanent Redirect) dengan URL baru yang persis path-nya
    return NextResponse.redirect(url, 301)
  }

  // Jika diakses menggunakan domain benar (misal: brain.kliknizam.app), lanjutkan normal
  return NextResponse.next()
}

export const config = {
  // Hanya jalankan middleware pada rute halaman/api, bukan untuk file statis Next.js agar hemat resource
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
