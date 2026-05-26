'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

const MAX_PULL_DISTANCE = 92
const REFRESH_THRESHOLD = 66
const REFRESH_HOLD_MS = 620

function isTouchMobileOrTablet() {
  if (typeof window === 'undefined') return false

  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window
  if (!hasTouch) return false

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const noHover = window.matchMedia?.('(hover: none)').matches ?? false

  return coarsePointer || noHover
}

export function MobilePullToRefresh({ scrollContainerId }: { scrollContainerId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const pullDistanceRef = useRef(0)
  const trackingRef = useRef(false)
  const startedAtTopRef = useRef(false)
  const touchStartYRef = useRef(0)

  useEffect(() => {
    const syncCapability = () => setEnabled(isTouchMobileOrTablet())
    syncCapability()
    window.addEventListener('resize', syncCapability)
    return () => window.removeEventListener('resize', syncCapability)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const scrollRoot = document.getElementById(scrollContainerId)
    if (!scrollRoot) return

    const onTouchStart = (event: TouchEvent) => {
      if (refreshing || event.touches.length !== 1) return

      const atTop = scrollRoot.scrollTop <= 0
      startedAtTopRef.current = atTop
      trackingRef.current = atTop
      touchStartYRef.current = event.touches[0].clientY
      pullDistanceRef.current = 0
      setPullDistance(0)
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!trackingRef.current || !startedAtTopRef.current) return

      const currentY = event.touches[0].clientY
      const deltaY = currentY - touchStartYRef.current
      if (deltaY <= 0) {
        pullDistanceRef.current = 0
        setPullDistance(0)
        return
      }

      if (scrollRoot.scrollTop > 0) {
        trackingRef.current = false
        pullDistanceRef.current = 0
        setPullDistance(0)
        return
      }

      const easedDistance = Math.min(MAX_PULL_DISTANCE, deltaY * 0.52)
      pullDistanceRef.current = easedDistance
      setPullDistance(easedDistance)
      event.preventDefault()
    }

    const onTouchEnd = () => {
      if (!trackingRef.current) {
        pullDistanceRef.current = 0
        setPullDistance(0)
        return
      }

      trackingRef.current = false
      const shouldRefresh = pullDistanceRef.current >= REFRESH_THRESHOLD

      if (!shouldRefresh) {
        pullDistanceRef.current = 0
        setPullDistance(0)
        return
      }

      setRefreshing(true)
      setPullDistance(REFRESH_THRESHOLD)
      router.refresh()
      window.setTimeout(() => {
        pullDistanceRef.current = 0
        setPullDistance(0)
        setRefreshing(false)
      }, REFRESH_HOLD_MS)
    }

    scrollRoot.addEventListener('touchstart', onTouchStart, { passive: true })
    scrollRoot.addEventListener('touchmove', onTouchMove, { passive: false })
    scrollRoot.addEventListener('touchend', onTouchEnd, { passive: true })
    scrollRoot.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      scrollRoot.removeEventListener('touchstart', onTouchStart)
      scrollRoot.removeEventListener('touchmove', onTouchMove)
      scrollRoot.removeEventListener('touchend', onTouchEnd)
      scrollRoot.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled, refreshing, router, scrollContainerId, pathname])

  if (!enabled) return null

  const visible = pullDistance > 0 || refreshing
  const ready = pullDistance >= REFRESH_THRESHOLD
  const indicatorLabel = refreshing ? 'Memuat ulang...' : ready ? 'Lepas untuk refresh' : 'Tarik untuk refresh'

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 z-[80] flex justify-center transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{
        top: 'calc(env(safe-area-inset-top) + 8px)',
        transform: `translateY(${pullDistance}px)`,
      }}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur">
        <RefreshCcw
          size={14}
          className={`${refreshing ? 'animate-spin text-blue-600' : ready ? 'text-emerald-600' : 'text-slate-500'}`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{indicatorLabel}</span>
      </div>
    </div>
  )
}
