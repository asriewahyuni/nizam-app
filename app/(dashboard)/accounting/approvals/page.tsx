import { redirect } from 'next/navigation'
import { getActiveBranch, getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getPendingApprovals } from '@/modules/organization/actions/approval.actions'
import { ApprovalClient } from './ApprovalClient'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const orgData = await getActiveOrg()
  if (!orgData) redirect('/onboarding')

  // Hanya owner, admin, manager yang bisa akses
  if (!['owner', 'admin', 'manager'].includes(orgData.role)) {
    redirect('/dashboard')
  }

  const activeBranch = await getActiveBranch(orgData.org.id)
  const approvals = await getPendingApprovals(orgData.org.id, activeBranch?.id)

  return (
    <div className="p-8">
      <ApprovalClient orgId={orgData.org.id} initialApprovals={approvals} />
    </div>
  )
}
