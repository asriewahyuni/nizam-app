import type { Metadata } from 'next'
import { Lexend } from 'next/font/google'
import WhatsappCsButton from './WhatsappCsButton'

// Manifest khusus subtree /anggota — start_url mengarah ke /anggota/login,
// bukan /dashboard (manifest root untuk staf), supaya PWA yang di-install
// calon anggota/anggota dari portal ini membuka halaman yang benar.
export const metadata: Metadata = {
  manifest: '/anggota-manifest.json',
}

// Lexend khusus portal anggota (bukan seluruh app) — didesain untuk
// keterbacaan tinggi, penting untuk audiens lintas usia (gen-z & boomer)
// tanpa terasa seperti font formulir lama.
const lexend = Lexend({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lexend',
})

export default function AnggotaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Variabel font di-scope ke konten halaman saja — WhatsappCsButton
          TIDAK boleh punya wrapper tambahan di sini, karena dia posisinya
          "fixed" berbasis koordinat viewport untuk fitur drag; DOM ancestor
          ekstra bisa mengubah containing block-nya dan bikin drag meleset. */}
      <div className={lexend.variable}>{children}</div>
      <WhatsappCsButton />
    </>
  )
}
