import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'

/**
 * Supabase middleware — runs on every request.
 */
export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return supabaseResponse
  }

  const supabase = createServerClient<Database>(
    url,
    key,
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

  const { pathname } = request.nextUrl

  // Auth pages: redirect to dashboard if already logged in
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protected pages: redirect to login if not authenticated
  const isProtectedPage =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/audit') ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/cash') ||
    pathname.startsWith('/contacts') ||
    pathname.startsWith('/factory') ||
    pathname.startsWith('/fleet') ||
    pathname.startsWith('/hris') ||
    pathname.startsWith('/pos') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/profil-saya') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/services') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/accounting') ||
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/sales') ||
    pathname.startsWith('/purchasing')

  if (isProtectedPage && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
