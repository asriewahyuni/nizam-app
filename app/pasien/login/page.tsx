import { Stethoscope } from 'lucide-react'

export const metadata = {
  title: 'Portal Pasien',
}

// Placeholder Fase 1 — akun/login pasien sungguhan dibangun di Fase 2b
// (Booking Online) bersama klinik_slot_hold. Halaman ini menahan route
// /pasien/login supaya redirect dari app/(dashboard)/layout.tsx dan
// app/(klinik-internal)/layout.tsx untuk sesi user_type='pasien' tidak
// jatuh ke 404.
export default function PasienLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cyan-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
          <Stethoscope className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Portal Pasien</h1>
        <p className="mt-2 text-sm text-slate-500">
          Portal pasien sedang disiapkan. Silakan hubungi klinik Anda untuk informasi kunjungan, resep, atau tagihan.
        </p>
      </div>
    </main>
  )
}
