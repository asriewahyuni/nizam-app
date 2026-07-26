'use client'

/**
 * Navigasi lokal Penjualan LMS: vertikal di desktop dan dapat digulir di mobile.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Boxes,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Layers3,
  Store,
  TicketPercent,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  {
    href: '/lms/admin/penjualan',
    label: 'Produk',
    description: 'Katalog kelas',
    icon: Boxes,
    matches: (pathname: string) => (
      pathname === '/lms/admin/penjualan'
      || pathname.startsWith('/lms/admin/penjualan/produk/')
    ),
  },
  {
    href: '/lms/admin/penjualan/paket-akses',
    label: 'Paket Akses',
    description: 'Gabungan course',
    icon: Layers3,
    matches: (pathname: string) => pathname.startsWith('/lms/admin/penjualan/paket-akses'),
  },
  {
    href: '/lms/admin/penjualan/consulting-360',
    label: 'Consulting 360',
    description: 'Paket privat',
    icon: BriefcaseBusiness,
    matches: (pathname: string) => pathname.startsWith('/lms/admin/penjualan/consulting-360'),
  },
  {
    href: '/lms/admin/penjualan/diskon',
    label: 'Kode Diskon',
    description: 'Promosi checkout',
    icon: TicketPercent,
    matches: (pathname: string) => pathname.startsWith('/lms/admin/penjualan/diskon'),
  },
  {
    href: '/lms/admin/penjualan/toko',
    label: 'Toko & Tampilan',
    description: 'Brand, halaman, domain',
    icon: Store,
    matches: (pathname: string) => pathname.startsWith('/lms/admin/penjualan/toko'),
  },
  {
    href: '/lms/admin/penjualan/ringkasan',
    label: 'Ringkasan',
    description: 'Kesiapan toko',
    icon: ChartNoAxesCombined,
    matches: (pathname: string) => pathname.startsWith('/lms/admin/penjualan/ringkasan'),
  },
]

export default function SalesSectionNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Bagian Penjualan LMS" className="min-w-0 max-w-full overflow-hidden">
      <div className="-mx-4 flex w-auto max-w-[calc(100vw-2rem)] gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:w-full lg:max-w-none lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
        {ITEMS.map((item) => {
          const active = item.matches(pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 lg:flex lg:w-full',
                active
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                  : 'border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950',
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg',
                  active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-white',
                )}
              >
                <Icon aria-hidden="true" size={16} />
              </span>
              <span>
                <span className="block whitespace-nowrap text-sm font-bold">{item.label}</span>
                <span className="hidden text-xs font-medium text-slate-500 lg:block">
                  {item.description}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
