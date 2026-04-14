import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Next.js Middleware — Runs on every request.
 * Used for:
 * 1. Domain Redirects (nizam.xales.id -> kliknizam.app)
 * 2. Refreshing Supabase session (JWT refresh)
 */
export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')

  // Legacy domain redirect: nizam.xales.id ke kliknizam.app
  if (host === 'nizam.xales.id') {
    return NextResponse.redirect('https://kliknizam.app', 301)
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
