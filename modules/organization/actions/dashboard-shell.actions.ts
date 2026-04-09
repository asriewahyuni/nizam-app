'use server'

/**
 * dashboard-shell.actions.ts
 * Centralized lazy-load helpers for dashboard chrome so layout navigation
 * can render faster while badges/switchers hydrate after the shell appears.
 */

import type { AiTokenHeaderSummary } from '@/modules/ai/lib/ai-token'
import { getAiTokenHeaderSummary } from '@/modules/ai/lib/ai-token.server'
import { getPendingApprovalsCount } from '@/modules/organization/actions/approval.actions'
import { getResetRequestsCount } from '@/modules/organization/actions/hris.actions'
import { getUnpostedJournalsCount } from '@/modules/accounting/actions/journal.actions'
import { getPendingPurchaseRequestsCount } from '@/modules/purchasing/actions/purchasing.actions'
import { getPendingCoaRequestCount } from '@/modules/accounting/actions/coa-request.actions'
import { getBranches, getMyOrganizations } from '@/modules/organization/actions/org.actions'
import type { AccessibleOrganization, BranchSummary } from '@/modules/organization/lib/org-context'

export type SidebarChromeMetrics = {
  pendingApprovals: number
  unpostedJournals: number
  pendingPurchaseRequests: number
  hrisNotifications: number
  pendingCoaRequests: number
}

export type HeaderNavigationData = {
  organizations: AccessibleOrganization[]
  branches: BranchSummary[]
}

function resolveSettledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  if (result.status === 'fulfilled') return result.value

  console.error('[dashboard-shell.actions] Lazy chrome fetch failed:', result.reason)
  return fallback
}

export async function getSidebarChromeMetrics(
  orgId: string,
  branchId?: string | null
): Promise<SidebarChromeMetrics> {
  const results = await Promise.allSettled([
    getPendingApprovalsCount(orgId, branchId),
    getUnpostedJournalsCount(orgId, branchId),
    getPendingPurchaseRequestsCount(orgId, branchId),
    getResetRequestsCount(orgId),
    getPendingCoaRequestCount(orgId),
  ])

  return {
    pendingApprovals: resolveSettledValue(results[0], 0),
    unpostedJournals: resolveSettledValue(results[1], 0),
    pendingPurchaseRequests: resolveSettledValue(results[2], 0),
    hrisNotifications: resolveSettledValue(results[3], 0),
    pendingCoaRequests: resolveSettledValue(results[4], 0),
  }
}

export async function getHeaderPendingApprovals(
  orgId: string,
  branchId?: string | null
): Promise<number> {
  const result = await Promise.allSettled([getPendingApprovalsCount(orgId, branchId)])
  return resolveSettledValue(result[0], 0)
}

export async function getHeaderTokenSummary(orgId: string): Promise<AiTokenHeaderSummary | null> {
  const result = await Promise.allSettled([getAiTokenHeaderSummary(orgId)])
  return resolveSettledValue(result[0], null)
}

export async function getHeaderNavigationData(orgId: string): Promise<HeaderNavigationData> {
  const results = await Promise.allSettled([
    getMyOrganizations(),
    getBranches(orgId),
  ])

  return {
    organizations: resolveSettledValue(results[0], []),
    branches: resolveSettledValue(results[1], []),
  }
}
