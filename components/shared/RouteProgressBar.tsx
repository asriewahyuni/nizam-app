'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const ROUTE_LOADING_START_EVENT = 'nizam_route_loading_start'
const PROGRESS_HIDE_DELAY_MS = 180

function getInternalNavigationHref(anchor: HTMLAnchorElement | null) {
  if (!anchor) return null
  if (anchor.target && anchor.target !== '_self') return null
  if (anchor.hasAttribute('download')) return null
  if (anchor.getAttribute('data-route-loading') === 'false') return null

  const rawHref = anchor.getAttribute('href')
  if (!rawHref || rawHref.startsWith('#')) return null

  let url: URL
  try {
    url = new URL(rawHref, window.location.href)
  } catch {
    return null
  }

  if (url.origin !== window.location.origin) return null

  const currentPath = `${window.location.pathname}${window.location.search}`
  const nextPath = `${url.pathname}${url.search}`
  if (nextPath === currentPath) return null

  return nextPath
}


export function RouteProgressBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = useMemo(() => {
    const search = searchParams?.toString()
    return search ? `${pathname}?${search}` : pathname
  }, [pathname, searchParams])

  const [isActive, setIsActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const progressIntervalRef = useRef<number | null>(null)
  const progressHideTimeoutRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastRouteKeyRef = useRef(routeKey)
  const hasMountedRef = useRef(false)
  const prefetchedRoutesRef = useRef<Set<string>>(new Set())

  const prefetchInternalRoute = useCallback((href: string | null) => {
    if (!href || prefetchedRoutesRef.current.has(href)) return

    prefetchedRoutesRef.current.add(href)
    void router.prefetch(href)
  }, [router])

  useEffect(() => {
    const clearProgressInterval = () => {
      if (progressIntervalRef.current !== null) {
        window.clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }

    const clearProgressHideTimeout = () => {
      if (progressHideTimeoutRef.current) {
        window.clearTimeout(progressHideTimeoutRef.current)
        progressHideTimeoutRef.current = null
      }
    }

    const clearTransientState = () => {
      clearProgressInterval()
      clearProgressHideTimeout()
    }

    const start = () => {
      clearTransientState()
      startTimeRef.current = performance.now()
      setIsActive(true)
      setProgress(8)

      progressIntervalRef.current = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 88) return current
          const increment = current < 25 ? 12 : current < 55 ? 7 : current < 75 ? 3 : 1.2
          return Math.min(88, current + increment)
        })
      }, 120)
    }

    const finish = () => {
      clearProgressInterval()
      clearProgressHideTimeout()
      startTimeRef.current = null

      setIsActive(true)
      setProgress(100)

      progressHideTimeoutRef.current = window.setTimeout(() => {
        setIsActive(false)
        setProgress(0)
      }, PROGRESS_HIDE_DELAY_MS)
    }

    const handleRouteStart = () => {
      start()
    }

    window.addEventListener(ROUTE_LOADING_START_EVENT, handleRouteStart)

    if (!hasMountedRef.current) {
      hasMountedRef.current = true
    } else if (lastRouteKeyRef.current !== routeKey && startTimeRef.current !== null) {
      lastRouteKeyRef.current = routeKey
      finish()
    } else {
      lastRouteKeyRef.current = routeKey
    }

    return () => {
      window.removeEventListener(ROUTE_LOADING_START_EVENT, handleRouteStart)
      clearTransientState()
    }
  }, [routeKey])

  useEffect(() => {
    const getAnchorFromEvent = (event: Event) => {
      const target = event.target
      return target instanceof Element ? target.closest('a[href]') as HTMLAnchorElement | null : null
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const href = getInternalNavigationHref(getAnchorFromEvent(event))
      if (!href) return

      window.dispatchEvent(new Event(ROUTE_LOADING_START_EVENT))
      prefetchInternalRoute(href)
    }

    const handleDocumentWarmup = (event: Event) => {
      prefetchInternalRoute(getInternalNavigationHref(getAnchorFromEvent(event)))
    }

    document.addEventListener('click', handleDocumentClick, true)
    document.addEventListener('pointerover', handleDocumentWarmup, true)
    document.addEventListener('focusin', handleDocumentWarmup, true)
    document.addEventListener('touchstart', handleDocumentWarmup, true)

    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
      document.removeEventListener('pointerover', handleDocumentWarmup, true)
      document.removeEventListener('focusin', handleDocumentWarmup, true)
      document.removeEventListener('touchstart', handleDocumentWarmup, true)
    }
  }, [prefetchInternalRoute])

  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 z-[120] transition-opacity duration-150 ${
          isActive ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="h-1 origin-left bg-gradient-to-r from-[#003366] via-emerald-500 to-sky-400 shadow-[0_0_18px_rgba(14,165,233,0.28)] transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

    </>
  )
}
