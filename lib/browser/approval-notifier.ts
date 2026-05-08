/**
 * approval-notifier.ts
 * Helper event browser untuk sinkronkan bunyi notif approval,
 * badge approval, dan daftar approval antar komponen dashboard.
 */

export const APPROVAL_SIGNAL_EVENT = 'nizam_approval_signal'

export type ApprovalNotificationMarker = {
  pendingCount: number
  latestPendingId: string | null
  latestRequestedAt: string | null
}

export type ApprovalSignalEventDetail = ApprovalNotificationMarker & {
  orgId: string
  branchId: string | null
}

export function getApprovalSignalScopeKey(orgId: string, branchId?: string | null) {
  return `${orgId}:${branchId || 'all'}`
}

export function buildApprovalSignalMarker(detail: ApprovalNotificationMarker) {
  return [
    String(detail.pendingCount || 0),
    detail.latestPendingId || '',
    detail.latestRequestedAt || '',
  ].join('|')
}

export function approvalSignalMatchesScope(
  detail: ApprovalSignalEventDetail,
  orgId: string,
  branchId?: string | null
) {
  return detail.orgId === orgId && (detail.branchId || null) === (branchId || null)
}

export function approvalSignalHasIncomingRow(
  previousDetail: ApprovalNotificationMarker,
  nextDetail: ApprovalNotificationMarker
) {
  const previousTimestamp = previousDetail.latestRequestedAt ? Date.parse(previousDetail.latestRequestedAt) : Number.NaN
  const nextTimestamp = nextDetail.latestRequestedAt ? Date.parse(nextDetail.latestRequestedAt) : Number.NaN

  if (Number.isFinite(nextTimestamp) && !Number.isFinite(previousTimestamp)) {
    return nextDetail.pendingCount > previousDetail.pendingCount
  }

  if (Number.isFinite(previousTimestamp) && Number.isFinite(nextTimestamp) && nextTimestamp > previousTimestamp) {
    return true
  }

  return nextDetail.pendingCount > previousDetail.pendingCount
    && (nextDetail.latestPendingId || null) !== (previousDetail.latestPendingId || null)
}

export function dispatchApprovalSignal(detail: ApprovalSignalEventDetail) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<ApprovalSignalEventDetail>(APPROVAL_SIGNAL_EVENT, {
      detail,
    })
  )
}

export function subscribeApprovalSignal(handler: (detail: ApprovalSignalEventDetail) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ApprovalSignalEventDetail>
    if (!customEvent.detail) return
    handler(customEvent.detail)
  }

  window.addEventListener(APPROVAL_SIGNAL_EVENT, listener)

  return () => {
    window.removeEventListener(APPROVAL_SIGNAL_EVENT, listener)
  }
}
