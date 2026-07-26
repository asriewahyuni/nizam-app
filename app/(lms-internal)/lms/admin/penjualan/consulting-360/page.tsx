/**
 * Daftar paket Consulting 360 tanpa formulir panjang.
 */
import Link from 'next/link'
import {
  BriefcaseBusiness,
  CalendarClock,
  PencilLine,
  Plus,
  Search,
} from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { getLmsConsultingSalesData } from '@/modules/ecommerce/lib/lms-sales.server'

export const metadata = { title: 'Consulting 360 — Nizam LMS' }

export default async function Consulting360ListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const [data, query] = await Promise.all([getLmsConsultingSalesData(), searchParams])
  const q = String(query.q || '').trim().toLowerCase()
  const status = ['published', 'draft'].includes(String(query.status))
    ? String(query.status)
    : ''
  const offerings = data.overview.offerings.filter((offering) => {
    if (q && !`${offering.publicName} ${offering.shortDescription}`.toLowerCase().includes(q)) return false
    if (status === 'published' && !offering.isPublished) return false
    if (status === 'draft' && offering.isPublished) return false
    return true
  })
  const consultantById = new Map(data.overview.consultants.map((item) => [item.id, item]))
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (status) params.set('status', status)
  const returnTo = `/lms/admin/penjualan/consulting-360${params.size ? `?${params.toString()}` : ''}`

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-teal-700"><BriefcaseBusiness aria-hidden="true" size={18} /><span className="text-xs font-black uppercase tracking-[0.14em]">Jasa privat</span></div>
          <h2 className="mt-2 text-xl font-black text-slate-950">Consulting 360</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">{offerings.length} paket privat terjadwal ditemukan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/lms/admin/konsultasi" className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100">
            <CalendarClock aria-hidden="true" size={17} /> Operasional
          </Link>
          <Link href={`/lms/admin/penjualan/consulting-360/baru?returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-black text-white transition-colors hover:bg-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100">
            <Plus aria-hidden="true" size={17} /> Buat Paket
          </Link>
        </div>
      </header>
      <form action="/lms/admin/penjualan/consulting-360" className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-[1fr_180px_auto]">
        <label className="relative">
          <span className="sr-only">Cari Consulting 360</span>
          <Search aria-hidden="true" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={query.q || ''} placeholder="Cari nama paket…" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" />
        </label>
        <select name="status" defaultValue={status} aria-label="Filter status Consulting 360" className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100">
          <option value="">Semua status</option>
          <option value="published">Tayang</option>
          <option value="draft">Draft</option>
        </select>
        <button type="submit" className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100">Terapkan</button>
      </form>
      {offerings.length === 0 ? (
        <div className="px-5 py-14 text-center"><BriefcaseBusiness aria-hidden="true" size={28} className="mx-auto text-slate-400" /><h3 className="mt-3 font-bold text-slate-950">Paket Consulting 360 tidak ditemukan</h3></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Paket</th><th className="px-4 py-3">Konsultan</th><th className="px-4 py-3">Sesi</th><th className="px-4 py-3">Harga</th><th className="px-4 py-3">Engagement aktif</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Tindakan</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {offerings.map((offering) => {
                const names = offering.consultantIds.map((id) => consultantById.get(id)?.displayName).filter(Boolean)
                return (
                  <tr key={offering.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-4"><p className="max-w-xs truncate font-bold text-slate-950">{offering.publicName}</p><p className="mt-1 text-xs font-medium text-slate-500">{offering.deliveryMode.toLowerCase()} · {offering.startLocal}–{offering.endLocal}</p></td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">{names.slice(0, 2).join(', ') || 'Belum dipilih'}{names.length > 2 ? ` +${names.length - 2}` : ''}</td>
                    <td className="px-4 py-4 text-sm font-bold text-slate-900">{offering.sessionCount} × {offering.durationMinutes} menit</td>
                    <td className="px-4 py-4 text-sm font-bold text-slate-900">{formatRupiah(offering.price)}</td>
                    <td className="px-4 py-4 text-sm font-bold text-slate-900">{offering.activeEngagements}</td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${offering.isPublished ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{offering.isPublished ? 'Tayang' : 'Draft'}</span></td>
                    <td className="px-4 py-4 text-right"><Link href={`/lms/admin/penjualan/consulting-360/${offering.id}?returnTo=${encodeURIComponent(returnTo)}`} aria-label={`Ubah ${offering.publicName}`} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"><PencilLine aria-hidden="true" size={17} /></Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
