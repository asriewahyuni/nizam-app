import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  getCachedPublicStorefrontPayload,
  resolvePublicStoreCanonicalTarget,
} from '@/modules/ecommerce/lib/ecommerce.server'
import { resolveCurrentLmsTenantDomain } from '@/modules/ecommerce/domains/lms-domain.server'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
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
  const canonical = await resolvePublicStoreCanonicalTarget({ orgSlug, storeSlug })
  if (!canonical) notFound()
  if (canonical.storeSlug !== storeSlug) {
    permanentRedirect(`/store/${orgSlug}/${canonical.storeSlug}/catalog`)
  }
  const payload = await getCachedPublicStorefrontPayload(orgSlug, storeSlug, {
    previewToken: preview || null,
  })

  if (!payload) notFound()
  const [tenant, session] = await Promise.all([
    resolveCurrentLmsTenantDomain(),
    getInternalAuthSession(),
  ])

  const viewerUser = session?.user
    ? {
        name: String(session.user.user_metadata?.full_name || '') || null,
        email: session.user.email || null,
        phone: String(session.user.user_metadata?.login_nik || '') || null,
      }
    : null

  return (
    <StorefrontClient
      payload={payload}
      pageMode="collection"
      routeMode={tenant?.orgSlug === orgSlug ? 'custom-domain' : 'standard'}
      viewerAuthenticated={Boolean(session)}
      viewerUser={viewerUser}
    />
  )
}
