'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

const ROUTE_LOADING_START_EVENT = 'nizam_route_loading_start'
const PROGRESS_HIDE_DELAY_MS = 180
const DURATION_BADGE_HIDE_DELAY_MS = 1800

function formatDurationMs(durationMs: number) {
  return `${Math.max(0, Math.round(durationMs))} ms`
}

function getInitialNavigationDuration() {
  const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (!navigationEntry) return null

  if (navigationEntry.loadEventEnd > 0) return navigationEntry.loadEventEnd
  if (navigationEntry.domComplete > 0) return navigationEntry.domComplete
  if (navigationEntry.responseEnd > 0) return navigationEntry.responseEnd
  return performance.now()
}

export function RouteProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = useMemo(() => {
    const search = searchParams?.toString()
    return search ? `${pathname}?${search}` : pathname
  }, [pathname, searchParams])

  const [isActive, setIsActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [isDurationVisible, setIsDurationVisible] = useState(false)
  const progressIntervalRef = useRef<number | null>(null)
  const elapsedIntervalRef = useRef<number | null>(null)
  const progressHideTimeoutRef = useRef<number | null>(null)
  const durationHideTimeoutRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastElapsedMsRef = useRef<number | null>(null)
  const lastRouteKeyRef = useRef(routeKey)
  const hasMountedRef = useRef(false)

  useEffect(() => {
    const clearProgressInterval = () => {
      if (progressIntervalRef.current !== null) {
        window.clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }

    const clearElapsedInterval = () => {
      if (elapsedIntervalRef.current !== null) {
        window.clearInterval(elapsedIntervalRef.current)
        elapsedIntervalRef.current = null
      }
    }

    const clearProgressHideTimeout = () => {
      if (progressHideTimeoutRef.current) {
        window.clearTimeout(progressHideTimeoutRef.current)
        progressHideTimeoutRef.current = null
      }
    }

    const clearDurationHideTimeout = () => {
      if (durationHideTimeoutRef.current) {
        window.clearTimeout(durationHideTimeoutRef.current)
        durationHideTimeoutRef.current = null
      }
    }

    const clearTransientState = () => {
      clearProgressInterval()
      clearElapsedInterval()
      clearProgressHideTimeout()
      clearDurationHideTimeout()
    }

    const scheduleDurationHide = () => {
      clearDurationHideTimeout()
      durationHideTimeoutRef.current = window.setTimeout(() => {
        setIsDurationVisible(false)
      }, DURATION_BADGE_HIDE_DELAY_MS)
    }

    const updateElapsedMs = (nextElapsedMs: number) => {
      lastElapsedMsRef.current = nextElapsedMs
      setElapsedMs(nextElapsedMs)
    }

    const start = () => {
      clearTransientState()
      startTimeRef.current = performance.now()
      setIsActive(true)
      setProgress(8)
      updateElapsedMs(0)
      setIsDurationVisible(true)

      progressIntervalRef.current = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 88) return current
          const increment = current < 25 ? 12 : current < 55 ? 7 : current < 75 ? 3 : 1.2
          return Math.min(88, current + increment)
        })
      }, 120)

      elapsedIntervalRef.current = window.setInterval(() => {
        if (startTimeRef.current === null) return
        updateElapsedMs(performance.now() - startTimeRef.current)
      }, 60)
    }

    const finish = () => {
      clearProgressInterval()
      clearElapsedInterval()
      clearProgressHideTimeout()

      const measuredDuration =
        startTimeRef.current === null ? lastElapsedMsRef.current ?? 0 : performance.now() - startTimeRef.current
      startTimeRef.current = null

      setIsActive(true)
      setProgress(100)
      updateElapsedMs(measuredDuration)
      setIsDurationVisible(true)
      scheduleDurationHide()

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
      const initialDuration = getInitialNavigationDuration()
      if (initialDuration !== null) {
        const initialDisplayTimeout = window.setTimeout(() => {
          updateElapsedMs(initialDuration)
          setIsDurationVisible(true)
          scheduleDurationHide()
        }, 0)
        progressHideTimeoutRef.current = initialDisplayTimeout
      }
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

  const durationLabel = elapsedMs === null ? null : formatDurationMs(elapsedMs)

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

      {durationLabel && (
        <div
          aria-live="polite"
          className={`pointer-events-none fixed inset-x-0 top-2 z-[121] flex justify-center px-4 transition-all duration-200 ${
            isDurationVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
          }`}
        >
          <div
            className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] shadow-lg backdrop-blur ${
              isActive
                ? 'border-sky-300/70 bg-slate-950/88 text-sky-100'
                : 'border-emerald-200/80 bg-white/92 text-slate-800'
            }`}
          >
            {isActive ? `Loading ${durationLabel}` : `Load ${durationLabel}`}
          </div>
        </div>
      )}
    </>
  )
}
