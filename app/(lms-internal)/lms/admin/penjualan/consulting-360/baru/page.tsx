/**
 * Halaman pembuatan Consulting 360.
 */
import { redirect } from 'next/navigation'
import { getLmsConsultingSalesData } from '@/modules/ecommerce/lib/lms-sales.server'
import Consulting360Manager from '../../Consulting360Manager'

function safeReturnTo(value?: string) {
  return value?.startsWith('/lms/admin/penjualan/consulting-360')
    ? value
    : '/lms/admin/penjualan/consulting-360'
}

export default async function NewConsulting360Page({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [data, query] = await Promise.all([getLmsConsultingSalesData(), searchParams])
  if (data.dashboard.stores.length === 0) redirect('/lms/admin/penjualan')
  return <Consulting360Manager dashboardData={data.dashboard} overview={data.overview} showList={false} editorMode returnTo={safeReturnTo(query.returnTo)} />
}
