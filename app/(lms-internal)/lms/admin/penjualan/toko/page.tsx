/**
 * Pintu masuk pengaturan toko LMS. Toko pertama dipilih otomatis agar admin
 * tidak perlu melewati langkah teknis E-Commerce.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CircleAlert, Store } from 'lucide-react'
import { getLmsStoreSettingsData } from '@/modules/ecommerce/lib/lms-sales.server'

export default async function LmsStoreSettingsIndexPage() {
  const data = await getLmsStoreSettingsData()
  if (data.selectedStore) {
    redirect(`/lms/admin/penjualan/toko/${data.selectedStore.id}?tab=identitas`)
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
          <CircleAlert aria-hidden="true" size={20} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-950">Toko LMS belum tersedia</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Buat toko satu kali. Setelah itu seluruh identitas, halaman, pembayaran,
            dan domain dapat dikelola langsung dari area LMS ini.
          </p>
          <Link
            href="/ecommerce"
            className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
          >
            <Store aria-hidden="true" size={17} />
            Siapkan toko pertama
          </Link>
        </div>
      </div>
    </section>
  )
}
