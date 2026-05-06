import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCachedPublicStorefrontPayload } from '@/modules/ecommerce/lib/ecommerce.server'
import StorefrontClient from '../../StorefrontClient'

type ProductPageProps = {
  params: Promise<{ orgSlug: string; storeSlug: string; productSlug: string }>
  searchParams: Promise<{ preview?: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { orgSlug, storeSlug, productSlug } = await params
  const payload = await getCachedPublicStorefrontPayload(orgSlug, storeSlug)

  if (!payload) {
    return {
      title: 'Produk Tidak Ditemukan',
    }
  }

  const product = payload.products.find((item) => item.slug === productSlug)
  if (!product) {
    return {
      title: 'Produk Tidak Ditemukan',
    }
  }

  return {
    title: `${product.name} • ${payload.store.name}`,
    description: product.shortDescription || product.description || payload.store.subheadline,
  }
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { orgSlug, storeSlug, productSlug } = await params
  const { preview } = await searchParams
  const payload = await getCachedPublicStorefrontPayload(orgSlug, storeSlug, {
    previewToken: preview || null,
  })

  if (!payload) notFound()

  const product = payload.products.find((item) => item.slug === productSlug)
  if (!product) notFound()

  return <StorefrontClient payload={payload} pageMode="product" initialProductSlug={productSlug} />
}
