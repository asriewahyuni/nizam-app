'use server'

import type { BSCDeckSummary } from '@/modules/accounting/actions/bsc.actions'
import { getBSCDeckSummaries } from '@/modules/accounting/actions/bsc.actions'
import type { DeckCashSummary } from '@/modules/accounting/actions/reports.actions'
import { getDeckCashSummaries } from '@/modules/accounting/actions/reports.actions'
import type { BranchSummary } from '@/modules/organization/lib/org-context'
import { getBranchesByOrganizations } from './org.actions'

export type OrganizationDeckData = {
  orgBscSummaries: Record<string, BSCDeckSummary>
  orgBranchesByOrgId: Record<string, BranchSummary[]>
  orgCashSummaries: Record<string, DeckCashSummary>
  branchCashSummaries: Record<string, DeckCashSummary>
}

export async function getOrganizationDeckData(orgIds: string[]): Promise<OrganizationDeckData> {
  const normalizedOrgIds = Array.from(new Set(orgIds.map((orgId) => String(orgId || '').trim()).filter(Boolean)))
  if (normalizedOrgIds.length === 0) {
    return {
      orgBscSummaries: {},
      orgBranchesByOrgId: {},
      orgCashSummaries: {},
      branchCashSummaries: {},
    }
  }

  const orgBranchesByOrgId = await getBranchesByOrganizations(normalizedOrgIds)
  const [orgBscSummaries, deckCashSummaries] = await Promise.all([
    getBSCDeckSummaries(normalizedOrgIds),
    getDeckCashSummaries(normalizedOrgIds, orgBranchesByOrgId),
  ])

  return {
    orgBscSummaries,
    orgBranchesByOrgId,
    orgCashSummaries: deckCashSummaries.orgSummaries,
    branchCashSummaries: deckCashSummaries.branchSummaries,
  }
}
