import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  getCachedPublicStorefrontPayload,
  resolvePublicStoreCanonicalTarget,
} from '@/modules/ecommerce/lib/ecommerce.server'
import { resolveCurrentLmsTenantDomain } from '@/modules/ecommerce/domains/lms-domain.server'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
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
  const canonical = await resolvePublicStoreCanonicalTarget({ orgSlug, storeSlug })
  if (!canonical) notFound()
  if (canonical.storeSlug !== storeSlug) {
    permanentRedirect(`/store/${orgSlug}/${canonical.storeSlug}/cart`)
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
      pageMode="cart"
      routeMode={tenant?.orgSlug === orgSlug ? 'custom-domain' : 'standard'}
      viewerAuthenticated={Boolean(session)}
      viewerUser={viewerUser}
    />
  )
}
