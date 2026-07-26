/**
 * Daftar kode diskon LMS.
 */
import Link from 'next/link'
import { Plus, Search, TicketPercent } from 'lucide-react'
import { getLmsCouponSalesData } from '@/modules/ecommerce/lib/lms-sales.server'
import CouponListClient from '../CouponListClient'
import SalesPagination from '../SalesPagination'

export const metadata = { title: 'Kode Diskon — Nizam LMS' }

export default async function CouponListPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const [data, query] = await Promise.all([getLmsCouponSalesData(), searchParams])
  const q = String(query.q || '').trim().toLowerCase()
  const status = ['active', 'inactive'].includes(String(query.status)) ? String(query.status) : ''
  const requestedPage = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)
  const filtered = data.coupons.filter((coupon) => {
    if (q && !coupon.code.toLowerCase().includes(q)) return false
    if (status === 'active' && !coupon.isActive) return false
    if (status === 'inactive' && coupon.isActive) return false
    return true
  })
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(requestedPage, totalPages)
  const coupons = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (status) params.set('status', status)
  if (currentPage > 1) params.set('page', String(currentPage))
  const returnTo = `/lms/admin/penjualan/diskon${params.size ? `?${params.toString()}` : ''}`

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex items-center gap-2 text-indigo-700"><TicketPercent aria-hidden="true" size={18} /><span className="text-xs font-bold uppercase tracking-[0.14em]">Promosi checkout</span></div><h2 className="mt-2 text-xl font-bold text-slate-950">Kode Diskon</h2><p className="mt-1 text-sm font-medium text-slate-600">{filtered.length} kode ditemukan.</p></div>
        <Link href={`/lms/admin/penjualan/diskon/baru?returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"><Plus aria-hidden="true" size={17} />Buat Kode</Link>
      </header>
      <form action="/lms/admin/penjualan/diskon" className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-[1fr_180px_auto]">
        <label className="relative"><span className="sr-only">Cari kode diskon</span><Search aria-hidden="true" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={query.q || ''} placeholder="Cari kode…" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" /></label>
        <select name="status" defaultValue={status} aria-label="Filter status kode diskon" className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"><option value="">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select>
        <button type="submit" className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-indigo-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">Terapkan</button>
      </form>
      {coupons.length === 0 ? <div className="px-5 py-14 text-center"><TicketPercent aria-hidden="true" size={28} className="mx-auto text-slate-400" /><h3 className="mt-3 font-bold text-slate-950">Kode diskon tidak ditemukan</h3></div> : <CouponListClient coupons={coupons} products={data.storeProducts} returnTo={returnTo} />}
      <SalesPagination pathname="/lms/admin/penjualan/diskon" currentPage={currentPage} totalPages={totalPages} query={{ q: query.q, status }} />
    </section>
  )
}
