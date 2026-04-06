import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getCoaRequestsByParent,
  getCoaRequestsByRequester,
} from '@/modules/accounting/actions/coa-request.actions'
import { checkCanManageCoA, getChartOfAccounts } from '@/modules/accounting/actions/coa.actions'
import { CoaRequestClient } from './CoaRequestClient'

export const metadata: Metadata = { title: 'Pengajuan Rekening CoA | NIZAM' }
export const dynamic = 'force-dynamic'

export default async function CoaRequestsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  const orgId = orgData.org.id
  const orgEntity = orgData.org as typeof orgData.org & {
    parent_org_id?: string | null
    name: string
  }

  // Cek apakah org ini Parent atau Child
  const { canManageDirect, isParentOrg } = await checkCanManageCoA(orgId)
  const parentOrgId = orgEntity.parent_org_id ?? null

  // Parent: tampilkan request yang masuk
  // Child/Branch: tampilkan request yang mereka ajukan
  const [incomingRequests, myRequests, parentCoaGuideAccounts] = await Promise.all([
    isParentOrg ? getCoaRequestsByParent(orgId) : Promise.resolve([]),
    !isParentOrg && parentOrgId
      ? getCoaRequestsByRequester(orgId)
      : Promise.resolve([]),
    !isParentOrg && parentOrgId
      ? getChartOfAccounts(parentOrgId).then((accounts) => {
          return accounts
            .sort((left, right) => left.code.localeCompare(right.code))
            .map((account) => ({
              id: account.id,
              code: account.code,
              name: account.name,
              type: account.type,
              normal_balance: account.normal_balance,
              parent_id: account.parent_id,
            }))
        })
      : Promise.resolve([]),
  ])

  return (
    <CoaRequestClient
      orgId={orgId}
      orgName={orgEntity.name}
      parentOrgId={parentOrgId}
      isParentOrg={isParentOrg}
      canManageDirect={canManageDirect}
      incomingRequests={incomingRequests}
      myRequests={myRequests}
      parentCoaGuideAccounts={parentCoaGuideAccounts}
      userRole={orgData.role}
    />
  )
}
