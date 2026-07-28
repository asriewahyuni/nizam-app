'use client'

/**
 * Editor khusus kode diskon LMS.
 */
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CircleAlert, LoaderCircle, Save, TicketPercent } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  AdminCouponView,
  AdminStoreProductView,
} from '@/modules/ecommerce/lib/ecommerce'
import { saveLmsCouponAction } from '@/modules/edu/actions/lms-sales.actions'

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

export default function CouponEditor({
  initialCoupon,
  products,
  returnTo,
}: {
  initialCoupon: AdminCouponView | null
  products: AdminStoreProductView[]
  returnTo: string
}) {
  const router = useRouter()
  const [code, setCode] = useState(initialCoupon?.code || '')
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>(initialCoupon?.discountType || 'PERCENT')
  const [discountValue, setDiscountValue] = useState(String(initialCoupon?.discountValue || 10))
  const [minimumAmount, setMinimumAmount] = useState(String(initialCoupon?.minimumAmount || 0))
  const [usageLimit, setUsageLimit] = useState(String(initialCoupon?.usageLimit || ''))
  const [perUserLimit, setPerUserLimit] = useState(String(initialCoupon?.perUserLimit || 1))
  const [startsAt, setStartsAt] = useState(toDateTimeLocal(initialCoupon?.startsAt || null))
  const [expiresAt, setExpiresAt] = useState(toDateTimeLocal(initialCoupon?.expiresAt || null))
  const [productIds, setProductIds] = useState<string[]>(initialCoupon?.allowedStoreProductIds || [])
  const [isActive, setIsActive] = useState(initialCoupon?.isActive ?? true)
  const [isAffiliateTemplate, setIsAffiliateTemplate] = useState(initialCoupon?.isAffiliateTemplate ?? false)
  const isOwnedByAffiliate = Boolean(initialCoupon?.affiliateProfileId)
  const [dirty, setDirty] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function update(setter: (value: string) => void, value: string) {
    setter(value)
    setDirty(true)
  }

  function leaveEditor() {
    if (dirty && !window.confirm('Perubahan kode diskon belum disimpan. Tetap kembali?')) return
    router.push(returnTo)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (code.trim().length < 3 || Number(discountValue) <= 0) {
      setMessage({ tone: 'error', text: 'Kode minimal 3 karakter dan nilai diskon harus lebih dari nol.' })
      return
    }
    const formData = new FormData()
    if (initialCoupon) formData.set('coupon_id', initialCoupon.id)
    formData.set('code', code)
    formData.set('discount_type', discountType)
    formData.set('discount_value', discountValue)
    formData.set('minimum_amount', minimumAmount)
    formData.set('usage_limit', usageLimit)
    formData.set('per_user_limit', perUserLimit)
    formData.set('starts_at', startsAt)
    formData.set('expires_at', expiresAt)
    formData.set('store_product_ids', JSON.stringify(productIds))
    formData.set('is_active', String(isActive))
    formData.set('is_affiliate_template', String(isAffiliateTemplate))
    startTransition(async () => {
      const result = await saveLmsCouponAction(formData)
      if (!result.success) {
        setMessage({ tone: 'error', text: result.error || 'Kode diskon gagal disimpan.' })
        return
      }
      setDirty(false)
      setMessage({ tone: 'success', text: 'Kode diskon berhasil disimpan.' })
      router.push(returnTo)
      router.refresh()
    })
  }

  const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'

  return (
    <form onSubmit={submit} className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">{initialCoupon ? 'Ubah kode' : 'Kode baru'}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-2xl font-bold text-slate-950">{initialCoupon?.code || 'Buat Kode Diskon'}</h2><p className="mt-1 text-sm font-medium text-slate-600">Satu formulir ringkas untuk aturan promo checkout.</p></div>
          <button type="button" onClick={leaveEditor} className="min-h-11 cursor-pointer rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">Kembali ke daftar</button>
        </div>
      </header>

      <div aria-live="polite">{message && <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold', message.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>{message.tone === 'error' ? <CircleAlert aria-hidden="true" size={17} /> : <Check aria-hidden="true" size={17} />}{message.text}</div>}</div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950"><TicketPercent aria-hidden="true" size={19} className="text-indigo-700" />Aturan diskon</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">Kode <span className="text-rose-600">*</span><input required value={code} onChange={(event) => update(setCode, event.target.value.toUpperCase())} onBlur={() => { if (code.trim().length < 3) setMessage({ tone: 'error', text: 'Kode minimal 3 karakter.' }) }} className={inputClass} placeholder="HEMAT20" /></label>
          <label className="text-sm font-bold text-slate-700">Jenis<select value={discountType} onChange={(event) => { setDiscountType(event.target.value as 'PERCENT' | 'FIXED'); setDirty(true) }} className={`${inputClass} cursor-pointer`}><option value="PERCENT">Persentase</option><option value="FIXED">Nominal</option></select></label>
          <label className="text-sm font-bold text-slate-700">Nilai diskon <span className="text-rose-600">*</span><input required type="number" min="0.01" max={discountType === 'PERCENT' ? 100 : undefined} step="0.01" value={discountValue} onChange={(event) => update(setDiscountValue, event.target.value)} className={inputClass} /></label>
          <label className="text-sm font-bold text-slate-700">Minimum belanja<input type="number" min="0" value={minimumAmount} onChange={(event) => update(setMinimumAmount, event.target.value)} className={inputClass} /></label>
          <label className="text-sm font-bold text-slate-700">Kuota penggunaan<input type="number" min="1" value={usageLimit} onChange={(event) => update(setUsageLimit, event.target.value)} className={inputClass} placeholder="Tanpa batas" /></label>
          <label className="text-sm font-bold text-slate-700">Batas per member<input type="number" min="1" value={perUserLimit} onChange={(event) => update(setPerUserLimit, event.target.value)} className={inputClass} /></label>
          <label className="text-sm font-bold text-slate-700">Mulai<input type="datetime-local" value={startsAt} onChange={(event) => update(setStartsAt, event.target.value)} className={inputClass} /></label>
          <label className="text-sm font-bold text-slate-700">Berakhir<input type="datetime-local" value={expiresAt} onChange={(event) => update(setExpiresAt, event.target.value)} className={inputClass} /></label>
        </div>
        <label className="mt-5 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
          <input type="checkbox" checked={isActive} onChange={(event) => { setIsActive(event.target.checked); setDirty(true) }} className="size-5 accent-indigo-700" />
          <span><span className="block text-sm font-bold text-slate-950">Kode aktif</span><span className="block text-xs font-medium text-slate-500">Checkout akan menerima kode selama aturan lain terpenuhi.</span></span>
        </label>

        {isOwnedByAffiliate ? (
          <div className="mt-3 flex min-h-14 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <span><span className="block text-sm font-bold text-amber-900">Kupon milik afiliasi</span><span className="block text-xs font-medium text-amber-700">Kode ini sudah terhubung ke satu afiliasi (personal atau hasil clone), sehingga tidak bisa dijadikan template afiliasi.</span></span>
          </div>
        ) : (
          <label className="mt-3 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
            <input type="checkbox" checked={isAffiliateTemplate} onChange={(event) => { setIsAffiliateTemplate(event.target.checked); setDirty(true) }} className="size-5 accent-indigo-700" />
            <span><span className="block text-sm font-bold text-slate-950">Tersedia untuk digunakan afiliasi</span><span className="block text-xs font-medium text-slate-500">Afiliasi bisa "menggunakan" kode ini dari dashboard mereka — sistem akan membuatkan kupon baru khusus milik afiliasi tsb dengan aturan diskon yang sama.</span></span>
          </label>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-slate-950">Produk yang diizinkan</h3>
        <p className="mt-1 text-sm font-medium text-slate-600">Tidak memilih produk berarti kode berlaku untuk semua produk.</p>
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
          {products.map((product) => (
            <label key={product.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 transition-colors hover:border-indigo-200 hover:bg-indigo-50/50">
              <input type="checkbox" checked={productIds.includes(product.id)} onChange={() => { setProductIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id]); setDirty(true) }} className="size-5 accent-indigo-700" />
              <span className="text-sm font-semibold text-slate-800">{product.publicName}</span>
            </label>
          ))}
        </div>
      </section>

      <footer className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="px-2 text-xs font-semibold text-slate-500">{dirty ? 'Ada perubahan yang belum disimpan.' : 'Semua perubahan sudah tersimpan.'}</p>
        <div className="flex gap-2">
          <button type="button" onClick={leaveEditor} className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">Batal</button>
          <button type="submit" disabled={isPending} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-wait disabled:opacity-60">{isPending ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" size={17} />}Simpan Kode</button>
        </div>
      </footer>
    </form>
  )
}
