'use client'

import { useMemo, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Globe,
  Package,
  PencilLine,
  Plus,
  RefreshCw,
  ShoppingBag,
  Store,
  Truck,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  approveOrderPaymentAction,
  createStoreAction,
  rejectOrderPaymentAction,
  retryOrderErpSyncAction,
  saveProductVariantAction,
  saveStoreBasicsAction,
  saveStoreCatalogProductAction,
  saveStoreDomainAction,
  saveStoreShippingRateAction,
  saveStoreShippingZoneAction,
} from '@/modules/ecommerce/actions/ecommerce.actions'
import {
  formatStoreThemeButtonRadius,
  formatStoreThemeRadius,
  formatThemeShadow,
  type EcommerceDashboardData,
  STORE_THEME_BLOCK_TYPES,
  STORE_THEME_FONT_MAP,
  type StoreThemeBlock,
  type StoreThemeTemplateSeed,
} from '@/modules/ecommerce/lib/ecommerce'
import { formatDate, formatRupiah } from '@/lib/utils'
import { PageHeader, SafeButton, SectionCard, SectionHeader, StatCard, StatusBadge } from '@/components/ui/NizamUI'
import ThemeHomepageEditor from '@/app/(dashboard)/ecommerce/ThemeHomepageEditor'

type EcommerceAdminClientProps = {
  orgSlug: string
  orgName: string
  dashboardData: EcommerceDashboardData
}

type FlashState = {
  tone: 'success' | 'error' | 'info'
  text: string
} | null

type EcommerceAdminTabId = 'ringkasan' | 'store' | 'katalog' | 'theme' | 'order'

function badgeVariantFromStatus(status: string) {
  const normalized = status.toUpperCase()
  if (normalized.includes('READY') || normalized === 'VALIDATED' || normalized === 'PAID') return 'success' as const
  if (normalized.includes('REJECT')) return 'error' as const
  if (normalized.includes('UNDER') || normalized.includes('AWAIT')) return 'warning' as const
  return 'neutral' as const
}

function formatRuleList(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'Semua'
}

function buildCatalogPreset(product?: EcommerceDashboardData['products'][number] | null) {
  return {
    publicName: product?.name || '',
    publicSlug: product?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '',
    shortDescription: '',
    publicDescription: product?.description || '',
    priceOverride: product?.basePrice ? String(product.basePrice) : '',
    comparePrice: '',
    badgeText: '',
    sortOrder: '0',
    imageUrl: '',
    isFeatured: false,
    isPublished: true,
  }
}

function buildVariantPreset(productId: string) {
  return {
    inventoryProductId: productId,
    variantName: '',
    sku: '',
    publicName: '',
    priceOverride: '',
    comparePrice: '',
    badgeText: '',
    imageUrl: '',
    attributesText: 'Ukuran: M',
    isActive: true,
    isDefault: false,
    isPublished: true,
  }
}

function truncatePreviewText(value: string | undefined, max: number) {
  const clean = String(value || '').trim()
  if (!clean) return ''
  if (clean.length <= max) return clean
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function pickTemplatePreviewBlock(blocks: StoreThemeBlock[], types: string[]) {
  return blocks.find((block) => types.includes(block.type)) || null
}

function TemplateMiniPreview({
  template,
  size = 'compact',
}: {
  template: StoreThemeTemplateSeed
  size?: 'compact' | 'detail'
}) {
  const { tokens } = template
  const homeBlocks = template.layout.home || []
  const heroBlock = pickTemplatePreviewBlock(homeBlocks, ['hero', 'rich-text', 'cta', 'image-banner'])
  const productBlock = pickTemplatePreviewBlock(homeBlocks, ['product-grid', 'featured-product'])
  const supportBlock = pickTemplatePreviewBlock(homeBlocks, ['promo-strip', 'category-grid', 'testimonial', 'faq', 'footer-sections'])
  const isDetail = size === 'detail'

  const previewStyle: CSSProperties = {
    backgroundColor: tokens.surface,
    fontFamily: STORE_THEME_FONT_MAP[tokens.fontLabel],
  }

  const heroStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${tokens.accentSoft} 0%, ${tokens.surfaceAlt} 100%)`,
    borderColor: tokens.border,
    color: tokens.text,
    borderRadius: formatStoreThemeRadius(tokens.cardRadius),
    boxShadow: formatThemeShadow(tokens.shadow),
  }

  const ctaStyle: CSSProperties = {
    backgroundColor: tokens.accent,
    color: '#ffffff',
    borderRadius: formatStoreThemeButtonRadius(tokens.buttonRadius),
  }

  const cardStyle: CSSProperties = {
    backgroundColor: '#ffffff',
    borderColor: tokens.border,
    borderRadius: formatStoreThemeRadius(tokens.cardRadius),
  }

  const sectionLabel = productBlock?.type === 'featured-product'
    ? 'Produk Unggulan'
    : productBlock?.title || 'Produk Pilihan'
  const supportLabel = supportBlock?.title || supportBlock?.body || `${template.category} storefront`

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${isDetail ? 'shadow-xl shadow-slate-200/60' : ''}`}>
      <div className={`flex items-center gap-2 border-b border-slate-200 ${isDetail ? 'px-5 py-4' : 'px-4 py-3'}`} style={{ backgroundColor: tokens.surfaceAlt }}>
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <div className="ml-2 h-2 w-16 rounded-full" style={{ backgroundColor: tokens.border }} />
      </div>
      <div className={`${isDetail ? 'space-y-4 p-5' : 'space-y-3 p-4'}`} style={previewStyle}>
        <div className={`border ${isDetail ? 'p-5' : 'p-4'}`} style={heroStyle}>
          <div className={`${isDetail ? 'text-[10px]' : 'text-[9px]'} font-black uppercase tracking-[0.18em]`} style={{ color: tokens.accentStrong }}>
            {truncatePreviewText(heroBlock?.eyebrow || template.category, isDetail ? 34 : 26)}
          </div>
          <div className={`mt-2 ${isDetail ? 'text-base' : 'text-sm'} font-black leading-tight`}>
            {truncatePreviewText(heroBlock?.title || template.name, isDetail ? 72 : 52)}
          </div>
          <div className={`mt-2 ${isDetail ? 'text-xs leading-5' : 'text-[10px] leading-4'}`} style={{ color: tokens.muted }}>
            {truncatePreviewText(heroBlock?.body || template.description, isDetail ? 140 : 92)}
          </div>
          <div className={`mt-3 inline-flex ${isDetail ? 'px-4 py-2 text-[11px]' : 'px-3 py-1.5 text-[10px]'} font-black`} style={ctaStyle}>
            {truncatePreviewText(heroBlock?.ctaLabel || 'Belanja Sekarang', isDetail ? 28 : 22)}
          </div>
        </div>

        <div className={`grid grid-cols-3 ${isDetail ? 'gap-3' : 'gap-2'}`}>
          {[0, 1, 2].map((index) => (
            <div key={`${template.key}-preview-card-${index}`} className={`border ${isDetail ? 'p-4' : 'p-3'}`} style={cardStyle}>
              <div className={`${isDetail ? 'h-14' : 'h-10'} rounded-xl`} style={{ backgroundColor: tokens.accentSoft }} />
              <div className="mt-2 h-2 rounded-full" style={{ backgroundColor: tokens.border }} />
              <div className="mt-1 h-2 w-3/4 rounded-full" style={{ backgroundColor: tokens.border }} />
            </div>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-[1.1fr_0.9fr]">
          <div className="border p-3" style={cardStyle}>
            <div className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: tokens.accentStrong }}>
              Catalog
            </div>
            <div className="mt-1 text-[11px] font-black" style={{ color: tokens.text }}>
              {truncatePreviewText(sectionLabel, 34)}
            </div>
            <div className="mt-1 text-[10px]" style={{ color: tokens.muted }}>
              {productBlock?.productCount ? `${productBlock.productCount} slot produk` : 'Grid produk aktif'}
            </div>
          </div>
          <div className="border p-3" style={cardStyle}>
            <div className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: tokens.accentStrong }}>
              Support
            </div>
            <div className="mt-1 text-[10px] leading-4" style={{ color: tokens.muted }}>
              {truncatePreviewText(supportLabel, 54)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplatePreviewPanel({ template }: { template: StoreThemeTemplateSeed }) {
  const featuredBlocks = template.layout.home.slice(0, 3).map((block) => block.type)

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 xl:sticky xl:top-6">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Preview Template</div>
      <div className="mt-4">
        <TemplateMiniPreview template={template} size="detail" />
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-slate-900">{template.name}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{template.description}</div>
          </div>
          <span className="rounded-full bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white">
            {template.category}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Font</div>
            <div className="mt-2 text-sm font-black text-slate-900">{template.tokens.fontLabel}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Aksen</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-5 w-5 rounded-full border border-slate-200" style={{ backgroundColor: template.tokens.accent }} />
              <span className="text-sm font-black text-slate-900">{template.tokens.accent}</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Blok Awal</div>
            <div className="mt-2 text-sm font-black capitalize text-slate-900">
              {featuredBlocks.join(' • ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StoreFormModal({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-6xl',
  children,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle: string
  maxWidthClass?: string
  children: ReactNode
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
            aria-label="Tutup modal"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`relative z-[91] max-h-[90vh] w-full ${maxWidthClass} overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-8 py-6">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">{title}</div>
                <div className="mt-2 text-sm font-medium leading-6 text-slate-500">{subtitle}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(90vh-96px)] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default function EcommerceAdminClient({
  orgSlug,
  orgName,
  dashboardData,
}: EcommerceAdminClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [flash, setFlash] = useState<FlashState>(null)
  const initialStoreId = dashboardData.stores[0]?.id || ''
  const initialProduct = dashboardData.products[0] || null
  const [selectedStoreId, setSelectedStoreId] = useState(initialStoreId)
  const [selectedProductId, setSelectedProductId] = useState(initialProduct?.id || '')
  const [selectedVariantProductId, setSelectedVariantProductId] = useState(initialProduct?.id || '')
  const [catalogForm, setCatalogForm] = useState(() => buildCatalogPreset(initialProduct))
  const [variantForm, setVariantForm] = useState(() => buildVariantPreset(initialProduct?.id || ''))
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL')
  const [newStoreTemplateKey, setNewStoreTemplateKey] = useState(dashboardData.templates[0]?.key || '')
  const [activeTab, setActiveTab] = useState<EcommerceAdminTabId>(initialStoreId ? 'ringkasan' : 'store')
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false)
  const [showEditStoreModal, setShowEditStoreModal] = useState(false)

  const selectedStore = useMemo(
    () => dashboardData.stores.find((store) => store.id === selectedStoreId) || dashboardData.stores[0] || null,
    [dashboardData.stores, selectedStoreId]
  )

  const selectedStoreSlug = selectedStore?.slug || ''
  const selectedStoreZones = useMemo(
    () => dashboardData.shippingZones.filter((item) => item.storeId === selectedStoreId),
    [dashboardData.shippingZones, selectedStoreId]
  )
  const selectedStoreRates = useMemo(
    () => dashboardData.shippingRates.filter((item) => item.storeId === selectedStoreId),
    [dashboardData.shippingRates, selectedStoreId]
  )
  const selectedStoreZoneById = useMemo(
    () => new Map(selectedStoreZones.map((zone) => [zone.id, zone])),
    [selectedStoreZones]
  )
  const storeThemeDraft = useMemo(() => {
    const draft = dashboardData.themes.find((item) =>
      item.storeId === selectedStoreId
      && item.status === 'DRAFT'
    )
    return draft || null
  }, [dashboardData.themes, selectedStoreId])

  const storeThemePublished = useMemo(() => {
    const published = dashboardData.themes.find((item) =>
      item.storeId === selectedStoreId
      && item.status === 'PUBLISHED'
    )
    return published || null
  }, [dashboardData.themes, selectedStoreId])

  const selectedProduct = useMemo(
    () => dashboardData.products.find((product) => product.id === selectedProductId) || null,
    [dashboardData.products, selectedProductId]
  )
  const orderEventsByOrderId = useMemo(() => {
    const grouped = new Map<string, EcommerceDashboardData['orderEvents']>()
    dashboardData.orderEvents.forEach((event) => {
      const bucket = grouped.get(event.orderId) || []
      bucket.push(event)
      grouped.set(event.orderId, bucket)
    })
    return grouped
  }, [dashboardData.orderEvents])
  const publishedProductCount = dashboardData.storeProducts.filter((item) => item.isPublished).length
  const pendingReviewCount = dashboardData.orders.filter((order) => order.paymentStatus === 'UNDER_REVIEW').length
  const readyFulfillCount = dashboardData.orders.filter((order) => order.status === 'READY_TO_FULFILL').length
  const selectedStorePublishedProductCount = useMemo(
    () => dashboardData.storeProducts.filter((item) => item.storeId === selectedStoreId && item.isPublished).length,
    [dashboardData.storeProducts, selectedStoreId]
  )
  const selectedStoreOrders = useMemo(
    () => dashboardData.orders.filter((order) => order.storeId === selectedStoreId),
    [dashboardData.orders, selectedStoreId]
  )
  const orderStatusOptions = useMemo(() => {
    const values = new Set<string>(['ALL'])
    selectedStoreOrders.forEach((order) => {
      values.add(order.status)
      values.add(order.paymentStatus)
      values.add(order.erpSyncStatus)
    })
    return [...values]
  }, [selectedStoreOrders])
  const filteredOrders = useMemo(() => {
    const needle = orderSearch.trim().toLowerCase()
    return selectedStoreOrders.filter((order) => {
      const matchesStatus = orderStatusFilter === 'ALL'
        || order.status === orderStatusFilter
        || order.paymentStatus === orderStatusFilter
        || order.erpSyncStatus === orderStatusFilter

      if (!matchesStatus) return false
      if (!needle) return true

      return (
        order.orderNumber.toLowerCase().includes(needle)
        || order.customerName.toLowerCase().includes(needle)
        || order.customerEmail.toLowerCase().includes(needle)
        || order.customerPhone.toLowerCase().includes(needle)
      )
    })
  }, [orderSearch, orderStatusFilter, selectedStoreOrders])
  const readinessChecks = useMemo(() => {
    const hasTransferInstructions = Boolean(selectedStore?.transferInstructions?.trim())
    const hasPublishedTheme = Boolean(storeThemePublished)
    const hasShippingZone = selectedStoreZones.some((zone) => zone.isActive)
    const hasShippingRate = selectedStoreRates.some((rate) => rate.isActive)
    const hasBankAccount = Boolean(selectedStore?.bankAccountId)
    const hasCatalog = selectedStorePublishedProductCount > 0

    return [
      { label: 'Katalog tayang', ready: hasCatalog },
      { label: 'Theme published', ready: hasPublishedTheme },
      { label: 'Instruksi transfer', ready: hasTransferInstructions },
      { label: 'Zona ongkir aktif', ready: hasShippingZone },
      { label: 'Tarif ongkir aktif', ready: hasShippingRate },
      { label: 'Rekening penerima', ready: hasBankAccount },
    ]
  }, [selectedStore, selectedStorePublishedProductCount, selectedStoreRates, selectedStoreZones, storeThemePublished])
  const readinessScore = readinessChecks.filter((item) => item.ready).length
  const observability = useMemo(() => ({
    waitingProof: selectedStoreOrders.filter((order) => order.paymentStatus === 'PENDING_UPLOAD').length,
    underReview: selectedStoreOrders.filter((order) => order.paymentStatus === 'UNDER_REVIEW').length,
    paymentException: selectedStoreOrders.filter((order) => order.status === 'PAYMENT_EXCEPTION').length,
    erpFailed: selectedStoreOrders.filter((order) => order.erpSyncStatus === 'FAILED').length,
    readyFulfill: selectedStoreOrders.filter((order) => order.status === 'READY_TO_FULFILL').length,
    awaitingPayment: selectedStoreOrders.filter((order) => order.status === 'AWAITING_PAYMENT').length,
  }), [selectedStoreOrders])
  const selectedCreateTemplate = useMemo(
    () => dashboardData.templates.find((template) => template.key === newStoreTemplateKey) || dashboardData.templates[0] || null,
    [dashboardData.templates, newStoreTemplateKey]
  )
  const adminTabs = useMemo(() => [
    {
      id: 'ringkasan' as const,
      label: 'Ringkasan',
      description: 'Kesiapan go-live dan observasi order.',
      disabled: !selectedStore,
    },
    {
      id: 'store' as const,
      label: 'Store',
      description: 'Buat store, edit data dasar, domain, dan ongkir.',
      disabled: false,
    },
    {
      id: 'katalog' as const,
      label: 'Katalog',
      description: 'Atur produk publik dan varian yang tampil.',
      disabled: !selectedStore,
    },
    {
      id: 'theme' as const,
      label: 'Theme',
      description: 'Kelola template dan tampilan storefront.',
      disabled: !selectedStore,
    },
    {
      id: 'order' as const,
      label: 'Order',
      description: 'Review pembayaran dan sinkron ERP.',
      disabled: !selectedStore,
    },
  ], [selectedStore])
  const quickCreateDefaults = useMemo(() => {
    const branch = dashboardData.branches[0] || null
    const warehouse = (branch && dashboardData.warehouses.find((item) => item.branchId === branch.id))
      || dashboardData.warehouses[0]
      || null
    const bankAccount = (branch && dashboardData.bankAccounts.find((item) => item.branchId === branch.id))
      || dashboardData.bankAccounts[0]
      || null

    return {
      branch,
      warehouse,
      bankAccount,
    }
  }, [dashboardData.bankAccounts, dashboardData.branches, dashboardData.warehouses])
  const quickCreateMissingRequirements = useMemo(() => {
    const missing: string[] = []

    if (!dashboardData.templates.length) missing.push('template storefront')
    if (!dashboardData.branches.length) missing.push('cabang aktif')
    if (!dashboardData.warehouses.length) missing.push('gudang aktif')
    if (!dashboardData.bankAccounts.length) missing.push('rekening penerima aktif')

    return missing
  }, [dashboardData.bankAccounts.length, dashboardData.branches.length, dashboardData.templates.length, dashboardData.warehouses.length])
  const canQuickCreateStore = quickCreateMissingRequirements.length === 0 && Boolean(selectedCreateTemplate)
  const visibleActiveTab: EcommerceAdminTabId = selectedStore ? activeTab : 'store'

  function refreshWithMessage(tone: FlashState['tone'], text: string) {
    setFlash({ tone, text })
    router.refresh()
  }

  function appendStoreContext(formData: FormData) {
    formData.set('org_slug', orgSlug)
    if (selectedStoreSlug) {
      formData.set('store_slug', selectedStoreSlug)
    }
  }

  function applyStoreSelection(nextStoreId: string) {
    setSelectedStoreId(nextStoreId)
  }

  function applyProductSelection(nextProductId: string) {
    setSelectedProductId(nextProductId)
    const product = dashboardData.products.find((item) => item.id === nextProductId) || null
    setCatalogForm(buildCatalogPreset(product))
  }

  function applyVariantProductSelection(nextProductId: string) {
    setSelectedVariantProductId(nextProductId)
    setVariantForm(buildVariantPreset(nextProductId))
  }

  async function handleAction(
    action: (formData: FormData) => Promise<{ success: boolean; error?: string | null }>,
    formData: FormData,
    successText: string
  ) {
    startTransition(async () => {
      const result = await action(formData)
      if (!result.success) {
        setFlash({ tone: 'error', text: result.error || 'Terjadi error saat menyimpan data.' })
        return
      }
      refreshWithMessage('success', successText)
    })
  }

  function handleCreateStoreSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set('template_key', newStoreTemplateKey)
    appendStoreContext(formData)

    startTransition(async () => {
      const result = await createStoreAction(formData)
      if (!result.success) {
        setFlash({ tone: 'error', text: result.error || 'Terjadi error saat membuat store.' })
        return
      }

      const createdStoreId = typeof result.data === 'object' && result.data && 'storeId' in result.data
        ? String((result.data as { storeId?: unknown }).storeId || '')
        : ''

      if (createdStoreId) {
        setSelectedStoreId(createdStoreId)
      }

      form.reset()
      setNewStoreTemplateKey(dashboardData.templates[0]?.key || '')
      setShowCreateStoreModal(false)
      refreshWithMessage('success', 'Store baru berhasil dibuat. Detail lain bisa dilengkapi nanti.')
    })
  }

  function handleEditStoreSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    appendStoreContext(formData)

    startTransition(async () => {
      const result = await saveStoreBasicsAction(formData)
      if (!result.success) {
        setFlash({ tone: 'error', text: result.error || 'Terjadi error saat menyimpan store.' })
        return
      }

      setShowEditStoreModal(false)
      refreshWithMessage('success', 'Store berhasil diperbarui.')
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        tag="E-Commerce"
        title="Storefront + Theme Builder"
        subtitle={`Semua pengaturan store ${orgName}, katalog publik, theme draft/publish, dan review order ada di sini.`}
        icon={Store}
      />

      {flash && (
        <div className={`rounded-xl border px-5 py-4 text-sm font-bold ${
          flash.tone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : flash.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-blue-200 bg-blue-50 text-blue-700'
        }`}>
          {flash.text}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-4">
        <StatCard label="Store Aktif" value={dashboardData.stores.length} icon={Store} color="blue" sub="Multi-store per brand/lini" />
        <StatCard label="Produk Tayang" value={publishedProductCount} icon={Package} color="emerald" sub="Override publik per store" />
        <StatCard label="Pembayaran Direview" value={pendingReviewCount} icon={ShoppingBag} color="amber" sub="Masuk queue validasi" />
        <StatCard label="Siap Dipenuhi" value={readyFulfillCount} icon={Truck} color="indigo" sub="Sudah tersinkron ke ERP" />
      </div>

      <SectionCard>
        <SectionHeader
          title="Pilih Store"
          subtitle="Semua section di bawah akan mengikuti store yang sedang dipilih."
          icon={Store}
        />
        <div className="grid gap-4 px-10 py-8 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Store Aktif</label>
            <select
              value={selectedStoreId}
              onChange={(event) => applyStoreSelection(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold text-slate-900 outline-none focus:border-blue-500"
            >
              {dashboardData.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} ({store.slug})
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ringkas</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{selectedStore?.name || 'Belum ada store'}</div>
            <div className="mt-1 text-sm font-medium text-slate-500">
              Domain: {(selectedStore?.domainList || []).join(', ') || 'Belum ada custom domain'}
            </div>
            {selectedStore && (
              <div className="mt-4 flex flex-wrap gap-3">
                <StatusBadge label={selectedStore.isPublished ? 'Live' : 'Draft'} variant={selectedStore.isPublished ? 'success' : 'neutral'} />
                <Link
                  href={`/toko/${orgSlug}/${selectedStore.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black text-slate-700"
                >
                  Buka Storefront
                </Link>
                {storeThemeDraft && (
                  <Link
                    href={`/toko/${orgSlug}/${selectedStore.slug}?preview=${storeThemeDraft.previewToken}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-[11px] font-black text-blue-700"
                  >
                    Preview Draft
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader
          title="Menu Pengaturan"
          subtitle="Pilih tab supaya halaman tidak terlalu padat. Setiap tab hanya menampilkan kelompok pengaturan yang relevan."
          icon={Store}
        />
        <div className="px-10 py-8">
          <div className="flex flex-wrap gap-3">
            {adminTabs.map((tab) => {
              const isActive = visibleActiveTab === tab.id

              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={tab.disabled}
                  onClick={() => {
                    if (!tab.disabled) {
                      setActiveTab(tab.id)
                    }
                  }}
                  className={`min-w-[180px] rounded-xl border px-5 py-4 text-left transition ${
                    tab.disabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                      : isActive
                        ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className={`text-sm font-black ${isActive && !tab.disabled ? 'text-blue-700' : 'text-slate-900'}`}>
                    {tab.label}
                  </div>
                  <div className={`mt-2 text-xs leading-5 ${tab.disabled ? 'text-slate-400' : 'text-slate-500'}`}>
                    {tab.description}
                  </div>
                </button>
              )
            })}
          </div>
          {!selectedStore && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-700">
              Tab selain `Store` akan aktif setelah store pertama berhasil dibuat.
            </div>
          )}
        </div>
      </SectionCard>

      {visibleActiveTab === 'ringkasan' && selectedStore && (
        <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
          <SectionCard>
            <SectionHeader
              title="Kesiapan Go-Live"
              subtitle="Checklist ini membantu melihat apakah store sudah cukup rapi untuk dibuka ke pembeli."
              icon={Store}
            />
            <div className="space-y-4 px-10 py-8">
              <div className={`rounded-xl border px-5 py-4 text-sm font-bold ${
                readinessScore === readinessChecks.length
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}>
                {readinessScore === readinessChecks.length
                  ? `${selectedStore.name} sudah siap dipakai pilot jual.`
                  : `${selectedStore.name} baru memenuhi ${readinessScore} dari ${readinessChecks.length} syarat dasar.`}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {readinessChecks.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-sm font-black text-slate-900">{item.label}</div>
                    <div className={`mt-2 text-xs font-black uppercase tracking-[0.14em] ${
                      item.ready ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {item.ready ? 'Siap' : 'Belum lengkap'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeader
              title="Observasi Order"
              subtitle="Angka cepat ini membantu tim admin melihat antrean order store yang sedang dipilih."
              icon={ShoppingBag}
            />
            <div className="grid gap-5 px-10 py-8 md:grid-cols-3">
              <StatCard label="Menunggu Bukti" value={observability.waitingProof} icon={ShoppingBag} color="amber" sub="Order sudah dibuat" />
              <StatCard label="Sedang Direview" value={observability.underReview} icon={RefreshCw} color="amber" sub="Perlu keputusan admin" />
              <StatCard label="Payment Exception" value={observability.paymentException} icon={Truck} color="amber" sub="Butuh penanganan" />
              <StatCard label="ERP Gagal" value={observability.erpFailed} icon={RefreshCw} color="amber" sub="Perlu retry aman" />
              <StatCard label="Siap Dipenuhi" value={observability.readyFulfill} icon={Truck} color="indigo" sub="Sudah sync ke ERP" />
              <StatCard label="Masih Menunggu Bayar" value={observability.awaitingPayment} icon={Package} color="blue" sub="Belum ada bukti bayar" />
            </div>
          </SectionCard>
        </div>
      )}

      {visibleActiveTab === 'store' && (
        <>
          <SectionCard>
            <SectionHeader
              title="Aksi Store"
              subtitle="Form panjang dipindah ke modal supaya halaman store tetap ringkas."
              icon={Store}
              actions={(
                <>
                  <SafeButton type="button" icon={<Plus size={16} />} onClick={() => setShowCreateStoreModal(true)}>
                    Buat Store Baru
                  </SafeButton>
                  <SafeButton
                    type="button"
                    variant="white"
                    icon={<PencilLine size={16} />}
                    disabled={!selectedStore}
                    onClick={() => {
                      if (selectedStore) {
                        setShowEditStoreModal(true)
                      }
                    }}
                  >
                    Edit Store
                  </SafeButton>
                </>
              )}
            />
            <div className="grid gap-6 px-10 py-8 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-5">
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Buat Store Cepat</div>
                  <div className="mt-3 text-sm leading-6 text-slate-600">
                    Cukup isi nama store dan pilih template di modal. Kontak, instruksi transfer, SEO, dan detail lain bisa dilengkapi nanti.
                  </div>
                  <div className="mt-4">
                    <SafeButton type="button" icon={<Plus size={16} />} onClick={() => setShowCreateStoreModal(true)}>
                      Buka Form Store Baru
                    </SafeButton>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Default Otomatis</div>
                  {canQuickCreateStore ? (
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <div><span className="font-black text-slate-900">Cabang:</span> {quickCreateDefaults.branch?.name}</div>
                      <div><span className="font-black text-slate-900">Gudang:</span> {quickCreateDefaults.warehouse?.name}</div>
                      <div><span className="font-black text-slate-900">Rekening:</span> {quickCreateDefaults.bankAccount?.label}</div>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm font-bold text-amber-700">
                      Store belum bisa dibuat cepat karena masih kurang: {quickCreateMissingRequirements.join(', ')}.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Store Aktif</div>
                {selectedStore ? (
                  <div className="mt-4 space-y-5">
                    <div>
                      <div className="text-2xl font-semibold text-slate-900">{selectedStore.name}</div>
                      <div className="mt-2 text-sm font-medium text-slate-500">Slug: {selectedStore.slug}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label={selectedStore.isPublished ? 'Live' : 'Draft'} variant={selectedStore.isPublished ? 'success' : 'neutral'} />
                      <StatusBadge label={selectedStore.isActive ? 'Aktif' : 'Nonaktif'} variant={selectedStore.isActive ? 'info' : 'neutral'} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Brand</div>
                        <div className="mt-2 text-sm font-black text-slate-900">{selectedStore.brandName || 'Belum diisi'}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Domain</div>
                        <div className="mt-2 text-sm font-black text-slate-900">{selectedStore.domainList[0] || 'Belum ada domain'}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <SafeButton type="button" variant="white" icon={<PencilLine size={16} />} onClick={() => setShowEditStoreModal(true)}>
                        Edit Store Ini
                      </SafeButton>
                      <Link
                        href={`/toko/${orgSlug}/${selectedStore.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-black text-slate-700"
                      >
                        Buka Storefront
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-sm font-medium leading-6 text-slate-500">
                    Belum ada store yang aktif. Buat store pertama Anda lewat tombol `Buat Store Baru`.
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {selectedStore && (
            <SectionCard>
              <SectionHeader
                title="Domain + Ongkir"
                subtitle="Custom domain dan ongkir flat rate per zona."
                icon={Globe}
              />
              <div className="space-y-8 px-10 py-8">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    const formData = new FormData(event.currentTarget)
                    formData.set('store_id', selectedStore.id)
                    appendStoreContext(formData)
                    void handleAction(saveStoreDomainAction, formData, 'Domain store berhasil disimpan.')
                  }}
                  className="grid gap-3"
                >
                  <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tambah Domain</label>
                  <input name="domain" placeholder="contoh: toko.brandanda.com" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <select name="status" defaultValue="LIVE" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500">
                      <option value="PENDING">Pending</option>
                      <option value="LIVE">Live</option>
                    </select>
                    <select name="is_primary" defaultValue="true" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500">
                      <option value="true">Primary</option>
                      <option value="false">Secondary</option>
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <SafeButton type="submit" isLoading={isPending}>
                      Simpan Domain
                    </SafeButton>
                  </div>
                </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  const formData = new FormData(event.currentTarget)
                  formData.set('store_id', selectedStore.id)
                  appendStoreContext(formData)
                  void handleAction(saveStoreShippingZoneAction, formData, 'Zona ongkir berhasil disimpan.')
                }}
                className="grid gap-3"
              >
                <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tambah Zona</label>
                <div className="grid gap-3 md:grid-cols-2">
                  <input name="name" placeholder="Nama zona" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500" />
                  <input name="code" placeholder="kode-zona" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <textarea name="provinces" rows={3} placeholder="Provinsi, pisahkan dengan enter atau koma" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500" />
                  <textarea name="cities" rows={3} placeholder="Kota / kabupaten, pisahkan dengan enter atau koma" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <textarea name="postal_codes" rows={3} placeholder="Kode pos, misalnya 40123 atau 4012" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500" />
                  <textarea name="countries" rows={3} placeholder="Negara, misalnya ID atau Indonesia" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500" />
                </div>
                <div className="text-xs font-medium text-slate-500">
                  Kosongkan jika zona ini berlaku umum. Isian akan dipakai untuk auto-match ongkir dari alamat checkout.
                </div>
                <div className="flex justify-end">
                  <SafeButton type="submit" isLoading={isPending}>
                    Simpan Zona
                  </SafeButton>
                </div>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  const formData = new FormData(event.currentTarget)
                  formData.set('store_id', selectedStore.id)
                  appendStoreContext(formData)
                  void handleAction(saveStoreShippingRateAction, formData, 'Tarif ongkir berhasil disimpan.')
                }}
                className="grid gap-3"
              >
                <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tambah Tarif</label>
                <select name="zone_id" required className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500">
                  <option value="">Pilih zona</option>
                  {selectedStoreZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                </select>
                <div className="grid gap-3 md:grid-cols-2">
                  <input name="name" placeholder="Nama tarif" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500" />
                  <input name="eta_label" placeholder="Contoh: 1-2 hari" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500" />
                </div>
                <input name="flat_amount" placeholder="Nominal flat" type="number" min="0" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
                <div className="flex justify-end">
                  <SafeButton type="submit" isLoading={isPending}>
                    Simpan Tarif
                  </SafeButton>
                </div>
              </form>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Tarif Aktif</div>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedStoreRates.length === 0 && <div className="font-medium text-slate-500">Belum ada tarif aktif.</div>}
                    {selectedStoreRates.map((rate) => (
                      <div key={rate.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div>
                          <div className="font-black text-slate-900">{rate.zoneName} • {rate.name}</div>
                          <div className="text-xs font-medium text-slate-500">{rate.etaLabel || 'Tanpa ETA'}</div>
                          {selectedStoreZoneById.get(rate.zoneId) && (
                            <div className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">
                              Provinsi: {formatRuleList(selectedStoreZoneById.get(rate.zoneId)?.provinces || [])} • Kota: {formatRuleList(selectedStoreZoneById.get(rate.zoneId)?.cities || [])}
                            </div>
                          )}
                        </div>
                        <div className="font-mono text-sm font-black text-slate-800">{formatRupiah(rate.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {visibleActiveTab === 'katalog' && selectedStore && (
        <SectionCard>
          <SectionHeader
            title="Katalog + Varian"
            subtitle="Pilih produk master lalu override nama publik, harga, gambar, dan varian yang tampil per store."
            icon={Package}
          />
          <div className="grid gap-8 px-10 py-8 xl:grid-cols-2">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData()
                formData.set('store_id', selectedStore.id)
                formData.set('product_id', selectedProductId)
                formData.set('product_name', selectedProduct?.name || '')
                formData.set('org_slug', orgSlug)
                formData.set('store_slug', selectedStore.slug)
                Object.entries(catalogForm).forEach(([key, value]) => {
                  formData.set(key, typeof value === 'boolean' ? String(value) : value)
                })
                void handleAction(saveStoreCatalogProductAction, formData, 'Produk berhasil dipublikasikan ke store.')
              }}
              className="space-y-4"
            >
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Publikasi Produk</div>
              <select
                value={selectedProductId}
                onChange={(event) => applyProductSelection(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500"
              >
                {dashboardData.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} • {product.sku || 'tanpa-sku'}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={catalogForm.publicName} onChange={(event) => setCatalogForm((current) => ({ ...current, publicName: event.target.value }))} placeholder="Nama publik" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500" />
                <input value={catalogForm.publicSlug} onChange={(event) => setCatalogForm((current) => ({ ...current, publicSlug: event.target.value }))} placeholder="Slug publik" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
              </div>
              <textarea value={catalogForm.shortDescription} onChange={(event) => setCatalogForm((current) => ({ ...current, shortDescription: event.target.value }))} rows={2} placeholder="Deskripsi singkat" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500" />
              <textarea value={catalogForm.publicDescription} onChange={(event) => setCatalogForm((current) => ({ ...current, publicDescription: event.target.value }))} rows={4} placeholder="Deskripsi publik" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500" />
              <div className="grid gap-3 md:grid-cols-2">
                <input value={catalogForm.priceOverride} onChange={(event) => setCatalogForm((current) => ({ ...current, priceOverride: event.target.value }))} type="number" min="0" placeholder="Harga override" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
                <input value={catalogForm.comparePrice} onChange={(event) => setCatalogForm((current) => ({ ...current, comparePrice: event.target.value }))} type="number" min="0" placeholder="Harga coret" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <input value={catalogForm.badgeText} onChange={(event) => setCatalogForm((current) => ({ ...current, badgeText: event.target.value }))} placeholder="Badge" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500" />
                <input value={catalogForm.sortOrder} onChange={(event) => setCatalogForm((current) => ({ ...current, sortOrder: event.target.value }))} type="number" placeholder="Urutan" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
                <input value={catalogForm.imageUrl} onChange={(event) => setCatalogForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="URL gambar" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select value={String(catalogForm.isFeatured)} onChange={(event) => setCatalogForm((current) => ({ ...current, isFeatured: event.target.value === 'true' }))} className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500">
                  <option value="false">Biasa</option>
                  <option value="true">Featured</option>
                </select>
                <select value={String(catalogForm.isPublished)} onChange={(event) => setCatalogForm((current) => ({ ...current, isPublished: event.target.value === 'true' }))} className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500">
                  <option value="true">Tayang</option>
                  <option value="false">Sembunyikan</option>
                </select>
              </div>
              <div className="flex justify-end">
                <SafeButton type="submit" isLoading={isPending}>
                  Simpan Produk
                </SafeButton>
              </div>
            </form>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData()
                formData.set('store_id', selectedStore.id)
                formData.set('product_id', selectedVariantProductId)
                formData.set('inventory_product_id', variantForm.inventoryProductId)
                formData.set('variant_name', variantForm.variantName)
                formData.set('sku', variantForm.sku)
                formData.set('public_name', variantForm.publicName)
                formData.set('price_override', variantForm.priceOverride)
                formData.set('compare_price', variantForm.comparePrice)
                formData.set('badge_text', variantForm.badgeText)
                formData.set('image_url', variantForm.imageUrl)
                formData.set('attributes_text', variantForm.attributesText)
                formData.set('is_active', String(variantForm.isActive))
                formData.set('is_default', String(variantForm.isDefault))
                formData.set('is_published', String(variantForm.isPublished))
                formData.set('org_slug', orgSlug)
                formData.set('store_slug', selectedStore.slug)
                void handleAction(saveProductVariantAction, formData, 'Varian berhasil disimpan.')
              }}
              className="space-y-4"
            >
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tambah Varian</div>
              <select value={selectedVariantProductId} onChange={(event) => applyVariantProductSelection(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500">
                {dashboardData.products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
              <select value={variantForm.inventoryProductId} onChange={(event) => setVariantForm((current) => ({ ...current, inventoryProductId: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500">
                {dashboardData.products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name} • produk stok</option>
                ))}
              </select>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={variantForm.variantName} onChange={(event) => setVariantForm((current) => ({ ...current, variantName: event.target.value }))} placeholder="Nama varian" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500" />
                <input value={variantForm.sku} onChange={(event) => setVariantForm((current) => ({ ...current, sku: event.target.value }))} placeholder="SKU varian" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={variantForm.publicName} onChange={(event) => setVariantForm((current) => ({ ...current, publicName: event.target.value }))} placeholder="Nama publik varian" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500" />
                <input value={variantForm.imageUrl} onChange={(event) => setVariantForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="URL gambar varian" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <input value={variantForm.priceOverride} onChange={(event) => setVariantForm((current) => ({ ...current, priceOverride: event.target.value }))} type="number" min="0" placeholder="Harga override" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
                <input value={variantForm.comparePrice} onChange={(event) => setVariantForm((current) => ({ ...current, comparePrice: event.target.value }))} type="number" min="0" placeholder="Harga coret" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
                <input value={variantForm.badgeText} onChange={(event) => setVariantForm((current) => ({ ...current, badgeText: event.target.value }))} placeholder="Badge" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500" />
              </div>
              <textarea value={variantForm.attributesText} onChange={(event) => setVariantForm((current) => ({ ...current, attributesText: event.target.value }))} rows={4} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500" />
              <div className="text-xs font-medium text-slate-500">
                Tulis satu atribut per baris dengan format `Nama Atribut: Nilai`. Tipe blok theme yang diizinkan: {STORE_THEME_BLOCK_TYPES.join(', ')}.
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select value={String(variantForm.isActive)} onChange={(event) => setVariantForm((current) => ({ ...current, isActive: event.target.value === 'true' }))} className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500">
                  <option value="true">Varian aktif</option>
                  <option value="false">Varian nonaktif</option>
                </select>
                <select value={String(variantForm.isDefault)} onChange={(event) => setVariantForm((current) => ({ ...current, isDefault: event.target.value === 'true' }))} className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500">
                  <option value="false">Bukan default</option>
                  <option value="true">Default</option>
                </select>
                <select value={String(variantForm.isPublished)} onChange={(event) => setVariantForm((current) => ({ ...current, isPublished: event.target.value === 'true' }))} className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500">
                  <option value="true">Tayang</option>
                  <option value="false">Sembunyikan</option>
                </select>
              </div>
              <div className="flex justify-end">
                <SafeButton type="submit" isLoading={isPending}>
                  Simpan Varian
                </SafeButton>
              </div>
            </form>
          </div>
        </SectionCard>
      )}
      {visibleActiveTab === 'theme' && selectedStore && (
        <ThemeHomepageEditor
          key={[
            selectedStore.id,
            storeThemeDraft?.id || 'draft',
            storeThemeDraft?.updatedAt || 'draft-updated',
            storeThemePublished?.id || 'published',
            storeThemePublished?.updatedAt || 'published-updated',
          ].join(':')}
          orgSlug={orgSlug}
          selectedStore={selectedStore}
          dashboardData={dashboardData}
          storeThemeDraft={storeThemeDraft}
          storeThemePublished={storeThemePublished}
          isPending={isPending}
          appendStoreContext={appendStoreContext}
          runAction={handleAction}
        />
      )}

      {visibleActiveTab === 'order' && selectedStore && (
      <SectionCard>
        <SectionHeader
          title="Review Order dan Pembayaran"
          subtitle={`Menampilkan antrean order untuk store ${selectedStore?.name || '-'}. Saat disetujui, sistem akan cek stok, reserve stok, lalu membuat sales order ERP berstatus ORDERED.`}
          icon={ShoppingBag}
        />
        <div className="grid gap-4 px-10 pt-8 md:grid-cols-[1fr_220px]">
          <input
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder="Cari nomor order, nama, email, atau nomor pelanggan"
            className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium outline-none focus:border-blue-500"
          />
          <select
            value={orderStatusFilter}
            onChange={(event) => setOrderStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500"
          >
            {orderStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'Semua status' : status}
              </option>
            ))}
          </select>
        </div>
        <div className="px-10 pt-4 text-xs font-bold text-slate-500">
          Menampilkan {filteredOrders.length} dari {selectedStoreOrders.length} order pada store ini.
        </div>
        <div className="overflow-x-auto px-10 py-6">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <th className="pb-4 pr-4">Order</th>
                <th className="pb-4 pr-4">Pelanggan</th>
                <th className="pb-4 pr-4">Nilai</th>
                <th className="pb-4 pr-4">Status</th>
                <th className="pb-4 pr-4">Proof</th>
                <th className="pb-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => (
                <tr key={order.orderId} className="align-top">
                  <td className="py-4 pr-4">
                    <div className="font-black text-slate-900">{order.orderNumber}</div>
                    <div className="text-xs font-medium text-slate-500">{formatDate(order.createdAt)}</div>
                    {order.paymentDueAt && (
                      <div className="text-[11px] font-medium text-slate-400">Jatuh tempo: {formatDate(order.paymentDueAt)}</div>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    <div className="font-bold text-slate-800">{order.customerName}</div>
                    <div className="text-xs font-medium text-slate-500">{order.customerEmail || '-'}</div>
                    <div className="text-xs font-medium text-slate-500">{order.customerPhone || '-'}</div>
                  </td>
                  <td className="py-4 pr-4 font-mono font-black text-slate-900">{formatRupiah(order.grandTotal)}</td>
                  <td className="py-4 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label={order.status} variant={badgeVariantFromStatus(order.status)} />
                      <StatusBadge label={order.paymentStatus} variant={badgeVariantFromStatus(order.paymentStatus)} />
                      <StatusBadge label={order.erpSyncStatus} variant={badgeVariantFromStatus(order.erpSyncStatus)} />
                      {order.reservationStatus !== 'NONE' && (
                        <StatusBadge label={`RESERVASI ${order.reservationStatus}`} variant={badgeVariantFromStatus(order.reservationStatus)} />
                      )}
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    {order.proofUrl ? (
                      <Link href={order.proofUrl} target="_blank" className="text-xs font-black text-blue-600 hover:underline">
                        Lihat bukti
                      </Link>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Belum upload</span>
                    )}
                  </td>
                  <td className="py-4">
                    <div className="space-y-3">
                      {order.erpSyncError && (
                        <div className="w-64 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold leading-relaxed text-rose-700">
                          ERP error: {order.erpSyncError}
                        </div>
                      )}
                      <textarea
                        value={reviewNotes[order.orderId] ?? order.reviewNote}
                        onChange={(event) => setReviewNotes((current) => ({ ...current, [order.orderId]: event.target.value }))}
                        rows={2}
                        placeholder="Catatan review"
                        className="w-64 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium outline-none focus:border-blue-500"
                      />
                      <div className="flex flex-wrap gap-2">
                        {order.paymentStatus === 'UNDER_REVIEW' && !order.erpSaleId && (
                          <SafeButton
                            size="sm"
                            isLoading={isPending}
                            onClick={async () => {
                              const formData = new FormData()
                              formData.set('order_id', order.orderId)
                              formData.set('review_note', reviewNotes[order.orderId] ?? order.reviewNote)
                              appendStoreContext(formData)
                              await handleAction(approveOrderPaymentAction, formData, `Order ${order.orderNumber} berhasil divalidasi.`)
                            }}
                          >
                            Approve
                          </SafeButton>
                        )}
                        {(order.status === 'PAYMENT_EXCEPTION' || order.erpSyncStatus === 'FAILED') && (
                          <SafeButton
                            size="sm"
                            variant="white"
                            isLoading={isPending}
                            icon={<RefreshCw size={14} />}
                            onClick={async () => {
                              const formData = new FormData()
                              formData.set('order_id', order.orderId)
                              formData.set('review_note', reviewNotes[order.orderId] ?? order.reviewNote)
                              appendStoreContext(formData)
                              await handleAction(retryOrderErpSyncAction, formData, `Sinkron ERP order ${order.orderNumber} berhasil dicoba ulang.`)
                            }}
                          >
                            Retry ERP
                          </SafeButton>
                        )}
                        {order.paymentStatus === 'UNDER_REVIEW' && !order.erpSaleId && (
                          <SafeButton
                            size="sm"
                            variant="danger"
                            isLoading={isPending}
                            onClick={async () => {
                              const formData = new FormData()
                              formData.set('order_id', order.orderId)
                              formData.set('review_note', reviewNotes[order.orderId] ?? order.reviewNote)
                              appendStoreContext(formData)
                              await handleAction(rejectOrderPaymentAction, formData, `Pembayaran order ${order.orderNumber} berhasil ditolak.`)
                            }}
                          >
                            Reject
                          </SafeButton>
                        )}
                      </div>
                      {(orderEventsByOrderId.get(order.orderId) || []).length > 0 && (
                        <div className="w-64 rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Riwayat</div>
                          <div className="mt-3 space-y-3">
                            {(orderEventsByOrderId.get(order.orderId) || []).slice(0, 4).map((event) => (
                              <div key={event.id} className="border-l-2 border-slate-200 pl-3">
                                <div className="text-[11px] font-black text-slate-800">{event.eventType}</div>
                                <div className="text-[11px] font-medium text-slate-500">
                                  {event.actorLabel}{event.actorUserId ? ` (${event.actorUserId.slice(0, 8)})` : ''} • {formatDate(event.createdAt)}
                                </div>
                                <div className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{event.message}</div>
                                {event.payloadPreview && (
                                  <div className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                                    {event.payloadPreview}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm font-medium text-slate-500">
                    Belum ada order yang cocok dengan filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
      )}

      <StoreFormModal
        isOpen={showCreateStoreModal}
        onClose={() => setShowCreateStoreModal(false)}
        title="Buat Store Baru"
        subtitle="Isi data minimum dulu. Detail lain bisa dilengkapi setelah store berhasil dibuat."
        maxWidthClass="max-w-7xl"
      >
        <form onSubmit={handleCreateStoreSubmit} className="px-8 py-8">
          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  name="name"
                  required
                  placeholder="Nama store"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-bold outline-none focus:border-blue-500"
                />
                <input
                  name="slug"
                  placeholder="Slug publik (opsional)"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Pilih Template</div>
                <div className="mt-3 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                  {dashboardData.templates.map((template) => {
                    const isActive = template.key === newStoreTemplateKey
                    return (
                      <button
                        key={template.key}
                        type="button"
                        onClick={() => setNewStoreTemplateKey(template.key)}
                        className={`w-full rounded-xl border px-5 py-4 text-left transition ${
                          isActive
                            ? 'border-blue-500 bg-white shadow-lg shadow-blue-100'
                            : 'border-slate-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-black text-slate-900">{template.name}</div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                            isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {template.category}
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-medium leading-6 text-slate-600">
                          {template.description}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Default Otomatis</div>
                {canQuickCreateStore ? (
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div><span className="font-black text-slate-900">Cabang:</span> {quickCreateDefaults.branch?.name}</div>
                    <div><span className="font-black text-slate-900">Gudang:</span> {quickCreateDefaults.warehouse?.name}</div>
                    <div><span className="font-black text-slate-900">Rekening:</span> {quickCreateDefaults.bankAccount?.label}</div>
                    <div className="pt-2 text-xs font-bold text-slate-500">
                      Kontak, instruksi transfer, SEO, dan pengaturan lainnya bisa Anda isi nanti di panel edit store.
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm font-bold text-amber-700">
                    Store belum bisa dibuat cepat karena masih kurang: {quickCreateMissingRequirements.join(', ')}.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <SafeButton type="button" variant="white" onClick={() => setShowCreateStoreModal(false)}>
                  Batal
                </SafeButton>
                <SafeButton type="submit" isLoading={isPending} icon={<Plus size={16} />} disabled={!canQuickCreateStore}>
                  Bikin Store
                </SafeButton>
              </div>
            </div>

            <div>
              {selectedCreateTemplate && (
                <TemplatePreviewPanel template={selectedCreateTemplate} />
              )}
            </div>
          </div>
        </form>
      </StoreFormModal>

      <StoreFormModal
        isOpen={showEditStoreModal && Boolean(selectedStore)}
        onClose={() => setShowEditStoreModal(false)}
        title="Edit Store"
        subtitle="Ubah identitas store, SEO dasar, dan pesan transfer tanpa memenuhi halaman utama."
        maxWidthClass="max-w-6xl"
      >
        {selectedStore && (
          <form onSubmit={handleEditStoreSubmit} className="space-y-6 px-8 py-8">
            <input type="hidden" name="store_id" value={selectedStore.id} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Identitas Store</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input name="name" defaultValue={selectedStore.name} required placeholder="Nama store" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500" />
                <input name="slug" defaultValue={selectedStore.slug} required placeholder="Slug publik" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-mono font-bold outline-none focus:border-blue-500" />
                <input name="brand_name" defaultValue={selectedStore.brandName} placeholder="Brand / grup" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500" />
                <input name="line_name" defaultValue={selectedStore.lineName} placeholder="Lini bisnis" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Operasional</div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <select name="branch_id" defaultValue={selectedStore.branchId} className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500">
                  {dashboardData.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
                <select name="warehouse_id" defaultValue={selectedStore.warehouseId} className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500">
                  {dashboardData.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                </select>
                <select name="bank_account_id" defaultValue={selectedStore.bankAccountId} className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500">
                  {dashboardData.bankAccounts.map((bank) => <option key={bank.id} value={bank.id}>{bank.label}</option>)}
                </select>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <select name="is_active" defaultValue={String(selectedStore.isActive)} className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500">
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
                <select name="is_published" defaultValue={String(selectedStore.isPublished)} className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500">
                  <option value="true">Live</option>
                  <option value="false">Belum live</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Kontak</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input name="support_email" defaultValue={selectedStore.supportEmail} placeholder="Email support" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500" />
                <input name="support_phone" defaultValue={selectedStore.supportPhone} placeholder="Nomor support" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500" />
              </div>
              <input name="whatsapp_phone" defaultValue={selectedStore.whatsappPhone} placeholder="Nomor WhatsApp" className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500" />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tampilan dan SEO</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input name="logo_url" defaultValue={selectedStore.logoUrl} placeholder="URL logo" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-medium outline-none focus:border-blue-500" />
                <input name="headline" defaultValue={selectedStore.headline} placeholder="Headline hero" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500" />
              </div>
              <textarea name="subheadline" defaultValue={selectedStore.subheadline} rows={3} placeholder="Subheadline" className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-5 py-4 font-medium outline-none focus:border-blue-500" />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input name="seo_title" defaultValue={selectedStore.name} placeholder="SEO title" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-medium outline-none focus:border-blue-500" />
                <select name="currency" defaultValue={selectedStore.currency} className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-bold outline-none focus:border-blue-500">
                  <option value="IDR">IDR</option>
                </select>
              </div>
              <textarea name="seo_description" defaultValue={selectedStore.subheadline} rows={2} placeholder="SEO description" className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-5 py-4 font-medium outline-none focus:border-blue-500" />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input name="hero_notice" defaultValue={selectedStore.heroNotice} placeholder="Notice di hero" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-medium outline-none focus:border-blue-500" />
                <input name="checkout_notice" defaultValue={selectedStore.checkoutNotice} placeholder="Notice di checkout" className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-medium outline-none focus:border-blue-500" />
              </div>
              <textarea name="transfer_instructions" defaultValue={selectedStore.transferInstructions} rows={3} placeholder="Instruksi transfer" className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-5 py-4 font-medium outline-none focus:border-blue-500" />
            </div>

            <div className="flex justify-end gap-3">
              <SafeButton type="button" variant="white" onClick={() => setShowEditStoreModal(false)}>
                Batal
              </SafeButton>
              <SafeButton type="submit" isLoading={isPending}>
                Simpan Store
              </SafeButton>
            </div>
          </form>
        )}
      </StoreFormModal>
    </div>
  )
}
