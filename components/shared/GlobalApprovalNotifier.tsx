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

  const playNotification = useCallback((signal: ApprovalSignalEventDetail) => {
    const audio = audioRef.current
    if (!audio) return

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

    audio.currentTime = 0
    void audio.play().catch(() => {
      // Browser bisa menolak autoplay sampai user pernah interaksi.
    })
  }, [])

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
