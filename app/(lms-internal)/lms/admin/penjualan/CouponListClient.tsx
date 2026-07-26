'use client'

/**
 * Tabel kode diskon dengan salin kode dan perubahan status.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, PencilLine, Power } from 'lucide-react'
import { cn, formatRupiah } from '@/lib/utils'
import type {
  AdminCouponView,
  AdminStoreProductView,
} from '@/modules/ecommerce/lib/ecommerce'
import { setLmsCouponStatusAction } from '@/modules/edu/actions/lms-sales.actions'

function formatPeriod(coupon: AdminCouponView) {
  const formatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })
  if (!coupon.startsAt && !coupon.expiresAt) return 'Tanpa batas'
  if (!coupon.startsAt) return `s.d. ${formatter.format(new Date(coupon.expiresAt || ''))}`
  if (!coupon.expiresAt) return `Mulai ${formatter.format(new Date(coupon.startsAt))}`
  return `${formatter.format(new Date(coupon.startsAt))} – ${formatter.format(new Date(coupon.expiresAt))}`
}

export default function CouponListClient({
  coupons,
  products,
  returnTo,
}: {
  coupons: AdminCouponView[]
  products: AdminStoreProductView[]
  returnTo: string
}) {
  const router = useRouter()
  const [copiedCode, setCopiedCode] = useState('')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const productById = new Map(products.map((product) => [product.id, product]))

  async function copy(code: string) {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    window.setTimeout(() => setCopiedCode((current) => current === code ? '' : current), 2000)
  }

  function toggle(coupon: AdminCouponView) {
    const formData = new FormData()
    formData.set('coupon_id', coupon.id)
    formData.set('is_active', String(!coupon.isActive))
    startTransition(async () => {
      const result = await setLmsCouponStatusAction(formData)
      if (!result.success) {
        setMessage(result.error || 'Status kode diskon gagal diubah.')
        return
      }
      setMessage(coupon.isActive ? 'Kode diskon dinonaktifkan.' : 'Kode diskon diaktifkan.')
      router.refresh()
    })
  }

  return (
    <>
      {message && <div role="status" className="border-b border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">{message}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Potongan</th><th className="px-4 py-3">Periode</th><th className="px-4 py-3">Penggunaan</th><th className="px-4 py-3">Produk</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Tindakan</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {coupons.map((coupon) => {
              const productNames = coupon.allowedStoreProductIds
                .map((id) => productById.get(id)?.publicName)
                .filter(Boolean)
              return (
                <tr key={coupon.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-4"><p className="font-mono text-sm font-bold tracking-wide text-slate-950">{coupon.code}</p><p className="mt-1 text-xs font-medium text-slate-500">Min. {formatRupiah(coupon.minimumAmount)}</p></td>
                  <td className="px-4 py-4 text-sm font-bold text-indigo-700">{coupon.discountType === 'PERCENT' ? `${coupon.discountValue}%` : formatRupiah(coupon.discountValue)}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">{formatPeriod(coupon)}</td>
                  <td className="px-4 py-4"><p className="text-sm font-bold text-slate-900">{coupon.redemptionCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}</p><p className="mt-1 text-xs font-medium text-slate-500">Maks. {coupon.perUserLimit}/member</p></td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">{productNames.length === 0 ? 'Semua produk' : `${productNames.slice(0, 2).join(', ')}${productNames.length > 2 ? ` +${productNames.length - 2}` : ''}`}</td>
                  <td className="px-4 py-4"><span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', coupon.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700')}>{coupon.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td className="px-4 py-4"><div className="flex justify-end gap-1">
                    <button type="button" onClick={() => copy(coupon.code)} aria-label={`Salin ${coupon.code}`} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">{copiedCode === coupon.code ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}</button>
                    <Link href={`/lms/admin/penjualan/diskon/${coupon.id}?returnTo=${encodeURIComponent(returnTo)}`} aria-label={`Ubah ${coupon.code}`} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"><PencilLine aria-hidden="true" size={17} /></Link>
                    <button type="button" disabled={isPending} onClick={() => toggle(coupon)} aria-label={`${coupon.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${coupon.code}`} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 disabled:cursor-wait disabled:opacity-50"><Power aria-hidden="true" size={17} /></button>
                  </div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
