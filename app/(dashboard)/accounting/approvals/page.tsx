import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getPendingApprovals } from '@/modules/organization/actions/approval.actions'
import { hasRolePermission } from '@/modules/organization/lib/navigation-access'
import { ApprovalClient } from './ApprovalClient'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  if (!hasRolePermission(orgData.role, orgData.permissions, 'accounting:read')) {
    redirect('/dashboard?error=akses-ditolak')
  }

  const activeBranch = await getActiveBranch(orgData.org.id)
  const approvals = await getPendingApprovals(orgData.org.id, activeBranch?.id)

  return (
    <div className="p-8">
      <ApprovalClient
        orgId={orgData.org.id}
        activeBranchId={activeBranch?.id ?? null}
        initialApprovals={approvals}
      />
    </div>
  )
}
