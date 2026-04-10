import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicConfig } from '@/lib/supabase/config'
import { getAuthProvider } from '@/lib/auth/provider'
import { INTERNAL_AUTH_SESSION_COOKIE } from '@/lib/auth/internal-auth.shared'
import type { Database } from '@/types/database.types'

const AUTH_PAGE_PREFIXES = ['/login', '/register']

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

  // Prevent open redirects (e.g. //evil.com or https://evil.com)
  if (!path.startsWith('/') || path.startsWith('//')) return null
  if (isAuthPage(path)) return null

  return path
}

/**
 * Supabase middleware — runs on every request.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  if (isBypassedPath(pathname)) {
    return supabaseResponse
  }

  let publicConfig: ReturnType<typeof getSupabasePublicConfig> | null = null

  try {
    publicConfig = getSupabasePublicConfig()
  } catch {
    return supabaseResponse
  }

  const authPage = isAuthPage(pathname)
  const protectedPage = isProtectedPage(pathname)

  // Avoid expensive auth lookup on public routes.
  if (!authPage && !protectedPage) {
    return supabaseResponse
  }

  if (getAuthProvider() === 'internal') {
    const hasInternalSession = Boolean(
      request.cookies.get(INTERNAL_AUTH_SESSION_COOKIE)?.value?.trim()
    )

    if (authPage && hasInternalSession) {
      const redirectFromQuery = normalizeRedirectTarget(request.nextUrl.searchParams.get('redirectTo'))
      let redirectFromReferer: string | null = null

      const referer = request.headers.get('referer')
      if (referer) {
        try {
          const refererUrl = new URL(referer)
          if (refererUrl.origin === request.nextUrl.origin) {
            redirectFromReferer = normalizeRedirectTarget(`${refererUrl.pathname}${refererUrl.search}`)
          }
        } catch {
          // Ignore malformed referer
        }
      }

      return NextResponse.redirect(new URL(redirectFromQuery || redirectFromReferer || '/dashboard', request.url))
    }

    if (protectedPage && !hasInternalSession) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirectTo', `${pathname}${search}`)
      return NextResponse.redirect(redirectUrl)
    }

    return supabaseResponse
  }

  const supabase = createServerClient<Database>(
    publicConfig.url,
    publicConfig.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Auth pages: redirect to dashboard if already logged in
  if (authPage && user) {
    const redirectFromQuery = normalizeRedirectTarget(request.nextUrl.searchParams.get('redirectTo'))
    let redirectFromReferer: string | null = null

    const referer = request.headers.get('referer')
    if (referer) {
      try {
        const refererUrl = new URL(referer)
        if (refererUrl.origin === request.nextUrl.origin) {
          redirectFromReferer = normalizeRedirectTarget(`${refererUrl.pathname}${refererUrl.search}`)
        }
      } catch {
        // Ignore malformed referer
      }
    }

    return NextResponse.redirect(new URL(redirectFromQuery || redirectFromReferer || '/dashboard', request.url))
  }

  // Protected pages: redirect to login if not authenticated
  if (protectedPage && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', `${pathname}${search}`)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
