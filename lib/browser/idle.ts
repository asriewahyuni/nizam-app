'use client'

/**
 * Schedule lightweight client-side work after the current interaction settles.
 * Falls back to a short timeout when requestIdleCallback is unavailable.
 */

type IdleCallbackHandle = number

type IdleSchedulerWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => IdleCallbackHandle
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void
}

export function scheduleIdleTask(
  callback: () => void,
  options?: {
    delayMs?: number
    timeoutMs?: number
  }
) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const delayMs = options?.delayMs ?? 240
  const timeoutMs = options?.timeoutMs ?? 1200
  const idleWindow = window as IdleSchedulerWindow
  let timeoutId: number | null = null
  let idleId: IdleCallbackHandle | null = null
  let hasRun = false

  const run = () => {
    if (hasRun) return
    hasRun = true
    callback()
  }

  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleId = idleWindow.requestIdleCallback(run, { timeout: timeoutMs })
  } else {
    timeoutId = window.setTimeout(run, delayMs)
  }

  return () => {
    hasRun = true

    if (idleId !== null && typeof idleWindow.cancelIdleCallback === 'function') {
      idleWindow.cancelIdleCallback(idleId)
    }

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }
  }
}
