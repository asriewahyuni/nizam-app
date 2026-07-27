import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { queryPostgres } from '@/lib/db/postgres'
import { normalizeLmsHostname } from '@/modules/ecommerce/lib/lms-domain'

const NEXT_ACTION_HEADER = 'next-action'
const INTERNAL_SESSION_COOKIE = 'nizam_internal_session'
const ERP_ONLY_PREFIXES = [
  '/ecommerce',
  '/lms/admin',
]

function isServerActionRequest(request: NextRequest) {
  return request.headers.has(NEXT_ACTION_HEADER)
}

function createServerActionRedirectResponse(target: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-action-redirect': `${target};replace`,
      location: target,
    },
  })
}

type ResolvedLmsTenant = {
  orgSlug: string
  storeSlug: string | null
  rootBehavior: 'STOREFRONT' | 'LOGIN'
}

/**
 * Resolusi tenant langsung ke Postgres (bukan self-fetch HTTP ke /api/lms/resolve-domain).
 * Proxy berjalan di Node.js runtime secara default (bukan Edge), jadi query DB langsung
 * di sini aman — dan menghindari round-trip HTTP proxy memanggil dirinya sendiri lewat
 * domain publiknya sendiri, yang rapuh khusus untuk custom domain (DNS/SSL/CDN).
 */
async function resolveLmsTenant(host: string): Promise<ResolvedLmsTenant | null> {
  const hostname = normalizeLmsHostname(host)
  if (!hostname) return null

  try {
    const { rows } = await queryPostgres<{
      org_slug: string
      store_slug: string | null
      root_behavior: 'STOREFRONT' | 'LOGIN'
    }>(
      'SELECT org_slug, store_slug, root_behavior FROM public.resolve_lms_tenant_domain($1)',
      [hostname],
    )
    const row = rows[0]
    const orgSlug = String(row?.org_slug || '').trim()
    if (!orgSlug) return null

    return {
      orgSlug,
      storeSlug: String(row?.store_slug || '').trim() || null,
      rootBehavior: row?.root_behavior === 'STOREFRONT' ? 'STOREFRONT' : 'LOGIN',
    }
  } catch {
    return null
  }
}

function rewriteStandardStorePath(
  pathname: string,
): { kind: 'rewrite'; pathname: string } | { kind: 'redirect'; pathname: string } | null {
  const legacyMatch = pathname.match(/^\/toko\/([^/]+)\/([^/]+)(\/.*)?$/)
  if (legacyMatch) {
    const [, orgSlug, storeSlug, rawSuffix = ''] = legacyMatch
    let suffix = rawSuffix
    if (suffix === '/koleksi') suffix = '/catalog'
    else if (suffix === '/keranjang') suffix = '/cart'
    else if (suffix.startsWith('/produk/')) suffix = `/product/${suffix.slice('/produk/'.length)}`
    else if (suffix.startsWith('/pesanan/')) suffix = `/order/${suffix.slice('/pesanan/'.length)}`
    return {
      kind: 'redirect',
      pathname: `/store/${orgSlug}/${storeSlug}${suffix}`,
    }
  }

  const canonicalMatch = pathname.match(/^\/store\/([^/]+)\/([^/]+)(\/.*)?$/)
  if (!canonicalMatch) return null
  const [, orgSlug, storeSlug, rawSuffix = ''] = canonicalMatch
  let suffix = rawSuffix
  if (suffix === '/catalog') suffix = '/koleksi'
  else if (suffix === '/cart') suffix = '/keranjang'
  else if (suffix.startsWith('/product/')) suffix = `/produk/${suffix.slice('/product/'.length)}`
  else if (suffix.startsWith('/order/')) suffix = `/pesanan/${suffix.slice('/order/'.length)}`
  return {
    kind: 'rewrite',
    pathname: `/toko/${orgSlug}/${storeSlug}${suffix}`,
  }
}

function rewriteTenantPath(
  pathname: string,
  tenant: ResolvedLmsTenant,
): { kind: 'rewrite'; pathname: string } | { kind: 'redirect'; pathname: string } | null {
  const orgRoot = `/member/${tenant.orgSlug}`
  const storeRoot = tenant.storeSlug
    ? `/toko/${tenant.orgSlug}/${tenant.storeSlug}`
    : null

  if (storeRoot && (pathname === storeRoot || pathname === `${storeRoot}/`)) {
    return { kind: 'redirect', pathname: '/' }
  }
  if (storeRoot && pathname === `${storeRoot}/koleksi`) {
    return { kind: 'redirect', pathname: '/catalog' }
  }
  if (storeRoot && pathname === `${storeRoot}/keranjang`) {
    return { kind: 'redirect', pathname: '/cart' }
  }
  if (storeRoot && pathname.startsWith(`${storeRoot}/produk/`)) {
    return {
      kind: 'redirect',
      pathname: `/product/${pathname.slice(`${storeRoot}/produk/`.length)}`,
    }
  }
  if (storeRoot && pathname.startsWith(`${storeRoot}/pesanan/`)) {
    return {
      kind: 'redirect',
      pathname: `/order/${pathname.slice(`${storeRoot}/pesanan/`.length)}`,
    }
  }
  if (pathname === orgRoot || pathname === `${orgRoot}/`) {
    return { kind: 'redirect', pathname: '/dashboard' }
  }
  const legacyMemberRoutes: Record<string, string> = {
    [`${orgRoot}/katalog`]: '/courses',
    [`${orgRoot}/kelas`]: '/my-courses',
    [`${orgRoot}/pesanan`]: '/orders',
    [`${orgRoot}/langganan`]: '/subscriptions',
    [`${orgRoot}/konsultasi`]: '/consulting',
    [`${orgRoot}/sertifikat`]: '/certificates',
    [`${orgRoot}/profil`]: '/profile',
    [`${orgRoot}/afiliasi`]: '/affiliate',
    [`${orgRoot}/tutor`]: '/tutor',
    [`${orgRoot}/tutor/konsultasi`]: '/tutor/consulting',
  }
  if (legacyMemberRoutes[pathname]) {
    return { kind: 'redirect', pathname: legacyMemberRoutes[pathname] }
  }
  const legacyCourseRoot = `/lms/${tenant.orgSlug}/course/`
  if (pathname.startsWith(legacyCourseRoot)) {
    return {
      kind: 'redirect',
      pathname: `/course/${pathname.slice(legacyCourseRoot.length)}`,
    }
  }
  const legacyLearnRoot = `/lms/${tenant.orgSlug}/learn/`
  if (pathname.startsWith(legacyLearnRoot)) {
    return {
      kind: 'redirect',
      pathname: `/learn/${pathname.slice(legacyLearnRoot.length)}`,
    }
  }

  if (pathname === '/') {
    if (tenant.rootBehavior === 'STOREFRONT' && storeRoot) {
      return { kind: 'rewrite', pathname: storeRoot }
    }
    return null
  }

  if (pathname === '/catalog' && storeRoot) {
    return { kind: 'rewrite', pathname: `${storeRoot}/koleksi` }
  }
  if (pathname === '/cart' && storeRoot) {
    return { kind: 'rewrite', pathname: `${storeRoot}/keranjang` }
  }
  if (pathname.startsWith('/product/') && storeRoot) {
    return {
      kind: 'rewrite',
      pathname: `${storeRoot}/produk/${pathname.slice('/product/'.length)}`,
    }
  }
  if (pathname.startsWith('/produk/') && storeRoot) {
    return {
      kind: 'redirect',
      pathname: `/product/${pathname.slice('/produk/'.length)}`,
    }
  }
  const legacyCleanMemberRoutes: Record<string, string> = {
    '/katalog': '/courses',
    '/kelas': '/my-courses',
    '/pesanan': '/orders',
    '/langganan': '/subscriptions',
    '/konsultasi': '/consulting',
    '/sertifikat': '/certificates',
    '/profil': '/profile',
    '/afiliasi': '/affiliate',
  }
  if (legacyCleanMemberRoutes[pathname]) {
    return { kind: 'redirect', pathname: legacyCleanMemberRoutes[pathname] }
  }
  if (pathname.startsWith('/order/') && storeRoot) {
    return {
      kind: 'rewrite',
      pathname: `${storeRoot}/pesanan/${pathname.slice('/order/'.length)}`,
    }
  }

  if (pathname === '/dashboard') {
    return { kind: 'rewrite', pathname: orgRoot }
  }
  if (pathname === '/courses') {
    return { kind: 'rewrite', pathname: `${orgRoot}/katalog` }
  }
  if (pathname === '/my-courses') {
    return { kind: 'rewrite', pathname: `${orgRoot}/kelas` }
  }
  if (pathname.startsWith('/course/')) {
    return {
      kind: 'rewrite',
      pathname: `/lms/${tenant.orgSlug}/course/${pathname.slice('/course/'.length)}`,
    }
  }
  if (pathname.startsWith('/learn/')) {
    return {
      kind: 'rewrite',
      pathname: `/lms/${tenant.orgSlug}/learn/${pathname.slice('/learn/'.length)}`,
    }
  }

  const memberRoutes: Record<string, string> = {
    '/orders': 'pesanan',
    '/subscriptions': 'langganan',
    '/consulting': 'konsultasi',
    '/certificates': 'sertifikat',
    '/profile': 'profil',
    '/affiliate': 'afiliasi',
    '/tutor': 'tutor',
  }
  const exactMemberRoute = memberRoutes[pathname]
  if (exactMemberRoute) {
    return { kind: 'rewrite', pathname: `${orgRoot}/${exactMemberRoute}` }
  }
  if (pathname === '/tutor/consulting') {
    return { kind: 'rewrite', pathname: `${orgRoot}/tutor/konsultasi` }
  }
  if (pathname.startsWith('/tutor/')) {
    return {
      kind: 'rewrite',
      pathname: `${orgRoot}/tutor/${pathname.slice('/tutor/'.length)}`,
    }
  }
  if (pathname.startsWith('/certificate/verify/')) {
    return {
      kind: 'rewrite',
      pathname: `${orgRoot}/sertifikat/verifikasi/${pathname.slice('/certificate/verify/'.length)}`,
    }
  }

  return null
}

/**
 * Preview mode auto-login — only active when PREVIEW_MODE=true.
 * Redirects unauthenticated users to /api/preview/auto-login
 * which creates a session for bob@executive.id automatically.
 */
function handlePreviewAutoLogin(request: NextRequest): NextResponse | null {
  if (process.env.PREVIEW_MODE !== 'true') return null

  const { pathname } = request.nextUrl

  // Skip API routes, login/register pages, static assets
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/_next')
  ) return null

  // Already has session
  if (request.cookies.has(INTERNAL_SESSION_COOKIE)) return null

  // Redirect to auto-login
  const loginUrl = new URL('/api/preview/auto-login', request.url)
  loginUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(loginUrl)
}

/**
 * Next.js Proxy — Runs on every request.
 * Replaces the deprecated middleware.ts convention (Next.js 16+).
 * Used for:
 * 1. Domain Redirects (nizam.xales.id -> kliknizam.app)
 * 2. Refreshing Supabase session (JWT refresh)
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get('host')
  const serverActionRequest = isServerActionRequest(request)
  const pathname = request.nextUrl.pathname

  // Legacy domain redirect: nizam.xales.id ke kliknizam.app
  if (host === 'nizam.xales.id') {
    if (serverActionRequest) {
      return createServerActionRedirectResponse('https://kliknizam.app')
    }
    return NextResponse.redirect('https://kliknizam.app', 301)
  }

  const normalizedHost = String(host || '').trim().toLowerCase().split(':')[0]
  const shouldResolveLmsTenant = Boolean(
    normalizedHost
    && !pathname.startsWith('/login')
    && !pathname.startsWith('/register')
    && !pathname.startsWith('/auth')
    && !pathname.startsWith('/expired')
    && !pathname.startsWith('/onboarding')
  )

  if (shouldResolveLmsTenant) {
    try {
      const tenant = await resolveLmsTenant(normalizedHost)

      if (tenant) {
        const { orgSlug, storeSlug, rootBehavior } = tenant

        if (ERP_ONLY_PREFIXES.some((prefix) => (
          pathname === prefix || pathname.startsWith(`${prefix}/`)
        ))) {
          return new NextResponse('Halaman tidak ditemukan.', { status: 404 })
        }

        if (pathname === '/' && rootBehavior === 'LOGIN') {
          const target = request.cookies.has(INTERNAL_SESSION_COOKIE)
            ? '/dashboard'
            : '/login?redirectTo=%2Fdashboard'
          if (serverActionRequest) {
            return createServerActionRedirectResponse(target)
          }
          return NextResponse.redirect(new URL(target, request.url))
        }

        const route = rewriteTenantPath(pathname, {
          orgSlug,
          storeSlug,
          rootBehavior,
        })
        if (route?.kind === 'redirect') {
          const redirectUrl = request.nextUrl.clone()
          redirectUrl.pathname = route.pathname
          return NextResponse.redirect(redirectUrl, 308)
        }
        if (route?.kind === 'rewrite') {
          const rewriteUrl = request.nextUrl.clone()
          rewriteUrl.pathname = route.pathname
          return NextResponse.rewrite(rewriteUrl)
        }
      }
    } catch {
      // Resolver tenant tidak boleh membuat platform utama gagal.
    }
  }

  const standardStoreRoute = rewriteStandardStorePath(pathname)
  if (standardStoreRoute?.kind === 'redirect') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = standardStoreRoute.pathname
    return NextResponse.redirect(redirectUrl, 308)
  }
  if (standardStoreRoute?.kind === 'rewrite') {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = standardStoreRoute.pathname
    return NextResponse.rewrite(rewriteUrl)
  }

  // Preview mode auto-login (only when PREVIEW_MODE=true)
  const previewRedirect = handlePreviewAutoLogin(request)
  if (previewRedirect) return previewRedirect

  const response = await updateSession(request)

  const refParam = request.nextUrl.searchParams.get('ref')
  if (refParam && typeof refParam === 'string' && refParam.trim()) {
    response.cookies.set('nizam_aff_ref', refParam.trim(), {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
      httpOnly: false, // Accessible on client & server
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/webpack-hmr (dev HMR channel)
     * - metadata files (favicon, robots, sitemap, manifest)
     * - any file with an extension (e.g. .svg, .css, .js)
     */
    {
      source: '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\..*$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
