/**
 * Halaman pembuatan produk LMS.
 */
import { redirect } from 'next/navigation'
import { getLmsProductSalesData } from '@/modules/ecommerce/lib/lms-sales.server'
import ProductEditor from '../../ProductEditor'

function safeReturnTo(value: string | undefined) {
  return value?.startsWith('/lms/admin/penjualan')
    ? value
    : '/lms/admin/penjualan'
}

export default async function NewLmsProductPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const [data, query] = await Promise.all([
    getLmsProductSalesData(),
    searchParams,
  ])
  if (data.stores.length === 0) redirect('/lms/admin/penjualan')

  return (
    <ProductEditor
      orgSlug={data.org.slug}
      primaryLmsHostname={data.primaryLmsHostname}
      stores={data.stores}
      courses={data.learningCourses}
      packages={data.accessPackages}
      batches={data.batches}
      initialProduct={null}
      initialEntitlement={null}
      returnTo={safeReturnTo(query.returnTo)}
    />
  )
}
