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
import { getNewCrmTicketsCount } from '@/modules/crm/actions/tickets.actions'
import { getBranches, getChildOrgs, getMyOrganizations } from '@/modules/organization/actions/org.actions'
import type { AccessibleOrganization, BranchSummary } from '@/modules/organization/lib/org-context'

export type SidebarChromeMetrics = {
  pendingApprovals: number
  unpostedJournals: number
  pendingPurchaseRequests: number
  hrisNotifications: number
  pendingCoaRequests: number
  newCrmTickets: number
}

export type HeaderNavigationData = {
  organizations: AccessibleOrganization[]
  branches: BranchSummary[]
}

async function resolveWithFallback<T>(
  label: string,
  fallback: T,
  load: () => Promise<T>
): Promise<T> {
  try {
    return await load()
  } catch (error) {
    console.error(`[dashboard-shell.actions] ${label} failed:`, error)
    return fallback
  }
}

export async function getSidebarChromeMetrics(
  orgId: string,
  branchId?: string | null
): Promise<SidebarChromeMetrics> {
  const [
    pendingApprovals,
    unpostedJournals,
    pendingPurchaseRequests,
    hrisNotifications,
    pendingCoaRequests,
    newCrmTickets,
  ] = await Promise.all([
    resolveWithFallback('pending approvals', 0, () => getPendingApprovalsCount(orgId, branchId)),
    resolveWithFallback('unposted journals', 0, () => getUnpostedJournalsCount(orgId, branchId)),
    resolveWithFallback('pending purchase requests', 0, () => getPendingPurchaseRequestsCount(orgId, branchId)),
    resolveWithFallback('hris reset requests', 0, () => getResetRequestsCount(orgId, branchId)),
    resolveWithFallback('pending coa requests', 0, () => getPendingCoaRequestCount(orgId)),
    resolveWithFallback('new crm tickets', 0, () => getNewCrmTicketsCount(orgId, branchId)),
  ])

  return {
    pendingApprovals,
    unpostedJournals,
    pendingPurchaseRequests,
    hrisNotifications,
    pendingCoaRequests,
    newCrmTickets,
  }
}

export async function getHeaderPendingApprovals(
  orgId: string,
  branchId?: string | null
): Promise<number> {
  return resolveWithFallback('header pending approvals', 0, () => getPendingApprovalsCount(orgId, branchId))
}

export async function getHeaderTokenSummary(orgId: string): Promise<AiTokenHeaderSummary | null> {
  return resolveWithFallback('header token summary', null, () => getAiTokenHeaderSummary(orgId))
}

export async function getHeaderNavigationData(orgId: string): Promise<HeaderNavigationData> {
  const [organizations, branches, childOrgs] = await Promise.all([
    resolveWithFallback('header organizations', [], () => getMyOrganizations()),
    resolveWithFallback('header branches', [], () => getBranches(orgId)),
    resolveWithFallback('header child orgs', [], () => getChildOrgs(orgId)),
  ])

  const knownOrgIds = new Set(organizations.map((membership) => membership.orgId))
  const childOrganizations: AccessibleOrganization[] = childOrgs
    .filter((child: { id?: string | null }) => Boolean(child?.id) && !knownOrgIds.has(String(child.id)))
    .map((child: any) => ({
      orgId: String(child.id),
      role: 'admin',
      roleId: null,
      joinedAt: child.created_at || new Date(0).toISOString(),
      org: {
        id: String(child.id),
        name: String(child.name || 'Organisasi'),
        slug: String(child.slug || ''),
        logo_url: child.logo_url ?? null,
        settings: child.settings ?? {},
        is_active: Boolean(child.is_active ?? true),
        parent_org_id: orgId,
        parent_org_name: null,
      },
    }))

  return {
    organizations: [...organizations, ...childOrganizations],
    branches,
  }
}
