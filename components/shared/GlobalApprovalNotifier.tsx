'use client'

/**
 * GlobalApprovalNotifier.tsx
 * Polling ringan di level shell dashboard untuk mendeteksi approval baru
 * dari mana pun user sedang berada, lalu membunyikan audio sekali.
 */

import { useCallback, useEffect, useRef } from 'react'
import {
  approvalSignalHasIncomingRow,
  buildApprovalSignalMarker,
  dispatchApprovalSignal,
  getApprovalSignalScopeKey,
  type ApprovalSignalEventDetail,
} from '@/lib/browser/approval-notifier'
import { getPendingApprovalNotificationMarker } from '@/modules/organization/actions/approval.actions'

const APPROVAL_POLL_INTERVAL_MS = 12_000
const APPROVAL_PLAYED_STORAGE_PREFIX = 'nizam:approval-notify:last-played:'
const APPROVAL_TOAST_ATTR = 'data-approval-notif-toast'
const APPROVAL_TOAST_DURATION_MS = 6000

interface GlobalApprovalNotifierProps {
  orgId: string
  activeBranchId?: string | null
}

function getPlayedStorageKey(scopeKey: string) {
  return `${APPROVAL_PLAYED_STORAGE_PREFIX}${scopeKey}`
}

export function GlobalApprovalNotifier({
  orgId,
  activeBranchId = null,
}: GlobalApprovalNotifierProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastSignalRef = useRef<ApprovalSignalEventDetail | null>(null)
  const isRefreshingRef = useRef(false)
  const activeScopeKeyRef = useRef(getApprovalSignalScopeKey(orgId, activeBranchId))

  const showApprovalToast = useCallback((pendingCount: number) => {
    if (typeof window === 'undefined') return

    const existing = document.querySelector(`[${APPROVAL_TOAST_ATTR}]`)
    if (existing) existing.remove()

    const el = document.createElement('a')
    el.href = '/accounting/approvals'
    el.setAttribute(APPROVAL_TOAST_ATTR, 'true')
    el.setAttribute('role', 'alert')
    el.setAttribute('aria-live', 'polite')
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9999',
      'display:flex', 'align-items:center', 'gap:10px',
      'background:#003366', 'color:#fff',
      'padding:12px 16px', 'border-radius:14px',
      'font-size:13px', 'font-weight:600',
      'box-shadow:0 8px 32px rgba(0,51,102,0.28)',
      'text-decoration:none', 'cursor:pointer',
      'opacity:0', 'transform:translateY(8px)',
      'transition:opacity 220ms ease, transform 220ms ease',
      'max-width:320px',
    ].join(';')

    el.innerHTML = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"',
      ' stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"',
      ' style="flex-shrink:0">',
      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>',
      '<path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      '</svg>',
      '<span>',
      pendingCount > 1 ? `${pendingCount} permintaan approval menunggu` : 'Ada permintaan approval baru',
      ' &mdash; <u>Lihat</u>',
      '</span>',
    ].join('')

    document.body.appendChild(el)

    requestAnimationFrame(() => {
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    })

    const timer = window.setTimeout(() => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(8px)'
      window.setTimeout(() => el.remove(), 220)
    }, APPROVAL_TOAST_DURATION_MS)

    el.addEventListener('click', () => {
      window.clearTimeout(timer)
      el.remove()
    })
  }, [])

  const playNotification = useCallback((signal: ApprovalSignalEventDetail) => {
    const audio = audioRef.current

    const scopeKey = getApprovalSignalScopeKey(signal.orgId, signal.branchId)
    const marker = buildApprovalSignalMarker(signal)

    try {
      const playedStorageKey = getPlayedStorageKey(scopeKey)
      const lastPlayedMarker = window.localStorage.getItem(playedStorageKey)
      if (lastPlayedMarker === marker) {
        return
      }

      window.localStorage.setItem(playedStorageKey, marker)
    } catch {
      // localStorage hanya dipakai untuk dedupe antar tab; gagal tidak fatal.
    }

    showApprovalToast(signal.pendingCount)

    if (audio) {
      audio.currentTime = 0
      void audio.play().catch(() => {
        // Browser bisa menolak autoplay sampai user pernah interaksi.
      })
    }
  }, [showApprovalToast])

  const refreshSignal = useCallback(async (options?: { silent?: boolean }) => {
    if (isRefreshingRef.current) return

    isRefreshingRef.current = true
    const scopeKey = getApprovalSignalScopeKey(orgId, activeBranchId)

    try {
      const marker = await getPendingApprovalNotificationMarker(orgId, activeBranchId)

      if (scopeKey !== activeScopeKeyRef.current) {
        return
      }

      const nextSignal: ApprovalSignalEventDetail = {
        orgId,
        branchId: activeBranchId,
        ...marker,
      }

      const previousSignal = lastSignalRef.current
      const nextMarker = buildApprovalSignalMarker(nextSignal)
      const previousMarker = previousSignal ? buildApprovalSignalMarker(previousSignal) : null
      const signalChanged = nextMarker !== previousMarker

      lastSignalRef.current = nextSignal

      if (signalChanged) {
        dispatchApprovalSignal(nextSignal)
      }

      if (!options?.silent && previousSignal && approvalSignalHasIncomingRow(previousSignal, nextSignal)) {
        playNotification(nextSignal)
      }
    } finally {
      isRefreshingRef.current = false
    }
  }, [activeBranchId, orgId, playNotification])

  useEffect(() => {
    activeScopeKeyRef.current = getApprovalSignalScopeKey(orgId, activeBranchId)
  }, [activeBranchId, orgId])

  useEffect(() => {
    const audio = new Audio('/notification.mp3')
    audio.preload = 'auto'
    audioRef.current = audio

    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    lastSignalRef.current = null
    void refreshSignal({ silent: true })

    const handleWindowFocus = () => {
      void refreshSignal()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshSignal()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const pollTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refreshSignal()
    }, APPROVAL_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(pollTimer)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshSignal])

  return null
}
