import type { Metadata } from 'next'

// Manifest khusus subtree /anggota — start_url mengarah ke /anggota/login,
// bukan /dashboard (manifest root untuk staf), supaya PWA yang di-install
// calon anggota/anggota dari portal ini membuka halaman yang benar.
export const metadata: Metadata = {
  manifest: '/anggota-manifest.json',
}

export default function AnggotaLayout({ children }: { children: React.ReactNode }) {
  return children
}
