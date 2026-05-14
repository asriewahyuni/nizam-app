'use client'

export function SetupClient({
  mod,
}: {
  mod?: { icon?: string; name?: string; description?: string; href?: string }
}) {
  return (
    <div className="min-h-screen bg-[#07080a] flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">{mod?.icon || '🕌'}</div>
        <h1 className="text-2xl font-semibold text-white mb-2">Setup {mod?.name || 'Modul'}</h1>
        <p className="text-white/50 mb-6">{mod?.description || 'Halaman setup modul.'}</p>
        <div className="flex gap-3 justify-center">
          <a
            href={mod?.href || '/marketplace'}
            className="inline-flex px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all"
          >
            Buka Modul
          </a>
          <a
            href="/marketplace"
            className="inline-flex px-6 py-3 rounded-2xl border border-white/20 text-white/70 font-semibold hover:bg-white/5 transition-all"
          >
            Kembali
          </a>
        </div>
      </div>
    </div>
  )
}
