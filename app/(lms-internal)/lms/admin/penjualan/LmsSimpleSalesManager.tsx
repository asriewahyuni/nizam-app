'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Search,
  BookOpen,
  ExternalLink,
  Copy,
  Store,
  Sparkles,
  Tag,
  Calendar,
  Filter,
  CheckCircle2,
  DollarSign,
  Clock,
  Layers,
  Star,
} from 'lucide-react'
import type { EcommerceDashboardData } from '@/modules/ecommerce/lib/ecommerce'
import { SafeButton, SectionCard, StatusBadge } from '@/components/ui/NizamUI'
import { formatRupiah } from '@/lib/utils'
import { saveLmsSimpleProductAction, deleteLmsSimpleProductAction } from '@/modules/edu/actions/lms-sales.actions'

export default function LmsSimpleSalesManager({
  dashboardData,
  orgSlug,
}: {
  dashboardData: EcommerceDashboardData
  orgSlug?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SUBSCRIPTION' | 'ONETIME'>('ALL')

  // Default to the first store, or empty if none.
  const defaultStoreId = dashboardData.stores[0]?.id || ''
  const storeSlug = dashboardData.stores[0]?.slug || ''
  const hasStorefront = Boolean(orgSlug && storeSlug)

  // Form State
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState(0)
  const [formComparePrice, setFormComparePrice] = useState(0)
  const [formBadgeText, setFormBadgeText] = useState('')
  const [formShortDescription, setFormShortDescription] = useState('')
  const [formPublicDescription, setFormPublicDescription] = useState('')
  const [formIsPublished, setFormIsPublished] = useState(true)
  const [formIsFeatured, setFormIsFeatured] = useState(false)
  const [formCourseIds, setFormCourseIds] = useState<string[]>([])
  const [formProductId, setFormProductId] = useState<string | null>(null)
  const [formImageUrl, setFormImageUrl] = useState('')

  // Subscription Form State
  const [formIsSubscription, setFormIsSubscription] = useState(false)
  const [formBillingInterval, setFormBillingInterval] = useState<'YEAR' | 'MONTH' | 'DAY'>('YEAR')
  const [formBillingIntervalCount, setFormBillingIntervalCount] = useState(1)
  const [formTrialDays, setFormTrialDays] = useState(0)
  const [formSignupFee, setFormSignupFee] = useState(0)

  // Flash state
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  function copyToClipboard(relativePath: string, message?: string) {
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${relativePath}` : relativePath
    navigator.clipboard.writeText(fullUrl)
    setCopiedText(relativePath)
    if (message) {
      setFlash({ tone: 'success', text: message })
    }
    setTimeout(() => {
      setCopiedText((prev) => (prev === relativePath ? null : prev))
    }, 2500)
  }

  function openCreateModal() {
    setEditingId(null)
    setFormProductId(null)
    setFormName('')
    setFormPrice(0)
    setFormComparePrice(0)
    setFormBadgeText('')
    setFormShortDescription('')
    setFormPublicDescription('')
    setFormIsPublished(true)
    setFormIsFeatured(false)
    setFormCourseIds([])
    setFormImageUrl('')

    setFormIsSubscription(false)
    setFormBillingInterval('YEAR')
    setFormBillingIntervalCount(1)
    setFormTrialDays(0)
    setFormSignupFee(0)

    setIsModalOpen(true)
    setFlash(null)
  }

  function openEditModal(sp: any) {
    setEditingId(sp.id)
    setFormProductId(sp.productId)
    setFormName(sp.publicName)
    setFormPrice(sp.priceOverride || 0)
    setFormComparePrice(sp.comparePrice || 0)
    setFormBadgeText(sp.badgeText || '')
    setFormShortDescription(sp.shortDescription || '')
    setFormPublicDescription(sp.publicDescription || '')
    setFormIsPublished(sp.isPublished)
    setFormIsFeatured(sp.isFeatured || false)
    setFormImageUrl(sp.imageUrl || '')

    const entitlements = dashboardData.productEntitlements.find((e) => e.storeProductId === sp.id)
    if (entitlements) {
      setFormCourseIds(entitlements.resolvedCourseIds)
    } else {
      setFormCourseIds([])
    }

    if (sp.subscriptionPlan) {
      setFormIsSubscription(true)
      const interval = String(sp.subscriptionPlan.billingInterval || 'YEAR').toUpperCase() as
        | 'YEAR'
        | 'MONTH'
        | 'DAY'
      setFormBillingInterval(interval)
      setFormBillingIntervalCount(Number(sp.subscriptionPlan.billingIntervalCount || 1))
      setFormTrialDays(Number(sp.subscriptionPlan.trialDays || 0))
      setFormSignupFee(Number(sp.subscriptionPlan.signupFee || 0))
    } else {
      setFormIsSubscription(false)
      setFormBillingInterval('YEAR')
      setFormBillingIntervalCount(1)
      setFormTrialDays(0)
      setFormSignupFee(0)
    }

    setIsModalOpen(true)
    setFlash(null)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()

    const fd = new FormData()
    fd.set('store_id', defaultStoreId)
    fd.set('name', formName)
    fd.set('price', formPrice.toString())
    fd.set('compare_price', formComparePrice.toString())
    fd.set('badge_text', formBadgeText)
    fd.set('short_description', formShortDescription)
    fd.set('public_description', formPublicDescription)
    fd.set('is_published', formIsPublished ? 'true' : 'false')
    fd.set('is_featured', formIsFeatured ? 'true' : 'false')
    fd.set('course_ids', JSON.stringify(formCourseIds))
    fd.set('image_url', formImageUrl)

    // Subscription
    fd.set('is_subscription', formIsSubscription ? 'true' : 'false')
    fd.set('billing_interval', formBillingInterval)
    fd.set('billing_interval_count', formBillingIntervalCount.toString())
    fd.set('trial_days', formTrialDays.toString())
    fd.set('signup_fee', formSignupFee.toString())

    if (formProductId) {
      fd.set('product_id', formProductId)
    }

    startTransition(async () => {
      const res = await saveLmsSimpleProductAction(fd)
      if (res?.error) {
        setFlash({ tone: 'error', text: res.error })
      } else {
        setIsModalOpen(false)
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini dari store?')) return
    const fd = new FormData()
    fd.append('store_product_id', id)
    startTransition(async () => {
      const res = await deleteLmsSimpleProductAction(fd)
      if (!res.success) {
        alert(res.error)
      }
    })
  }

  const filteredProducts = useMemo(() => {
    return dashboardData.storeProducts.filter((sp) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = sp.publicName?.toLowerCase().includes(q)
        const matchDesc = sp.shortDescription?.toLowerCase().includes(q)
        if (!matchName && !matchDesc) return false
      }
      if (statusFilter === 'PUBLISHED' && !sp.isPublished) return false
      if (statusFilter === 'DRAFT' && sp.isPublished) return false
      if (typeFilter === 'SUBSCRIPTION' && !sp.subscriptionPlan) return false
      if (typeFilter === 'ONETIME' && sp.subscriptionPlan) return false
      return true
    })
  }, [dashboardData.storeProducts, searchQuery, statusFilter, typeFilter])

  return (
    <SectionCard>
      {hasStorefront && (
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Store size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  Toko Publik Aktif
                </span>
              </div>
              <p className="text-sm font-medium text-slate-700">
                Siswa dapat langsung memilih dan berbelanja kelas tanpa perlu membuka E-Commerce Lengkap.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/toko/${orgSlug}/${storeSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-600 hover:text-white"
            >
              <ExternalLink size={14} />
              Buka Etalase Toko
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(`/toko/${orgSlug}/${storeSlug}`, 'Link etalase toko berhasil disalin!')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              {copiedText === `/toko/${orgSlug}/${storeSlug}` ? (
                <>
                  <Check size={14} />
                  Tersalin!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Salin Link Toko
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Header, Search & Filters */}
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Katalog Penjualan LMS</h2>
            <p className="mt-1 text-sm text-slate-600">Daftar produk kelas yang dijual di Store Anda.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          >
            <Plus size={16} />
            Tambah Produk
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari produk berdasarkan nama atau deskripsi..."
              className="min-h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Status
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PUBLISHED')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === 'PUBLISHED'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tayang ({dashboardData.storeProducts.filter((p) => p.isPublished).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('DRAFT')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === 'DRAFT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Draft
              </button>
            </div>

            {/* Type Filter */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Tipe
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('SUBSCRIPTION')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  typeFilter === 'SUBSCRIPTION'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Langganan
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('ONETIME')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  typeFilter === 'ONETIME' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sekali Bayar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4 font-semibold sm:px-8">Nama Produk & Label</th>
              <th className="px-5 py-4 font-semibold">Harga Jual</th>
              <th className="px-5 py-4 font-semibold">Manfaat Kelas</th>
              <th className="px-5 py-4 font-semibold">Status & Unggulan</th>
              <th className="px-5 py-4 font-semibold">Tautan Publik</th>
              <th className="px-5 py-4 font-semibold text-right sm:px-8">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500 sm:px-8">
                  {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                    ? 'Tidak ada produk yang cocok dengan filter.'
                    : 'Belum ada produk yang dijual. Klik Tambah Produk untuk mulai.'}
                </td>
              </tr>
            ) : (
              filteredProducts.map((sp) => {
                const entitlements = dashboardData.productEntitlements.find((e) => e.storeProductId === sp.id)
                const courseIds = entitlements?.resolvedCourseIds || []
                const courseCount = courseIds.length

                // Find matching course titles
                const courseTitles = courseIds
                  .map((id) => dashboardData.learningCourses.find((c) => c.id === id)?.title)
                  .filter(Boolean)

                return (
                  <tr key={sp.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-4 sm:px-8">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{sp.publicName}</span>
                          {sp.badgeText && (
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                              {sp.badgeText}
                            </span>
                          )}
                        </div>
                        {sp.subscriptionPlan ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                            <Tag size={12} />
                            <span>Paket Langganan • {sp.subscriptionPlan.durationLabel}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                            <span>Akses Instan • Sekali Bayar</span>
                          </div>
                        )}
                        {sp.shortDescription && (
                          <p className="line-clamp-1 max-w-sm text-xs text-slate-500">{sp.shortDescription}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900">
                          {formatRupiah(sp.priceOverride || 0)}
                          {sp.subscriptionPlan && (
                            <span className="text-xs font-semibold text-slate-500">
                              {' '}
                              / {sp.subscriptionPlan.durationLabel}
                            </span>
                          )}
                        </div>
                        {sp.comparePrice && sp.comparePrice > (sp.priceOverride || 0) ? (
                          <div className="text-xs font-semibold text-slate-400 line-through">
                            {formatRupiah(sp.comparePrice)}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                          <BookOpen size={13} />
                          {courseCount} Kelas
                        </span>
                        {courseTitles.length > 0 && (
                          <p className="line-clamp-1 max-w-[200px] text-[11px] text-slate-500" title={courseTitles.join(', ')}>
                            {courseTitles.join(', ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge
                          label={sp.isPublished ? 'Tayang' : 'Draft'}
                          variant={sp.isPublished ? 'success' : 'warning'}
                        />
                        {sp.isFeatured && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-700">
                            <Star size={11} /> Unggulan
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {hasStorefront && sp.isPublished ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`/toko/${orgSlug}/${storeSlug}/produk/${sp.publicSlug}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Buka halaman publik produk ini"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            Buka <ExternalLink size={13} />
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                `/toko/${orgSlug}/${storeSlug}/produk/${sp.publicSlug}`,
                                `Link produk ${sp.publicName} berhasil disalin!`,
                              )
                            }
                            title="Salin link checkout produk"
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-indigo-600 hover:text-white"
                          >
                            {copiedText === `/toko/${orgSlug}/${storeSlug}/produk/${sp.publicSlug}` ? (
                              <>
                                <Check size={13} />
                                Tersalin
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
                                Salin
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {sp.isPublished ? 'Storefront belum aktif' : 'Aktifkan Tayang untuk link'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right sm:px-8">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(sp)}
                          title="Edit produk"
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(sp.id)}
                          title="Hapus produk"
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal CRUD & Pengaturan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Edit Pengaturan Produk' : 'Tambah Produk Baru'}
                </h3>
                <p className="text-xs text-slate-500">
                  Lengkapi info dasar, harga, langganan, dan manfaat akses kelas
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex max-h-[82vh] flex-col">
              <div className="space-y-6 overflow-y-auto px-6 py-6">
                {flash && (
                  <div
                    className={`rounded-xl p-4 text-sm font-semibold ${
                      flash.tone === 'error'
                        ? 'border border-red-200 bg-red-50 text-red-700'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {flash.text}
                  </div>
                )}

                {/* Bagian 1: Informasi Dasar & Badge */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                  <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                    <Tag size={16} className="text-indigo-600" />
                    1. Informasi Dasar Produk
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                      Nama Produk / Kelas <span className="text-red-500">*</span>
                      <input
                        required
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                        placeholder="Contoh: AMS Kelas Syakhshiyah 1500 - Paket 1 Tahun"
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Label Badge Promo (Opsional)
                      <input
                        type="text"
                        value={formBadgeText}
                        onChange={(e) => setFormBadgeText(e.target.value)}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                        placeholder="Contoh: Paket 1 Tahun / Diskon 40%"
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Deskripsi Singkat (Kartu Produk)
                      <input
                        type="text"
                        value={formShortDescription}
                        onChange={(e) => setFormShortDescription(e.target.value)}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                        placeholder="Contoh: Akses penuh 10 kelas selama 1 tahun"
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                      Deskripsi Lengkap (Halaman Detail)
                      <textarea
                        rows={3}
                        value={formPublicDescription}
                        onChange={(e) => setFormPublicDescription(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                        placeholder="Jelaskan manfaat, silabus singkat, atau keuntungan memilih paket ini..."
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                      Gambar Produk (URL)
                      <div className="mt-1.5 flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <input
                            type="url"
                            value={formImageUrl}
                            onChange={(e) => setFormImageUrl(e.target.value)}
                            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                            placeholder="https://example.com/gambar-produk.png"
                          />
                          <p className="mt-1 text-[11px] text-slate-500">Paste URL gambar dari hosting atau CDN Anda. Gambar ini akan tampil di halaman toko publik.</p>
                        </div>
                        {formImageUrl && (
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                            <img
                              src={formImageUrl}
                              alt="Preview"
                              className="h-full w-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>

                {/* Bagian 2: Harga, Promo & Sistem Langganan */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                  <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                    <DollarSign size={16} className="text-emerald-600" />
                    2. Harga & Pengaturan Langganan
                  </h4>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Harga Jual (Rp) <span className="text-red-500">*</span>
                      <input
                        required
                        type="number"
                        min="0"
                        value={formPrice}
                        onChange={(e) => setFormPrice(Number(e.target.value))}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Harga Coret / Normal (Rp)
                      <input
                        type="number"
                        min="0"
                        value={formComparePrice}
                        onChange={(e) => setFormComparePrice(Number(e.target.value))}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                        placeholder="0 jika tidak ada promo"
                      />
                    </label>
                  </div>

                  {/* Toggle Langganan */}
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <label className="flex cursor-pointer items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={formIsSubscription}
                          onChange={(e) => setFormIsSubscription(e.target.checked)}
                          className="size-5 accent-amber-600"
                        />
                        <div>
                          <span className="font-bold text-slate-900">Aktifkan Paket Langganan (Subscription)</span>
                          <p className="text-xs text-slate-600">
                            Cocok untuk paket akses per tahun/bulan seperti referensi AMS Kelas Syakhshiyah 1500.
                          </p>
                        </div>
                      </div>
                    </label>

                    {formIsSubscription && (
                      <div className="mt-4 grid gap-4 border-t border-amber-200/80 pt-4 sm:grid-cols-3">
                        <label className="block text-xs font-bold text-slate-700">
                          Satuan Durasi
                          <select
                            value={formBillingInterval}
                            onChange={(e) =>
                              setFormBillingInterval(e.target.value as 'YEAR' | 'MONTH' | 'DAY')
                            }
                            className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-600"
                          >
                            <option value="YEAR">Tahun (Yearly)</option>
                            <option value="MONTH">Bulan (Monthly)</option>
                            <option value="DAY">Hari (Daily)</option>
                          </select>
                        </label>

                        <label className="block text-xs font-bold text-slate-700">
                          Jumlah Interval
                          <input
                            type="number"
                            min="1"
                            value={formBillingIntervalCount}
                            onChange={(e) => setFormBillingIntervalCount(Math.max(1, Number(e.target.value)))}
                            className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-600"
                          />
                          <span className="mt-0.5 block text-[10px] text-slate-500">
                            Misal: 1 = {formBillingInterval === 'YEAR' ? '1 Tahun' : formBillingInterval === 'MONTH' ? '1 Bulan' : '1 Hari'}
                          </span>
                        </label>

                        <label className="block text-xs font-bold text-slate-700">
                          Masa Percobaan Gratis (Hari)
                          <input
                            type="number"
                            min="0"
                            value={formTrialDays}
                            onChange={(e) => setFormTrialDays(Math.max(0, Number(e.target.value)))}
                            className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-amber-600"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bagian 3: Pengaturan Tayang & Featured */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                  <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                    <Sparkles size={16} className="text-blue-600" />
                    3. Pengaturan Tampilan & Unggulan
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Status Tayang
                      <select
                        value={formIsPublished ? 'true' : 'false'}
                        onChange={(e) => setFormIsPublished(e.target.value === 'true')}
                        className="mt-1.5 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                      >
                        <option value="true">Tayang di Store (Aktif)</option>
                        <option value="false">Sembunyikan (Draft)</option>
                      </select>
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Produk Unggulan Toko (Featured)
                      <select
                        value={formIsFeatured ? 'true' : 'false'}
                        onChange={(e) => setFormIsFeatured(e.target.value === 'true')}
                        className="mt-1.5 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                      >
                        <option value="false">Normal</option>
                        <option value="true">⭐ Jadikan Produk Unggulan</option>
                      </select>
                    </label>
                  </div>
                </div>

                {/* Bagian 4: Manfaat Akses Kelas */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                  <div className="mb-4">
                    <h4 className="flex items-center gap-2 font-bold text-slate-900">
                      <BookOpen size={16} className="text-indigo-600" />
                      4. Manfaat Akses Kelas ({formCourseIds.length} dipilih)
                    </h4>
                    <p className="mt-1 text-xs text-slate-600">
                      Pilih kelas/materi mana saja di LMS yang langsung diaktifkan otomatis bagi siswa setelah checkout.
                    </p>
                  </div>

                  <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                    {dashboardData.learningCourses.length === 0 && (
                      <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                        Belum ada course/kelas yang tersedia di LMS ini.
                      </p>
                    )}
                    {dashboardData.learningCourses.map((course) => {
                      const checked = formCourseIds.includes(course.id)
                      return (
                        <label
                          key={course.id}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                            checked
                              ? 'border-indigo-600 bg-indigo-50/70'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormCourseIds([...formCourseIds, course.id])
                              } else {
                                setFormCourseIds(formCourseIds.filter((id) => id !== course.id))
                              }
                            }}
                            className="size-4 accent-indigo-700"
                          />
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                            <BookOpen size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-900">{course.title}</p>
                            <p className="text-[11px] text-slate-500">Slug: /learning/{course.slug}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Batal
                </button>
                <SafeButton type="submit" isLoading={isPending} className="min-h-11 px-6">
                  {editingId ? 'Simpan Perubahan' : 'Buat Produk Sekarang'}
                </SafeButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
