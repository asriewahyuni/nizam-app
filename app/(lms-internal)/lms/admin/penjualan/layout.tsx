/**
 * Kerangka bersama area Penjualan LMS.
 */
import Link from 'next/link'
import { ExternalLink, ShoppingCart, Store } from 'lucide-react'
import { getLmsSalesHeaderData } from '@/modules/ecommerce/lib/lms-sales.server'
import SalesSectionNav from './SalesSectionNav'

export default async function LmsSalesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { org, stores } = await getLmsSalesHeaderData()
  const defaultStore = stores[0]
  const storefrontUrl = defaultStore
    ? `/toko/${org.slug}/${defaultStore.slug}`
    : null

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            <ShoppingCart aria-hidden="true" size={15} />
            LMS · Penjualan
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Penjualan Kelas
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-slate-600">
            <span>Kelola produk, akses, konsultasi, dan promosi dari satu area.</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${defaultStore?.isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              {defaultStore
                ? `${defaultStore.name} · ${defaultStore.isPublished ? 'Tayang' : 'Belum tayang'}`
                : 'Toko belum disiapkan'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {storefrontUrl && (
            <Link
              href={storefrontUrl}
              target="_blank"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
            >
              <Store aria-hidden="true" size={16} />
              Buka Toko
            </Link>
          )}
          <Link
            href="/ecommerce"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
          >
            E-Commerce Lengkap
            <ExternalLink aria-hidden="true" size={16} />
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 max-w-full overflow-hidden lg:sticky lg:top-24 lg:self-start lg:overflow-visible">
          <SalesSectionNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}
