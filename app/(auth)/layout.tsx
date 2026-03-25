import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Masuk',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left — Branding panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #3b82f6 100%)',
        }}
      >
        <div className="text-white">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden border border-white/30 shadow-2xl relative group-hover:scale-105 transition-transform duration-500"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)' }}
            >
              <img src="/logo.png" alt="NIZAM" className="w-full h-full object-cover scale-[1.3]" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-4xl font-black tracking-tighter leading-none">NIZAM</span>
              <p className="text-blue-100/80 text-[10px] font-black tracking-[0.3em] uppercase mt-2">Cloud ERP OS</p>
            </div>
          </div>
        </div>

        <div className="text-white space-y-6">
          <blockquote className="text-2xl font-light leading-relaxed text-white/90">
            &ldquo;ERP sekuat SAP, seringan aplikasi catatan.&rdquo;
          </blockquote>
          <div className="space-y-3">
            {[
              '✓ Akuntansi otomatis — tanpa jurnal manual',
              '✓ Laporan keuangan real-time',
              '✓ Aman dengan enkripsi enterprise-grade',
            ].map((item) => (
              <p key={item} className="text-blue-100 text-sm">{item}</p>
            ))}
          </div>
        </div>

        <p className="text-blue-300 text-xs">
          &copy; {new Date().getFullYear()} NIZAM ERP. All rights reserved.
        </p>
      </div>

      {/* Right — Auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden border border-gray-100 shadow-md"
              style={{ background: 'white' }}
            >
              <img src="/logo.png" alt="NIZAM" className="w-full h-full object-cover scale-[1.3]" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-black text-gray-900 text-xl tracking-tighter uppercase leading-none">NIZAM</span>
              <span className="text-[9px] text-gray-400 font-black tracking-widest uppercase mt-1">Cloud ERP</span>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
