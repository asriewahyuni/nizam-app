/**
 * Halaman pembuatan Paket Akses.
 */
import { getLmsAccessPackageSalesData } from '@/modules/ecommerce/lib/lms-sales.server'
import AccessPackageEditor from '../../AccessPackageEditor'

function safeReturnTo(value?: string) {
  return value?.startsWith('/lms/admin/penjualan/paket-akses')
    ? value
    : '/lms/admin/penjualan/paket-akses'
}

export default async function NewAccessPackagePage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [data, query] = await Promise.all([getLmsAccessPackageSalesData(), searchParams])
  return <AccessPackageEditor initialPackage={null} courses={data.learningCourses} returnTo={safeReturnTo(query.returnTo)} />
}
