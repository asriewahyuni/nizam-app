import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicOrderStatusPayload } from '@/modules/ecommerce/lib/ecommerce.server'
import OrderStatusClient from './OrderStatusClient'

type OrderStatusPageProps = {
  params: Promise<{ orgSlug: string; storeSlug: string; orderNumber: string }>
  searchParams: Promise<{ token?: string }>
}

export async function generateMetadata({ params }: OrderStatusPageProps): Promise<Metadata> {
  const { orderNumber } = await params

  return {
    title: `Status Order ${orderNumber}`,
    description: 'Halaman publik untuk melihat status order dan upload bukti pembayaran.',
  }
}

export default async function OrderStatusPage({ params, searchParams }: OrderStatusPageProps) {
  const { orgSlug, storeSlug, orderNumber } = await params
  const { token } = await searchParams

  const payload = await getPublicOrderStatusPayload({
    orgSlug,
    storeSlug,
    orderNumber,
    accessToken: token || '',
  })

  if (!payload) notFound()

  return (
    <OrderStatusClient
      payload={payload}
      orgSlug={orgSlug}
      storeSlug={storeSlug}
      accessToken={token || ''}
    />
  )
}
