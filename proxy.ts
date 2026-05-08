import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const NEXT_ACTION_HEADER = 'next-action'

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
  const shouldAttemptStoreRewrite = Boolean(
    normalizedHost
    && !pathname.startsWith('/toko')
    && !pathname.startsWith('/dashboard')
    && !pathname.startsWith('/ecommerce')
    && !pathname.startsWith('/login')
    && !pathname.startsWith('/register')
    && !pathname.startsWith('/onboarding')
    && !pathname.startsWith('/auth')
    && !pathname.startsWith('/expired')
  )

  if (shouldAttemptStoreRewrite) {
    try {
      const resolveUrl = new URL('/api/ecommerce/resolve-domain', request.url)
      resolveUrl.searchParams.set('host', normalizedHost)

      const response = await fetch(resolveUrl, { cache: 'no-store' })
      if (response.ok) {
        const payload = await response.json()
        const orgSlug = String(payload?.data?.orgSlug || '').trim()
        const storeSlug = String(payload?.data?.storeSlug || '').trim()

        if (orgSlug && storeSlug) {
          const rewriteUrl = request.nextUrl.clone()
          rewriteUrl.pathname = `/toko/${orgSlug}/${storeSlug}${pathname === '/' ? '' : pathname}`
          return NextResponse.rewrite(rewriteUrl)
        }
      }
    } catch {
      // Jika resolver gagal, biarkan request lanjut ke flow normal.
    }
  }

  return updateSession(request)
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
