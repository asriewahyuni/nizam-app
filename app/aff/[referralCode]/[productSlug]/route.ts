/**
 * Link pendek afiliasi: /aff/{referral_code}/{product-slug}
 * Hanya berfungsi di custom domain terverifikasi (org/store diresolve dari
 * hostname). Redirect ke halaman produk dengan ?coupon={kode kupon afiliasi}
 * terisi otomatis — memakai mekanisme kupon (bukan cookie tracking terpisah)
 * supaya atribusi komisi otomatis ikut saat kupon dipakai di checkout.
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'
import { normalizeLmsHostname } from '@/modules/ecommerce/lib/lms-domain'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ referralCode: string; productSlug: string }> },
) {
  const { referralCode, productSlug } = await context.params
  const fallbackUrl = new URL(`/product/${encodeURIComponent(productSlug)}`, request.url)

  const hostname = normalizeLmsHostname(
    request.headers.get('x-forwarded-host') || request.headers.get('host') || '',
  )
  if (!hostname || !referralCode || !productSlug) {
    return NextResponse.redirect(fallbackUrl)
  }

  const tenantResult = await queryPostgres<{ org_slug: string }>(
    'SELECT org_slug FROM public.resolve_lms_tenant_domain($1)',
    [hostname],
  )
  const orgSlug = tenantResult.rows[0]?.org_slug
  if (!orgSlug) {
    return NextResponse.redirect(fallbackUrl)
  }

  const productResult = await queryPostgres<{ public_slug: string }>(
    `SELECT store_product.public_slug
     FROM public.store_products store_product
     JOIN public.organizations org ON org.id = store_product.org_id
     WHERE org.slug = $1
       AND lower(store_product.public_slug) = lower($2)
       AND store_product.is_published = TRUE
     LIMIT 1`,
    [orgSlug, productSlug],
  )
  const resolvedSlug = productResult.rows[0]?.public_slug
  if (!resolvedSlug) {
    return NextResponse.redirect(fallbackUrl)
  }

  const couponResult = await queryPostgres<{ code: string }>(
    `SELECT coupon.code
     FROM public.commerce_affiliate_profiles profile
     JOIN public.commerce_coupons coupon
       ON coupon.org_id = profile.org_id
      AND coupon.affiliate_profile_id = profile.id
      AND coupon.is_active = TRUE
     WHERE profile.org_id = (SELECT id FROM public.organizations WHERE slug = $1 LIMIT 1)
       AND lower(profile.referral_code) = lower($2)
       AND profile.status = 'ACTIVE'
     ORDER BY coupon.source_coupon_id NULLS FIRST, coupon.created_at DESC
     LIMIT 1`,
    [orgSlug, referralCode],
  )
  const couponCode = couponResult.rows[0]?.code
  if (!couponCode) {
    return NextResponse.redirect(fallbackUrl)
  }

  const targetUrl = new URL(`/product/${encodeURIComponent(resolvedSlug)}`, request.url)
  targetUrl.searchParams.set('coupon', couponCode)
  return NextResponse.redirect(targetUrl)
}
