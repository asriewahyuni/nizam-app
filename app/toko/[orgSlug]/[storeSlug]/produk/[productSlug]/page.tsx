import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  getCachedPublicStorefrontPayload,
  resolvePublicStoreCanonicalTarget,
} from '@/modules/ecommerce/lib/ecommerce.server'
import {
  resolveCurrentLmsTenantDomain,
  resolveLmsTenantDomain,
} from '@/modules/ecommerce/domains/lms-domain.server'
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
    title: product.seoTitle || `${product.name} • ${payload.store.name}`,
    description: product.seoDescription || product.shortDescription || product.description || payload.store.subheadline,
  }
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { orgSlug, storeSlug, productSlug } = await params
  const { preview } = await searchParams
  const canonical = await resolvePublicStoreCanonicalTarget({
    orgSlug,
    storeSlug,
    productSlug,
  })
  if (!canonical) notFound()
  if (
    canonical.storeSlug !== storeSlug
    || canonical.productSlug !== productSlug
  ) {
    const requestHeaders = await headers()
    const hostname = String(
      requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '',
    ).split(',')[0].trim()
    let tenant = null
    try {
      tenant = await resolveLmsTenantDomain(hostname)
    } catch {
      // Domain custom belum tentu aktif pada environment lokal.
    }
    permanentRedirect(
      tenant?.orgSlug === orgSlug
        ? `/product/${canonical.productSlug}`
        : `/store/${orgSlug}/${canonical.storeSlug}/product/${canonical.productSlug}`,
    )
  }
  const payload = await getCachedPublicStorefrontPayload(orgSlug, storeSlug, {
    previewToken: preview || null,
  })

  if (!payload) notFound()

  const product = payload.products.find((item) => item.slug === productSlug)
  if (!product) notFound()
  const currentTenant = await resolveCurrentLmsTenantDomain()

  return (
    <StorefrontClient
      payload={payload}
      pageMode="product"
      initialProductSlug={productSlug}
      routeMode={currentTenant?.orgSlug === orgSlug ? 'custom-domain' : 'standard'}
    />
  )
}
