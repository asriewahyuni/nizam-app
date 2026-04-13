import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Masa Trial Berakhir — Nizam MiniERP',
  description: 'Masa percobaan langganan Anda telah berakhir. Hubungi kami untuk melanjutkan akses penuh.',
}

export default function ExpiredPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6">
      {/* Glow background effect */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-rose-600/10 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-8 text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-400/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10 text-amber-400"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-white mb-2">
            Masa Trial Telah Berakhir
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Periode percobaan gratis organisasi Anda sudah habis. Upgrade ke paket berbayar untuk
            melanjutkan akses penuh ke seluruh fitur <span className="text-white font-medium">Nizam MiniERP</span>.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <a
              id="btn-upgrade-plan"
              href="https://kliknizam.app/#pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm py-3 px-5 transition-colors shadow-lg shadow-amber-500/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path fillRule="evenodd" d="M11.983 1.907a.75.75 0 0 0-1.292-.657L5.134 8.25H2.25a.75.75 0 0 0-.548 1.262l7.5 8.25a.75.75 0 0 0 1.292-.657L9.116 12H12.75a.75.75 0 0 0 .548-1.262l-1.315-1.447V1.907Z" clipRule="evenodd" />
              </svg>
              Lihat Paket & Upgrade
            </a>

            <a
              id="btn-contact-sales"
              href="https://wa.me/6282234862235?text=Halo%20Tim%20Nizam%20%F0%9F%91%8B%0A%0ASaya%20ingin%20melanjutkan%20langganan%20Nizam%20MiniERP%20untuk%20organisasi%20saya.%0A%0AMohon%20bantuannya%20untuk%20proses%20upgrade%20%2F%20perpanjangan%20paket.%20Terima%20kasih!"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm py-3 px-5 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-green-400" aria-hidden="true">
                <path d="M 12 2 C 6.477 2 2 6.477 2 12 c 0 1.89.524 3.659 1.435 5.185 L 2 22 l 4.815-1.435 A 9.96 9.96 0 0 0 12 22 c 5.523 0 10-4.477 10-10 S 17.523 2 12 2 Z" />
              </svg>
              Hubungi Tim Kami
            </a>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-white/10" />

          {/* Sign out link */}
          <Link
            id="btn-signout-expired"
            href="/auth/signout"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Keluar dari akun
          </Link>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs text-slate-600">
          Sudah melakukan pembayaran?{' '}
          <a
            href="mailto:support@kliknizam.app"
            className="text-slate-400 hover:text-white underline transition-colors"
          >
            Hubungi support
          </a>{' '}
          agar tim kami segera mengaktifkan akun Anda.
        </p>
      </div>
    </div>
  )
}
