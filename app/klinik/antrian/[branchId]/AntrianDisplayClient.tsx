'use client'

// Layar antrian publik (TV/monitor ruang tunggu) — tanpa login, tanpa data
// pribadi pasien (cuma nomor antrian). Poll berkala, bukan realtime socket —
// cukup untuk kebutuhan display board dan jauh lebih sederhana untuk halaman
// yang dibuka statis berjam-jam di satu layar.

import { useEffect, useState } from 'react'
import { Stethoscope, Clock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAntrianDisplayBoard, type KlinikAntrianDisplayPoli } from '@/modules/klinik/actions/klinik-kunjungan.actions'

const POLL_INTERVAL_MS = 8000
// Layar TV cuma cukup menampilkan 2 poli sekaligus secara nyaman (angka besar +
// daftar menunggu). Kalau poli aktif lebih dari itu, board berpindah halaman
// otomatis (swipe) tiap AUTOPLAY_INTERVAL_MS — durasi dipilih agak lebih lama
// dari POLL_INTERVAL_MS supaya pasien sempat membaca sebelum halaman berganti.
const POLI_PER_PAGE = 2
const AUTOPLAY_INTERVAL_MS = 15000

function useClock() {
  // now tetap null saat SSR/hydration awal (menghindari mismatch waktu
  // server vs client) — tick pertama sengaja dijadwalkan async (setTimeout 0,
  // bukan panggilan setState langsung di body effect) baru diikuti interval.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const kick = setTimeout(() => setNow(new Date()), 0)
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => { clearTimeout(kick); clearInterval(id) }
  }, [])
  return now
}

function PoliCard({ poli }: { poli: KlinikAntrianDisplayPoli }) {
  return (
    <div
      key={poli.sedang_dipanggil ?? 'none'}
      className="animate-antrian-flash rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm"
    >
      <p className="text-center text-lg font-bold uppercase tracking-wide text-slate-500">{poli.poli_nama}</p>
      {poli.dokter_praktik && (
        <p className="mt-0.5 text-center text-sm font-semibold text-cyan-700">{poli.dokter_praktik}</p>
      )}

      <p className="mt-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">Sedang Dipanggil</p>
      <p className="mt-2 text-center text-8xl font-extrabold tabular-nums text-cyan-700 sm:text-9xl">
        {poli.sedang_dipanggil ?? '–'}
      </p>

      <div className="mt-8 border-t border-slate-100 pt-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">Menunggu</p>
        {poli.menunggu.length === 0 ? (
          <p className="text-center text-sm text-slate-400">Tidak ada antrian menunggu.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {poli.menunggu.slice(0, 8).map((no) => (
              <span
                key={no}
                className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-base font-bold tabular-nums text-slate-700"
              >
                {no}
              </span>
            ))}
            {poli.menunggu.length > 8 && (
              <span className="flex items-center px-2 text-sm font-semibold text-slate-400">
                +{poli.menunggu.length - 8} lagi
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AntrianDisplayClient({
  branchId, branchName, orgName,
}: {
  branchId: string
  branchName: string
  orgName: string
}) {
  const [poliList, setPoliList] = useState<KlinikAntrianDisplayPoli[]>([])
  const [loaded, setLoaded] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const now = useClock()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const data = await getAntrianDisplayBoard(branchId)
      if (!cancelled) {
        setPoliList(data)
        setLoaded(true)
      }
    }
    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [branchId])

  const pages: KlinikAntrianDisplayPoli[][] = []
  for (let i = 0; i < poliList.length; i += POLI_PER_PAGE) {
    pages.push(poliList.slice(i, i + POLI_PER_PAGE))
  }

  useEffect(() => {
    // Poli aktif bisa berubah (poli baru dibuka/ditutup) — jaga pageIndex tetap
    // valid daripada nge-blank kalau jumlah halaman menyusut.
    if (pageIndex >= pages.length) setPageIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length])

  useEffect(() => {
    if (pages.length <= 1) return
    const id = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % pages.length)
    }, AUTOPLAY_INTERVAL_MS)
    return () => clearInterval(id)
  }, [pages.length])

  return (
    <main className="min-h-screen bg-cyan-50 px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-sm">
              <Stethoscope className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{orgName}</p>
              <p className="text-sm text-slate-500">{branchName} — Layar Antrian</p>
            </div>
          </div>
          {now && (
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-slate-700 shadow-sm">
              <Clock className="size-4 text-slate-400" aria-hidden="true" />
              <span className="text-lg font-bold tabular-nums">
                {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="hidden text-sm text-slate-400 sm:inline">
                {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
          )}
        </header>

        {!loaded ? (
          <p className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Memuat data antrian...</p>
        ) : poliList.length === 0 ? (
          <p className="py-24 text-center text-sm text-slate-400">Belum ada poli aktif di cabang ini — aktifkan minimal satu poli untuk mulai menampilkan antrian.</p>
        ) : (
          <>
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-700 ease-in-out motion-reduce:transition-none"
                style={{ transform: `translateX(-${pageIndex * 100}%)` }}
              >
                {pages.map((page, i) => (
                  <div key={i} className="grid w-full shrink-0 gap-6 sm:grid-cols-2">
                    {page.map((poli) => (
                      <PoliCard key={poli.poli_id} poli={poli} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {pages.length > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPageIndex(i)}
                    title={`Halaman ${i + 1}`}
                    aria-label={`Tampilkan halaman ${i + 1} dari ${pages.length}`}
                    aria-current={i === pageIndex}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
                  >
                    <span
                      className={cn(
                        'block rounded-full transition-all duration-300',
                        i === pageIndex ? 'h-2.5 w-6 bg-cyan-600' : 'h-2.5 w-2.5 bg-slate-300'
                      )}
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
