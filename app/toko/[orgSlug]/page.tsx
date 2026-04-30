import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCachedPublicStorefrontByOrgSlug } from '@/modules/ecommerce/lib/ecommerce.server'
import StorefrontClient from './StorefrontClient'

type PublicStorefrontPageProps = {
  params: Promise<{ orgSlug: string }>
}

export async function generateMetadata({ params }: PublicStorefrontPageProps): Promise<Metadata> {
  const { orgSlug } = await params
  const storefront = await getCachedPublicStorefrontByOrgSlug(orgSlug)

  if (!storefront) {
    return {
      title: 'Toko Tidak Ditemukan',
      description: 'Halaman toko yang Anda cari tidak tersedia.',
    }
  }

  return {
    title: `${storefront.org.name} Store`,
    description: 'Katalog online yang terhubung ke inventory, promo, dan follow-up quotation.',
    openGraph: {
      title: `${storefront.org.name} Store`,
      description: storefront.hero.subtitle,
      siteName: storefront.org.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${storefront.org.name} Store`,
      description: storefront.hero.subtitle,
    },
  }
}

export default async function PublicStorefrontPage({ params }: PublicStorefrontPageProps) {
  const { orgSlug } = await params
  const storefront = await getCachedPublicStorefrontByOrgSlug(orgSlug)

  if (!storefront) notFound()

  return <StorefrontClient storefront={storefront} />
}
