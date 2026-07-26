/**
 * Daftar Paket Akses LMS.
 */
import Link from 'next/link'
import { Layers3, PencilLine, Plus, Search } from 'lucide-react'
import { getLmsAccessPackageSalesData } from '@/modules/ecommerce/lib/lms-sales.server'

export const metadata = { title: 'Paket Akses — Nizam LMS' }

export default async function AccessPackageListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const [data, query] = await Promise.all([
    getLmsAccessPackageSalesData(),
    searchParams,
  ])
  const q = String(query.q || '').trim().toLowerCase()
  const status = ['active', 'inactive'].includes(String(query.status))
    ? String(query.status)
    : ''
  const packages = data.accessPackages.filter((item) => {
    if (q && !`${item.name} ${item.description}`.toLowerCase().includes(q)) return false
    if (status === 'active' && !item.isActive) return false
    if (status === 'inactive' && item.isActive) return false
    return true
  })
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (status) params.set('status', status)
  const returnTo = `/lms/admin/penjualan/paket-akses${params.size ? `?${params.toString()}` : ''}`

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-700"><Layers3 aria-hidden="true" size={18} /><span className="text-xs font-bold uppercase tracking-[0.14em]">Manfaat reusable</span></div>
          <h2 className="mt-2 text-xl font-bold text-slate-950">Paket Akses</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">{packages.length} paket ditemukan.</p>
        </div>
        <Link href={`/lms/admin/penjualan/paket-akses/baru?returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
          <Plus aria-hidden="true" size={17} /> Buat Paket
        </Link>
      </header>
      <form action="/lms/admin/penjualan/paket-akses" className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-[1fr_180px_auto]">
        <label className="relative">
          <span className="sr-only">Cari Paket Akses</span>
          <Search aria-hidden="true" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={query.q || ''} placeholder="Cari Paket Akses…" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        </label>
        <select name="status" defaultValue={status} aria-label="Filter status Paket Akses" className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
          <option value="">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <button type="submit" className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-indigo-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">Terapkan</button>
      </form>
      {packages.length === 0 ? (
        <div className="px-5 py-14 text-center"><Layers3 aria-hidden="true" size={28} className="mx-auto text-slate-400" /><h3 className="mt-3 font-bold text-slate-950">Paket Akses tidak ditemukan</h3></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Paket</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Durasi</th><th className="px-4 py-3">Subscription aktif</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Tindakan</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {packages.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-4"><p className="font-bold text-slate-950">{item.name}</p><p className="mt-1 text-xs font-medium text-slate-500">Versi {item.version} · /{item.slug}</p></td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-900">{item.courses.length}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">{item.defaultAccessDurationValue ? `${item.defaultAccessDurationValue} ${item.defaultAccessDurationUnit?.toLowerCase()}` : 'Permanen'}</td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-900">{item.activeSubscriptionMembers}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{item.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td className="px-4 py-4 text-right"><Link href={`/lms/admin/penjualan/paket-akses/${item.id}?returnTo=${encodeURIComponent(returnTo)}`} aria-label={`Ubah ${item.name}`} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"><PencilLine aria-hidden="true" size={17} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
