import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Next.js Middleware — Runs on every request.
 * Used for:
 * 1. Refreshing Supabase session (JWT refresh)
 * 2. RBAC / Protected Routes redirects
 */
export async function middleware(request: NextRequest) {
  // 1. Let Supabase handle session/auth
  const response = await updateSession(request)

  // 2. Inject current pathname into headers so Layout can read it
  // This allows the RBAC Path Guard to work.
  const url = new URL(request.url)
  response.headers.set('x-pathname', url.pathname)
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
