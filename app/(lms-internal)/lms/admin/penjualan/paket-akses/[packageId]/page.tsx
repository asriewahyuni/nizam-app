/**
 * Halaman perubahan Paket Akses.
 */
import { notFound } from 'next/navigation'
import { getLmsAccessPackageSalesData } from '@/modules/ecommerce/lib/lms-sales.server'
import AccessPackageEditor from '../../AccessPackageEditor'

function safeReturnTo(value?: string) {
  return value?.startsWith('/lms/admin/penjualan/paket-akses')
    ? value
    : '/lms/admin/penjualan/paket-akses'
}

export default async function EditAccessPackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ packageId: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const [{ packageId }, query, data] = await Promise.all([params, searchParams, getLmsAccessPackageSalesData()])
  const accessPackage = data.accessPackages.find((item) => item.id === packageId)
  if (!accessPackage) notFound()
  return <AccessPackageEditor initialPackage={accessPackage} courses={data.learningCourses} returnTo={safeReturnTo(query.returnTo)} />
}
