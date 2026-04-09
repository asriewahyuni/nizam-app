/**
 * approval-realtime.ts
 * Helper untuk memastikan event realtime approval relevan dengan unit aktif
 * sebelum shell dashboard melakukan refresh badge approval.
 */

type ApprovalRealtimeRow = {
  branch_id?: string | null
}

type ApprovalRealtimePayload = {
  new?: ApprovalRealtimeRow | null
  old?: ApprovalRealtimeRow | null
}

export function approvalRequestTouchesActiveBranch(
  payload: ApprovalRealtimePayload,
  activeBranchId?: string | null
) {
  if (!activeBranchId) return true

  return payload.new?.branch_id === activeBranchId || payload.old?.branch_id === activeBranchId
}
