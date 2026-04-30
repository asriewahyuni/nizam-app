'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Globe,
  Layers3,
  Package,
  Percent,
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react'
import {
  PageHeader,
  SafeButton,
  SectionCard,
  SectionHeader,
  StatCard,
  StatusBadge,
} from '@/components/ui/NizamUI'
import {
  getCapabilityStatusLabel,
  type EcommerceStorefrontView,
} from '@/modules/ecommerce/lib/ecommerce'
import { formatRupiah } from '@/lib/utils'

type EcommerceClientProps = {
  storefront: EcommerceStorefrontView
  warehouseCount: number
  activeBranchName: string | null
}

function getCapabilityVariant(status: 'live' | 'foundation' | 'next') {
  if (status === 'live') return 'success'
  if (status === 'foundation') return 'warning'
  return 'neutral'
}

export default function EcommerceClient({
  storefront,
  warehouseCount,
  activeBranchName,
}: EcommerceClientProps) {
  const storeUrl = `/toko/${storefront.org.slug}`
  const topProducts = storefront.products.slice(0, 6)

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-24">
      <PageHeader
        tag="Odoo-Inspired Commerce"
        title="E-Commerce"
        subtitle="Etalase online yang nyambung ke master produk, promo, dan follow-up sales di ERP."
        icon={<Store />}
        actions={
          <>
            <Link href={storeUrl} className="inline-flex">
              <SafeButton variant="white" icon={<Globe size={18} />}>
                Buka Storefront
              </SafeButton>
            </Link>
            <Link href="/sales/promos" className="inline-flex">
              <SafeButton variant="primary" icon={<Percent size={18} />}>
                Kelola Promo
              </SafeButton>
            </Link>
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Produk Aktif"
          value={storefront.stats.activeProducts}
          sub="Tampil di etalase"
          icon={Package}
          color="blue"
        />
        <StatCard
          label="Stok Siap Jual"
          value={storefront.stats.readyStock}
          sub="Produk bisa langsung diorder"
          icon={ShoppingCart}
          color="emerald"
        />
        <StatCard
          label="Promo Aktif"
          value={storefront.stats.activePromos}
          sub="Kode promo publik"
          icon={Percent}
          color="amber"
        />
        <StatCard
          label="Kategori"
          value={storefront.stats.totalCategories}
          sub={warehouseCount > 0 ? `${warehouseCount} gudang aktif` : 'Gudang belum terbaca'}
          icon={Layers3}
          color="indigo"
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard className="overflow-hidden border-0 bg-[linear-gradient(145deg,#0f172a_0%,#123c52_50%,#f97316_140%)] text-white shadow-[0_35px_90px_-35px_rgba(15,23,42,0.6)]">
          <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <div className="absolute -right-12 -top-10 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full bg-orange-300/15 blur-3xl" />
            <div className="relative space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100">
                Storefront Siap Dipakai
              </div>
              <h2 className="max-w-3xl text-4xl font-black tracking-tighter sm:text-5xl">
                Buat katalog publik yang rasanya dekat dengan Odoo, tapi tetap menyatu dengan alur kerja Nizam.
              </h2>
              <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-200">
                Pelanggan bisa cari produk, pakai promo, tambah ke keranjang, lalu kirim permintaan order yang otomatis masuk sebagai draft quotation di ERP.
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Branch Aktif</div>
                  <div className="mt-2 text-lg font-black">{activeBranchName || 'Semua Cabang'}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Store URL</div>
                  <div className="mt-2 text-sm font-black break-all">{storeUrl}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">MVP Scope</div>
                  <div className="mt-2 text-sm font-bold">Catalog, cart, promo, dan quotation request</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link href={storeUrl} className="inline-flex">
                  <SafeButton variant="white" icon={<Globe size={18} />}>
                    Lihat Etalase Publik
                  </SafeButton>
                </Link>
                <Link href="/inventory" className="inline-flex">
                  <SafeButton variant="ghost" icon={<Package size={18} />}>
                    Cek Master Produk
                  </SafeButton>
                </Link>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Blueprint Fitur"
            subtitle="Pemetaan fitur yang meniru pola inti Odoo eCommerce."
            icon={Truck}
          />
          <div className="space-y-4">
            {storefront.capabilities.map((capability) => (
              <div key={capability.id} className="rounded-[26px] border border-slate-100 bg-slate-50/80 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black tracking-tight text-slate-900">{capability.title}</h3>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{capability.description}</p>
                  </div>
                  <StatusBadge label={getCapabilityStatusLabel(capability.status)} variant={getCapabilityVariant(capability.status)} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <SectionCard>
          <SectionHeader
            title="Produk Teratas"
            subtitle="Sampel produk yang sudah siap muncul di etalase publik."
            icon={Package}
            actions={
              <Link href="/inventory" className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                Kelola Produk
              </Link>
            }
          />
          <div className="grid gap-4 md:grid-cols-2">
            {topProducts.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-bold text-slate-500 md:col-span-2">
                Belum ada produk aktif yang siap ditampilkan.
              </div>
            )}

            {topProducts.map((product) => (
              <div key={product.id} className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{product.category}</p>
                    <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">{product.name}</h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">{product.sku || 'Tanpa SKU'}</p>
                  </div>
                  <StatusBadge
                    label={product.isInStock ? (product.isLowStock ? 'Stok Tipis' : 'Ready') : 'Habis'}
                    variant={product.isInStock ? (product.isLowStock ? 'warning' : 'success') : 'error'}
                  />
                </div>
                <p className="mt-4 text-sm font-black text-slate-900">{formatRupiah(product.price)}</p>
                <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
                  {product.description || 'Produk ini sudah bisa dipajang di storefront publik dan diarahkan ke draft quotation.'}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Langkah Lanjut"
            subtitle="Bagian yang paling logis untuk disambung setelah MVP ini hidup."
            icon={ArrowRight}
          />
          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-100 bg-slate-50/70 p-5">
              <h3 className="text-sm font-black text-slate-900">Varian produk seperti ukuran dan warna</h3>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                Perlu tabel atribut dan varian agar pilihan produk benar-benar setara dengan konsep Odoo.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-100 bg-slate-50/70 p-5">
              <h3 className="text-sm font-black text-slate-900">Checkout pembayaran otomatis</h3>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                Tahap berikutnya bisa menambahkan payment gateway, biaya ongkir dinamis, dan status pembayaran real-time.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-100 bg-slate-50/70 p-5">
              <h3 className="text-sm font-black text-slate-900">B2B price list dan customer portal</h3>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                Kalau Anda ingin benar-benar mendekati Odoo, ini area berikutnya yang paling berdampak.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
