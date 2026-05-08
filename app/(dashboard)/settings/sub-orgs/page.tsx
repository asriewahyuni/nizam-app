import {
  getActiveOrg,
  getChildOrgs,
  getMyOrganizations,
  isSubOrgManagerFeatureEnabled,
  getHoldingEmployees,
  getOrgLimits,
} from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import SubOrgClient from './SubOrgClient'

export default async function SubOrgsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const activeOrgWithParent = orgData.org as typeof orgData.org & { parent_org_id?: string | null }
  const isMainOrganization = !activeOrgWithParent.parent_org_id
  if (!isMainOrganization) {
    return redirect('/dashboard')
  }

  if (orgData.role !== 'owner' && orgData.role !== 'admin') {
    return redirect('/settings/business') // Only admin/owner can manage child orgs
  }

  const [childOrgs, picFeatureEnabled, limits] = await Promise.all([
    getChildOrgs(orgData.org.id),
    isSubOrgManagerFeatureEnabled(),
    getOrgLimits(orgData.org.id),
  ])

  // Get potential unlinked orgs that the user owns
  const myOrgs = await getMyOrganizations()
  const unlinkedOrgs =
    'error' in myOrgs
      ? []
      : myOrgs.filter(
          (o) =>
            o.role === 'owner' &&
            o.orgId !== orgData.org.id &&
            !childOrgs.some((child: { id?: string }) => child.id === o.orgId)
        )

  // Get holding's employees for PIC dropdown
  // Using getHoldingEmployees (admin client) so the list is NOT sliced by user's active branch RLS
  const employees = picFeatureEnabled ? await getHoldingEmployees(orgData.org.id) : []
  const canMutate = orgData.role === 'owner'
  const canManageConsolidationMappings = orgData.role === 'owner' || orgData.role === 'admin'

  return (
    <SubOrgClient
      orgId={orgData.org.id}
      childOrgs={childOrgs}
      unlinkedOrgs={unlinkedOrgs.map((o) => o.org)}
      employees={employees}
      canMutate={canMutate}
      canManageConsolidationMappings={canManageConsolidationMappings}
      picFeatureEnabled={picFeatureEnabled}
      limits={limits}
    />
  )
}
