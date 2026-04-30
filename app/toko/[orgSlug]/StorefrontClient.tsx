'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Minus,
  Package,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react'
import { SafeButton } from '@/components/ui/NizamUI'
import { cn, formatRupiah } from '@/lib/utils'
import {
  buildCartPreview,
  ECOMMERCE_DELIVERY_OPTIONS,
  type EcommerceStorefrontView,
} from '@/modules/ecommerce/lib/ecommerce'

type StorefrontClientProps = {
  storefront: EcommerceStorefrontView
}

type CheckoutState = {
  fullName: string
  phone: string
  email: string
  address: string
  notes: string
  promoCode: string
  website: string
}

const ALL_CATEGORY = 'Semua'

export default function StorefrontClient({ storefront }: StorefrontClientProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [checkout, setCheckout] = useState<CheckoutState>({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    promoCode: '',
    website: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createdSaleNumber, setCreatedSaleNumber] = useState<string | null>(null)

  const deferredQuery = useDeferredValue(query)
  const categories = useMemo(() => [ALL_CATEGORY, ...storefront.categories], [storefront.categories])

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase()

    return storefront.products.filter((product) => {
      const matchesCategory = activeCategory === ALL_CATEGORY || product.category === activeCategory
      if (!matchesCategory) return false
      if (!normalizedQuery) return true

      const haystack = [
        product.name,
        product.sku || '',
        product.description || '',
        product.category,
      ].join(' ').toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [activeCategory, deferredQuery, storefront.products])

  const cartPreview = useMemo(
    () => buildCartPreview(storefront.products, cart, checkout.promoCode, storefront.promos),
    [cart, checkout.promoCode, storefront.products, storefront.promos],
  )

  function updateCart(productId: string, nextQuantity: number) {
    setCart((current) => {
      const safeQuantity = Math.max(0, Math.min(999, Math.trunc(nextQuantity)))
      if (safeQuantity <= 0) {
        const nextCart = { ...current }
        delete nextCart[productId]
        return nextCart
      }

      return {
        ...current,
        [productId]: safeQuantity,
      }
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setCreatedSaleNumber(null)

    try {
      const response = await fetch('/api/ecommerce/order-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgSlug: storefront.org.slug,
          fullName: checkout.fullName,
          phone: checkout.phone,
          email: checkout.email,
          address: checkout.address,
          notes: checkout.notes,
          promoCode: checkout.promoCode,
          website: checkout.website,
          items: cartPreview.lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        }),
      })

      const payload = (await response.json()) as {
        error?: string
        success?: boolean
        successMessage?: string
        saleNumber?: string
      }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Gagal mengirim permintaan order.')
      }

      setSuccess(payload.successMessage || 'Permintaan order berhasil dikirim.')
      setCreatedSaleNumber(payload.saleNumber || null)
      setCart({})
      setCheckout({
        fullName: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        promoCode: '',
        website: '',
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Gagal mengirim permintaan order.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_38%,#fff7ed_100%)] text-slate-900">
      <div className="relative overflow-hidden border-b border-slate-200/70">
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_26%)]" />
        <div className="absolute -left-16 top-16 h-56 w-56 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-orange-300/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-6 lg:px-8">
          <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-slate-200 bg-white text-slate-900 shadow-lg">
                <Store size={24} strokeWidth={2.6} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">{storefront.hero.eyebrow}</div>
                <div className="mt-1 text-lg font-black tracking-tight text-slate-950">{storefront.org.name}</div>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full border border-cyan-200 bg-white/90 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-800 shadow-sm">
              <Sparkles size={14} />
              {storefront.hero.announcement}
            </div>
          </header>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <section className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-600 shadow-sm">
                <ShieldCheck size={14} />
                Sinkron ke stok dan sales
              </div>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-5xl font-black tracking-tighter text-slate-950 sm:text-6xl">
                  {storefront.hero.title}
                </h1>
                <p className="max-w-3xl text-base font-medium leading-relaxed text-slate-600 sm:text-lg">
                  {storefront.hero.subtitle}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex h-14 items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-5 shadow-sm">
                  <Search size={18} className="text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari produk, SKU, atau kategori..."
                    className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </label>
                <div className="flex items-center gap-2 rounded-[24px] border border-slate-200 bg-white px-5 shadow-sm">
                  <Package size={18} className="text-slate-400" />
                  <div className="text-sm font-bold text-slate-700">
                    {filteredProducts.length} produk tampil
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Produk Aktif</div>
                  <div className="mt-2 text-2xl font-black tracking-tight">{storefront.stats.activeProducts}</div>
                </div>
                <div className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ready Stock</div>
                  <div className="mt-2 text-2xl font-black tracking-tight">{storefront.stats.readyStock}</div>
                </div>
                <div className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Promo Aktif</div>
                  <div className="mt-2 text-2xl font-black tracking-tight">{storefront.stats.activePromos}</div>
                </div>
                <div className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Kategori</div>
                  <div className="mt-2 text-2xl font-black tracking-tight">{storefront.stats.totalCategories}</div>
                </div>
              </div>
            </section>

            <aside className="rounded-[36px] border border-white/80 bg-white/90 p-6 shadow-[0_30px_70px_-30px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Promo yang Bisa Dipakai</div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Belanja lalu kirim ke quotation</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Percent size={22} />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {storefront.promos.length === 0 && (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-500">
                    Belum ada promo aktif. Anda tetap bisa kirim permintaan order dari keranjang.
                  </div>
                )}

                {storefront.promos.slice(0, 3).map((promo) => (
                  <button
                    key={promo.id}
                    type="button"
                    onClick={() => setCheckout((current) => ({ ...current, promoCode: promo.code }))}
                    className="flex w-full items-center justify-between rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50"
                  >
                    <div>
                      <div className="text-sm font-black tracking-tight text-slate-900">{promo.label}</div>
                      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{promo.code}</div>
                    </div>
                    <ArrowRight size={18} className="text-slate-400" />
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
        <section className="space-y-8">
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition',
                  activeCategory === category
                    ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                )}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.length === 0 && (
              <div className="rounded-[32px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm font-bold text-slate-500 md:col-span-2 xl:col-span-3">
                Tidak ada produk yang cocok dengan pencarian Anda.
              </div>
            )}

            {filteredProducts.map((product) => {
              const quantity = cart[product.id] || 0

              return (
                <article
                  key={product.id}
                  className="group rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{product.category}</div>
                      <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">{product.name}</h3>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]',
                        product.isInStock
                          ? product.isLowStock
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      )}
                    >
                      {product.isInStock ? (product.isLowStock ? 'Stok Tipis' : 'Ready') : 'Habis'}
                    </span>
                  </div>

                  <div className="mt-4 flex h-36 items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)]">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-cyan-700 shadow-lg">
                      <Package size={28} strokeWidth={2.4} />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <p className="text-2xl font-black tracking-tight text-slate-950">{formatRupiah(product.price)}</p>
                    <p className="text-xs font-medium leading-relaxed text-slate-500">
                      {product.description || 'Produk ini sudah terhubung ke katalog online dan siap diminta sebagai quotation.'}
                    </p>
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      <span>{product.sku || 'Tanpa SKU'}</span>
                      <span>
                        {product.isTrackedStock
                          ? `${product.stockAvailable} ${product.unit}`
                          : 'By Request'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="flex items-center rounded-full border border-slate-200 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => updateCart(product.id, quantity - 1)}
                        className="flex h-10 w-10 items-center justify-center text-slate-500 transition hover:text-slate-900"
                        disabled={quantity <= 0}
                      >
                        <Minus size={16} />
                      </button>
                      <div className="min-w-10 text-center text-sm font-black text-slate-900">{quantity}</div>
                      <button
                        type="button"
                        onClick={() => updateCart(product.id, quantity + 1)}
                        className="flex h-10 w-10 items-center justify-center text-slate-500 transition hover:text-slate-900"
                        disabled={!product.isInStock}
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateCart(product.id, quantity + 1)}
                      disabled={!product.isInStock}
                      className="inline-flex items-center gap-2 rounded-[20px] bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <ShoppingCart size={14} />
                      Tambah
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Truck size={22} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fulfillment</div>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Pilihan pengiriman ala toko online</h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {ECOMMERCE_DELIVERY_OPTIONS.map((option) => (
                <div key={option.id} className="rounded-[28px] border border-slate-100 bg-slate-50/70 p-5">
                  <h3 className="text-sm font-black text-slate-900">{option.title}</h3>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{option.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_25px_70px_-30px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Keranjang</div>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Minta quotation</h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
                <ShoppingCart size={22} />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {cartPreview.lines.length === 0 && (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">
                  Tambahkan produk dulu, nanti sistem akan buat draft quotation di ERP.
                </div>
              )}

              {cartPreview.lines.map((line) => (
                <div key={line.product.id} className="rounded-[26px] border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black tracking-tight text-slate-900">{line.product.name}</h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">{formatRupiah(line.product.price)} / {line.product.unit}</p>
                    </div>
                    <div className="text-sm font-black text-slate-900">{formatRupiah(line.lineTotal)}</div>
                  </div>

                  <div className="mt-4 flex items-center rounded-full border border-slate-200 bg-white w-fit">
                    <button
                      type="button"
                      onClick={() => updateCart(line.product.id, line.quantity - 1)}
                      className="flex h-9 w-9 items-center justify-center text-slate-500 hover:text-slate-900"
                    >
                      <Minus size={15} />
                    </button>
                    <div className="min-w-10 text-center text-sm font-black text-slate-900">{line.quantity}</div>
                    <button
                      type="button"
                      onClick={() => updateCart(line.product.id, line.quantity + 1)}
                      className="flex h-9 w-9 items-center justify-center text-slate-500 hover:text-slate-900"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3 rounded-[28px] border border-slate-100 bg-slate-50/80 p-5">
              <div className="flex items-center justify-between text-sm font-bold text-slate-500">
                <span>Subtotal</span>
                <span>{formatRupiah(cartPreview.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-slate-500">
                <span>Diskon promo</span>
                <span>{cartPreview.discount > 0 ? `- ${formatRupiah(cartPreview.discount)}` : '-'}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-black text-slate-950">
                <span>Estimasi total</span>
                <span>{formatRupiah(cartPreview.grandTotal)}</span>
              </div>
              {cartPreview.promo && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                  Promo {cartPreview.promo.code} aktif: {cartPreview.promo.label}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <input
                type="text"
                value={checkout.website}
                onChange={(event) => setCheckout((current) => ({ ...current, website: event.target.value }))}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              <input
                value={checkout.fullName}
                onChange={(event) => setCheckout((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="Nama lengkap"
                required
                className="h-12 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-slate-900"
              />
              <input
                value={checkout.phone}
                onChange={(event) => setCheckout((current) => ({ ...current, phone: event.target.value }))}
                placeholder="No. WhatsApp"
                required
                className="h-12 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-slate-900"
              />
              <input
                value={checkout.email}
                onChange={(event) => setCheckout((current) => ({ ...current, email: event.target.value }))}
                placeholder="Email"
                type="email"
                className="h-12 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-slate-900"
              />
              <input
                value={checkout.address}
                onChange={(event) => setCheckout((current) => ({ ...current, address: event.target.value }))}
                placeholder="Alamat pengiriman / pickup"
                className="h-12 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-slate-900"
              />
              <input
                value={checkout.promoCode}
                onChange={(event) => setCheckout((current) => ({ ...current, promoCode: event.target.value.toUpperCase() }))}
                placeholder="Kode promo"
                className="h-12 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 text-sm font-bold uppercase outline-none focus:border-slate-900"
              />
              <textarea
                value={checkout.notes}
                onChange={(event) => setCheckout((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Catatan tambahan untuk tim sales"
                rows={4}
                className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium outline-none focus:border-slate-900"
              />

              {error && (
                <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    <span>{success}</span>
                  </div>
                  {createdSaleNumber && (
                    <div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-800">
                      Nomor draft: {createdSaleNumber}
                    </div>
                  )}
                </div>
              )}

              <SafeButton
                type="submit"
                variant="primary"
                size="lg"
                isLoading={submitting}
                disabled={cartPreview.lines.length === 0}
                className="w-full"
              >
                Kirim ke Tim Sales
              </SafeButton>

              <p className="text-xs font-medium leading-relaxed text-slate-500">
                Setelah dikirim, sistem membuat draft quotation di ERP agar tim Anda bisa lanjut follow-up, cek stok, dan finalisasi ongkir/pembayaran.
              </p>
            </form>
          </div>
        </aside>
      </main>
    </div>
  )
}
