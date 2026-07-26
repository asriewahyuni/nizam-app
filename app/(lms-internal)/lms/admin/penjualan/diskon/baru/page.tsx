/**
 * Halaman pembuatan kode diskon.
 */
import { getLmsCouponSalesData } from '@/modules/ecommerce/lib/lms-sales.server'
import CouponEditor from '../../CouponEditor'

function safeReturnTo(value?: string) {
  return value?.startsWith('/lms/admin/penjualan/diskon') ? value : '/lms/admin/penjualan/diskon'
}

export default async function NewCouponPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [data, query] = await Promise.all([getLmsCouponSalesData(), searchParams])
  return <CouponEditor initialCoupon={null} products={data.storeProducts} returnTo={safeReturnTo(query.returnTo)} />
}
