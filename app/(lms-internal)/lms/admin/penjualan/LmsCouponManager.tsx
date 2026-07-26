'use client'

/**
 * Pengelola kode diskon yang sederhana di dalam LMS.
 * Data yang sama langsung dipakai oleh checkout toko publik dan portal member.
 */
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  Check,
  Copy,
  Edit2,
  Percent,
  Plus,
  Power,
  Tag,
  TicketPercent,
  X,
} from 'lucide-react'
import { SafeButton, SectionCard, StatusBadge } from '@/components/ui/NizamUI'
import { cn, formatRupiah } from '@/lib/utils'
import type { AdminCouponView, EcommerceDashboardData } from '@/modules/ecommerce/lib/ecommerce'
import {
  saveLmsCouponAction,
  setLmsCouponStatusAction,
} from '@/modules/edu/actions/lms-sales.actions'

type CouponForm = {
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  minimumAmount: number
  usageLimit: number
  perUserLimit: number
  startsAt: string
  expiresAt: string
  allowedStoreProductIds: string[]
  isActive: boolean
}

const EMPTY_FORM: CouponForm = {
  code: '',
  discountType: 'PERCENT',
  discountValue: 10,
  minimumAmount: 0,
  usageLimit: 0,
  perUserLimit: 1,
  startsAt: '',
  expiresAt: '',
  allowedStoreProductIds: [],
  isActive: true,
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function formatCouponPeriod(coupon: AdminCouponView) {
  if (!coupon.startsAt && !coupon.expiresAt) return 'Tanpa batas waktu'
  const formatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  if (!coupon.startsAt) return `Sampai ${formatter.format(new Date(coupon.expiresAt || ''))}`
  if (!coupon.expiresAt) return `Mulai ${formatter.format(new Date(coupon.startsAt))}`
  return `${formatter.format(new Date(coupon.startsAt))} – ${formatter.format(new Date(coupon.expiresAt))}`
}

export default function LmsCouponManager({
  dashboardData,
}: {
  dashboardData: EcommerceDashboardData
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null)
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM)
  const [copiedCode, setCopiedCode] = useState('')
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const storeProductById = useMemo(
    () => new Map(dashboardData.storeProducts.map((product) => [product.id, product])),
    [dashboardData.storeProducts],
  )

  function openCreateModal() {
    setEditingCouponId(null)
    setForm(EMPTY_FORM)
    setFlash(null)
    setIsModalOpen(true)
  }

  function openEditModal(coupon: AdminCouponView) {
    setEditingCouponId(coupon.id)
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumAmount: coupon.minimumAmount,
      usageLimit: coupon.usageLimit || 0,
      perUserLimit: coupon.perUserLimit,
      startsAt: toDateTimeLocal(coupon.startsAt),
      expiresAt: toDateTimeLocal(coupon.expiresAt),
      allowedStoreProductIds: coupon.allowedStoreProductIds,
      isActive: coupon.isActive,
    })
    setFlash(null)
    setIsModalOpen(true)
  }

  function saveCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData()
    if (editingCouponId) formData.set('coupon_id', editingCouponId)
    formData.set('code', form.code)
    formData.set('discount_type', form.discountType)
    formData.set('discount_value', String(form.discountValue))
    formData.set('minimum_amount', String(form.minimumAmount))
    formData.set('usage_limit', String(form.usageLimit))
    formData.set('per_user_limit', String(form.perUserLimit))
    formData.set('starts_at', form.startsAt)
    formData.set('expires_at', form.expiresAt)
    formData.set('store_product_ids', JSON.stringify(form.allowedStoreProductIds))
    formData.set('is_active', form.isActive ? 'true' : 'false')

    startTransition(async () => {
      const result = await saveLmsCouponAction(formData)
      if (!result.success) {
        setFlash({ tone: 'error', text: result.error || 'Kode diskon gagal disimpan.' })
        return
      }
      setIsModalOpen(false)
      setFlash({ tone: 'success', text: 'Kode diskon berhasil disimpan dan siap dipakai.' })
      router.refresh()
    })
  }

  function toggleCoupon(coupon: AdminCouponView) {
    const formData = new FormData()
    formData.set('coupon_id', coupon.id)
    formData.set('is_active', coupon.isActive ? 'false' : 'true')
    startTransition(async () => {
      const result = await setLmsCouponStatusAction(formData)
      if (!result.success) {
        setFlash({ tone: 'error', text: result.error || 'Status kode diskon gagal diubah.' })
        return
      }
      setFlash({
        tone: 'success',
        text: coupon.isActive ? 'Kode diskon dinonaktifkan.' : 'Kode diskon diaktifkan.',
      })
      router.refresh()
    })
  }

  async function copyCoupon(code: string) {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    window.setTimeout(() => setCopiedCode((current) => current === code ? '' : current), 2000)
  }

  return (
    <>
      <SectionCard>
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <div className="flex items-center gap-2 text-indigo-700">
              <TicketPercent aria-hidden="true" size={18} />
              <span className="text-xs font-bold uppercase tracking-[0.16em]">Promosi</span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-950">Kode Diskon</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Buat kode sekali, lalu pembeli dapat memakainya langsung di halaman checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
          >
            <Plus aria-hidden="true" size={16} />
            Buat Kode Diskon
          </button>
        </div>

        {flash && (
          <div
            role="status"
            className={cn(
              'mx-5 mt-5 rounded-xl border px-4 py-3 text-sm font-semibold sm:mx-8',
              flash.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800',
            )}
          >
            {flash.text}
          </div>
        )}

        {dashboardData.coupons.length === 0 ? (
          <div className="px-5 py-10 text-center sm:px-8">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
              <Tag aria-hidden="true" size={22} />
            </div>
            <h3 className="mt-4 font-bold text-slate-950">Belum ada kode diskon</h3>
            <p className="mx-auto mt-1 max-w-xl text-sm font-medium text-slate-600">
              Buat kode seperti HEMAT20, tentukan besar potongan, lalu pilih produk yang boleh memakainya.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:p-8 lg:grid-cols-2">
            {dashboardData.coupons.map((coupon) => {
              const productNames = coupon.allowedStoreProductIds
                .map((id) => storeProductById.get(id)?.publicName)
                .filter((name): name is string => Boolean(name))
              return (
                <article
                  key={coupon.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-200 hover:border-indigo-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-bold tracking-wide text-slate-950">
                          {coupon.code}
                        </span>
                        <StatusBadge
                          label={coupon.isActive ? 'Aktif' : 'Nonaktif'}
                          variant={coupon.isActive ? 'success' : 'neutral'}
                        />
                      </div>
                      <p className="mt-2 text-sm font-bold text-indigo-700">
                        {coupon.discountType === 'PERCENT'
                          ? `Diskon ${coupon.discountValue}%`
                          : `Potongan ${formatRupiah(coupon.discountValue)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyCoupon(coupon.code)}
                      aria-label={`Salin kode ${coupon.code}`}
                      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                    >
                      {copiedCode === coupon.code
                        ? <Check aria-hidden="true" size={17} />
                        : <Copy aria-hidden="true" size={17} />}
                    </button>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="text-xs font-semibold text-slate-500">Pemakaian</dt>
                      <dd className="mt-1 font-bold text-slate-900">
                        {coupon.redemptionCount}
                        {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' / tanpa batas'}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="text-xs font-semibold text-slate-500">Minimum belanja</dt>
                      <dd className="mt-1 font-bold text-slate-900">
                        {coupon.minimumAmount > 0 ? formatRupiah(coupon.minimumAmount) : 'Tanpa minimum'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 space-y-2 text-xs font-medium text-slate-600">
                    <p className="flex items-start gap-2">
                      <CalendarClock aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
                      <span>{formatCouponPeriod(coupon)}</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Tag aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
                      <span>
                        {productNames.length > 0
                          ? `Berlaku untuk ${productNames.join(', ')}`
                          : 'Berlaku untuk semua produk'}
                      </span>
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => openEditModal(coupon)}
                      className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                    >
                      <Edit2 aria-hidden="true" size={15} />
                      Ubah
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => toggleCoupon(coupon)}
                      className={cn(
                        'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
                        coupon.isActive
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-100',
                      )}
                    >
                      <Power aria-hidden="true" size={15} />
                      {coupon.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </SectionCard>

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="coupon-dialog-title"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <form
            onSubmit={saveCoupon}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <h3 id="coupon-dialog-title" className="text-lg font-bold text-slate-950">
                  {editingCouponId ? 'Ubah Kode Diskon' : 'Buat Kode Diskon'}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  Kode yang aktif langsung dapat dipakai di checkout publik.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup"
                className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {flash?.tone === 'error' && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                  {flash.text}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Kode diskon
                  <input
                    required
                    minLength={3}
                    value={form.code}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                    }))}
                    placeholder="HEMAT20"
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 font-mono text-sm font-bold uppercase text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Jenis diskon
                  <select
                    value={form.discountType}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      discountType: event.target.value as CouponForm['discountType'],
                    }))}
                    className="mt-1.5 min-h-11 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="PERCENT">Persentase (%)</option>
                    <option value="FIXED">Potongan Rupiah</option>
                  </select>
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Nilai diskon
                  <div className="relative mt-1.5">
                    <input
                      required
                      type="number"
                      min="1"
                      max={form.discountType === 'PERCENT' ? 100 : undefined}
                      value={form.discountValue}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        discountValue: Math.max(0, Number(event.target.value)),
                      }))}
                      className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 pr-11 text-sm font-semibold text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                    />
                    {form.discountType === 'PERCENT' && (
                      <Percent aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    )}
                  </div>
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Minimum belanja
                  <input
                    type="number"
                    min="0"
                    value={form.minimumAmount}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      minimumAmount: Math.max(0, Number(event.target.value)),
                    }))}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Kuota total
                  <input
                    type="number"
                    min="0"
                    value={form.usageLimit}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      usageLimit: Math.max(0, Math.trunc(Number(event.target.value))),
                    }))}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                  />
                  <span className="mt-1 block text-xs font-medium text-slate-500">Isi 0 untuk tanpa batas.</span>
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Maksimal per pembeli
                  <input
                    type="number"
                    min="1"
                    value={form.perUserLimit}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      perUserLimit: Math.max(1, Math.trunc(Number(event.target.value))),
                    }))}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Mulai berlaku
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Berakhir
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition-colors focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <fieldset>
                <legend className="text-sm font-bold text-slate-900">Produk yang boleh memakai kode</legend>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  Jika tidak ada yang dipilih, kode berlaku untuk semua produk.
                </p>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {dashboardData.storeProducts.map((product) => {
                    const checked = form.allowedStoreProductIds.includes(product.id)
                    return (
                      <label
                        key={product.id}
                        className={cn(
                          'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-200',
                          checked
                            ? 'border-indigo-300 bg-indigo-50'
                            : 'border-slate-200 bg-white hover:border-slate-300',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            allowedStoreProductIds: event.target.checked
                              ? [...current.allowedStoreProductIds, product.id]
                              : current.allowedStoreProductIds.filter((id) => id !== product.id),
                          }))}
                          className="size-4 accent-indigo-700"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{product.publicName}</span>
                          <span className="block text-xs font-medium text-slate-500">
                            {formatRupiah(product.priceOverride || 0)}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="size-4 accent-indigo-700"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Langsung aktifkan</span>
                  <span className="block text-xs font-medium text-slate-600">Pembeli dapat memakai kode setelah disimpan.</span>
                </span>
              </label>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
              >
                Batal
              </button>
              <SafeButton type="submit" isLoading={isPending} className="min-h-11 px-5">
                {editingCouponId ? 'Simpan Perubahan' : 'Buat Kode Diskon'}
              </SafeButton>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
