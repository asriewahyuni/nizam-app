import type { Metadata } from 'next'

// Manifest khusus subtree /pasien — start_url mengarah ke /pasien/login,
// bukan /dashboard (manifest root untuk staf) atau /kojasmat (portal
// koperasi), supaya PWA yang di-install pasien dari portal ini membuka
// halaman yang benar.
export const metadata: Metadata = {
  manifest: '/pasien-manifest.json',
}

// Layout ini sengaja tetap tipis di Fase 1 (baru berisi halaman login publik).
// PENTING untuk fase berikutnya: halaman yang menampilkan data pasien
// (rekam medis, resep, tagihan) TIDAK BOLEH meniru app/anggota/layout.tsx
// apa adanya — subtree itu tidak punya guard auth sama sekali di level
// layout, tiap halaman menjaga dirinya sendiri sendiri-sendiri. Untuk data
// klinis, halaman/route group yang menampilkan data pasien wajib assert
// eksplisit `login_type === 'pasien'` DAN memverifikasi record yang diminta
// memang milik sesi tersebut, sebelum query apapun ke klinik_rekam_medis.
export default function PasienLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
