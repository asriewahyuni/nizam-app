import type { Metadata } from 'next'
import { MiniErpWordmark } from '@/components/shared/MiniErpWordmark'

export const metadata: Metadata = {
  title: 'Masuk — NIZAM ERP',
}

const FEATURES = [
  { label: 'Akuntansi & Keuangan', desc: 'Jurnal, kas bank, laporan syariah' },
  { label: 'Penjualan & CRM', desc: 'Quotation, POS, pipeline pelanggan' },
  { label: 'Inventori & Gudang', desc: 'Stok, pembelian, dan WMS' },
  { label: 'HRIS & Payroll', desc: 'Karyawan, absensi, penggajian' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative bg-slate-950 font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-600/15 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="z-10 w-full max-w-[1100px] flex flex-col lg:flex-row items-center justify-center p-6 lg:p-16 gap-16 lg:gap-20 relative">

        {/* Left — Branding */}
        <div className="hidden lg:flex flex-col w-[45%] space-y-12">
          {/* Logo */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border border-white/10 bg-white/5">
              <img src="/logo.png" alt="NIZAM" className="w-full h-full object-cover scale-[1.3]" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-white leading-none block">NIZAM</span>
              <MiniErpWordmark className="text-[9px] font-semibold tracking-[0.35em] uppercase text-blue-400/80 mt-0.5" />
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-5">
            <h1 className="text-4xl lg:text-[2.6rem] font-bold text-white leading-snug tracking-tight">
              Satu platform<br />
              <span className="text-blue-400">untuk semua lini</span><br />
              bisnis Anda.
            </h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-xs">
              ERP berbasis syariah yang dirancang untuk tumbuh bersama bisnis Anda — dari satu cabang hingga ratusan.
            </p>
          </div>

          {/* Feature List */}
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{f.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Form Card */}
        <div className="w-full lg:w-[420px]">
          {/* Mobile Logo */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 bg-white/5">
              <img src="/logo.png" alt="NIZAM" className="w-full h-full object-cover scale-[1.2]" />
            </div>
            <span className="font-bold text-white text-xl tracking-tight">NIZAM</span>
          </div>

          <div className="bg-slate-900/70 backdrop-blur-2xl border border-white/[0.07] rounded-[28px] p-8 shadow-2xl shadow-black/40">
            {children}
          </div>
        </div>
      </div>

      <p className="absolute bottom-6 text-slate-600 text-[10px] tracking-wide">
        &copy; {new Date().getFullYear()} NIZAM ERP. All rights reserved.
      </p>
    </div>
  )
}
