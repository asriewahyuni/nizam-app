'use client'

/**
 * Editor khusus produk LMS dengan course langsung dan beberapa Paket Akses.
 */
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeDollarSign,
  BookOpen,
  Check,
  CircleAlert,
  Eye,
  ImageIcon,
  Layers3,
  LoaderCircle,
  MessageCircle,
  Save,
  ShoppingBag,
} from 'lucide-react'
import { cn, formatRupiah, generateSlug } from '@/lib/utils'
import {
  DEFAULT_PRODUCT_NOTIFICATION_OVERRIDES,
  type AdminAccessPackageView,
  type AdminLearningCourseView,
  type AdminProductEntitlementView,
  type AdminStoreProductView,
  type ProductNotificationOverrides,
  type StoreAdminSummary,
} from '@/modules/ecommerce/lib/ecommerce'
import { saveLmsSimpleProductAction } from '@/modules/edu/actions/lms-sales.actions'

type ProductEditorProps = {
  orgSlug: string
  primaryLmsHostname: string | null
  stores: StoreAdminSummary[]
  courses: AdminLearningCourseView[]
  packages: AdminAccessPackageView[]
  initialProduct: AdminStoreProductView | null
  initialEntitlement: AdminProductEntitlementView | null
  returnTo: string
}

type Draft = {
  storeId: string
  productId: string
  name: string
  publicSlug: string
  seoTitle: string
  seoDescription: string
  shortDescription: string
  publicDescription: string
  badgeText: string
  imageUrl: string
  price: string
  comparePrice: string
  isSubscription: boolean
  billingInterval: 'YEAR' | 'MONTH' | 'DAY'
  billingIntervalCount: string
  trialDays: string
  signupFee: string
  directCourseIds: string[]
  packageIds: string[]
  isPublished: boolean
  isFeatured: boolean
  pageLayout: 'SINGLE_COLUMN' | 'TWO_COLUMNS'
  checkoutButtonLabel: string
  benefitTitle: string
  customerSectionTitle: string
  paymentSectionTitle: string
  paymentMethodLabel: string
  showDescription: boolean
  showBuyerNote: boolean
  showTrustSignals: boolean
  notificationOverrides: ProductNotificationOverrides
}

const STEPS = [
  { href: '#informasi', label: 'Informasi', icon: ShoppingBag },
  { href: '#harga', label: 'Harga / Langganan', icon: BadgeDollarSign },
  { href: '#manfaat', label: 'Manfaat LMS', icon: BookOpen },
  { href: '#publikasi', label: 'Publikasi', icon: Eye },
  { href: '#notifikasi', label: 'Notifikasi', icon: MessageCircle },
]

const NOTIFICATION_OVERRIDE_FIELDS: Array<{
  key: keyof Omit<ProductNotificationOverrides, 'enabled'>
  label: string
  placeholder: string
}> = [
  { key: 'onHold', label: 'Menunggu Pembayaran', placeholder: 'Assalamu\'alaikum kak {{name}}, selesaikan pembayaran order {{order_number}}...' },
  { key: 'paymentConfirm', label: 'Pembayaran Dikonfirmasi', placeholder: 'Alhamdulillah kak {{name}}, pembayaran order {{order_number}} sudah kami terima...' },
  { key: 'inProgress', label: 'Pesanan Diproses', placeholder: 'Pesanan {{order_number}} kak {{name}} sedang kami siapkan...' },
  { key: 'shipping', label: 'Proses Pengiriman', placeholder: 'Pesanan {{order_number}} kak {{name}} sudah dikirim...' },
  { key: 'completed', label: 'Order Selesai', placeholder: 'Alhamdulillah, order {{order_number}} kak {{name}} sudah selesai...' },
  { key: 'cancelled', label: 'Pembatalan Invoice', placeholder: 'Mohon maaf kak {{name}}, order {{order_number}} kami batalkan...' },
  { key: 'refunded', label: 'Refund', placeholder: 'Order {{order_number}} kak {{name}} sudah kami refund...' },
]

function initialDraft(
  stores: StoreAdminSummary[],
  product: AdminStoreProductView | null,
  entitlement: AdminProductEntitlementView | null,
): Draft {
  return {
    storeId: product?.storeId || stores[0]?.id || '',
    productId: product?.productId || '',
    name: product?.publicName || '',
    publicSlug: product?.publicSlug || '',
    seoTitle: product?.seoTitle || '',
    seoDescription: product?.seoDescription || '',
    shortDescription: product?.shortDescription || '',
    publicDescription: product?.publicDescription || '',
    badgeText: product?.badgeText || '',
    imageUrl: product?.imageUrl || '',
    price: String(product?.priceOverride || 0),
    comparePrice: String(product?.comparePrice || 0),
    isSubscription: Boolean(product?.subscriptionPlan),
    billingInterval: (
      ['YEAR', 'MONTH', 'DAY'].includes(product?.subscriptionPlan?.billingInterval || '')
        ? product?.subscriptionPlan?.billingInterval
        : 'YEAR'
    ) as Draft['billingInterval'],
    billingIntervalCount: String(product?.subscriptionPlan?.billingIntervalCount || 1),
    trialDays: String(product?.subscriptionPlan?.trialDays || 0),
    signupFee: String(product?.subscriptionPlan?.signupFee || 0),
    directCourseIds: entitlement?.directCourses.map((course) => course.courseId) || [],
    packageIds: entitlement?.packageIds || [],
    isPublished: product?.isPublished ?? false,
    isFeatured: product?.isFeatured ?? false,
    pageLayout: product?.pageConfig.layout || 'SINGLE_COLUMN',
    checkoutButtonLabel: product?.pageConfig.checkoutButtonLabel || 'Beli Sekarang',
    benefitTitle: product?.pageConfig.benefitTitle || 'Anda mendapatkan',
    customerSectionTitle: product?.pageConfig.customerSectionTitle || 'Informasi Pribadi',
    paymentSectionTitle: product?.pageConfig.paymentSectionTitle || 'Metode Pembayaran & Konfirmasi',
    paymentMethodLabel: product?.pageConfig.paymentMethodLabel || 'Transfer Bank / Virtual Account / E-Wallet',
    showDescription: product?.pageConfig.showDescription ?? true,
    showBuyerNote: product?.pageConfig.showBuyerNote ?? true,
    showTrustSignals: product?.pageConfig.showTrustSignals ?? true,
    notificationOverrides: product?.notificationOverrides || { ...DEFAULT_PRODUCT_NOTIFICATION_OVERRIDES },
  }
}

function toggle(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

export default function ProductEditor({
  orgSlug,
  primaryLmsHostname,
  stores,
  courses,
  packages,
  initialProduct,
  initialEntitlement,
  returnTo,
}: ProductEditorProps) {
  const router = useRouter()
  const [draft, setDraft] = useState(() => initialDraft(stores, initialProduct, initialEntitlement))
  const [dirty, setDirty] = useState(false)
  const [slugEdited, setSlugEdited] = useState(Boolean(initialProduct?.publicSlug))
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])
  const packageById = useMemo(() => new Map(packages.map((item) => [item.id, item])), [packages])

  const resolvedBenefits = useMemo(() => {
    const rawIds = [
      ...draft.directCourseIds,
      ...draft.packageIds.flatMap((id) => packageById.get(id)?.courses.map((course) => course.courseId) || []),
    ]
    return {
      courses: [...new Set(rawIds)].map((id) => courseById.get(id)).filter(Boolean),
      duplicateCount: rawIds.length - new Set(rawIds).size,
    }
  }, [courseById, draft.directCourseIds, draft.packageIds, packageById])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  function updateNotificationOverride<K extends keyof ProductNotificationOverrides>(
    key: K,
    value: ProductNotificationOverrides[K],
  ) {
    update('notificationOverrides', { ...draft.notificationOverrides, [key]: value })
  }

  function validateField(name: 'name' | 'price' | 'publicSlug') {
    const next = { ...fieldErrors }
    if (name === 'name') {
      if (draft.name.trim().length < 3) next.name = 'Nama produk minimal 3 karakter.'
      else delete next.name
    }
    if (name === 'price') {
      if (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) {
        next.price = 'Harga harus berupa angka nol atau lebih.'
      } else delete next.price
    }
    if (name === 'publicSlug') {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.publicSlug)) {
        next.publicSlug = 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.'
      } else {
        delete next.publicSlug
      }
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  function leaveEditor() {
    if (dirty && !window.confirm('Perubahan belum disimpan. Tetap kembali ke daftar?')) return
    router.push(returnTo)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nameValid = validateField('name')
    const priceValid = validateField('price')
    const slugValid = validateField('publicSlug')
    if (!nameValid || !priceValid || !slugValid || !draft.storeId) {
      setMessage({ tone: 'error', text: 'Periksa kembali bagian yang ditandai.' })
      return
    }

    const formData = new FormData()
    if (draft.productId) formData.set('product_id', draft.productId)
    formData.set('store_id', draft.storeId)
    formData.set('name', draft.name)
    formData.set('public_slug', draft.publicSlug)
    formData.set('seo_title', draft.seoTitle)
    formData.set('seo_description', draft.seoDescription)
    formData.set('short_description', draft.shortDescription)
    formData.set('public_description', draft.publicDescription)
    formData.set('badge_text', draft.badgeText)
    formData.set('image_url', draft.imageUrl)
    formData.set('price', draft.price)
    formData.set('compare_price', draft.comparePrice)
    formData.set('is_subscription', String(draft.isSubscription))
    formData.set('billing_interval', draft.billingInterval)
    formData.set('billing_interval_count', draft.billingIntervalCount)
    formData.set('trial_days', draft.trialDays)
    formData.set('signup_fee', draft.signupFee)
    formData.set('course_ids', JSON.stringify(draft.directCourseIds))
    formData.set('package_ids', JSON.stringify(draft.packageIds))
    formData.set('is_published', String(draft.isPublished))
    formData.set('is_featured', String(draft.isFeatured))
    formData.set('page_layout', draft.pageLayout)
    formData.set('checkout_button_label', draft.checkoutButtonLabel)
    formData.set('benefit_title', draft.benefitTitle)
    formData.set('customer_section_title', draft.customerSectionTitle)
    formData.set('payment_section_title', draft.paymentSectionTitle)
    formData.set('payment_method_label', draft.paymentMethodLabel)
    formData.set('show_description', String(draft.showDescription))
    formData.set('show_buyer_note', String(draft.showBuyerNote))
    formData.set('show_trust_signals', String(draft.showTrustSignals))
    formData.set('notification_overrides', JSON.stringify(draft.notificationOverrides))

    setMessage(null)
    startTransition(async () => {
      const result = await saveLmsSimpleProductAction(formData)
      if (!result.success) {
        setMessage({ tone: 'error', text: result.error || 'Produk gagal disimpan.' })
        return
      }
      setDirty(false)
      setMessage({ tone: 'success', text: 'Produk tersimpan. Data yang sama langsung tersedia di E-Commerce.' })
      router.push(returnTo)
      router.refresh()
    })
  }

  const fieldClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
  const selectedStore = stores.find((store) => store.id === draft.storeId) || stores[0]
  const productUrl = primaryLmsHostname
    ? `https://${primaryLmsHostname}/product/${draft.publicSlug || 'slug-produk'}`
    : `/store/${orgSlug}/${selectedStore?.slug || 'store'}/product/${draft.publicSlug || 'product-slug'}`

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">
          {initialProduct ? 'Ubah produk' : 'Produk baru'}
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              {initialProduct?.publicName || 'Buat Produk LMS'}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Lengkapi empat bagian berikut. Semua manfaat course dihitung tanpa duplikasi.
            </p>
          </div>
          <button
            type="button"
            onClick={leaveEditor}
            className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
          >
            Kembali ke daftar
          </button>
        </div>
        <nav aria-label="Bagian editor produk" className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            return (
              <a
                key={step.href}
                href={step.href}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-white text-indigo-700">
                  <Icon aria-hidden="true" size={15} />
                </span>
                {index + 1}. {step.label}
              </a>
            )
          })}
        </nav>
      </div>

      <div aria-live="polite">
        {message && (
          <div className={cn(
            'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold',
            message.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800',
          )}>
            {message.tone === 'error'
              ? <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={17} />
              : <Check aria-hidden="true" className="mt-0.5 shrink-0" size={17} />}
            {message.text}
          </div>
        )}
      </div>

      <section id="informasi" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950">
          <ShoppingBag aria-hidden="true" size={19} className="text-indigo-700" />
          1. Informasi
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Nama produk <span className="text-rose-600">*</span>
            <input
              required
              value={draft.name}
              onChange={(event) => {
                const nextName = event.target.value
                setDraft((current) => ({
                  ...current,
                  name: nextName,
                  publicSlug: slugEdited
                    ? current.publicSlug
                    : generateSlug(nextName).slice(0, 120),
                }))
                setDirty(true)
              }}
              onBlur={() => validateField('name')}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'product-name-error' : undefined}
              className={fieldClass}
            />
            {fieldErrors.name && <span id="product-name-error" className="mt-1 block text-xs text-rose-700">{fieldErrors.name}</span>}
          </label>
          <label className="text-sm font-bold text-slate-700">
            Slug produk <span className="text-rose-600">*</span>
            <input
              required
              value={draft.publicSlug}
              onChange={(event) => {
                setSlugEdited(true)
                update('publicSlug', generateSlug(event.target.value).slice(0, 120))
              }}
              onBlur={() => validateField('publicSlug')}
              aria-invalid={Boolean(fieldErrors.publicSlug)}
              aria-describedby={fieldErrors.publicSlug ? 'product-slug-error' : undefined}
              className={`${fieldClass} font-mono`}
            />
            {fieldErrors.publicSlug && (
              <span id="product-slug-error" className="mt-1 block text-xs text-rose-700">
                {fieldErrors.publicSlug}
              </span>
            )}
          </label>
          <label className="text-sm font-bold text-slate-700">
            SEO title
            <input
              value={draft.seoTitle}
              onChange={(event) => update('seoTitle', event.target.value)}
              className={fieldClass}
              maxLength={200}
            />
          </label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            SEO description
            <textarea
              rows={3}
              value={draft.seoDescription}
              onChange={(event) => update('seoDescription', event.target.value)}
              className={`${fieldClass} py-3`}
              maxLength={260}
            />
          </label>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Pratinjau URL</p>
            <p className="mt-1 break-all font-mono text-sm text-indigo-950">{productUrl}</p>
          </div>
          <label className="text-sm font-bold text-slate-700">
            Deskripsi singkat
            <input
              value={draft.shortDescription}
              onChange={(event) => update('shortDescription', event.target.value)}
              className={fieldClass}
              placeholder="Ringkasan pada kartu produk"
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Label promo
            <input
              value={draft.badgeText}
              onChange={(event) => update('badgeText', event.target.value)}
              className={fieldClass}
              placeholder="Contoh: Hemat 20%"
            />
          </label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Deskripsi lengkap
            <textarea
              rows={5}
              value={draft.publicDescription}
              onChange={(event) => update('publicDescription', event.target.value)}
              className={`${fieldClass} py-3`}
            />
          </label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            URL gambar produk
            <div className="mt-1.5 flex gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <ImageIcon aria-hidden="true" size={18} />
              </span>
              <input
                type="url"
                value={draft.imageUrl}
                onChange={(event) => update('imageUrl', event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                placeholder="https://…"
              />
            </div>
          </label>
        </div>
      </section>

      <section id="harga" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950">
          <BadgeDollarSign aria-hidden="true" size={19} className="text-emerald-700" />
          2. Harga / Langganan
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
            Harga jual <span className="text-rose-600">*</span>
            <input
              required
              type="number"
              min="0"
              value={draft.price}
              onChange={(event) => update('price', event.target.value)}
              onBlur={() => validateField('price')}
              aria-invalid={Boolean(fieldErrors.price)}
              className={fieldClass}
            />
            {fieldErrors.price && <span className="mt-1 block text-xs text-rose-700">{fieldErrors.price}</span>}
          </label>
          <label className="text-sm font-bold text-slate-700">
            Harga normal/coret
            <input
              type="number"
              min="0"
              value={draft.comparePrice}
              onChange={(event) => update('comparePrice', event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <label className="mt-5 flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <input
            type="checkbox"
            checked={draft.isSubscription}
            onChange={(event) => update('isSubscription', event.target.checked)}
            className="mt-0.5 size-5 accent-amber-700"
          />
          <span>
            <span className="block text-sm font-bold text-slate-950">Produk langganan</span>
            <span className="mt-0.5 block text-xs font-medium text-slate-600">Akses diperpanjang mengikuti pembayaran berkala.</span>
          </span>
        </label>
        {draft.isSubscription && (
          <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-bold text-slate-700">
              Satuan
              <select
                value={draft.billingInterval}
                onChange={(event) => update('billingInterval', event.target.value as Draft['billingInterval'])}
                className={fieldClass}
              >
                <option value="YEAR">Tahun</option>
                <option value="MONTH">Bulan</option>
                <option value="DAY">Hari</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">
              Jumlah interval
              <input type="number" min="1" value={draft.billingIntervalCount} onChange={(event) => update('billingIntervalCount', event.target.value)} className={fieldClass} />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Trial (hari)
              <input type="number" min="0" value={draft.trialDays} onChange={(event) => update('trialDays', event.target.value)} className={fieldClass} />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Biaya pendaftaran
              <input type="number" min="0" value={draft.signupFee} onChange={(event) => update('signupFee', event.target.value)} className={fieldClass} />
            </label>
          </div>
        )}
      </section>

      <section id="manfaat" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950">
          <Layers3 aria-hidden="true" size={19} className="text-indigo-700" />
          3. Manfaat LMS
        </h3>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-slate-900">Course langsung</legend>
            <p className="mb-3 text-xs font-medium text-slate-500">Dipakai khusus oleh produk ini.</p>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {courses.map((course) => (
                <label key={course.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50">
                  <input
                    type="checkbox"
                    checked={draft.directCourseIds.includes(course.id)}
                    onChange={() => update('directCourseIds', toggle(draft.directCourseIds, course.id))}
                    className="size-4 accent-indigo-700"
                  />
                  <span className="text-sm font-semibold text-slate-800">{course.title}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-slate-900">Paket Akses</legend>
            <p className="mb-3 text-xs font-medium text-slate-500">Pilih beberapa paket yang dapat dipakai ulang.</p>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {packages.map((item) => (
                <label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50">
                  <input
                    type="checkbox"
                    checked={draft.packageIds.includes(item.id)}
                    onChange={() => update('packageIds', toggle(draft.packageIds, item.id))}
                    className="size-4 accent-indigo-700"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">{item.name}</span>
                    <span className="block text-xs font-medium text-slate-500">{item.courses.length} course · v{item.version}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-bold text-teal-900">
            Hasil akhir: {resolvedBenefits.courses.length} course
          </p>
          <p className="mt-1 text-xs font-medium text-teal-800">
            {resolvedBenefits.duplicateCount > 0
              ? `${resolvedBenefits.duplicateCount} course tumpang tindih otomatis dihapus.`
              : 'Tidak ada course yang tumpang tindih.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resolvedBenefits.courses.map((course) => (
              <span key={course?.id} className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-teal-900 shadow-sm">
                {course?.title}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="publikasi" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950">
          <Eye aria-hidden="true" size={19} className="text-indigo-700" />
          4. Publikasi
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-indigo-200">
            <input type="checkbox" checked={draft.isPublished} onChange={(event) => update('isPublished', event.target.checked)} className="size-5 accent-indigo-700" />
            <span>
              <span className="block text-sm font-bold text-slate-950">Tayang di toko</span>
              <span className="block text-xs font-medium text-slate-500">Pembeli dapat membuka dan checkout produk.</span>
            </span>
          </label>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-indigo-200">
            <input type="checkbox" checked={draft.isFeatured} onChange={(event) => update('isFeatured', event.target.checked)} className="size-5 accent-indigo-700" />
            <span>
              <span className="block text-sm font-bold text-slate-950">Produk unggulan</span>
              <span className="block text-xs font-medium text-slate-500">Ditonjolkan pada etalase toko.</span>
            </span>
          </label>
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-bold text-slate-950">Override halaman produk</h4>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Warna dan blok mengikuti tema toko. Pengaturan ini hanya berlaku untuk produk ini.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">
              Susunan halaman
              <select
                value={draft.pageLayout}
                onChange={(event) => update('pageLayout', event.target.value as Draft['pageLayout'])}
                className={fieldClass}
              >
                <option value="SINGLE_COLUMN">Satu kolom</option>
                <option value="TWO_COLUMNS">Dua kolom pada desktop</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">
              Teks tombol beli
              <input
                value={draft.checkoutButtonLabel}
                onChange={(event) => update('checkoutButtonLabel', event.target.value)}
                className={fieldClass}
                maxLength={80}
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Judul manfaat
              <input
                value={draft.benefitTitle}
                onChange={(event) => update('benefitTitle', event.target.value)}
                className={fieldClass}
                maxLength={100}
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Judul data pembeli
              <input
                value={draft.customerSectionTitle}
                onChange={(event) => update('customerSectionTitle', event.target.value)}
                className={fieldClass}
                maxLength={100}
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Judul pembayaran
              <input
                value={draft.paymentSectionTitle}
                onChange={(event) => update('paymentSectionTitle', event.target.value)}
                className={fieldClass}
                maxLength={100}
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Label metode pembayaran
              <input
                value={draft.paymentMethodLabel}
                onChange={(event) => update('paymentMethodLabel', event.target.value)}
                className={fieldClass}
                maxLength={120}
              />
            </label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-200">
              <input type="checkbox" checked={draft.showDescription} onChange={(event) => update('showDescription', event.target.checked)} className="size-4 accent-indigo-700" />
              Tampilkan deskripsi
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-200">
              <input type="checkbox" checked={draft.showBuyerNote} onChange={(event) => update('showBuyerNote', event.target.checked)} className="size-4 accent-indigo-700" />
              Catatan pembeli
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-200">
              <input type="checkbox" checked={draft.showTrustSignals} onChange={(event) => update('showTrustSignals', event.target.checked)} className="size-4 accent-indigo-700" />
              Trust signal
            </label>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ringkasan</p>
          <p className="mt-2 text-lg font-bold">{draft.name || 'Produk tanpa nama'}</p>
          <p className="mt-1 text-sm text-slate-300">
            {formatRupiah(Number(draft.price) || 0)} · {resolvedBenefits.courses.length} course · {draft.isSubscription ? 'Langganan' : 'Sekali bayar'}
          </p>
        </div>
      </section>

      <section id="notifikasi" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950">
          <MessageCircle aria-hidden="true" size={19} className="text-indigo-700" />
          5. Notifikasi Khusus Produk Ini
        </h3>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Override pesan WhatsApp per status order khusus untuk produk ini. Kosongkan kalau ingin memakai pesan default organisasi.
          Gunakan variabel <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{'{{name}}'}</code>, <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{'{{order_number}}'}</code>, <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{'{{amount}}'}</code>.
        </p>

        <label className="mt-5 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-indigo-200">
          <input
            type="checkbox"
            checked={draft.notificationOverrides.enabled}
            onChange={(event) => updateNotificationOverride('enabled', event.target.checked)}
            className="size-5 accent-indigo-700"
          />
          <span>
            <span className="block text-sm font-bold text-slate-950">Aktifkan notifikasi khusus produk ini</span>
            <span className="block text-xs font-medium text-slate-500">Kalau tidak diaktifkan, semua isian di bawah diabaikan dan pesan default organisasi yang dipakai.</span>
          </span>
        </label>

        <div className={cn('mt-5 grid gap-4 sm:grid-cols-2', !draft.notificationOverrides.enabled && 'pointer-events-none opacity-50')}>
          {NOTIFICATION_OVERRIDE_FIELDS.map((field) => (
            <label key={field.key} className="text-sm font-bold text-slate-700">
              {field.label}
              <textarea
                value={draft.notificationOverrides[field.key]}
                onChange={(event) => updateNotificationOverride(field.key, event.target.value)}
                placeholder={field.placeholder}
                rows={4}
                maxLength={2000}
                className={cn(fieldClass, 'resize-y font-normal leading-relaxed')}
              />
            </label>
          ))}
        </div>
      </section>

      <footer className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="px-2 text-xs font-semibold text-slate-500">
          {dirty ? 'Ada perubahan yang belum disimpan.' : 'Semua perubahan sudah tersimpan.'}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={leaveEditor} className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
            Batal
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" size={17} />}
            Simpan Produk
          </button>
        </div>
      </footer>
    </form>
  )
}
