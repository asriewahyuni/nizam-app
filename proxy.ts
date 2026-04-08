import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const AUTH_PAGE_PREFIXES = ['/login', '/register', '/join', '/forgot-password', '/update-password']

const PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/admin',
  '/audit',
  '/billing',
  '/cash',
  '/contacts',
  '/factory',
  '/fleet',
  '/hris',
  '/pos',
  '/pricing',
  '/profil-saya',
  '/reports',
  '/services',
  '/settings',
  '/accounting',
  '/inventory',
  '/sales',
  '/purchasing',
  '/saas',
  '/onboarding',
]

const BYPASS_PREFIXES = ['/_next', '/api']
const BYPASS_EXACT_PATHS = new Set([
  '/favicon.ico',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
])

function isAuthPage(pathname: string) {
  return AUTH_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isProtectedPage(pathname: string) {
  return PROTECTED_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isBypassedPath(pathname: string) {
  return BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || BYPASS_EXACT_PATHS.has(pathname)
}

function normalizeRedirectTarget(rawPath: string | null) {
  if (!rawPath) return null
  const path = rawPath.trim()
  if (!path.startsWith('/') || path.startsWith('//')) return null
  if (isAuthPage(path)) return null
  return path
}

/**
 * Next.js Proxy — Runs on every request.
 * Uses NextAuth JWT token check (lightweight, no DB hit).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  if (isBypassedPath(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const authPage = isAuthPage(pathname)
  const protectedPage = isProtectedPage(pathname)

  // Avoid expensive auth lookup on public routes
  if (!authPage && !protectedPage) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Use JWT-based token check — lightweight, no DB hit
  const isSecureCookie = request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production'
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    secureCookie: isSecureCookie,
    cookieName: isSecureCookie ? '__Secure-authjs.session-token' : 'authjs.session-token',
  })

  const isAuthenticated = !!token

  // Auth pages: redirect to dashboard if already logged in
  if (authPage && isAuthenticated) {
    const redirectFromQuery = normalizeRedirectTarget(request.nextUrl.searchParams.get('redirectTo'))
    return NextResponse.redirect(new URL(redirectFromQuery || '/dashboard', request.url))
  }

  // Protected pages: redirect to login if not authenticated
  if (protectedPage && !isAuthenticated) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', `${pathname}${search}`)
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\..*$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
