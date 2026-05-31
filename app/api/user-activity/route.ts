/**
 * API aktivitas user.
 * - POST: dipakai tracker route dari dashboard user.
 * - GET: dipakai Bob untuk melihat ringkasan aktivitas lintas tenant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getInternalAuthSession } from '@/lib/auth/internal-auth.server'
import { getUserActivitySnapshot, recordUserActivity } from '@/lib/activity/user-activity.server'
import { isPlatformAdminEmail } from '@/lib/saas/platform-admin'
import { ACTIVE_BRANCH_COOKIE, ACTIVE_ORG_COOKIE } from '@/modules/organization/lib/org-context'

function normalizePathname(value: unknown) {
  if (typeof value !== 'string') return null
  const pathname = value.trim()
  if (!pathname || !pathname.startsWith('/')) return null
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) return null
  return pathname
}

function normalizeSearch(value: unknown) {
  if (typeof value !== 'string') return null
  const search = value.trim()
  if (!search || search === '?') return null
  return search.startsWith('?') ? search : `?${search}`
}

function resolveClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  const realIp = request.headers.get('x-real-ip')?.trim()
  return realIp || null
}

export async function GET() {
  try {
    const session = await getInternalAuthSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isPlatformAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const snapshot = await getUserActivitySnapshot()

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.warn('[user-activity GET] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
  const session = await getInternalAuthSession()

  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const eventType = body?.eventType === 'heartbeat' ? 'heartbeat' : 'route_view'
  const pathname = normalizePathname(body?.pathname)
  const search = normalizeSearch(body?.search)

  if (!pathname) {
    return NextResponse.json({ ok: true, skipped: true }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }

  const result = await recordUserActivity({
    session,
    eventType,
    pathname,
    search,
    activeOrgId: request.cookies.get(ACTIVE_ORG_COOKIE)?.value || null,
    activeBranchId: request.cookies.get(ACTIVE_BRANCH_COOKIE)?.value || null,
    userAgent: request.headers.get('user-agent'),
    ipAddress: resolveClientIp(request),
  })

  return NextResponse.json({ ok: true, skipped: result.skipped }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
  } catch (err) {
    console.warn('[user-activity POST] Error:', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
