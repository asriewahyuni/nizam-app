'use client'

/**
 * Editor visual storefront store.
 * Data akhirnya tetap disimpan ke tokens, layout, dan branding yang sama
 * supaya storefront publik tidak perlu diubah arsitekturnya.
 */

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  Braces,
  Copy,
  ExternalLink,
  ImagePlus,
  LayoutTemplate,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
  Wand2,
} from 'lucide-react'
import StorefrontClient from '@/app/toko/[orgSlug]/[storeSlug]/StorefrontClient'
import {
  publishStoreThemeDraftAction,
  resetStoreThemeDraftAction,
  saveStoreThemeDraftAction,
  uploadStoreThemeAssetAction,
} from '@/modules/ecommerce/actions/ecommerce.actions'
import {
  buildDefaultStoreThemeBlock,
  buildThemeDraftFromTemplate,
  cloneStoreThemeBlock,
  normalizeStoreCheckoutBranding,
  normalizeStoreThemeLayout,
  normalizeStoreThemeTokens,
  STORE_THEME_BLOCK_SCHEMA_LIST,
  STORE_THEME_BLOCK_SCHEMAS,
  STORE_THEME_BLOCK_TYPES,
  STORE_THEME_FONT_MAP,
  type EcommerceDashboardData,
  type StoreCheckoutBranding,
  type StoreThemeBlock,
  type StoreThemeBlockEditorFieldKey,
  type StoreThemeBlockItem,
  type StoreThemeBlockType,
  type StoreThemeEditorPage,
  type StoreThemeLayout,
  type StoreThemeTokens,
  type StoreThemeVersionView,
  type StorefrontProductView,
  type StorefrontPublicPayload,
  type StorefrontShippingRateView,
} from '@/modules/ecommerce/lib/ecommerce'
import { formatRupiah } from '@/lib/utils'
import { SafeButton, SectionCard, SectionHeader, StatusBadge } from '@/components/ui/NizamUI'

type ThemeHomepageEditorProps = {
  orgSlug: string
  selectedStore: EcommerceDashboardData['stores'][number]
  dashboardData: EcommerceDashboardData
  storeThemeDraft: StoreThemeVersionView | null
  storeThemePublished: StoreThemeVersionView | null
  isPending: boolean
  appendStoreContext: (formData: FormData) => void
  runAction: (
    action: (formData: FormData) => Promise<{ success: boolean; error?: string | null }>,
    formData: FormData,
    successText: string
  ) => Promise<void>
}

type ThemeEditorSnapshot = {
  versionName: string
  tokens: StoreThemeTokens
  layout: StoreThemeLayout
}

type LocalMessage = {
  tone: 'success' | 'error' | 'info'
  text: string
} | null

type PreviewCatalogItem = StorefrontProductView & {
  priceLabel: string
}

type PreviewProductMap = Map<string, PreviewCatalogItem>

const THEME_EDITOR_PAGES: Array<{
  key: StoreThemeEditorPage
  label: string
  previewLabel: string
  pathSuffix: string
}> = [
  { key: 'home', label: 'Beranda', previewLabel: 'Homepage Store', pathSuffix: '' },
  { key: 'collection', label: 'Koleksi', previewLabel: 'Halaman Koleksi', pathSuffix: '/koleksi' },
  { key: 'product', label: 'Detail Produk', previewLabel: 'Halaman Produk', pathSuffix: '/produk/preview-produk' },
]

const TOKEN_COLOR_FIELDS: Array<{
  key: keyof Pick<StoreThemeTokens, 'accent' | 'accentStrong' | 'accentSoft' | 'surface' | 'surfaceAlt' | 'border' | 'text' | 'muted'>
  label: string
}> = [
  { key: 'accent', label: 'Warna utama' },
  { key: 'accentStrong', label: 'Warna kuat' },
  { key: 'accentSoft', label: 'Warna lembut' },
  { key: 'surface', label: 'Warna surface' },
  { key: 'surfaceAlt', label: 'Warna surface alt' },
  { key: 'border', label: 'Warna border' },
  { key: 'text', label: 'Warna teks' },
  { key: 'muted', label: 'Warna teks lembut' },
]

const BLOCK_FIELD_META: Record<
  StoreThemeBlockEditorFieldKey,
  { label: string; placeholder: string; kind: 'text' | 'textarea' | 'url' | 'number' | 'product' }
> = {
  eyebrow: {
    label: 'Label kecil',
    placeholder: 'Contoh: Promo Hari Ini',
    kind: 'text',
  },
  title: {
    label: 'Judul',
    placeholder: 'Tulis judul utama blok',
    kind: 'text',
  },
  body: {
    label: 'Isi',
    placeholder: 'Tulis penjelasan singkat yang mudah dipahami pengunjung.',
    kind: 'textarea',
  },
  ctaLabel: {
    label: 'Label tombol',
    placeholder: 'Contoh: Belanja Sekarang',
    kind: 'text',
  },
  ctaHref: {
    label: 'Link tombol',
    placeholder: '#checkout atau https://...',
    kind: 'url',
  },
  imageUrl: {
    label: 'URL gambar',
    placeholder: 'Pilih dari pustaka asset lalu tempel URL di sini',
    kind: 'url',
  },
  imageAlt: {
    label: 'Alt gambar',
    placeholder: 'Deskripsi singkat gambar',
    kind: 'text',
  },
  featuredProductId: {
    label: 'Produk unggulan',
    placeholder: 'Pilih produk dari katalog store',
    kind: 'product',
  },
  productCount: {
    label: 'Jumlah produk',
    placeholder: 'Maksimal 24',
    kind: 'number',
  },
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function buildDefaultItem(block: StoreThemeBlock, index: number): StoreThemeBlockItem {
  const itemLabel = STORE_THEME_BLOCK_SCHEMAS[block.type]?.itemLabel || 'Item'
  return {
    label: block.type === 'category-grid' ? `Kategori ${index + 1}` : '',
    title: `${itemLabel} ${index + 1}`,
    body: 'Isi singkat yang membantu pengunjung memahami blok ini.',
    href: '',
    imageUrl: '',
  }
}

function buildInitialSnapshot(
  dashboardData: EcommerceDashboardData,
  selectedStoreId: string,
  draftTheme: StoreThemeVersionView | null,
  publishedTheme: StoreThemeVersionView | null
): ThemeEditorSnapshot {
  const fallbackSeed = buildThemeDraftFromTemplate(dashboardData.templates[0]?.key)
  const source = draftTheme || publishedTheme

  const tokens = normalizeStoreThemeTokens(source?.tokens || fallbackSeed.tokens)
  const baseLayout = normalizeStoreThemeLayout(source?.layout || fallbackSeed.layout)
  const checkout = normalizeStoreCheckoutBranding(
    (source?.branding as { checkout?: unknown } | undefined)?.checkout || baseLayout.checkout
  )

  return {
    versionName: source?.versionName || `${dashboardData.templates[0]?.name || 'Draft Theme'} ${selectedStoreId ? 'Draft' : ''}`.trim(),
    tokens,
    layout: {
      ...baseLayout,
      checkout,
    },
  }
}

function collectUnknownBlockTypes(layoutValue: unknown) {
  const source = (typeof layoutValue === 'object' && layoutValue && !Array.isArray(layoutValue)
    ? layoutValue
    : {}) as Record<string, unknown>
  const pages: Array<'home' | 'collection' | 'product'> = ['home', 'collection', 'product']
  const unknown: string[] = []

  pages.forEach((page) => {
    const blocks = Array.isArray(source[page]) ? source[page] : []
    blocks.forEach((block) => {
      const type = String((block as Record<string, unknown>)?.type || '').trim()
      if (type && !STORE_THEME_BLOCK_TYPES.includes(type as StoreThemeBlockType)) {
        unknown.push(`${page}: ${type}`)
      }
    })
  })

  return unknown
}

function readAdvancedSnapshot(
  versionName: string,
  tokensJson: string,
  layoutJson: string,
  checkoutJson: string
): { snapshot: ThemeEditorSnapshot | null; error: string } {
  try {
    const parsedTokens = JSON.parse(tokensJson || '{}')
    const parsedLayout = JSON.parse(layoutJson || '{}')
    const parsedCheckout = JSON.parse(checkoutJson || '{}')
    const unknownTypes = collectUnknownBlockTypes(parsedLayout)

    if (unknownTypes.length > 0) {
      return {
        snapshot: null,
        error: `Ada type blok yang tidak resmi: ${unknownTypes.join(', ')}.`,
      }
    }

    const tokens = normalizeStoreThemeTokens(parsedTokens)
    const layout = normalizeStoreThemeLayout(parsedLayout)
    const checkout = normalizeStoreCheckoutBranding(parsedCheckout)

    return {
      snapshot: {
        versionName: versionName.trim() || 'Draft Theme',
        tokens,
        layout: {
          ...layout,
          checkout,
        },
      },
      error: '',
    }
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? `JSON belum valid: ${error.message}` : 'JSON belum valid.',
    }
  }
}

function buildPreviewProducts(
  dashboardData: EcommerceDashboardData,
  storeId: string
): PreviewCatalogItem[] {
  const baseProductById = new Map(
    dashboardData.products.map((product) => [product.id, product])
  )

  return dashboardData.storeProducts
    .filter((product) => product.storeId === storeId && product.isPublished)
    .sort((left, right) => {
      if (left.isFeatured !== right.isFeatured) {
        return left.isFeatured ? -1 : 1
      }
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
      }
      return (left.publicName || '').localeCompare(right.publicName || '')
    })
    .map((product) => {
      const baseProduct = baseProductById.get(product.productId)
      const price = product.priceOverride ?? baseProduct?.basePrice ?? 0
      const comparePrice = product.comparePrice ?? 0
      const imageUrl = product.imageUrl || ''

      return {
        id: product.productId,
        inventoryProductId: product.productId,
        slug: product.publicSlug || baseProduct?.name?.toLowerCase() || product.productId,
        name: product.publicName || baseProduct?.name || 'Produk Tanpa Nama',
        shortDescription: product.shortDescription || '',
        description: product.publicDescription || baseProduct?.description || '',
        badgeText: product.badgeText || '',
        price,
        comparePrice,
        imageUrl,
        gallery: imageUrl ? [imageUrl] : [],
        isFeatured: product.isFeatured,
        isPublished: product.isPublished,
        stockQty: 0,
        variants: [],
        priceLabel: formatRupiah(price),
      }
    })
}

function buildPreviewShippingRates(
  dashboardData: EcommerceDashboardData,
  storeId: string
): StorefrontShippingRateView[] {
  const zoneById = new Map(
    dashboardData.shippingZones
      .filter((zone) => zone.storeId === storeId && zone.isActive)
      .map((zone) => [zone.id, zone])
  )

  return dashboardData.shippingRates
    .filter((rate) => rate.storeId === storeId && rate.isActive)
    .map((rate) => ({
      id: rate.id,
      zoneId: rate.zoneId,
      zoneName: rate.zoneName,
      name: rate.name,
      amount: rate.amount,
      etaLabel: rate.etaLabel,
      matcher: {
        countries: zoneById.get(rate.zoneId)?.countries || [],
        provinces: zoneById.get(rate.zoneId)?.provinces || [],
        cities: zoneById.get(rate.zoneId)?.cities || [],
        postalCodes: zoneById.get(rate.zoneId)?.postalCodes || [],
      },
    }))
}

function buildPreviewPayload(args: {
  orgSlug: string
  selectedStore: EcommerceDashboardData['stores'][number]
  storeThemeDraft: StoreThemeVersionView | null
  snapshot: ThemeEditorSnapshot
  products: PreviewCatalogItem[]
  shippingRates: StorefrontShippingRateView[]
}): StorefrontPublicPayload {
  const { orgSlug, selectedStore, storeThemeDraft, snapshot, products, shippingRates } = args

  return {
    store: {
      id: selectedStore.id,
      orgId: selectedStore.orgId,
      orgSlug,
      name: selectedStore.name,
      slug: selectedStore.slug,
      brandName: selectedStore.brandName,
      lineName: selectedStore.lineName,
      logoUrl: selectedStore.logoUrl,
      headline: selectedStore.headline,
      subheadline: selectedStore.subheadline,
      supportEmail: selectedStore.supportEmail,
      supportPhone: selectedStore.supportPhone,
      whatsappPhone: selectedStore.whatsappPhone,
      transferInstructions: selectedStore.transferInstructions,
      seoTitle: selectedStore.name,
      seoDescription: selectedStore.subheadline,
      heroNotice: selectedStore.heroNotice,
      checkoutNotice: selectedStore.checkoutNotice,
      currency: selectedStore.currency,
    },
    theme: {
      id: storeThemeDraft?.id || `draft-${selectedStore.id}`,
      storeId: selectedStore.id,
      versionName: snapshot.versionName,
      status: 'DRAFT',
      previewToken: storeThemeDraft?.previewToken || '',
      tokens: snapshot.tokens,
      layout: snapshot.layout,
      branding: {
        checkout: snapshot.layout.checkout,
      },
      publishedAt: null,
      updatedAt: new Date().toISOString(),
    },
    products,
    shippingRates,
    previewMode: true,
  }
}

function EditorLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  )
}

export default function ThemeHomepageEditor({
  orgSlug,
  selectedStore,
  dashboardData,
  storeThemeDraft,
  storeThemePublished,
  isPending,
  appendStoreContext,
  runAction,
}: ThemeHomepageEditorProps) {
  const initialSnapshot = useMemo(
    () => buildInitialSnapshot(dashboardData, selectedStore.id, storeThemeDraft, storeThemePublished),
    [
      dashboardData,
      selectedStore.id,
      storeThemeDraft,
      storeThemePublished,
    ]
  )

  const [versionName, setVersionName] = useState(initialSnapshot.versionName)
  const [themeTokens, setThemeTokens] = useState(initialSnapshot.tokens)
  const [themeLayout, setThemeLayout] = useState(initialSnapshot.layout)
  const [activePage, setActivePage] = useState<StoreThemeEditorPage>('home')
  const [selectedBlockByPage, setSelectedBlockByPage] = useState<Record<StoreThemeEditorPage, string>>({
    home: initialSnapshot.layout.home[0]?.id || '',
    collection: initialSnapshot.layout.collection[0]?.id || '',
    product: initialSnapshot.layout.product[0]?.id || '',
  })
  const [newBlockTypeByPage, setNewBlockTypeByPage] = useState<Record<StoreThemeEditorPage, StoreThemeBlockType>>({
    home: 'hero',
    collection: 'product-grid',
    product: 'featured-product',
  })
  const [advancedMode, setAdvancedMode] = useState(false)
  const [tokensJson, setTokensJson] = useState(prettyJson(initialSnapshot.tokens))
  const [layoutJson, setLayoutJson] = useState(prettyJson(initialSnapshot.layout))
  const [checkoutJson, setCheckoutJson] = useState(prettyJson(initialSnapshot.layout.checkout))
  const [templateKey, setTemplateKey] = useState(dashboardData.templates[0]?.key || '')
  const [copiedAssetUrl, setCopiedAssetUrl] = useState('')
  const [localMessage, setLocalMessage] = useState<LocalMessage>(null)
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop')

  const pageBlocks = themeLayout[activePage]
  const activeBlock =
    pageBlocks.find((block) => block.id === selectedBlockByPage[activePage])
    || pageBlocks[0]
    || null
  const activePageMeta = THEME_EDITOR_PAGES.find((page) => page.key === activePage) || THEME_EDITOR_PAGES[0]

  const previewProducts = useMemo(
    () => buildPreviewProducts(dashboardData, selectedStore.id),
    [dashboardData, selectedStore.id]
  )
  const previewProductById = useMemo<PreviewProductMap>(
    () => new Map(previewProducts.map((product) => [product.id, product])),
    [previewProducts]
  )
  const previewShippingRates = useMemo(
    () => buildPreviewShippingRates(dashboardData, selectedStore.id),
    [dashboardData, selectedStore.id]
  )
  const selectedThemeAssets = useMemo(
    () => dashboardData.themeAssets.filter((asset) => asset.storeId === selectedStore.id),
    [dashboardData.themeAssets, selectedStore.id]
  )

  const advancedResult = useMemo(
    () => (
      advancedMode
        ? readAdvancedSnapshot(versionName, tokensJson, layoutJson, checkoutJson)
        : { snapshot: null, error: '' }
    ),
    [advancedMode, checkoutJson, layoutJson, tokensJson, versionName]
  )

  const visualSnapshot = useMemo<ThemeEditorSnapshot>(() => ({
    versionName: versionName.trim() || 'Draft Theme',
    tokens: normalizeStoreThemeTokens(themeTokens),
    layout: normalizeStoreThemeLayout({
      ...themeLayout,
      checkout: normalizeStoreCheckoutBranding(themeLayout.checkout),
    }),
  }), [themeLayout, themeTokens, versionName])

  const effectiveSnapshot = advancedMode
    ? advancedResult.snapshot || visualSnapshot
    : visualSnapshot

  const previewPayload = useMemo(
    () => buildPreviewPayload({
      orgSlug,
      selectedStore,
      storeThemeDraft,
      snapshot: effectiveSnapshot,
      products: previewProducts,
      shippingRates: previewShippingRates,
    }),
    [
      effectiveSnapshot,
      orgSlug,
      previewProducts,
      previewShippingRates,
      selectedStore,
      storeThemeDraft,
    ]
  )

  const previewHref = useMemo(() => {
    if (!storeThemeDraft) return ''

    if (activePage === 'collection') {
      return `/toko/${orgSlug}/${selectedStore.slug}/koleksi?preview=${storeThemeDraft.previewToken}`
    }

    if (activePage === 'product') {
      const previewProductSlug = previewProducts[0]?.slug
      if (!previewProductSlug) {
        return `/toko/${orgSlug}/${selectedStore.slug}?preview=${storeThemeDraft.previewToken}`
      }

      return `/toko/${orgSlug}/${selectedStore.slug}/produk/${previewProductSlug}?preview=${storeThemeDraft.previewToken}`
    }

    return `/toko/${orgSlug}/${selectedStore.slug}?preview=${storeThemeDraft.previewToken}`
  }, [activePage, orgSlug, previewProducts, selectedStore.slug, storeThemeDraft])

  function syncJsonFromVisual() {
    setTokensJson(prettyJson(visualSnapshot.tokens))
    setLayoutJson(prettyJson(visualSnapshot.layout))
    setCheckoutJson(prettyJson(visualSnapshot.layout.checkout))
  }

  function applySnapshotToVisual(snapshot: ThemeEditorSnapshot) {
    setVersionName(snapshot.versionName)
    setThemeTokens(snapshot.tokens)
    setThemeLayout(snapshot.layout)
    setSelectedBlockByPage((current) => ({
      home: snapshot.layout.home.some((block) => block.id === current.home)
        ? current.home
        : snapshot.layout.home[0]?.id || '',
      collection: snapshot.layout.collection.some((block) => block.id === current.collection)
        ? current.collection
        : snapshot.layout.collection[0]?.id || '',
      product: snapshot.layout.product.some((block) => block.id === current.product)
        ? current.product
        : snapshot.layout.product[0]?.id || '',
    }))
    setTokensJson(prettyJson(snapshot.tokens))
    setLayoutJson(prettyJson(snapshot.layout))
    setCheckoutJson(prettyJson(snapshot.layout.checkout))
  }

  function updatePageBlocks(
    page: StoreThemeEditorPage,
    updater: (blocks: StoreThemeBlock[]) => StoreThemeBlock[]
  ) {
    setThemeLayout((current) => ({
      ...current,
      [page]: updater(current[page]),
    }))
  }

  function updateCheckoutBranding(patch: Partial<StoreCheckoutBranding>) {
    setThemeLayout((current) => ({
      ...current,
      checkout: normalizeStoreCheckoutBranding({
        ...current.checkout,
        ...patch,
      }),
    }))
  }

  function updateBlockField(blockId: string, key: StoreThemeBlockEditorFieldKey, value: string) {
    updatePageBlocks(activePage, (blocks) => blocks.map((block) => {
      if (block.id !== blockId) return block

      if (key === 'productCount') {
        return {
          ...block,
          productCount: value.trim() ? Math.max(0, Math.min(24, Number(value) || 0)) : undefined,
        }
      }

      return {
        ...block,
        [key]: value,
      }
    }))
  }

  function addBlock() {
    const nextBlock = buildDefaultStoreThemeBlock(newBlockTypeByPage[activePage], `${selectedStore.name}-${activePage}`)
    updatePageBlocks(activePage, (blocks) => [...blocks, nextBlock])
    setSelectedBlockByPage((current) => ({ ...current, [activePage]: nextBlock.id }))
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    updatePageBlocks(activePage, (blocks) => {
      const index = blocks.findIndex((block) => block.id === blockId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) {
        return blocks
      }

      const nextBlocks = [...blocks]
      const swap = nextBlocks[index]
      nextBlocks[index] = nextBlocks[nextIndex]
      nextBlocks[nextIndex] = swap
      return nextBlocks
    })
  }

  function duplicateBlock(block: StoreThemeBlock) {
    const cloned = cloneStoreThemeBlock(block)
    updatePageBlocks(activePage, (blocks) => {
      const index = blocks.findIndex((entry) => entry.id === block.id)
      if (index < 0) return [...blocks, cloned]
      const nextBlocks = [...blocks]
      nextBlocks.splice(index + 1, 0, cloned)
      return nextBlocks
    })
    setSelectedBlockByPage((current) => ({ ...current, [activePage]: cloned.id }))
  }

  function deleteBlock(blockId: string) {
    const currentIndex = pageBlocks.findIndex((block) => block.id === blockId)
    const fallbackId = pageBlocks[currentIndex + 1]?.id || pageBlocks[currentIndex - 1]?.id || ''
    updatePageBlocks(activePage, (blocks) => blocks.filter((block) => block.id !== blockId))
    setSelectedBlockByPage((current) => ({ ...current, [activePage]: fallbackId }))
  }

  function updateBlockItems(blockId: string, updater: (items: StoreThemeBlockItem[]) => StoreThemeBlockItem[]) {
    updatePageBlocks(activePage, (blocks) => blocks.map((block) => {
      if (block.id !== blockId) return block

      return {
        ...block,
        items: updater(block.items || []),
      }
    }))
  }

  function addBlockItem(block: StoreThemeBlock) {
    updateBlockItems(block.id, (items) => [...items, buildDefaultItem(block, items.length)])
  }

  function updateBlockItem(
    blockId: string,
    itemIndex: number,
    key: keyof StoreThemeBlockItem,
    value: string
  ) {
    updateBlockItems(blockId, (items) => items.map((item, index) => (
      index === itemIndex
        ? { ...item, [key]: value }
        : item
    )))
  }

  function moveBlockItem(blockId: string, itemIndex: number, direction: -1 | 1) {
    updateBlockItems(blockId, (items) => {
      const nextIndex = itemIndex + direction
      if (nextIndex < 0 || nextIndex >= items.length) return items
      const nextItems = [...items]
      const swap = nextItems[itemIndex]
      nextItems[itemIndex] = nextItems[nextIndex]
      nextItems[nextIndex] = swap
      return nextItems
    })
  }

  function deleteBlockItem(blockId: string, itemIndex: number) {
    updateBlockItems(blockId, (items) => items.filter((_, index) => index !== itemIndex))
  }

  async function copyAssetUrl(url: string) {
    if (!url) return

    try {
      await navigator.clipboard.writeText(url)
      setCopiedAssetUrl(url)
      setLocalMessage({
        tone: 'info',
        text: 'URL asset berhasil disalin. Tempel di field gambar blok yang Anda mau.',
      })
    } catch {
      setLocalMessage({
        tone: 'error',
        text: 'Gagal menyalin URL asset.',
      })
    }
  }

  function applyAssetToActiveBlock(url: string) {
    if (!activeBlock) return
    const schema = STORE_THEME_BLOCK_SCHEMAS[activeBlock.type]
    if (!schema.fields.includes('imageUrl')) {
      setLocalMessage({
        tone: 'info',
        text: 'Blok aktif ini tidak punya field gambar utama. Pilih blok lain atau pakai Mode Lanjutan.',
      })
      return
    }

    updateBlockField(activeBlock.id, 'imageUrl', url)
    setLocalMessage({
      tone: 'success',
      text: 'Asset dipasang ke blok aktif.',
    })
  }

  function openAdvancedMode() {
    syncJsonFromVisual()
    setAdvancedMode(true)
    setLocalMessage(null)
  }

  function closeAdvancedMode() {
    if (!advancedResult.snapshot) {
      setLocalMessage({
        tone: 'error',
        text: advancedResult.error || 'JSON masih bermasalah. Perbaiki dulu sebelum kembali ke mode visual.',
      })
      return
    }

    applySnapshotToVisual(advancedResult.snapshot)
    setAdvancedMode(false)
    setLocalMessage({
      tone: 'success',
      text: 'JSON berhasil diterapkan kembali ke editor visual.',
    })
  }

  async function saveDraft() {
    const snapshot = advancedMode ? advancedResult.snapshot : visualSnapshot
    if (!snapshot) {
      setLocalMessage({
        tone: 'error',
        text: advancedResult.error || 'Draft belum bisa disimpan karena JSON belum valid.',
      })
      return
    }

    if (advancedMode) {
      applySnapshotToVisual(snapshot)
    }

    const formData = new FormData()
    formData.set('store_id', selectedStore.id)
    formData.set('version_name', snapshot.versionName)
    formData.set('tokens', JSON.stringify(snapshot.tokens))
    formData.set('layout', JSON.stringify(snapshot.layout))
    formData.set('checkout_branding', JSON.stringify(snapshot.layout.checkout))
    appendStoreContext(formData)

    await runAction(saveStoreThemeDraftAction, formData, 'Draft theme berhasil disimpan.')
  }

  const blockSchema = activeBlock ? STORE_THEME_BLOCK_SCHEMAS[activeBlock.type] : null

  return (
    <SectionCard>
      <SectionHeader
        title="Theme Draft → Preview → Publish"
        subtitle="Beranda, koleksi, dan detail produk sekarang diedit lewat form visual. Mode JSON tetap ada sebagai jalur cadangan."
        icon={LayoutTemplate}
        actions={(
          <div className="flex flex-wrap gap-2">
            <SafeButton
              size="sm"
              variant={advancedMode ? 'secondary' : 'white'}
              icon={<Braces size={14} />}
              onClick={() => {
                if (advancedMode) {
                  closeAdvancedMode()
                  return
                }
                openAdvancedMode()
              }}
            >
              {advancedMode ? 'Kembali ke Visual' : 'Mode Lanjutan'}
            </SafeButton>
            <SafeButton
              size="sm"
              variant="white"
              isLoading={isPending}
              onClick={saveDraft}
            >
              Simpan Draft
            </SafeButton>
            <SafeButton
              size="sm"
              isLoading={isPending}
              onClick={async () => {
                const formData = new FormData()
                formData.set('store_id', selectedStore.id)
                appendStoreContext(formData)
                await runAction(publishStoreThemeDraftAction, formData, 'Draft theme berhasil dipublish.')
              }}
            >
              Publish Theme
            </SafeButton>
          </div>
        )}
      />

      <div className="space-y-6 px-10 py-8">
        {localMessage && (
          <div className={`rounded-xl border px-5 py-4 text-sm font-bold ${
            localMessage.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : localMessage.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}>
            {localMessage.text}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[0.78fr_0.92fr_1.3fr]">
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Versi Theme</div>
              <div className="mt-3 space-y-3">
                <input
                  value={versionName}
                  onChange={(event) => setVersionName(event.target.value)}
                  placeholder="Nama draft theme"
                  className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                />
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={`Draft: ${storeThemeDraft?.versionName || 'Belum ada'}`} variant="info" />
                  <StatusBadge label={`Published: ${storeThemePublished?.versionName || 'Belum ada'}`} variant="neutral" />
                </div>
                {storeThemeDraft && previewHref && (
                  <Link
                    href={previewHref}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700"
                  >
                    Buka Preview Draft Publik
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Halaman Yang Sedang Diedit</div>
              <div className="mt-4 grid gap-3">
                {THEME_EDITOR_PAGES.map((page) => (
                  <button
                    key={page.key}
                    type="button"
                    onClick={() => {
                      setActivePage(page.key)
                      setSelectedBlockByPage((current) => ({
                        ...current,
                        [page.key]: current[page.key] || themeLayout[page.key][0]?.id || '',
                      }))
                    }}
                    className={`rounded-xl border px-4 py-4 text-left transition ${
                      activePage === page.key
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{page.label}</div>
                        <div className="mt-1 text-xs font-medium text-slate-500">
                          {themeLayout[page.key].length} blok aktif
                        </div>
                      </div>
                      <StatusBadge label={page.key} variant={activePage === page.key ? 'info' : 'neutral'} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                formData.set('store_id', selectedStore.id)
                appendStoreContext(formData)
                void runAction(uploadStoreThemeAssetAction, formData, 'Asset theme berhasil diunggah.')
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 p-5"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Upload Asset Theme</div>
              <div className="mt-4 space-y-3">
                <input
                  name="label"
                  placeholder="Label asset, misalnya Hero Banner"
                  className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-blue-500"
                />
                <input
                  name="file"
                  type="file"
                  accept="image/*"
                  required
                  className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-blue-500"
                />
                <SafeButton type="submit" isLoading={isPending} icon={<ImagePlus size={16} />}>
                  Upload Asset
                </SafeButton>
              </div>
            </form>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData()
                formData.set('store_id', selectedStore.id)
                formData.set('template_key', templateKey)
                appendStoreContext(formData)
                void runAction(resetStoreThemeDraftAction, formData, 'Draft theme berhasil diganti dari starter template.')
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 p-5"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Starter Template</div>
              <div className="mt-4 space-y-3">
                <select
                  value={templateKey}
                  onChange={(event) => setTemplateKey(event.target.value)}
                  className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                >
                  {dashboardData.templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <SafeButton type="submit" isLoading={isPending} icon={<Wand2 size={16} />}>
                  Reset Draft
                </SafeButton>
              </div>
            </form>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Blok {activePageMeta.label}</div>
                <div className="text-xs font-semibold text-slate-500">{pageBlocks.length} blok</div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <select
                  value={newBlockTypeByPage[activePage]}
                  onChange={(event) => setNewBlockTypeByPage((current) => ({
                    ...current,
                    [activePage]: event.target.value as StoreThemeBlockType,
                  }))}
                  className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                >
                  {STORE_THEME_BLOCK_SCHEMA_LIST.filter((schema) => schema.allowedPages.includes(activePage)).map((schema) => (
                    <option key={schema.type} value={schema.type}>
                      {schema.label}
                    </option>
                  ))}
                </select>
                <SafeButton size="sm" icon={<Plus size={14} />} onClick={addBlock}>
                  Tambah
                </SafeButton>
              </div>
              <div className="mt-4 space-y-3">
                {pageBlocks.length === 0 && (
                  <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-5 text-sm font-medium text-slate-500">
                    Belum ada blok untuk halaman {activePageMeta.label.toLowerCase()}. Tambahkan blok pertama dari daftar di atas.
                  </div>
                )}
                {pageBlocks.map((block, index) => (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => setSelectedBlockByPage((current) => ({ ...current, [activePage]: block.id }))}
                    className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                      block.id === activeBlock?.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {index + 1}. {STORE_THEME_BLOCK_SCHEMAS[block.type].label}
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {block.title || block.body || 'Blok tanpa judul'}
                        </div>
                        <div className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                          {STORE_THEME_BLOCK_SCHEMAS[block.type].description}
                        </div>
                        <div className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">
                          {STORE_THEME_BLOCK_SCHEMAS[block.type].editorHint}
                        </div>
                      </div>
                      <StatusBadge label={block.type} variant="neutral" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pustaka Asset</div>
              <div className="mt-4 space-y-3">
                {selectedThemeAssets.length === 0 && (
                  <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-5 text-sm font-medium text-slate-500">
                    Belum ada asset theme untuk store ini.
                  </div>
                )}
                {selectedThemeAssets.slice(0, 8).map((asset) => (
                  <div key={asset.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div
                      className="h-24 rounded-[18px] bg-cover bg-center"
                      style={{
                        backgroundImage: asset.publicUrl ? `url(${asset.publicUrl})` : undefined,
                        backgroundColor: '#E2E8F0',
                      }}
                    />
                    <div className="mt-3 text-sm font-semibold text-slate-900">{asset.label || 'Tanpa label'}</div>
                    <input
                      readOnly
                      value={asset.publicUrl}
                      className="mt-3 w-full rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600 outline-none"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SafeButton
                        size="sm"
                        variant="white"
                        onClick={() => applyAssetToActiveBlock(asset.publicUrl)}
                      >
                        Pakai di Blok Aktif
                      </SafeButton>
                      <SafeButton
                        size="sm"
                        variant="white"
                        icon={<Copy size={14} />}
                        onClick={() => {
                          void copyAssetUrl(asset.publicUrl)
                        }}
                      >
                        {copiedAssetUrl === asset.publicUrl ? 'Tersalin' : 'Copy URL'}
                      </SafeButton>
                      <Link
                        href={asset.publicUrl}
                        target="_blank"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700"
                      >
                        <ExternalLink size={14} />
                        Buka
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Token Theme</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {TOKEN_COLOR_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <EditorLabel>{field.label}</EditorLabel>
                    <div className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-3 py-3">
                      <input
                        type="color"
                        value={themeTokens[field.key]}
                        onChange={(event) => setThemeTokens((current) => ({ ...current, [field.key]: event.target.value }))}
                        className="h-10 w-10 rounded-xl border-0 bg-transparent p-0"
                      />
                      <input
                        value={themeTokens[field.key]}
                        onChange={(event) => setThemeTokens((current) => ({ ...current, [field.key]: event.target.value }))}
                        className="w-full bg-transparent font-mono text-sm outline-none"
                      />
                    </div>
                  </div>
                ))}
                <div className="space-y-2">
                  <EditorLabel>Font label</EditorLabel>
                  <select
                    value={themeTokens.fontLabel}
                    onChange={(event) => setThemeTokens((current) => ({ ...current, fontLabel: event.target.value as StoreThemeTokens['fontLabel'] }))}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                  >
                    {Object.keys(STORE_THEME_FONT_MAP).map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600" style={{ fontFamily: STORE_THEME_FONT_MAP[themeTokens.fontLabel] }}>
                    Contoh huruf untuk brand store Anda.
                  </div>
                </div>
                <div className="space-y-2">
                  <EditorLabel>Radius kartu</EditorLabel>
                  <select
                    value={themeTokens.cardRadius}
                    onChange={(event) => setThemeTokens((current) => ({ ...current, cardRadius: event.target.value as StoreThemeTokens['cardRadius'] }))}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                  >
                    <option value="soft">Soft</option>
                    <option value="rounded">Rounded</option>
                    <option value="sharp">Sharp</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <EditorLabel>Radius tombol</EditorLabel>
                  <select
                    value={themeTokens.buttonRadius}
                    onChange={(event) => setThemeTokens((current) => ({ ...current, buttonRadius: event.target.value as StoreThemeTokens['buttonRadius'] }))}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                  >
                    <option value="soft">Soft</option>
                    <option value="rounded">Rounded</option>
                    <option value="pill">Pill</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <EditorLabel>Density</EditorLabel>
                  <select
                    value={themeTokens.density}
                    onChange={(event) => setThemeTokens((current) => ({ ...current, density: event.target.value as StoreThemeTokens['density'] }))}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <EditorLabel>Shadow</EditorLabel>
                  <select
                    value={themeTokens.shadow}
                    onChange={(event) => setThemeTokens((current) => ({ ...current, shadow: event.target.value as StoreThemeTokens['shadow'] }))}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                  >
                    <option value="soft">Soft</option>
                    <option value="medium">Medium</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Branding Checkout</div>
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <EditorLabel>Banner Title</EditorLabel>
                  <input
                    value={themeLayout.checkout.bannerTitle}
                    onChange={(event) => updateCheckoutBranding({ bannerTitle: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <EditorLabel>Banner Body</EditorLabel>
                  <textarea
                    value={themeLayout.checkout.bannerBody}
                    onChange={(event) => updateCheckoutBranding({ bannerBody: event.target.value })}
                    rows={4}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <EditorLabel>Support Label</EditorLabel>
                  <input
                    value={themeLayout.checkout.supportLabel}
                    onChange={(event) => updateCheckoutBranding({ supportLabel: event.target.value })}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {advancedMode ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Mode Lanjutan</div>
                    <div className="mt-1 text-sm font-medium text-slate-500">
                      Jalur ini dipakai kalau Anda memang perlu sentuh JSON secara langsung.
                    </div>
                  </div>
                  <SafeButton size="sm" variant="white" onClick={closeAdvancedMode}>
                    Terapkan ke Visual
                  </SafeButton>
                </div>
                <div className="mt-4 space-y-4">
                  <textarea
                    value={tokensJson}
                    onChange={(event) => setTokensJson(event.target.value)}
                    rows={10}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-blue-500"
                  />
                  <textarea
                    value={layoutJson}
                    onChange={(event) => setLayoutJson(event.target.value)}
                    rows={14}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-blue-500"
                  />
                  <textarea
                    value={checkoutJson}
                    onChange={(event) => setCheckoutJson(event.target.value)}
                    rows={6}
                    className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-blue-500"
                  />
                  <div className={`rounded-[18px] border px-4 py-3 text-xs font-bold ${
                    advancedResult.error
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}>
                    {advancedResult.error || 'JSON valid. Anda bisa simpan draft atau terapkan kembali ke editor visual.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Editor Blok Aktif</div>
                    <div className="mt-1 text-sm font-medium text-slate-500">
                      Pilih blok di kolom kiri, lalu edit isi dan urutannya untuk halaman {activePageMeta.label.toLowerCase()}.
                    </div>
                  </div>
                  {activeBlock && (
                    <StatusBadge label={STORE_THEME_BLOCK_SCHEMAS[activeBlock.type].label} variant="indigo" />
                  )}
                </div>

                {!activeBlock && (
                  <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-5 text-sm font-medium text-slate-500">
                    Pilih atau tambahkan blok untuk halaman {activePageMeta.label.toLowerCase()} dulu.
                  </div>
                )}

                {activeBlock && blockSchema && (
                  <div className="mt-4 space-y-5">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap gap-2">
                        <SafeButton
                          size="sm"
                          variant="white"
                          icon={<ArrowUp size={14} />}
                          onClick={() => moveBlock(activeBlock.id, -1)}
                        >
                          Naik
                        </SafeButton>
                        <SafeButton
                          size="sm"
                          variant="white"
                          icon={<ArrowDown size={14} />}
                          onClick={() => moveBlock(activeBlock.id, 1)}
                        >
                          Turun
                        </SafeButton>
                        <SafeButton
                          size="sm"
                          variant="white"
                          icon={<Copy size={14} />}
                          onClick={() => duplicateBlock(activeBlock)}
                        >
                          Duplikasi
                        </SafeButton>
                        <SafeButton
                          size="sm"
                          variant="danger"
                          icon={<Trash2 size={14} />}
                          onClick={() => deleteBlock(activeBlock.id)}
                        >
                          Hapus
                        </SafeButton>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {blockSchema.fields.map((field) => {
                        const meta = BLOCK_FIELD_META[field]
                        const currentValue = field === 'productCount'
                          ? String(activeBlock.productCount ?? '')
                          : String(activeBlock[field] || '')

                        if (meta.kind === 'product') {
                          return (
                            <div key={field} className="space-y-2">
                              <EditorLabel>{meta.label}</EditorLabel>
                              <select
                                value={activeBlock.featuredProductId || ''}
                                onChange={(event) => updateBlockField(activeBlock.id, field, event.target.value)}
                                className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                              >
                                <option value="">Pilih produk unggulan</option>
                                {previewProducts.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name} • {product.priceLabel}
                                  </option>
                                ))}
                              </select>
                              {activeBlock.featuredProductId && previewProductById.get(activeBlock.featuredProductId) && (
                                <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
                                  Produk terpilih: <span className="font-semibold text-slate-900">{previewProductById.get(activeBlock.featuredProductId)?.name}</span>
                                </div>
                              )}
                            </div>
                          )
                        }

                        if (meta.kind === 'textarea') {
                          return (
                            <div key={field} className="space-y-2">
                              <EditorLabel>{meta.label}</EditorLabel>
                              <textarea
                                value={currentValue}
                                onChange={(event) => updateBlockField(activeBlock.id, field, event.target.value)}
                                rows={4}
                                placeholder={meta.placeholder}
                                className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-blue-500"
                              />
                            </div>
                          )
                        }

                        return (
                          <div key={field} className="space-y-2">
                            <EditorLabel>{meta.label}</EditorLabel>
                            <input
                              type={meta.kind === 'number' ? 'number' : 'text'}
                              min={meta.kind === 'number' ? '0' : undefined}
                              max={meta.kind === 'number' ? '24' : undefined}
                              value={currentValue}
                              onChange={(event) => updateBlockField(activeBlock.id, field, event.target.value)}
                              placeholder={meta.placeholder}
                              className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-blue-500"
                            />
                          </div>
                        )
                      })}
                    </div>

                    {blockSchema.supportsItems && (
                      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Item Berulang
                            </div>
                            <div className="mt-1 text-sm font-medium text-slate-500">
                              Tambah, edit, urutkan, atau hapus item di blok ini.
                            </div>
                          </div>
                          <SafeButton size="sm" variant="white" icon={<Plus size={14} />} onClick={() => addBlockItem(activeBlock)}>
                            Tambah Item
                          </SafeButton>
                        </div>
                        <div className="mt-4 space-y-4">
                          {(activeBlock.items || []).length === 0 && (
                            <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-500">
                              Belum ada item di blok ini.
                            </div>
                          )}
                          {(activeBlock.items || []).map((item, itemIndex) => (
                            <div key={`${activeBlock.id}-item-${itemIndex}`} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-wrap gap-2">
                                <SafeButton size="sm" variant="white" icon={<ArrowUp size={14} />} onClick={() => moveBlockItem(activeBlock.id, itemIndex, -1)}>
                                  Naik
                                </SafeButton>
                                <SafeButton size="sm" variant="white" icon={<ArrowDown size={14} />} onClick={() => moveBlockItem(activeBlock.id, itemIndex, 1)}>
                                  Turun
                                </SafeButton>
                                <SafeButton size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => deleteBlockItem(activeBlock.id, itemIndex)}>
                                  Hapus
                                </SafeButton>
                              </div>
                              <div className="mt-4 grid gap-3">
                                <input
                                  value={item.label || ''}
                                  onChange={(event) => updateBlockItem(activeBlock.id, itemIndex, 'label', event.target.value)}
                                  placeholder="Label kecil item"
                                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-blue-500"
                                />
                                <input
                                  value={item.title}
                                  onChange={(event) => updateBlockItem(activeBlock.id, itemIndex, 'title', event.target.value)}
                                  placeholder="Judul item"
                                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-blue-500"
                                />
                                <textarea
                                  value={item.body || ''}
                                  onChange={(event) => updateBlockItem(activeBlock.id, itemIndex, 'body', event.target.value)}
                                  rows={3}
                                  placeholder="Isi item"
                                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-blue-500"
                                />
                                <input
                                  value={item.href || ''}
                                  onChange={(event) => updateBlockItem(activeBlock.id, itemIndex, 'href', event.target.value)}
                                  placeholder="Link item, jika perlu"
                                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-blue-500"
                                />
                                <input
                                  value={item.imageUrl || ''}
                                  onChange={(event) => updateBlockItem(activeBlock.id, itemIndex, 'imageUrl', event.target.value)}
                                  placeholder="URL gambar item, jika perlu"
                                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Live Preview</div>
                  <div className="mt-1 text-sm font-medium text-slate-500">
                    Preview di bawah memakai renderer storefront yang sama dengan halaman publik.
                  </div>
                </div>
                <div className="flex gap-2">
                  <SafeButton
                    size="sm"
                    variant={previewViewport === 'desktop' ? 'secondary' : 'white'}
                    icon={<Monitor size={14} />}
                    onClick={() => setPreviewViewport('desktop')}
                  >
                    Desktop
                  </SafeButton>
                  <SafeButton
                    size="sm"
                    variant={previewViewport === 'mobile' ? 'secondary' : 'white'}
                    icon={<Smartphone size={14} />}
                    onClick={() => setPreviewViewport('mobile')}
                  >
                    Mobile
                  </SafeButton>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {activePageMeta.previewLabel}
              </div>
              <div className="max-h-[1320px] overflow-auto bg-slate-100">
                <div className={`pointer-events-none ${previewViewport === 'mobile' ? 'mx-auto max-w-[430px]' : 'min-w-[760px]'}`}>
                  <StorefrontClient
                    payload={previewPayload}
                    pageMode={activePage}
                    interactive={false}
                    embedded
                    initialProductSlug={previewProducts[0]?.slug || null}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
