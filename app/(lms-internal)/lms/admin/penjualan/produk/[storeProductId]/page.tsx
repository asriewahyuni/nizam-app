/**
 * Halaman perubahan produk LMS.
 */
import { notFound } from 'next/navigation'
import { getLmsProductSalesData } from '@/modules/ecommerce/lib/lms-sales.server'
import ProductEditor from '../../ProductEditor'

function safeReturnTo(value: string | undefined) {
  return value?.startsWith('/lms/admin/penjualan')
    ? value
    : '/lms/admin/penjualan'
}

export default async function EditLmsProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeProductId: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const [{ storeProductId }, query, data] = await Promise.all([
    params,
    searchParams,
    getLmsProductSalesData(),
  ])
  const product = data.storeProducts.find((item) => item.id === storeProductId)
  if (!product) notFound()

  return (
    <ProductEditor
      orgSlug={data.org.slug}
      primaryLmsHostname={data.primaryLmsHostname}
      stores={data.stores}
      courses={data.learningCourses}
      packages={data.accessPackages}
      batches={data.batches}
      initialProduct={product}
      initialEntitlement={
        data.productEntitlements.find((item) => item.storeProductId === product.id) || null
      }
      returnTo={safeReturnTo(query.returnTo)}
    />
  )
}
