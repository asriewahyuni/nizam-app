/**
 * Pusat penjualan kelas di dalam LMS.
 * Halaman ini memakai data dan action commerce yang sama dengan /ecommerce.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, ExternalLink, Layers3, PackageCheck, ShoppingCart } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getEcommerceDashboardData } from '@/modules/ecommerce/lib/ecommerce.server'
import LmsSimpleSalesManager from './LmsSimpleSalesManager'
import { LmsCommerceSetupButton } from './LmsCommerceSetupButton'

export const metadata = {
  title: 'Penjualan Kelas — Nizam LMS',
  description: 'Kelola produk kelas, multi-course, paket akses, dan checkout dari LMS.',
}

export default async function LmsCourseCommercePage() {
  const orgData = await getActiveOrg()
  if (!orgData?.org?.id) redirect('/onboarding')

  const dashboardData = await getEcommerceDashboardData()
  const activePackages = dashboardData.accessPackages.filter((item) => item.isActive).length
  const publishedProducts = dashboardData.storeProducts.filter((item) => item.isPublished).length
  const productsWithBenefits = dashboardData.productEntitlements.filter(
    (item) => item.resolvedCourseIds.length > 0,
  ).length
  const stats = [
    {
      label: 'Course Tersedia',
      value: dashboardData.learningCourses.length,
      sub: 'Siap dipilih sebagai manfaat',
      icon: <BookOpen aria-hidden="true" size={18} />,
      tone: 'border-indigo-100 bg-indigo-50/70 text-indigo-700',
    },
    {
      label: 'Produk Tayang',
      value: publishedProducts,
      sub: 'Tersedia pada store',
      icon: <PackageCheck aria-hidden="true" size={18} />,
      tone: 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
    },
    {
      label: 'Produk Berisi Course',
      value: productsWithBenefits,
      sub: 'Direct atau melalui paket',
      icon: <ShoppingCart aria-hidden="true" size={18} />,
      tone: 'border-blue-100 bg-blue-50/70 text-blue-700',
    },
    {
      label: 'Paket Akses Aktif',
      value: activePackages,
      sub: 'Dapat dipakai ulang',
      icon: <Layers3 aria-hidden="true" size={18} />,
      tone: 'border-amber-100 bg-amber-50/70 text-amber-700',
    },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            <ShoppingCart aria-hidden="true" size={15} />
            LMS · Penjualan
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Penjualan Kelas
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
            Atur produk kelas, manfaat multi-course, paket akses, dan tautan checkout tanpa keluar dari LMS.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/ecommerce"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
          >
            Buka E-Commerce Lengkap
            <ExternalLink aria-hidden="true" size={16} />
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <section
            key={stat.label}
            className={`rounded-xl border p-4 shadow-sm ${stat.tone}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {stat.label}
                </p>
                <p className="mt-2 font-mono text-2xl font-bold text-slate-950">{stat.value}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-white shadow-sm">
                {stat.icon}
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-600">{stat.sub}</p>
          </section>
        ))}
      </div>

      {dashboardData.stores.length === 0 ? (
        <LmsCommerceSetupButton />
      ) : (
        <LmsSimpleSalesManager dashboardData={dashboardData} />
      )}
    </div>
  )
}
