import { generateSlug } from '@/lib/utils'

export const STORE_THEME_BLOCK_TYPES = [
  'hero',
  'promo-strip',
  'category-grid',
  'product-grid',
  'featured-product',
  'image-banner',
  'testimonial',
  'faq',
  'rich-text',
  'cta',
  'footer-sections',
] as const

export type StoreThemeBlockType = (typeof STORE_THEME_BLOCK_TYPES)[number]

export const STORE_THEME_FONT_MAP = {
  'Modern Retail': "'Outfit', 'Inter', system-ui, sans-serif",
  'Luxury Editorial': "'Cormorant Garamond', 'Georgia', serif",
  'Fresh Organic': "'Nunito', 'Inter', system-ui, sans-serif",
  'Playful Kids': "'Baloo 2', 'Nunito', system-ui, sans-serif",
  'Industrial B2B': "'Space Grotesk', 'Inter', system-ui, sans-serif",
  'Corporate Catering': "'Sora', 'Outfit', system-ui, sans-serif",
  'Minimal Market': "'Manrope', 'Inter', system-ui, sans-serif",
} as const

export type StoreThemeFontLabel = keyof typeof STORE_THEME_FONT_MAP

export type StoreThemeTokens = {
  accent: string
  accentStrong: string
  accentSoft: string
  surface: string
  surfaceAlt: string
  border: string
  text: string
  muted: string
  fontLabel: StoreThemeFontLabel
  cardRadius: 'soft' | 'rounded' | 'sharp'
  buttonRadius: 'soft' | 'rounded' | 'pill'
  density: 'compact' | 'comfortable'
  shadow: 'soft' | 'medium' | 'bold'
}

export type StoreThemeBlockItem = {
  label?: string
  title: string
  body?: string
  href?: string
  imageUrl?: string
}

export type StoreThemeBlock = {
  id: string
  type: StoreThemeBlockType
  eyebrow?: string
  title?: string
  body?: string
  ctaLabel?: string
  ctaHref?: string
  imageUrl?: string
  imageAlt?: string
  featuredProductId?: string
  productCount?: number
  items?: StoreThemeBlockItem[]
}

export type StoreCheckoutBranding = {
  bannerTitle: string
  bannerBody: string
  supportLabel: string
}

export type StoreThemeBlockEditorFieldKey =
  | 'eyebrow'
  | 'title'
  | 'body'
  | 'ctaLabel'
  | 'ctaHref'
  | 'imageUrl'
  | 'imageAlt'
  | 'featuredProductId'
  | 'productCount'

export type StoreThemeEditorPage = 'home' | 'collection' | 'product'

export type StoreThemeBlockEditorSchema = {
  type: StoreThemeBlockType
  label: string
  description: string
  editorHint: string
  allowedPages: StoreThemeEditorPage[]
  defaultPage: StoreThemeEditorPage
  fields: StoreThemeBlockEditorFieldKey[]
  supportsItems: boolean
  itemLabel: string
}

export type StoreThemeLayout = {
  home: StoreThemeBlock[]
  collection: StoreThemeBlock[]
  product: StoreThemeBlock[]
  checkout: StoreCheckoutBranding
}

export type StoreThemeTemplateSeed = {
  key: string
  name: string
  description: string
  category: string
  tokens: StoreThemeTokens
  layout: StoreThemeLayout
}

export type StoreThemeVersionView = {
  id: string
  storeId: string
  versionName: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  previewToken: string
  tokens: StoreThemeTokens
  layout: StoreThemeLayout
  branding: Record<string, unknown>
  publishedAt: string | null
  updatedAt: string
}

export type StorefrontAttributeChoice = {
  attributeId: string
  attributeName: string
  attributeValueId: string
  attributeValue: string
  swatchHex: string | null
}

export type StorefrontVariantView = {
  id: string
  inventoryProductId: string
  sku: string
  name: string
  price: number
  comparePrice: number
  imageUrl: string
  isDefault: boolean
  isPublished: boolean
  stockQty: number
  choices: StorefrontAttributeChoice[]
}

export type StorefrontProductView = {
  id: string
  inventoryProductId: string
  slug: string
  name: string
  shortDescription: string
  description: string
  badgeText: string
  price: number
  comparePrice: number
  imageUrl: string
  gallery: string[]
  isFeatured: boolean
  isPublished: boolean
  stockQty: number
  variants: StorefrontVariantView[]
}

export type StorefrontShippingRuleMatcher = {
  countries: string[]
  provinces: string[]
  cities: string[]
  postalCodes: string[]
}

export type StorefrontShippingRateView = {
  id: string
  zoneId: string
  zoneName: string
  name: string
  amount: number
  etaLabel: string
  matcher: StorefrontShippingRuleMatcher
}

export type StorefrontStoreView = {
  id: string
  orgId: string
  orgSlug: string
  name: string
  slug: string
  brandName: string
  lineName: string
  logoUrl: string
  headline: string
  subheadline: string
  supportEmail: string
  supportPhone: string
  whatsappPhone: string
  transferInstructions: string
  seoTitle: string
  seoDescription: string
  heroNotice: string
  checkoutNotice: string
  currency: string
}

export type StorefrontPublicPayload = {
  store: StorefrontStoreView
  theme: StoreThemeVersionView
  products: StorefrontProductView[]
  shippingRates: StorefrontShippingRateView[]
  previewMode: boolean
}

export type StoreAdminSummary = {
  id: string
  orgId: string
  name: string
  slug: string
  brandName: string
  lineName: string
  branchId: string
  warehouseId: string
  bankAccountId: string
  supportEmail: string
  supportPhone: string
  whatsappPhone: string
  headline: string
  subheadline: string
  logoUrl: string
  currency: string
  isActive: boolean
  isPublished: boolean
  domainList: string[]
  transferInstructions: string
  heroNotice: string
  checkoutNotice: string
}

export type AdminCatalogProductView = {
  id: string
  name: string
  sku: string
  type: string
  basePrice: number
  unit: string
  description: string
}

export type AdminStoreProductView = {
  storeId: string
  productId: string
  publicSlug: string
  publicName: string
  shortDescription: string
  publicDescription: string
  priceOverride: number | null
  comparePrice: number | null
  badgeText: string
  sortOrder: number
  isFeatured: boolean
  isPublished: boolean
  imageUrl: string
}

export type AdminVariantView = {
  id: string
  productId: string
  inventoryProductId: string
  name: string
  sku: string
  isActive: boolean
  isDefault: boolean
  storeId: string | null
  publicName: string
  priceOverride: number | null
  comparePrice: number | null
  badgeText: string
  imageUrl: string
  isPublished: boolean
  attributesText: string
}

export type AdminShippingZoneView = {
  id: string
  storeId: string
  code: string
  name: string
  countries: string[]
  provinces: string[]
  cities: string[]
  postalCodes: string[]
  isActive: boolean
}

export type AdminShippingRateView = {
  id: string
  storeId: string
  zoneId: string
  zoneName: string
  name: string
  amount: number
  etaLabel: string
  isActive: boolean
}

export type AdminOrderPaymentView = {
  id: string
  orderId: string
  orderNumber: string
  storeId: string
  storeName: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status: string
  paymentStatus: string
  reservationStatus: string
  grandTotal: number
  createdAt: string
  paymentDueAt: string | null
  paidAmount: number | null
  paidAt: string | null
  proofUrl: string
  reviewNote: string
  erpSaleId: string | null
  erpSyncStatus: string
  erpSyncError: string
}

export type AdminOrderEventView = {
  id: string
  orderId: string
  orderNumber: string
  actorUserId: string | null
  actorLabel: string
  eventType: string
  message: string
  payloadPreview: string
  createdAt: string
}

export type PublicOrderStatusItemView = {
  id: string
  productName: string
  variantName: string
  imageUrl: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type PublicOrderAddressView = {
  recipientName: string
  phone: string
  line1: string
  line2: string
  district: string
  city: string
  province: string
  postalCode: string
  country: string
  notes: string
}

export type PublicOrderPaymentHistoryView = {
  id: string
  status: string
  paidAmount: number | null
  paidAt: string | null
  payerName: string
  payerBankName: string
  reviewNote: string
  createdAt: string
}

export type PublicOrderStatusPayload = {
  store: StorefrontStoreView
  theme: StoreThemeVersionView
  order: {
    orderId: string
    orderNumber: string
    status: string
    paymentStatus: string
    subtotalAmount: number
    shippingAmount: number
    grandTotal: number
    customerName: string
    customerEmail: string
    customerPhone: string
    customerNote: string
    createdAt: string
    paymentDueAt: string | null
    shippingLabel: string
    transferInstructions: string
    canUploadProof: boolean
    proofMaxSizeMb: number
    accessUrl: string
    address: PublicOrderAddressView | null
    items: PublicOrderStatusItemView[]
    payments: PublicOrderPaymentHistoryView[]
  }
}

export type AdminThemeAssetView = {
  id: string
  storeId: string
  themeVersionId: string | null
  assetType: string
  label: string
  publicUrl: string
  mimeType: string
  createdAt: string
}

export type EcommerceDashboardData = {
  stores: StoreAdminSummary[]
  products: AdminCatalogProductView[]
  storeProducts: AdminStoreProductView[]
  variants: AdminVariantView[]
  shippingZones: AdminShippingZoneView[]
  shippingRates: AdminShippingRateView[]
  themes: StoreThemeVersionView[]
  themeAssets: AdminThemeAssetView[]
  templates: StoreThemeTemplateSeed[]
  orders: AdminOrderPaymentView[]
  orderEvents: AdminOrderEventView[]
  branches: Array<{ id: string; name: string; code: string }>
  warehouses: Array<{ id: string; name: string; branchId: string | null }>
  bankAccounts: Array<{ id: string; label: string; branchId: string | null }>
}

export type ShippingAddressMatcherInput = {
  country?: string | null
  province?: string | null
  city?: string | null
  postalCode?: string | null
}

export const DEFAULT_STORE_THEME_TOKENS: StoreThemeTokens = {
  accent: '#0F766E',
  accentStrong: '#115E59',
  accentSoft: '#CCFBF1',
  surface: '#F6FFFB',
  surfaceAlt: '#ECFDF5',
  border: '#CDEEE5',
  text: '#0F172A',
  muted: '#52796F',
  fontLabel: 'Modern Retail',
  cardRadius: 'rounded',
  buttonRadius: 'pill',
  density: 'comfortable',
  shadow: 'soft',
}

export const DEFAULT_STORE_CHECKOUT_BRANDING: StoreCheckoutBranding = {
  bannerTitle: 'Checkout aman dan cepat',
  bannerBody: 'Struktur checkout dikunci agar pesanan tetap rapi, tetapi warna dan nuansanya mengikuti brand toko.',
  supportLabel: 'Butuh bantuan? Hubungi tim toko kapan saja.',
}

export const STORE_THEME_BLOCK_SCHEMAS: Record<StoreThemeBlockType, StoreThemeBlockEditorSchema> = {
  hero: {
    type: 'hero',
    label: 'Hero',
    description: 'Bagian pembuka utama dengan headline besar, CTA, dan visual.',
    editorHint: 'Paling cocok untuk pembuka halaman atau pengantar kuat di atas lipatan layar.',
    allowedPages: ['home', 'collection'],
    defaultPage: 'home',
    fields: ['eyebrow', 'title', 'body', 'ctaLabel', 'ctaHref', 'imageUrl'],
    supportsItems: false,
    itemLabel: 'Hero',
  },
  'promo-strip': {
    type: 'promo-strip',
    label: 'Promo Strip',
    description: 'Strip pendek untuk promo, pengumuman, atau info operasional.',
    editorHint: 'Gunakan untuk info singkat yang harus cepat terbaca, misalnya promo atau jadwal kirim.',
    allowedPages: ['home', 'collection', 'product'],
    defaultPage: 'home',
    fields: ['body'],
    supportsItems: false,
    itemLabel: 'Promo',
  },
  'category-grid': {
    type: 'category-grid',
    label: 'Category Grid',
    description: 'Kartu kelompok produk, manfaat, atau sorotan kategori.',
    editorHint: 'Cocok untuk mengelompokkan katalog, manfaat, atau alasan beli dalam beberapa kartu.',
    allowedPages: ['home', 'collection'],
    defaultPage: 'home',
    fields: ['eyebrow', 'title', 'body'],
    supportsItems: true,
    itemLabel: 'Kategori',
  },
  'product-grid': {
    type: 'product-grid',
    label: 'Product Grid',
    description: 'Grid produk publik store. Isi produk mengikuti katalog store yang aktif.',
    editorHint: 'Jumlah produk bisa dibatasi, tetapi isi produk tetap mengikuti katalog publik store.',
    allowedPages: ['home', 'collection'],
    defaultPage: 'collection',
    fields: ['eyebrow', 'title', 'body', 'productCount'],
    supportsItems: false,
    itemLabel: 'Produk',
  },
  'featured-product': {
    type: 'featured-product',
    label: 'Featured Product',
    description: 'Menonjolkan satu produk unggulan dari katalog store aktif.',
    editorHint: 'Pilih satu produk yang paling ingin didorong di halaman ini.',
    allowedPages: ['home', 'product'],
    defaultPage: 'product',
    fields: ['eyebrow', 'title', 'body', 'featuredProductId'],
    supportsItems: false,
    itemLabel: 'Produk unggulan',
  },
  'image-banner': {
    type: 'image-banner',
    label: 'Image Banner',
    description: 'Banner visual untuk promo, kampanye, atau pesan besar.',
    editorHint: 'Pakailah saat Anda punya gambar kuat yang memang layak diberi ruang sendiri.',
    allowedPages: ['home', 'collection', 'product'],
    defaultPage: 'home',
    fields: ['eyebrow', 'title', 'body', 'imageUrl'],
    supportsItems: false,
    itemLabel: 'Banner',
  },
  testimonial: {
    type: 'testimonial',
    label: 'Testimonial',
    description: 'Kartu testimoni, bukti sosial, atau alasan kepercayaan.',
    editorHint: 'Isi dengan kalimat singkat yang membantu pembeli lebih cepat yakin.',
    allowedPages: ['home', 'product'],
    defaultPage: 'home',
    fields: ['eyebrow', 'title', 'body'],
    supportsItems: true,
    itemLabel: 'Testimoni',
  },
  faq: {
    type: 'faq',
    label: 'FAQ',
    description: 'Pertanyaan yang sering ditanyakan pelanggan.',
    editorHint: 'Jawab hal yang paling sering membuat pembeli ragu sebelum mereka chat admin.',
    allowedPages: ['home', 'product', 'collection'],
    defaultPage: 'product',
    fields: ['eyebrow', 'title', 'body'],
    supportsItems: true,
    itemLabel: 'FAQ',
  },
  'rich-text': {
    type: 'rich-text',
    label: 'Rich Text',
    description: 'Blok narasi bebas untuk menjelaskan cerita brand atau penawaran.',
    editorHint: 'Cocok untuk pengantar halaman, penjelasan brand, atau copy kampanye singkat.',
    allowedPages: ['home', 'collection', 'product'],
    defaultPage: 'collection',
    fields: ['eyebrow', 'title', 'body', 'ctaLabel', 'ctaHref'],
    supportsItems: false,
    itemLabel: 'Teks',
  },
  cta: {
    type: 'cta',
    label: 'CTA',
    description: 'Blok ajakan aksi dengan judul, deskripsi, dan tombol utama.',
    editorHint: 'Taruh di bagian bawah halaman saat Anda ingin pembeli mengambil langkah berikutnya.',
    allowedPages: ['home', 'collection', 'product'],
    defaultPage: 'product',
    fields: ['eyebrow', 'title', 'body', 'ctaLabel', 'ctaHref'],
    supportsItems: false,
    itemLabel: 'CTA',
  },
  'footer-sections': {
    type: 'footer-sections',
    label: 'Footer Sections',
    description: 'Isi footer modular seperti kontak, cara order, dan tentang toko.',
    editorHint: 'Paling cocok di bagian bawah halaman untuk informasi kontak, cara order, atau profil singkat.',
    allowedPages: ['home', 'collection', 'product'],
    defaultPage: 'home',
    fields: ['eyebrow', 'title', 'body'],
    supportsItems: true,
    itemLabel: 'Section Footer',
  },
}

export const STORE_THEME_BLOCK_SCHEMA_LIST = STORE_THEME_BLOCK_TYPES.map(
  (type) => STORE_THEME_BLOCK_SCHEMAS[type]
)

function makeBlock(id: string, type: StoreThemeBlockType, patch: Partial<StoreThemeBlock>): StoreThemeBlock {
  return {
    id,
    type,
    ...patch,
  }
}

function makeDefaultBlock(type: StoreThemeBlockType, id: string): StoreThemeBlock {
  if (type === 'hero') {
    return makeBlock(id, type, {
      eyebrow: 'Sorotan Utama',
      title: 'Tampilkan pesan jual utama store Anda.',
      body: 'Gunakan bagian ini untuk headline, alasan percaya, dan arahkan pembeli ke produk atau checkout.',
      ctaLabel: 'Lihat Produk',
      ctaHref: '#products',
    })
  }

  if (type === 'promo-strip') {
    return makeBlock(id, type, {
      body: 'Promo aktif, info pengiriman, atau pengumuman cepat bisa ditaruh di sini.',
    })
  }

  if (type === 'category-grid') {
    return makeBlock(id, type, {
      eyebrow: 'Kategori',
      title: 'Kelompok produk yang ingin disorot',
      body: 'Pakai kartu ini untuk mengarahkan pengunjung ke kelompok produk atau manfaat utama.',
      items: [
        { title: 'Best Seller', body: 'Sorot produk yang paling cepat laku.' },
        { title: 'Paket Hemat', body: 'Bantu pembeli memilih lebih cepat.' },
      ],
    })
  }

  if (type === 'product-grid') {
    return makeBlock(id, type, {
      eyebrow: 'Produk',
      title: 'Produk Pilihan',
      body: 'Grid ini mengambil produk publik yang aktif dari katalog store.',
      productCount: 6,
    })
  }

  if (type === 'featured-product') {
    return makeBlock(id, type, {
      eyebrow: 'Unggulan',
      title: 'Produk yang paling ingin ditonjolkan',
      body: 'Pilih satu produk publik untuk dibesarkan di section ini.',
    })
  }

  if (type === 'image-banner') {
    return makeBlock(id, type, {
      eyebrow: 'Banner',
      title: 'Kampanye atau pengumuman visual',
      body: 'Gunakan gambar besar untuk promo, momen spesial, atau bukti visual.',
    })
  }

  if (type === 'testimonial') {
    return makeBlock(id, type, {
      eyebrow: 'Kepercayaan',
      title: 'Apa kata pelanggan',
      body: 'Masukkan bukti sosial yang paling membantu pembeli cepat yakin.',
      items: [
        { title: 'Testimoni 1', body: 'Pelayanan cepat dan produk sesuai harapan.' },
        { title: 'Testimoni 2', body: 'Checkout mudah dan tim admin responsif.' },
      ],
    })
  }

  if (type === 'faq') {
    return makeBlock(id, type, {
      eyebrow: 'FAQ',
      title: 'Pertanyaan yang sering ditanyakan',
      body: 'Jawab keberatan paling umum sebelum pembeli bertanya ke admin.',
      items: [
        { title: 'Apakah bisa checkout tanpa akun?', body: 'Bisa, model awal memakai guest checkout.' },
        { title: 'Bagaimana cara bayar?', body: 'Transfer manual lalu upload bukti pembayaran.' },
      ],
    })
  }

  if (type === 'cta') {
    return makeBlock(id, type, {
      eyebrow: 'CTA',
      title: 'Ajak pengunjung mengambil langkah berikutnya',
      body: 'Section ini cocok untuk mendorong pengunjung lanjut belanja atau checkout.',
      ctaLabel: 'Lanjut Checkout',
      ctaHref: '#checkout',
    })
  }

  if (type === 'footer-sections') {
    return makeBlock(id, type, {
      eyebrow: 'Footer',
      title: 'Informasi penting toko',
      body: 'Ringkas informasi utama seperti cara order, kontak, dan profil toko.',
      items: [
        { title: 'Tentang Toko', body: 'Ceritakan brand singkat di footer.' },
        { title: 'Kontak', body: 'Cantumkan admin dan jam operasional.' },
      ],
    })
  }

  return makeBlock(id, type, {
    eyebrow: 'Informasi',
    title: 'Section baru',
    body: 'Gunakan blok ini untuk menambah konteks atau narasi singkat.',
    ctaLabel: 'Pelajari Lagi',
    ctaHref: '#checkout',
  })
}

export const STORE_THEME_TEMPLATE_SEEDS: StoreThemeTemplateSeed[] = [
  {
    key: 'modern-retail',
    name: 'Modern Retail',
    description: 'Cocok untuk brand retail umum yang ingin terasa bersih dan cepat jual.',
    category: 'Retail',
    tokens: {
      ...DEFAULT_STORE_THEME_TOKENS,
      accent: '#0F766E',
      accentStrong: '#134E4A',
      accentSoft: '#CCFBF1',
      surface: '#F8FFFE',
      surfaceAlt: '#EFFCF8',
      border: '#CFEFE7',
      fontLabel: 'Modern Retail',
    },
    layout: {
      home: [
        makeBlock('hero-1', 'hero', {
          eyebrow: 'Website Retail Siap Jual',
          title: 'Katalog yang langsung bisa dijalankan, bukan sekadar etalase.',
          body: 'Tonjolkan produk unggulan, promo aktif, dan arahkan pengunjung ke checkout tanpa banyak klik.',
          ctaLabel: 'Belanja Sekarang',
          ctaHref: '#checkout',
          imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80',
        }),
        makeBlock('promo-1', 'promo-strip', {
          body: 'Free ongkir area tertentu, transfer manual diverifikasi cepat, dan stok tampil lebih jelas.',
        }),
        makeBlock('product-grid-1', 'product-grid', {
          title: 'Produk Pilihan',
          body: 'Taruh produk andalan paling depan untuk mempercepat keputusan beli.',
          productCount: 8,
        }),
        makeBlock('faq-1', 'faq', {
          title: 'Pertanyaan yang sering muncul',
          items: [
            { title: 'Apakah bisa checkout tanpa akun?', body: 'Bisa. Model awal memakai guest checkout.' },
            { title: 'Metode bayar apa yang dipakai?', body: 'Transfer manual dengan upload bukti pembayaran.' },
          ],
        }),
      ],
      collection: [
        makeBlock('collection-hero-1', 'rich-text', {
          eyebrow: 'Koleksi Produk',
          title: 'Semua produk tampil dalam pola grid yang rapi.',
          body: 'Filter dan pencarian tetap bisa ditambahkan di atas layout builder tanpa merusak struktur katalog.',
        }),
        makeBlock('collection-grid-1', 'product-grid', {
          title: 'Belanja Sesuai Kebutuhan',
          productCount: 12,
        }),
      ],
      product: [
        makeBlock('product-banner-1', 'image-banner', {
          eyebrow: 'Detail Produk',
          title: 'Fokus pada foto, harga, varian, dan tombol tambah keranjang.',
          body: 'Area ini tetap pakai builder, tetapi checkout di bawahnya tetap dikunci.',
        }),
        makeBlock('product-proof-1', 'testimonial', {
          title: 'Kenapa pembeli lebih cepat yakin',
          items: [
            { title: 'Info varian jelas', body: 'Pilihan ukuran, warna, atau paket tampil rapi.' },
            { title: 'Harga transparan', body: 'Harga dasar, harga coret, dan promo mudah dibaca.' },
          ],
        }),
      ],
      checkout: DEFAULT_STORE_CHECKOUT_BRANDING,
    },
  },
  {
    key: 'luxury-editorial',
    name: 'Luxury Editorial',
    description: 'Nuansa premium untuk brand fashion, kecantikan, atau gift.',
    category: 'Premium',
    tokens: {
      ...DEFAULT_STORE_THEME_TOKENS,
      accent: '#6B2C3E',
      accentStrong: '#4A1F2E',
      accentSoft: '#FDE7EE',
      surface: '#FFF9FB',
      surfaceAlt: '#FEF1F5',
      border: '#F4D7E0',
      fontLabel: 'Luxury Editorial',
      shadow: 'medium',
    },
    layout: {
      home: [
        makeBlock('hero-1', 'hero', {
          eyebrow: 'Editorial Storefront',
          title: 'Jual produk premium dengan cerita visual yang lebih anggun.',
          body: 'Hero besar, copy pendek, dan galeri produk yang terasa lebih kurasi.',
          ctaLabel: 'Lihat Koleksi',
          ctaHref: '#products',
          imageUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80',
        }),
        makeBlock('banner-1', 'image-banner', {
          title: 'Promo khusus member',
          body: 'Tampilkan hadiah pembelian, packaging spesial, atau batch terbatas.',
          imageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
        }),
        makeBlock('product-grid-1', 'product-grid', {
          title: 'Kurasi Utama',
          productCount: 6,
        }),
      ],
      collection: [
        makeBlock('collection-1', 'rich-text', {
          eyebrow: 'Luxury Collection',
          title: 'Fokus pada pilihan yang lebih sedikit tetapi lebih meyakinkan.',
          body: 'Gaya editorial cocok bila setiap produk perlu ruang narasi dan foto yang kuat.',
        }),
        makeBlock('product-grid-2', 'product-grid', {
          title: 'Pilihan Tersedia',
          productCount: 10,
        }),
      ],
      product: [
        makeBlock('cta-1', 'cta', {
          title: 'Butuh bantuan pilih varian?',
          body: 'Arahkan pembeli ke WhatsApp, chat concierge, atau konsultasi singkat.',
          ctaLabel: 'Hubungi Tim',
          ctaHref: '#checkout',
        }),
      ],
      checkout: {
        bannerTitle: 'Checkout premium tanpa rumit',
        bannerBody: 'Warna, tipografi, dan pesan brand tetap terasa mewah, tetapi form checkout tetap aman.',
        supportLabel: 'Tim concierge siap bantu jika ada pertanyaan ukuran atau pengiriman.',
      },
    },
  },
  {
    key: 'fresh-organic',
    name: 'Fresh Organic',
    description: 'Cocok untuk makanan sehat, agribisnis, dan produk natural.',
    category: 'FMCG',
    tokens: {
      ...DEFAULT_STORE_THEME_TOKENS,
      accent: '#3F7D20',
      accentStrong: '#285A16',
      accentSoft: '#E6F8D8',
      surface: '#FBFFF7',
      surfaceAlt: '#F2FADD',
      border: '#D8EFB7',
      fontLabel: 'Fresh Organic',
    },
    layout: {
      home: [
        makeBlock('hero-1', 'hero', {
          eyebrow: 'Segar dan Jelas',
          title: 'Tonjolkan asal produk, kualitas, dan ketersediaan stok dengan tampilan yang ringan.',
          body: 'Template ini cocok untuk toko yang butuh kesan alami dan ramah keluarga.',
          ctaLabel: 'Pesan Hari Ini',
          ctaHref: '#checkout',
        }),
        makeBlock('category-grid-1', 'category-grid', {
          title: 'Kelompok Produk',
          items: [
            { title: 'Paket Harian', body: 'Produk cepat laku dan mudah repeat order.' },
            { title: 'Best Seller', body: 'Taruh produk dengan margin dan permintaan tertinggi.' },
            { title: 'Musiman', body: 'Sorot produk yang butuh dorongan cepat.' },
          ],
        }),
        makeBlock('product-grid-1', 'product-grid', {
          title: 'Siap Dipesan',
          productCount: 9,
        }),
      ],
      collection: [
        makeBlock('promo-1', 'promo-strip', {
          body: 'Pakai strip ini untuk info panen baru, stok hari ini, atau area pengiriman yang sedang dibuka.',
        }),
        makeBlock('product-grid-2', 'product-grid', {
          title: 'Katalog Lengkap',
          productCount: 12,
        }),
      ],
      product: [
        makeBlock('faq-1', 'faq', {
          title: 'Hal penting sebelum pesan',
          items: [
            { title: 'Apakah stok selalu real-time?', body: 'Stok dicek ulang saat pembayaran divalidasi.' },
            { title: 'Bagaimana ongkir dihitung?', body: 'Ongkir mengikuti zona dan tarif toko yang aktif.' },
          ],
        }),
      ],
      checkout: DEFAULT_STORE_CHECKOUT_BRANDING,
    },
  },
  {
    key: 'playful-kids',
    name: 'Playful Kids',
    description: 'Warna cerah untuk mainan, perlengkapan anak, atau kebutuhan keluarga.',
    category: 'Lifestyle',
    tokens: {
      ...DEFAULT_STORE_THEME_TOKENS,
      accent: '#E85D04',
      accentStrong: '#C2410C',
      accentSoft: '#FFE9D5',
      surface: '#FFFDF8',
      surfaceAlt: '#FFF4E7',
      border: '#FFD5B2',
      fontLabel: 'Playful Kids',
      buttonRadius: 'pill',
      shadow: 'bold',
    },
    layout: {
      home: [
        makeBlock('hero-1', 'hero', {
          eyebrow: 'Ramai Tapi Tetap Rapi',
          title: 'Cocok untuk brand yang ingin terasa ceria sejak hero pertama.',
          body: 'Pakai blok ini untuk jual paket bundling, promo kelas, atau hadiah musiman.',
          ctaLabel: 'Lihat Bundling',
          ctaHref: '#products',
        }),
        makeBlock('testimonial-1', 'testimonial', {
          title: 'Testimoni cepat dipercaya',
          items: [
            { title: 'Orang tua mudah cek stok', body: 'Informasi harga dan varian dibaca tanpa bingung.' },
            { title: 'Checkout lebih ringkas', body: 'Form tidak dibuat berbelit untuk pembeli baru.' },
          ],
        }),
        makeBlock('product-grid-1', 'product-grid', {
          title: 'Bundling Favorit',
          productCount: 8,
        }),
      ],
      collection: [
        makeBlock('cta-1', 'cta', {
          title: 'Pakai halaman koleksi untuk promosi paket sekolah atau hadiah.',
          ctaLabel: 'Mulai Pilih Produk',
          ctaHref: '#checkout',
        }),
      ],
      product: [
        makeBlock('rich-text-1', 'rich-text', {
          eyebrow: 'Produk Detail',
          title: 'Gunakan copy yang singkat, aman, dan mudah dibaca orang tua.',
          body: 'Desain playful tetap perlu memberi rasa percaya pada stok, ukuran, dan proses bayar.',
        }),
      ],
      checkout: DEFAULT_STORE_CHECKOUT_BRANDING,
    },
  },
  {
    key: 'industrial-b2b',
    name: 'Industrial B2B',
    description: 'Fokus pada katalog yang tegas untuk lini mesin, sparepart, atau bahan industri.',
    category: 'B2B',
    tokens: {
      ...DEFAULT_STORE_THEME_TOKENS,
      accent: '#0F172A',
      accentStrong: '#020617',
      accentSoft: '#E2E8F0',
      surface: '#F8FAFC',
      surfaceAlt: '#EAF0F6',
      border: '#CBD5E1',
      muted: '#475569',
      fontLabel: 'Industrial B2B',
      cardRadius: 'sharp',
      buttonRadius: 'rounded',
      density: 'compact',
    },
    layout: {
      home: [
        makeBlock('hero-1', 'hero', {
          eyebrow: 'Store B2B',
          title: 'Tampil lebih tegas untuk produk teknis yang butuh data jelas.',
          body: 'Pakailah blok produk, FAQ, dan CTA untuk membantu buyer cepat meminta penawaran atau langsung pesan.',
          ctaLabel: 'Lihat Produk Teknis',
          ctaHref: '#products',
        }),
        makeBlock('rich-text-1', 'rich-text', {
          title: 'Katalog shared, harga bisa beda per store',
          body: 'Template ini cocok untuk multi-brand atau lini bisnis yang berbagi master produk tetapi perlu harga publik berbeda.',
        }),
        makeBlock('product-grid-1', 'product-grid', {
          title: 'Produk Teknis Siap Jual',
          productCount: 10,
        }),
      ],
      collection: [
        makeBlock('faq-1', 'faq', {
          title: 'FAQ pembeli bisnis',
          items: [
            { title: 'Apakah bisa pakai varian kompleks?', body: 'Bisa. Varian disimpan terpisah dan tetap bisa dipetakan ke produk ERP.' },
            { title: 'Bagaimana order masuk ke ERP?', body: 'Order masuk ke tabel e-commerce dulu, lalu sinkron setelah pembayaran valid.' },
          ],
        }),
      ],
      product: [
        makeBlock('featured-1', 'featured-product', {
          title: 'Tampilkan kelebihan teknis utama di sini.',
        }),
      ],
      checkout: DEFAULT_STORE_CHECKOUT_BRANDING,
    },
  },
  {
    key: 'corporate-catering',
    name: 'Corporate Catering',
    description: 'Dirancang untuk catering kantor, nasi box, tray rapat, dan acara keluarga.',
    category: 'Catering',
    tokens: {
      ...DEFAULT_STORE_THEME_TOKENS,
      accent: '#C62828',
      accentStrong: '#8E1C1C',
      accentSoft: '#FFE7E2',
      surface: '#FFFDFB',
      surfaceAlt: '#FFF4EF',
      border: '#F1D5CC',
      muted: '#7A5A50',
      fontLabel: 'Corporate Catering',
      buttonRadius: 'pill',
      shadow: 'medium',
    },
    layout: {
      home: [
        makeBlock('product-grid-1', 'product-grid', {
          eyebrow: 'Menu Catering',
          title: 'Pilih menu yang ingin Anda pesan',
          body: '',
          productCount: 8,
        }),
      ],
      collection: [
        makeBlock('collection-1', 'rich-text', {
          eyebrow: 'Menu Catering',
          title: 'Temukan paket yang paling cocok untuk rapat, jamuan tamu, atau acara keluarga Anda.',
          body: 'Silakan mulai dari jenis acara dan kisaran porsi yang Anda butuhkan. Dari sana, pilih paket yang paling pas dengan suasana dan anggaran Anda.',
        }),
        makeBlock('featured-1', 'featured-product', {
          eyebrow: 'Paling Dicari',
          title: 'Paket yang paling aman untuk meeting, presentasi, dan jamuan tamu.',
        }),
        makeBlock('product-grid-2', 'product-grid', {
          title: 'Semua Paket Tersedia',
          productCount: 16,
        }),
      ],
      product: [
        makeBlock('image-banner-1', 'image-banner', {
          eyebrow: 'Catatan untuk acara',
          title: 'Lihat apakah paket ini paling cocok untuk jenis acara dan jumlah tamu yang Anda siapkan.',
          body: 'Perhatikan isi paket, jumlah porsi, dan nuansa sajiannya supaya pilihan Anda terasa pas untuk momen yang akan digelar.',
          imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80',
        }),
        makeBlock('testimonial-1', 'testimonial', {
          eyebrow: 'Kenapa cepat dipilih',
          title: 'Paket catering lebih mudah diputuskan kalau manfaatnya langsung jelas',
          items: [
            { label: 'Meeting tim', title: 'Porsi rapi dan mudah dibagikan', body: 'Cocok untuk acara kantor yang butuh pembagian cepat tanpa ribet plating.' },
            { label: 'Acara keluarga', title: 'Menu terasa lebih lengkap', body: 'Pelanggan bisa langsung tahu apakah paket ini cocok untuk santai, formal, atau syukuran.' },
          ],
        }),
      ],
      checkout: {
        bannerTitle: 'Konfirmasi acara Anda dalam satu order',
        bannerBody: 'Isi data pemesan, alamat kirim, dan catatan acara Anda. Setelah order dibuat, Anda bisa langsung cek status dan upload bukti bayar dari halaman order.',
        supportLabel: 'Tim catering siap bantu kebutuhan porsi, jam kirim, dan catatan acara.',
      },
    },
  },
  {
    key: 'minimal-market',
    name: 'Minimal Market',
    description: 'Tampilan minimal untuk toko campuran yang ingin cepat go live.',
    category: 'General',
    tokens: {
      ...DEFAULT_STORE_THEME_TOKENS,
      accent: '#1D4ED8',
      accentStrong: '#1E40AF',
      accentSoft: '#DBEAFE',
      surface: '#FFFFFF',
      surfaceAlt: '#F8FAFC',
      border: '#D6E4FF',
      muted: '#64748B',
      fontLabel: 'Minimal Market',
      shadow: 'soft',
    },
    layout: {
      home: [
        makeBlock('hero-1', 'hero', {
          eyebrow: 'Go Live Cepat',
          title: 'Template paling aman untuk mulai jual sambil terus disempurnakan.',
          body: 'Gunakan jika Anda ingin fokus pada katalog, checkout, dan alur pembayaran lebih dulu.',
          ctaLabel: 'Mulai Belanja',
          ctaHref: '#checkout',
        }),
        makeBlock('product-grid-1', 'product-grid', {
          title: 'Produk Tersedia',
          productCount: 12,
        }),
        makeBlock('footer-1', 'footer-sections', {
          title: 'Footer modular',
          items: [
            { title: 'Tentang Toko', body: 'Ceritakan brand singkat di footer.' },
            { title: 'Cara Order', body: 'Transfer manual dan upload bukti bisa dijelaskan di sini.' },
            { title: 'Kontak', body: 'Cantumkan nomor admin dan jam operasional.' },
          ],
        }),
      ],
      collection: [
        makeBlock('product-grid-2', 'product-grid', {
          title: 'Lanjutkan Pilih Produk',
          productCount: 16,
        }),
      ],
      product: [
        makeBlock('cta-1', 'cta', {
          title: 'Arahkan pembeli kembali ke checkout dengan satu CTA jelas.',
          ctaLabel: 'Tambah ke Keranjang',
          ctaHref: '#checkout',
        }),
      ],
      checkout: DEFAULT_STORE_CHECKOUT_BRANDING,
    },
  },
]

const FALLBACK_TEMPLATE = STORE_THEME_TEMPLATE_SEEDS[0]
const VALID_COLOR = /^#([0-9a-f]{6})$/i
const VALID_URL = /^(https?:\/\/|\/|#)/i

function cleanText(value: unknown, max = 400): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function cleanLongText(value: unknown, max = 4000): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\r/g, '').trim().slice(0, max)
}

function normalizeShippingMatcherValue(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCountryCandidates(value: unknown) {
  const normalized = normalizeShippingMatcherValue(value)
  if (!normalized) return []

  const candidates = new Set([normalized])
  if (normalized === 'id' || normalized === 'indonesia' || normalized === 'indo') {
    candidates.add('id')
    candidates.add('indonesia')
    candidates.add('indo')
  }

  return [...candidates]
}

function matchesShippingRuleList(rules: string[], value: unknown, kind: 'country' | 'text' | 'postal') {
  if (rules.length === 0) return true

  if (kind === 'country') {
    const candidates = normalizeCountryCandidates(value)
    if (candidates.length === 0) return false

    return rules.some((rule) =>
      candidates.some((candidate) =>
        candidate === rule
        || candidate.includes(rule)
        || rule.includes(candidate)
      )
    )
  }

  const normalizedValue = normalizeShippingMatcherValue(value)
  if (!normalizedValue) return false

  return rules.some((rule) => {
    if (!rule) return false
    if (kind === 'postal') {
      return normalizedValue === rule || normalizedValue.startsWith(rule) || rule.startsWith(normalizedValue)
    }

    return normalizedValue === rule || normalizedValue.includes(rule) || rule.includes(normalizedValue)
  })
}

function getShippingMatcherSpecificity(matcher: StorefrontShippingRuleMatcher) {
  return (
    (matcher.countries.length > 0 ? 1 : 0)
    + (matcher.provinces.length > 0 ? 2 : 0)
    + (matcher.cities.length > 0 ? 4 : 0)
    + (matcher.postalCodes.length > 0 ? 8 : 0)
  )
}

export function normalizeShippingRuleList(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,]+/g)
      : []

  const unique = new Set<string>()
  for (const item of source) {
    const normalized = normalizeShippingMatcherValue(item)
    if (normalized) unique.add(normalized)
  }

  return [...unique]
}

export function normalizeShippingMatcher(value: unknown): StorefrontShippingRuleMatcher {
  const source = (value || {}) as Record<string, unknown>
  return {
    countries: normalizeShippingRuleList(source.countries),
    provinces: normalizeShippingRuleList(source.provinces),
    cities: normalizeShippingRuleList(source.cities),
    postalCodes: normalizeShippingRuleList(source.postalCodes),
  }
}

export function shippingMatcherHasRules(matcher: StorefrontShippingRuleMatcher) {
  return (
    matcher.countries.length > 0
    || matcher.provinces.length > 0
    || matcher.cities.length > 0
    || matcher.postalCodes.length > 0
  )
}

export function shippingZoneMatchesAddress(
  matcher: StorefrontShippingRuleMatcher,
  address: ShippingAddressMatcherInput
) {
  return (
    matchesShippingRuleList(matcher.countries, address.country, 'country')
    && matchesShippingRuleList(matcher.provinces, address.province, 'text')
    && matchesShippingRuleList(matcher.cities, address.city, 'text')
    && matchesShippingRuleList(matcher.postalCodes, address.postalCode, 'postal')
  )
}

export function resolveShippingRateForAddress<T extends StorefrontShippingRateView>(
  rates: T[],
  address: ShippingAddressMatcherInput,
  preferredRateId?: string | null
) {
  const matches = rates.filter((rate) => shippingZoneMatchesAddress(rate.matcher, address))
  if (matches.length === 0) return null

  if (preferredRateId) {
    const preferred = matches.find((rate) => rate.id === preferredRateId)
    if (preferred) return preferred
  }

  return [...matches].sort((left, right) => {
    const specificityDiff =
      getShippingMatcherSpecificity(right.matcher)
      - getShippingMatcherSpecificity(left.matcher)

    if (specificityDiff !== 0) return specificityDiff
    return left.amount - right.amount
  })[0] || null
}

function cleanColor(value: unknown, fallback: string): string {
  const raw = String(value || '').trim()
  return VALID_COLOR.test(raw) ? raw.toUpperCase() : fallback
}

function cleanUrl(value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return VALID_URL.test(raw) ? raw : ''
}

function toItemArray(value: unknown): StoreThemeBlockItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      label: cleanText((item as Record<string, unknown>)?.label, 120),
      title: cleanText((item as Record<string, unknown>)?.title, 160),
      body: cleanLongText((item as Record<string, unknown>)?.body, 600),
      href: cleanUrl((item as Record<string, unknown>)?.href),
      imageUrl: cleanUrl((item as Record<string, unknown>)?.imageUrl),
    }))
    .filter((item) => item.title)
}

function coerceBlockType(value: unknown): StoreThemeBlockType {
  const type = String(value || '').trim() as StoreThemeBlockType
  return STORE_THEME_BLOCK_TYPES.includes(type) ? type : 'rich-text'
}

function ensureBlockId(value: unknown, type: StoreThemeBlockType, index: number) {
  const raw = String(value || '').trim()
  if (!raw) return `${type}-${index + 1}`
  return generateSlug(raw) || `${type}-${index + 1}`
}

function toBlockArray(value: unknown, page: 'home' | 'collection' | 'product'): StoreThemeBlock[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      const source = (item || {}) as Record<string, unknown>
      const type = coerceBlockType(source.type)
      return {
        id: ensureBlockId(source.id, type, index),
        type,
        eyebrow: cleanText(source.eyebrow, 120),
        title: cleanText(source.title, 200),
        body: cleanLongText(source.body, 1000),
        ctaLabel: cleanText(source.ctaLabel, 80),
        ctaHref: cleanUrl(source.ctaHref),
        imageUrl: cleanUrl(source.imageUrl),
        imageAlt: cleanText(source.imageAlt, 120),
        featuredProductId: cleanText(source.featuredProductId, 64),
        productCount: Math.max(0, Math.min(24, Number(source.productCount || 0) || 0)) || undefined,
        items: toItemArray(source.items),
      }
    })
    .filter((block) => block.title || block.body || block.items?.length || block.type === 'product-grid')
    .slice(0, page === 'home' ? 12 : 8)
}

export function normalizeStoreThemeTokens(value: unknown): StoreThemeTokens {
  const source = (value || {}) as Record<string, unknown>
  const fontLabel = String(source.fontLabel || DEFAULT_STORE_THEME_TOKENS.fontLabel) as StoreThemeFontLabel
  const safeFontLabel = Object.prototype.hasOwnProperty.call(STORE_THEME_FONT_MAP, fontLabel)
    ? fontLabel
    : DEFAULT_STORE_THEME_TOKENS.fontLabel

  const cardRadius = String(source.cardRadius || DEFAULT_STORE_THEME_TOKENS.cardRadius)
  const buttonRadius = String(source.buttonRadius || DEFAULT_STORE_THEME_TOKENS.buttonRadius)
  const density = String(source.density || DEFAULT_STORE_THEME_TOKENS.density)
  const shadow = String(source.shadow || DEFAULT_STORE_THEME_TOKENS.shadow)

  return {
    accent: cleanColor(source.accent, DEFAULT_STORE_THEME_TOKENS.accent),
    accentStrong: cleanColor(source.accentStrong, DEFAULT_STORE_THEME_TOKENS.accentStrong),
    accentSoft: cleanColor(source.accentSoft, DEFAULT_STORE_THEME_TOKENS.accentSoft),
    surface: cleanColor(source.surface, DEFAULT_STORE_THEME_TOKENS.surface),
    surfaceAlt: cleanColor(source.surfaceAlt, DEFAULT_STORE_THEME_TOKENS.surfaceAlt),
    border: cleanColor(source.border, DEFAULT_STORE_THEME_TOKENS.border),
    text: cleanColor(source.text, DEFAULT_STORE_THEME_TOKENS.text),
    muted: cleanColor(source.muted, DEFAULT_STORE_THEME_TOKENS.muted),
    fontLabel: safeFontLabel,
    cardRadius: cardRadius === 'soft' || cardRadius === 'sharp' ? cardRadius : 'rounded',
    buttonRadius: buttonRadius === 'soft' || buttonRadius === 'rounded' ? buttonRadius : 'pill',
    density: density === 'compact' ? 'compact' : 'comfortable',
    shadow: shadow === 'medium' || shadow === 'bold' ? shadow : 'soft',
  }
}

export function normalizeStoreCheckoutBranding(value: unknown): StoreCheckoutBranding {
  const source = (value || {}) as Record<string, unknown>
  return {
    bannerTitle: cleanText(source.bannerTitle, 120) || DEFAULT_STORE_CHECKOUT_BRANDING.bannerTitle,
    bannerBody: cleanLongText(source.bannerBody, 400) || DEFAULT_STORE_CHECKOUT_BRANDING.bannerBody,
    supportLabel: cleanText(source.supportLabel, 180) || DEFAULT_STORE_CHECKOUT_BRANDING.supportLabel,
  }
}

export function normalizeStoreThemeLayout(value: unknown): StoreThemeLayout {
  const source = (value || {}) as Record<string, unknown>
  return {
    home: toBlockArray(source.home, 'home'),
    collection: toBlockArray(source.collection, 'collection'),
    product: toBlockArray(source.product, 'product'),
    checkout: normalizeStoreCheckoutBranding(source.checkout),
  }
}

export function getStoreThemeTemplateSeed(templateKey?: string | null): StoreThemeTemplateSeed {
  const template = STORE_THEME_TEMPLATE_SEEDS.find((item) => item.key === templateKey)
  return template || FALLBACK_TEMPLATE
}

export function buildThemeDraftFromTemplate(templateKey?: string | null) {
  const seed = getStoreThemeTemplateSeed(templateKey)
  return {
    templateKey: seed.key,
    versionName: seed.name,
    tokens: normalizeStoreThemeTokens(seed.tokens),
    layout: normalizeStoreThemeLayout(seed.layout),
  }
}

export function buildStoreThemeBlockId(type: StoreThemeBlockType, seed?: string | null) {
  const suffix = generateSlug(seed || '').slice(0, 18)
  const randomPart = Math.random().toString(36).slice(2, 8)
  const base = suffix ? `${type}-${suffix}-${randomPart}` : `${type}-${randomPart}`
  return generateSlug(base) || `${type}-${Date.now()}`
}

export function buildDefaultStoreThemeBlock(type: StoreThemeBlockType, seed?: string | null) {
  return makeDefaultBlock(type, buildStoreThemeBlockId(type, seed))
}

export function cloneStoreThemeBlock(block: StoreThemeBlock) {
  return {
    ...block,
    id: buildStoreThemeBlockId(block.type, `${block.title || block.id}-copy`),
    items: block.items ? block.items.map((item) => ({ ...item })) : undefined,
  }
}

export function resolveThemeFontFamily(fontLabel: StoreThemeFontLabel): string {
  return STORE_THEME_FONT_MAP[fontLabel] || STORE_THEME_FONT_MAP['Modern Retail']
}

export function normalizeStoreSlug(value: string) {
  return generateSlug(value || '').slice(0, 80)
}

export function normalizeStorefrontThemeVersion(record: {
  id?: unknown
  store_id?: unknown
  version_name?: unknown
  status?: unknown
  preview_token?: unknown
  tokens?: unknown
  layout?: unknown
  branding?: unknown
  published_at?: unknown
  updated_at?: unknown
}): StoreThemeVersionView {
  const status = String(record.status || 'DRAFT').toUpperCase()
  return {
    id: String(record.id || ''),
    storeId: String(record.store_id || ''),
    versionName: cleanText(record.version_name, 120) || 'Default Theme',
    status: status === 'PUBLISHED' || status === 'ARCHIVED' ? status : 'DRAFT',
    previewToken: cleanText(record.preview_token, 120),
    tokens: normalizeStoreThemeTokens(record.tokens),
    layout: normalizeStoreThemeLayout(record.layout),
    branding: typeof record.branding === 'object' && record.branding && !Array.isArray(record.branding)
      ? record.branding as Record<string, unknown>
      : {},
    publishedAt: record.published_at ? String(record.published_at) : null,
    updatedAt: String(record.updated_at || ''),
  }
}

export function toThemeTemplateRows() {
  return STORE_THEME_TEMPLATE_SEEDS.map((seed) => ({
    template_key: seed.key,
    name: seed.name,
    description: seed.description,
    category: seed.category,
    tokens: seed.tokens,
    layout: seed.layout,
  }))
}

export function formatStoreThemeRadius(kind: StoreThemeTokens['cardRadius']) {
  if (kind === 'soft') return '24px'
  if (kind === 'sharp') return '8px'
  return '18px'
}

export function formatStoreThemeButtonRadius(kind: StoreThemeTokens['buttonRadius']) {
  if (kind === 'soft') return '14px'
  if (kind === 'rounded') return '18px'
  return '999px'
}

export function formatThemeShadow(kind: StoreThemeTokens['shadow']) {
  if (kind === 'bold') return '0 30px 70px -30px rgba(15, 23, 42, 0.35)'
  if (kind === 'medium') return '0 24px 48px -28px rgba(15, 23, 42, 0.22)'
  return '0 18px 40px -30px rgba(15, 23, 42, 0.18)'
}

export function formatThemeDensity(kind: StoreThemeTokens['density']) {
  return kind === 'compact'
    ? { sectionGap: 'gap-4', cardPadding: 'p-4' }
    : { sectionGap: 'gap-6', cardPadding: 'p-6' }
}
