import type { Metadata } from 'next'
import { MiniErpWordmark } from '@/components/shared/MiniErpWordmark'

export const metadata: Metadata = {
  title: 'Masuk Ke Sistem NIZAM',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative bg-slate-950 font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[50%] bg-emerald-600/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute top-[40%] left-[60%] w-[25%] h-[25%] bg-indigo-600/10 blur-[100px] rounded-full mix-blend-screen" />
      </div>

      <div className="z-10 w-full max-w-[1200px] flex flex-col lg:flex-row items-center justify-center p-6 lg:p-12 gap-12 lg:gap-24 relative">
        {/* Left Branding */}
        <div className="hidden lg:flex flex-col w-1/2 space-y-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_40px_rgba(37,99,235,0.2)]">
              <img src="/logo.png" alt="NIZAM" className="w-full h-full object-cover scale-[1.3]" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-4xl font-black tracking-tight text-white leading-none">NIZAM</span>
              <MiniErpWordmark className="mt-1 text-[10px] font-black tracking-[0.4em] uppercase text-blue-400" />
            </div>
          </div>
          
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-400 leading-tight">
              Akses Penuh<br />Keuntungan<br />Tanpa Batas.
            </h1>
            <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-sm">
              Kelola aset, penjualan, cabang, hingga SDM secara presisi tinggi dalam satu sentra kontrol.
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex -space-x-4">
              <div className="w-10 h-10 rounded-full border-2 border-slate-950 bg-slate-800" />
              <div className="w-10 h-10 rounded-full border-2 border-slate-950 bg-slate-700" />
              <div className="w-10 h-10 rounded-full border-2 border-slate-950 bg-slate-600" />
            </div>
            <div className="text-sm font-semibold text-slate-400">
              <span className="text-white">+24K</span> Pengguna Aktif
            </div>
          </div>
        </div>

        {/* Right Form Container */}
        <div className="w-full lg:w-[480px]">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-10 lg:hidden">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shadow-[0_0_20px_rgba(37,99,235,0.15)] bg-white/5 backdrop-blur-lg">
              <img src="/logo.png" alt="NIZAM" className="w-full h-full object-cover scale-[1.2]" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-black text-white text-2xl tracking-tight uppercase leading-none">NIZAM</span>
            </div>
          </div>

          <div className="relative group">
            {/* Glossy Card Border Glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-500/20 via-slate-800/50 to-emerald-500/20 rounded-[32px] blur opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            
            {/* The Glass Container */}
            <div className="relative bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-[30px] p-8 lg:p-10 shadow-2xl">
              {children}
            </div>
          </div>
        </div>
      </div>
      <p className="absolute bottom-6 text-slate-500 text-[11px] font-medium tracking-wide">
        &copy; {new Date().getFullYear()} NIZAM ERP. Building Integrity.
      </p>
    </div>
  )
}
