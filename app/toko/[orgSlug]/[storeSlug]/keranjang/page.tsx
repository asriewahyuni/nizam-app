import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCachedPublicStorefrontPayload } from '@/modules/ecommerce/lib/ecommerce.server'
import StorefrontClient from '../StorefrontClient'

type CartPageProps = {
  params: Promise<{ orgSlug: string; storeSlug: string }>
  searchParams: Promise<{ preview?: string }>
}

export async function generateMetadata({ params }: CartPageProps): Promise<Metadata> {
  const { orgSlug, storeSlug } = await params
  const payload = await getCachedPublicStorefrontPayload(orgSlug, storeSlug)

  if (!payload) {
    return {
      title: 'Keranjang Tidak Ditemukan',
    }
  }

  return {
    title: `Keranjang • ${payload.store.name}`,
    description: `Lanjutkan pesanan Anda di ${payload.store.name}.`,
  }
}

export default async function CartPage({ params, searchParams }: CartPageProps) {
  const { orgSlug, storeSlug } = await params
  const { preview } = await searchParams
  const payload = await getCachedPublicStorefrontPayload(orgSlug, storeSlug, {
    previewToken: preview || null,
  })

  if (!payload) notFound()

  return <StorefrontClient payload={payload} pageMode="cart" />
}
