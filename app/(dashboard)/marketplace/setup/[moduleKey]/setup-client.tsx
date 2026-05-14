'use client'

export function SetupClient({
  mod,
  coaInstalled = false,
}: {
  mod: any
  coaInstalled?: boolean
  currentSettings?: Record<string, any>
}) {
  return (
    <div className="min-h-screen bg-[#07080a] flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">{mod.icon || '🚀'}</div>
        <h1 className="text-2xl font-semibold text-white mb-2">Setup {mod.name}</h1>
        <p className="text-white/50 mb-6">{mod.description}</p>
        <div className="inline-flex gap-3">
          <a
            href={mod.href || '/dashboard'}
            className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all"
          >
            Buka Modul
          </a>
          <a
            href="/marketplace"
            className="px-6 py-3 rounded-2xl border border-white/20 text-white/70 font-semibold hover:bg-white/5 transition-all"
          >
            Kembali
          </a>
        </div>
        <div className="mt-4 text-xs text-white/30">
          CoA: {coaInstalled ? '✅ Terinstal' : '⏳ Perlu instalasi'}
        </div>
      </div>
    </div>
  )
}
