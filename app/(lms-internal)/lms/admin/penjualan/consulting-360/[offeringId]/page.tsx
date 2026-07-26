/**
 * Halaman perubahan Consulting 360.
 */
import { notFound } from 'next/navigation'
import { getLmsConsultingSalesData } from '@/modules/ecommerce/lib/lms-sales.server'
import Consulting360Manager from '../../Consulting360Manager'

function safeReturnTo(value?: string) {
  return value?.startsWith('/lms/admin/penjualan/consulting-360')
    ? value
    : '/lms/admin/penjualan/consulting-360'
}

export default async function EditConsulting360Page({
  params,
  searchParams,
}: {
  params: Promise<{ offeringId: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const [{ offeringId }, query, data] = await Promise.all([params, searchParams, getLmsConsultingSalesData()])
  const offering = data.overview.offerings.find((item) => item.id === offeringId)
  if (!offering) notFound()
  return <Consulting360Manager dashboardData={data.dashboard} overview={data.overview} initialOffering={offering} showList={false} editorMode returnTo={safeReturnTo(query.returnTo)} />
}
