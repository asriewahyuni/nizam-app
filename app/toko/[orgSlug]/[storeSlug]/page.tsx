import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCachedPublicStorefrontPayload } from '@/modules/ecommerce/lib/ecommerce.server'
import StorefrontClient from './StorefrontClient'

type StorefrontPageProps = {
  params: Promise<{ orgSlug: string; storeSlug: string }>
  searchParams: Promise<{ preview?: string }>
}

export async function generateMetadata({ params }: StorefrontPageProps): Promise<Metadata> {
  const { orgSlug, storeSlug } = await params
  const payload = await getCachedPublicStorefrontPayload(orgSlug, storeSlug)

  if (!payload) {
    return {
      title: 'Store Tidak Ditemukan',
    }
  }

  return {
    title: payload.store.seoTitle || payload.store.name,
    description: payload.store.seoDescription || payload.store.subheadline,
  }
}

export default async function StorefrontPage({ params, searchParams }: StorefrontPageProps) {
  const { orgSlug, storeSlug } = await params
  const { preview } = await searchParams

  const payload = await getCachedPublicStorefrontPayload(orgSlug, storeSlug, {
    previewToken: preview || null,
  })

  if (!payload) notFound()

  return <StorefrontClient payload={payload} pageMode="home" />
}
