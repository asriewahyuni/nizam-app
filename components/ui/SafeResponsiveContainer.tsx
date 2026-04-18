'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { ResponsiveContainer } from 'recharts'

import { cn } from '@/lib/utils'

interface SafeResponsiveContainerProps {
  children: ReactNode
  className?: string
}

function measureElement(element: HTMLElement | null) {
  if (!element) {
    return { width: 0, height: 0 }
  }

  const rect = element.getBoundingClientRect()
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

/**
 * Recharts warns when it mounts before the parent has a measurable size.
 * Delay the chart until the wrapper has valid dimensions.
 */
export function SafeResponsiveContainer({ children, className }: SafeResponsiveContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState(() => ({ width: 0, height: 0 }))

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    let frame = 0

    const updateSize = () => {
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        setSize((previous) => {
          const next = measureElement(element)
          if (previous.width === next.width && previous.height === next.height) {
            return previous
          }
          return next
        })
      })
    }

    updateSize()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize)
      return () => {
        cancelAnimationFrame(frame)
        window.removeEventListener('resize', updateSize)
      }
    }

    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(element)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className={cn('h-full w-full min-w-0', className)}>
      {size.width > 0 && size.height > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}
