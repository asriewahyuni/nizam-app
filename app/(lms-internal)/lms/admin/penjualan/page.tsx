/**
 * Daftar produk LMS. Consulting 360 dikelola pada bagian tersendiri.
 */
import Link from 'next/link'
import { Boxes, Plus, Search } from 'lucide-react'
import { getLmsProductSalesData } from '@/modules/ecommerce/lib/lms-sales.server'
import { LmsCommerceSetupButton } from './LmsCommerceSetupButton'
import ProductListClient from './ProductListClient'
import SalesPagination from './SalesPagination'

export const metadata = {
  title: 'Produk Penjualan — Nizam LMS',
  description: 'Kelola produk kelas dan manfaat LMS.',
}

type SearchParams = Promise<{
  q?: string
  status?: string
  type?: string
  page?: string
}>

export default async function LmsProductSalesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const query = await searchParams
  const data = await getLmsProductSalesData()
  const q = String(query.q || '').trim().toLowerCase()
  const status = ['published', 'draft'].includes(String(query.status))
    ? String(query.status)
    : ''
  const type = ['subscription', 'onetime'].includes(String(query.type))
    ? String(query.type)
    : ''
  const requestedPage = Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1)

  const filteredProducts = data.storeProducts.filter((product) => {
    if (q && !`${product.publicName} ${product.shortDescription}`.toLowerCase().includes(q)) {
      return false
    }
    if (status === 'published' && !product.isPublished) return false
    if (status === 'draft' && product.isPublished) return false
    if (type === 'subscription' && !product.subscriptionPlan) return false
    if (type === 'onetime' && product.subscriptionPlan) return false
    return true
  })
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const currentPage = Math.min(requestedPage, totalPages)
  const visibleProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const currentParams = new URLSearchParams()
  if (query.q) currentParams.set('q', query.q)
  if (status) currentParams.set('status', status)
  if (type) currentParams.set('type', type)
  if (currentPage > 1) currentParams.set('page', String(currentPage))
  const returnTo = `/lms/admin/penjualan${currentParams.size ? `?${currentParams.toString()}` : ''}`

  if (data.stores.length === 0) {
    return <LmsCommerceSetupButton />
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-700">
            <Boxes aria-hidden="true" size={18} />
            <span className="text-xs font-bold uppercase tracking-[0.14em]">Katalog LMS</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-950">Produk</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {filteredProducts.length} produk ditemukan. Consulting 360 berada di bagian tersendiri.
          </p>
        </div>
        <Link
          href={`/lms/admin/penjualan/produk/baru?returnTo=${encodeURIComponent(returnTo)}`}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
        >
          <Plus aria-hidden="true" size={17} />
          Tambah Produk
        </Link>
      </div>

      <form
        action="/lms/admin/penjualan"
        className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto]"
      >
        <label className="relative">
          <span className="sr-only">Cari produk</span>
          <Search
            aria-hidden="true"
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            name="q"
            defaultValue={query.q || ''}
            placeholder="Cari nama atau deskripsi…"
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </label>
        <label>
          <span className="sr-only">Filter status</span>
          <select
            name="status"
            defaultValue={status}
            className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          >
            <option value="">Semua status</option>
            <option value="published">Tayang</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filter jenis produk</span>
          <select
            name="type"
            defaultValue={type}
            className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          >
            <option value="">Semua jenis</option>
            <option value="onetime">Sekali bayar</option>
            <option value="subscription">Langganan</option>
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
        >
          Terapkan
        </button>
      </form>

      {visibleProducts.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <Boxes aria-hidden="true" size={22} />
          </div>
          <h3 className="mt-4 font-bold text-slate-950">Produk tidak ditemukan</h3>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Ubah filter atau buat produk penjualan LMS yang pertama.
          </p>
        </div>
      ) : (
        <ProductListClient
          products={visibleProducts}
          entitlements={data.productEntitlements}
          orgSlug={data.org.slug}
          storeSlug={data.stores[0]?.slug || ''}
          returnTo={returnTo}
          primaryLmsHostname={data.primaryLmsHostname}
        />
      )}

      <SalesPagination
        pathname="/lms/admin/penjualan"
        currentPage={currentPage}
        totalPages={totalPages}
        query={{ q: query.q, status, type }}
      />
    </section>
  )
}
