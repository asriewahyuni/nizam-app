'use client'

/**
 * Pengelola penjualan course bersama untuk halaman E-Commerce dan LMS.
 * Semua perubahan tetap memakai action dan tabel commerce yang sama.
 */
import Link from 'next/link'
import { useMemo, useState, useTransition, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  ExternalLink,
  Layers3,
  ShoppingCart,
  Store,
} from 'lucide-react'
import {
  saveAccessPackageAction,
  saveProductEntitlementsAction,
} from '@/modules/ecommerce/actions/ecommerce.actions'
import type { EcommerceDashboardData } from '@/modules/ecommerce/lib/ecommerce'
import { SafeButton, SectionCard, SectionHeader, StatusBadge } from '@/components/ui/NizamUI'
import { cn, formatRupiah } from '@/lib/utils'

type CourseSelectionState = Record<string, {
  selected: boolean
  durationValue: string
  durationUnit: string
}>

type FlashState = {
  tone: 'success' | 'error' | 'info'
  text: string
} | null

type ActionResult = {
  success: boolean
  error?: string | null
  data?: unknown
}

type CourseCommerceManagerProps = {
  orgSlug: string
  dashboardData: EcommerceDashboardData
  initialStoreId?: string
  initialProductId?: string
  showContextSelector?: boolean
}

function buildCourseSelectionState(
  courses: Array<{
    courseId: string
    accessDurationValue: number | null
    accessDurationUnit: string | null
  }> = [],
): CourseSelectionState {
  return Object.fromEntries(courses.map((course) => [
    course.courseId,
    {
      selected: true,
      durationValue: course.accessDurationValue == null
        ? ''
        : String(course.accessDurationValue),
      durationUnit: course.accessDurationUnit || 'DAY',
    },
  ]))
}

function serializeCourseSelections(state: CourseSelectionState) {
  return Object.entries(state)
    .filter(([, selection]) => selection.selected)
    .map(([courseId, selection]) => ({
      courseId,
      accessDurationValue: selection.durationValue
        ? Number(selection.durationValue)
        : null,
      accessDurationUnit: selection.durationValue
        ? selection.durationUnit
        : null,
    }))
}

function buildAccessPackagePreset(
  accessPackage?: EcommerceDashboardData['accessPackages'][number] | null,
) {
  return {
    name: accessPackage?.name || '',
    slug: accessPackage?.slug || '',
    description: accessPackage?.description || '',
    isActive: accessPackage?.isActive ?? true,
    defaultDurationValue: accessPackage?.defaultAccessDurationValue == null
      ? ''
      : String(accessPackage.defaultAccessDurationValue),
    defaultDurationUnit: accessPackage?.defaultAccessDurationUnit || 'MONTH',
    courses: buildCourseSelectionState(accessPackage?.courses || []),
  }
}

function findEntitlement(
  dashboardData: EcommerceDashboardData,
  storeId: string,
  productId: string,
) {
  const storeProduct = dashboardData.storeProducts.find((item) => (
    item.storeId === storeId && item.productId === productId
  ))

  return dashboardData.productEntitlements.find((item) => (
    item.storeProductId === storeProduct?.id
  )) || null
}

function toggleCourseSelection(
  setter: Dispatch<SetStateAction<CourseSelectionState>>,
  courseId: string,
  checked: boolean,
) {
  setter((current) => ({
    ...current,
    [courseId]: {
      selected: checked,
      durationValue: current[courseId]?.durationValue || '',
      durationUnit: current[courseId]?.durationUnit || 'DAY',
    },
  }))
}

export default function CourseCommerceManager({
  orgSlug,
  dashboardData,
  initialStoreId,
  initialProductId,
  showContextSelector = false,
}: CourseCommerceManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const defaultStoreId = initialStoreId || dashboardData.stores[0]?.id || ''
  const defaultProductId = initialProductId || dashboardData.products[0]?.id || ''
  const initialEntitlement = findEntitlement(dashboardData, defaultStoreId, defaultProductId)
  const firstAccessPackage = dashboardData.accessPackages[0] || null

  const [selectedStoreId, setSelectedStoreId] = useState(defaultStoreId)
  const [selectedProductId, setSelectedProductId] = useState(defaultProductId)
  const [directCourseSelections, setDirectCourseSelections] = useState<CourseSelectionState>(
    () => buildCourseSelectionState(initialEntitlement?.directCourses || []),
  )
  const [selectedAccessPackageIds, setSelectedAccessPackageIds] = useState<string[]>(
    initialEntitlement?.packageIds || [],
  )
  const [selectedAccessPackageId, setSelectedAccessPackageId] = useState(
    firstAccessPackage?.id || '',
  )
  const [accessPackageForm, setAccessPackageForm] = useState(
    () => buildAccessPackagePreset(firstAccessPackage),
  )
  const [flash, setFlash] = useState<FlashState>(null)

  const selectedStore = useMemo(
    () => dashboardData.stores.find((store) => store.id === selectedStoreId) || null,
    [dashboardData.stores, selectedStoreId],
  )
  const selectedProduct = useMemo(
    () => dashboardData.products.find((product) => product.id === selectedProductId) || null,
    [dashboardData.products, selectedProductId],
  )
  const selectedStoreProduct = useMemo(
    () => dashboardData.storeProducts.find((item) => (
      item.storeId === selectedStoreId && item.productId === selectedProductId
    )) || null,
    [dashboardData.storeProducts, selectedProductId, selectedStoreId],
  )
  const selectedAccessPackage = useMemo(
    () => dashboardData.accessPackages.find((item) => item.id === selectedAccessPackageId) || null,
    [dashboardData.accessPackages, selectedAccessPackageId],
  )
  const resolvedBenefitCourseIds = useMemo(() => {
    const ids = new Set(
      serializeCourseSelections(directCourseSelections).map((course) => course.courseId),
    )

    dashboardData.accessPackages
      .filter((accessPackage) => selectedAccessPackageIds.includes(accessPackage.id))
      .forEach((accessPackage) => {
        accessPackage.courses.forEach((course) => ids.add(course.courseId))
      })

    return [...ids]
  }, [dashboardData.accessPackages, directCourseSelections, selectedAccessPackageIds])

  const selectedPrice = selectedStoreProduct?.priceOverride ?? selectedProduct?.basePrice ?? 0
  const checkoutHref = selectedStoreProduct
    ? `/member/${orgSlug}/checkout?product=${selectedStoreProduct.id}`
    : `/member/${orgSlug}/checkout`

  function applySalesContext(nextStoreId: string, nextProductId: string) {
    setSelectedStoreId(nextStoreId)
    setSelectedProductId(nextProductId)
    const entitlement = findEntitlement(dashboardData, nextStoreId, nextProductId)
    setDirectCourseSelections(buildCourseSelectionState(entitlement?.directCourses || []))
    setSelectedAccessPackageIds(entitlement?.packageIds || [])
    setFlash(null)
  }

  function applyAccessPackageSelection(packageId: string) {
    setSelectedAccessPackageId(packageId)
    const accessPackage = dashboardData.accessPackages.find((item) => item.id === packageId) || null
    setAccessPackageForm(buildAccessPackagePreset(accessPackage))
  }

  function appendStoreContext(formData: FormData) {
    formData.set('org_slug', orgSlug)
    if (selectedStore?.slug) {
      formData.set('store_slug', selectedStore.slug)
    }
  }

  function runAction(
    action: (formData: FormData) => Promise<ActionResult>,
    formData: FormData,
    successText: string,
    onSuccess?: (result: ActionResult) => void,
  ) {
    startTransition(async () => {
      const result = await action(formData)
      if (!result.success) {
        setFlash({
          tone: 'error',
          text: result.error || 'Terjadi kesalahan saat menyimpan data.',
        })
        return
      }

      onSuccess?.(result)
      setFlash({ tone: 'success', text: successText })
      router.refresh()
    })
  }

  const flashClassName = cn(
    'rounded-xl border px-5 py-4 text-sm font-semibold',
    flash?.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
    flash?.tone === 'error' && 'border-rose-200 bg-rose-50 text-rose-800',
    flash?.tone === 'info' && 'border-blue-200 bg-blue-50 text-blue-800',
  )

  return (
    <div className="space-y-8">
      {flash && (
        <div role={flash.tone === 'error' ? 'alert' : 'status'} className={flashClassName}>
          {flash.text}
        </div>
      )}

      {showContextSelector && (
        <SectionCard>
          <SectionHeader
            title="Pilih Produk Kelas"
            subtitle="Tentukan store dan produk yang akan diberi manfaat multi-course."
            icon={ShoppingCart}
            actions={(
              <Link
                href="/ecommerce"
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
              >
                E-Commerce Lengkap
                <ExternalLink aria-hidden="true" size={16} />
              </Link>
            )}
          />
          <div className="grid gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[1fr_1fr_0.9fr]">
            <label className="text-sm font-semibold text-slate-700">
              Store
              <select
                value={selectedStoreId}
                onChange={(event) => applySalesContext(event.target.value, selectedProductId)}
                className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              >
                {dashboardData.stores.length === 0 && <option value="">Belum ada store</option>}
                {dashboardData.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Produk
              <select
                value={selectedProductId}
                onChange={(event) => applySalesContext(selectedStoreId, event.target.value)}
                className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              >
                {dashboardData.products.length === 0 && <option value="">Belum ada produk</option>}
                {dashboardData.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status penjualan
                </span>
                <StatusBadge
                  label={selectedStoreProduct?.isPublished ? 'Tayang' : 'Belum tayang'}
                  variant={selectedStoreProduct?.isPublished ? 'success' : 'warning'}
                />
              </div>
              <p className="mt-3 truncate font-semibold text-slate-900">
                {selectedStoreProduct?.publicName || selectedProduct?.name || 'Produk belum dipilih'}
              </p>
              <p className="mt-1 font-mono text-sm font-bold text-slate-700">
                {formatRupiah(Number(selectedPrice || 0))}
              </p>
              {selectedStoreProduct?.isPublished && (
                <Link
                  href={checkoutHref}
                  target="_blank"
                  className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-indigo-700 transition-colors duration-200 hover:text-indigo-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                >
                  Lihat checkout
                  <ExternalLink aria-hidden="true" size={16} />
                </Link>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      <div className="grid gap-8 xl:grid-cols-2">
        <SectionCard>
          <SectionHeader
            title="Manfaat Digital Produk"
            subtitle="Satu produk boleh memberikan banyak course langsung dan beberapa paket akses sekaligus."
            icon={BookOpen}
          />
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!selectedStoreProduct) {
                setFlash({
                  tone: 'error',
                  text: 'Publikasikan produk ke store terlebih dahulu sebelum mengatur course.',
                })
                return
              }

              const formData = new FormData()
              formData.set('store_product_id', selectedStoreProduct.id)
              formData.set(
                'direct_courses',
                JSON.stringify(serializeCourseSelections(directCourseSelections)),
              )
              formData.set('package_ids', JSON.stringify(selectedAccessPackageIds))
              appendStoreContext(formData)
              runAction(
                saveProductEntitlementsAction,
                formData,
                'Manfaat course produk berhasil disimpan dan berlaku di LMS maupun E-Commerce.',
              )
            }}
            className="space-y-6 px-5 py-6 sm:px-8"
          >
            {!selectedStoreProduct && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                Produk ini belum dipublikasikan ke store. Buka E-Commerce Lengkap untuk mengatur harga dan publikasi.
              </div>
            )}
            <fieldset>
              <legend className="text-sm font-bold text-slate-900">Akses Kelas Individual</legend>
              <p className="mt-1 text-sm text-slate-600">
                Pilih kelas yang akan langsung didapatkan oleh pembeli produk ini. Durasi kosong berarti akses permanen.
              </p>
              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {dashboardData.learningCourses.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                    Belum ada course yang dapat dijual.
                  </p>
                )}
                {dashboardData.learningCourses.map((course) => {
                  const selection = directCourseSelections[course.id]
                  const checked = Boolean(selection?.selected)
                  return (
                    <div key={course.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold text-slate-900">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleCourseSelection(
                            setDirectCourseSelections,
                            course.id,
                            event.target.checked,
                          )}
                          className="size-4 accent-indigo-700"
                        />
                        <span className="min-w-0 truncate">{course.title}</span>
                      </label>
                      {checked && (
                        <div className="mt-3 grid gap-2 pl-7 sm:grid-cols-2">
                          <input
                            type="number"
                            min="1"
                            value={selection?.durationValue || ''}
                            onChange={(event) => setDirectCourseSelections((current) => ({
                              ...current,
                              [course.id]: {
                                selected: true,
                                durationValue: event.target.value,
                                durationUnit: current[course.id]?.durationUnit || 'DAY',
                              },
                            }))}
                            placeholder="Durasi (kosong = permanen)"
                            aria-label={`Durasi akses ${course.title}`}
                            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                          />
                          <select
                            value={selection?.durationUnit || 'DAY'}
                            onChange={(event) => setDirectCourseSelections((current) => ({
                              ...current,
                              [course.id]: {
                                selected: true,
                                durationValue: current[course.id]?.durationValue || '',
                                durationUnit: event.target.value,
                              },
                            }))}
                            aria-label={`Satuan durasi ${course.title}`}
                            className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                          >
                            <option value="HOUR">Jam</option>
                            <option value="DAY">Hari</option>
                            <option value="WEEK">Minggu</option>
                            <option value="MONTH">Bulan</option>
                            <option value="YEAR">Tahun</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-bold text-slate-900">Akses via Bundel / Paket</legend>
              <div className="mt-3 grid gap-3">
                {dashboardData.accessPackages.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                    Belum ada paket akses. Buat paket pada panel di sebelahnya.
                  </p>
                )}
                {dashboardData.accessPackages.map((accessPackage) => (
                  <label
                    key={accessPackage.id}
                    className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors duration-200 hover:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccessPackageIds.includes(accessPackage.id)}
                      onChange={(event) => setSelectedAccessPackageIds((current) => (
                        event.target.checked
                          ? [...new Set([...current, accessPackage.id])]
                          : current.filter((id) => id !== accessPackage.id)
                      ))}
                      className="mt-1 size-4 accent-indigo-700"
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">{accessPackage.name}</span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {accessPackage.courses.length} course · versi {accessPackage.version}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 font-bold text-emerald-950">
                <Layers3 aria-hidden="true" size={18} />
                Hasil akhir: {resolvedBenefitCourseIds.length} course
              </div>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                {resolvedBenefitCourseIds
                  .map((id) => dashboardData.learningCourses.find((course) => course.id === id)?.title)
                  .filter(Boolean)
                  .join(', ') || 'Belum ada course dipilih.'}
              </p>
            </div>
            <div className="flex justify-end">
              <SafeButton
                type="submit"
                isLoading={isPending}
                disabled={!selectedStoreProduct}
                className="min-h-11"
              >
                Simpan Manfaat Digital
              </SafeButton>
            </div>
          </form>
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Pengelola Paket Akses"
            subtitle="Paket subscription mengikuti perubahan course dan seluruh dampaknya diaudit."
            icon={Layers3}
          />
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData()
              if (selectedAccessPackageId) {
                formData.set('package_id', selectedAccessPackageId)
              }
              formData.set('name', accessPackageForm.name)
              formData.set('slug', accessPackageForm.slug)
              formData.set('description', accessPackageForm.description)
              formData.set('is_active', String(accessPackageForm.isActive))
              formData.set(
                'default_access_duration_value',
                accessPackageForm.defaultDurationValue,
              )
              formData.set(
                'default_access_duration_unit',
                accessPackageForm.defaultDurationUnit,
              )
              formData.set(
                'courses',
                JSON.stringify(serializeCourseSelections(accessPackageForm.courses)),
              )
              appendStoreContext(formData)
              runAction(
                saveAccessPackageAction,
                formData,
                selectedAccessPackageId
                  ? 'Paket akses dan membership aktif berhasil diselaraskan.'
                  : 'Paket akses berhasil dibuat.',
                (result) => {
                  if (selectedAccessPackageId) return
                  const data = result.data as { packageId?: unknown } | undefined
                  if (data?.packageId) {
                    setSelectedAccessPackageId(String(data.packageId))
                  }
                },
              )
            }}
            className="space-y-5 px-5 py-6 sm:px-8"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="course-commerce-package">
                Pilih paket akses
              </label>
              <select
                id="course-commerce-package"
                value={selectedAccessPackageId}
                onChange={(event) => applyAccessPackageSelection(event.target.value)}
                className="min-h-11 flex-1 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 font-semibold outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              >
                <option value="">Paket baru</option>
                {dashboardData.accessPackages.map((accessPackage) => (
                  <option key={accessPackage.id} value={accessPackage.id}>
                    {accessPackage.name} · v{accessPackage.version}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => applyAccessPackageSelection('')}
                className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
              >
                Paket baru
              </button>
            </div>
            {selectedAccessPackage && selectedAccessPackage.activeSubscriptionMembers > 0 && (
              <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                Perubahan paket ini memengaruhi {selectedAccessPackage.activeSubscriptionMembers} membership subscription aktif. Akses dari pembelian atau sumber lain tetap aman.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Nama paket <span className="text-red-500">*</span>
                <input
                  required
                  value={accessPackageForm.name}
                  onChange={(event) => setAccessPackageForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 font-normal outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Slug <span className="font-normal text-slate-400">(Opsional)</span>
                <input
                  value={accessPackageForm.slug}
                  onChange={(event) => setAccessPackageForm((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 font-mono font-normal outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Deskripsi <span className="font-normal text-slate-400">(Opsional)</span>
              <textarea
                rows={3}
                value={accessPackageForm.description}
                onChange={(event) => setAccessPackageForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-semibold text-slate-700">
                Durasi default <span className="font-normal text-slate-400">(Opsional)</span>
                <input
                  type="number"
                  min="1"
                  value={accessPackageForm.defaultDurationValue}
                  onChange={(event) => setAccessPackageForm((current) => ({
                    ...current,
                    defaultDurationValue: event.target.value,
                  }))}
                  placeholder="Permanen"
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 font-normal outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Satuan
                <select
                  value={accessPackageForm.defaultDurationUnit}
                  onChange={(event) => setAccessPackageForm((current) => ({
                    ...current,
                    defaultDurationUnit: event.target.value,
                  }))}
                  className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="HOUR">Jam</option>
                  <option value="DAY">Hari</option>
                  <option value="WEEK">Minggu</option>
                  <option value="MONTH">Bulan</option>
                  <option value="YEAR">Tahun</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Status
                <select
                  value={String(accessPackageForm.isActive)}
                  onChange={(event) => setAccessPackageForm((current) => ({
                    ...current,
                    isActive: event.target.value === 'true',
                  }))}
                  className="mt-2 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-bold text-slate-900">Pilih Kelas untuk Paket Ini</legend>
              <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {dashboardData.learningCourses.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                    Belum ada course yang dapat dimasukkan ke paket.
                  </p>
                )}
                {dashboardData.learningCourses.map((course) => {
                  const selection = accessPackageForm.courses[course.id]
                  const checked = Boolean(selection?.selected)
                  return (
                    <div key={course.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold text-slate-900">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setAccessPackageForm((current) => ({
                            ...current,
                            courses: {
                              ...current.courses,
                              [course.id]: {
                                selected: event.target.checked,
                                durationValue: current.courses[course.id]?.durationValue || '',
                                durationUnit: current.courses[course.id]?.durationUnit || 'DAY',
                              },
                            },
                          }))}
                          className="size-4 accent-indigo-700"
                        />
                        <span className="min-w-0 truncate">{course.title}</span>
                      </label>
                      {checked && (
                        <div className="mt-3 grid gap-2 pl-7 sm:grid-cols-2">
                          <input
                            type="number"
                            min="1"
                            value={selection?.durationValue || ''}
                            onChange={(event) => setAccessPackageForm((current) => ({
                              ...current,
                              courses: {
                                ...current.courses,
                                [course.id]: {
                                  selected: true,
                                  durationValue: event.target.value,
                                  durationUnit: current.courses[course.id]?.durationUnit || 'DAY',
                                },
                              },
                            }))}
                            placeholder="Kosong = pakai default"
                            aria-label={`Override durasi ${course.title}`}
                            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                          />
                          <select
                            value={selection?.durationUnit || 'DAY'}
                            onChange={(event) => setAccessPackageForm((current) => ({
                              ...current,
                              courses: {
                                ...current.courses,
                                [course.id]: {
                                  selected: true,
                                  durationValue: current.courses[course.id]?.durationValue || '',
                                  durationUnit: event.target.value,
                                },
                              },
                            }))}
                            aria-label={`Satuan override ${course.title}`}
                            className="min-h-11 cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none transition-colors duration-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                          >
                            <option value="HOUR">Jam</option>
                            <option value="DAY">Hari</option>
                            <option value="WEEK">Minggu</option>
                            <option value="MONTH">Bulan</option>
                            <option value="YEAR">Tahun</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </fieldset>
            <div className="flex justify-end">
              <SafeButton type="submit" isLoading={isPending} className="min-h-11">
                {selectedAccessPackageId ? 'Simpan dan Sinkronkan' : 'Buat Paket'}
              </SafeButton>
            </div>
          </form>
        </SectionCard>
      </div>

      {showContextSelector && selectedStoreProduct?.isPublished && (
        <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Store aria-hidden="true" size={18} />
            <span>
              Pengaturan ini langsung memakai data yang sama dengan halaman E-Commerce.
            </span>
          </div>
          <Link
            href={checkoutHref}
            target="_blank"
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-indigo-800 transition-colors duration-200 hover:text-indigo-950 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
          >
            Buka checkout produk
            <ExternalLink aria-hidden="true" size={16} />
          </Link>
        </div>
      )}
    </div>
  )
}
