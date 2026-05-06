import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCachedPublicStorefrontPayload } from '@/modules/ecommerce/lib/ecommerce.server'
import StorefrontClient from '../StorefrontClient'

type CollectionPageProps = {
  params: Promise<{ orgSlug: string; storeSlug: string }>
  searchParams: Promise<{ preview?: string }>
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { orgSlug, storeSlug } = await params
  const payload = await getCachedPublicStorefrontPayload(orgSlug, storeSlug)

  if (!payload) {
    return {
      title: 'Koleksi Tidak Ditemukan',
    }
  }

  return {
    title: `Koleksi ${payload.store.name}`,
    description: payload.store.seoDescription || payload.store.subheadline,
  }
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const { orgSlug, storeSlug } = await params
  const { preview } = await searchParams
  const payload = await getCachedPublicStorefrontPayload(orgSlug, storeSlug, {
    previewToken: preview || null,
  })

  if (!payload) notFound()

  return <StorefrontClient payload={payload} pageMode="collection" />
}
