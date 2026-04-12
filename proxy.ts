import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Next.js Middleware — Runs on every request.
 * Used for:
 * 1. Refreshing Supabase session (JWT refresh)
 * 2. RBAC / Protected Routes redirects
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get('host')
  const legacyDomains = ['nizam.xales.id', 'nizam.up.railway.app']

  if (host && legacyDomains.includes(host)) {
    const url = request.nextUrl.clone()
    url.host = 'brain.kliknizam.app'
    url.port = ''
    url.protocol = 'https:'
    return NextResponse.redirect(url, 301)
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
     * Feel free to modify this pattern to include more paths.
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
