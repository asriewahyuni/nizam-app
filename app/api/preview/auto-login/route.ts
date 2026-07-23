/**
 * /api/preview/auto-login/route.ts
 * Preview mode auto-login — creates session for bob@executive.id
 * Only active when PREVIEW_MODE=true (dev/tunnel only, never in production)
 */
import { NextResponse } from 'next/server'
import { queryPostgres } from '@/lib/db/postgres'
import { createInternalAuthSessionByUserId } from '@/lib/auth/internal-auth.server'
import { INTERNAL_AUTH_SESSION_COOKIE, INTERNAL_AUTH_SESSION_MAX_AGE } from '@/lib/auth/internal-auth.shared'

const PREVIEW_EMAIL = 'bob@executive.id'

export async function GET(request: Request) {
  // Safety: only works in preview mode
  if (process.env.PREVIEW_MODE !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  try {
    // Look up bob's internal user ID by email
    const result = await queryPostgres<{ id: string }>(
      `SELECT id::text FROM public.internal_auth_users WHERE LOWER(login_email) = LOWER($1) LIMIT 1`,
      [PREVIEW_EMAIL]
    )

    const userRow = result.rows[0]
    if (!userRow?.id) {
      console.error('[preview/auto-login] User not found:', PREVIEW_EMAIL)
      return NextResponse.json({ error: 'Preview user not found' }, { status: 500 })
    }

    // Create session
    const sessionResult = await createInternalAuthSessionByUserId(userRow.id, {
      includeToken: true,
    })
    if (!('success' in sessionResult) || !sessionResult.success) {
      const sessionError = 'error' in sessionResult
        ? sessionResult.error
        : 'Preview session creation failed'
      console.error('[preview/auto-login] Session creation failed:', sessionError)
      return NextResponse.json({ error: sessionError }, { status: 500 })
    }

    // Set session cookie and redirect
    // Use Host header so cloudflared tunnel URL is preserved, not rewritten to 0.0.0.0
    const requestUrl = new URL(request.url)
    const host = request.headers.get('host') || requestUrl.host
    const protocol =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
      requestUrl.protocol.replace(':', '')
    const baseUrl = `${protocol}://${host}`
    const redirectUrl = new URL(redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`, baseUrl)

    const response = NextResponse.redirect(redirectUrl)
    const sessionToken = sessionResult.sessionToken
    if (!sessionToken) {
      return NextResponse.json({ error: 'Preview session token missing' }, { status: 500 })
    }
    response.cookies.set(INTERNAL_AUTH_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: INTERNAL_AUTH_SESSION_MAX_AGE,
    })

    console.log(`[preview/auto-login] Auto-logged in as ${PREVIEW_EMAIL} → ${redirectTo}`)
    return response
  } catch (error: any) {
    console.error('[preview/auto-login] Error:', error.message)
    return NextResponse.json({ error: 'Auto-login failed' }, { status: 500 })
  }
}
