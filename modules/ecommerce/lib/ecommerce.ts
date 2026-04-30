/**
 * Shared storefront helpers so admin and public e-commerce surfaces
 * read one normalized data shape.
 */

import { formatRupiah } from '@/lib/utils'
import {
  calculateSalesPromoDiscount,
  normalizeSalesPromoCode,
  type SalesPromoRecord,
} from '@/modules/sales/lib/sales-promos'

export type EcommerceFeatureStatus = 'live' | 'foundation' | 'next'

export type EcommerceOrgSource = {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  logoUrl?: string | null
}

export type EcommerceProductSource = {
  id: string
  name: string
  sku?: string | null
  description?: string | null
  category?: string | null
  unit?: string | null
  selling_price?: number | null
  stock_available?: number | null
  type?: string | null
}

export type EcommerceOrgView = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
}

export type EcommerceProductView = {
  id: string
  name: string
  sku: string | null
  description: string | null
  category: string
  unit: string
  price: number
  stockAvailable: number
  type: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE'
  isTrackedStock: boolean
  isInStock: boolean
  isLowStock: boolean
}

export type EcommercePromoView = {
  id: string
  code: string
  type: SalesPromoRecord['type']
  value: number
  expiresAt: string | null
  status: SalesPromoRecord['status']
  label: string
  discountLabel: string
}

export type EcommerceCapability = {
  id: string
  title: string
  description: string
  status: EcommerceFeatureStatus
}

export type EcommerceStorefrontView = {
  org: EcommerceOrgView
  hero: {
    eyebrow: string
    title: string
    subtitle: string
    announcement: string
  }
  stats: {
    activeProducts: number
    readyStock: number
    lowStock: number
    activePromos: number
    totalCategories: number
  }
  categories: string[]
  products: EcommerceProductView[]
  promos: EcommercePromoView[]
  capabilities: EcommerceCapability[]
}

export type EcommerceCartLine = {
  productId: string
  quantity: number
}

export type EcommerceCartPreview = {
  subtotal: number
  discount: number
  grandTotal: number
  promo: EcommercePromoView | null
  lines: Array<{
    product: EcommerceProductView
    quantity: number
    lineTotal: number
  }>
}

export const ECOMMERCE_DELIVERY_OPTIONS = [
  {
    id: 'pickup',
    title: 'Klik & Ambil',
    description: 'Cocok untuk cabang yang melayani pickup di toko atau gudang.',
  },
  {
    id: 'reguler',
    title: 'Kurir Reguler',
    description: 'Dipakai untuk pengiriman normal dengan ongkir yang dikonfirmasi tim.',
  },
  {
    id: 'same-day',
    title: 'Same Day',
    description: 'Untuk area dekat cabang aktif dengan prioritas pengiriman lebih cepat.',
  },
] as const

function normalizeProductType(value: unknown): EcommerceProductView['type'] {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'SERVICE' || normalized === 'NON_INVENTORY') return normalized
  return 'INVENTORY'
}

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildPromoView(promo: SalesPromoRecord): EcommercePromoView {
  const discountLabel = promo.type === 'PERCENT'
    ? `${promo.value}%`
    : formatRupiah(promo.value)

  return {
    id: promo.id,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    expiresAt: promo.expiresAt,
    status: promo.status,
    label: promo.type === 'PERCENT'
      ? `Diskon ${promo.value}%`
      : `Potongan ${formatRupiah(promo.value)}`,
    discountLabel,
  }
}

function buildCapabilities(productCount: number, promoCount: number): EcommerceCapability[] {
  return [
    {
      id: 'catalog',
      title: 'Katalog Produk',
      description: 'Produk aktif langsung tampil dari master inventory tanpa input ulang.',
      status: productCount > 0 ? 'live' : 'foundation',
    },
    {
      id: 'promo',
      title: 'Promo & Kupon',
      description: 'Kode promo dari modul sales ikut muncul di etalase publik.',
      status: promoCount > 0 ? 'live' : 'foundation',
    },
    {
      id: 'quote-checkout',
      title: 'Cart ke Quotation',
      description: 'Pesanan pelanggan masuk sebagai draft quotation agar tim sales bisa lanjut follow-up.',
      status: productCount > 0 ? 'live' : 'foundation',
    },
    {
      id: 'shipping',
      title: 'Pengiriman & Pickup',
      description: 'Pelanggan sudah bisa memilih mode fulfilment, detail ongkir bisa dipastikan saat follow-up.',
      status: 'foundation',
    },
    {
      id: 'variants',
      title: 'Varian Produk',
      description: 'Ukuran, warna, atau atribut produk masih butuh schema baru agar setara Odoo.',
      status: 'next',
    },
    {
      id: 'payments',
      title: 'Payment Gateway',
      description: 'Pembayaran online langsung belum diaktifkan pada tahap MVP ini.',
      status: 'next',
    },
  ]
}

export function buildEcommerceStorefrontView(input: {
  org: EcommerceOrgSource
  products: EcommerceProductSource[]
  promos: SalesPromoRecord[]
}): EcommerceStorefrontView {
  const org: EcommerceOrgView = {
    id: input.org.id,
    name: input.org.name,
    slug: input.org.slug,
    logoUrl: input.org.logoUrl ?? input.org.logo_url ?? null,
  }

  const products = input.products
    .map<EcommerceProductView>((product) => {
      const type = normalizeProductType(product.type)
      const stockAvailable = Math.max(0, toFiniteNumber(product.stock_available))
      const isTrackedStock = type === 'INVENTORY'
      const isInStock = isTrackedStock ? stockAvailable > 0 : true
      const isLowStock = isTrackedStock && stockAvailable > 0 && stockAvailable <= 5

      return {
        id: product.id,
        name: String(product.name || '').trim() || 'Produk Tanpa Nama',
        sku: product.sku?.trim() || null,
        description: product.description?.trim() || null,
        category: product.category?.trim() || 'Umum',
        unit: product.unit?.trim() || 'Pcs',
        price: Math.max(0, toFiniteNumber(product.selling_price)),
        stockAvailable,
        type,
        isTrackedStock,
        isInStock,
        isLowStock,
      }
    })
    .sort((left, right) => {
      if (left.isInStock !== right.isInStock) return left.isInStock ? -1 : 1
      if (left.isLowStock !== right.isLowStock) return left.isLowStock ? 1 : -1
      return left.name.localeCompare(right.name, 'id-ID')
    })

  const promos = input.promos
    .filter((promo) => promo.status === 'ACTIVE')
    .map(buildPromoView)

  const categories = [...new Set(products.map((product) => product.category))]
    .sort((left, right) => left.localeCompare(right, 'id-ID'))

  const readyStock = products.filter((product) => product.isInStock).length
  const lowStock = products.filter((product) => product.isLowStock).length

  return {
    org,
    hero: {
      eyebrow: 'Etalase Online Terhubung ERP',
      title: `${org.name} Store`,
      subtitle: 'Katalog, promo, dan permintaan order masuk dari satu alur yang sama dengan inventory dan sales.',
      announcement: promos.length > 0
        ? `${promos.length} promo aktif siap dipakai pelanggan hari ini.`
        : 'Katalog sudah sinkron dengan master produk dan stok yang tersedia.',
    },
    stats: {
      activeProducts: products.length,
      readyStock,
      lowStock,
      activePromos: promos.length,
      totalCategories: categories.length,
    },
    categories,
    products,
    promos,
    capabilities: buildCapabilities(products.length, promos.length),
  }
}

export function getCapabilityStatusLabel(status: EcommerceFeatureStatus) {
  if (status === 'live') return 'Live'
  if (status === 'foundation') return 'Dasar Siap'
  return 'Tahap 2'
}

export function findStorePromoByCode(promos: EcommercePromoView[], code: string) {
  const normalizedCode = normalizeSalesPromoCode(code)
  if (!normalizedCode) return null
  return promos.find((promo) => promo.code === normalizedCode && promo.status === 'ACTIVE') || null
}

export function calculateStorePromoDiscount(promo: EcommercePromoView | null, subtotal: number) {
  if (!promo) return 0

  return calculateSalesPromoDiscount(
    {
      id: promo.id,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      isActive: promo.status === 'ACTIVE',
      usageCount: 0,
      expiresAt: promo.expiresAt,
      createdAt: '',
      updatedAt: '',
      status: promo.status,
    },
    subtotal,
  )
}

export function buildCartPreview(
  products: EcommerceProductView[],
  cart: Record<string, number>,
  promoCode: string,
  promos: EcommercePromoView[],
): EcommerceCartPreview {
  const productMap = new Map(products.map((product) => [product.id, product]))
  const lines = Object.entries(cart)
    .map(([productId, quantity]) => ({
      product: productMap.get(productId) || null,
      quantity: Math.max(0, Math.trunc(quantity || 0)),
    }))
    .filter((line) => line.product && line.quantity > 0)
    .map((line) => ({
      product: line.product as EcommerceProductView,
      quantity: line.quantity,
      lineTotal: line.quantity * line.product.price,
    }))

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const promo = findStorePromoByCode(promos, promoCode)
  const discount = calculateStorePromoDiscount(promo, subtotal)

  return {
    subtotal,
    discount,
    grandTotal: Math.max(0, subtotal - discount),
    promo,
    lines,
  }
}
