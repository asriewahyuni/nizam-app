import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  getPublicOrderStatusPayload,
  resolvePublicStoreCanonicalTarget,
} from '@/modules/ecommerce/lib/ecommerce.server'
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
  const canonical = await resolvePublicStoreCanonicalTarget({ orgSlug, storeSlug })
  if (!canonical) notFound()
  if (canonical.storeSlug !== storeSlug) {
    const query = token ? `?token=${encodeURIComponent(token)}` : ''
    permanentRedirect(`/toko/${orgSlug}/${canonical.storeSlug}/pesanan/${orderNumber}${query}`)
  }

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
