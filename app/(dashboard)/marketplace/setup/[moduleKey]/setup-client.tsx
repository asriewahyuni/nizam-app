'use client'

export function SetupClient({
  mod,
}: {
  mod?: any
}) {
  return (
    <div className="min-h-screen bg-[#07080a] flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">{mod?.icon || '🕌'}</div>
        <h1 className="text-2xl font-semibold text-white mb-2">Setup {mod?.name || 'Modul'}</h1>
        <p className="text-white/50 mb-6">{mod?.description || 'Halaman setup modul.'}</p>
        <a
          href="/marketplace"
          className="inline-flex px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all"
        >
          Kembali ke Marketplace
        </a>
      </div>
    </div>
  )
}
