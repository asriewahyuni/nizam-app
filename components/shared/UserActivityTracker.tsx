'use client'

/**
 * Tracker ringan untuk merekam route yang sedang dipakai user.
 * Dipasang di layout dashboard agar semua halaman privat ikut tercatat.
 */

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const HEARTBEAT_INTERVAL_MS = 60_000
const ROUTE_VIEW_DEDUPE_MS = 10_000
const HEARTBEAT_DEDUPE_MS = 50_000

type TrackerEventType = 'route_view' | 'heartbeat'

async function postUserActivity(eventType: TrackerEventType, pathname: string, search: string | null) {
  try {
    await fetch('/api/user-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType,
        pathname,
        search,
      }),
      credentials: 'include',
      keepalive: true,
    })
  } catch {
    // Aktivitas ini bersifat best-effort, jadi kegagalan sengaja diabaikan.
  }
}

function shouldSkipBySessionStorage(storageKey: string, dedupeMs: number) {
  if (typeof window === 'undefined') return false

  try {
    const lastSentAt = Number(window.sessionStorage.getItem(storageKey) || 0)
    const now = Date.now()

    if (lastSentAt && now - lastSentAt < dedupeMs) {
      return true
    }

    window.sessionStorage.setItem(storageKey, String(now))
    return false
  } catch {
    return false
  }
}

export function UserActivityTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastRouteKeyRef = useRef<string | null>(null)

  const serializedSearch = searchParams?.toString() || ''
  const search = serializedSearch ? `?${serializedSearch}` : null
  const routeKey = pathname ? `${pathname}${search || ''}` : null

  useEffect(() => {
    if (!pathname || !routeKey) return
    if (lastRouteKeyRef.current === routeKey) return

    lastRouteKeyRef.current = routeKey

    if (shouldSkipBySessionStorage(`nizam:route-view:${routeKey}`, ROUTE_VIEW_DEDUPE_MS)) {
      return
    }

    void postUserActivity('route_view', pathname, search)
  }, [pathname, routeKey, search])

  useEffect(() => {
    if (!pathname || !routeKey) return

    const heartbeatTimer = window.setInterval(() => {
      if (shouldSkipBySessionStorage(`nizam:heartbeat:${routeKey}`, HEARTBEAT_DEDUPE_MS)) {
        return
      }

      void postUserActivity('heartbeat', pathname, search)
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      window.clearInterval(heartbeatTimer)
    }
  }, [pathname, routeKey, search])

  return null
}
