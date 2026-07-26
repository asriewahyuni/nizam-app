/**
 * Ringkasan dan kesiapan penjualan LMS.
 */
import Link from 'next/link'
import {
  Boxes,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Layers3,
  Plus,
  Store,
  TicketPercent,
} from 'lucide-react'
import { getLmsSalesSummaryData } from '@/modules/ecommerce/lib/lms-sales.server'

export const metadata = { title: 'Ringkasan Penjualan — Nizam LMS' }

export default async function LmsSalesSummaryPage() {
  const { dashboard, consulting } = await getLmsSalesSummaryData()
  const store = dashboard.stores[0]
  const standardProducts = dashboard.storeProducts.filter(
    (item) => item.offeringType !== 'CONSULTING_1_ON_1',
  )
  const publishedProducts = standardProducts.filter((item) => item.isPublished).length
  const productsWithBenefits = new Set(
    dashboard.productEntitlements
      .filter((item) => item.resolvedCourseIds.length > 0)
      .map((item) => item.storeProductId),
  ).size
  const activePackages = dashboard.accessPackages.filter((item) => item.isActive).length
  const activeCoupons = dashboard.coupons.filter((item) => item.isActive).length

  const cards = [
    { label: 'Produk tayang', value: publishedProducts, detail: `${standardProducts.length} produk standar`, icon: Boxes, tone: 'bg-indigo-50 text-indigo-800' },
    { label: 'Produk berisi course', value: productsWithBenefits, detail: 'Course langsung atau paket', icon: CheckCircle2, tone: 'bg-blue-50 text-blue-800' },
    { label: 'Paket Akses aktif', value: activePackages, detail: `${dashboard.accessPackages.length} paket total`, icon: Layers3, tone: 'bg-amber-50 text-amber-900' },
    { label: 'Consulting 360', value: consulting.offerings.length, detail: `${consulting.engagements.filter((item) => ['ACTIVE', 'IN_PROGRESS'].includes(item.status)).length} engagement berjalan`, icon: BriefcaseBusiness, tone: 'bg-teal-50 text-teal-900' },
    { label: 'Kode diskon aktif', value: activeCoupons, detail: `${dashboard.coupons.length} kode total`, icon: TicketPercent, tone: 'bg-violet-50 text-violet-900' },
  ]

  const readiness = [
    { label: 'Toko tersedia', ready: Boolean(store), detail: store?.name || 'Siapkan toko dari halaman Produk.' },
    { label: 'Toko aktif dan tayang', ready: Boolean(store?.isActive && store?.isPublished), detail: store?.isPublished ? 'Etalase dapat dibuka publik.' : 'Toko belum ditayangkan.' },
    { label: 'Rekening penerimaan', ready: dashboard.bankAccounts.length > 0, detail: `${dashboard.bankAccounts.length} rekening tersedia.` },
    { label: 'Produk siap checkout', ready: publishedProducts > 0, detail: `${publishedProducts} produk standar tayang.` },
    { label: 'Manfaat LMS terhubung', ready: productsWithBenefits > 0, detail: `${productsWithBenefits} produk memberikan akses course.` },
  ]

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">Kinerja utama</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">Ringkasan Penjualan LMS</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">Gambaran singkat tanpa memenuhi halaman operasional.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <article key={card.label} className={`rounded-xl border border-white/70 p-4 ${card.tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-wide opacity-75">{card.label}</p><p className="mt-2 font-mono text-2xl font-bold text-slate-950">{card.value}</p></div>
                  <span className="flex size-9 items-center justify-center rounded-lg bg-white/80"><Icon aria-hidden="true" size={17} /></span>
                </div>
                <p className="mt-3 text-xs font-semibold opacity-80">{card.detail}</p>
              </article>
            )
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Store aria-hidden="true" size={19} /></span>
            <div><h3 className="font-bold text-slate-950">Kesiapan toko</h3><p className="text-sm font-medium text-slate-600">Pemeriksaan minimum sebelum link dibagikan.</p></div>
          </div>
          <ul className="mt-5 divide-y divide-slate-100">
            {readiness.map((item) => (
              <li key={item.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                {item.ready ? <CheckCircle2 aria-hidden="true" size={19} className="mt-0.5 shrink-0 text-emerald-700" /> : <CircleAlert aria-hidden="true" size={19} className="mt-0.5 shrink-0 text-amber-700" />}
                <div><p className="text-sm font-bold text-slate-900">{item.label}</p><p className="mt-0.5 text-xs font-medium text-slate-500">{item.detail}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-300">Tindakan cepat</p>
          <h3 className="mt-2 text-lg font-bold">Lanjutkan pekerjaan utama</h3>
          <div className="mt-5 space-y-2">
            {[
              { href: '/lms/admin/penjualan/produk/baru', label: 'Buat produk', icon: Plus },
              { href: '/lms/admin/penjualan/paket-akses/baru', label: 'Buat Paket Akses', icon: Layers3 },
              { href: '/lms/admin/penjualan/consulting-360/baru', label: 'Buat Consulting 360', icon: BriefcaseBusiness },
              { href: '/lms/admin/penjualan/diskon/baru', label: 'Buat kode diskon', icon: TicketPercent },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-700 px-3 text-sm font-bold text-slate-100 transition-colors hover:border-teal-400 hover:bg-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">
                  <Icon aria-hidden="true" size={17} className="text-teal-300" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
