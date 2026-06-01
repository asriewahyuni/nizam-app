'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  Sparkles,
  Store,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import {
  formatStoreThemeButtonRadius,
  formatStoreThemeRadius,
  formatThemeShadow,
  resolveShippingRateForAddress,
  resolveThemeFontFamily,
  type StoreThemeBlock,
  type StorefrontProductView,
  type StorefrontPublicPayload,
} from '@/modules/ecommerce/lib/ecommerce'
import { formatRupiah } from '@/lib/utils'
import { SectionHeader } from '@/components/ui/NizamUI'

type StorefrontClientProps = {
  payload: StorefrontPublicPayload
  pageMode: 'home' | 'collection' | 'product' | 'cart'
  initialProductSlug?: string | null
  interactive?: boolean
  embedded?: boolean
}

type CartEntry = {
  productId: string
  variantId: string | null
  quantity: number
}

type CheckoutResult = {
  orderNumber: string
  paymentDueAt: string | null
  transferInstructions: string
  grandTotal: number
  orderAccessUrl: string
}

function getStorageKey(storeId: string) {
  return `nizam_store_cart:${storeId}`
}

function getStoreInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'ST'
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

function getCartHref(orgSlug: string, storeSlug: string) {
  return `/toko/${orgSlug}/${storeSlug}/keranjang`
}

function SectionHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
          {eyebrow}
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h2>
        {body ? (
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
            {body}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

function EmptyCatalogState({
  accent,
  buttonRadius,
  orgSlug,
  storeSlug,
}: {
  accent: string
  buttonRadius: string
  orgSlug: string
  storeSlug: string
}) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-dashed border-slate-300 bg-white/90 p-6 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.45)] sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
            <Sparkles size={14} />
            Menu segera hadir
          </div>
          <h3 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Tim kami sedang menyiapkan pilihan menu terbaik untuk Anda.
          </h3>
          <p className="text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
            Untuk sementara etalase ini masih dirapikan. Silakan cek halaman koleksi lagi sebentar lagi atau hubungi tim kami bila acara Anda perlu disiapkan segera.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/toko/${orgSlug}/${storeSlug}/koleksi`}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black text-white"
              style={{ backgroundColor: accent, borderRadius: buttonRadius }}
            >
              Buka Halaman Koleksi
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {[
            'Paket rapat praktis',
            'Menu keluarga lebih lengkap',
            'Pilihan premium untuk tamu penting',
          ].map((label) => (
            <div key={label} className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-white p-2 text-slate-700 shadow-sm">
                  <CheckCircle2 size={16} />
                </div>
                <div className="text-sm font-bold leading-relaxed text-slate-700">
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProductCard({
  product,
  onAdd,
  onOpen,
  accent,
  border,
  radius,
  inStock,
  showQuickAdd,
}: {
  product: StorefrontProductView
  onAdd: () => void
  onOpen: () => void
  accent: string
  border: string
  radius: string
  inStock: boolean
  showQuickAdd: boolean
}) {
  return (
    <article
      className="group overflow-hidden border bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_80px_-42px_rgba(15,23,42,0.42)]"
      style={{ borderColor: border, borderRadius: radius }}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div
          className="relative h-64 w-full overflow-hidden bg-cover bg-center"
          style={{ backgroundImage: product.imageUrl ? `url(${product.imageUrl})` : `linear-gradient(135deg, ${accent}, #0f172a)` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-slate-950/5 to-transparent opacity-80 transition duration-300 group-hover:opacity-100" />
          <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
            {product.badgeText ? (
              <div className="inline-flex rounded-full bg-white/92 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 shadow-sm">
                {product.badgeText}
              </div>
            ) : (
              <div />
            )}
            <div
              className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] shadow-sm ${
                inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {inStock ? 'Siap kirim' : 'Habis'}
            </div>
          </div>
        </div>
      </button>
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <h3 className="text-xl font-black tracking-tight text-slate-950">{product.name}</h3>
          <p className="line-clamp-2 text-sm font-medium leading-relaxed text-slate-500">
            {product.shortDescription || product.description || 'Produk siap dipesan.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
          <span>{product.variants.length > 0 ? `${product.variants.length} varian` : 'Produk tunggal'}</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>{product.gallery.length > 0 ? `${product.gallery.length + 1} foto` : 'Foto utama tersedia'}</span>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-slate-950">{formatRupiah(product.price)}</div>
            {product.comparePrice > product.price && (
              <div className="text-xs font-bold text-slate-400 line-through">
                {formatRupiah(product.comparePrice)}
              </div>
            )}
            <div className={`text-[11px] font-black uppercase tracking-[0.14em] ${inStock ? 'text-emerald-600' : 'text-rose-600'}`}>
              {inStock ? 'Stok tersedia' : 'Stok habis'}
            </div>
          </div>
          {showQuickAdd ? (
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={onAdd}
                disabled={!inStock}
                className="inline-flex items-center gap-2 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: accent, borderRadius: radius }}
              >
                <Plus size={14} />
                Tambah
              </button>
              <button
                type="button"
                onClick={onOpen}
                className="inline-flex items-center gap-1 text-xs font-black text-slate-500 transition hover:text-slate-900"
              >
                Lihat detail
                <ChevronRight size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-2 px-4 py-3 text-xs font-black text-white"
              style={{ backgroundColor: accent, borderRadius: radius }}
            >
              Pilih Paket
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function StorefrontClient({
  payload,
  pageMode,
  initialProductSlug = null,
  interactive = true,
  embedded = false,
}: StorefrontClientProps) {
  const [cart, setCart] = useState<CartEntry[]>([])
  const [selectedVariantByProductId, setSelectedVariantByProductId] = useState<Record<string, string>>({})
  const [selectedMediaByProductId, setSelectedMediaByProductId] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null)
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState(() => crypto.randomUUID())
  const [checkoutForm, setCheckoutForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerNote: '',
    recipientName: '',
    addressPhone: '',
    line1: '',
    line2: '',
    district: '',
    city: '',
    province: '',
    postalCode: '',
    notes: '',
    shippingRateId: payload.shippingRates[0]?.id || '',
  })

  const selectedProduct = payload.products.find((product) => product.slug === initialProductSlug) || payload.products[0] || null
  const radius = formatStoreThemeRadius(payload.theme.tokens.cardRadius)
  const buttonRadius = formatStoreThemeButtonRadius(payload.theme.tokens.buttonRadius)
  const shadow = formatThemeShadow(payload.theme.tokens.shadow)
  const fontFamily = resolveThemeFontFamily(payload.theme.tokens.fontLabel)
  const pageBlocks = pageMode === 'home'
    ? payload.theme.layout.home
    : pageMode === 'collection'
      ? payload.theme.layout.collection
      : pageMode === 'product'
        ? payload.theme.layout.product
        : []

  useEffect(() => {
    if (!interactive) return
    const saved = window.localStorage.getItem(getStorageKey(payload.store.id))
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        setCart(parsed)
      }
    } catch {
      window.localStorage.removeItem(getStorageKey(payload.store.id))
    }
  }, [interactive, payload.store.id])

  useEffect(() => {
    if (!interactive) return
    window.localStorage.setItem(getStorageKey(payload.store.id), JSON.stringify(cart))
  }, [cart, interactive, payload.store.id])

  useEffect(() => {
    const initialSelection: Record<string, string> = {}
    const initialMedia: Record<string, string> = {}
    payload.products.forEach((product) => {
      const defaultVariant = product.variants.find((variant) => variant.isDefault) || product.variants[0]
      if (defaultVariant) {
        initialSelection[product.id] = defaultVariant.id
      }
      initialMedia[product.id] =
        defaultVariant?.imageUrl
        || product.gallery[0]
        || product.imageUrl
        || ''
    })
    setSelectedVariantByProductId(initialSelection)
    setSelectedMediaByProductId(initialMedia)
  }, [payload.products])

  const visibleProducts = payload.products.filter((product) => {
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    return (
      product.name.toLowerCase().includes(needle)
      || product.description.toLowerCase().includes(needle)
      || product.shortDescription.toLowerCase().includes(needle)
    )
  })

  const cartLines = cart.map((entry) => {
    const product = payload.products.find((item) => item.id === entry.productId)
    const variant = product?.variants.find((item) => item.id === entry.variantId)
    const price = variant?.price ?? product?.price ?? 0
    return {
      entry,
      product,
      variant,
      price,
      lineTotal: price * entry.quantity,
    }
  }).filter((line) => line.product)

  const cartSubtotal = cartLines.reduce((total, line) => total + line.lineTotal, 0)
  const selectedShippingRate = useMemo(() => (
    resolveShippingRateForAddress(
      payload.shippingRates,
      {
        country: 'ID',
        province: checkoutForm.province,
        city: checkoutForm.city,
        postalCode: checkoutForm.postalCode,
      },
      checkoutForm.shippingRateId
    )
    || payload.shippingRates.find((rate) => rate.id === checkoutForm.shippingRateId)
    || payload.shippingRates[0]
    || null
  ), [
    checkoutForm.city,
    checkoutForm.postalCode,
    checkoutForm.province,
    checkoutForm.shippingRateId,
    payload.shippingRates,
  ])
  const cartGrandTotal = cartSubtotal + (selectedShippingRate?.amount || 0)
  const storeName = payload.store.brandName || payload.store.name
  const storeInitials = getStoreInitials(storeName)
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const visibleProductCount = visibleProducts.length
  const shippingRateCount = payload.shippingRates.length
  const featuredPreviewProducts = payload.products.slice(0, 3)

  function getSelectedVariant(product: StorefrontProductView) {
    const selectedVariantId = selectedVariantByProductId[product.id]
    return product.variants.find((variant) => variant.id === selectedVariantId)
      || product.variants.find((variant) => variant.isDefault)
      || product.variants[0]
      || null
  }

  function getProductStock(product: StorefrontProductView) {
    const selectedVariant = getSelectedVariant(product)
    return selectedVariant?.stockQty ?? product.stockQty
  }

  function getProductGallery(product: StorefrontProductView) {
    const selectedVariant = getSelectedVariant(product)
    return [
      selectedMediaByProductId[product.id],
      selectedVariant?.imageUrl,
      product.imageUrl,
      ...product.gallery,
      ...product.variants.map((variant) => variant.imageUrl),
    ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index)
  }

  function handleAddToCart(product: StorefrontProductView) {
    if (!interactive) return
    if (getProductStock(product) <= 0) return
    const variantId = product.variants.length > 0 ? (selectedVariantByProductId[product.id] || product.variants[0]?.id || null) : null
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id && item.variantId === variantId)
      if (existing) {
        return current.map((item) => (
          item.productId === product.id && item.variantId === variantId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ))
      }
      return [...current, { productId: product.id, variantId, quantity: 1 }]
    })
  }

  function handleChangeCartQuantity(productId: string, variantId: string | null, delta: number) {
    if (!interactive) return
    setCart((current) => current
      .map((item) => {
        if (item.productId !== productId || item.variantId !== variantId) return item
        return { ...item, quantity: Math.max(0, item.quantity + delta) }
      })
      .filter((item) => item.quantity > 0))
  }

  async function submitCheckout() {
    if (!interactive) return
    if (cartLines.length === 0) {
      setCheckoutError('Keranjang masih kosong.')
      return
    }

    setCheckoutLoading(true)
    setCheckoutError('')

    try {
      const response = await fetch('/api/ecommerce/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': checkoutIdempotencyKey,
        },
        body: JSON.stringify({
          idempotencyKey: checkoutIdempotencyKey,
          orgSlug: payload.store.orgSlug,
          storeSlug: payload.store.slug,
          customerName: checkoutForm.customerName,
          customerEmail: checkoutForm.customerEmail,
          customerPhone: checkoutForm.customerPhone,
          customerNote: checkoutForm.customerNote,
          shippingRateId: selectedShippingRate?.id || checkoutForm.shippingRateId,
          address: {
            recipientName: checkoutForm.recipientName || checkoutForm.customerName,
            phone: checkoutForm.addressPhone || checkoutForm.customerPhone,
            line1: checkoutForm.line1,
            line2: checkoutForm.line2,
            district: checkoutForm.district,
            city: checkoutForm.city,
            province: checkoutForm.province,
            postalCode: checkoutForm.postalCode,
            country: 'ID',
            notes: checkoutForm.notes,
          },
          items: cartLines.map((line) => ({
            productId: line.product?.id,
            variantId: line.variant?.id || null,
            quantity: line.entry.quantity,
          })),
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Checkout gagal.')
      }

      const checkoutData = result.data as CheckoutResult
      setCheckoutResult(checkoutData)
      setCart([])
      setCheckoutIdempotencyKey(crypto.randomUUID())

      if (checkoutData.orderAccessUrl) {
        window.setTimeout(() => {
          window.location.assign(checkoutData.orderAccessUrl)
        }, 450)
      }
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout gagal.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  function renderBlock(block: StoreThemeBlock) {
    if (block.type === 'hero') {
      return (
        <section
          key={block.id}
          className="relative overflow-hidden border"
          style={{
            borderColor: payload.theme.tokens.border,
            borderRadius: radius,
            background: block.imageUrl
              ? `linear-gradient(118deg, rgba(15,23,42,0.84), rgba(15,23,42,0.26)), url(${block.imageUrl}) center / cover no-repeat`
              : `linear-gradient(135deg, ${payload.theme.tokens.accentStrong}, ${payload.theme.tokens.accent})`,
            boxShadow: shadow,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_28%)]" />
          <div className="relative grid gap-8 px-6 py-8 text-white sm:px-8 sm:py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/80 backdrop-blur">
                <Store size={14} />
                {block.eyebrow || payload.store.heroNotice || 'Store resmi'}
              </div>
              <h1 className="max-w-4xl text-4xl font-black tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                {block.title || payload.store.headline}
              </h1>
              <p className="max-w-2xl text-base font-medium leading-relaxed text-white/82 sm:text-lg">
                {block.body || payload.store.subheadline}
              </p>
              <div className="flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.16em] text-white/78">
                <div className="rounded-full border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                  {payload.products.length} produk tayang
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                  {shippingRateCount} opsi ongkir
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                  Bisa pesan tanpa akun
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href={block.ctaHref || '#products'}
                  className="inline-flex items-center gap-2 px-6 py-4 text-sm font-black text-slate-900"
                  style={{ backgroundColor: '#FFFFFF', borderRadius: buttonRadius }}
                >
                  {block.ctaLabel || 'Belanja Sekarang'}
                  <ArrowRight size={16} />
                </a>
                <Link
                  href={`/toko/${payload.store.orgSlug}/${payload.store.slug}/koleksi`}
                  className="inline-flex items-center gap-2 border px-6 py-4 text-sm font-black text-white"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderRadius: buttonRadius }}
                >
                  Lihat Koleksi
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    icon: Truck,
                    label: 'Pengiriman jelas',
                    body: 'Ongkir langsung mengikuti area aktif.',
                  },
                  {
                    icon: ShieldCheck,
                    label: 'Checkout aman',
                    body: 'Alur order dijaga tetap rapi dan stabil.',
                  },
                  {
                    icon: PackageCheck,
                    label: 'Stok transparan',
                    body: 'Pengunjung bisa lihat ketersediaan barang.',
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <item.icon size={18} className="text-white" />
                    <div className="mt-4 text-sm font-black text-white">{item.label}</div>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-white/72">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Produk', value: String(payload.products.length) },
                  { label: 'Di keranjang', value: String(cartCount) },
                  { label: 'Mode bayar', value: 'Manual' },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/62">{metric.label}</div>
                    <div className="mt-3 text-2xl font-black text-white">{metric.value}</div>
                  </div>
                ))}
              </div>
              {featuredPreviewProducts.length > 0 ? (
                <div className="rounded-[30px] border border-white/12 bg-white/10 p-5 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/62">Menu unggulan</div>
                      <div className="mt-2 text-xl font-black text-white">Paket yang paling sering dipilih untuk acara penting</div>
                    </div>
                    <Sparkles size={18} className="text-white/82" />
                  </div>
                  <div className="mt-5 space-y-3">
                    {featuredPreviewProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          if (!interactive) return
                          window.location.assign(`/toko/${payload.store.orgSlug}/${payload.store.slug}/produk/${product.slug}`)
                        }}
                        className="grid w-full gap-3 rounded-[22px] border border-white/12 bg-slate-950/16 p-3 text-left transition hover:bg-slate-950/22 sm:grid-cols-[88px_1fr]"
                      >
                        <div
                          className="h-24 rounded-[18px] bg-cover bg-center sm:h-full"
                          style={{
                            backgroundImage: product.imageUrl
                              ? `url(${product.imageUrl})`
                              : `linear-gradient(135deg, ${payload.theme.tokens.accentSoft}, rgba(255,255,255,0.3))`,
                          }}
                        />
                        <div className="space-y-2">
                          <div className="text-base font-black text-white">{product.name}</div>
                          <div className="line-clamp-2 text-sm font-medium leading-relaxed text-white/72">
                            {product.shortDescription || product.description || 'Produk siap tampil di etalase utama.'}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-black text-white">{formatRupiah(product.price)}</div>
                            <div className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.14em] text-white/70">
                              Buka detail
                              <ChevronRight size={14} />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[30px] border border-white/12 bg-white/10 p-6 backdrop-blur">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/62">Toko siap diluncurkan</div>
                  <div className="mt-3 text-2xl font-black text-white">Begitu produk dipublikasikan, area ini otomatis berubah jadi etalase unggulan.</div>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-white/72">
                    Layout sudah disiapkan untuk foto produk, harga promo, dan tombol belanja cepat. Tinggal isi katalog di panel admin.
                  </p>
                </div>
              )}
              <div className="rounded-[28px] border border-white/12 bg-slate-950/20 p-5 backdrop-blur">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Fondasi serius</div>
                <div className="mt-4 grid gap-3 text-sm font-bold text-white/84">
                  <div>Multi-store aktif per brand atau lini bisnis.</div>
                  <div>Katalog shared dengan harga dan tampilan beda per store.</div>
                  <div>Order masuk ke tabel e-commerce dulu, lalu sinkron ke ERP setelah pembayaran valid.</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )
    }

    if (block.type === 'promo-strip') {
      return (
        <section
          key={block.id}
          className="overflow-hidden border"
          style={{
            borderColor: payload.theme.tokens.border,
            borderRadius: buttonRadius,
            background: `linear-gradient(135deg, ${payload.theme.tokens.accentSoft}, rgba(255,255,255,0.88))`,
          }}
        >
          <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/90 p-2 shadow-sm" style={{ color: payload.theme.tokens.accentStrong }}>
                <Sparkles size={16} />
              </div>
              <div className="text-sm font-black" style={{ color: payload.theme.tokens.accentStrong }}>
                {block.body || 'Promo aktif ditaruh di strip ini agar langsung terlihat.'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-700">
              <span className="rounded-full bg-white/80 px-3 py-2">Transfer manual cepat</span>
              <span className="rounded-full bg-white/80 px-3 py-2">Stok lebih jelas</span>
              <span className="rounded-full bg-white/80 px-3 py-2">Checkout tanpa akun</span>
            </div>
          </div>
        </section>
      )
    }

    if (block.type === 'product-grid') {
      const products = visibleProducts.slice(0, block.productCount || visibleProducts.length)
      return (
        <section key={block.id} id="products" className="space-y-6">
          <SectionHeader
            eyebrow={block.eyebrow || 'Produk'}
            title={block.title || 'Produk Tersedia'}
            body={block.body}
            action={(
              <Link
                href={`/toko/${payload.store.orgSlug}/${payload.store.slug}/koleksi`}
                className="inline-flex items-center gap-2 text-sm font-black text-slate-700"
              >
                Lihat semua koleksi
                <ChevronRight size={16} />
              </Link>
            )}
          />
          {products.length === 0 ? (
            <EmptyCatalogState
              accent={payload.theme.tokens.accent}
              buttonRadius={buttonRadius}
              orgSlug={payload.store.orgSlug}
              storeSlug={payload.store.slug}
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={() => handleAddToCart(product)}
                  onOpen={() => {
                    if (!interactive) return
                    window.location.assign(`/toko/${payload.store.orgSlug}/${payload.store.slug}/produk/${product.slug}`)
                  }}
                  accent={payload.theme.tokens.accent}
                  border={payload.theme.tokens.border}
                  radius={radius}
                  inStock={getProductStock(product) > 0}
                  showQuickAdd={false}
                />
              ))}
            </div>
          )}
        </section>
      )
    }

    if (block.type === 'category-grid') {
      return (
        <section key={block.id} className="space-y-6">
          <SectionHeader
            eyebrow={block.eyebrow || 'Eksplorasi'}
            title={block.title || 'Jelajahi kategori utama'}
            body={block.body}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(block.items || []).map((item, index) => (
              <div
                key={`${block.id}-${index}`}
                className="group overflow-hidden border bg-white p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-38px_rgba(15,23,42,0.4)]"
                style={{ borderColor: payload.theme.tokens.border, borderRadius: radius }}
              >
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-[20px] text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${payload.theme.tokens.accentStrong}, ${payload.theme.tokens.accent})` }}
                >
                  <Store size={20} />
                </div>
                {item.label ? (
                  <div className="mt-5 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: payload.theme.tokens.muted }}>
                    {item.label}
                  </div>
                ) : null}
                <div className="mt-2 text-xl font-black tracking-tight text-slate-950">{item.title}</div>
                {item.body ? (
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{item.body}</p>
                ) : null}
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-slate-700">
                  Lihat bagian ini
                  <ChevronRight size={16} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )
    }

    if (block.type === 'testimonial') {
      return (
        <section key={block.id} className="space-y-6">
          <SectionHeader
            eyebrow={block.eyebrow || 'Ulasan'}
            title={block.title || 'Cerita singkat dari pelanggan'}
            body={block.body}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {(block.items || []).map((item, index) => (
              <div
                key={`${block.id}-${index}`}
                className="border bg-white p-6"
                style={{ borderColor: payload.theme.tokens.border, borderRadius: radius, boxShadow: shadow }}
              >
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Sparkles key={`${item.title}-${starIndex}`} size={14} />
                  ))}
                </div>
                <div className="mt-4 text-lg font-black leading-snug tracking-tight text-slate-950">
                  “{item.body || item.title}”
                </div>
                <div className="mt-5 text-sm font-black text-slate-900">{item.title}</div>
                {item.label ? (
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{item.label}</div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )
    }

    if (block.type === 'faq') {
      return (
        <section key={block.id} className="space-y-6">
          <SectionHeader
            eyebrow={block.eyebrow || 'Bantuan'}
            title={block.title || 'Pertanyaan yang sering muncul'}
            body={block.body}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {(block.items || []).map((item, index) => (
              <div
                key={`${block.id}-${index}`}
                className="rounded-[28px] border bg-white p-6"
                style={{ borderColor: payload.theme.tokens.border, boxShadow: '0 10px 40px -32px rgba(15,23,42,0.35)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-black tracking-tight text-slate-950">{item.title}</div>
                    {item.body ? (
                      <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">{item.body}</p>
                    ) : null}
                  </div>
                  <div className="rounded-full bg-slate-100 p-2 text-slate-600">
                    <Plus size={16} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )
    }

    if (block.type === 'footer-sections') {
      return (
        <section
          key={block.id}
          className="overflow-hidden border"
          style={{
            borderColor: 'rgba(15,23,42,0.08)',
            borderRadius: radius,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.92))',
          }}
        >
          <div className="grid gap-8 px-6 py-8 text-white sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-4">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/62">
                {block.eyebrow || 'Footer'}
              </div>
              <h2 className="text-3xl font-black tracking-tight">{block.title || payload.store.name}</h2>
              <p className="text-sm font-medium leading-relaxed text-white/72">
                {block.body || 'Gunakan area footer untuk merapikan informasi kontak, layanan, dan arah belanja.'}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(block.items || []).map((item, index) => (
                <div
                  key={`${block.id}-${index}`}
                  className="rounded-[24px] border border-white/10 bg-white/6 p-5"
                >
                  {item.label ? (
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">{item.label}</div>
                  ) : null}
                  <div className="mt-2 text-lg font-black tracking-tight text-white">{item.title}</div>
                  {item.body ? (
                    <p className="mt-2 text-sm font-medium leading-relaxed text-white/68">{item.body}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    }

    if (block.type === 'image-banner') {
      return (
        <section
          key={block.id}
          className="overflow-hidden border"
          style={{
            borderColor: payload.theme.tokens.border,
            borderRadius: radius,
            background: block.imageUrl
              ? `linear-gradient(120deg, rgba(255,255,255,0.06), rgba(15,23,42,0.42)), url(${block.imageUrl}) center / cover no-repeat`
              : payload.theme.tokens.surfaceAlt,
          }}
        >
          <div className="grid gap-6 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-10">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex rounded-full bg-white/86 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
                {block.eyebrow || 'Banner'}
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{block.title}</h2>
              <p className="text-sm font-medium leading-relaxed text-white/80 sm:text-base">{block.body}</p>
            </div>
            <div className="rounded-[28px] border border-white/12 bg-white/10 p-5 text-white backdrop-blur">
              <div className="text-sm font-black uppercase tracking-[0.16em] text-white/62">Cocok untuk acara Anda</div>
              <div className="mt-3 text-2xl font-black leading-snug">
                Pilih paket yang paling pas dengan jumlah tamu, suasana acara, dan tingkat layanan yang Anda butuhkan.
              </div>
            </div>
          </div>
        </section>
      )
    }

    if (block.type === 'featured-product') {
      const featuredProduct = payload.products.find((product) => product.id === block.featuredProductId)
        || payload.products.find((product) => product.isFeatured)
        || payload.products[0]

      if (!featuredProduct) return null

      return (
        <section
          key={block.id}
          className="grid gap-6 overflow-hidden border bg-white p-6 lg:grid-cols-[0.95fr_1.05fr]"
          style={{ borderColor: payload.theme.tokens.border, borderRadius: radius, boxShadow: shadow }}
        >
          <div
            className="min-h-[360px] rounded-[28px] bg-cover bg-center"
            style={{ backgroundImage: featuredProduct.imageUrl ? `url(${featuredProduct.imageUrl})` : `linear-gradient(135deg, ${payload.theme.tokens.accentSoft}, #ffffff)` }}
          />
          <div className="flex flex-col justify-center space-y-5">
            <div className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
              {block.eyebrow || 'Featured'}
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {block.title || featuredProduct.name}
            </h2>
            <p className="text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
              {block.body || featuredProduct.description}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                `Harga ${formatRupiah(featuredProduct.price)}`,
                getProductStock(featuredProduct) > 0 ? `Stok ${getProductStock(featuredProduct)}` : 'Stok habis',
                featuredProduct.variants.length > 0 ? `${featuredProduct.variants.length} varian` : 'Produk tunggal',
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                  {item}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/toko/${payload.store.orgSlug}/${payload.store.slug}/produk/${featuredProduct.slug}`} className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black text-white" style={{ backgroundColor: payload.theme.tokens.accent, borderRadius: buttonRadius }}>
                Pilih Paket Ini
                <ChevronRight size={16} />
              </Link>
              <Link href={getCartHref(payload.store.orgSlug, payload.store.slug)} className="inline-flex items-center gap-2 border px-5 py-3 text-sm font-black text-slate-700" style={{ borderColor: payload.theme.tokens.border, borderRadius: buttonRadius }}>
                Buka Keranjang
              </Link>
            </div>
          </div>
        </section>
      )
    }

    if (block.type === 'cta' || block.type === 'rich-text') {
      return (
        <section
          key={block.id}
          className="overflow-hidden border"
          style={{
            borderColor: payload.theme.tokens.border,
            borderRadius: radius,
            background: `linear-gradient(135deg, rgba(255,255,255,0.96), ${payload.theme.tokens.accentSoft})`,
            boxShadow: shadow,
          }}
        >
          <div className="space-y-4 px-6 py-8 text-center sm:px-8 lg:px-10 lg:py-10">
            <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
              {block.eyebrow || 'Blok Teks'}
            </div>
            <h2 className="mx-auto max-w-4xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {block.title || payload.store.headline}
            </h2>
            <p className="mx-auto max-w-3xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
              {block.body || payload.store.subheadline}
            </p>
            {block.ctaLabel && (
              <Link href={block.ctaHref || getCartHref(payload.store.orgSlug, payload.store.slug)} className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black text-white" style={{ backgroundColor: payload.theme.tokens.accent, borderRadius: buttonRadius }}>
                {block.ctaLabel}
                <ExternalLink size={14} />
              </Link>
            )}
          </div>
        </section>
      )
    }

    return null
  }

  return (
    <div
      className={embedded ? 'min-h-0 overflow-hidden' : 'relative min-h-screen overflow-hidden'}
      style={{
        background: `linear-gradient(180deg, ${payload.theme.tokens.surface} 0%, ${payload.theme.tokens.surfaceAlt} 100%)`,
        fontFamily,
        color: payload.theme.tokens.text,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.09),transparent_26%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.07),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.06),transparent_30%)]" />

      {payload.previewMode && (
        <div className="sticky top-0 z-50 border-b bg-amber-50 px-6 py-3 text-center text-sm font-black text-amber-700">
          Mode preview draft aktif. Pengunjung umum belum melihat versi ini.
        </div>
      )}

      <header className={`${embedded ? 'relative' : 'sticky top-0'} z-40`}>
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 rounded-[28px] border bg-white/88 px-4 py-4 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.45)] backdrop-blur sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center text-sm font-black text-white" style={{ backgroundColor: payload.theme.tokens.accent, borderRadius: buttonRadius }}>
                {storeInitials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
                  {payload.store.brandName || 'Official Store'}
                </div>
                <div className="truncate text-sm font-black text-slate-950">{payload.store.name}</div>
              </div>
            </div>

            <nav className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 md:flex">
              <Link href={`/toko/${payload.store.orgSlug}/${payload.store.slug}`} className="rounded-full px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-white hover:text-slate-950">Beranda</Link>
              <Link href={`/toko/${payload.store.orgSlug}/${payload.store.slug}/koleksi`} className="rounded-full px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-white hover:text-slate-950">Koleksi</Link>
              <Link href={getCartHref(payload.store.orgSlug, payload.store.slug)} className="rounded-full px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-white hover:text-slate-950">Keranjang</Link>
            </nav>

            <Link href={getCartHref(payload.store.orgSlug, payload.store.slug)} className="inline-flex items-center gap-2 px-4 py-3 text-sm font-black text-white shadow-sm" style={{ backgroundColor: payload.theme.tokens.accent, borderRadius: buttonRadius }}>
              <ShoppingCart size={16} />
              <span className="hidden sm:inline">Keranjang</span>
              {cartCount}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl space-y-10 px-4 pb-20 sm:px-6 lg:space-y-12 lg:px-8">
        {pageMode === 'collection' && (
          <section className="grid gap-4 rounded-[32px] border bg-white p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] lg:grid-cols-[1fr_auto]" style={{ borderColor: payload.theme.tokens.border }}>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>Cari Produk</div>
              <div className="text-3xl font-black tracking-tight text-slate-950">Koleksi untuk belanja cepat, bukan katalog yang membingungkan.</div>
              <div className="text-sm font-medium text-slate-500">Tersedia {visibleProductCount} produk yang cocok dengan pencarian Anda saat ini.</div>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ketik nama produk..."
              className="min-w-[280px] rounded-[20px] border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500"
            />
          </section>
        )}

        {pageMode === 'product' && selectedProduct && (
          <section className="grid gap-8 overflow-hidden border bg-white p-6 lg:grid-cols-[0.92fr_1.08fr]" style={{ borderColor: payload.theme.tokens.border, borderRadius: radius, boxShadow: shadow }}>
            <div className="space-y-4">
              <Link href={`/toko/${payload.store.orgSlug}/${payload.store.slug}/koleksi`} className="inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-slate-900">
                <ChevronRight size={16} className="rotate-180" />
                Kembali ke koleksi
              </Link>
              <div
                className="min-h-[420px] rounded-[32px] bg-cover bg-center"
                style={{
                  backgroundImage: getProductGallery(selectedProduct)[0]
                    ? `url(${selectedMediaByProductId[selectedProduct.id] || getProductGallery(selectedProduct)[0]})`
                    : `linear-gradient(135deg, ${payload.theme.tokens.accentSoft}, #ffffff)`,
                }}
              />
              {getProductGallery(selectedProduct).length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {getProductGallery(selectedProduct).slice(0, 8).map((imageUrl) => (
                    <button
                      key={imageUrl}
                      type="button"
                      onClick={() => setSelectedMediaByProductId((current) => ({ ...current, [selectedProduct.id]: imageUrl }))}
                      className="h-20 rounded-[18px] border bg-cover bg-center transition"
                      style={{
                        borderColor:
                          (selectedMediaByProductId[selectedProduct.id] || getProductGallery(selectedProduct)[0]) === imageUrl
                            ? payload.theme.tokens.accent
                            : payload.theme.tokens.border,
                        backgroundImage: `url(${imageUrl})`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-6">
              {selectedProduct.badgeText && (
                <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                  {selectedProduct.badgeText}
                </div>
              )}
              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">{selectedProduct.name}</h1>
                <p className="text-sm font-medium leading-relaxed text-slate-500 sm:text-base">{selectedProduct.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  getProductStock(selectedProduct) > 0 ? `Stok ${getProductStock(selectedProduct)}` : 'Stok habis',
                  selectedProduct.variants.length > 0 ? `${selectedProduct.variants.length} varian` : 'Produk tunggal',
                  selectedProduct.gallery.length > 0 ? `${selectedProduct.gallery.length + 1} foto` : 'Foto utama',
                ].map((item) => (
                  <div key={item} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                    {item}
                  </div>
                ))}
              </div>
              <div className={`inline-flex rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] ${
                getProductStock(selectedProduct) > 0
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}>
                {getProductStock(selectedProduct) > 0 ? `Stok tersedia: ${getProductStock(selectedProduct)}` : 'Stok sedang habis'}
              </div>

              {selectedProduct.variants.length > 0 && (
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>Pilih Varian</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedProduct.variants.map((variant) => {
                      const active = selectedVariantByProductId[selectedProduct.id] === variant.id
                      return (
                        <button
                          type="button"
                          key={variant.id}
                          onClick={() => {
                            setSelectedVariantByProductId((current) => ({ ...current, [selectedProduct.id]: variant.id }))
                            if (variant.imageUrl) {
                              setSelectedMediaByProductId((current) => ({ ...current, [selectedProduct.id]: variant.imageUrl }))
                            }
                          }}
                          className="border px-4 py-4 text-left transition"
                          style={{
                            borderColor: active ? payload.theme.tokens.accent : payload.theme.tokens.border,
                            borderRadius: radius,
                            backgroundColor: active ? payload.theme.tokens.accentSoft : '#FFFFFF',
                          }}
                        >
                          <div className="font-black text-slate-900">{variant.name}</div>
                          <div className="mt-1 text-sm font-medium text-slate-500">
                            {variant.choices.map((choice) => `${choice.attributeName}: ${choice.attributeValue}`).join(' • ')}
                          </div>
                          <div className="mt-2 text-sm font-black text-slate-900">{formatRupiah(variant.price)}</div>
                          <div className={`mt-2 text-[11px] font-black uppercase tracking-[0.14em] ${
                            variant.stockQty > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {variant.stockQty > 0 ? `Stok ${variant.stockQty}` : 'Stok habis'}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <div className="text-3xl font-black text-slate-900">
                  {formatRupiah(getSelectedVariant(selectedProduct)?.price || selectedProduct.price)}
                </div>
                <button
                  type="button"
                  onClick={() => handleAddToCart(selectedProduct)}
                  disabled={getProductStock(selectedProduct) <= 0}
                  className="inline-flex items-center gap-2 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: payload.theme.tokens.accent, borderRadius: buttonRadius }}
                >
                  <Plus size={16} />
                  {getProductStock(selectedProduct) > 0 ? 'Tambah ke Keranjang' : 'Stok Habis'}
                </button>
                <Link
                  href={getCartHref(payload.store.orgSlug, payload.store.slug)}
                  className="inline-flex items-center gap-2 border px-5 py-4 text-sm font-black text-slate-700"
                  style={{ borderColor: payload.theme.tokens.border, borderRadius: buttonRadius }}
                >
                  Buka Keranjang
                  <ArrowRight size={16} />
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  'Checkout tanpa akun',
                  'Upload bukti bayar setelah order',
                  'Status pesanan bisa dibuka lagi kapan saja',
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {pageBlocks.map((block) => renderBlock(block))}

        {pageMode === 'cart' && (
          <section className="space-y-6">
            <SectionHeader
              eyebrow="Keranjang"
              title="Periksa pesanan Anda lalu lanjutkan ke checkout."
              body="Atur jumlah paket, cek total, lalu isi detail pengiriman dan acara Anda di halaman ini."
            />

            <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-5 xl:sticky xl:top-28 xl:self-start">
                <div className="rounded-[32px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, boxShadow: shadow }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
                        Keranjang
                      </div>
                      <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{cartCount} item aktif</div>
                    </div>
                    <div className="rounded-full bg-slate-100 p-3 text-slate-700">
                      <ShoppingCart size={18} />
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    {cartLines.length === 0 && (
                      <div className="space-y-4 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm font-medium leading-relaxed text-slate-500">
                        <div>Keranjang Anda masih kosong. Pilih dulu paket yang ingin dipesan, lalu kembali ke halaman ini untuk lanjut checkout.</div>
                        <Link
                          href={`/toko/${payload.store.orgSlug}/${payload.store.slug}/koleksi`}
                          className="inline-flex items-center gap-2 text-sm font-black"
                          style={{ color: payload.theme.tokens.accentStrong }}
                        >
                          Buka daftar menu
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    )}
                    {cartLines.map((line) => (
                      <div key={`${line.product?.id}-${line.variant?.id || 'base'}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-black text-slate-950">{line.product?.name}</div>
                            {line.variant?.name && <div className="mt-1 text-xs font-medium text-slate-500">{line.variant.name}</div>}
                            <div className="mt-2 text-xs font-medium text-slate-500">{formatRupiah(line.price)} per item</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-slate-950">{formatRupiah(line.lineTotal)}</div>
                            <div className="mt-1 text-xs font-medium text-slate-400">total baris</div>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-4">
                          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Atur jumlah</div>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => handleChangeCartQuantity(line.product?.id || '', line.variant?.id || null, -1)} className="rounded-full border border-slate-200 bg-white p-2">
                              <Minus size={14} />
                            </button>
                            <div className="w-8 text-center font-black text-slate-950">{line.entry.quantity}</div>
                            <button type="button" onClick={() => handleChangeCartQuantity(line.product?.id || '', line.variant?.id || null, 1)} className="rounded-full border border-slate-200 bg-white p-2">
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[32px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, boxShadow: shadow }}>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
                    Ringkasan Nilai
                  </div>
                  <div className="mt-5 space-y-4 text-sm">
                    <div className="flex items-center justify-between font-medium text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-black text-slate-950">{formatRupiah(cartSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between font-medium text-slate-600">
                      <span>Ongkir</span>
                      <span className="font-black text-slate-950">{formatRupiah(selectedShippingRate?.amount || 0)}</span>
                    </div>
                    <div className="rounded-[22px] bg-slate-950 px-4 py-4 text-white">
                      <div className="flex items-center justify-between text-base">
                        <span className="font-black">Total akhir</span>
                        <span className="font-black">{formatRupiah(cartGrandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[32px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, boxShadow: shadow }}>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Bisa pesan tanpa akun',
                      'Transfer manual',
                      'Upload bukti bayar setelah order',
                    ].map((item) => (
                      <div key={item} className="rounded-full bg-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: payload.theme.tokens.muted }}>
                    {payload.theme.layout.checkout.bannerTitle}
                  </div>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
                    {payload.theme.layout.checkout.bannerBody}
                  </p>
                  {payload.store.checkoutNotice && (
                    <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                      {payload.store.checkoutNotice}
                    </div>
                  )}

                  <div className="mt-6 grid gap-3">
                    <input value={checkoutForm.customerName} onChange={(event) => setCheckoutForm((current) => ({ ...current, customerName: event.target.value, recipientName: current.recipientName || event.target.value }))} placeholder="Nama pelanggan" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500" />
                    <div className="grid gap-3 md:grid-cols-2">
                      <input value={checkoutForm.customerEmail} onChange={(event) => setCheckoutForm((current) => ({ ...current, customerEmail: event.target.value }))} placeholder="Email" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500" />
                      <input value={checkoutForm.customerPhone} onChange={(event) => setCheckoutForm((current) => ({ ...current, customerPhone: event.target.value, addressPhone: current.addressPhone || event.target.value }))} placeholder="No. WhatsApp" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500" />
                    </div>
                    <textarea value={checkoutForm.line1} onChange={(event) => setCheckoutForm((current) => ({ ...current, line1: event.target.value }))} rows={3} placeholder="Alamat lengkap" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500" />
                    <div className="grid gap-3 md:grid-cols-2">
                      <input value={checkoutForm.district} onChange={(event) => setCheckoutForm((current) => ({ ...current, district: event.target.value }))} placeholder="Kecamatan" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500" />
                      <input value={checkoutForm.city} onChange={(event) => setCheckoutForm((current) => ({ ...current, city: event.target.value }))} placeholder="Kota" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input value={checkoutForm.province} onChange={(event) => setCheckoutForm((current) => ({ ...current, province: event.target.value }))} placeholder="Provinsi" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500" />
                      <input value={checkoutForm.postalCode} onChange={(event) => setCheckoutForm((current) => ({ ...current, postalCode: event.target.value }))} placeholder="Kode pos" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500" />
                    </div>
                    <select value={selectedShippingRate?.id || checkoutForm.shippingRateId} onChange={(event) => setCheckoutForm((current) => ({ ...current, shippingRateId: event.target.value }))} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-blue-500">
                      {payload.shippingRates.map((rate) => (
                        <option key={rate.id} value={rate.id}>{rate.zoneName} • {rate.name} • {formatRupiah(rate.amount)}</option>
                      ))}
                    </select>
                    {selectedShippingRate ? (
                      <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                        Ongkir aktif mengikuti alamat: {selectedShippingRate.zoneName} • {selectedShippingRate.name} • {formatRupiah(selectedShippingRate.amount)}
                      </div>
                    ) : (
                      <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                        Alamat ini belum cocok dengan zona ongkir aktif. Cek lagi kota, provinsi, dan kode pos Anda.
                      </div>
                    )}
                    <textarea value={checkoutForm.customerNote} onChange={(event) => setCheckoutForm((current) => ({ ...current, customerNote: event.target.value }))} rows={2} placeholder="Catatan order" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 font-medium outline-none focus:border-blue-500" />

                    {checkoutError && (
                      <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        {checkoutError}
                      </div>
                    )}

                    <button type="button" onClick={submitCheckout} disabled={checkoutLoading || !selectedShippingRate} className="inline-flex items-center justify-center gap-2 px-5 py-4 text-sm font-black text-white disabled:opacity-60" style={{ backgroundColor: payload.theme.tokens.accent, borderRadius: buttonRadius }}>
                      {checkoutLoading ? 'Memproses checkout...' : 'Buat Order'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>

                {checkoutResult && (
                  <div className="rounded-[32px] border bg-white p-6" style={{ borderColor: payload.theme.tokens.border, boxShadow: shadow }}>
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">Order berhasil dibuat: {checkoutResult.orderNumber}</div>
                        <div className="mt-1 text-sm font-medium text-slate-500">Anda akan diarahkan ke halaman status order. Di sana pelanggan bisa lihat instruksi transfer dan upload bukti bayar kapan saja.</div>
                      </div>
                    </div>
                    {checkoutResult.transferInstructions && (
                      <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-600">
                        {checkoutResult.transferInstructions}
                      </div>
                    )}
                    <div className="mt-4 grid gap-3">
                      <Link
                        href={checkoutResult.orderAccessUrl}
                        className="inline-flex items-center justify-center gap-2 px-5 py-4 text-sm font-black text-white"
                        style={{ backgroundColor: payload.theme.tokens.accentStrong, borderRadius: buttonRadius }}
                      >
                        Buka Halaman Order
                        <ArrowRight size={16} />
                      </Link>
                      <div className="rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                        Jika tidak pindah otomatis, buka halaman order dari tombol di atas.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
