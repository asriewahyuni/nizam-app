/**
 * Halaman perubahan kode diskon.
 */
import { notFound } from 'next/navigation'
import { getLmsCouponSalesData } from '@/modules/ecommerce/lib/lms-sales.server'
import CouponEditor from '../../CouponEditor'

function safeReturnTo(value?: string) {
  return value?.startsWith('/lms/admin/penjualan/diskon') ? value : '/lms/admin/penjualan/diskon'
}

export default async function EditCouponPage({ params, searchParams }: { params: Promise<{ couponId: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const [{ couponId }, query, data] = await Promise.all([params, searchParams, getLmsCouponSalesData()])
  const coupon = data.coupons.find((item) => item.id === couponId)
  if (!coupon) notFound()
  return <CouponEditor initialCoupon={coupon} products={data.storeProducts} returnTo={safeReturnTo(query.returnTo)} />
}
