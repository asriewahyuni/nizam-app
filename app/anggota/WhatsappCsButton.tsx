import { MessageCircle } from 'lucide-react'

// Tombol mengambang "Hubungi CS" via WhatsApp — tampil di seluruh subtree
// /anggota (login, daftar, portal) lewat app/anggota/layout.tsx.
const CS_WHATSAPP_NUMBER = '6281388885020'
const CS_WHATSAPP_MESSAGE = 'Halo, saya butuh bantuan terkait akun anggota Kojasmat.'

export default function WhatsappCsButton() {
  const href = `https://wa.me/${CS_WHATSAPP_NUMBER}?text=${encodeURIComponent(CS_WHATSAPP_MESSAGE)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hubungi CS via WhatsApp"
      title="Hubungi CS via WhatsApp"
      className="fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-900/20 transition-transform duration-200 hover:scale-105 hover:bg-[#20BD5A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 cursor-pointer"
      style={{
        right: 'max(1.25rem, env(safe-area-inset-right))',
        bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
      }}
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-40 motion-reduce:animate-none" />
      <MessageCircle className="relative h-6 w-6" strokeWidth={2} />
    </a>
  )
}
